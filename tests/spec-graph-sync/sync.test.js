import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  YouTrackProjectionService,
  buildProjectionPlan,
  compareProjection,
  desiredDescription,
  desiredSummary,
  parseTaskStatus,
} from "../../src/adapters/youtrack-projection.js";
import { isValidCanonicalId } from "../../src/kernel/identity.js";

function node(canonicalId, kind, title, extra = {}) {
  const [specSlug, localId] = canonicalId.split(":");
  return {
    canonicalId,
    specSlug,
    localId,
    kind,
    title,
    body: extra.body ?? "The body",
    contentHash: "hash-" + localId,
    source: { path: "FR.md", startLine: 1, startColumn: 1, endLine: 2, endColumn: 2 },
    evidence: extra.evidence ?? null,
    taskStatus: extra.taskStatus ?? null,
  };
}

function board(edges = []) {
  return {
    kind: "board",
    schemaVersion: "BoardProjectionV1",
    fingerprint: "f".repeat(64),
    scope: { mode: "corpus", specSlugs: ["demo"] },
    complete: true,
    page: null,
    nodes: [
      node("demo:FR-1", "FUNCTIONAL_REQUIREMENT", "Human requirement"),
      node("demo:AC-1.1", "ACCEPTANCE_CRITERION", "Human criterion"),
      node("demo:TASK-1", "TASK", "Implement thing", { body: "Status: todo\nDone when: it works", taskStatus: "todo" }),
      node("demo:SCENARIO-a", "SCENARIO", "Scenario title"),
      node("demo:NFR-CORE-1", "NON_FUNCTIONAL_REQUIREMENT", "Constraint"),
    ],
    edges,
    counts: { nodes: 5, edges: edges.length, edgeOccurrences: edges.length },
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

describe("YouTrack projection adapter", () => {
  it("parses both plain and bold task status fields", () => {
    assert.equal(parseTaskStatus("Status: done"), "done");
    assert.equal(parseTaskStatus("**Status:** planned"), "planned");
    assert.equal(parseTaskStatus("Status: unknown"), "todo");
  });

  it("maps a complete board DTO to cards and declared link semantics", () => {
    const source = board([
      { from: "demo:FR-1", to: "demo:AC-1.1", type: "REFS", occurrenceCount: 2 },
      { from: "demo:AC-1.1", to: "demo:FR-1", type: "REFS", occurrenceCount: 1 },
      { from: "demo:TASK-1", to: "demo:FR-1", type: "IMPLEMENTS", occurrenceCount: 1 },
      { from: "demo:FR-1", to: "demo:SCENARIO-a", type: "TESTED_BY", occurrenceCount: 1 },
      { from: "demo:AC-1.1", to: "demo:SCENARIO-a", type: "TESTED_BY", occurrenceCount: 1 },
      { from: "demo:TASK-1", to: "demo:NFR-CORE-1", type: "DECLARES", occurrenceCount: 1 },
      { from: "demo:FR-1", to: "demo:AC-1.1", type: "REFS", occurrenceCount: 2 },
    ]);
    const plan = buildProjectionPlan(source);
    assert.deepEqual(plan.issues.map((item) => item.specId), [
      "demo:AC-1.1", "demo:FR-1", "demo:NFR-CORE-1", "demo:SCENARIO-a", "demo:TASK-1",
    ]);
    assert.deepEqual(plan.links, [
      { type: "constrains", source: "demo:NFR-CORE-1", target: "demo:TASK-1" },
      { type: "covers", source: "demo:SCENARIO-a", target: "demo:FR-1" },
      { type: "implements", source: "demo:TASK-1", target: "demo:FR-1" },
      { type: "satisfies", source: "demo:FR-1", target: "demo:AC-1.1" },
      { type: "verifies", source: "demo:SCENARIO-a", target: "demo:AC-1.1" },
    ]);
    assert.equal(plan.snapshot.schemaVersion, "BoardSnapshotV1");
    assert.equal(plan.snapshot.fingerprint, source.fingerprint);
    assert.ok(plan.projectionDigest.length === 64);
  });

  it("skips edges outside the declared mapping table instead of guessing", () => {
    const plan = buildProjectionPlan(board([
      { from: "demo:FR-1", to: "demo:NFR-CORE-1", type: "REFS", occurrenceCount: 1 },
      { from: "demo:FR-1", to: "demo:TASK-1", type: "IMPLEMENTS", occurrenceCount: 1 },
    ]));
    assert.deepEqual(plan.links, []);
    assert.equal(plan.skippedLinks, 2);
  });

  it("detects card and link drift instead of trusting fingerprint alone", () => {
    const plan = buildProjectionPlan(board());
    const actual = { issues: plan.issues.map(card), links: [] };
    assert.deepEqual(compareProjection(actual, plan), { equal: true, reason: "PARITY" });
    const drifted = { issues: actual.issues.map((item) => ({ ...item })), links: [] };
    drifted.issues[0] = { ...drifted.issues[0], summary: "drift" };
    assert.equal(compareProjection(drifted, plan).reason, "CARD_DRIFT");
  });

  it("normalizes inverse-named link types to the canonical relation", () => {
    const plan = buildProjectionPlan(board([
      { from: "demo:TASK-1", to: "demo:FR-1", type: "IMPLEMENTS", occurrenceCount: 1 },
    ]));
    const actual = {
      issues: plan.issues.map(card),
      links: [{ type: "implemented-by", source: "demo:FR-1", target: "demo:TASK-1" }],
    };
    assert.deepEqual(compareProjection(actual, plan), { equal: true, reason: "PARITY" });
  });

  it("detects physically reversed links as drift", () => {
    const plan = buildProjectionPlan(board([
      { from: "demo:FR-1", to: "demo:AC-1.1", type: "REFS", occurrenceCount: 1 },
    ]));
    const reversed = {
      issues: plan.issues.map(card),
      links: [{ type: "satisfies", source: "demo:AC-1.1", target: "demo:FR-1" }],
    };
    assert.equal(compareProjection(reversed, plan).reason, "LINK_DRIFT");
  });

  it("uses one source read and publishes only after card and link writes", async () => {
    const events = [];
    const plan = buildProjectionPlan(board());
    const sourceReader = { readBoard: async () => { events.push("read-source"); return board(); } };
    const tracker = {
      readProjection: async () => { events.push("read-tracker"); return { issues: [], links: [] }; },
      upsertCards: async () => { events.push("cards"); return { writeCalls: 1 }; },
      reconcileLinks: async () => { events.push("links"); return { writeCalls: 1 }; },
      removeStaleCards: async () => { events.push("stale"); return { writeCalls: 1 }; },
    };
    const syncState = {
      readCommitted: async () => { events.push("read-state"); return { valid: false }; },
      publishCommitted: async () => { events.push("publish"); return { writeCalls: 1 }; },
    };
    const service = new YouTrackProjectionService({ sourceReader, tracker, syncState });
    const result = await service.sync();
    assert.equal(result.outcome, "SYNCED");
    assert.equal(result.writeCalls, 4);
    assert.deepEqual(events, ["read-source", "read-state", "read-tracker", "cards", "links", "stale", "publish"]);
  });
  it("normalizes unknown source task status before tracker projection", () => {
    const source = board();
    source.nodes = source.nodes.map((entry) => entry.kind === "TASK" ? { ...entry, taskStatus: "unknown", body: "No status marker" } : entry);
    const plan = buildProjectionPlan(source);
    assert.equal(plan.issues.find((entry) => entry.specId === "demo:TASK-1").status, "todo");
  });

  it("projects roadmap aggregate nodes with contains links to members", () => {
    const source = board([
      { from: "demo:ROADMAP", to: "demo:FR-1", type: "CONTAINS", occurrenceCount: 1 },
      { from: "demo:ROADMAP", to: "demo:TASK-1", type: "CONTAINS", occurrenceCount: 1 },
    ]);
    source.nodes.push(node("demo:ROADMAP", "ROADMAP", "Roadmap: Demo", { body: "Roadmap spec `demo`." }));
    const plan = buildProjectionPlan(source);
    const roadmap = plan.issues.find((entry) => entry.specId === "demo:ROADMAP");
    assert.equal(isValidCanonicalId(roadmap.canonicalId), true);
    assert.equal(roadmap.kind, "ROADMAP");
    assert.equal(roadmap.typeValue, "Roadmap");
    assert.equal(roadmap.status, null);
    assert.deepEqual(plan.links, [
      { type: "contains", source: "demo:ROADMAP", target: "demo:FR-1" },
      { type: "contains", source: "demo:ROADMAP", target: "demo:TASK-1" },
    ]);
    assert.equal(plan.skippedLinks, 0);
    assert.deepEqual(roadmap.links.contains, ["FR-1", "TASK-1"]);
    assert.deepEqual(plan.issues.find((entry) => entry.specId === "demo:FR-1").links["contained-by"], ["ROADMAP"]);
  });

  it("caps card summaries at the tracker 255-character limit", () => {
    const source = board();
    source.nodes[0] = node("demo:FR-1", "FUNCTIONAL_REQUIREMENT", "x".repeat(512));
    const plan = buildProjectionPlan(source);
    const summary = plan.issues.find((entry) => entry.specId === "demo:FR-1");
    assert.equal(desiredSummary(summary).length, 255);
  });

});
