import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractAttributes } from "../src/kernel/parsers/attributes.js";
import { isValidCanonicalId } from "../src/kernel/identity.js";

describe("kernel field parsing", () => {
  it("parses bulleted strong fields on tasks (`- **Status:**`)", () => {
    const attrs = extractAttributes("TASKS", "TASK", "TASK-1", "t", [
      "- **Status:** done",
      "- **Estimate:** 1",
      "- note line",
    ].join("\n"));
    assert.equal(attrs.status, "done");
    assert.equal(attrs.estimate, "1");
  });

  it("keeps plain bullets as bullets of the current field", () => {
    const attrs = extractAttributes("TASKS", "TASK", "TASK-1", "t", [
      "Status: todo",
      "Done When:",
      "- first",
      "- second",
    ].join("\n"));
    assert.equal(attrs.status, "todo");
    assert.deepEqual(attrs.doneWhen, ["first", "second"]);
  });

  it("accepts the synthetic ROADMAP canonical identity", () => {
    assert.equal(isValidCanonicalId("roadmap-roadmaps:ROADMAP"), true);
  });
});
