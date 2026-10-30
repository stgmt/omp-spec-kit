import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configuredBranch, DEFAULT_SPECS_BRANCH, isValidBranchName } from "../../../src/service/branch-policy.js";

describe("specs branch policy", () => {
  it("accepts ordinary git refs", () => {
    for (const branch of ["main", "specs", "release/v2.9.0", "feature/x-1"]) {
      assert.equal(isValidBranchName(branch), true, branch);
    }
  });

  it("rejects refs git itself refuses or that hide another store", () => {
    for (const branch of ["", "-main", "a..b", "a//b", "a/", ".hidden", "a.lock", "a\\b", "a b", "a@{1}"]) {
      assert.equal(isValidBranchName(branch), false, branch);
    }
  });

  it("defaults to main and returns null for an invalid configured branch", () => {
    assert.equal(configuredBranch({}), DEFAULT_SPECS_BRANCH);
    assert.equal(configuredBranch({ branch: "specs" }), "specs");
    assert.equal(configuredBranch({ branch: "-bad" }), null);
  });
});
