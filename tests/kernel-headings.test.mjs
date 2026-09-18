import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchDefinitionHeading } from "../src/kernel/parsers/markdown.js";

describe("definition heading matching", () => {
  it("accepts canonical colon and em-dash productions", () => {
    assert.deepEqual(matchDefinitionHeading("TASK", 2, "TASK-1: Do thing"), {
      status: "definition",
      localId: "TASK-1",
      title: "Do thing",
    });
    assert.deepEqual(matchDefinitionHeading("TASK", 2, "TASK-1 — Do thing"), {
      status: "definition",
      localId: "TASK-1",
      title: "Do thing",
    });
  });

  it("accepts the bare acceptance-criterion production", () => {
    assert.deepEqual(matchDefinitionHeading("ACCEPTANCE_CRITERION", 2, "AC-1.1"), {
      status: "definition",
      localId: "AC-1.1",
      title: "AC-1.1",
    });
  });

  it("rejects ID-shaped headings that violate the role grammar for every role stem", () => {
    for (const [role, heading] of [
      ["FUNCTIONAL_REQUIREMENT", "FR-8a: Title"],
      ["NON_FUNCTIONAL_REQUIREMENT", "NFR-1: Title"],
      ["FILE_CHANGE", "FC-2b: Title"],
      ["SCHEMA_ENTITY", "SCHEMA-x: Title"],
    ]) {
      const match = matchDefinitionHeading(role, 2, heading);
      assert.equal(match.status, "rejected", `${role}: ${heading}`);
      assert.equal(match.code, "INVALID_LOCAL_ID", `${role}: ${heading}`);
    }
  });

  it("rejects stem-shaped headings with an unsupported separator", () => {
    const match = matchDefinitionHeading("ACCEPTANCE_CRITERION", 2, "AC-1.1 Title with space");
    assert.equal(match.status, "rejected");
    assert.equal(match.code, "MALFORMED_HEADING");
  });

  it("rejects definition-shaped headings at an unsupported level", () => {
    const match = matchDefinitionHeading("TASK", 3, "TASK-1: Do thing");
    assert.equal(match.status, "rejected");
    assert.equal(match.code, "MALFORMED_HEADING");
    assert.match(match.message, /level 3/);
  });

  it("does not misreport a valid ID as invalid when only the level is wrong", () => {
    const match = matchDefinitionHeading("ACCEPTANCE_CRITERION", 4, "AC-1.1");
    assert.equal(match.status, "rejected");
    assert.equal(match.code, "MALFORMED_HEADING");
    assert.match(match.message, /level 4/);
  });

  it("rejects malformed decision headings via the repaired DEC- stem", () => {
    const match = matchDefinitionHeading("DECISION", 2, "DEC-1 Title without separator");
    assert.equal(match.status, "rejected");
    assert.equal(match.code, "MALFORMED_HEADING");
  });

  it("keeps unrelated headings invisible", () => {
    assert.equal(matchDefinitionHeading("TASK", 3, "Some section"), null);
    assert.equal(matchDefinitionHeading("RISK", 2, "R1 — Title"), null);
    assert.equal(matchDefinitionHeading("DECISION", 2, "D1 — Title"), null);
  });
});
