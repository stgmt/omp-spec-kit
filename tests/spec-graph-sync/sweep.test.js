import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planStatusSweep, StatusSweepService } from "../../src/adapters/youtrack-status-sweep.js";

function taskNode(canonicalId, taskStatus) {
  return {
    canonicalId,
    specSlug: canonicalId.split(":")[0],
    localId: canonicalId.split(":")[1],
    kind: "TASK",
    title: canonicalId,
    body: "Status: " + taskStatus,
    taskStatus,
    contentHash: "h-" + canonicalId,
    source: { path: "TASKS.md", startLine: 1 },
  };
}

function board(taskStatuses) {
  return {
    schemaVersion: "BoardProjectionV1",
    fingerprint: "f".repeat(64),
    scope: { mode: "corpus", specSlugs: [] },
    complete: true,
    page: null,
    nodes: taskStatuses.map(([id, status]) => taskNode(id, status)),
    edges: [],
    counts: { nodes: taskStatuses.length, edges: 0 },
  };
}

function snapshotFrom(taskStatuses) {
  return { nodes: taskStatuses.map(([id, status]) => taskNode(id, status)) };
}

describe("planStatusSweep three-way merge", () => {
  it("applies tracker changes that happened while spec stayed at the committed state", () => {
    const { plan, warnings } = planStatusSweep({
      board: board([["demo:TASK-1", "todo"]]),
      snapshot: snapshotFrom([["demo:TASK-1", "todo"]]),
      trackerCards: [{ specId: "demo:TASK-1", state: "Fixed", issueId: "3-1" }],
    });
    assert.deepEqual(plan, [{ specId: "demo:TASK-1", status: "done", fromState: "Fixed", issueId: "3-1" }]);
    assert.equal(warnings.length, 0);
  });

  it("lets the spec win when it changed since the committed snapshot", () => {
    const { plan } = planStatusSweep({
      board: board([["demo:TASK-1", "done"]]),
      snapshot: snapshotFrom([["demo:TASK-1", "todo"]]),
      trackerCards: [{ specId: "demo:TASK-1", state: "Open", issueId: "3-1" }],
    });
    assert.equal(plan.length, 0);
  });

  it("warns when both sides diverged from the committed snapshot", () => {
    const { plan, warnings } = planStatusSweep({
      board: board([["demo:TASK-1", "done"]]),
      snapshot: snapshotFrom([["demo:TASK-1", "planned"]]),
      trackerCards: [{ specId: "demo:TASK-1", state: "In Progress", issueId: "3-1" }],
    });
    assert.equal(plan.length, 0);
    assert.equal(warnings[0].reason, "both sides diverged; spec wins");
  });

  it("refuses to let a tracker row rewrite a node that was never committed", () => {
    const { plan, warnings } = planStatusSweep({
      board: board([["demo:TASK-1", "planned"]]),
      snapshot: snapshotFrom([]),
      trackerCards: [{ specId: "demo:TASK-1", state: "Fixed", issueId: "3-1" }],
    });
    assert.equal(plan.length, 0);
    assert.equal(warnings[0].reason, "no committed baseline; spec wins");
  });

  it("never regresses a spec status the tracker cannot represent", () => {
    const { plan, warnings } = planStatusSweep({
      board: board([["demo:TASK-1", "in-progress"]]),
      snapshot: snapshotFrom([["demo:TASK-1", "in-progress"]]),
      trackerCards: [{ specId: "demo:TASK-1", state: "Open", issueId: "3-1" }],
    });
    assert.equal(plan.length, 0);
    assert.equal(warnings[0].reason, "spec status not representable in tracker; spec wins");
  });

  it("lets the spec win when it diverged while the tracker stayed at baseline", () => {
    const { plan, warnings } = planStatusSweep({
      board: board([["demo:TASK-1", "done"]]),
      snapshot: snapshotFrom([["demo:TASK-1", "todo"]]),
      trackerCards: [{ specId: "demo:TASK-1", state: "Open", issueId: "3-1" }],
    });
    assert.equal(plan.length, 0);
    assert.equal(warnings[0].reason, "spec diverged from baseline; spec wins");
  });

  it("ignores unmapped tracker states and matching statuses", () => {
    const { plan, warnings } = planStatusSweep({
      board: board([["demo:TASK-1", "todo"], ["demo:TASK-2", "todo"]]),
      snapshot: snapshotFrom([["demo:TASK-1", "todo"], ["demo:TASK-2", "todo"]]),
      trackerCards: [
        { specId: "demo:TASK-1", state: "Won't fix", issueId: "3-1" },
        { specId: "demo:TASK-2", state: "Open", issueId: "3-2" },
      ],
    });
    assert.equal(plan.length, 0);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].reason, "unmapped tracker state");
  });

  it("replays multiple pending changes in deterministic specId order", () => {
    const { plan } = planStatusSweep({
      board: board([["demo:TASK-9", "todo"], ["demo:TASK-2", "todo"], ["demo:TASK-10", "done"]]),
      snapshot: snapshotFrom([["demo:TASK-9", "todo"], ["demo:TASK-2", "todo"], ["demo:TASK-10", "done"]]),
      trackerCards: [
        { specId: "demo:TASK-9", state: "Fixed", issueId: "3-9" },
        { specId: "demo:TASK-2", state: "Verified", issueId: "3-2" },
        { specId: "demo:TASK-10", state: "Reopened", issueId: "3-10" },
      ],
    });
    assert.deepEqual(plan.map((entry) => entry.specId), ["demo:TASK-2", "demo:TASK-9", "demo:TASK-10"]);
    assert.deepEqual(plan.map((entry) => entry.status), ["done", "done", "todo"]);
  });
});

describe("StatusSweepService", () => {
  function cardIdsFor(cards) {
    const map = {};
    for (const card of cards ?? []) map[card.specId] = card.idReadable ?? card.issueId;
    return map;
  }

  function ports({ boardData, committed, cards, failSpecIds = [] }) {
    const calls = [];
    return {
      calls,
      sourceReader: { readBoard: async () => boardData },
      syncState: { readCommitted: async () => committed },
      tracker: { listTaskCards: async () => cards },
      writeback: {
        setSpecTaskStatus: async ({ specId, status }) => {
          if (failSpecIds.includes(specId)) throw new Error("patch refused " + specId);
          calls.push({ specId, status });
          return { ok: true };
        },
      },
    };
  }

  it("applies pending tracker-driven changes through the governed port", async () => {
    const cards = [{ specId: "demo:TASK-1", state: "Fixed", issueId: "3-1" }];
    const p = ports({
      boardData: board([["demo:TASK-1", "todo"]]),
      committed: { valid: true, snapshot: snapshotFrom([["demo:TASK-1", "todo"]]), cardIds: cardIdsFor(cards) },
      cards,
    });
    const service = new StatusSweepService(p);
    const result = await service.sweep();
    assert.deepEqual(p.calls, [{ specId: "demo:TASK-1", status: "done" }]);
    assert.equal(result.applied.length, 1);
    assert.equal(result.failed.length, 0);
  });

  it("contains per-item failures so one wedged patch never kills the sweep", async () => {
    const cards = [
      { specId: "demo:TASK-1", state: "Fixed", issueId: "3-1" },
      { specId: "demo:TASK-2", state: "Fixed", issueId: "3-2" },
    ];
    const p = ports({
      boardData: board([["demo:TASK-1", "todo"], ["demo:TASK-2", "todo"]]),
      committed: { valid: true, snapshot: snapshotFrom([["demo:TASK-1", "todo"], ["demo:TASK-2", "todo"]]), cardIds: cardIdsFor(cards) },
      cards,
      failSpecIds: ["demo:TASK-1"],
    });
    const service = new StatusSweepService(p);
    const result = await service.sweep();
    assert.equal(result.applied.length, 1);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].specId, "demo:TASK-1");
  });

  it("treats a missing committed pointer as spec-wins for everything", async () => {
    const p = ports({
      boardData: board([["demo:TASK-1", "todo"]]),
      committed: { valid: false },
      cards: [{ specId: "demo:TASK-1", state: "Fixed", issueId: "3-1" }],
    });
    const service = new StatusSweepService(p);
    const result = await service.sweep();
    assert.equal(result.applied.length, 0);
  });

  it("ignores cards the committed snapshot does not own", async () => {
    const p = ports({
      boardData: board([["demo:TASK-1", "todo"]]),
      committed: { valid: true, snapshot: snapshotFrom([["demo:TASK-1", "todo"]]), cardIds: { "demo:TASK-1": "SPEC-9" } },
      cards: [{ specId: "demo:TASK-1", state: "Fixed", issueId: "3-1", idReadable: "SPEC-1" }],
    });
    const service = new StatusSweepService(p);
    const result = await service.sweep();
    assert.equal(result.applied.length, 0);
    assert.equal(p.calls.length, 0);
  });
});
