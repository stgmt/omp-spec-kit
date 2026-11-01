import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { CARD_KEY_SEPARATOR, cardKey, compactSnapshot } from "../../../src/adapters/youtrack-projection.js";

const BOARD = {
  fingerprint: "sha256:test",
  complete: true,
  scope: { mode: "corpus", specSlugs: ["alpha-spec", "beta-spec"] },
  nodes: [
    {
      canonicalId: "alpha-spec:FR-1",
      project: "stgmt/alpha",
      specSlug: "alpha-spec",
      localId: "FR-1",
      kind: "FUNCTIONAL_REQUIREMENT",
      title: "Alpha requirement",
    },
    {
      canonicalId: "alpha-spec:FR-1",
      project: "stgmt/beta",
      specSlug: "alpha-spec",
      localId: "FR-1",
      kind: "FUNCTIONAL_REQUIREMENT",
      title: "Beta requirement with the same local id",
    },
  ],
  edges: [
    { from: "alpha-spec:FR-1", to: "alpha-spec:FR-1", project: "stgmt/alpha", type: "VERIFIED_BY" },
    { from: "alpha-spec:FR-1", to: "alpha-spec:FR-1", project: "stgmt/beta", type: "VERIFIED_BY" },
  ],
  counts: { nodes: 2, edges: 2 },
};

describe("board cards carry the server-built key", () => {
  it("gives every node the project-qualified key and keeps equal local ids apart", () => {
    const snapshot = compactSnapshot(BOARD);
    const keys = snapshot.nodes.map((node) => node.key);
    assert.deepEqual(keys, [cardKey("stgmt/alpha", "alpha-spec:FR-1"), cardKey("stgmt/beta", "alpha-spec:FR-1")]);
    assert.equal(new Set(keys).size, 2, "two projects may share a canonical id without sharing a key");
  });

  it("keeps edges to endpoint ids only, and names a project only when it differs", () => {
    const snapshot = compactSnapshot(BOARD);
    // Same-project edges: no repeated endpoint keys, no project — the endpoints
    // already carry both, and the repetition overflowed the description limit.
    for (const edge of snapshot.edges) {
      assert.deepEqual(Object.keys(edge).sort(), ["from", "to", "type"]);
    }
    // An edge whose project owns neither endpoint cannot inherit it.
    const foreign = compactSnapshot({
      ...BOARD,
      edges: [{ from: "alpha-spec:FR-1", to: "alpha-spec:FR-1", project: "stgmt/gamma", type: "VERIFIED_BY" }],
      counts: { nodes: 2, edges: 1 },
    });
    assert.equal(foreign.edges[0].project, "stgmt/gamma");
  });

  it("is the only definition of the key format: no widget re-declares it", async () => {
    const widgets = [
      path.resolve("tools/spec-graph-app/widgets/spec-board/index.html"),
      path.resolve("tools/spec-graph-app/widgets/spec-panel/index.html"),
    ];
    for (const widget of widgets) {
      const source = await readFile(widget, "utf8");
      assert.equal(source.includes(`'${CARD_KEY_SEPARATOR}'`) || source.includes(`"${CARD_KEY_SEPARATOR}"`), false, `${path.basename(path.dirname(widget))} hardcodes the key separator`);
      assert.doesNotMatch(source, /function cardKey\(/u, `${path.basename(path.dirname(widget))} re-implements cardKey`);
    }
  });
});
