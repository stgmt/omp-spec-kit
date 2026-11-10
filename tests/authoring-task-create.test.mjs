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

describe("update_task field shapes", () => {
  it("inserts an Owner line when the task has none", () => {
    const created = applyOperation("# Tasks\n", {
      kind: "create_task",
      document: "TASKS.md",
      entity: "TASK-8",
      subject: "No owner",
      requirements: ["FR-1"],
    });
    const updated = applyOperation(created.text, {
      kind: "update_task",
      document: "TASKS.md",
      entity: "TASK-8",
      owner: "WRITER",
    });
    assert.equal(updated.ok, true);
    assert.match(updated.text, /- \*\*Owner:\*\* WRITER/);
  });

  it("keeps a description that contains a colon", () => {
    const created = applyOperation("# Tasks\n", {
      kind: "create_task",
      document: "TASKS.md",
      entity: "TASK-9",
      subject: "Colon",
      requirements: ["FR-1"],
    });
    const updated = applyOperation(created.text, {
      kind: "update_task",
      document: "TASKS.md",
      entity: "TASK-9",
      description: "Проверено: документы прочитаны",
    });
    assert.equal(updated.ok, true);
    assert.match(updated.text, /- \*\*Done When:\*\* Проверено: документы прочитаны/);
  });

  it("clears an owner without touching the status", () => {
    const created = applyOperation("# Tasks\n", {
      kind: "create_task",
      document: "TASKS.md",
      entity: "TASK-10",
      subject: "Clear",
      requirements: ["FR-1"],
      owner: "WRITER",
      status: "in-progress",
    });
    const updated = applyOperation(created.text, {
      kind: "update_task",
      document: "TASKS.md",
      entity: "TASK-10",
      clearOwner: true,
    });
    assert.equal(updated.ok, true);
    assert.match(updated.text, /- \*\*Status:\*\* in-progress/);
    assert.doesNotMatch(updated.text, /WRITER/);
    assert.match(updated.text, /- \*\*Owner:\*\*/);
  });
});

describe("operation field ownership", () => {
  it("refuses task-only fields on a document operation", async () => {
    const { validateContractArguments, TOOL_CONTRACTS } = await import(
      "../src/adapters/tool-contracts.js"
    );
    const contract = TOOL_CONTRACTS.find((entry) => entry.tool === "spec_patch");
    const base = { intent: "patch", spec: "demo", reason: "r", requestId: "req" };
    const clean = validateContractArguments(contract, {
      ...base,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "x" }],
    });
    const taskField = validateContractArguments(contract, {
      ...base,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "x", owner: "WRITER" }],
    });
    assert.equal(clean.ok, true);
    assert.equal(taskField.ok, false);
  });
});
