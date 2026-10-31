import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, it, after } from "node:test";
import { MountManager, parseProjectsConfig } from "../../../src/service/mounts.js";
import { createRepoManager } from "../../../src/service/repos.js";
import { sealSecret } from "../../../src/service/secrets.js";

const execFileAsync = promisify(execFile);
const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
});

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "spec-repos-trigger-"));
  tempDirs.push(dir);
  return dir;
}

const AUTH_BLOCK = {
  youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
  appBridge: { token: "bridge-token-1234567890" },
  roleGroups: { reader: ["spec-readers"] },
};

function memoryStore() {
  const bindings = new Map();
  return {
    bindings,
    getBinding: (project) => bindings.get(project) ?? null,
    putBinding: async (row) => {
      bindings.set(row.project, { ...row });
    },
    putCredential: async () => {},
    deleteBinding: async (project) => {
      bindings.delete(project);
    },
    deleteCredential: async () => {},
    logAccess: () => {},
  };
}

describe("repo bind/unbind repo-change trigger", () => {
  it("afterRepoChange fires once per successful bind and unbind", async () => {
    const dir = await tempDir();
    const specsBare = path.join(dir, "specs.git");
    const byoBare = path.join(dir, "byo.git");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", specsBare]);
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", byoBare]);
    const config = parseProjectsConfig({
      projects: [{ id: "stgmt/alpha" }],
      auth: AUTH_BLOCK,
    });
    config.repoPolicy = { allowedHosts: ["file"] };
    const store = memoryStore();
    const secretsKey = "k".repeat(32);
    const identity = { name: "spec-bot", email: "bot@example.invalid" };
    const mounts = new MountManager({ config, cloneDir: path.join(dir, "clone"), store, secretsKey, identity });
    const calls = [];
    const repos = createRepoManager({
      mounts,
      store,
      config,
      identity,
      secretsKey,
      logger: () => {},
      afterRepoChange: () => calls.push(1),
    });
    const result = await repos.bindInternal({
      project: "stgmt/alpha",
      repoUrl: pathToFileURL(byoBare).href,
      token: "unused-file-remote",
      migrate: false,
    });
    assert.equal(result.binding.status, "active");
    assert.equal(calls.length, 1, "a bound repo triggers one repo-change (migration/skeleton push)");
    await repos.unbindInternal("stgmt/alpha");
    assert.equal(calls.length, 2, "unbind triggers a second repo-change");
    // A no-op unbind of an unbound project must not fire.
    await repos.unbindInternal("stgmt/alpha");
    assert.equal(calls.length, 2);
  });

  it("a bind that fails mid-way never fires afterRepoChange", async () => {
    const dir = await tempDir();
    const specsBare = path.join(dir, "specs.git");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", specsBare]);
    const config = parseProjectsConfig({
      projects: [{ id: "stgmt/alpha" }],
      auth: AUTH_BLOCK,
    });
    config.repoPolicy = { allowedHosts: ["file"] };
    const store = memoryStore();
    const mounts = new MountManager({ config, cloneDir: path.join(dir, "clone"), store, secretsKey: "k".repeat(32), identity: { name: "b", email: "b@x" } });
    const calls = [];
    const repos = createRepoManager({
      mounts,
      store,
      config,
      identity: { name: "b", email: "b@x" },
      secretsKey: "k".repeat(32),
      logger: () => {},
      afterRepoChange: () => calls.push(1),
    });
    // An unreachable remote fails the bind before the repo change lands —
    // a projection run for unchanged content would just waste a cycle, and
    // a premature trigger would certify nothing was pushed.
    await assert.rejects(
      repos.bindInternal({
        project: "stgmt/alpha",
        repoUrl: pathToFileURL(path.join(dir, "missing.git")).href,
        token: "unused-file-remote",
        migrate: false,
      }),
    );
    assert.equal(calls.length, 0, "failed bind does not trigger a projection run");
  });

  it("keeps the source credential until the target mirror is ready", async () => {
    const dir = await tempDir();
    const oldBare = path.join(dir, "old.git");
    const newBare = path.join(dir, "new.git");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", oldBare]);
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", newBare]);
    const oldUrl = pathToFileURL(oldBare).href;
    const newUrl = pathToFileURL(newBare).href;
    const config = parseProjectsConfig({
      projects: [{ id: "stgmt/alpha" }],
      auth: AUTH_BLOCK,
    });
    config.repoPolicy = { allowedHosts: ["file"] };
    const secretsKey = "k".repeat(32);
    const bindings = new Map([["stgmt/alpha", {
      project: "stgmt/alpha",
      repoUrl: oldUrl,
      branch: "main",
      status: "active",
      boundBy: null,
      boundAt: new Date().toISOString(),
      migratedFrom: null,
      migratedFromBranch: null,
      lastError: null,
    }]]);
    const credentials = new Map([["stgmt/alpha", {
      repoUrl: oldUrl,
      tokenEnc: sealSecret(secretsKey, "old-token"),
      username: null,
    }]]);
    const store = {
      getBinding: (project) => bindings.get(project) ?? null,
      putBinding: async (row) => { bindings.set(row.project, { ...row }); },
      getCredential: (project) => credentials.get(project) ?? null,
      putCredential: async (project, row) => { credentials.set(project, { ...row }); },
      deleteBinding: async () => {},
      deleteCredential: async () => {},
      logAccess: () => {},
    };
    const mounts = new MountManager({ config, cloneDir: path.join(dir, "clone"), store, secretsKey, identity: { name: "b", email: "b@x" } });
    const repos = createRepoManager({
      mounts,
      store,
      config,
      identity: { name: "b", email: "b@x" },
      secretsKey,
      logger: () => {},
    });
    mounts.ensureMount = async () => {
      assert.equal(bindings.get("stgmt/alpha").status, "migrating");
      assert.equal(credentials.get("stgmt/alpha").repoUrl, oldUrl, "the source credential must survive the move");
      assert.equal(mounts.authFor("stgmt/alpha", oldUrl).token, "old-token");
      throw new Error("simulated mirror failure");
    };
    await assert.rejects(
      repos.bindInternal({ project: "stgmt/alpha", repoUrl: newUrl, token: "new-token", migrate: false }),
    );
    assert.equal(credentials.get("stgmt/alpha").repoUrl, oldUrl, "a failed bind must not strand the source credential");
    assert.equal(bindings.get("stgmt/alpha").status, "error");
  });
});
