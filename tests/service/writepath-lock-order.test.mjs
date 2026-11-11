import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, it } from "node:test";

import { GitClient } from "../../src/service/git.js";
import { createWritePipeline } from "../../src/service/writepath.js";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const SPEC = "demo-spec";
const BRANCH = `spec-${SPEC}`;
const tempDirs = [];

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }).catch(() => {})));
});

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * The write pipeline must not hold the project write lock while it pushes:
 * readers take the same lock, and a slow push otherwise blocks every board
 * read for its whole duration.
 */
it("releases the project write lock before pushing", async () => {
  const base = await tempDir("spec-lock-order-");
  const bare = path.join(base, "specs.git");
  const clone = path.join(base, "clone");
  const root = path.join(base, "root");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  await execFileAsync("git", ["clone", "-q", bare, clone]);
  await mkdir(path.join(root, ".specs", SPEC), { recursive: true });
  await writeFile(path.join(root, ".specs", SPEC, "README.md"), "# demo\n");
  await execFileAsync("git", ["-C", clone, "checkout", "-q", "-b", BRANCH]);
  await git(clone, ["config", "user.email", IDENTITY.email]);
  await git(clone, ["config", "user.name", IDENTITY.name]);
  await writeFile(path.join(clone, "README.md"), "clone\n");
  await git(clone, ["add", "README.md"]);
  await git(clone, ["commit", "-q", "-m", "seed"]);
  await git(clone, ["push", "-q", "-u", "origin", BRANCH]);

  const gitClient = new GitClient({ env: process.env });
  let locked = false;
  const lockEvents = [];
  const pushStates = [];
  const originalPush = gitClient.push.bind(gitClient);
  gitClient.push = async (...args) => {
    pushStates.push(locked);
    return originalPush(...args);
  };
  const mounts = {
    migrating: () => false,
    acquireWriteLock: async () => {
      locked = true;
      lockEvents.push("acquired");
      return () => {
        locked = false;
        lockEvents.push("released");
      };
    },
    worktreeFor: async () => ({ git: gitClient, cwd: clone, branch: BRANCH }),
    projectRoot: async () => root,
    serviceFor: () => ({
      runQuery: async () => ({
        ok: true,
        data: { outcome: "APPLIED", receipt: { proposalHash: "a".repeat(64) } },
      }),
    }),
    refreshProject: async () => {},
  };
  const pipeline = createWritePipeline({ mounts, claims: { get: () => null }, identity: IDENTITY });

  const result = await pipeline.specPatch({
    args: { intent: "patch", spec: SPEC, dryRun: false },
    ctx: { identity: { login: "alice" } },
    project: "stgmt/alpha",
    force: false,
    requestId: "lock-order",
    schemaVersion: "spec-kernel@2",
  });

  assert.equal(result.envelope.ok, true, JSON.stringify(result.envelope).slice(0, 400));
  assert.deepEqual(pushStates, [false], "the push must run with the lock already released");
  assert.deepEqual(lockEvents, ["acquired", "released"]);
  assert.equal(await git(bare, ["rev-parse", "--verify", `refs/heads/${BRANCH}`]).then(() => true), true);
});
