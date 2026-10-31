import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { serviceErrorEnvelope, serviceSuccess } from "./dispatch.js";
import { commitMessage } from "./git.js";
import { listSpecRefs, readSpecBinding } from "./spec-discovery.js";
import { specBranchName, specWorkBranchName, validateSpecBinding } from "./spec-binding.js";
import { publishTagName } from "./publish.js";
import { isValidSpecSlug } from "../kernel/identity.js";

const SPEC_BINDING_FILE = ".spec-kit.json";

function failure(requestId, code, message, extra = {}) {
  return serviceErrorEnvelope("specBranch", requestId, code, message, extra);
}

function parseArgs(args) {
  const action = args?.action;
  if (action !== "create" && action !== "merge" && action !== "delete" && action !== "deleteSpec") {
    return { error: ["action must be create, merge, delete, or deleteSpec", { parameter: "action" }] };
  }
  if (typeof args.spec !== "string" || args.spec.length === 0) {
    return { error: ["spec is required", { parameter: "spec" }] };
  }
  if (!isValidSpecSlug(args.spec)) {
    return { error: ["spec must be a valid slug", { parameter: "spec" }] };
  }
  if (args.topic !== undefined && (typeof args.topic !== "string" || args.topic.length === 0)) {
    return { error: ["topic must be a non-empty string", { parameter: "topic" }] };
  }
  if (args.topic !== undefined && !isValidSpecSlug(args.topic)) {
    return { error: ["topic must be a valid slug", { parameter: "topic" }] };
  }
  return { action, spec: args.spec, topic: args.topic ?? null };
}

async function tempRepo() {
  return mkdtemp(path.join(tmpdir(), "spec-branch-"));
}

async function cleanup(dir) {
  await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}

/**
 * `spec_branch` (P3): canonical specs are orphan `spec-<slug>` branches;
 * `spec-<slug>--<topic>` holds unmerged work and is merged directly by the
 * service under the project write lock. Deleting a canonical branch is never
 * allowed — archive is a separate, audited operation.
 */
export function createSpecBranchManager({ mounts, claims = null, identity, logger = () => {}, audit = () => {}, publish = null, projection = null, store = null }) {
  async function branchExists(mount, branch) {
    return (await mount.git.revParse(`refs/remotes/origin/${branch}`, { cwd: mount.mirrorDir }).catch(() => null)) !== null;
  }

  /**
   * A branch is only addressable through the project named in its own
   * `.spec-kit.json`. One repository may host several projects, so the
   * `<owner>/<project>` request scope alone is not enough: a writer of project
   * A must not delete project B's branch in the same mirror.
   */
  async function ownedBinding({ mount, project, spec, ref }) {
    try {
      const raw = await readSpecBinding({ git: mount.git, cwd: mount.mirrorDir, branch: ref });
      const valid = validateSpecBinding(raw, { branch: specBranchName(spec), repoUrl: mount.repoUrl });
      if (!valid.ok || raw.project !== project || raw.spec !== spec) {
        return { error: `branch ${ref} does not belong to ${project}/${spec}: ${valid.errors.join("; ") || "metadata disagrees"}` };
      }
      return { binding: raw };
    } catch (error) {
      return { error: String(error?.message ?? error).split("\n")[0] };
    }
  }

  async function createCanonical({ project, spec, requestId, login, skeleton = true, role = null }) {
    const mount = await mounts.ensureRepo(project);
    const branch = specBranchName(spec);
    // A branch with this name means the slug is taken repository-wide, even
    // when its metadata belongs to another project or is invalid. Never try
    // to overwrite it with a non-fast-forward push.
    if (await branchExists(mount, branch)) {
      return failure(requestId, "SPEC_EXISTS", `spec ${spec} already exists in ${project}`);
    }
    const { branches } = await mounts.listBranches(project);
    if (branches.some((entry) => entry.spec === spec)) {
      return failure(requestId, "SPEC_EXISTS", `spec ${spec} already exists in ${project}`);
    }
    const dir = await tempRepo();
    try {
      await mount.git.run(["init", "-q"], { cwd: dir });
      const metadata = {
        schema: "omp-spec-kit/spec-binding@1",
        project,
        spec,
        repo: mount.repoUrl,
        branch,
        createdAt: new Date().toISOString(),
        owner: project.split("/")[0],
      };
      await writeFile(path.join(dir, SPEC_BINDING_FILE), `${JSON.stringify(metadata, null, 2)}\n`);
      if (skeleton) {
        const specDir = path.join(dir, ".specs", spec);
        await mkdir(specDir, { recursive: true });
        await writeFile(path.join(specDir, "README.md"), `# ${spec}\n\nStatus: DRAFT\n`);
      }
      await mount.git.run(["-C", dir, "add", "-A"], { cwd: mount.cwd });
      await mount.git.run([
        "-C", dir,
        "-c", `user.name=${identity.name}`,
        "-c", `user.email=${identity.email}`,
        "commit", "-qm", `chore: create ${branch}`,
      ], { cwd: mount.cwd });
      await mount.git.run(["-C", dir, "push", "-q", mount.repoUrl, `HEAD:refs/heads/${branch}`], { cwd: mount.cwd });
      const commit = await mount.git.run(["-C", dir, "rev-parse", "HEAD"], { cwd: mount.cwd }).then((result) => result.stdout.trim());
      await mounts.ensureRepo(project);
      await mounts.refreshProject(project);
      audit({ login, role, project, op: "spec-branch-create", spec, result: `ok:${branch}` });
      projection?.syncNow();
      logger(`created ${branch} for ${project}`);
      return serviceSuccess("specBranch", requestId, { action: "create", kind: "spec", branch, spec, topic: null, commit });
    } catch (error) {
      console.error("spec_branch canonical create failed:", error?.stack ?? error);
      throw error;
    } finally {
      await cleanup(dir);
    }
  }

  async function createWork({ project, spec, topic, requestId, login, role = null }) {
    const mount = await mounts.ensureRepo(project);
    const canonical = specBranchName(spec);
    const canonicalRef = `refs/remotes/origin/${canonical}`;
    if (!(await branchExists(mount, canonical))) {
      return failure(requestId, "SPEC_NOT_FOUND", `spec ${spec} has no ${canonical} branch`);
    }
    const owned = await ownedBinding({ mount, project, spec, ref: canonicalRef });
    if (owned.error) return failure(requestId, "SPEC_BINDING_INVALID", owned.error);
    const branch = specWorkBranchName(spec, topic);
    if (await branchExists(mount, branch)) {
      return failure(requestId, "BRANCH_EXISTS", `branch ${branch} already exists`);
    }
    await mount.git.run(
      ["--git-dir", mount.mirrorDir, "push", "-q", mount.repoUrl, `${canonicalRef}:refs/heads/${branch}`],
      { cwd: mount.cwd },
    );
    await mounts.ensureRepo(project);
    audit({ login, role, project, op: "spec-branch-create", spec, result: `ok:${branch}` });
    logger(`created work branch ${branch}`);
    return serviceSuccess("specBranch", requestId, { action: "create", kind: "work", branch, spec, topic, commit: null });
  }

  async function mergeWork({ project, spec, topic, requestId, login, role = null }) {
    const mount = await mounts.ensureRepo(project);
    const canonical = specBranchName(spec);
    const branch = specWorkBranchName(spec, topic);
    const topicRef = `refs/remotes/origin/${branch}`;
    const canonicalRef = `refs/remotes/origin/${canonical}`;
    if (!(await mount.git.revParse(topicRef, { cwd: mount.mirrorDir }).catch(() => null))) {
      return failure(requestId, "BRANCH_NOT_FOUND", `branch ${branch} does not exist`);
    }
    if (!(await mount.git.revParse(canonicalRef, { cwd: mount.mirrorDir }).catch(() => null))) {
      return failure(requestId, "SPEC_NOT_FOUND", `spec ${spec} has no ${canonical} branch`);
    }
    // The topic branch must carry the canonical metadata; a rewritten
    // `.spec-kit.json` would turn a merge into a silent re-binding.
    const raw = await readSpecBinding({ git: mount.git, cwd: mount.mirrorDir, branch: topicRef });
    const valid = validateSpecBinding(raw, { branch: canonical, repoUrl: mount.repoUrl });
    if (!valid.ok || raw.project !== project || raw.spec !== spec) {
      return failure(requestId, "SPEC_BINDING_INVALID", `branch ${branch} carries invalid metadata: ${valid.errors.join("; ") || "metadata disagrees"}`);
    }
    const { stdout: changed } = await mount.git.run(["diff", "--name-only", `${canonicalRef}..${topicRef}`], { cwd: mount.mirrorDir });
    const paths = changed.split(/\r?\n/u).filter(Boolean);
    if (paths.length === 0) {
      return serviceSuccess("specBranch", requestId, { action: "merge", kind: "work", branch, spec, topic, commit: null, noop: true });
    }
    const allowed = paths.every((entry) => entry === SPEC_BINDING_FILE || entry.startsWith(`.specs/${spec}/`));
    if (!allowed) {
      return failure(requestId, "PATH_FORBIDDEN", `merge would carry paths outside .specs/${spec}: ${paths.filter((entry) => entry !== SPEC_BINDING_FILE && !entry.startsWith(`.specs/${spec}/`)).join(", ")}`);
    }
    const worktree = await mounts.worktreeFor(project, spec);
    try {
      // Fast-forward the checkout first; the topic ref is merged by object id.
      await worktree.git.fetch({ cwd: worktree.cwd }).catch(() => {});
      const behind = await worktree.git.revCount(`HEAD..${canonicalRef}`, { cwd: worktree.cwd });
      if (behind > 0) await worktree.git.mergeFF(canonicalRef, { cwd: worktree.cwd });
      await worktree.git.run([
        "-c", `user.name=${identity.name}`,
        "-c", `user.email=${identity.email}`,
        "merge", "--no-ff", "--no-edit", "-m",
        commitMessage({ subject: `merge ${branch}`, trailers: { "Spec-Author": login ?? "service" } }),
        topicRef,
      ], { cwd: worktree.cwd });
      const commit = await worktree.git.revParse("HEAD", { cwd: worktree.cwd });
      await worktree.git.push({ refspec: `HEAD:refs/heads/${canonical}` }, { cwd: worktree.cwd });
      await worktree.git.push({ refspec: `:refs/heads/${branch}` }, { cwd: worktree.cwd }).catch((error) => {
        logger(`merged ${branch} but could not delete the work branch: ${error.message}`);
      });
      await mounts.ensureRepo(project);
      await mounts.refreshProject(project);
      audit({ login, role, project, op: "spec-branch-merge", spec, result: `ok:${branch}:${commit.slice(0, 12)}` });
      await publish?.publishSpec(project, spec).catch((error) => logger(`publish after merge failed: ${error.message}`));
      projection?.syncNow();
      logger(`merged ${branch} into ${canonical} at ${commit.slice(0, 12)}`);
      return serviceSuccess("specBranch", requestId, { action: "merge", kind: "work", branch, spec, topic, commit });
    } catch (error) {
      await worktree.git.run(["merge", "--abort"], { cwd: worktree.cwd }).catch(() => {});
      if (/conflict|CONFLICT|Automatic merge failed/u.test(String(error?.message ?? error))) {
        return failure(requestId, "MERGE_CONFLICT", `merging ${branch} into ${canonical} conflicts; resolve it on the work branch`, { retryable: false });
      }
      return failure(requestId, "GIT_MERGE_FAILED", `merge failed: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true });
    }
  }

  async function deleteWork({ project, spec, topic, requestId, login, force = false, role = null }) {
    const branch = specWorkBranchName(spec, topic);
    const canonical = specBranchName(spec);
    let mount;
    try {
      mount = await mounts.ensureRepo(project, { strict: true });
    } catch (error) {
      return failure(requestId, "REPO_UNREACHABLE", `cannot refresh the repository before delete: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true, causeCode: error?.code ?? null });
    }
    if (!(await branchExists(mount, branch))) {
      return failure(requestId, "BRANCH_NOT_FOUND", `branch ${branch} does not exist`);
    }
    const workRef = `refs/remotes/origin/${branch}`;
    const canonicalRef = `refs/remotes/origin/${canonical}`;
    const owned = await ownedBinding({ mount, project, spec, ref: workRef });
    if (owned.error) return failure(requestId, "SPEC_BINDING_INVALID", owned.error);
    const merged = await mount.git.run(["--git-dir", mount.mirrorDir, "merge-base", "--is-ancestor", workRef, canonicalRef], { cwd: mount.cwd })
      .then(() => true)
      .catch(() => false);
    if (!merged) {
      if (!force) {
        return failure(requestId, "BRANCH_NOT_MERGED", `branch ${branch} has commits not merged into ${canonical}; merge first or pass force: true as an owner`, { parameter: "force" });
      }
      if (role !== "owner") {
        return failure(requestId, "FORBIDDEN_ROLE", "force delete requires the owner role", { parameter: "force" });
      }
    }
    const tip = await mount.git.revParse(workRef, { cwd: mount.mirrorDir });
    if (tip === null) return failure(requestId, "BRANCH_NOT_FOUND", `branch ${branch} does not exist`);
    await mount.git.run(
      ["--git-dir", mount.mirrorDir, "push", "-q", `--force-with-lease=refs/heads/${branch}:${tip}`, mount.repoUrl, `:refs/heads/${branch}`],
      { cwd: mount.cwd },
    );
    await mount.git.run(["--git-dir", mount.mirrorDir, "worktree", "prune"], { cwd: mount.cwd }).catch(() => {});
    await mounts.ensureRepo(project);
    audit({ login, role, project, op: "spec-branch-delete", spec, result: `ok:${branch}:${tip.slice(0, 12)}` });
    logger(`deleted work branch ${branch}`);
    return serviceSuccess("specBranch", requestId, { action: "delete", kind: "work", branch, spec, topic });
  }

  /**
   * Explicit demo-spec deletion. Ordinary `delete` keeps the canonical-branch
   * guard; only a spec whose canonical README carries `Demo: true` may take
   * this path, and only an owner may request it. The marker is read from the
   * remote ref, never from the mutable worktree, so a local-only commit cannot
   * authorize a delete. Unmerged work and published versions block the delete:
   * they are separate evidence and must be archived/removed first.
   */
  async function deleteCanonical({ project, spec, requestId, login, role }) {
    if (role !== "owner") {
      return failure(requestId, "FORBIDDEN_ROLE", "deleting a demo spec requires the owner role");
    }
    const branch = specBranchName(spec);
    let mount;
    try {
      mount = await mounts.ensureRepo(project, { strict: true });
    } catch (error) {
      return failure(requestId, "REPO_UNREACHABLE", `cannot refresh the repository before delete: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true, causeCode: error?.code ?? null });
    }
    const canonicalRef = `refs/remotes/origin/${branch}`;
    if (!(await branchExists(mount, branch))) {
      return failure(requestId, "SPEC_NOT_FOUND", `spec ${spec} has no ${branch} branch`);
    }
    const owned = await ownedBinding({ mount, project, spec, ref: canonicalRef });
    if (owned.error) return failure(requestId, "SPEC_BINDING_INVALID", owned.error);

    const refs = await listSpecRefs({ git: mount.git, cwd: mount.mirrorDir });
    const workBranches = refs
      .filter(({ parsed }) => parsed?.kind === "work" && parsed.slug === spec)
      .map(({ branch: workBranch }) => workBranch);
    if (workBranches.length > 0) {
      return failure(
        requestId,
        "SPEC_HAS_WORK_BRANCHES",
        `spec ${spec} still has work branches: ${workBranches.join(", ")}; merge or delete them first`,
        { branches: workBranches },
      );
    }
    let tags;
    try {
      tags = await mount.git.lsRemote(`refs/tags/${publishTagName(project, spec, "*")}`, { cwd: mount.mirrorDir });
    } catch (error) {
      return failure(requestId, "REPO_UNREACHABLE", `cannot verify published versions for ${spec}: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true, causeCode: error?.code ?? null });
    }
    if (tags.size > 0) {
      return failure(
        requestId,
        "SPEC_HAS_PUBLISHED_VERSIONS",
        `spec ${spec} has published versions: ${[...tags.keys()].join(", ")}; archive it instead`,
        { tags: [...tags.keys()] },
      );
    }
    const ledger = store?.getLedger?.(`${project}/${spec}`) ?? [];
    if (ledger.length > 0) {
      return failure(
        requestId,
        "SPEC_HAS_PUBLISHED_VERSIONS",
        `spec ${spec} has ledger versions even without a remote tag: ${ledger.map((row) => row.version).join(", ")}; archive it instead`,
        { versions: ledger.map((row) => row.version) },
      );
    }

    const readme = await mount.git.show(canonicalRef, `.specs/${spec}/README.md`, { cwd: mount.mirrorDir }).catch(() => "");
    if (!/^\s*>?\s*\*\*?Demo:?\*?\*?\s*true\b/imu.test(readme)) {
      return failure(requestId, "DELETE_FORBIDDEN", `spec ${spec} is not marked Demo: true; archive it instead`);
    }
    const tip = await mount.git.revParse(canonicalRef, { cwd: mount.mirrorDir });
    if (tip === null) return failure(requestId, "SPEC_NOT_FOUND", `spec ${spec} has no ${branch} branch`);

    // A failed publish leaves the local worktree ahead of the remote. Deleting
    // the spec would discard those commits, so refuse until they are pushed or
    // explicitly discarded.
    const localRef = `refs/heads/work/${branch}`;
    const localTip = await mount.git.revParse(localRef, { cwd: mount.mirrorDir }).catch(() => null);
    if (localTip !== null) {
      const ahead = await mount.git.revCount(`${canonicalRef}..${localRef}`, { cwd: mount.mirrorDir }).catch(() => null);
      if (ahead === null) {
        return failure(requestId, "SPEC_WORKTREE_STATE_UNKNOWN", `cannot inspect local work commits for ${spec}; retry when the repository is readable`, { retryable: true });
      }
      if (ahead > 0) {
        return failure(requestId, "SPEC_WORKTREE_AHEAD", `local worktree for ${spec} has ${ahead} unpushed commit(s); push or discard them first`, { commit: localTip, ahead });
      }
    }
    const worktreeDir = path.join(mount.cwd, "worktrees", branch);
    if (existsSync(worktreeDir)) {
      const dirty = await mount.git.run(["-C", worktreeDir, "status", "--porcelain"], { cwd: mount.cwd }).then((result) => result.stdout.trim()).catch(() => null);
      if (dirty === null) {
        return failure(requestId, "SPEC_WORKTREE_STATE_UNKNOWN", `cannot inspect the worktree for ${spec}; retry when it is readable`, { retryable: true });
      }
      if (dirty !== "") {
        return failure(requestId, "SPEC_WORKTREE_DIRTY", `worktree for ${spec} has uncommitted changes; commit or discard them first`, { paths: dirty.split(/\r?\n/u).slice(0, 20) });
      }
    }
    await mount.git.run(
      ["--git-dir", mount.mirrorDir, "push", "-q", `--force-with-lease=refs/heads/${branch}:${tip}`, mount.repoUrl, `:refs/heads/${branch}`],
      { cwd: mount.cwd },
    );
    await rm(worktreeDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }).catch(() => {});
    await mount.git.run(["--git-dir", mount.mirrorDir, "worktree", "prune"], { cwd: mount.cwd }).catch(() => {});
    // The write path keeps a local `work/<branch>` ref. Leaving it behind
    // makes a later re-create check out the deleted tip, and the first push
    // is rejected as non-fast-forward.
    await mount.git.run(["--git-dir", mount.mirrorDir, "branch", "-D", `work/${branch}`], { cwd: mount.cwd }).catch(() => {});
    await mounts.ensureRepo(project);
    await mounts.refreshProject(project);
    projection?.syncNow();
    audit({ login, role, project, op: "spec-branch-delete-spec", spec, result: `ok:${branch}:${tip.slice(0, 12)}` });
    logger(`deleted demo spec branch ${branch} at ${tip.slice(0, 12)}`);
    return serviceSuccess("specBranch", requestId, { action: "deleteSpec", kind: "spec", branch, spec, topic: null, commit: tip });
  }

  return {
    /** Used by the spec_patch write path when createSpec targets a new slug. */
    async ensureCanonical({ project, spec, requestId, login }) {
      return createCanonical({ project, spec, requestId, login, skeleton: false });
    },
    async run({ args, project, requestId, login, force = false, role = null }) {
      const parsed = parseArgs(args);
      if (parsed.error) return failure(requestId, "INVALID_REQUEST", parsed.error[0], parsed.error[1]);
      const { action, spec, topic } = parsed;
      const release = await mounts.acquireWriteLock(project);
      try {
        // A merge/delete is a spec write: honor the same lease as spec_patch.
        // Creating a brand-new canonical spec has no prior claim to honor.
        if (!(action === "create" && topic === null) && claims) {
          const held = claims.get(project, spec);
          if (held && held.holder !== login) {
            return failure(requestId, "CLAIM_HELD", `spec is claimed by ${held.holder} until ${held.expiresAt}`, {
              holder: held.holder,
              expiresAt: held.expiresAt,
            });
          }
        }
        if (action === "deleteSpec") {
          return await deleteCanonical({ project, spec, requestId, login, role });
        }
        if (action === "delete" && topic === null) {
          return failure(requestId, "BRANCH_PROTECTED", `spec ${spec} is canonical; delete a work branch or delete a Demo: true spec`, { parameter: "topic" });
        }
        if (action === "create") {
          return topic === null
            ? await createCanonical({ project, spec, requestId, login, role })
            : await createWork({ project, spec, topic, requestId, login, role });
        }
        if (action === "merge") {
          if (topic === null) return failure(requestId, "INVALID_REQUEST", "merge needs a topic (the work branch suffix)", { parameter: "topic" });
          return await mergeWork({ project, spec, topic, requestId, login, role });
        }
        return await deleteWork({ project, spec, topic, requestId, login, force, role });
      } catch (error) {
        const code = error?.code === "SPEC_BINDING_INVALID" ? "SPEC_BINDING_INVALID" : "INTERNAL_ERROR";
        return failure(requestId, code, String(error?.message ?? error).split("\n")[0], { causeCode: error?.code ?? null });
      } finally {
        release();
      }
    },
  };
}
