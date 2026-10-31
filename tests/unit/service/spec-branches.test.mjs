import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { MountManager, parseProjectsConfig } from "../../../src/service/mounts.js";
import { createDispatcher } from "../../../src/service/dispatch.js";
import { BRANCH_CONTRACTS, createBranchOps } from "../../../src/service/ops/branch.js";
import { createSpecBranchManager } from "../../../src/service/spec-branches.js";
import { publishTagName } from "../../../src/service/publish.js";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const PROJECT = "stgmt/demo";
const OTHER = "stgmt/other";
const AUTH = {
  youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
  appBridge: { token: "bridge-token-1234567890" },
  roleGroups: { reader: ["spec-readers"] },
};
const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })));
});

async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

async function setup() {
  const base = await tempDir("spec-branches-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  const config = parseProjectsConfig({ projects: [{ id: PROJECT }], auth: AUTH });
  const row = { project: PROJECT, repoUrl: bare, branch: "main", status: "active" };
  const store = {
    getBinding: (project) => (project === PROJECT ? row : null),
    getCredential: () => null,
  };
  const mounts = new MountManager({ config, cloneDir: path.join(base, "clone"), store, identity: IDENTITY, logger: () => {} });
  const manager = createSpecBranchManager({ mounts, identity: IDENTITY, logger: () => {}, store: { getLedger: () => [] }, dependents: async () => [] });
  return { base, bare, mounts, manager };
}

/** Two projects bound to the SAME repository: the branch namespace is shared. */
async function setupShared() {
  const base = await tempDir("spec-branches-shared-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  const config = parseProjectsConfig({ projects: [{ id: PROJECT }, { id: OTHER }], auth: AUTH });
  const row = { repoUrl: bare, branch: "main", status: "active" };
  const store = {
    getBinding: (project) => (project === PROJECT || project === OTHER ? { project, ...row } : null),
    getCredential: () => null,
  };
  const mounts = new MountManager({ config, cloneDir: path.join(base, "clone"), store, identity: IDENTITY, logger: () => {} });
  const manager = createSpecBranchManager({ mounts, identity: IDENTITY, logger: () => {}, store: { getLedger: () => [] }, dependents: async () => [] });
  return { base, bare, mounts, manager };
}

async function pushToWork(bare, { spec, topic, files, message = "work edit" }) {
  const dir = await tempDir("spec-work-");
  const work = path.join(dir, "work");
  const branch = `spec-${spec}--${topic}`;
  await execFileAsync("git", ["clone", bare, work]);
  await git(work, ["checkout", "-B", branch, `origin/${branch}`]);
  await git(work, ["config", "user.email", "alice@example.invalid"]);
  await git(work, ["config", "user.name", "alice"]);
  for (const [relative, content] of Object.entries(files)) {
    await writeFile(path.join(work, relative), content);
  }
  await git(work, ["add", "-A"]);
  await git(work, ["commit", "-m", message]);
  await git(work, ["push", "-q", "origin", `HEAD:refs/heads/${branch}`]);
}

async function markDemo(bare, manager, { project = PROJECT, spec = "demo-spec", topic = "demo" } = {}) {
  const created = await manager.run({ args: { action: "create", spec, demo: true }, project, requestId: `mk-${topic}`, login: "alice" });
  if (!created.ok && created.error?.code !== "SPEC_EXISTS") assert.fail(JSON.stringify(created.error ?? {}));
  await manager.run({ args: { action: "create", spec, topic }, project, requestId: `mk-${topic}-w`, login: "alice" });
  await pushToWork(bare, {
    spec,
    topic,
    files: { [`.specs/${spec}/README.md`]: `# ${spec}\n\n**Demo:** true\n` },
  });
  const merged = await manager.run({ args: { action: "merge", spec, topic }, project, requestId: `mk-${topic}-m`, login: "alice" });
  assert.equal(merged.ok, true, JSON.stringify(merged.error ?? {}));
}

describe("spec_branch", () => {
  it("creates an orphan canonical branch with valid metadata and a work branch", async () => {
    const { bare, mounts, manager } = await setup();
    const created = await manager.run({ args: { action: "create", spec: "demo-spec" }, project: PROJECT, requestId: "b1", login: "alice" });
    assert.equal(created.ok, true, JSON.stringify(created.error ?? {}));
    assert.equal(created.data.branch, "spec-demo-spec");

    const metadata = JSON.parse(await git(bare, ["show", "spec-demo-spec:.spec-kit.json"]));
    assert.equal(metadata.project, PROJECT);
    assert.equal(metadata.spec, "demo-spec");
    assert.equal(metadata.branch, "spec-demo-spec");
    assert.equal(await git(bare, ["rev-list", "--max-parents=0", "--count", "spec-demo-spec"]), "1", "root commit, no code history");

    const work = await manager.run({ args: { action: "create", spec: "demo-spec", topic: "rewrite" }, project: PROJECT, requestId: "b2", login: "alice" });
    assert.equal(work.ok, true, JSON.stringify(work.error ?? {}));
    assert.equal(work.data.branch, "spec-demo-spec--rewrite");
    const listed = await mounts.listBranches(PROJECT);
    assert.deepEqual(listed.branches.map((entry) => entry.branch).sort(), ["spec-demo-spec", "spec-demo-spec--rewrite"]);
  });

  it("merges a work branch into its spec and deletes the work branch", async () => {
    const { bare, mounts, manager } = await setup();
    await manager.run({ args: { action: "create", spec: "demo-spec" }, project: PROJECT, requestId: "b1", login: "alice" });
    await manager.run({ args: { action: "create", spec: "demo-spec", topic: "rewrite" }, project: PROJECT, requestId: "b2", login: "alice" });
    await pushToWork(bare, {
      spec: "demo-spec",
      topic: "rewrite",
      files: { ".specs/demo-spec/README.md": "# demo-spec\n\nStatus: ACTIVE\nVersion: 1.0.0\n" },
    });

    const merged = await manager.run({ args: { action: "merge", spec: "demo-spec", topic: "rewrite" }, project: PROJECT, requestId: "b3", login: "alice" });
    assert.equal(merged.ok, true, JSON.stringify(merged.error ?? {}));
    assert.match(merged.data.commit, /^[0-9a-f]{40}$/u);
    assert.match(await git(bare, ["show", "spec-demo-spec:.specs/demo-spec/README.md"]), /Version: 1\.0\.0/u);
    assert.match(await git(bare, ["log", "--format=%s", "-2", "spec-demo-spec"]), /merge spec-demo-spec--rewrite/u);
    const listed = await mounts.listBranches(PROJECT);
    assert.deepEqual(listed.branches.map((entry) => entry.branch), ["spec-demo-spec"], "merged work branch is gone");
  });

  it("deletes only a spec explicitly marked Demo: true", async () => {
    const { bare, manager } = await setup();
    await manager.run({ args: { action: "create", spec: "demo-spec" }, project: PROJECT, requestId: "b1", login: "alice" });
    await manager.run({ args: { action: "create", spec: "demo-spec", topic: "demo" }, project: PROJECT, requestId: "b2", login: "alice" });
    await pushToWork(bare, {
      spec: "demo-spec",
      topic: "demo",
      files: { ".specs/demo-spec/README.md": "# demo-spec\n\n**Demo:** true\n" },
    });
    const merged = await manager.run({ args: { action: "merge", spec: "demo-spec", topic: "demo" }, project: PROJECT, requestId: "b3", login: "alice" });
    assert.equal(merged.ok, true, JSON.stringify(merged.error ?? {}));

    await manager.run({ args: { action: "create", spec: "real-spec" }, project: PROJECT, requestId: "b4", login: "alice" });
    const refused = await manager.run({ args: { action: "deleteSpec", spec: "real-spec" }, project: PROJECT, requestId: "b5", login: "alice", role: "owner" });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "DELETE_FORBIDDEN");

    const removed = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "b6", login: "alice", role: "owner" });
    assert.equal(removed.ok, true, JSON.stringify(removed.error ?? {}));
    assert.equal(await git(bare, ["ls-remote", "--heads", bare, "refs/heads/spec-demo-spec"]), "");
  });

  it("refuses to mutate another project's branch in a shared repository", async () => {
    const { bare, manager } = await setupShared();
    await manager.run({ args: { action: "create", spec: "shared-a" }, project: PROJECT, requestId: "x1", login: "alice" });
    await manager.run({ args: { action: "create", spec: "shared-b" }, project: OTHER, requestId: "x2", login: "alice" });

    const created = await manager.run({ args: { action: "create", spec: "shared-b", topic: "x" }, project: PROJECT, requestId: "x3", login: "alice" });
    assert.equal(created.ok, false);
    assert.equal(created.error.code, "SPEC_BINDING_INVALID");

    await manager.run({ args: { action: "create", spec: "shared-b", topic: "keep" }, project: OTHER, requestId: "x4", login: "alice" });
    const deletedWork = await manager.run({ args: { action: "delete", spec: "shared-b", topic: "keep" }, project: PROJECT, requestId: "x5", login: "alice", force: true, role: "owner" });
    assert.equal(deletedWork.ok, false);
    assert.equal(deletedWork.error.code, "SPEC_BINDING_INVALID");

    await markDemo(bare, manager, { project: OTHER, spec: "shared-b", topic: "demo" });
    const deletedSpec = await manager.run({ args: { action: "deleteSpec", spec: "shared-b" }, project: PROJECT, requestId: "x6", login: "alice", role: "owner" });
    assert.equal(deletedSpec.ok, false);
    assert.equal(deletedSpec.error.code, "SPEC_BINDING_INVALID");
  });

  it("allows a writer to delete a metadata-marked demo spec", async () => {
    const { bare, manager } = await setup();
    await markDemo(bare, manager);
    const deleted = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "w1", login: "alice", role: "writer" });
    assert.equal(deleted.ok, true, JSON.stringify(deleted.error ?? {}));
    assert.equal(await git(bare, ["ls-remote", "--heads", bare, "refs/heads/spec-demo-spec"]), "");
  });

  it("blocks demo deletion for unmerged work and published versions", async () => {
    const { bare, manager } = await setup();
    await markDemo(bare, manager);

    await manager.run({ args: { action: "create", spec: "demo-spec", topic: "pending" }, project: PROJECT, requestId: "d2", login: "alice" });
    const workBlocked = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "d3", login: "alice", role: "owner" });
    assert.equal(workBlocked.ok, false);
    assert.equal(workBlocked.error.code, "SPEC_HAS_WORK_BRANCHES");

    await manager.run({ args: { action: "delete", spec: "demo-spec", topic: "pending" }, project: PROJECT, requestId: "d4", login: "alice", force: true, role: "owner" });
    await execFileAsync("git", ["--git-dir", bare, "tag", publishTagName(PROJECT, "demo-spec", "1.0.0"), "spec-demo-spec"]);
    const tagBlocked = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "d5", login: "alice", role: "owner" });
    assert.equal(tagBlocked.ok, false);
    assert.equal(tagBlocked.error.code, "SPEC_HAS_PUBLISHED_VERSIONS");
  });

  it("refuses unresolved dependents unless an owner forces", async () => {
    const { bare, mounts, manager } = await setup();
    await markDemo(bare, manager);
    const dependentManager = createSpecBranchManager({
      mounts,
      identity: IDENTITY,
      logger: () => {},
      store: { getLedger: () => [] },
      dependents: async () => ["other-spec:FR-1"],
    });
    const blocked = await dependentManager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "p1", login: "alice", role: "writer" });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error.code, "SPEC_HAS_DEPENDENTS");
    assert.deepEqual(blocked.error.references, ["other-spec:FR-1"]);
    const forced = await dependentManager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "p2", login: "alice", role: "owner", force: true });
    assert.equal(forced.ok, true, JSON.stringify(forced.error ?? {}));
  });

  it("awaits the projection sync before reporting deletion success", async () => {
    const { bare, mounts, manager } = await setup();
    await markDemo(bare, manager);
    let calls = 0;
    const projecting = createSpecBranchManager({
      mounts,
      identity: IDENTITY,
      logger: () => {},
      store: { getLedger: () => [] },
      dependents: async () => [],
      projection: { async syncOnce() { calls += 1; } },
    });
    const deleted = await projecting.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "s1", login: "alice", role: "writer" });
    assert.equal(deleted.ok, true, JSON.stringify(deleted.error ?? {}));
    assert.equal(calls, 1);
  });

  it("does not let a writer delete a legacy README-only demo", async () => {
    const { bare, manager } = await setup();
    await manager.run({ args: { action: "create", spec: "demo-spec" }, project: PROJECT, requestId: "lw1", login: "alice" });
    await manager.run({ args: { action: "create", spec: "demo-spec", topic: "legacy" }, project: PROJECT, requestId: "lw2", login: "alice" });
    await pushToWork(bare, {
      spec: "demo-spec",
      topic: "legacy",
      files: { ".specs/demo-spec/README.md": "# demo-spec\n\n**Demo:** true\n" },
    });
    await manager.run({ args: { action: "merge", spec: "demo-spec", topic: "legacy" }, project: PROJECT, requestId: "lw3", login: "alice" });
    const denied = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "lw4", login: "alice", role: "writer" });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "DELETE_FORBIDDEN");
    const owner = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "lw5", login: "alice", role: "owner" });
    assert.equal(owner.ok, true, JSON.stringify(owner.error ?? {}));
  });

  it("refuses to delete while local worktree commits are unpushed", async () => {
    const { bare, mounts, manager } = await setup();
    await markDemo(bare, manager);
    const worktree = await mounts.worktreeFor(PROJECT, "demo-spec");
    await writeFile(path.join(worktree.cwd, ".specs", "demo-spec", "NOTES.md"), "# local note\n");
    await git(worktree.cwd, ["add", "-A"]);
    await git(worktree.cwd, ["-c", "user.name=alice", "-c", "user.email=alice@example.invalid", "commit", "-m", "local unpushed note"]);
    const denied = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "l2", login: "alice", role: "owner" });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "SPEC_WORKTREE_AHEAD");
  });

  it("refuses to delete a canonical spec that is not marked Demo on the remote", async () => {
    const { manager } = await setup();
    await manager.run({ args: { action: "create", spec: "demo-spec" }, project: PROJECT, requestId: "m1", login: "alice" });
    const denied = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "m2", login: "alice", role: "owner" });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "DELETE_FORBIDDEN");
  });

  it("fails closed when the published-version lookup fails", async () => {
    const { bare, mounts, manager } = await setup();
    await markDemo(bare, manager);
    const original = mounts.ensureRepo.bind(mounts);
    mounts.ensureRepo = async (project, options) => {
      const mount = await original(project, options);
      const git = Object.assign(Object.create(Object.getPrototypeOf(mount.git)), mount.git);
      git.lsRemote = async () => { throw new Error("simulated ls-remote outage"); };
      mount.git = git;
      return mount;
    };
    const denied = await manager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "t1", login: "alice", role: "owner" });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "REPO_UNREACHABLE");
    assert.equal(denied.error.retryable, true);
    assert.equal(await git(bare, ["ls-remote", "--heads", bare, "refs/heads/spec-demo-spec"]).then((out) => out.length > 0), true);
  });

  it("refuses demo deletion when only a ledger version remains", async () => {
    const { bare, mounts } = await setup();
    const ledgerManager = createSpecBranchManager({
      mounts,
      identity: IDENTITY,
      logger: () => {},
      store: { getLedger: (key) => (key === `${PROJECT}/demo-spec` ? [{ version: "1.0.0" }] : []) },
      dependents: async () => [],
    });
    await markDemo(bare, ledgerManager);
    const denied = await ledgerManager.run({ args: { action: "deleteSpec", spec: "demo-spec" }, project: PROJECT, requestId: "g1", login: "alice", role: "owner" });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "SPEC_HAS_PUBLISHED_VERSIONS");
  });

  it("honors an active claim before merging another user's spec", async () => {
    const { mounts, manager } = await setup();
    await manager.run({ args: { action: "create", spec: "demo-spec" }, project: PROJECT, requestId: "b1", login: "alice" });
    const claimed = createSpecBranchManager({
      mounts,
      claims: { get: (project, spec) => (project === PROJECT && spec === "demo-spec" ? { holder: "bob", expiresAt: "2099-01-01T00:00:00.000Z" } : null) },
      identity: IDENTITY,
    });
    const result = await claimed.run({ args: { action: "merge", spec: "demo-spec", topic: "topic" }, project: PROJECT, requestId: "b2", login: "alice" });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "CLAIM_HELD");
    assert.equal(result.error.holder, "bob");
  });

  it("refuses an invalid spec slug with a typed error", async () => {
    const { manager } = await setup();
    const result = await manager.run({ args: { action: "create", spec: "Not A Slug" }, project: PROJECT, requestId: "b1", login: "alice" });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_REQUEST");
  });

  it("refuses a merge that carries code and protects the canonical branch", async () => {
    const { bare, manager } = await setup();
    await manager.run({ args: { action: "create", spec: "demo-spec" }, project: PROJECT, requestId: "b1", login: "alice" });
    await manager.run({ args: { action: "create", spec: "demo-spec", topic: "code" }, project: PROJECT, requestId: "b2", login: "alice" });
    await pushToWork(bare, { spec: "demo-spec", topic: "code", files: { "CODE.md": "# code\n" } });

    const merged = await manager.run({ args: { action: "merge", spec: "demo-spec", topic: "code" }, project: PROJECT, requestId: "b3", login: "alice" });
    assert.equal(merged.ok, false);
    assert.equal(merged.error.code, "PATH_FORBIDDEN");

    const deleted = await manager.run({ args: { action: "delete", spec: "demo-spec" }, project: PROJECT, requestId: "b4", login: "alice" });
    assert.equal(deleted.ok, false);
    assert.equal(deleted.error.code, "BRANCH_PROTECTED");

    const unmerged = await manager.run({ args: { action: "delete", spec: "demo-spec", topic: "code" }, project: PROJECT, requestId: "b5", login: "alice" });
    assert.equal(unmerged.ok, false);
    assert.equal(unmerged.error.code, "BRANCH_NOT_MERGED");

    const removedWork = await manager.run({ args: { action: "delete", spec: "demo-spec", topic: "code" }, project: PROJECT, requestId: "b6", login: "alice", force: true, role: "owner" });
    assert.equal(removedWork.ok, true, JSON.stringify(removedWork.error ?? {}));
    assert.equal(await git(bare, ["ls-remote", "--heads", bare, "refs/heads/spec-demo-spec--code"]), "");
  });
});

describe("spec_branch dispatch", () => {
  it("passes the transport-level force flag to the branch manager", async () => {
    let seen = null;
    const dispatcher = createDispatcher({
      mounts: { requireConfigured: () => {}, requireRepoReady: () => {} },
      serviceOps: {
        specBranch: createBranchOps({
          branches: {
            async run(payload) {
              seen = payload;
              return { ok: true };
            },
          },
        }).specBranch,
      },
      serviceContracts: BRANCH_CONTRACTS,
    });
    await dispatcher.callTool({
      tool: "spec_branch",
      args: { schemaVersion: "spec-kernel@2", project: PROJECT, action: "delete", spec: "demo-spec", topic: "topic", force: true },
      ctx: { role: "owner", scopes: [PROJECT], identity: { login: "alice" }, defaultScope: null },
    });
    assert.equal(seen?.force, true, "force must survive the dispatcher's transport-field split");
    assert.equal(seen?.args?.force, undefined, "force is a transport field, not a closed op argument");
    assert.equal(seen?.role, "owner");
  });
});
