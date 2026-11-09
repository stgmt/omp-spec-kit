import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyOperation, operationForFacade } from "../src/authoring/proposals.js";

describe("create_task and update_task", () => {
  it("creates one canonical task block with requirements, owner and description", () => {
    const result = applyOperation("# Tasks\n", {
      kind: "create_task",
      document: "TASKS.md",
      entity: "TASK-42",
      subject: "Проверить спеку",
      requirements: ["FR-2", "FR-1", "FR-1"],
      owner: "BALANSER",
      description: "Документы прочитаны",
    });
    assert.equal(result.ok, true);
    assert.match(result.text, /## TASK-42 — Проверить спеку/);
    assert.match(result.text, /- \*\*Status:\*\* todo/);
    assert.match(result.text, /- \*\*Requirements:\*\* FR-1, FR-2/);
    assert.match(result.text, /- \*\*Owner:\*\* BALANSER/);
    assert.match(result.text, /- \*\*Done When:\*\* Документы прочитаны/);
  });

  it("refuses a duplicate entity instead of writing two blocks", () => {
    const first = applyOperation("# Tasks\n", {
      kind: "create_task",
      document: "TASKS.md",
      entity: "TASK-7",
      subject: "One",
      requirements: ["FR-1"],
    });
    const second = applyOperation(first.text, {
      kind: "create_task",
      document: "TASKS.md",
      entity: "TASK-7",
      subject: "Two",
      requirements: ["FR-1"],
    });
    assert.equal(second.ok, false);
    assert.equal(second.code, "CONFLICT");
  });

  it("updates status and owner in place and honours the expected status", () => {
    const created = applyOperation("# Tasks\n", {
      kind: "create_task",
      document: "TASKS.md",
      entity: "TASK-3",
      subject: "Move me",
      requirements: ["FR-1"],
    });
    const moved = applyOperation(created.text, {
      kind: "update_task",
      document: "TASKS.md",
      entity: "TASK-3",
      status: "in-progress",
      owner: "REVIWER",
      expectedStatus: "todo",
    });
    assert.equal(moved.ok, true);
    assert.match(moved.text, /- \*\*Status:\*\* in-progress/);
    assert.match(moved.text, /- \*\*Owner:\*\* REVIWER/);

    const stale = applyOperation(created.text, {
      kind: "update_task",
      document: "TASKS.md",
      entity: "TASK-3",
      status: "done",
      expectedStatus: "done",
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "CONFLICT");
  });

  it("maps the facade intents onto TASKS.md operations", () => {
    const created = operationForFacade("confirmTaskCreation", {
      spec: "demo-spec",
      entity: "TASK-5",
      subject: "From facade",
      requirements: ["FR-1"],
    });
    assert.equal(created.spec, "demo-spec");
    assert.equal(created.operations[0].kind, "create_task");
    assert.equal(created.operations[0].document, "TASKS.md");

    const updated = operationForFacade("updateTask", {
      spec: "demo-spec",
      entity: "TASK-5",
      status: "done",
    });
    assert.equal(updated.operations[0].kind, "update_task");
  });
});
