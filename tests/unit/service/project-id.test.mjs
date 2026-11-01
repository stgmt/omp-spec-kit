import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidProjectId, projectIdError } from "../../../src/service/project-id.js";

describe("project ids", () => {
  it("accepts owner/project segments", () => {
    for (const id of ["owner/project", "o/p", "a.b/c_d", "A/B"]) {
      assert.equal(isValidProjectId(id), true, id);
    }
  });

  it("rejects traversal, empty segments and extra slashes", () => {
    for (const id of ["owner", "/project", "owner/", "owner/..", ".owner/project", "owner/project.", "owner/project/extra", "owner//project", "owner/ /project", 42]) {
      assert.equal(isValidProjectId(id), false, String(id));
      assert.equal(typeof projectIdError(id), "string");
    }
  });

  it("returns a bounded reason", () => {
    assert.match(projectIdError("owner/.."), /segment is invalid/u);
    assert.match(projectIdError("owner"), /owner\/project/u);
  });
});
