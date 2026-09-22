import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createProjection } from "../../src/service/projection.js";
import {
  PROJECTION_VERSION,
  YouTrackProjectionService,
  buildProjectionPlan,
} from "../../src/adapters/youtrack-projection.js";

const MARKER_SECRET = "test-projection-marker-key-0123456789";

function node(canonicalId, kind, title) {
  const [specSlug, localId] = canonicalId.split(":");
  return {
    canonicalId,
    specSlug,
    localId,
    kind,
    title,
    body: "The body",
    excerpt: "The body",
    contentHash: "hash-" + localId,
    source: { path: "FR.md", startLine: 1, startColumn: 1, endLine: 2, endColumn: 2 },
    evidence: null,
    taskStatus: null,
  };
}

function board(nodes = [node("demo:FR-1", "FUNCTIONAL_REQUIREMENT", "Human requirement")]) {
  return {
    fingerprint: "f".repeat(64),
    scope: { mode: "corpus", specSlugs: ["demo-spec"] },
    complete: true,
    page: null,
    nodes,
    edges: [],
    counts: { nodes: nodes.length, edges: 0 },
  };
}

/** Minimal fake YouTrack: issues live in `state.issues`, marker issue is identified by SpecId. */
function fakeYouTrack(state = {}) {
  state.issues ??= [];
  state.writes ??= 0;
  let nextId = 100;
  const specIdOf = (issue) =>
    (issue.customFields ?? []).find((f) => f.name === "SpecId")?.value?.text ??
    (issue.customFields ?? []).find((f) => f.name === "SpecId")?.value ??
    null;
  const handler = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (method === "GET" && u.pathname === "/api/admin/projects") {
      return json([{ id: "0-1", shortName: "SPEC" }]);
    }
    if (method === "GET" && u.pathname === "/api/issues") {
      return json(state.issues.map((i) => ({ ...i, customFields: i.customFields })));
    }
    if (method === "GET" && u.pathname.startsWith("/api/admin/projects/0-1/customFields")) {
      return json([]);
    }
    if (method === "GET" && u.pathname === "/api/issueLinkTypes") {
      return json([]);
    }
    if (method === "GET" && /\/api\/issues\/[^/]+\/links$/.test(u.pathname)) {
      return json([]);
    }
    if (method === "POST" && u.pathname === "/api/issues") {
      state.writes += 1;
      const issue = { id: `3-${nextId++}`, idReadable: `SPEC-${nextId}`, summary: body.summary, description: body.description, customFields: body.customFields ?? [] };
      state.issues.push(issue);
      return json({ id: issue.id, idReadable: issue.idReadable });
    }
    if (method === "POST" && /\/api\/issues\/[^/]+$/.test(u.pathname)) {
      state.writes += 1;
      const issue = state.issues.find((i) => u.pathname === `/api/issues/${i.id}`);
      if (issue && body?.description !== undefined) issue.description = body.description;
      if (issue && body?.summary !== undefined) issue.summary = body.summary;
      return json({ id: issue?.id });
    }
    if (method === "POST" && u.pathname === "/api/commands") return json({});
    if (method === "DELETE") return json({});
    return json({ error: "unhandled " + method + " " + u.pathname }, 404);
  };
  return { handler, specIdOf, state };
}

function fakeMounts(boardData) {
  return {
    projects: ["demo/stack"],
    serviceFor: () => ({
      runQuery: async (operation, args) =>
        operation === "graph" && args.view === "board" ? { ok: true, data: boardData } : { ok: false, error: { message: "unsupported" } },
    }),
  };
}

describe("service projection", () => {
  it("first sync publishes the committed snapshot marker", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    try {
      const projection = createProjection({
        mounts: fakeMounts(board()),
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      const marker = yt.state.issues.find((i) => (i.description ?? "").startsWith("SPEC-SYNC-STATE"));
      assert.ok(marker, "marker issue was created");
      const parsed = JSON.parse(marker.description.split("\n")[1]);
      assert.equal(parsed.projectionVersion, PROJECTION_VERSION);
      assert.equal(parsed.nodeCount, 1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("unchanged content skips without any tracker writes", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    try {
      const projection = createProjection({
        mounts: fakeMounts(board()),
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      const writesAfterFirst = yt.state.writes;
      await projection.syncOnce();
      assert.equal(yt.state.writes, writesAfterFirst, "second identical sync performed no writes");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a marker with an older projectionVersion is rewritten even on same content", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    try {
      const projection = createProjection({
        mounts: fakeMounts(board()),
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      // Downgrade the stored marker's projectionVersion and re-sign it like
      // an older projector would have.
      const marker = yt.state.issues.find((i) => (i.description ?? "").startsWith("SPEC-SYNC-STATE"));
      const parsed = JSON.parse(marker.description.split("\n")[1]);
      delete parsed.signature;
      parsed.projectionVersion = PROJECTION_VERSION - 1;
      const { createHmac } = await import("node:crypto");
      const { stableJson } = await import("../../src/adapters/youtrack-projection.js");
      parsed.signature = createHmac("sha256", MARKER_SECRET).update(stableJson(parsed), "utf8").digest("hex");
      marker.description = "SPEC-SYNC-STATE\n" + JSON.stringify(parsed);
      const writesBefore = yt.state.writes;
      await projection.syncOnce();
      assert.ok(yt.state.writes > writesBefore, "stale projectionVersion forced a rewrite");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("tracker failure is logged, never thrown", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error("tracker down"));
    try {
      const logs = [];
      const projection = createProjection({
        mounts: fakeMounts(board()),
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
        logger: (m) => logs.push(String(m)),
      });
      await projection.syncOnce();
      assert.ok(logs.some((l) => l.includes("projection sync failed")), "failure surfaced in logs");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("projection skip check", () => {
  it("ignores a pointer whose projectionVersion is behind", async () => {
    const plan = buildProjectionPlan(board());
    const stalePointer = {
      valid: true,
      fingerprint: plan.fingerprint,
      snapshotHash: plan.snapshotHash,
      projectionDigest: plan.projectionDigest,
      projectionVersion: PROJECTION_VERSION - 1,
      cardIds: {},
    };
    const svc = new YouTrackProjectionService({
      sourceReader: { readBoard: async () => board() },
      tracker: {
        readProjection: async () => ({ issues: [], links: [] }),
        upsertCards: async () => ({ writeCalls: 0, cardIds: {} }),
        reconcileLinks: async () => ({ writeCalls: 0 }),
        removeStaleCards: async () => ({ writeCalls: 0 }),
      },
      syncState: {
        readCommitted: async () => stalePointer,
        publishCommitted: async () => ({ writeCalls: 1 }),
      },
    });
    const result = await svc.sync();
    assert.equal(result.outcome, "SYNCED", "stale projectionVersion is never skipped");
  });
});
