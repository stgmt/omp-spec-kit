import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";
import {
  YouTrackProjectionStore,
  YouTrackSyncStateStore,
} from "../../scripts/spec-graph-sync.mjs";
import { stableJson, SYNC_STATE_SPEC_ID } from "../../src/adapters/youtrack-projection.js";

const MARKER_SECRET = "store-test-marker-secret-0123456789abcdef";

function issueRow(id, specId, extra = {}) {
  return {
    id,
    idReadable: "SPEC-" + id.split("-")[1],
    summary: specId,
    description: extra.description ?? "",
    customFields: [
      { name: "SpecId", value: specId },
      { name: "SpecKind", value: { name: extra.kind ?? "TASK" } },
    ],
  };
}

function pointerRow(id, marker) {
  return issueRow(id, SYNC_STATE_SPEC_ID, {
    description: marker === null ? "not a marker" : "SPEC-SYNC-STATE\n" + JSON.stringify(marker),
  });
}

function signedMarker(marker) {
  const { signature, ...unsigned } = marker;
  void signature;
  return {
    ...marker,
    signature: createHmac("sha256", MARKER_SECRET).update(stableJson(unsigned), "utf8").digest("hex"),
  };
}

function fakeClient(handlers = {}) {
  const calls = [];
  return {
    calls,
    async get(apiPath) {
      calls.push(["GET", apiPath]);
      if (handlers.get) return handlers.get(apiPath);
      return null;
    },
    async post(apiPath, body) {
      calls.push(["POST", apiPath, body]);
      return handlers.post ? handlers.post(apiPath, body) : { id: "9-1", idReadable: "SPEC-1" };
    },
    async delete(apiPath) {
      calls.push(["DELETE", apiPath]);
      return null;
    },
    async command(query, ids) {
      calls.push(["COMMAND", query, ids]);
      return null;
    },
    async listProjectIssues() {
      return handlers.issues ?? [];
    },
  };
}

describe("YouTrackProjectionStore link reconciliation", () => {
  const cards = [
    issueRow("3-1", "demo:TASK-1"),
    issueRow("3-2", "demo:FR-1", { kind: "FR" }),
  ];

  function clientWith({ linkGroups = {}, linkTypes = [{ id: "7", name: "implements", directed: true }] }) {
    return fakeClient({
      issues: cards,
      get: (apiPath) => {
        if (apiPath.startsWith("/api/admin/projects/")) return [];
        if (apiPath === "/api/issueLinkTypes?fields=id,name,directed") return linkTypes;
        const linkMatch = /^\/api\/issues\/([^/]+)\/links\?/.exec(apiPath);
        if (linkMatch) return linkGroups[linkMatch[1]] ?? [];
        return null;
      },
    });
  }

  it("appends the t direction marker when attaching to directed link types", async () => {
    const client = clientWith({});
    const store = new YouTrackProjectionStore({ client, projectId: "0-0", projectShortName: "SPEC" });
    await store.readProjection();
    await store.reconcileLinks([{ type: "implements", source: "demo:TASK-1", target: "demo:FR-1" }], [], {});
    const attach = client.calls.find((call) => call[0] === "POST" && call[1].includes("/links/"));
    assert.equal(attach[1], "/api/issues/3-2/links/7t/issues?fields=id");
    assert.deepEqual(attach[2], { id: "3-1" });
  });

  it("keeps bare link-type ids for undirected types", async () => {
    const client = clientWith({ linkTypes: [{ id: "7", name: "implements", directed: false }] });
    const store = new YouTrackProjectionStore({ client, projectId: "0-0", projectShortName: "SPEC" });
    await store.readProjection();
    await store.reconcileLinks([{ type: "implements", source: "demo:TASK-1", target: "demo:FR-1" }], [], {});
    const attach = client.calls.find((call) => call[0] === "POST" && call[1].includes("/links/"));
    assert.equal(attach[1], "/api/issues/3-2/links/7/issues?fields=id");
  });

  it("deletes stale links through the t-marked target-side path", async () => {
    const client = clientWith({
      linkGroups: {
        "3-1": [{ linkType: { name: "implements" }, direction: "OUTWARD", issues: [{ id: "3-2" }] }],
        "3-2": [{ linkType: { name: "implements" }, direction: "INWARD", issues: [{ id: "3-1" }] }],
      },
    });
    const store = new YouTrackProjectionStore({ client, projectId: "0-0", projectShortName: "SPEC" });
    await store.readProjection();
    await store.reconcileLinks([], [], {});
    const unlink = client.calls.find((call) => call[0] === "DELETE");
    assert.equal(unlink[1], "/api/issues/3-2/links/7t/issues/3-1");
  });

  it("counts an undirected link once even though both endpoints report it", async () => {
    const client = clientWith({
      linkGroups: {
        "3-1": [{ linkType: { name: "implements" }, direction: "BOTH", issues: [{ id: "3-2" }] }],
        "3-2": [{ linkType: { name: "implements" }, direction: "BOTH", issues: [{ id: "3-1" }] }],
      },
    });
    const store = new YouTrackProjectionStore({ client, projectId: "0-0", projectShortName: "SPEC" });
    const actual = await store.readProjection();
    assert.equal(actual.links.length, 1);
    assert.deepEqual(
      [actual.links[0].sourceIssueId, actual.links[0].targetIssueId].sort(),
      ["3-1", "3-2"],
    );
  });
});

describe("YouTrackSyncStateStore marker integrity", () => {
  function store(client) {
    return new YouTrackSyncStateStore({ client, projectId: "0-0", projectShortName: "SPEC", markerSecret: MARKER_SECRET });
  }

  function plan() {
    return {
      fingerprint: "f".repeat(64),
      snapshotHash: "s".repeat(64),
      projectionDigest: "d".repeat(64),
      scope: { mode: "corpus", specSlugs: [] },
      snapshot: { nodes: [], edges: [] },
    };
  }

  it("requires a marker secret", () => {
    assert.throws(() => new YouTrackSyncStateStore({ client: {}, projectId: "0-0", projectShortName: "SPEC" }), /marker secret/);
  });

  it("round-trips a signed marker", async () => {
    const marker = signedMarker({ schemaVersion: "BoardSnapshotV1", complete: true, fingerprint: "fp", snapshotHash: "sh", cardIds: { "demo:TASK-1": "SPEC-1" }, snapshot: { nodes: [] } });
    const client = fakeClient({ issues: [pointerRow("3-5", marker)] });
    const committed = await store(client).readCommitted();
    assert.equal(committed.valid, true);
    assert.deepEqual(committed.cardIds, { "demo:TASK-1": "SPEC-1" });
  });

  it("refuses unsigned and wrongly signed markers as committed baselines", async () => {
    const unsigned = pointerRow("3-5", { schemaVersion: "BoardSnapshotV1", complete: true, fingerprint: "fp", snapshotHash: "sh", cardIds: { "demo:TASK-1": "SPEC-99" } });
    const forged = signedMarker({ schemaVersion: "BoardSnapshotV1", complete: true, fingerprint: "fp", snapshotHash: "sh", cardIds: {} });
    forged.signature = "0".repeat(64);
    const client = fakeClient({ issues: [unsigned, pointerRow("3-6", forged)] });
    const committed = await store(client).readCommitted();
    assert.equal(committed.valid, false);
  });

  it("signs published markers and deletes duplicate pointer issues", async () => {
    const stale = pointerRow("3-9", { complete: false });
    const canonical = pointerRow("3-5", null);
    const client = fakeClient({ issues: [stale, canonical] });
    const sync = store(client);
    await sync.readCommitted();
    await sync.publishCommitted(plan(), { cardIds: {} });
    const update = client.calls.find((call) => call[0] === "POST" && call[1] === "/api/issues/3-5?fields=id");
    const marker = JSON.parse(update[2].description.slice("SPEC-SYNC-STATE\n".length));
    assert.equal(typeof marker.signature, "string");
    assert.equal(marker.signature.length, 64);
    assert.deepEqual(client.calls.filter((call) => call[0] === "DELETE").map((call) => call[1]), ["/api/issues/3-9"]);
  });

  it("honors a text-typed SpecId field when creating the pointer", async () => {
    const client = fakeClient({
      issues: [],
      get: (apiPath) => apiPath.startsWith("/api/admin/projects/")
        ? [{ field: { name: "SpecId", fieldType: { valueType: "text" } } }]
        : null,
    });
    await store(client).publishCommitted(plan(), { cardIds: {} });
    const create = client.calls.find((call) => call[0] === "POST" && call[1] === "/api/issues?fields=id,idReadable");
    assert.equal(create[2].customFields[0].$type, "TextIssueCustomField");
    assert.equal(create[2].customFields[0].value.text, SYNC_STATE_SPEC_ID);
  });
});
