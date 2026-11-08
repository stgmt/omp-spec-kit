import { mkdir } from "node:fs/promises";
import path from "node:path";
import { GitClient } from "./git.js";
import { isValidBranchName } from "./branch-policy.js";
import { repoHostAllowed, sanitizeRepoUrl } from "./mounts.js";
import { projectIdError } from "./project-id.js";
import { openSecret, sealSecret } from "./secrets.js";
import { requireScope } from "./scope.js";

export class RepoError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "RepoError";
    this.status = status;
    this.code = code;
    this.retryable = extra.retryable === true;
  }
}

const WRITE_ROLES = new Set(["owner", "writer"]);

function assertBindAllowed(ctx, project, config, mounts) {
  if (!WRITE_ROLES.has(ctx?.role)) {
    throw new RepoError(403, "FORBIDDEN_ROLE", `repo bindings require owner or writer role (caller role: ${ctx?.role ?? "none"})`);
  }
  if (!Array.isArray(ctx?.scopes) || !ctx.scopes.includes(project)) {
    throw new RepoError(403, "SCOPE_FORBIDDEN", `project ${project} is outside the caller's scopes`);
  }
  const configured = typeof mounts?.configuredProjects === "function" ? mounts.configuredProjects() : config.projects;
  if (!configured.includes(project)) {
    throw new RepoError(404, "PROJECT_NOT_CONFIGURED", `project is not configured on this service: ${project}`);
  }
}

function publicRegistration(row) {
  return {
    project: row.project,
    repoUrl: sanitizeRepoUrl(row.repoUrl),
    branch: row.branch,
    status: row.status,
    phase: row.phase ?? null,
    message: row.message ?? null,
    registeredBy: row.registeredBy ?? null,
    registeredAt: row.registeredAt ?? null,
    startedAt: row.startedAt ?? null,
    phaseStartedAt: row.phaseStartedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

/** Progress as a caller reads it: what it is doing now, and for how long. */
function progressOf(row, nowMs = Date.now()) {
  if (row === null || row.phase === null || row.phase === undefined) return null;
  const startedMs = Date.parse(row.startedAt ?? "");
  const phaseMs = Date.parse(row.phaseStartedAt ?? "");
  return {
    phase: row.phase,
    message: row.message ?? null,
    startedAt: row.startedAt ?? null,
    phaseStartedAt: row.phaseStartedAt ?? null,
    elapsedMs: Number.isFinite(startedMs) ? Math.max(0, nowMs - startedMs) : null,
    phaseElapsedMs: Number.isFinite(phaseMs) ? Math.max(0, nowMs - phaseMs) : null,
  };
}

function publicBinding(row) {
  return {
    project: row.project,
    repoUrl: sanitizeRepoUrl(row.repoUrl),
    branch: row.branch,
    status: row.status,
    boundBy: row.boundBy,
    boundAt: row.boundAt,
    migratedFrom: row.migratedFrom === null ? null : sanitizeRepoUrl(row.migratedFrom),
    lastError: row.lastError,
  };
}

/**
 * Repo bindings (TASK-17): every project lives in its own specs repository.
 * Binding is server-side state — the client (.mcp.json) never carries repo
 * URLs or tokens. Re-binding migrates the project's .specs snapshot into the
 * target repo as a service-bot commit; git history is not transferred (pushing
 * refs would leak every other project's ancestors). Pre-migration published
 * versions stay readable from the previous clone, which is kept on disk.
 */
export function createRepoManager({ mounts, store, config, identity, secretsKey, logger = () => {}, afterRepoChange = null }) {
  const audit = (entry) => { try { store?.logAccess?.(entry); } catch {} };

  function requireStore() {
    if (!store) throw new RepoError(503, "REPO_STORE_UNAVAILABLE", "repo bindings need the service store", { retryable: true });
  }

  async function probe(repoUrl, auth) {
    // ls-remote needs no clone: run it from the clones parent dir with the
    // caller's credential scoped to this repo's URL.
    const probeGit = new GitClient({ gitAuth: auth });
    await mkdir(mounts.clonesRoot, { recursive: true });
    return probeGit.probeRemote(repoUrl, { cwd: mounts.clonesRoot });
  }

  /** Reachability + credential check without persisting anything. */
  async function probeAccess({ ctx, project, repoUrl, token, username }) {
    requireStore();
    assertBindAllowed(ctx, project, config, mounts);
    if (typeof repoUrl !== "string" || repoUrl.length === 0) throw new RepoError(400, "REPO_URL_REQUIRED", "repoUrl is required");
    const host = repoHostAllowed(repoUrl, config.repoPolicy?.allowedHosts);
    if (!host.ok) throw new RepoError(400, "REPO_HOST_FORBIDDEN", host.reason);
    if (typeof token !== "string" || token.length === 0) throw new RepoError(400, "REPO_TOKEN_REQUIRED", "a git token for the repo is required");
    const head = await probe(repoUrl, { token, username: typeof username === "string" && username ? username : undefined, url: repoUrl }).catch((error) => {
      throw new RepoError(400, "REPO_PROBE_FAILED", `cannot read the repo with the supplied credential: ${String(error?.message ?? error).split("\n")[0]}`);
    });
    return { ok: true, head };
  }

  async function bind({ ctx, project, repoUrl, branch, token, username, migrate = true }) {
    assertBindAllowed(ctx, project, config, mounts);
    return bindInternal({ project, repoUrl, branch, token, username, migrate, boundBy: ctx.identity?.login ?? null, role: ctx.role ?? null });
  }

  /**
   * Self-service registration: the act that makes a project known to the
   * deployment at all. It is the only path that may create a project, so its
   * gate is deliberately narrower than binding:
   *
   * - the caller must be verified by the OPERATOR's YouTrack (`ctx.idp` null),
   *   the same boundary self-service IdP binding already draws, because a
   *   customer-IdP user must never provision projects on the operator;
   * - the caller must hold the owner role: creating a project and granting
   *   yourself access to it is an owner act, not a writer act;
   * - the project must be unknown to the deployment: not in the operator
   *   config, not bound by an IdP tenant, not registered by somebody else.
   *   Without this rule a caller could point an existing project id at their
   *   own repository and take it over;
   * - the repository credential must actually read the repository (the probe
   *   in `bindInternal`), so registration cannot claim an id with no target.
   *
   * The registration widens exactly one scope: the registering login's own
   * (`MountManager.registeredProjectsBy`). Nobody else sees the project until
   * the operator adds it to a tenant.
   *
   * Registration is asynchronous because it clones the repository: a large
   * repository takes minutes, so the call answers with a queued registration
   * and the work continues under a job whose phase the caller polls.
   */
  function prepareRegistration({ ctx, project, repoUrl, branch, token, username, migrate = true }) {
    requireStore();
    if (ctx?.idp != null) {
      throw new RepoError(403, "FORBIDDEN_IDP", "project registration is only available to users verified by the operator's YouTrack; a bound IdP registers its own projects");
    }
    if (ctx?.role !== "owner") {
      throw new RepoError(403, "FORBIDDEN_ROLE", `project registration requires the owner role (caller role: ${ctx?.role ?? "none"})`);
    }
    const projectId = typeof project === "string" ? project.trim() : "";
    const projectError = projectIdError(projectId);
    if (projectError !== null) throw new RepoError(400, "PROJECT_ID_INVALID", projectError);
    const login = ctx.identity?.login ?? null;
    const existing = store?.getRegistration?.(projectId) ?? null;
    if (existing !== null && existing.registeredBy !== login) {
      throw new RepoError(409, "PROJECT_ALREADY_REGISTERED", `project ${projectId} was registered by another principal`);
    }
    if (existing === null) {
      const operatorProjects = Array.isArray(config.projects) ? config.projects : [];
      if (operatorProjects.includes(projectId) || mounts?.isExternalProject?.(projectId) === true) {
        throw new RepoError(409, "PROJECT_ALREADY_CONFIGURED", `project ${projectId} is already configured on this service — bind it instead of registering it`);
      }
      if ((store?.getBinding?.(projectId) ?? null) !== null) {
        throw new RepoError(409, "PROJECT_ALREADY_BOUND", `project ${projectId} already has a repository binding; registration would take it over`);
      }
    }
    if (typeof repoUrl !== "string" || repoUrl.length === 0) throw new RepoError(400, "REPO_URL_REQUIRED", "repoUrl is required");
    const cleanRepoUrl = sanitizeRepoUrl(repoUrl);
    const host = repoHostAllowed(cleanRepoUrl, config.repoPolicy?.allowedHosts);
    if (!host.ok) throw new RepoError(400, "REPO_HOST_FORBIDDEN", host.reason);
    const resolvedBranch = typeof branch === "string" && branch.length > 0 ? branch : "main";
    if (!isValidBranchName(resolvedBranch)) throw new RepoError(400, "BRANCH_INVALID", "branch is not a valid git ref");
    if (typeof token !== "string" || token.length === 0) {
      throw new RepoError(400, "REPO_TOKEN_REQUIRED", "a git token for the repo is required (fine-grained PAT with contents read/write)");
    }
    if (!secretsKey) throw new RepoError(503, "SECRETS_UNAVAILABLE", "SPEC_REGISTRY_SECRETS_KEY is not set — credential bindings are disabled", { retryable: true });
    return { projectId, repoUrl: cleanRepoUrl, branch: resolvedBranch, token, username, migrate, login, role: ctx?.role ?? null, existing };
  }

  /** The registration as a caller reads it, plus the one next step. */
  function registrationView(row, { binding = null, pending, unchanged }) {
    return {
      registration: publicRegistration(row),
      binding: binding === null ? null : publicBinding(binding),
      pending,
      unchanged,
      progress: progressOf(row),
      credential: { repository: pending ? "pending" : "verified", repair: null },
      nextAction: pending
        ? `spec_repo ${JSON.stringify({ action: "status", project: row.project })}`
        : null,
    };
  }

  /**
   * Step 1: validate, seal the credential and queue the work. Returns the
   * queued view and the input the job needs; it never touches the remote.
   */
  async function registerStart(args) {
    const input = prepareRegistration(args);
    const current = store?.getBinding?.(input.projectId) ?? null;
    const existing = input.existing;
    if (existing?.status === "active" && current?.status === "active"
      && sanitizeRepoUrl(existing.repoUrl) === input.repoUrl && existing.branch === input.branch) {
      return { data: registrationView(existing, { binding: current, pending: false, unchanged: true }), job: null };
    }
    if (existing?.status === "pending") {
      return { data: registrationView(existing, { binding: current, pending: true, unchanged: true }), job: null };
    }
    // Seal the credential now: a registration queued before a restart must be
    // resumable, and the token is the only thing a job needs that the row
    // cannot carry in clear.
    await store.putCredential(input.projectId, {
      repoUrl: input.repoUrl,
      tokenEnc: sealSecret(secretsKey, input.token),
      username: typeof input.username === "string" && input.username ? input.username : null,
    });
    const now = new Date().toISOString();
    const row = {
      project: input.projectId,
      repoUrl: input.repoUrl,
      branch: input.branch,
      status: "pending",
      phase: "queued",
      message: "queued for registration",
      registeredBy: input.login,
      registeredAt: existing?.registeredAt ?? now,
      startedAt: now,
      phaseStartedAt: now,
      finishedAt: null,
    };
    await store.putRegistration(row);
    audit({ login: input.login, role: input.role, project: input.projectId, op: "project-register", spec: null, result: `queued:${input.repoUrl}` });
    return { data: registrationView(row, { binding: current, pending: true, unchanged: false }), job: input };
  }

  /**
   * Step 2: the work. Runs under a job, reports each phase into the store, and
   * leaves either an `active` row or an `error` row with the reason — never a
   * row that says pending with nothing running.
   */
  async function registerRun({ projectId, repoUrl, branch, token, username, migrate = true }) {
    const row = store?.getRegistration?.(projectId) ?? null;
    if (row === null) throw new RepoError(404, "REGISTRATION_NOT_FOUND", `project ${projectId} has no registration to run`);
    const report = (next) => {
      const at = new Date().toISOString();
      Object.assign(row, next, { phaseStartedAt: at });
      store?.updateRegistration?.(projectId, { ...next, phaseStartedAt: at });
    };
    try {
      const bound = await bindInternal({
        project: projectId, repoUrl, branch, token, username, migrate,
        boundBy: row.registeredBy ?? null, role: "owner", onPhase: (next) => report(next),
      });
      const at = new Date().toISOString();
      const done = { status: "active", phase: "active", message: "repository bound", finishedAt: at };
      await store?.updateRegistration?.(projectId, { ...done, phaseStartedAt: at });
      Object.assign(row, done);
      audit({ login: row.registeredBy ?? null, role: "owner", project: projectId, op: "project-register", spec: null, result: `ok:registered:${repoUrl}` });
      logger(`project-register ${projectId} -> ${repoUrl} (registered by ${row.registeredBy ?? "unknown"})`);
      return registrationView(row, { binding: store.getBinding(projectId), pending: false, unchanged: bound.unchanged === true });
    } catch (error) {
      const at = new Date().toISOString();
      const failed = {
        status: "error", phase: "error",
        message: String(error?.message ?? error).slice(0, 300),
        finishedAt: at,
      };
      await store?.updateRegistration?.(projectId, { ...failed, phaseStartedAt: at });
      Object.assign(row, failed);
      audit({ login: row.registeredBy ?? null, role: "owner", project: projectId, op: "project-register", spec: null, result: `error:${String(error?.code ?? "unknown")}` });
      throw error;
    }
  }

  /** The polling view: what the registration is doing, and the next step. */
  function registrationStatus({ project }) {
    const row = store?.getRegistration?.(project) ?? null;
    const binding = store?.getBinding?.(project) ?? null;
    const pending = row?.status === "pending";
    const view = row === null
      ? { registration: null, binding: binding === null ? null : publicBinding(binding), pending: false, unchanged: false, progress: null, credential: { repository: binding?.status === "active" ? "verified" : "not-bound", repair: null }, nextAction: null }
      : registrationView(row, { binding, pending, unchanged: false });
    if (row?.status === "error") {
      view.credential = { repository: "rejected", repair: `spec_repo ${JSON.stringify({ action: "register", project, repoUrl: row.repoUrl, token: "<fine-grained-pat-with-contents-rw>" })}` };
      view.nextAction = `spec_repo ${JSON.stringify({ action: "register", project, repoUrl: row.repoUrl, token: "<fine-grained-pat-with-contents-rw>" })}`;
    }
    return view;
  }

  /**
   * The input a queued registration needs to resume after a restart: the
   * credential was sealed when it was queued, so no clear token is stored.
   * Returns null when the credential cannot be recovered, which the caller
   * turns into an `error` row rather than a job that can never finish.
   */
  function registrationInput(row) {
    const credential = store?.getCredential?.(row.project) ?? null;
    if (credential === null || typeof credential.tokenEnc !== "string" || credential.tokenEnc.length === 0) return null;
    if (!secretsKey) return null;
    let token;
    try {
      token = openSecret(secretsKey, credential.tokenEnc);
    } catch {
      return null;
    }
    return { projectId: row.project, repoUrl: row.repoUrl, branch: row.branch, token, username: credential.username ?? undefined, migrate: true };
  }

  /** Mark a queued registration as interrupted when it cannot be resumed. */
  function failRegistration(project, message) {
    const at = new Date().toISOString();
    const row = store?.getRegistration?.(project) ?? null;
    if (row === null) return null;
    store?.updateRegistration?.(project, { status: "error", phase: "error", message: String(message).slice(0, 300), finishedAt: at, phaseStartedAt: at });
    return registrationStatus({ project });
  }

  /**
   * The bind body without the caller-scope gate. Used by the public path
   * (which asserts scopes first) and by the IdP binder attaching a specs repo
   * to a freshly bound tenant — the IdP-bind act itself is the authority.
   */
  async function bindInternal({ project, repoUrl, branch, token, username, migrate = true, boundBy = null, role = null, onPhase = null }) {
    const phase = (next) => { try { onPhase?.(next); } catch {} };
    requireStore();
    if (typeof repoUrl !== "string" || repoUrl.length === 0) throw new RepoError(400, "REPO_URL_REQUIRED", "repoUrl is required");
    const cleanRepoUrl = sanitizeRepoUrl(repoUrl);
    const host = repoHostAllowed(cleanRepoUrl, config.repoPolicy?.allowedHosts);
    if (!host.ok) throw new RepoError(400, "REPO_HOST_FORBIDDEN", host.reason);
    const resolvedBranch = typeof branch === "string" && branch.length > 0 ? branch : "main";
    if (!isValidBranchName(resolvedBranch)) throw new RepoError(400, "BRANCH_INVALID", "branch is not a valid git ref");
    if (typeof token !== "string" || token.length === 0) {
      throw new RepoError(400, "REPO_TOKEN_REQUIRED", "a git token for the repo is required (fine-grained PAT with contents read/write)");
    }
    if (!secretsKey) throw new RepoError(503, "SECRETS_UNAVAILABLE", "SPEC_REGISTRY_SECRETS_KEY is not set — credential bindings are disabled", { retryable: true });

    phase({ phase: "probing", message: "checking the repository credential" });
    const auth = { token, username: typeof username === "string" && username ? username : undefined, url: cleanRepoUrl };
    const head = await probe(cleanRepoUrl, auth).catch((error) => {
      throw new RepoError(400, "REPO_PROBE_FAILED", `cannot read the repo with the supplied credential: ${String(error?.message ?? error).split("\n")[0]}`);
    });

    const current = store?.getBinding?.(project) ?? null;
    // Re-binding the same (repoUrl, branch) is a no-op: without this the copy
    // would write the SOURCE snapshot over the bound repo and silently revert
    // every post-migration write.
    if (current?.status === "active" && sanitizeRepoUrl(current.repoUrl) === cleanRepoUrl && current.branch === resolvedBranch) {
      return { binding: publicBinding(current), head, unchanged: true };
    }
    const migratedFrom = current?.status === "active" ? sanitizeRepoUrl(current.repoUrl) : null;
    const migratedFromBranch = current?.status === "active" ? current.branch : null;

    // Mark migrating before touching remotes but keep the previous credential
    // until the target mirror is ready: a read during the move still resolves
    // `migratedFrom`, and that repo needs its own token, not the new one.
    // migratedFrom=null means the project had no previous repo (a first bind).
    const put = (status, lastError = null) => store?.putBinding?.({
      project, repoUrl: cleanRepoUrl, branch: resolvedBranch, status,
      boundBy, boundAt: new Date().toISOString(),
      migratedFrom: migratedFrom === cleanRepoUrl ? null : migratedFrom,
      migratedFromBranch: migratedFrom === cleanRepoUrl ? null : migratedFromBranch,
      lastError,
    });
    await put("migrating");

    const mount = mounts.descriptorFor(cleanRepoUrl, resolvedBranch, auth);
    try {
      // The mirror clone is the long part: mirroring a large repository takes
      // minutes, so the phase is reported before the wait, not after it.
      phase({ phase: "mirroring", message: "mirroring the repository" });
      await mounts.ensureMount(mount);
      await store?.putCredential?.(project, { repoUrl: cleanRepoUrl, tokenEnc: sealSecret(secretsKey, token), username: auth.username ?? null });
      await put("active");
      phase({ phase: "materialising", message: "checking out the corpus" });
      await mounts.projectRoot(project);
      // The binding change bypasses the write pipeline — the tracker
      // projection must be told explicitly or bound specs wait for the next
      // unrelated trigger before their cards exist.
      afterRepoChange?.();
    } catch (error) {
      await put("error", String(error?.message ?? error).slice(0, 500));
      if (error instanceof RepoError) throw error;
      throw new RepoError(502, "REPO_BIND_FAILED", `binding failed: ${String(error?.message ?? error).split("\n")[0]}`);
    }
    audit({ login: boundBy, role, project, op: "repo-bind", spec: null, result: `ok:bound:${cleanRepoUrl}` });
    logger(`repo-bind ${project} -> ${cleanRepoUrl} (bound)`);
    return {
      binding: publicBinding(store.getBinding(project)),
      head,
      migrated: null,
    };
  }

  async function unbind({ ctx, project }) {
    requireStore();
    assertBindAllowed(ctx, project, config, mounts);
    const row = store?.getBinding?.(project) ?? null;
    if (!row) throw new RepoError(404, "NOT_BOUND", `project ${project} has no repo binding`);
    // The bound clone stays on disk: ledger rows still reference its commits
    // for versioned reads across the migration boundary.
    await unbindInternal(project);
    const previous = sanitizeRepoUrl(row.repoUrl);
    audit({ login: ctx.identity?.login ?? null, role: ctx.role ?? null, project, op: "repo-unbind", spec: null, result: `ok:${previous}` });
    logger(`repo-unbind ${project} (was ${previous})`);
    return { unbound: project, previous };
  }

  /**
   * Credential-less cleanup used when an IdP unbind retires a tenant: the
   * tenant's projects cease to be configured, so their repo bindings must go
   * with it. The bound clone stays on disk for versioned reads.
   */
  async function unbindInternal(project) {
    const row = store?.getBinding?.(project) ?? null;
    if (!row) return null;
    await store?.deleteBinding?.(project);
    await store?.deleteCredential?.(project);
    // A later registration of the same id may point at another repository, so
    // the materialised root and its service cache must not outlive the binding.
    mounts.forgetProject?.(project);
    // The unbound project's specs leave the corpus — the tracker should drop
    // their cards on the next projection, not whenever something else fires.
    afterRepoChange?.();
    return sanitizeRepoUrl(row.repoUrl);
  }

  function bindings(ctx) {
    const scope = requireScope(ctx?.scope, "repo bindings listing");
    const all = store?.listBindings?.() ?? [];
    return { bindings: all.filter((row) => scope.allows(row.project)).map(publicBinding) };
  }

  function me(ctx) {
    const scope = requireScope(ctx?.scope, "identity report");
    const bound = new Map((store?.listBindings?.() ?? []).map((row) => [row.project, row]));
    return {
      login: ctx.identity?.login ?? null,
      role: ctx.role ?? null,
      tenant: ctx.tenant ?? null,
      idp: ctx.idp ?? null,
      scopes: scope.projects,
      defaultScope: scope.sessionProject,
      repos: scope.projects.map((project) => {
        const row = bound.get(project);
        // An external-tenant project with no binding has no repo at all —
        // reporting "default" would pretend the operator's repo serves it.
        const status = row?.status ?? "required";
        const repoUrl = row?.status === "active" ? sanitizeRepoUrl(row.repoUrl) : null;
        return { project, repoUrl, bound: row?.status === "active", status };
      }),
    };
  }

  return {
    bind, bindInternal, registerStart, registerRun, registrationStatus, registrationInput, failRegistration,
    unbind, unbindInternal, bindings, me, probeAccess,
  };
}
