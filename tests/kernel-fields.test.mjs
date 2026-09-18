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

  it("strips trailing parenthetical annotations from task status", () => {
    const attrs = extractAttributes("TASKS", "TASK", "TASK-1", "t", "- **Status:** done (2026-09-13)");
    assert.equal(attrs.status, "done");
  });

  it("still reports unknown for unrecognized statuses with annotations", () => {
    const attrs = extractAttributes("TASKS", "TASK", "TASK-1", "t", "- **Status:** shipped (2026-09-13)");
    assert.equal(attrs.status, "unknown");
  });

  it("normalizes every canonical task status spelling", () => {
    for (const [authored, expected] of [
      ["blocked", "blocked"],
      ["Blocked", "blocked"],
      ["ready", "ready"],
      ["In-progress", "in-progress"],
      ["deferred", "deferred"],
    ]) {
      const attrs = extractAttributes("TASKS", "TASK", "TASK-1", "t", `- **Status:** ${authored}`);
      assert.equal(attrs.status, expected, authored);
    }
  });

  it("accepts the synthetic ROADMAP canonical identity", () => {
    assert.equal(isValidCanonicalId("roadmap-roadmaps:ROADMAP"), true);
  });
});
