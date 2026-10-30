import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { GitClient } from "../../../src/service/git.js";
import { discoverSpecBindings, listSpecBranches, readSpecBinding } from "../../../src/service/spec-discovery.js";

const repoUrl = "https://github.com/stgmt/omp-spec-kit";
let dir;
let git;

function run(...args) {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8", windowsHide: true });
}

function writeBranch(branch, binding, files = {}) {
  run("checkout", "-q", "--orphan", branch);
  run("rm", "-rf", "--ignore-unmatch", ".");
  writeFileSync(path.join(dir, ".spec-kit.json"), `${JSON.stringify(binding, null, 2)}\n`);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  run("add", "-A");
  run("commit", "-q", "-m", branch);
}

function bindingFor(spec, overrides = {}) {
  return {
    schema: "omp-spec-kit/spec-binding@1",
    project: "stgmt/omp-spec-kit",
    spec,
    repo: repoUrl,
    branch: `spec-${spec}`,
    ...overrides,
  };
}

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "omp-spec-discovery-"));
  run("init", "-q", "-b", "main");
  run("config", "user.name", "test");
  run("config", "user.email", "test@example.invalid");
  writeFileSync(path.join(dir, "README.md"), "# code\n");
  run("add", "README.md");
  run("commit", "-q", "-m", "main");

  writeBranch("spec-teams-task-sync", bindingFor("teams-task-sync"), {
    ".specs/teams-task-sync/README.md": "# Teams\n",
  });
  writeBranch("spec-blast-radius", bindingFor("blast-radius"));
  writeBranch(
    "spec-broken",
    bindingFor("broken", { project: "owner/.." }),
  );
  run("branch", "spec-teams-task-sync--topic", "spec-teams-task-sync");
  run("checkout", "-q", "main");
  git = new GitClient({ defaultCwd: dir });
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("spec branch discovery", () => {
  it("lists only canonical spec branches", async () => {
    const branches = await listSpecBranches({ git, cwd: dir, refPrefix: "refs/heads" });
    assert.deepEqual(branches.map((entry) => entry.branch).sort(), ["spec-blast-radius", "spec-broken", "spec-teams-task-sync"]);
  });

  it("reads and validates bindings, keeping invalid branches visible", async () => {
    const result = await discoverSpecBindings({ git, cwd: dir, repoUrl, refPrefix: "refs/heads" });
    assert.deepEqual(result.bindings.map((entry) => entry.spec).sort(), ["blast-radius", "teams-task-sync"]);
    assert.equal(result.invalid.length, 1);
    assert.equal(result.invalid[0].branch, "spec-broken");
    assert.match(result.invalid[0].errors.join("; "), /project must be/u);
  });

  it("fails closed when a canonical branch has no metadata", async () => {
    run("checkout", "-q", "--orphan", "spec-no-binding");
    run("rm", "-rf", "--ignore-unmatch", ".");
    writeFileSync(path.join(dir, ".specs-placeholder"), "x");
    run("add", "-A");
    run("commit", "-q", "-m", "no binding");
    run("checkout", "-q", "main");
    try {
      await assert.rejects(readSpecBinding({ git, cwd: dir, branch: "spec-no-binding" }), /no readable/u);
    } finally {
      run("branch", "-D", "spec-no-binding");
    }
  });
});
