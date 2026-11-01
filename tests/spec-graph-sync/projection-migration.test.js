import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROJECTION_VERSION,
  buildProjectionPlan,
  desiredDescription,
  desiredSummary,
} from "../../src/adapters/youtrack-projection.js";
import { YouTrackProjectionService } from "../../src/adapters/youtrack-projection.js";

// Checked-in migration fixture: a v7 committed marker for two projects that
// both serve the spec slug `native-task-review` and both own `T-12`. v7 had a
// flat slug -> project map, so that state could only name one owner. The v8
// migration rebuilds both cards from the mounts and republishes per-project
// pointers before the root index points at them.

const A = "team-a";
const B = "team-b";
const SLUG = "native-task-review";

function node(project, localId, kind, extra = {}) {
  return {
    canonicalId: `${SLUG}:${localId}`,
    project,
    specSlug: SLUG,
    localId,
    kind,
    title: `${project} ${localId}`,
    body: extra.body ?? "Status: todo\nDone when: works",
    contentHash: `hash-${project}-${localId}`,
    source: { path: "TASKS.md", startLine: 1, startColumn: 1, endLine: 2, endColumn: 2 },
    evidence: null,
    taskStatus: extra.taskStatus ?? null,
  };
}

function projectBoard(project, taskStatus) {
  const nodes = [
    node(project, "FR-1", "FUNCTIONAL_REQUIREMENT"),
    node(project, "TASK-12", "TASK", { taskStatus }),
  ];
  return {
    kind: "board",
    schemaVersion: "BoardProjectionV1",
    fingerprint: `${project}-fp`,
    scope: { mode: "corpus", specSlugs: [SLUG], project },
    complete: true,
    page: null,
    nodes,
    edges: [{ from: `${SLUG}:TASK-12`, to: `${SLUG}:FR-1`, type: "IMPLEMENTS", occurrenceCount: 1, project }],
    counts: { nodes: 2, edges: 1, edgeOccurrences: 1 },
  };
}

function aggregateBoard() {
  const boards = { [A]: projectBoard(A, "todo"), [B]: projectBoard(B, "done") };
  return {
    kind: "board",
    schemaVersion: "BoardProjectionV1",
    fingerprint: "aggregate-fp",
    scope: { mode: "corpus", specSlugs: [SLUG] },
    complete: true,
    page: null,
    projectBoards: boards,
    nodes: Object.values(boards).flatMap((board) => board.nodes),
    edges: Object.values(boards).flatMap((board) => board.edges),
    counts: { nodes: 4, edges: 2, edgeOccurrences: 2 },
    mountHeads: {},
    mountsClean: true,
    skippedProjects: [],
  };
}

function card(issue) {
  return {
    summary: desiredSummary(issue),
    description: desiredDescription(issue),
    customFields: [
      { name: "SpecId", value: issue.specId },
      { name: "SpecKind", value: issue.kind },
      { name: "Type", value: issue.typeValue },
      { name: "ContentHash", value: issue.contentHash },
      { name: "Evidence", value: issue.evidence },
    ],
  };
}

/** The state a real v7 deployment committed before this cutover. */
function v7Marker() {
  return {
    valid: true,
    complete: true,
    projectionVersion: 7,
    fingerprint: "v7-fingerprint",
    snapshotHash: "v7-snapshot-hash",
    projectionDigest: "v7-projection-digest",
    scope: { mode: "corpus", specSlugs: [SLUG] },
    cardIds: { [`${SLUG}:T-12`]: "SPEC-1" },
    specProjects: { [SLUG]: A },
    projects: [{ id: A, pointer: "SPEC-11" }, { id: B, pointer: "SPEC-12" }],
    snapshot: { schemaVersion: "BoardSnapshotV2", complete: true, page: null, nodes: [], edges: [] },
  };
}

function harness() {
  const order = [];
  const state = {
    committed: v7Marker(),
    pointerPlans: null,
    pointerOptions: null,
    rootPlan: null,
    rootOptions: null,
    writebackRoutes: [],
    upsertCalls: 0,
  };
  let publishedCards = null;
  const syncState = {
    readCommitted: async () => state.committed,
    publishProjectPointers: async (plans, options) => {
      order.push("pointers");
      state.pointerPlans = plans;
      state.pointerOptions = options;
      return {
        writeCalls: 1,
        projects: [
          { id: A, pointer: "SPEC-11", nodeCount: 2, edgeCount: 1 },
          { id: B, pointer: "SPEC-12", nodeCount: 2, edgeCount: 1 },
        ],
        unassigned: null,
        stale: [],
      };
    },
    publishCommitted: async (plan, options) => {
      order.push("root");
      state.rootPlan = plan;
      state.rootOptions = options;
      publishedCards = { issues: plan.issues.map(card), links: plan.links };
      state.committed = {
        valid: true,
        complete: options.complete,
        projectionVersion: plan.projectionVersion,
        fingerprint: plan.fingerprint,
        snapshotHash: plan.snapshotHash,
        projectionDigest: plan.projectionDigest,
        projects: options.projects,
        cardIds: options.cardIds,
        // Stands in for the verified per-project pointer set a real read
        // performs against the tracker.
        projectIndexComplete: options.complete === true,
        snapshot: plan.snapshot,
      };
      return { writeCalls: 1 };
    },
  };
  const tracker = {
    readProjection: async () => publishedCards ?? { issues: [], links: [] },
    upsertCards: async (issues) => {
      state.upsertCalls += 1;
      const cardIds = {};
      for (const issue of issues) cardIds[issue.specId] = "SPEC-" + (Object.keys(cardIds).length + 2);
      return { writeCalls: 0, cardIds, failures: [] };
    },
    reconcileLinks: async () => ({ writeCalls: 0 }),
    removeStaleCards: async (_issues, options) => {
      state.knownSpecIds = options?.knownSpecIds ?? null;
      return { writeCalls: 0 };
    },
  };
  const service = new YouTrackProjectionService({
    sourceReader: { readBoard: async () => aggregateBoard() },
    tracker,
    syncState,
  });
  return { service, state, order };
}

describe("v7 -> v8 projection migration fixture", () => {
  it("rebuilds a v7 marker: complete per-project pointers, root last, qualified cards", async () => {
    const { service, state, order } = harness();
    const first = await service.sync();
    assert.equal(first.outcome, "SYNCED");

    // Root last: the per-project pointers must be published before the root
    // index that names them.
    assert.deepEqual(order, ["pointers", "root"]);

    // Both projects are published, each with its own qualified issues.
    assert.deepEqual(Object.keys(state.pointerPlans).sort(), [A, B]);
    const aIssues = state.pointerPlans[A].issues.map((issue) => issue.specId).sort();
    const bIssues = state.pointerPlans[B].issues.map((issue) => issue.specId).sort();
    assert.deepEqual(aIssues, [`${A}::${SLUG}:FR-1`, `${A}::${SLUG}:TASK-12`]);
    assert.deepEqual(bIssues, [`${B}::${SLUG}:FR-1`, `${B}::${SLUG}:TASK-12`]);
    assert.equal(state.pointerOptions.complete, true);

    // Native task statuses survive the migration: A stays todo, B stays done.
    const statusOf = (plan) => plan.issues.find((issue) => issue.canonicalId === `${SLUG}:TASK-12`).status;
    assert.equal(statusOf(state.pointerPlans[A]), "todo");
    assert.equal(statusOf(state.pointerPlans[B]), "done");

    // Root index is complete, names both pointers, and carries composite cards.
    assert.equal(state.rootOptions.complete, true);
    assert.deepEqual(state.rootOptions.projects, [
      { id: A, pointer: "SPEC-11", nodeCount: 2, edgeCount: 1 },
      { id: B, pointer: "SPEC-12", nodeCount: 2, edgeCount: 1 },
    ]);
    assert.deepEqual(
      Object.keys(state.rootOptions.cardIds).sort(),
      [`${A}::${SLUG}:FR-1`, `${A}::${SLUG}:TASK-12`, `${B}::${SLUG}:FR-1`, `${B}::${SLUG}:TASK-12`],
    );
    assert.equal(state.rootPlan.projectionVersion, PROJECTION_VERSION);
    // The v7 flat map is not carried forward.
    assert.equal("specProjects" in state.rootPlan, false);
    assert.equal("specProjects" in state.committed, false);
  });

  it("converges on a retry: the migrated marker is SKIPPED with no duplicate cards", async () => {
    const { service, state } = harness();
    const first = await service.sync();
    assert.equal(first.outcome, "SYNCED");
    const upsertsAfterFirst = state.upsertCalls;

    const second = await service.sync();
    assert.equal(second.outcome, "SKIPPED");
    assert.equal(state.upsertCalls, upsertsAfterFirst, "a converged retry writes no cards again");
    assert.equal(second.writeCalls, 0);
  });

  it("a failed project-pointer publish never advertises a complete root index", async () => {
    const failing = new YouTrackProjectionService({
      sourceReader: { readBoard: async () => aggregateBoard() },
      tracker: {
        readProjection: async () => ({ issues: [], links: [] }),
        upsertCards: async () => ({ writeCalls: 0, cardIds: {}, failures: [] }),
        reconcileLinks: async () => ({ writeCalls: 0 }),
        removeStaleCards: async () => ({ writeCalls: 0 }),
      },
      syncState: {
        readCommitted: async () => v7Marker(),
        publishProjectPointers: async () => {
          throw new Error("project pointer write failed");
        },
        publishCommitted: async () => {
          throw new Error("root must not be published");
        },
      },
    });
    await assert.rejects(() => failing.sync(), /project pointer write failed/);
  });
});
