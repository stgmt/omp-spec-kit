import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildKernelGraph, query as kernelQuery } from "../src/kernel/index.js";
import { executeExtendedQuery } from "../src/kernel/query/extended.js";
import { createSpecService } from "../src/adapters/query-service.js";

const file = (spec, name, text) => ({ path: `.specs/${spec}/${name}`, bytes: Buffer.from(text) });

function query(graph, operation, args = {}) {
  const defaults = {
    inventory: { specSlugs: [], includeDocuments: false, limit: 50, cursor: null },
    board: { specSlugs: [] },
    getNode: { projection: "summary", includeIncidentCounts: false },
    findNodes: { specSlugs: [], kinds: [], canonicalIds: [], text: null, projection: "summary", limit: 50, cursor: null },
    trace: { direction: "both", types: [], maxDepth: 2, maxVisited: 100, projection: "summary", limit: 50, cursor: null },
    markdownInventory: { specSlugs: [], mode: "all", focusPath: null, focusAnchor: null, direction: "both", outcomes: [], includeHeadings: true, includeLinks: true, limit: 50, cursor: null },
    validation: { specSlugs: [], severities: [], codes: [], paths: [], limit: 50, cursor: null },
  };
  return kernelQuery(graph, operation, { ...defaults[operation], ...args });
}

function sources(legacyText = "# Legacy story\n\n## US-1 — Original\n") {
  return [
    file("modern", "README.md", "# Modern\n"),
    file("modern", "modern-user-stories.feature", "Feature: Stories\n"),
    file("modern", "modern-use-cases.feature", "Feature: Cases\n"),
    file("modern", "FR.md", "# Requirements\n\n## FR-1 — New requirement\n\nNew requirement body.\n"),
    file("legacy", "README.md", "# Legacy\n"),
    file("legacy", "FR.md", "# Requirements\n\n## FR-1 — Existing requirement\n\nExisting requirement body.\n"),
    file("legacy", "TASKS.md", "# Tasks\n\n## TASK-1 — Existing task\n\n- **Status:** todo\n"),
    file("legacy", "USER_STORIES.md", legacyText),
    file("legacy", "USE_CASES.md", "# Cases\n\n## UC-1 — Original\n"),
    file("legacy", "legacy.feature", "Feature: Old behavior\n\n  Scenario: Old scenario\n    Given old content\n"),
    file("legacy-only", "USER_STORIES.md", "# Stories\n\n## US-1 — Only old source\n"),
  ];
}

const graphFor = (files = sources()) => buildKernelGraph({ files }).graph;

test("mixed corpus preserves nonlegacy entities and discloses incomplete graph reads", () => {
  const graph = graphFor();
  assert.deepEqual(graph.specLayouts.map(({ specSlug, status }) => [specSlug, status]), [
    ["legacy", "legacy"], ["legacy-only", "legacy"], ["modern", "canonical"],
  ]);
  assert.ok(graph.nodes.some((node) => node.canonicalId === "legacy:FR-1"));
  assert.ok(graph.nodes.some((node) => node.canonicalId === "legacy:TASK-1"));
  assert.equal(graph.nodes.some((node) => node.canonicalId === "legacy:US-1"), false);

  const inventory = query(graph, "inventory", { specSlugs: [], includeDocuments: true });
  assert.equal(inventory.ok, true);
  assert.deepEqual(inventory.data.specs.map((row) => row.specSlug), ["legacy", "legacy-only", "modern"]);
  assert.equal(inventory.data.completeness.complete, false);
  assert.deepEqual(inventory.data.completeness.excludedSpecs.map((row) => row.specSlug), ["legacy", "legacy-only"]);
  assert.deepEqual(inventory.data.completeness.excludedKinds, ["USER_STORY", "USE_CASE", "SCENARIO"]);

  const board = query(graph, "board", { specSlugs: [] });
  assert.equal(board.ok, true);
  assert.equal(board.data.complete, false);
  assert.ok(board.data.nodes.some((node) => node.canonicalId === "legacy:FR-1"));
  assert.ok(board.data.nodes.some((node) => node.canonicalId === "legacy:TASK-1"));
  assert.equal(query(graph, "board", { specSlugs: ["modern"] }).data.complete, true);

  const oldStory = query(graph, "getNode", { canonicalId: "legacy:US-1" });
  assert.equal(oldStory.ok, true);
  assert.equal(oldStory.data.kind, "unindexed-legacy-entity");
  assert.equal(oldStory.data.presence, "unknown");
  assert.ok(oldStory.data.sourceDocuments.includes(".specs/legacy/USER_STORIES.md"));
  const missingModern = query(graph, "getNode", { canonicalId: "modern:US-1" });
  assert.equal(missingModern.ok, false);
  assert.equal(missingModern.error.code, "NOT_FOUND");
  assert.equal(query(graph, "trace", { canonicalId: "legacy:UC-1" }).data.presence, "unknown");
  const heading = query(graph, "markdownInventory", { mode: "focus", focusPath: ".specs/legacy/USER_STORIES.md", focusAnchor: "us-1-original" });
  assert.equal(heading.ok, true);
  assert.equal(heading.data.presence, "unknown");
  const anchor = executeExtendedQuery(graph, "validateAnchor", { anchor: ".specs/legacy/USER_STORIES.md#us-1-original" });
  assert.equal(anchor.ok, true);
  assert.equal(anchor.data.registered, null);
  const validation = query(graph, "validation", { specSlugs: ["legacy"] });
  assert.equal(validation.ok, true);
  assert.equal(validation.data.verdict, "INCOMPLETE");
  assert.equal(validation.data.valid, false);
});

test("partial metadata survives pagination and cursors bind legacy bytes", () => {
  const before = graphFor();
  const first = query(before, "findNodes", { specSlugs: [], limit: 1 });
  assert.equal(first.ok, true);
  assert.ok(first.page.nextCursor);
  assert.equal(first.data.completeness.complete, false);
  const second = query(before, "findNodes", { specSlugs: [], limit: 1, cursor: first.page.nextCursor });
  assert.equal(second.ok, true);
  assert.deepEqual(second.data.completeness, first.data.completeness);
  const after = graphFor(sources("# Legacy story\n\n## US-1 — Changed\n"));
  assert.notEqual(after.fingerprint, before.fingerprint);
  const stale = query(after, "findNodes", { specSlugs: [], limit: 1, cursor: first.page.nextCursor });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "STALE_CURSOR");
});

test("archival proof reads succeed without asserting absence across legacy sources", () => {
  const mixed = graphFor();
  for (const spec of ["modern", "legacy", "legacy-only"]) {
    const proof = executeExtendedQuery(mixed, "getArchivalProof", { spec });
    assert.equal(proof.ok, true);
    assert.equal(proof.data.verdict, "INCOMPLETE");
    assert.equal(proof.data.complete, false);
  }
  const modernOnly = graphFor(sources().filter((entry) => entry.path.startsWith(".specs/modern/")));
  const proof = executeExtendedQuery(modernOnly, "getArchivalProof", { spec: "modern" });
  assert.equal(proof.ok, true);
  assert.equal(proof.data.verdict, "ARCHIVE");
  assert.equal(proof.data.complete, true);
});

test("layout completeness is distinct from malformed paired content and README-only source", () => {
  const graph = graphFor([
    file("partial", "README.md", "# partial\n\nStatus: DRAFT\n"),
    file("bad", "bad-user-stories.feature", "Feature: A\n\n  Scenario: broken\n    Or invalid\n"),
    file("bad", "bad-use-cases.feature", "Feature: B\n"),
  ]);
  assert.equal(graph.specLayouts.find((row) => row.specSlug === "partial").status, "incomplete");
  const bad = graph.specLayouts.find((row) => row.specSlug === "bad");
  assert.equal(bad.status, "canonical");
  assert.equal(bad.indexComplete, false);
  const result = query(graph, "getNode", { canonicalId: "bad:US-1" });
  assert.equal(result.ok, true);
  assert.equal(result.data.presence, "unknown");
  assert.equal(result.data.reason, "INVALID_GHERKIN");
});

test("adapter exposes layout and incomplete archival proof for a legacy-only spec", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "spec-mixed-query-"));
  try {
    const directory = path.join(root, ".specs", "only-old");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "USER_STORIES.md"), "# Stories\n\n## US-1 — Original\n");
    const service = createSpecService(root);
    const catalog = await service.runQuery("catalog", { view: "specs" });
    assert.equal(catalog.ok, true);
    assert.deepEqual(catalog.data.specs, ["only-old"]);
    assert.equal(catalog.data.layouts[0].status, "legacy");
    const proof = await service.runQuery("inspect", { check: "archivalProof", spec: "only-old" });
    assert.equal(proof.ok, true);
    assert.equal(proof.data.verdict, "INCOMPLETE");
    assert.equal(proof.graph.complete, false);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
});
