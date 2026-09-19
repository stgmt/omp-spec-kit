import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, after } from "node:test";
import { MountManager, parseProjectsConfig, validateProjectId } from "../../../src/service/mounts.js";
import { ConfigError } from "../../../src/service/mounts.js";

const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "spec-mounts-"));
  tempDirs.push(dir);
  return dir;
}

function fakeGit() {
  const calls = [];
  return {
    calls,
    async clone() { calls.push(["clone"]); },
    async fetch() { calls.push(["fetch"]); },
    // The fake clone has no origin ref yet: boot reconciliation short-circuits.
    async revParse(ref) { calls.push(["revParse", ref]); return null; },
    async add(paths) { calls.push(["add", ...paths]); },
    async commit({ message }) { calls.push(["commit", message]); },
    async push({ refspec }) { calls.push(["push", refspec]); },
  };
}

describe("projects config parsing", () => {
  it("accepts a well-formed config and normalizes project ids", () => {
    const config = parseProjectsConfig({
      specsRepo: "file:///tmp/specs.git",
      branch: "main",
      projects: [{ id: "stgmt/omp-spec-kit" }, "acme/billing"],
      auth: {
        youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
        appBridge: { token: "bridge-token-1234567890" },
        roleGroups: { reader: ["spec-readers"] },
      },
    });
    assert.deepEqual(config.projects, ["stgmt/omp-spec-kit", "acme/billing"]);
    assert.equal(config.branch, "main");
  });

  it("rejects missing specsRepo, empty projects, and duplicate ids", () => {
    assert.throws(() => parseProjectsConfig({ projects: [{ id: "a/b" }] }), ConfigError); // auth block is mandatory
    assert.throws(() => parseProjectsConfig({ specsRepo: "x", projects: [] }), ConfigError);
    assert.throws(() => parseProjectsConfig({ specsRepo: "x", projects: [{ id: "a/b" }, { id: "a/b" }] }), ConfigError);
  });

  it("rejects unsafe project ids", () => {
    for (const bad of ["../etc", "a/../b", "/abs", "trailing/", "a//b", "a/b/c", ".hidden/x", "a/", 42]) {
      assert.throws(() => validateProjectId(bad), ConfigError, `expected rejection: ${bad}`);
    }
    assert.equal(validateProjectId("stgmt/omp-spec-kit"), "stgmt/omp-spec-kit");
  });
});

describe("mount manager", () => {
  it("resolves project roots inside the clone and refuses escapes", async () => {
    const dir = await tempDir();
    const mounts = new MountManager({
      config: parseProjectsConfig({ specsRepo: "file:///tmp/specs.git", projects: [{ id: "stgmt/omp-spec-kit" }], auth: {
        youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
        appBridge: { token: "bridge-token-1234567890" },
        roleGroups: { reader: ["spec-readers"] },
      }, }),
      cloneDir: dir,
    });
    assert.equal(mounts.resolveProjectRoot("stgmt/omp-spec-kit"), path.resolve(dir, "stgmt", "omp-spec-kit"));
    assert.throws(() => mounts.resolveProjectRoot("../outside"), ConfigError);
  });

  it("requireConfigured refuses unknown projects with PROJECT_NOT_CONFIGURED", async () => {
    const dir = await tempDir();
    const mounts = new MountManager({
      config: parseProjectsConfig({ specsRepo: "file:///tmp/specs.git", projects: [{ id: "stgmt/omp-spec-kit" }], auth: {
        youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
        appBridge: { token: "bridge-token-1234567890" },
        roleGroups: { reader: ["spec-readers"] },
      }, }),
      cloneDir: dir,
    });
    assert.throws(() => mounts.requireConfigured("acme/billing"), /PROJECT_NOT_CONFIGURED|not configured/u);
  });

  it("caches one createSpecService instance per project", async () => {
    const dir = await tempDir();
    const mounts = new MountManager({
      config: parseProjectsConfig({ specsRepo: "file:///tmp/specs.git", projects: [{ id: "stgmt/omp-spec-kit" }], auth: {
        youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
        appBridge: { token: "bridge-token-1234567890" },
        roleGroups: { reader: ["spec-readers"] },
      }, }),
      cloneDir: dir,
    });
    const first = mounts.serviceFor("stgmt/omp-spec-kit");
    const second = mounts.serviceFor("stgmt/omp-spec-kit");
    assert.equal(first, second);
  });

  it("forSource resolves the migration source for an error-state binding instead of wedging", async () => {
    const dir = await tempDir();
    const auth = {
      youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
      appBridge: { token: "bridge-token-1234567890" },
      roleGroups: { reader: ["spec-readers"] },
    };
    const row = { project: "acme/gamma", repoUrl: "git://git/acme.git", branch: "main", status: "error", migratedFrom: null, migratedFromBranch: null };
    const mounts = new MountManager({
      config: parseProjectsConfig({ specsRepo: "file:///tmp/specs.git", projects: [{ id: "stgmt/omp-spec-kit" }], auth }),
      cloneDir: dir,
      store: { getBinding: () => row },
      extraProjects: () => ["acme/gamma"],
    });
    // Reads/writes still refuse — the migration never landed — but the bind
    // retry must find the source mount instead of dying on the same error.
    assert.throws(() => mounts.for("acme/gamma"), (e) => e.code === "REPO_BINDING_REQUIRED");
    assert.equal(mounts.forSource("acme/gamma"), mounts.defaultMount);
    row.migratedFrom = "git://git/old.git";
    assert.equal(mounts.forSource("acme/gamma").repoUrl, "git://git/old.git");
    row.status = "active";
    assert.equal(mounts.forSource("acme/gamma").repoUrl, "git://git/acme.git");
    assert.equal(mounts.for("acme/gamma").repoUrl, "git://git/acme.git");
  });

  it("boot creates a .specs skeleton and commits it as the bot", async () => {
    const dir = await tempDir();
    const git = fakeGit();
    const mounts = new MountManager({
      config: parseProjectsConfig({ specsRepo: "file:///tmp/specs.git", projects: [{ id: "stgmt/omp-spec-kit" }], auth: {
        youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
        appBridge: { token: "bridge-token-1234567890" },
        roleGroups: { reader: ["spec-readers"] },
      }, }),
      cloneDir: dir,
      git,
      identity: { name: "spec-bot", email: "bot@example.invalid" },
    });
    // fake git does not materialize a clone; stub ensureClone out — skeleton path is what we test
    mounts.ensureClone = async () => {};
    mounts.serviceFor = () => ({ ensure: async () => ({ status: "ready" }) });
    const report = await mounts.boot();
    assert.equal(report["stgmt/omp-spec-kit"].graphStatus, "ready");
    const specsDir = path.join(dir, "stgmt", "omp-spec-kit", ".specs");
    assert.equal((await stat(specsDir)).isDirectory(), true);
    const commitCall = git.calls.find(([kind]) => kind === "commit");
    assert.match(commitCall[1], /chore: init scope stgmt\/omp-spec-kit/u);
    const pushCall = git.calls.find(([kind]) => kind === "push");
    assert.equal(pushCall[1], "HEAD:refs/heads/main");
  });
});
