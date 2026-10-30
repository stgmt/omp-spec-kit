import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindingKey,
  isCanonicalSpecBranch,
  parseSpecBranch,
  specBranchName,
  specWorkBranchName,
  validateSpecBinding,
} from "../../../src/service/spec-binding.js";

const valid = {
  schema: "omp-spec-kit/spec-binding@1",
  project: "stgmt/omp-spec-kit",
  spec: "teams-task-sync",
  repo: "https://github.com/stgmt/omp-spec-kit",
  branch: "spec-teams-task-sync",
};

describe("spec branch names", () => {
  it("builds canonical and work branch names", () => {
    assert.equal(specBranchName("teams-task-sync"), "spec-teams-task-sync");
    assert.equal(specWorkBranchName("teams-task-sync", "retry-policy"), "spec-teams-task-sync--retry-policy");
  });

  it("parses canonical and work branches", () => {
    assert.deepEqual(parseSpecBranch("spec-teams-task-sync"), { kind: "spec", slug: "teams-task-sync", topic: null });
    assert.deepEqual(parseSpecBranch("spec-teams-task-sync--retry-policy"), { kind: "work", slug: "teams-task-sync", topic: "retry-policy" });
    assert.equal(isCanonicalSpecBranch("spec-teams-task-sync"), true);
    assert.equal(isCanonicalSpecBranch("spec-teams-task-sync--retry-policy"), false);
  });

  it("rejects everything that is not a spec branch", () => {
    for (const name of ["main", "specs-database", "spec-", "spec-Teams", "spec-a..b", "spec-a/b/c", "spec-a/", "spec-a--b--c", "spec-a--"]) {
      assert.equal(parseSpecBranch(name), null, name);
    }
  });

  it("refuses invalid slugs when building", () => {
    assert.throws(() => specBranchName("Bad Slug"), /invalid spec slug/u);
    assert.throws(() => specWorkBranchName("ok", "Bad Topic"), /invalid spec work topic/u);
  });
});

describe("spec binding validation", () => {
  it("accepts a canonical binding", () => {
    assert.deepEqual(validateSpecBinding(valid, { branch: valid.branch, repoUrl: "https://github.com/stgmt/omp-spec-kit.git" }), { ok: true, errors: [] });
  });

  it("rejects schema, project, spec, branch and repo mismatches", () => {
    const cases = [
      [{ ...valid, schema: "x" }, "schema must be"],
      [{ ...valid, project: "no-slash" }, "project must be"],
      [{ ...valid, project: "owner/.." }, "project must be"],
      [{ ...valid, project: "owner/project." }, "project must be"],
      [{ ...valid, spec: "other" }, "spec and branch disagree"],
      [{ ...valid, branch: "spec-teams-task-sync/topic" }, "branch must be spec-<slug>"],
      [{ ...valid, repo: "https://github.com/other/repo" }, "repo does not match"],
      [{ ...valid, extra: true }, "unknown key"],
    ];
    for (const [binding, reason] of cases) {
      const result = validateSpecBinding(binding, { branch: valid.branch, repoUrl: valid.repo });
      assert.equal(result.ok, false, reason);
      assert.ok(result.errors.some((error) => error.includes(reason)), `${reason}: ${result.errors.join("; ")}`);
    }
  });

  it("compares repo host case-insensitively but keeps the path case-sensitive", () => {
    const binding = { ...valid, repo: "https://GitHub.com/stgmt/omp-spec-kit" };
    assert.equal(validateSpecBinding(binding, { repoUrl: "https://github.com/stgmt/omp-spec-kit" }).ok, true);
    assert.equal(validateSpecBinding(binding, { repoUrl: "https://github.com/stgmt/OMP-SPEC-KIT" }).ok, false);
  });

  it("caps slug and ref length at the git-safe margin", () => {
    assert.throws(() => specBranchName("a".repeat(121)), /too long/u);
    assert.throws(() => specWorkBranchName("ok", "a".repeat(121)), /too long/u);
  });

  it("rejects a binding read from a different ref", () => {
    const result = validateSpecBinding(valid, { branch: "spec-other" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes("branch does not match the ref"));
  });

  it("builds the claim key from project and spec", () => {
    assert.equal(bindingKey("stgmt/omp-spec-kit", "teams-task-sync"), "stgmt/omp-spec-kit/teams-task-sync");
  });
});
