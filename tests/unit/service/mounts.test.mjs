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

const AUTH = {
  youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
  appBridge: { token: "bridge-token-1234567890" },
  roleGroups: { reader: ["spec-readers"] },
};

function config(projects = ["stgmt/omp-spec-kit"]) {
  return parseProjectsConfig({ projects: projects.map((id) => ({ id })), auth: AUTH });
}

function storeWith(project, overrides = {}) {
  const row = {
    project,
    repoUrl: "file:///tmp/specs.git",
    branch: "main",
    status: "active",
    migratedFrom: null,
    migratedFromBranch: null,
    ...overrides,
  };
  return {
    getBinding: (id) => (id === project ? row : null),
    getCredential: () => null,
    row,
  };
}

function fakeGit() {
  const calls = [];
  return {
    calls,
    async clone() { calls.push(["clone"]); },
    async fetch() { calls.push(["fetch"]); },
    async revParse(ref) { calls.push(["revParse", ref]); return null; },
    async add(paths) { calls.push(["add", ...paths]); },
    async commit({ message }) { calls.push(["commit", message]); },
    async push({ refspec }) { calls.push(["push", refspec]); },
  };
}

describe("projects config parsing", () => {
  it("accepts a config without a default repository", () => {
    const parsed = config(["stgmt/omp-spec-kit", "acme/billing"]);
    assert.deepEqual(parsed.projects, ["stgmt/omp-spec-kit", "acme/billing"]);
    assert.equal("specsRepo" in parsed, false);
    assert.equal("branch" in parsed, false);
  });

  it("refuses the retired specsRepo/branch with MIGRATION_REQUIRED", () => {
    assert.throws(
      () => parseProjectsConfig({ specsRepo: "file:///tmp/specs.git", projects: [{ id: "a/b" }], auth: AUTH }),
      (error) => error.code === "MIGRATION_REQUIRED",
    );
    assert.throws(
      () => parseProjectsConfig({ branch: "main", projects: [{ id: "a/b" }], auth: AUTH }),
      (error) => error.code === "MIGRATION_REQUIRED",
    );
  });

  it("rejects empty projects and duplicate ids", () => {
    assert.throws(() => parseProjectsConfig({ projects: [], auth: AUTH }), ConfigError);
    assert.throws(() => parseProjectsConfig({ projects: [{ id: "a/b" }, { id: "a/b" }], auth: AUTH }), ConfigError);
  });

  it("rejects unsafe project ids", () => {
    for (const bad of ["../etc", "a/../b", "/abs", "trailing/", "a//b", "a/b/c", ".hidden/x", "a/", 42]) {
      assert.throws(() => validateProjectId(bad), ConfigError, `expected rejection: ${bad}`);
    }
    assert.equal(validateProjectId("stgmt/omp-spec-kit"), "stgmt/omp-spec-kit");
  });
});

describe("mount manager", () => {
  it("resolves a bound project root inside its mount", async () => {
    const dir = await tempDir();
    const project = "stgmt/omp-spec-kit";
    const store = storeWith(project);
    const mounts = new MountManager({ config: config(), cloneDir: dir, store });
    const root = mounts.resolveProjectRoot(project);
    assert.equal(root, path.join(mounts.for(project).cwd, "stgmt", "omp-spec-kit"));
    assert.equal(root.startsWith(mounts.for(project).cwd), true);
    assert.throws(() => mounts.resolveProjectRoot("../outside"), ConfigError);
  });

  it("refuses an unbound project with REPO_BINDING_REQUIRED", async () => {
    const dir = await tempDir();
    const mounts = new MountManager({ config: config(), cloneDir: dir, store: { getBinding: () => null } });
    assert.throws(() => mounts.for("stgmt/omp-spec-kit"), (error) => error.code === "REPO_BINDING_REQUIRED");
    assert.equal(mounts.forSource("stgmt/omp-spec-kit"), null);
  });

  it("requireConfigured refuses unknown projects with PROJECT_NOT_CONFIGURED", async () => {
    const dir = await tempDir();
    const mounts = new MountManager({ config: config(), cloneDir: dir });
    assert.throws(() => mounts.requireConfigured("acme/billing"), /PROJECT_NOT_CONFIGURED|not configured/u);
  });

  it("caches one createSpecService instance per project", async () => {
    const dir = await tempDir();
    const project = "stgmt/omp-spec-kit";
    const mounts = new MountManager({ config: config(), cloneDir: dir, store: storeWith(project) });
    const first = mounts.serviceFor(project);
    const second = mounts.serviceFor(project);
    assert.equal(first, second);
  });

  it("forSource follows an in-flight binding instead of a default repository", async () => {
    const dir = await tempDir();
    const project = "acme/gamma";
    const store = storeWith(project, { status: "error", repoUrl: "git://git/acme.git" });
    const mounts = new MountManager({ config: config([project]), cloneDir: dir, store, extraProjects: () => [project] });
    assert.throws(() => mounts.for(project), (error) => error.code === "REPO_BINDING_REQUIRED");
    assert.equal(mounts.forSource(project), null);
    store.row.migratedFrom = "git://git/old.git";
    assert.equal(mounts.forSource(project).repoUrl, "git://git/old.git");
    store.row.status = "active";
    assert.equal(mounts.forSource(project).repoUrl, "git://git/acme.git");
    assert.equal(mounts.for(project).repoUrl, "git://git/acme.git");
  });

  it("boot creates a .specs skeleton in the bound mount and commits it as the bot", async () => {
    const dir = await tempDir();
    const project = "stgmt/omp-spec-kit";
    const git = fakeGit();
    const mounts = new MountManager({
      config: config(),
      cloneDir: path.join(dir, "clone"),
      git,
      gitFactory: () => git,
      store: storeWith(project),
      identity: { name: "spec-bot", email: "bot@example.invalid" },
    });
    mounts.serviceFor = () => ({ ensure: async () => ({ status: "ready" }) });
    const report = await mounts.boot();
    assert.equal(report[project].graphStatus, "ready");
    const specsDir = path.join(mounts.resolveProjectRoot(project), ".specs");
    assert.equal((await stat(specsDir)).isDirectory(), true);
    const commitCall = git.calls.find(([kind]) => kind === "commit");
    assert.match(commitCall[1], /chore: init scope stgmt\/omp-spec-kit/u);
    const pushCall = git.calls.find(([kind]) => kind === "push");
    assert.equal(pushCall[1], "HEAD:refs/heads/main");
  });
});
