import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";
import {
  YouTrackProjectionStore,
  YouTrackSyncStateStore,
  provisionLinkTypes,
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

  it("pointer discovery scans the unbounded listing — a bounded filtered page cannot evict the marker", async () => {
    // SpecId spam (>100 forged pointer rows) must not hide the real marker:
    // the store reads the full project listing rather than a truncated query
    // page whose ordering an attacker can poison.
    const marker = signedMarker({
      schemaVersion: "BoardSnapshotV1",
      complete: true,
      fingerprint: "fp",
      snapshotHash: "sh",
      cardIds: { "demo:TASK-1": "SPEC-2" },
      snapshot: { nodes: [] },
    });
    const spam = Array.from({ length: 150 }, (_, i) => pointerRow(`9-${i}`, { complete: false }));
    const client = fakeClient({ issues: [...spam, pointerRow("3-5", marker)] });
    const committed = await store(client).readCommitted();
    assert.equal(committed.valid, true);
    assert.deepEqual(committed.cardIds, { "demo:TASK-1": "SPEC-2" });
    assert.equal(
      client.calls.some((call) => call[0] === "GET" && call[1].startsWith("/api/issues?query=")),
      false,
      "no bounded query page may stand between the store and the committed marker",
    );
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

  it("publishCommitted defaults to a complete marker when options are omitted", async () => {
    const client = fakeClient({ issues: [] });
    await store(client).publishCommitted(plan());
    const create = client.calls.find((call) => call[0] === "POST" && call[1] === "/api/issues?fields=id,idReadable");
    const marker = JSON.parse(create[2].description.slice("SPEC-SYNC-STATE\n".length));
    assert.equal(marker.complete, true);
    const { signature, ...unsigned } = marker;
    assert.equal(signature, createHmac("sha256", MARKER_SECRET).update(stableJson(unsigned), "utf8").digest("hex"), "default marker must be verifiably signed");
  });

  it("publishCommitted posts a signed complete:false marker when writes were partial", async () => {
    const client = fakeClient({ issues: [] });
    await store(client).publishCommitted(plan(), { cardIds: { "demo:TASK-1": "SPEC-1" }, complete: false });
    const create = client.calls.find((call) => call[0] === "POST" && call[1] === "/api/issues?fields=id,idReadable");
    const marker = JSON.parse(create[2].description.slice("SPEC-SYNC-STATE\n".length));
    assert.equal(marker.complete, false);
    const { signature, ...unsigned } = marker;
    assert.equal(signature, createHmac("sha256", MARKER_SECRET).update(stableJson(unsigned), "utf8").digest("hex"), "partial marker must still be verifiably signed");
  });

  it("a signed partial marker verifies for writeback routing but stays incomplete", async () => {
    const marker = signedMarker({
      schemaVersion: "BoardSnapshotV1",
      complete: false,
      fingerprint: "fp",
      snapshotHash: "sh",
      cardIds: { "demo:TASK-1": "SPEC-1" },
      specProjects: { demo: "demo/stack" },
      snapshot: { nodes: [] },
    });
    const client = fakeClient({ issues: [pointerRow("3-5", marker)] });
    const committed = await store(client).readCommitted();
    assert.equal(committed.valid, true, "authentic partial marker must verify — writeback routes through it");
    assert.equal(committed.complete, false, "completeness is reported, not laundered");
    assert.deepEqual(committed.cardIds, { "demo:TASK-1": "SPEC-1" });
    assert.deepEqual(committed.specProjects, { demo: "demo/stack" });
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

describe("YouTrackProjectionStore card patching", () => {
  it("re-patches State when the tracker-side field was cleared", async () => {
    const existing = {
      id: "3-7",
      idReadable: "SPEC-7",
      summary: "demo:TASK-1 — Task 1",
      description: "",
      customFields: [
        { name: "SpecId", value: "demo:TASK-1" },
        { name: "SpecKind", value: { name: "TASK" } },
        { name: "Type", value: { name: "Task" } },
        { name: "ContentHash", value: "h1" },
        // State is deliberately absent — a manual clear in the tracker is
        // drift like any other and must be re-patched.
      ],
    };
    const client = fakeClient({
      issues: [existing],
      get: (apiPath) => (apiPath.startsWith("/api/admin/projects/") ? [] : null),
    });
    const store = new YouTrackProjectionStore({ client, projectId: "0-0", projectShortName: "SPEC" });
    await store.readProjection();
    await store.upsertCards([
      {
        specId: "demo:TASK-1",
        kind: "TASK",
        typeValue: "Task",
        title: "Task 1",
        excerpt: "x",
        status: "todo",
        contentHash: "h1",
        evidence: null,
      },
    ]);
    const stateCommands = client.calls.filter((call) => call[0] === "COMMAND" && call[1].startsWith("State "));
    assert.equal(stateCommands.length, 1);
    assert.equal(stateCommands[0][1], "State Open");
    assert.deepEqual(stateCommands[0][2], ["3-7"]);
  });
});

describe("provisionLinkTypes direction-label integrity", () => {
  const typeRow = (name, extra = {}) => ({ id: "162-x", name, directed: true, sourceToTarget: name, targetToSource: name + "-back", ...extra });

  it("deletes legacy inverse types under --migrate and relabels colliding directed types in place", async () => {
    const client = fakeClient({
      get: () => [
        typeRow("satisfies", { sourceToTarget: "satisfies", targetToSource: "satisfied by" }),
        { id: "162-5", name: "satisfied-by", directed: true, sourceToTarget: "satisfied by", targetToSource: "satisfies" },
        { id: "162-10", name: "depends-on", directed: true, sourceToTarget: "depends on", targetToSource: "required for" },
      ],
    });
    await provisionLinkTypes(client, { migrate: true, log: () => {} });
    assert.deepEqual(client.calls.filter((c) => c[0] === "DELETE"), [["DELETE", "/api/issueLinkTypes/162-5"]]);
    const relabel = client.calls.find((c) => c[0] === "POST" && c[1] === "/api/issueLinkTypes/162-10?fields=id,name");
    assert.deepEqual(relabel?.[2], { sourceToTarget: "depends-on", targetToSource: "required-by" }, "labels that collide with the stock Depend type are rewritten in place");
    const creates = client.calls.filter((c) => c[0] === "POST" && c[1] === "/api/issueLinkTypes?fields=id,name");
    assert.ok(creates.every((c) => c[2].name !== "satisfied-by"), "inverse-named types are never (re)created");
  });

  it("refuses to drop a legacy inverse type without --migrate", async () => {
    const client = fakeClient({
      get: () => [{ id: "162-5", name: "satisfied-by", directed: true }],
    });
    await assert.rejects(() => provisionLinkTypes(client, { migrate: false, log: () => {} }), /--migrate/);
    assert.equal(client.calls.filter((c) => c[0] === "DELETE").length, 0);
  });

  it("creates all canonical types with unique direction labels on an empty tracker", async () => {
    const expected = {
      satisfies: ["satisfies", "satisfied by"],
      verifies: ["verifies", "verified by"],
      covers: ["covers", "covered by"],
      implements: ["implements", "implemented by"],
      "depends-on": ["depends-on", "required-by"],
      constrains: ["constrains", "constrained by"],
      contains: ["contains", "contained by"],
    };
    const client = fakeClient({ get: () => [] });
    await provisionLinkTypes(client, { log: () => {} });
    const creates = client.calls
      .filter((c) => c[0] === "POST" && c[1] === "/api/issueLinkTypes?fields=id,name")
      .map((c) => c[2]);
    assert.deepEqual(creates.map((c) => c.name).sort(), Object.keys(expected).sort());
    for (const c of creates) {
      assert.equal(c.directed, true, `${c.name} must be directed`);
      assert.deepEqual([c.sourceToTarget, c.targetToSource], expected[c.name]);
    }
    // The accessor collision this whole change exists to prevent: no two
    // types may declare the same direction label.
    const labels = creates.flatMap((c) => [c.sourceToTarget, c.targetToSource]);
    assert.equal(new Set(labels).size, labels.length, "direction labels must be globally unique");
  });

  it("refuses an undirected non-legacy type without --migrate; recreates it directed with", async () => {
    const undirected = [{ id: "162-9", name: "depends-on", directed: false }];
    const refused = fakeClient({ get: () => undirected });
    await assert.rejects(() => provisionLinkTypes(refused, { migrate: false, log: () => {} }), /--migrate/);
    assert.deepEqual(refused.calls.filter((c) => c[0] !== "GET"), [], "no writes without --migrate");

    const migrated = fakeClient({ get: () => undirected });
    await provisionLinkTypes(migrated, { migrate: true, log: () => {} });
    assert.deepEqual(migrated.calls.filter((c) => c[0] === "DELETE"), [["DELETE", "/api/issueLinkTypes/162-9"]]);
    const recreated = migrated.calls.find((c) => c[0] === "POST" && c[1] === "/api/issueLinkTypes?fields=id,name" && c[2].name === "depends-on");
    assert.equal(recreated[2].directed, true);
    assert.deepEqual([recreated[2].sourceToTarget, recreated[2].targetToSource], ["depends-on", "required-by"]);
  });

  it("requests direction labels in the listing — relabel decisions depend on them", async () => {
    // Serve label fields only when the query asks for them: a GET that drops
    // sourceToTarget/targetToSource reads every row as drifted and relabels
    // the world on a clean set.
    const clean = [
      typeRow("satisfies", { sourceToTarget: "satisfies", targetToSource: "satisfied by" }),
      typeRow("verifies", { sourceToTarget: "verifies", targetToSource: "verified by" }),
      typeRow("covers", { sourceToTarget: "covers", targetToSource: "covered by" }),
      typeRow("implements", { sourceToTarget: "implements", targetToSource: "implemented by" }),
      typeRow("depends-on", { sourceToTarget: "depends-on", targetToSource: "required-by" }),
      typeRow("constrains", { sourceToTarget: "constrains", targetToSource: "constrained by" }),
      typeRow("contains", { sourceToTarget: "contains", targetToSource: "contained by" }),
    ];
    const client = fakeClient({
      get: (apiPath) => {
        const rows = apiPath.includes("sourceToTarget") && apiPath.includes("targetToSource")
          ? clean
          : clean.map((row) => ({ id: row.id, name: row.name, directed: row.directed }));
        return rows;
      },
    });
    await provisionLinkTypes(client, { log: () => {} });
    const listCall = client.calls.find((c) => c[0] === "GET");
    assert.ok(listCall[1].includes("sourceToTarget") && listCall[1].includes("targetToSource"), "listing must fetch direction labels");
    assert.deepEqual(client.calls.filter((c) => c[0] !== "GET"), [], "a clean set under a complete listing needs no writes");
  });

  it("implemented-by is refused without --migrate and deleted with it", async () => {
    const legacy = [{ id: "162-7", name: "implemented-by", directed: true, sourceToTarget: "implemented by", targetToSource: "implements" }];
    const refused = fakeClient({ get: () => legacy });
    await assert.rejects(() => provisionLinkTypes(refused, { migrate: false, log: () => {} }), /--migrate/);
    assert.deepEqual(refused.calls.filter((c) => c[0] !== "GET"), [], "no writes without --migrate");

    const migrated = fakeClient({ get: () => legacy });
    const logs = [];
    await provisionLinkTypes(migrated, { migrate: true, log: (m) => logs.push(m) });
    assert.deepEqual(migrated.calls.filter((c) => c[0] === "DELETE"), [["DELETE", "/api/issueLinkTypes/162-7"]]);
    assert.ok(logs.some((m) => m.includes("implemented-by")), "delete op logged");
  });

  it("leaves a clean directed type set untouched", async () => {
    const clean = [
      typeRow("satisfies", { sourceToTarget: "satisfies", targetToSource: "satisfied by" }),
      typeRow("verifies", { sourceToTarget: "verifies", targetToSource: "verified by" }),
      typeRow("covers", { sourceToTarget: "covers", targetToSource: "covered by" }),
      typeRow("implements", { sourceToTarget: "implements", targetToSource: "implemented by" }),
      typeRow("depends-on", { sourceToTarget: "depends-on", targetToSource: "required-by" }),
      typeRow("constrains", { sourceToTarget: "constrains", targetToSource: "constrained by" }),
      typeRow("contains", { sourceToTarget: "contains", targetToSource: "contained by" }),
    ];
    const client = fakeClient({ get: () => clean });
    await provisionLinkTypes(client, { log: () => {} });
    assert.deepEqual(client.calls.filter((c) => c[0] !== "GET"), []);
  });
});
