import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleRoadmap, mergeRegion } from "../src/kernel/roadmap/assemble.js";

// ── minimal graph helpers ──────────────────────────────────────────────

function node(canonicalId, kind, opts = {}) {
  const [specSlug, localId] = canonicalId.split(":");
  return {
    canonicalId,
    specSlug,
    localId,
    kind,
    title: opts.title ?? localId,
    body: opts.body ?? "",
    attributes: opts.attributes ?? {},
    contentHash: "",
    span: { path: `.specs/${specSlug}/${localId}.md`, startOffset: 0, endOffset: 0 },
    documentKind: kind,
  };
}

function edge(from, to, type) {
  return { edgeId: `${from}-${to}-${type}`, from, to, type, span: { path: "", startOffset: 0, endOffset: 0 } };
}

function graph(nodes, edges) {
  return { nodes, edges, counts: {}, diagnostics: [] };
}

const DOC = `# Roadmap

## Auto-assembled items

<!-- roadmap:auto:start -->
<!-- roadmap:auto:end -->

## Notes
`;

// ── mergeRegion tests ───────────────────────────────────────────────────

describe("mergeRegion", () => {
  it("replaces content between markers", () => {
    const text = `before\n<!-- roadmap:auto:start -->\nold\n<!-- roadmap:auto:end -->\nafter`;
    const result = mergeRegion(text, "new\n");
    assert.ok(result.ok);
    assert.ok(result.content.includes("new"));
    assert.ok(!result.content.includes("old"));
    assert.ok(result.content.startsWith("before"));
    assert.ok(result.content.endsWith("after"));
  });

  it("preserves bytes outside markers", () => {
    const text = `A\n<!-- roadmap:auto:start -->\nX\n<!-- roadmap:auto:end -->\nB`;
    const result = mergeRegion(text, "Y\n");
    assert.ok(result.ok);
    assert.ok(result.content.startsWith("A\n<!-- roadmap:auto:start"));
    assert.ok(result.content.endsWith("roadmap:auto:end -->\nB"));
  });

  it("refuses when start marker is missing", () => {
    const result = mergeRegion("no markers here", "block");
    assert.equal(result.ok, false);
    assert.equal(result.code, "MISSING_MARKERS");
  });

  it("refuses when end marker is missing", () => {
    const text = `<!-- roadmap:auto:start -->\ncontent`;
    const result = mergeRegion(text, "block");
    assert.equal(result.ok, false);
    assert.equal(result.code, "MISSING_MARKERS");
  });

  it("refuses on duplicate start markers", () => {
    const text = `<!-- roadmap:auto:start -->\n<!-- roadmap:auto:start -->\n<!-- roadmap:auto:end -->`;
    const result = mergeRegion(text, "block");
    assert.equal(result.ok, false);
    assert.equal(result.code, "DUPLICATE_MARKERS");
  });

  it("handles empty generated block", () => {
    const text = `<!-- roadmap:auto:start -->\nold\n<!-- roadmap:auto:end -->`;
    const result = mergeRegion(text, "");
    assert.ok(result.ok);
    // The markers are preserved; the region between them is replaced.
    assert.ok(result.content.includes("<!-- roadmap:auto:start -->"));
    assert.ok(result.content.includes("<!-- roadmap:auto:end -->"));
    assert.ok(!result.content.includes("old"));
  });
});

// ── assembleRoadmap tests ───────────────────────────────────────────────

describe("assembleRoadmap", () => {
  it("refuses a non-roadmap spec slug", () => {
    const g = graph([], []);
    const result = assembleRoadmap(g, "spec-mcp-operations", DOC);
    assert.equal(result.ok, false);
    assert.equal(result.code, "NOT_A_ROADMAP_SPEC");
  });

  it("derives scope from IMPLEMENTS edges of roadmap TASKs", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("roadmap-x:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:FR-2", "FUNCTIONAL_REQUIREMENT"),
    ];
    const edges = [
      edge("roadmap-x:TASK-1", "roadmap-x:FR-1", "IMPLEMENTS"),
      edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS"),
    ];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(result.ok);
    assert.deepEqual(result.scope, ["feature-a", "roadmap-x"]);
    // FR-2 has no implementing TASK → planned; FR-1 has one done TASK → done.
    assert.ok(result.content.includes("[done] FR-1"));
    assert.ok(result.content.includes("[planned] FR-2"));
  });

  it("derives FR status as in-progress when some tasks are done and some todo", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("roadmap-x:TASK-2", "TASK", { attributes: { status: "todo" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
    ];
    const edges = [
      edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS"),
      edge("roadmap-x:TASK-2", "feature-a:FR-1", "IMPLEMENTS"),
    ];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(result.ok);
    assert.ok(result.content.includes("[in progress] FR-1"));
  });

  it("derives FR status as planned when no implementing tasks exist", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:FR-2", "FUNCTIONAL_REQUIREMENT"),
    ];
    const edges = [edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS")];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(result.ok);
    assert.ok(result.content.includes("[done] FR-1"));
    assert.ok(result.content.includes("[planned] FR-2"));
  });

  it("collects UC and US items in addition to FRs", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:UC-1", "USE_CASE"),
      node("feature-a:US-1", "USER_STORY"),
    ];
    const edges = [edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS")];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(result.ok);
    assert.ok(result.content.includes("FR-1"));
    assert.ok(result.content.includes("UC-1"));
    assert.ok(result.content.includes("US-1"));
  });

  it("derives UC/US status from COVERS/REFS to FRs", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:UC-1", "USE_CASE"),
    ];
    const edges = [
      edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS"),
      edge("feature-a:UC-1", "feature-a:FR-1", "COVERS"),
    ];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(result.ok);
    assert.ok(result.content.includes("[done] UC-1"));
  });

  it("excludes TASK, SCENARIO, and DOCUMENT nodes from items", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:TASK-1", "TASK"),
      node("feature-a:SCEN-1", "SCENARIO"),
    ];
    const edges = [edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS")];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(result.ok);
    assert.ok(result.content.includes("FR-1"));
    assert.ok(!result.content.includes("TASK-1"));
    assert.ok(!result.content.includes("SCEN-1"));
  });

  it("is idempotent: assembling the output again produces the same content", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:FR-2", "FUNCTIONAL_REQUIREMENT"),
    ];
    const edges = [edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS")];
    const first = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(first.ok);
    const second = assembleRoadmap(graph(nodes, edges), "roadmap-x", first.content);
    assert.ok(second.ok);
    assert.equal(second.content, first.content);
  });

  it("sorts items by code-point order within each spec", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:FR-10", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:FR-2", "FUNCTIONAL_REQUIREMENT"),
    ];
    const edges = [edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS")];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(result.ok);
    const fr1Idx = result.content.indexOf("FR-1 —");
    const fr10Idx = result.content.indexOf("FR-10 —");
    const fr2Idx = result.content.indexOf("FR-2 —");
    assert.ok(fr1Idx < fr10Idx, "FR-1 should come before FR-10");
    assert.ok(fr10Idx < fr2Idx, "FR-10 should come before FR-2 (code-point order)");
  });

  it("refuses when markers are missing from the document", () => {
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
    ];
    const edges = [edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS")];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", "no markers");
    assert.equal(result.ok, false);
    assert.equal(result.code, "MISSING_MARKERS");
  });

  it("derives scope from REFS edges of roadmap FRs too", () => {
    const nodes = [
      node("roadmap-x:FR-1", "FUNCTIONAL_REQUIREMENT"),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
    ];
    const edges = [edge("roadmap-x:FR-1", "feature-a:FR-1", "REFS")];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", DOC);
    assert.ok(result.ok);
    assert.deepEqual(result.scope, ["feature-a"]);
  });

  it("preserves authored content outside the marker region", () => {
    const customDoc = `# My Roadmap\n\nAuthored intro.\n\n<!-- roadmap:auto:start -->\n<!-- roadmap:auto:end -->\n\nAuthored conclusion.\n`;
    const nodes = [
      node("roadmap-x:TASK-1", "TASK", { attributes: { status: "done" } }),
      node("feature-a:FR-1", "FUNCTIONAL_REQUIREMENT"),
    ];
    const edges = [edge("roadmap-x:TASK-1", "feature-a:FR-1", "IMPLEMENTS")];
    const result = assembleRoadmap(graph(nodes, edges), "roadmap-x", customDoc);
    assert.ok(result.ok);
    assert.ok(result.content.includes("Authored intro."));
    assert.ok(result.content.includes("Authored conclusion."));
  });
});
