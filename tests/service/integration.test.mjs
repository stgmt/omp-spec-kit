import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { bootService } from "../../src/service/index.js";
import { readLiveConfig } from "../e2e/lib/live-fixture.mjs";
import { seedSpecBranch } from "./lib/spec-repo.mjs";

const execFileAsync = promisify(execFile);
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const tempDirs = [];
const stores = [];
after(async () => {
  for (const store of stores) store?.close?.();
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

const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };

async function configFor(base, bare) {
  const configPath = path.join(base, "projects.json");
  const auth = (await readLiveConfig()).auth;
  await writeFile(configPath, JSON.stringify({
    projects: [{ id: "stgmt/alpha" }],
    bindings: [{ project: "stgmt/alpha", repoUrl: bare }],
    tenants: [{ tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" }],
    auth,
  }));
  return configPath;
}

describe("service boot on a local bare remote", () => {
  it("reads every canonical spec branch and reports ready", async () => {
    const base = await tempDir("spec-service-");
    const bare = path.join(base, "specs.git");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
    await seedSpecBranch(bare, { project: "stgmt/alpha", spec: "spec-kernel", sourceDir: FIXTURE_SPEC });
    const cloneDir = path.join(base, "clone");
    const configPath = await configFor(base, bare);

    const { report, mounts, store } = await bootService({ configPath, cloneDir, identity: IDENTITY, logger: () => {} });
    stores.push(store);
    assert.equal(report["stgmt/alpha"].graphStatus, "ready");
    const root = await mounts.resolveProjectRoot("stgmt/alpha");
    assert.equal((await stat(path.join(root, ".specs", "spec-kernel", "README.md"))).isFile(), true);
    assert.equal(await git(bare, ["rev-parse", "--verify", "refs/heads/spec-spec-kernel"]).then(() => true), true);
    // Boot never writes a skeleton commit: the branch is exactly what the
    // operator seeded.
    assert.equal(await git(bare, ["rev-list", "--count", "refs/heads/spec-spec-kernel"]), "1");
  });

  it("second boot is idempotent and clears stale transaction artifacts", async () => {
    const base = await tempDir("spec-service-");
    const bare = path.join(base, "specs.git");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
    await seedSpecBranch(bare, { project: "stgmt/alpha", spec: "spec-kernel", sourceDir: FIXTURE_SPEC });
    const cloneDir = path.join(base, "clone");
    const configPath = await configFor(base, bare);
    const { mounts, store } = await bootService({ configPath, cloneDir, identity: IDENTITY, logger: () => {} });
    stores.push(store);
    const commitsAfterFirst = Number(await git(bare, ["rev-list", "--count", "refs/heads/spec-spec-kernel"]));

    const root = await mounts.resolveProjectRoot("stgmt/alpha");
    const specsDir = path.join(root, ".specs");
    await mkdir(path.join(specsDir, ".omp-spec-kit-staging"), { recursive: true });
    await writeFile(path.join(specsDir, ".omp-spec-kit-write.lock"), JSON.stringify({ pid: 999999999, requestId: "stale" }));

    const { report } = await bootService({ configPath, cloneDir, identity: IDENTITY, store, logger: () => {} });
    assert.equal(report["stgmt/alpha"].graphStatus, "ready");
    await assert.rejects(() => stat(path.join(specsDir, ".omp-spec-kit-write.lock")));
    await assert.rejects(() => stat(path.join(specsDir, ".omp-spec-kit-staging")));
    const commitsAfterSecond = Number(await git(bare, ["rev-list", "--count", "refs/heads/spec-spec-kernel"]));
    assert.equal(commitsAfterSecond, commitsAfterFirst);
  });
});
