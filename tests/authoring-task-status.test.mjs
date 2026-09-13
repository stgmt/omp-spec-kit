import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyOperation } from "../src/authoring/proposals.js";

const TASKS_MD = [
  "# Tasks",
  "",
  "## TASK-10 — Later task",
  "",
  "- **Status:** todo",
  "",
  "## TASK-2 — Middle task",
  "",
  "- **Status:** done",
  "",
  "## TASK-1 — First task",
  "",
  "- **Status:** planned",
  "",
].join("\n");

describe("replace_task_status heading resolution", () => {
  it("matches the exact local id instead of a substring of a longer id", () => {
    const result = applyOperation(TASKS_MD, {
      kind: "replace_task_status",
      document: "TASKS.md",
      entity: "TASK-1",
      status: "done",
    });
    assert.equal(result.ok, true);
    assert.ok(result.text.includes("## TASK-1 — First task\n\n- **Status:** done"));
    assert.ok(result.text.includes("## TASK-10 — Later task\n\n- **Status:** todo"));
  });

  it("fails closed when no heading id matches exactly", () => {
    const result = applyOperation(TASKS_MD, {
      kind: "replace_task_status",
      document: "TASKS.md",
      entity: "TASK-99",
      status: "done",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "VALIDATION_FAILED");
  });

  it("still resolves headings written with a colon suffix", () => {
    const text = TASKS_MD.replace("## TASK-2 — Middle task", "## TASK-2: Middle task");
    const result = applyOperation(text, {
      kind: "replace_task_status",
      document: "TASKS.md",
      entity: "TASK-2",
      status: "todo",
    });
    assert.equal(result.ok, true);
    assert.ok(result.text.includes("## TASK-2: Middle task\n\n- **Status:** todo"));
  });

  it("patches every Status field form the kernel parses, preserving the authored shape", () => {
    const variants = [
      ["Status: todo", "Status: done"],
      ["**Status:** todo", "**Status:** done"],
      ["**Status**: todo", "**Status**: done"],
      ["- **Status:** todo", "- **Status:** done"],
    ];
    for (const [before, after] of variants) {
      const text = ["# Tasks", "", "## TASK-1 — Task", "", before, ""].join("\n");
      const result = applyOperation(text, {
        kind: "replace_task_status",
        document: "TASKS.md",
        entity: "TASK-1",
        status: "done",
      });
      assert.equal(result.ok, true, "status line form not patched: " + before);
      assert.ok(result.text.includes("## TASK-1 — Task\n\n" + after), "form not preserved: " + before);
    }
  });
});
