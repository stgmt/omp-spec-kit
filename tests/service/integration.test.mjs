import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { bootService } from "../../src/service/index.js";
import { readLiveConfig } from "../e2e/lib/live-fixture.mjs";

const execFileAsync = promisify(execFile);
const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
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

describe("service boot on a local bare remote", () => {
  it("clones, creates the project skeleton as the bot, and reports ready", async () => {
    const base = await tempDir("spec-service-");
    const bare = path.join(base, "specs.git");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
    const cloneDir = path.join(base, "clone");
    const configPath = path.join(base, "projects.json");
    const auth = (await readLiveConfig()).auth;
    await writeFile(configPath, JSON.stringify({ specsRepo: bare, branch: "main", projects: [{ id: "stgmt/alpha" }], tenants: [{ tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" }], auth }));

    const { report } = await bootService({ configPath, cloneDir, identity: IDENTITY, logger: () => {} });
    assert.equal(report["stgmt/alpha"].graphStatus, "ready");
    assert.equal((await stat(path.join(cloneDir, "stgmt", "alpha", ".specs", ".gitkeep"))).isFile(), true);

    const author = await git(bare, ["log", "--format=%an", "main"]);
    const subject = await git(bare, ["log", "--format=%s", "main"]);
    assert.equal(author, "spec-bot");
    assert.equal(subject, "chore: init scope stgmt/alpha");
  });

  it("second boot is idempotent and clears stale transaction artifacts", async () => {
    const base = await tempDir("spec-service-");
    const bare = path.join(base, "specs.git");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
    const cloneDir = path.join(base, "clone");
    const configPath = path.join(base, "projects.json");
    const auth = (await readLiveConfig()).auth;
    await writeFile(configPath, JSON.stringify({ specsRepo: bare, branch: "main", projects: [{ id: "stgmt/alpha" }], tenants: [{ tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" }], auth }));
    await bootService({ configPath, cloneDir, identity: IDENTITY, logger: () => {} });
    const commitsAfterFirst = Number(await git(bare, ["rev-list", "--count", "main"]));

    const root = path.join(cloneDir, "stgmt", "alpha");
    const specsDir = path.join(root, ".specs");
    await mkdir(path.join(specsDir, ".omp-spec-kit-staging"), { recursive: true });
    await writeFile(path.join(specsDir, ".omp-spec-kit-write.lock"), JSON.stringify({ pid: 999999999, requestId: "stale" }));

    const { report } = await bootService({ configPath, cloneDir, identity: IDENTITY, logger: () => {} });
    assert.equal(report["stgmt/alpha"].graphStatus, "ready");
    await assert.rejects(() => stat(path.join(specsDir, ".omp-spec-kit-write.lock")));
    await assert.rejects(() => stat(path.join(specsDir, ".omp-spec-kit-staging")));
    const commitsAfterSecond = Number(await git(bare, ["rev-list", "--count", "main"]));
    assert.equal(commitsAfterSecond, commitsAfterFirst);
  });
});
