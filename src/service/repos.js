import { mkdir } from "node:fs/promises";
import path from "node:path";
import { GitClient } from "./git.js";
import { isValidBranchName } from "./branch-policy.js";
import { repoHostAllowed, sanitizeRepoUrl } from "./mounts.js";
import { sealSecret } from "./secrets.js";

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
   * The bind body without the caller-scope gate. Used by the public path
   * (which asserts scopes first) and by the IdP binder attaching a specs repo
   * to a freshly bound tenant — the IdP-bind act itself is the authority.
   */
  async function bindInternal({ project, repoUrl, branch, token, username, migrate = true, boundBy = null, role = null }) {
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

    // Persist creds + mark migrating before touching remotes: a crash here
    // leaves a resumable row, not an invisible half-state. migratedFrom=null
    // means the project had no previous repo (a first bind), not a default.
    await store?.putCredential?.(project, { repoUrl: cleanRepoUrl, tokenEnc: sealSecret(secretsKey, token), username: auth.username ?? null });
    const put = (status, lastError = null) => store?.putBinding?.({
      project, repoUrl: cleanRepoUrl, branch: resolvedBranch, status,
      boundBy, boundAt: new Date().toISOString(),
      migratedFrom: migratedFrom === cleanRepoUrl ? null : migratedFrom,
      migratedFromBranch: migratedFrom === cleanRepoUrl ? null : migratedFromBranch,
      lastError,
    });
    await put("migrating");

    const mount = mounts.repoDescriptor(cleanRepoUrl, resolvedBranch, project);
    try {
      await mounts.ensureMount(mount);
      await put("active");
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
    audit({ login: ctx.identity?.login ?? null, role: ctx.role ?? null, project, op: "repo-unbind", spec: null, result: `ok:${row.repoUrl}` });
    logger(`repo-unbind ${project} (was ${row.repoUrl})`);
    return { unbound: project, previous: row.repoUrl };
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
    // The unbound project's specs leave the corpus — the tracker should drop
    // their cards on the next projection, not whenever something else fires.
    afterRepoChange?.();
    return row.repoUrl;
  }

  function bindings(ctx) {
    const all = store?.listBindings?.() ?? [];
    return { bindings: all.filter((row) => ctx.scopes.includes(row.project)).map(publicBinding) };
  }

  function me(ctx) {
    const bound = new Map((store?.listBindings?.() ?? []).map((row) => [row.project, row]));
    return {
      login: ctx.identity?.login ?? null,
      role: ctx.role ?? null,
      tenant: ctx.tenant ?? null,
      idp: ctx.idp ?? null,
      scopes: ctx.scopes ?? [],
      defaultScope: ctx.defaultScope ?? null,
      repos: (ctx.scopes ?? []).map((project) => {
        const row = bound.get(project);
        // An external-tenant project with no binding has no repo at all —
        // reporting "default" would pretend the operator's repo serves it.
        const status = row?.status ?? "required";
        const repoUrl = row?.status === "active" ? row.repoUrl : null;
        return { project, repoUrl, bound: row?.status === "active", status };
      }),
    };
  }

  return { bind, bindInternal, unbind, unbindInternal, bindings, me, probeAccess };
}
