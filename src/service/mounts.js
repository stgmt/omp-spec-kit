import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSpecService } from "../adapters/query-service.js";
import { recoverInterruptedTransactions } from "../authoring/transactions.js";
import { GitClient, botIdentityFromEnv } from "./git.js";
import { parseAuthConfig } from "./auth.js";
import { parseTenants } from "./tenants.js";
import { openSecret } from "./secrets.js";
import { projectIdError } from "./project-id.js";
import { ensureMirror, ensureWorktree } from "./spec-checkouts.js";
import { discoverSpecBindings, readSpecBinding, listSpecRefs } from "./spec-discovery.js";
import { validateSpecBinding, specBranchName } from "./spec-binding.js";

const LOCK_FILE = ".omp-spec-kit-write.lock";

export class ConfigError extends Error {}

/**
 * A repository URL must carry no credentials: tokens are stored sealed in the
 * service and passed to git out-of-band. Embedded userinfo would otherwise be
 * persisted, echoed by `/me`/`/status`, and written into committed metadata.
 */
export function repoUrlHasCredentials(repoUrl) {
  try {
    const parsed = new URL(repoUrl);
    return parsed.username !== "" || parsed.password !== "";
  } catch {
    return false;
  }
}

export function sanitizeRepoUrl(repoUrl) {
  if (typeof repoUrl !== "string") return repoUrl;
  try {
    const parsed = new URL(repoUrl);
    if (parsed.username === "" && parsed.password === "") return repoUrl;
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return repoUrl;
  }
}

/**
 * Which repo hosts a binding may point at (TASK-17): arbitrary clone URLs are
 * an SSRF surface, so https is required for public hosts, plain http/git is
 * tolerated only for private hosts (the compose spec-git fixture, on-prem
 * daemons), and a configured allowlist narrows it further. Empty/absent
 * allowlist = any https public host plus private hosts.
 */
export function repoHostAllowed(repoUrl, allowedHosts) {
  let parsed;
  try {
    parsed = new URL(repoUrl);
  } catch {
    return { ok: false, reason: `repo url is not a valid URL: ${repoUrl}` };
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, reason: "repo url must not contain credentials; pass the token separately" };
  }
  const host = parsed.hostname;
  const scheme = parsed.protocol.replace(/:$/, "");
  // file:// is a real on-prem binding target (shared-mount repos) but also a
  // local-read surface, so it is opt-in only: repoPolicy.allowedHosts must
  // carry the literal "file" entry.
  if (scheme === "file") {
    if (Array.isArray(allowedHosts) && allowedHosts.includes("file")) return { ok: true, host: "file" };
    return { ok: false, reason: 'file:// repo urls require repoPolicy.allowedHosts to include "file"' };
  }
  const isPrivateHost = host === "localhost" || host === "127.0.0.1" || !host.includes(".") || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith(".local") || host.endsWith(".internal");
  if (!["https", "http", "git"].includes(scheme)) {
    return { ok: false, reason: `repo url scheme must be https (http/git only for private hosts), got ${scheme}` };
  }
  if (scheme !== "https" && !isPrivateHost) {
    return { ok: false, reason: `repo url must use https for a public host: ${host}` };
  }
  if (Array.isArray(allowedHosts) && allowedHosts.length > 0 && !allowedHosts.includes(host) && !isPrivateHost) {
    return { ok: false, reason: `repo host is not in repoPolicy.allowedHosts: ${host}` };
  }
  return { ok: true, host };
}

export function parseProjectsConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ConfigError("projects config must be a JSON object");
  const { specsRepo, branch, projects, tenants, auth, repoPolicy, idpPolicy, publicUrl } = raw;
  if (specsRepo !== undefined || branch !== undefined) {
    const error = new ConfigError(
      "specsRepo/branch are retired in 3.0.0: specs live on spec-<slug> branches of each project repository; bind every project to its own repo (MIGRATION_REQUIRED)",
    );
    error.code = "MIGRATION_REQUIRED";
    throw error;
  }
  if (!Array.isArray(projects) || projects.length === 0) throw new ConfigError("projects must be a non-empty array");
  const ids = projects.map((entry) => {
    const id = entry && typeof entry === "object" ? entry.id : entry;
    validateProjectId(id);
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new ConfigError("project ids must be unique");
  const bindings = parseInitialBindings(raw.bindings, ids);
  const parsedTenants = parseTenants(tenants ?? []);
  for (const tenant of parsedTenants) {
    for (const project of tenant.projects) {
      if (!ids.includes(project)) throw new ConfigError(`tenant ${tenant.tenant} references an unconfigured project: ${project}`);
    }
  }
  const parsedAuth = parseAuthConfig(auth);
  const allowedHosts = repoPolicy?.allowedHosts;
  if (allowedHosts !== undefined && (!Array.isArray(allowedHosts) || allowedHosts.some((host) => typeof host !== "string" || host.length === 0))) {
    throw new ConfigError("repoPolicy.allowedHosts must be an array of host names");
  }
  const idpAllowedHosts = idpPolicy?.allowedHosts;
  if (idpAllowedHosts !== undefined && (!Array.isArray(idpAllowedHosts) || idpAllowedHosts.some((host) => typeof host !== "string" || host.length === 0))) {
    throw new ConfigError("idpPolicy.allowedHosts must be an array of host names");
  }
  // publicUrl is the externally reachable service base used in install
  // bundles — localhost is fine for the dev contour, a real URL for remote
  // YouTrack instances to call back.
  if (publicUrl !== undefined && (typeof publicUrl !== "string" || !/^https?:\/\//.test(publicUrl))) {
    throw new ConfigError("publicUrl must be an http(s) URL when set");
  }
  return {
    projects: ids, tenants: parsedTenants, auth: parsedAuth,
    bindings,
    repoPolicy: { allowedHosts: allowedHosts ?? [] },
    idpPolicy: { allowedHosts: idpAllowedHosts ?? [] },
    publicUrl: publicUrl ?? null,
  };
}

export async function loadProjectsConfig(configPath) {
  let raw;
  try {
    raw = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new ConfigError(`projects config is unreadable at ${configPath}: ${error.message}`);
  }
  return parseProjectsConfig(raw);
}

export function validateProjectId(id) {
  const error = projectIdError(id);
  if (error !== null) throw new ConfigError(error);
  return id;
}

function parseInitialBindings(bindings, ids) {
  if (bindings === undefined) return [];
  if (!Array.isArray(bindings)) throw new ConfigError("bindings must be an array when set");
  const seen = new Set();
  return bindings.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new ConfigError("each binding must be an object");
    const project = entry.project;
    if (typeof project !== "string" || !ids.includes(project)) throw new ConfigError(`binding references an unconfigured project: ${JSON.stringify(project)}`);
    if (seen.has(project)) throw new ConfigError(`duplicate binding for project: ${project}`);
    seen.add(project);
    if (typeof entry.repoUrl !== "string" || entry.repoUrl.length === 0) throw new ConfigError(`binding for ${project} needs repoUrl`);
    if (repoUrlHasCredentials(entry.repoUrl)) throw new ConfigError(`binding for ${project} must not embed credentials in repoUrl`);
    if (entry.tokenEnv !== undefined && entry.tokenEnv !== null && (typeof entry.tokenEnv !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(entry.tokenEnv))) {
      throw new ConfigError(`binding for ${project} has an invalid tokenEnv`);
    }
    if (entry.username !== undefined && entry.username !== null && typeof entry.username !== "string") {
      throw new ConfigError(`binding for ${project} has an invalid username`);
    }
    return { project, repoUrl: entry.repoUrl, tokenEnv: entry.tokenEnv ?? null, username: entry.username ?? null };
  });
}

function mountKey(repoUrl, branch) {
  return createHash("sha256").update(`${repoUrl}|${branch ?? ""}`, "utf8").digest("hex").slice(0, 12);
}

/** True when the materialised corpus directory is still on disk. */
async function corpusPresent(root) {
  try {
    return (await stat(path.join(root, ".specs"))).isDirectory();
  } catch {
    return false;
  }
}

/**
 * One git mount per (repoUrl, branch): the default mount is the configured
 * Specs repos are cloned under clones/<key>; no repository is implicit.
 * with their own credentialled GitClient. Everything that used to read
 * `mounts.cloneDir`/`git` now resolves per project through `for(project)`.
 */
export class MountManager {
  constructor({ config, cloneDir, git = new GitClient(), gitFactory = null, identity = botIdentityFromEnv(), store = null, secretsKey = null, extraProjects = () => [], logger = () => {} }) {
    this.config = config;
    this.cloneDir = path.resolve(cloneDir);
    this.clonesRoot = path.join(path.dirname(this.cloneDir), "clones");
    this.git = git;
    this.gitFactory = gitFactory ?? (({ gitAuth } = {}) => new GitClient({ gitAuth }));
    this.identity = identity;
    this.store = store;
    this.secretsKey = secretsKey;
    this.extraProjects = extraProjects;
    this.logger = logger;
    this.services = new Map();
    this.mounts = new Map();
    this.projectRoots = new Map();
    this.projectLocks = new Map();
    this.writeLocks = new Map();
  }

  /** Every project the service knows: operator-configured plus IdP-claimed. */
  get projects() {
    return this.configuredProjects();
  }

  configuredProjects() {
    return [...new Set([...this.config.projects, ...this.extraProjects()])];
  }

  /**
   * Projects claimed through self-service registration. They are configured by
   * that act alone — no operator config edit — but they are NOT in anyone's
   * scope except the login that registered them.
   */
  registeredProjects() {
    return (this.store?.listRegistrations?.() ?? []).map((row) => row.project);
  }

  /** The projects a login registered itself: the only set it may widen its own scope with. */
  registeredProjectsBy(login) {
    if (typeof login !== "string" || login.length === 0) return [];
    return (this.store?.listRegistrations?.({ registeredBy: login }) ?? []).map((row) => row.project);
  }

  /**
   * A project registered only through an external-IdP binding. Its specs are
   * customer data: they must live in the customer's own repo, so an unbound
   * external project has NO mount — never a silent slice of the operator's
   * shared repository.
   */
  isExternalProject(projectId) {
    return !this.config.projects.includes(projectId) && this.extraProjects().includes(projectId);
  }

  bindingRequired(projectId) {
    const error = new Error(`project ${projectId} has no specs repository — call spec_repo {"action":"bind","project":"${projectId}","repoUrl":"<git-url>","token":"<fine-grained-pat-with-contents-rw>"} before reading or writing specs`);
    error.code = "REPO_BINDING_REQUIRED";
    return error;
  }

  /** Gate for callers that only need to know whether specs are reachable. */
  requireRepoReady(projectId) {
    const row = this.store?.getBinding?.(projectId) ?? null;
    if (row && (row.status === "active" || (row.status === "migrating" && row.migratedFrom))) return projectId;
    throw this.bindingRequired(projectId);
  }

  registerMount(descriptor) {
    this.mounts.set(descriptor.key, descriptor);
    return descriptor;
  }

  /** The active binding for a project, or null when none is active. */
  bindingFor(projectId) {
    const row = this.store?.getBinding?.(projectId) ?? null;
    if (!row || row.status !== "active") return null;
    return row;
  }

  /**
   * Credential for a project's bound repo, decrypted from the store — but only
   * for the repo it was bound to: during a migration a project touches both
   * clones, and handing the target's token to the source remote would leak the
   * credential across repos (and fail auth when they differ).
   */
  authFor(projectId, repoUrl) {
    const row = this.store?.getCredential?.(projectId);
    if (!row?.tokenEnc) return undefined;
    if (sanitizeRepoUrl(row.repoUrl) !== sanitizeRepoUrl(repoUrl)) return undefined;
    if (!this.secretsKey) throw new ConfigError(`credentials for ${projectId} exist but SPEC_REGISTRY_SECRETS_KEY is not set`);
    const token = openSecret(this.secretsKey, row.tokenEnc);
    return { token, username: row.username ?? undefined, url: repoUrl };
  }

  /**
   * Mount serving a project right now. An active binding wins; a mid-migration
   * project still reads/writes its SOURCE repo (migratedFrom, or the default
   * when null) until the copy lands and the binding flips — never a split
   * view across two repos.
   */
  for(projectId) {
    const row = this.store?.getBinding?.(projectId) ?? null;
    if (!row) throw this.bindingRequired(projectId);
    if (row.status === "active") return this.repoDescriptor(row.repoUrl, projectId);
    if (row.status === "migrating") {
      if (!row.migratedFrom) throw this.bindingRequired(projectId);
      return this.repoDescriptor(row.migratedFrom, projectId);
    }
    throw this.bindingRequired(projectId);
  }

  /**
   * Where a project's content lives BEFORE a binding exists — the migration
   * source. Unlike `for`, this never refuses an unbound external project:
   * binding that project to its own repo is precisely the allowed operation.
   * An `error` row resolves the same way — the migration never landed, so the
   * retry must still find the source instead of wedging on REPO_BINDING_REQUIRED.
   */
  forSource(projectId) {
    const row = this.store?.getBinding?.(projectId) ?? null;
    if (!row) return null;
    if (row.status === "active") return this.repoDescriptor(row.repoUrl, projectId);
    return row.migratedFrom ? this.repoDescriptor(row.migratedFrom, projectId) : null;
  }

  /** One bare mirror per repository credential; every spec branch shares its objects. */
  descriptorFor(repoUrl, auth) {
    const cleanRepoUrl = sanitizeRepoUrl(repoUrl);
    const authKey = auth
      ? createHash("sha256").update(`${auth.username ?? ""}\0${auth.token}`, "utf8").digest("hex").slice(0, 12)
      : "anon";
    const key = mountKey(cleanRepoUrl, authKey);
    let mount = this.mounts.get(key);
    if (!mount) {
      const dir = path.join(this.clonesRoot, key);
      mount = this.registerMount({
        key,
        repoUrl: cleanRepoUrl,
        cwd: dir,
        mirrorDir: path.join(dir, "mirror.git"),
        git: this.gitFactory({ gitAuth: auth }),
      });
    }
    return mount;
  }

  repoDescriptor(repoUrl, forProject = null) {
    const cleanRepoUrl = sanitizeRepoUrl(repoUrl);
    const auth = forProject ? this.authFor(forProject, cleanRepoUrl) : undefined;
    return this.descriptorFor(cleanRepoUrl, auth);
  }

  /** The mirror behind a project's active binding (writes require active). */
  async repoFor(projectId) {
    const row = this.store?.getBinding?.(projectId) ?? null;
    if (!row || row.status !== "active") throw this.bindingRequired(projectId);
    return this.repoDescriptor(row.repoUrl, projectId);
  }

  /**
   * The mirror a READ should use. During a rebind the previous repository stays
   * readable until the new binding is active; writes still go through
   * `repoFor`, which requires active.
   */
  readableRepo(projectId) {
    const row = this.store?.getBinding?.(projectId) ?? null;
    if (!row) throw this.bindingRequired(projectId);
    if (row.status === "active") return this.repoDescriptor(row.repoUrl, projectId);
    if (row.status === "migrating" && row.migratedFrom) {
      return this.repoDescriptor(row.migratedFrom, projectId);
    }
    throw this.bindingRequired(projectId);
  }

  async ensureDescriptor(mount, { fetch = true, strict = false } = {}) {
    let present = false;
    try { present = (await stat(path.join(mount.mirrorDir, "HEAD"))).isFile(); } catch {}
    if (fetch || !present) {
      try {
        await ensureMirror({ git: mount.git, repoUrl: mount.repoUrl, mirrorDir: mount.mirrorDir, cwd: mount.cwd });
      } catch (error) {
        // A temporarily unreachable remote must not block reads from the last
        // fetched state; destructive callers pass `strict` and fail closed.
        if (!present || strict) throw error;
        this.logger(`fetch skipped for ${mount.repoUrl}: ${String(error?.message ?? error).split("\n")[0]}`);
      }
    }
    return mount;
  }

  async ensureRepo(projectId, { fetch = true, strict = false } = {}) {
    return this.ensureDescriptor(await this.repoFor(projectId), { fetch, strict });
  }

  async ensureReadableRepo(projectId, { fetch = true } = {}) {
    return this.ensureDescriptor(this.readableRepo(projectId), { fetch });
  }

  /**
   * Canonical spec branches of a project, read from `.spec-kit.json`. Invalid
   * branches are returned, never silently dropped.
   */
  async discoverProject(projectId, { fetch = true } = {}) {
    const mount = await this.ensureReadableRepo(projectId, { fetch });
    const { bindings, invalid } = await discoverSpecBindings({ git: mount.git, cwd: mount.mirrorDir, repoUrl: mount.repoUrl });
    return { mount, bindings: bindings.filter((binding) => binding.project === projectId), invalid };
  }

  /** A checkout of one spec branch; the only place a spec document lives. */
  async worktreeFor(projectId, spec, { fetch = true } = {}) {
    const mount = await this.ensureRepo(projectId, { fetch });
    const branch = specBranchName(spec);
    const ref = `refs/remotes/origin/${branch}`;
    const head = await mount.git.revParse(ref, { cwd: mount.mirrorDir }).catch(() => null);
    if (!head) {
      const error = new Error(`spec ${projectId}/${spec} has no ${branch} branch`);
      error.code = "SPEC_BRANCH_MISSING";
      throw error;
    }
    const raw = await readSpecBinding({ git: mount.git, cwd: mount.mirrorDir, branch: ref });
    const valid = validateSpecBinding(raw, { branch, repoUrl: mount.repoUrl });
    if (!valid.ok || raw.project !== projectId || raw.spec !== spec) {
      const error = new Error(`branch ${branch} is not a valid binding for ${projectId}/${spec}: ${valid.errors.join("; ") || "metadata disagrees"}`);
      error.code = "SPEC_BINDING_INVALID";
      throw error;
    }
    const worktreeDir = path.join(mount.cwd, "worktrees", branch);
    const localBranch = `work/${branch}`;
    await ensureWorktree({ git: mount.git, mirrorDir: mount.mirrorDir, worktreeDir, branch: localBranch, startPoint: ref, cwd: mount.cwd });
    return { ...mount, key: `${mount.key}:${branch}`, branch, ref, localBranch, cwd: worktreeDir, project: projectId, spec };
  }

  /**
   * Read root for a project: real copies of every canonical spec branch's
   * `.specs/<slug>` tree. The kernel rejects symlinked corpora, and a project
   * spans several branches, so the cache is materialised instead of linked.
   */
  cacheRootFor(projectId, mount) {
    return path.join(mount.cwd, "projects", projectId.split("/").join("__"));
  }

  /** Signature of the last materialised corpus, or null when never built. */
  projectSignature(projectId) {
    return this.projectRoots.get(projectId)?.signature ?? null;
  }

  async projectRoot(projectId, { fetch = true } = {}) {
    const { mount, bindings, invalid } = await this.discoverProject(projectId, { fetch });
    const ownInvalid = invalid.filter((entry) => entry.project === projectId);
    if (ownInvalid.length > 0) {
      const error = new Error(`invalid spec binding in ${projectId}: ${ownInvalid.map((entry) => `${entry.branch}: ${entry.errors.join(", ")}`).join("; ")}`);
      error.code = "SPEC_BINDING_INVALID";
      throw error;
    }
    const heads = [];
    for (const binding of bindings) {
      const sha = await mount.git.revParse(binding.ref, { cwd: mount.mirrorDir }).catch(() => null);
      heads.push(`${binding.branch}@${sha ?? "missing"}`);
    }
    const signature = heads.sort().join("\n");
    const cached = this.projectRoots.get(projectId);
    const root = this.cacheRootFor(projectId, mount);
    // The cache speaks for a corpus that must still exist: a root removed under
    // the service (an unbind, a cleanup, a lost volume) cannot be trusted just
    // because the signature still matches, or every read fails until the
    // process restarts.
    if (cached?.signature === signature && cached.repoUrl === mount.repoUrl && await corpusPresent(root)) {
      return root;
    }

    const previous = this.projectLocks.get(projectId) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => gate);
    this.projectLocks.set(projectId, tail);
    await previous;
    try {
      const recheck = this.projectRoots.get(projectId);
      if (recheck?.signature === signature && recheck.repoUrl === mount.repoUrl && await corpusPresent(root)) return root;
      await mkdir(path.join(root, ".specs"), { recursive: true });
      // Drop only the materialised corpus: the directory is ours, but never
      // delete anything outside it.
      await rm(path.join(root, ".specs"), { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
      await mkdir(path.join(root, ".specs"), { recursive: true });
      for (const binding of bindings) {
        const ref = binding.ref;
        const prefix = `.specs/${binding.spec}/`;
        const { stdout } = await mount.git.run(["ls-tree", "-r", "--name-only", ref], { cwd: mount.mirrorDir });
        for (const filePath of stdout.split(/\r?\n/u)) {
          if (!filePath.startsWith(prefix)) continue;
          const parts = filePath.split("/");
          if (parts.some((part) => part === "" || part === "." || part === "..")) continue;
          const destination = path.resolve(root, ...parts);
          if (!destination.startsWith(`${path.resolve(root)}${path.sep}`)) continue;
          const content = await mount.git.showBytes(ref, filePath, { cwd: mount.mirrorDir });
          await mkdir(path.dirname(destination), { recursive: true });
          await writeFile(destination, content);
        }
      }
      this.projectRoots.set(projectId, { signature, repoUrl: mount.repoUrl, root });
      this.services.delete(`${mount.repoUrl}:${projectId}`);
      return root;
    } finally {
      release();
      if (this.projectLocks.get(projectId) === tail) this.projectLocks.delete(projectId);
    }
  }

  /** Every distinct repository mirror a configured project resolves through. */
  activeMounts() {
    const seen = new Map();
    for (const projectId of this.projects) {
      let mount;
      try {
        mount = this.for(projectId);
      } catch {
        continue; // unbound external project: no mount exists to reconcile
      }
      seen.set(mount.key, mount);
    }
    return [...seen.values()];
  }

  /** True while a migration is in flight — writes must refuse, reads use source. */
  migrating(projectId) {
    return (this.store?.getBinding?.(projectId)?.status ?? null) === "migrating";
  }

  async ensureMount(mount) {
    return ensureMirror({ git: mount.git, repoUrl: mount.repoUrl, mirrorDir: mount.mirrorDir, cwd: mount.cwd });
  }

  /** Canonical and work branches of one project, with their current tips. */
  async listBranches(projectId) {
    const { mount, bindings, invalid } = await this.discoverProject(projectId);
    const refs = await listSpecRefs({ git: mount.git, cwd: mount.mirrorDir });
    const bySlug = new Map(bindings.map((binding) => [binding.spec, binding]));
    const branches = [];
    for (const binding of bindings) {
      const head = await mount.git.revParse(binding.ref, { cwd: mount.mirrorDir }).catch(() => null);
      branches.push({ kind: "spec", branch: binding.branch, ref: binding.ref, spec: binding.spec, topic: null, project: projectId, head });
    }
    for (const { ref, branch, parsed } of refs) {
      if (parsed.kind !== "work" || !bySlug.has(parsed.slug)) continue;
      const head = await mount.git.revParse(ref, { cwd: mount.mirrorDir }).catch(() => null);
      branches.push({ kind: "work", branch, ref, spec: parsed.slug, topic: parsed.topic, project: projectId, head });
    }
    branches.sort((left, right) => left.branch.localeCompare(right.branch));
    return { mount, branches, invalid: invalid.filter((entry) => entry.project === projectId) };
  }

  /**
   * Cheap guard for the read path: a corpus that should exist and does not is
   * rebuilt before the service touches it. One stat when everything is in
   * place, so a lost root (a removed volume, a project registered by the
   * caller that boot never materialised) heals on the first read instead of
   * answering ADAPTER_READ_ERROR until the next restart.
   *
   * Repair is best effort: a corpus that cannot be materialised right now (an
   * invalid binding in the repository, an unreachable mirror) must not turn a
   * read that could still be served into a different failure — the read
   * reports its own problem, and the reason repair was skipped goes to the log.
   */
  async ensureProjectCorpus(projectId) {
    const mount = this.readableRepo(projectId);
    if (await corpusPresent(this.cacheRootFor(projectId, mount))) return projectId;
    try {
      await this.projectRoot(projectId);
    } catch (error) {
      this.logger(`corpus repair skipped for ${projectId}: ${String(error?.message ?? error).split("\n")[0]}`);
    }
    return projectId;
  }

  /** Stable identity of a project's corpus: every canonical spec branch tip. */
  async projectHead(projectId) {
    const { mount, bindings } = await this.discoverProject(projectId);
    const heads = [];
    for (const binding of bindings) {
      const sha = await mount.git.revParse(binding.ref, { cwd: mount.mirrorDir }).catch(() => null);
      heads.push(`${binding.branch}:${sha ?? "missing"}`);
    }
    return heads.sort().join(",");
  }

  /** Serialize writes per project so a cache rebuild never races an apply. */
  async acquireWriteLock(projectId) {
    const previous = this.writeLocks.get(projectId) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => gate);
    this.writeLocks.set(projectId, tail);
    await previous;
    return () => {
      release();
      if (this.writeLocks.get(projectId) === tail) this.writeLocks.delete(projectId);
    };
  }

  /**
   * Forget everything cached for a project. Called when its binding goes away:
   * a later registration of the same project must materialise a fresh corpus
   * instead of reusing a root that may belong to a removed repository.
   */
  forgetProject(projectId) {
    this.projectRoots.delete(projectId);
    for (const key of [...this.services.keys()]) {
      if (key.endsWith(`:${projectId}`)) this.services.delete(key);
    }
  }

  /** Drop the materialised corpus after a write so the next read re-reads git. */
  async refreshProject(projectId) {
    this.projectRoots.delete(projectId);
    try { await this.projectRoot(projectId); } catch {}
    try { this.serviceFor(projectId).refresh(); } catch {}
  }

  async resolveProjectRoot(projectId) {
    validateProjectId(projectId);
    return this.projectRoot(projectId);
  }

  requireConfigured(projectId) {
    // IdP-bound tenant projects are configured through their binding — the
    // customer's YouTrack registers its own projects, no config edit needed.
    if (!this.config.projects.includes(projectId) && !this.extraProjects().includes(projectId)) {
      const error = new Error(`project is not configured on this service: ${projectId}`);
      error.code = "PROJECT_NOT_CONFIGURED";
      throw error;
    }
    return projectId;
  }

  async boot() {
    // Boot reconciliation (FR-5/FR-16): fetch every bound mirror so spec
    // branches created out of band are visible before the first read.
    for (const mount of this.activeMounts()) {
      // Bound repos are user-owned: a deleted or unreachable one must not
      // keep the whole service from booting — drift reports the failure.
      try {
        await this.ensureMount(mount);
      } catch (error) {
        this.logger(`boot fetch skipped for ${mount.repoUrl}: ${String(error?.message ?? error).split("\n")[0]}`);
      }
    }
    const report = {};
    for (const projectId of this.configuredProjects()) {
      try {
        const root = await this.projectRoot(projectId);
        await recoverInterruptedTransactions(root, path.join(root, ".specs", LOCK_FILE), null);
        const service = this.serviceFor(projectId);
        const state = await service.ensure();
        report[projectId] = { root, graphStatus: state.status };
        this.logger(`mount ${projectId} -> ${state.status}`);
      } catch (error) {
        report[projectId] = { error: error?.code ?? "REPO_BINDING_REQUIRED" };
        this.logger(`mount ${projectId} unbound: ${String(error?.message ?? error).split("\n")[0]}`);
      }
    }
    return report;
  }

  serviceFor(projectId) {
    this.requireConfigured(projectId);
    const mount = this.readableRepo(projectId);
    // The cache is one root per repo+project: a migrated/bound project must
    // get a service rooted at the new repo, not the stale pre-binding one.
    const key = `${mount.repoUrl}:${projectId}`;
    let service = this.services.get(key);
    if (!service) {
      service = createSpecService(this.cacheRootFor(projectId, mount));
      this.services.set(key, service);
    }
    return service;
  }
}
