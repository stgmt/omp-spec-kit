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

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const PROJECT = "stgmt/demo";
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
  const manager = createSpecBranchManager({ mounts, identity: IDENTITY, logger: () => {} });
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
