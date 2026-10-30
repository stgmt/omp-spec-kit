import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSpecService } from "../adapters/query-service.js";
import { recoverInterruptedTransactions } from "../authoring/transactions.js";
import { GitClient, GitError, botIdentityFromEnv, commitMessage } from "./git.js";
import { parseAuthConfig } from "./auth.js";
import { parseTenants } from "./tenants.js";
import { reconcileClone } from "./sync.js";
import { openSecret } from "./secrets.js";
import { projectIdError } from "./project-id.js";

const LOCK_FILE = ".omp-spec-kit-write.lock";

export class ConfigError extends Error {}

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
  }

  /** Every project the service knows: operator-configured plus IdP-claimed. */
  get projects() {
    return this.configuredProjects();
  }

  configuredProjects() {
    return [...new Set([...this.config.projects, ...this.extraProjects()])];
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
    const error = new Error(`project ${projectId} has no specs repository — bind one via POST /repos/bind before reading or writing specs`);
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
    if (row.repoUrl !== repoUrl) return undefined;
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
    if (row.status === "active") return this.byRepo(row.repoUrl, row.branch, projectId);
    if (row.status === "migrating") {
      if (!row.migratedFrom) throw this.bindingRequired(projectId);
      return this.byRepo(row.migratedFrom, row.migratedFromBranch ?? row.branch, projectId);
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
    if (row.status === "active") return this.byRepo(row.repoUrl, row.branch, projectId);
    return row.migratedFrom ? this.byRepo(row.migratedFrom, row.migratedFromBranch ?? row.branch, projectId) : null;
  }

  /**
   * Mount for an explicit (repoUrl, branch) — registers the descriptor lazily;
   * ensureMount must run before git operations need the clone on disk.
   * `forProject` supplies the credential owner for auth.
   */
  byRepo(repoUrl, branch = "main", forProject = null) {
    const key = mountKey(repoUrl, branch);
    let mount = this.mounts.get(key);
    if (!mount) {
      mount = this.registerMount({
        key,
        repoUrl,
        branch,
        cwd: path.join(this.clonesRoot, key),
        git: this.gitFactory({ gitAuth: forProject ? this.authFor(forProject, repoUrl) : undefined }),
      });
    }
    return mount;
  }

  /** All mounts a project currently resolves through (active binding or default). */
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
    const gitDir = path.join(mount.cwd, ".git");
    let exists = false;
    try {
      exists = (await stat(gitDir)).isDirectory();
    } catch {}
    if (exists) return false;
    await mkdir(path.dirname(mount.cwd), { recursive: true });
    try {
      await mount.git.clone(mount.repoUrl, mount.cwd, { branch: mount.branch });
    } catch (error) {
      // A freshly provisioned specs repo has an unborn HEAD: plain clone
      // inherits the remote's initial branch, which is the configured one.
      if (!(error instanceof GitError) || !/Remote branch .* not found/u.test(error.stderr ?? "")) throw error;
      await mount.git.clone(mount.repoUrl, mount.cwd);
    }
    this.logger(`cloned ${mount.repoUrl} -> ${mount.cwd}`);
    return true;
  }

  resolveProjectRoot(projectId) {
    validateProjectId(projectId);
    const mount = this.for(projectId);
    const [owner, project] = projectId.split("/");
    const root = path.resolve(mount.cwd, owner, project);
    if (root !== mount.cwd && !root.startsWith(mount.cwd + path.sep)) {
      throw new ConfigError(`project root escapes the specs clone: ${projectId}`);
    }
    return root;
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
    // Boot reconciliation (FR-5/FR-16): a clone left ahead of the remote — a
    // skeleton push that lost a race, an out-of-band operator push — must be
    // replayed before any new skeleton push, or every write stays rejected.
    for (const mount of this.activeMounts()) {
      // Bound repos are user-owned: a deleted or unreachable one must not
      // keep the whole service from booting — drift reports the failure.
      try {
        await this.ensureMount(mount);
        await reconcileClone({ git: mount.git, cwd: mount.cwd, branch: mount.branch, identity: this.identity, logger: this.logger });
      } catch (error) {
        this.logger(`boot reconcile skipped for ${mount.repoUrl}: ${String(error?.message ?? error).split("\n")[0]}`);
      }
    }
    const report = {};
    for (const projectId of this.config.projects) {
      try {
        const root = this.resolveProjectRoot(projectId);
        await this.ensureProjectSkeleton(projectId);
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

  async ensureProjectSkeleton(projectId) {
    return this.ensureSkeletonInMount(this.for(projectId), projectId);
  }

  /** Skeleton in an explicit mount — used by bind before the binding flips. */
  async ensureSkeletonInMount(mount, projectId) {
    const [owner, project] = projectId.split("/");
    const root = path.resolve(mount.cwd, owner, project);
    const specsDir = path.join(root, ".specs");
    try {
      if ((await stat(specsDir)).isDirectory()) return false;
    } catch {}
    await mkdir(specsDir, { recursive: true });
    await writeFile(path.join(specsDir, ".gitkeep"), "");
    const relative = path.relative(mount.cwd, path.join(specsDir, ".gitkeep")).split(path.sep).join("/");
    await mount.git.add([relative], { cwd: mount.cwd });
    await mount.git.commit({
      message: commitMessage({ subject: `chore: init scope ${projectId}` }),
      authorName: this.identity.name,
      authorEmail: this.identity.email,
      cwd: mount.cwd,
    });
    await mount.git.push({ refspec: `HEAD:refs/heads/${mount.branch}` }, { cwd: mount.cwd });
    this.logger(`created skeleton for ${projectId}`);
    return true;
  }

  serviceFor(projectId) {
    this.requireConfigured(projectId);
    // The cache key carries the mount: a migrated/bound project must get a
    // service rooted at the new clone, not the stale pre-binding one.
    const mount = this.for(projectId);
    const key = `${mount.key}:${projectId}`;
    let service = this.services.get(key);
    if (!service) {
      service = createSpecService(this.resolveProjectRoot(projectId));
      this.services.set(key, service);
    }
    return service;
  }
}
