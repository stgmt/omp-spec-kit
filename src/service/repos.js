import { cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { GitClient, commitMessage } from "./git.js";
import { repoHostAllowed } from "./mounts.js";
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
    repoUrl: row.repoUrl,
    branch: row.branch,
    status: row.status,
    boundBy: row.boundBy,
    boundAt: row.boundAt,
    migratedFrom: row.migratedFrom,
    lastError: row.lastError,
  };
}

/**
 * Repo bindings (TASK-17): a project may live in its own specs repository
 * instead of the shared default. Binding is server-side state — the client
 * (.mcp.json) never carries repo URLs or tokens. Migration copies the
 * project's .specs snapshot into the target repo as a service-bot commit;
 * git history is not transferred (pushing refs would leak every other
 * project's ancestors). Pre-migration published versions stay readable from
 * the previous clone, which is kept on disk.
 */
export function createRepoManager({ mounts, store, config, identity, secretsKey, logger = () => {} }) {
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

  async function copySpecsSnapshot(sourceMount, targetMount, projectId) {
    const sourceRoot = path.join(sourceMount.cwd, projectId);
    const targetRoot = path.join(targetMount.cwd, projectId);
    let specsRoot;
    try {
      specsRoot = path.join(sourceRoot, ".specs");
      if (!(await stat(specsRoot)).isDirectory()) return 0;
    } catch {
      return 0;
    }
    await mkdir(path.dirname(targetRoot), { recursive: true });
    // Never carry a write-lock across: a held lock in the snapshot would
    // wedge writes in the new repo until it expired.
    await cp(sourceRoot, targetRoot, {
      recursive: true,
      filter: (source) => !source.endsWith(".omp-spec-kit-write.lock"),
    });
    // The migrated-document count is the onboarding verify step's proof —
    // count the landed files, not the source listing.
    let documents = 0;
    const walk = async (dir) => {
      for (const entry of await readdir(path.join(targetRoot, ".specs", dir), { withFileTypes: true })) {
        if (entry.isDirectory()) await walk(path.join(dir, entry.name));
        else documents += 1;
      }
    };
    await walk(".");
    return documents;
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
    const host = repoHostAllowed(repoUrl, config.repoPolicy?.allowedHosts);
    if (!host.ok) throw new RepoError(400, "REPO_HOST_FORBIDDEN", host.reason);
    const resolvedBranch = typeof branch === "string" && branch.length > 0 ? branch : "main";
    if (typeof token !== "string" || token.length === 0) {
      throw new RepoError(400, "REPO_TOKEN_REQUIRED", "a git token for the repo is required (fine-grained PAT with contents read/write)");
    }
    if (!secretsKey) throw new RepoError(503, "SECRETS_UNAVAILABLE", "SPEC_REGISTRY_SECRETS_KEY is not set — credential bindings are disabled", { retryable: true });

    const auth = { token, username: typeof username === "string" && username ? username : undefined, url: repoUrl };
    const head = await probe(repoUrl, auth).catch((error) => {
      throw new RepoError(400, "REPO_PROBE_FAILED", `cannot read the repo with the supplied credential: ${String(error?.message ?? error).split("\n")[0]}`);
    });

    const current = store?.getBinding?.(project) ?? null;
    // Re-binding the same (repoUrl, branch) is a no-op: without this the copy
    // would write the SOURCE snapshot over the bound repo and silently revert
    // every post-migration write.
    if (current?.status === "active" && current.repoUrl === repoUrl && current.branch === resolvedBranch) {
      return { binding: publicBinding(current), head, unchanged: true };
    }
    const sourceMount = mounts.forSource(project);
    const migratedFrom = current?.status === "active" ? current.repoUrl : sourceMount.repoUrl;
    const migratedFromBranch = current?.status === "active" ? current.branch : sourceMount.branch;

    // Persist creds + mark migrating before touching remotes: a crash here
    // leaves a resumable row, not an invisible half-state. migratedFrom=null
    // means "came from the default repo" so reads keep resolving to it.
    await store?.putCredential?.(project, { repoUrl, tokenEnc: sealSecret(secretsKey, token), username: auth.username ?? null });
    const put = (status, lastError = null) => store?.putBinding?.({
      project, repoUrl, branch: resolvedBranch, status,
      boundBy, boundAt: new Date().toISOString(),
      migratedFrom: migratedFrom === repoUrl || migratedFrom === config.specsRepo ? null : migratedFrom,
      migratedFromBranch: migratedFrom === repoUrl || migratedFrom === config.specsRepo ? null : migratedFromBranch,
      lastError,
    });
    await put("migrating");

    const mount = mounts.byRepo(repoUrl, resolvedBranch, project);
    let migratedDocuments = 0;
    let migratedCommit = null;
    try {
      await mounts.ensureMount(mount);
      // migrate:false means "the target repo stands on its own" — a pre-seeded
      // .specs there wins and the source snapshot is never copied over it.
      if (migrate !== false) migratedDocuments = await copySpecsSnapshot(sourceMount, mount, project);
      if (migratedDocuments > 0) {
        await mount.git.add([project], { cwd: mount.cwd });
        await mount.git.commit({
          message: commitMessage({
            subject: `chore: migrate ${project} specs snapshot`,
            trailers: { "Spec-Author": boundBy ?? "service", "Spec-Migrated-From": migratedFrom },
          }),
          authorName: identity.name,
          authorEmail: identity.email,
          cwd: mount.cwd,
        });
        await mount.git.push({ refspec: `HEAD:refs/heads/${resolvedBranch}` }, { cwd: mount.cwd });
        migratedCommit = await mount.git.revParse("HEAD", { cwd: mount.cwd });
        // Verify the landed tree matches the source snapshot byte-for-byte.
        const sourceTree = await sourceMount.git.objectId("HEAD", `${project}/.specs`, { cwd: sourceMount.cwd }).catch(() => null);
        const targetTree = await mount.git.objectId("HEAD", `${project}/.specs`, { cwd: mount.cwd }).catch(() => null);
        if (sourceTree && targetTree && sourceTree !== targetTree) {
          throw new RepoError(502, "MIGRATION_TREE_MISMATCH", `copied tree ${targetTree.slice(0, 12)} differs from source ${sourceTree.slice(0, 12)}`);
        }
      }
      // Empty source, migrate:false, or a bare target: the project directory
      // must exist in the bound repo either way.
      await mounts.ensureSkeletonInMount(mount, project);
      await put("active");
    } catch (error) {
      await put("error", String(error?.message ?? error).slice(0, 500));
      if (error instanceof RepoError) throw error;
      throw new RepoError(502, "REPO_BIND_FAILED", `binding failed: ${String(error?.message ?? error).split("\n")[0]}`);
    }
    audit({ login: boundBy, role, project, op: "repo-bind", spec: null, result: `ok:${migratedDocuments > 0 ? "migrated" : "bound"}:${repoUrl}` });
    logger(`repo-bind ${project} -> ${repoUrl} (${migratedDocuments > 0 ? "migrated" : "bound"})`);
    return {
      binding: publicBinding(store.getBinding(project)),
      head,
      migrated: migratedCommit !== null ? { commit: migratedCommit, documents: migratedDocuments } : null,
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
        const external = mounts.isExternalProject?.(project) === true;
        const status = row?.status ?? (external ? "required" : "default");
        const repoUrl = row?.status === "active" ? row.repoUrl : external ? null : config.specsRepo;
        return { project, repoUrl, bound: row?.status === "active", status };
      }),
    };
  }

  return { bind, bindInternal, unbind, unbindInternal, bindings, me, probeAccess };
}
