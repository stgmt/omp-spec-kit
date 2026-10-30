import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { GitClient } from "../../../src/service/git.js";
import { ensureMirror, ensureWorktree, removeWorktree } from "../../../src/service/spec-checkouts.js";

let root;
let source;
let mirror;
let worktree;
let git;

function run(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

before(() => {
  root = mkdtempSync(path.join(tmpdir(), "omp-spec-checkouts-"));
  source = path.join(root, "source");
  mirror = path.join(root, "mirror.git");
  worktree = path.join(root, "worktrees", "teams-task-sync");
  execFileSync("git", ["init", "-q", "-b", "main", source], { windowsHide: true });
  run(source, "config", "user.name", "test");
  run(source, "config", "user.email", "test@example.invalid");
  writeFileSync(path.join(source, "README.md"), "# code\n");
  run(source, "add", "README.md");
  run(source, "commit", "-q", "-m", "main");
  run(source, "checkout", "-q", "--orphan", "spec-teams-task-sync");
  run(source, "rm", "-rf", "--ignore-unmatch", ".");
  writeFileSync(path.join(source, ".spec-kit.json"), '{"schema":"omp-spec-kit/spec-binding@1"}\n');
  run(source, "add", "-A");
  run(source, "commit", "-q", "-m", "spec");
  run(source, "checkout", "-q", "main");
  git = new GitClient({ defaultCwd: root });
});

after(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
});

describe("per-spec mirror and worktree", () => {
  it("clones a mirror and checks out the spec branch", async () => {
    const created = await ensureMirror({ git, repoUrl: source, mirrorDir: mirror, cwd: root });
    assert.equal(created.created, true);
    const checked = await ensureWorktree({ git, mirrorDir: mirror, worktreeDir: worktree, branch: "spec-teams-task-sync", cwd: root });
    assert.equal(checked.reused, false);
    assert.equal(readFileSync(path.join(worktree, ".spec-kit.json"), "utf8").includes("spec-binding"), true);
  });

  it("reuses an existing worktree on the same branch", async () => {
    const checked = await ensureWorktree({ git, mirrorDir: mirror, worktreeDir: worktree, branch: "spec-teams-task-sync", cwd: root });
    assert.equal(checked.reused, true);
  });

  it("commits in the worktree and pushes back to the source", async () => {
    writeFileSync(path.join(worktree, "README.md"), "# spec change\n");
    run(worktree, "add", "README.md");
    run(worktree, "commit", "-q", "-m", "spec change");
    run(worktree, "push", "-q", "origin", "HEAD:spec-teams-task-sync");
    const log = run(source, "log", "--format=%s", "-1", "spec-teams-task-sync").trim();
    assert.equal(log, "spec change");
  });

  it("removes the worktree", async () => {
    const removed = await removeWorktree({ git, mirrorDir: mirror, worktreeDir: worktree, cwd: root });
    assert.equal(removed.removed, true);
    assert.throws(() => readFileSync(path.join(worktree, ".spec-kit.json")));
  });
});
