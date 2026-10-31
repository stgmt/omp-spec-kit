import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
  it("derives the materialized project root inside the repo workspace", async () => {
    const dir = await tempDir();
    const project = "stgmt/omp-spec-kit";
    const store = storeWith(project);
    const mounts = new MountManager({ config: config(), cloneDir: dir, store });
    const mount = mounts.for(project);
    assert.equal(mounts.cacheRootFor(project, mount), path.join(mount.cwd, "projects", "stgmt__omp-spec-kit"));
    await assert.rejects(() => mounts.resolveProjectRoot("../outside"), ConfigError);
  });

  it("refuses an unbound project with REPO_BINDING_REQUIRED", async () => {
    const dir = await tempDir();
    const mounts = new MountManager({ config: config(), cloneDir: dir, store: { getBinding: () => null } });
    assert.throws(() => mounts.for("stgmt/omp-spec-kit"), (error) => error.code === "REPO_BINDING_REQUIRED");
    assert.equal(mounts.forSource("stgmt/omp-spec-kit"), null);
  });

  it("resolves a migrating project read through its previous repository", async () => {
    const dir = await tempDir();
    const project = "stgmt/omp-spec-kit";
    const store = storeWith(project, { status: "migrating", migratedFrom: "file:///old.git", migratedFromBranch: "main" });
    const mounts = new MountManager({ config: config(), cloneDir: dir, store });
    assert.equal(mounts.readableRepo(project).repoUrl, "file:///old.git");
    await assert.rejects(() => mounts.repoFor(project), (error) => error.code === "REPO_BINDING_REQUIRED");
  });

  it("keys a mirror by repository and credential, not by URL alone", async () => {
    const dir = await tempDir();
    const project = "stgmt/omp-spec-kit";
    const other = "acme/other";
    const mounts = new MountManager({
      config: config([project, other]),
      cloneDir: dir,
      store: { getBinding: () => null, getCredential: () => null },
      gitFactory: ({ gitAuth }) => ({ gitAuth }),
    });
    mounts.authFor = (id) => ({ token: id === project ? "token-a" : "token-b" });
    const first = mounts.repoDescriptor("https://github.com/stgmt/repo.git", "main", project);
    const second = mounts.repoDescriptor("https://github.com/stgmt/repo.git", "main", other);
    assert.notEqual(first.key, second.key);
    assert.equal(first.git.gitAuth.token, "token-a");
    assert.equal(second.git.gitAuth.token, "token-b");
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

  it("boot reports an unbound project without failing the other projects", async () => {
    const dir = await tempDir();
    const project = "stgmt/omp-spec-kit";
    const mounts = new MountManager({
      config: config([project, "acme/billing"]),
      cloneDir: path.join(dir, "clone"),
      store: { getBinding: (id) => (id === project ? storeWith(project).row : null), getCredential: () => null },
      identity: { name: "spec-bot", email: "bot@example.invalid" },
    });
    mounts.serviceFor = () => ({ ensure: async () => ({ status: "ready" }) });
    mounts.projectRoot = async (id) => {
      if (id === project) return path.join(dir, "root");
      const error = new Error("unbound");
      error.code = "REPO_BINDING_REQUIRED";
      throw error;
    };
    const report = await mounts.boot();
    assert.equal(report[project].graphStatus, "ready");
    assert.deepEqual(report["acme/billing"], { error: "REPO_BINDING_REQUIRED" });
  });

  it("accepts per-project bindings and rejects duplicates", () => {
    const parsed = parseProjectsConfig({
      projects: [{ id: "stgmt/omp-spec-kit" }],
      bindings: [{ project: "stgmt/omp-spec-kit", repoUrl: "file:///tmp/specs.git", tokenEnv: "SPEC_TOKEN" }],
      auth: AUTH,
    });
    assert.deepEqual(parsed.bindings, [{ project: "stgmt/omp-spec-kit", repoUrl: "file:///tmp/specs.git", tokenEnv: "SPEC_TOKEN", username: null }]);
    assert.throws(() => parseProjectsConfig({
      projects: [{ id: "stgmt/omp-spec-kit" }],
      bindings: [{ project: "stgmt/omp-spec-kit", repoUrl: "a" }, { project: "stgmt/omp-spec-kit", repoUrl: "b" }],
      auth: AUTH,
    }), /duplicate binding/u);
    assert.throws(() => parseProjectsConfig({
      projects: [{ id: "stgmt/omp-spec-kit" }],
      bindings: [{ project: "acme/other", repoUrl: "a" }],
      auth: AUTH,
    }), /unconfigured project/u);
  });
});
