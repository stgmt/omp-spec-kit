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
  state.projectId ??= "0-1";
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
      return json(state.failProject ? { error: "gone" } : [{ id: state.projectId, shortName: "SPEC" }], state.failProject ? 404 : 200);
    }
    if (method === "GET" && u.pathname === "/api/issues") {
      if (state.failIssues) return json({ error: "gone" }, 404);
      return json(state.issues.map((i) => ({ ...i, customFields: i.customFields })));
    }
    if (method === "GET" && u.pathname.startsWith(`/api/admin/projects/${state.projectId}/customFields`)) {
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
    if (method === "POST" && u.pathname === "/api/commands") {
      return state.failCommands ? json({ error: "workflow runtime error" }, 500) : json({});
    }
    if (method === "DELETE") return json({});
    return json({ error: "unhandled " + method + " " + u.pathname }, 404);
  };
  return { handler, specIdOf, state };
}

function fakeGit({ head = "h".repeat(40), dirty = false } = {}) {
  return {
    revParse: async () => head,
    statusPorcelain: async () => (dirty ? " M FR.md\n" : ""),
  };
}

function fakeMounts(boardData, { head, dirty, boardReads } = {}) {
  const mount = { git: fakeGit({ head, dirty }), cwd: "/fake" };
  return {
    projects: ["demo/stack"],
    for: () => mount,
    serviceFor: () => ({
      runQuery: async (operation, args) => {
        if (operation === "graph" && args.view === "board") {
          if (boardReads) boardReads.count += 1;
          return { ok: true, data: boardData };
        }
        return { ok: false, error: { message: "unsupported" } };
      },
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
      assert.equal(parsed.mountHeads["demo/stack"], "h".repeat(40), "marker records the mount HEAD the board was built from");
      assert.equal(parsed.mountsClean, true);
      assert.equal(parsed.specProjects["demo-spec"], "demo/stack", "marker maps each spec slug to its serving project");
      assert.deepEqual(parsed.skippedProjects, []);
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

  it("an unbound IdP project does not kill the projection", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    try {
      const mount = { git: fakeGit(), cwd: "/fake" };
      const mounts = {
        projects: ["demo/stack", "ext/tenant"],
        for: (projectId) => {
          if (projectId === "ext/tenant") {
            const error = new Error("project ext/tenant has no specs repository");
            error.code = "REPO_BINDING_REQUIRED";
            throw error;
          }
          return mount;
        },
        serviceFor: (projectId) => {
          if (projectId === "ext/tenant") {
            const error = new Error("project ext/tenant has no specs repository");
            error.code = "REPO_BINDING_REQUIRED";
            throw error;
          }
          return { runQuery: async () => ({ ok: true, data: board() }) };
        },
      };
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      const marker = yt.state.issues.find((i) => (i.description ?? "").startsWith("SPEC-SYNC-STATE"));
      assert.ok(marker, "projection survived the unbound project");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a failed card write publishes an incomplete marker and reports PARTIAL", async () => {
    // /api/commands is where field/state writes land — a 500 there is exactly
    // the live contour failure that used to be certified complete:true. A TASK
    // node forces a `State Fixed` command on every sync.
    const task = { ...node("demo:TASK-1", "TASK", "Do work"), taskStatus: "done" };
    const yt = fakeYouTrack({ failCommands: true });
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    try {
      const projection = createProjection({
        mounts: fakeMounts(board([task])),
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      const last = projection.status().last;
      assert.equal(last.ok, false, "PARTIAL must surface as not-ok for ops");
      assert.equal(last.outcome, "PARTIAL");
      const marker = yt.state.issues.find((i) => (i.description ?? "").startsWith("SPEC-SYNC-STATE"));
      const parsed = JSON.parse(marker.description.split("\n")[1]);
      assert.equal(parsed.complete, false, "failed writes must not be certified complete");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("an incomplete marker never satisfies the cheap path — the retry takes the full sync", async () => {
    // Complete:false carries the same fingerprint/mountHeads; without the
    // completeness gate the very next run would skip and freeze the drift.
    const task = { ...node("demo:TASK-1", "TASK", "Do work"), taskStatus: "done" };
    const yt = fakeYouTrack({ failCommands: true });
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    const boardReads = { count: 0 };
    const mounts = {
      projects: ["demo/stack"],
      for: () => ({ git: fakeGit(), cwd: "/fake" }),
      serviceFor: () => ({
        runQuery: async (operation, args) => {
          if (operation !== "graph" || args.view !== "board") return { ok: false };
          boardReads.count += 1;
          return { ok: true, data: board([task]) };
        },
      }),
    };
    try {
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      assert.equal(boardReads.count, 1);
      await projection.syncOnce();
      assert.equal(boardReads.count, 2, "partial marker must not cheap-skip — the board is rebuilt");
      assert.equal(projection.status().last.outcome, "PARTIAL");
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

describe("projection cheap path", () => {
  it("skips a second run without building the board when mounts are unchanged", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    const boardReads = { count: 0 };
    const mounts = {
      projects: ["demo/stack"],
      for: () => ({ git: fakeGit(), cwd: "/fake" }),
      serviceFor: () => ({
        runQuery: async (operation, args) => {
          if (operation !== "graph" || args.view !== "board") return { ok: false };
          boardReads.count += 1;
          return { ok: true, data: board() };
        },
      }),
    };
    try {
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      assert.equal(boardReads.count, 1);
      const writesAfterFirst = yt.state.writes;
      await projection.syncOnce();
      assert.equal(boardReads.count, 1, "matching mountHeads on a clean clone skips the board build");
      assert.equal(yt.state.writes, writesAfterFirst, "the cheap path issues no tracker writes at all");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a dirty clone falls through to the full sync and the marker records it", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    const boardReads = { count: 0 };
    const mounts = {
      projects: ["demo/stack"],
      for: () => ({ git: fakeGit({ dirty: true }), cwd: "/fake" }),
      serviceFor: () => ({
        runQuery: async (operation, args) => {
          if (operation !== "graph" || args.view !== "board") return { ok: false };
          boardReads.count += 1;
          return { ok: true, data: board() };
        },
      }),
    };
    try {
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      await projection.syncOnce();
      assert.equal(boardReads.count, 2, "dirty mount forces the board build");
      const marker = yt.state.issues.find((i) => (i.description ?? "").startsWith("SPEC-SYNC-STATE"));
      const parsed = JSON.parse(marker.description.split("\n")[1]);
      assert.equal(parsed.mountsClean, false, "marker records the dirty state honestly");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a mount that moves between HEAD read and board read fails the sync instead of certifying unseen content", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    let call = 0;
    const mount = {
      git: {
        // First revParse returns the old head, the verification call a new one —
        // the shape of a commit+push landing inside the board read.
        revParse: async () => (call++ === 0 ? "a".repeat(40) : "b".repeat(40)),
        statusPorcelain: async () => "",
      },
      cwd: "/fake",
    };
    const mounts = {
      projects: ["demo/stack"],
      for: () => mount,
      serviceFor: () => ({
        runQuery: async (operation, args) =>
          operation === "graph" && args.view === "board" ? { ok: true, data: board() } : { ok: false },
      }),
    };
    try {
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      const last = projection.status().last;
      assert.equal(last.ok, false);
      assert.match(last.error, /moved mid-read/);
      assert.equal(yt.state.writes, 0, "no marker is published for a board whose mount moved");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("two mounts emitting the same canonicalId fail the sync naming both projects", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    const mount = { git: fakeGit(), cwd: "/fake" };
    const mounts = {
      projects: ["alpha/repo", "beta/repo"],
      for: () => mount,
      serviceFor: () => ({
        runQuery: async (operation, args) =>
          operation === "graph" && args.view === "board"
            ? { ok: true, data: { ...board([node("dup:FR-1", "FUNCTIONAL_REQUIREMENT", "R")]), scope: { mode: "corpus", specSlugs: ["dup"] } } }
            : { ok: false },
      }),
    };
    try {
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      const last = projection.status().last;
      assert.equal(last.ok, false);
      assert.match(last.error, /duplicate spec node dup:FR-1.*served by both alpha\/repo and beta\/repo/);
      assert.equal(yt.state.writes, 0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a 404 on the tracker project resets the cached id and the next sync re-resolves", async () => {
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
      assert.equal(projection.status().last.ok, true);
      // Operator deletes the SPEC project in the tracker: issue reads 404.
      yt.state.failIssues = true;
      await projection.syncOnce();
      assert.equal(projection.status().last.ok, false);
      assert.match(projection.status().last.error, /=> 404/);
      // The project is recreated under a different id — the stale id must not wedge.
      yt.state.projectId = "0-9";
      yt.state.failIssues = false;
      await projection.syncOnce();
      assert.equal(projection.status().last.ok, true, "re-resolved project id recovers the sync");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("two mounts claiming the same spec slug fail the sync instead of misrouting writeback", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    const mount = { git: fakeGit(), cwd: "/fake" };
    const mounts = {
      projects: ["alpha/repo", "beta/repo"],
      for: () => mount,
      // Disjoint node sets — the canonicalId guard does not fire; the slug
      // collision alone must still be fatal.
      serviceFor: (projectId) => ({
        runQuery: async (operation, args) =>
          operation === "graph" && args.view === "board"
            ? {
                ok: true,
                data: {
                  ...board([node(projectId === "alpha/repo" ? "alpha-spec:FR-1" : "beta-spec:FR-1", "FUNCTIONAL_REQUIREMENT", "R")]),
                  scope: { mode: "corpus", specSlugs: ["shared-slug"] },
                },
              }
            : { ok: false },
      }),
    };
    try {
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      const last = projection.status().last;
      assert.equal(last.ok, false);
      assert.match(last.error, /shared-slug.*served by both alpha\/repo and beta\/repo/);
      assert.equal(yt.state.writes, 0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a project flipping from skipped to served fails the cheap check and forces a full sync", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    const demoMount = { git: fakeGit(), cwd: "/fake" };
    const acmeMount = { git: fakeGit(), cwd: "/fake-acme" };
    const acmeBound = { value: false };
    const boardReads = { count: 0 };
    const mounts = {
      projects: ["demo/stack", "acme/unbound"],
      for: (projectId) => {
        if (projectId === "acme/unbound" && !acmeBound.value) {
          const error = new Error("project acme/unbound has no specs repository");
          error.code = "REPO_BINDING_REQUIRED";
          throw error;
        }
        return projectId === "acme/unbound" ? acmeMount : demoMount;
      },
      serviceFor: (projectId) => {
        if (projectId === "acme/unbound" && !acmeBound.value) {
          const error = new Error("project acme/unbound has no specs repository");
          error.code = "REPO_BINDING_REQUIRED";
          throw error;
        }
        return {
          runQuery: async (operation, args) => {
            if (operation !== "graph" || args.view !== "board") return { ok: false };
            boardReads.count += 1;
            const slug = projectId === "acme/unbound" ? "acme-spec" : "demo-spec";
            return {
              ok: true,
              data: {
                ...board([node(slug + ":FR-1", "FUNCTIONAL_REQUIREMENT", "R")]),
                scope: { mode: "corpus", specSlugs: [slug] },
              },
            };
          },
        };
      },
    };
    try {
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      const marker = yt.state.issues.find((i) => (i.description ?? "").startsWith("SPEC-SYNC-STATE"));
      const first = JSON.parse(marker.description.split("\n")[1]);
      assert.deepEqual(first.skippedProjects, ["acme/unbound"]);
      // The tenant binds its repo between syncs — the served/skipped set
      // changed, so mountHeads alone cannot prove freshness.
      acmeBound.value = true;
      const readsAfterFirst = boardReads.count;
      await projection.syncOnce();
      assert.ok(boardReads.count > readsAfterFirst, "served↔skipped transition forces the board build");
      const second = JSON.parse(marker.description.split("\n")[1]);
      assert.deepEqual(Object.keys(second.mountHeads).sort(), ["acme/unbound", "demo/stack"]);
      assert.deepEqual(second.skippedProjects, []);
      assert.equal(second.specProjects["acme-spec"], "acme/unbound");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a moved mount HEAD forces a resync", async () => {
    const yt = fakeYouTrack();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => yt.handler(url, init);
    const head = { value: "h".repeat(40) };
    const boardReads = { count: 0 };
    const mounts = {
      projects: ["demo/stack"],
      for: () => ({ git: { revParse: async () => head.value, statusPorcelain: async () => "" }, cwd: "/fake" }),
      serviceFor: () => ({
        runQuery: async (operation, args) => {
          if (operation !== "graph" || args.view !== "board") return { ok: false };
          boardReads.count += 1;
          return { ok: true, data: board() };
        },
      }),
    };
    try {
      const projection = createProjection({
        mounts,
        baseUrl: "http://yt.test",
        serviceToken: "tok",
        projectShortName: "SPEC",
        markerSecret: MARKER_SECRET,
      });
      await projection.syncOnce();
      head.value = "x".repeat(40);
      await projection.syncOnce();
      assert.equal(boardReads.count, 2, "a HEAD move rebuilds the board");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("status() reports the serialized loop state", async () => {
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
      assert.equal(projection.status().running, false);
      assert.equal(projection.status().last, null);
      await projection.syncOnce();
      const status = projection.status();
      assert.equal(status.last.ok, true);
      assert.equal(status.last.outcome, "SYNCED");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
