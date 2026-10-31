import test from "node:test";
import assert from "node:assert/strict";

// The widget script is a browser module (UMD-style); importing it installs
// `SpecAppDashboard` on the global object.
await import("../../../tools/spec-graph-app/widgets/spec-app/dashboard.js");
const dashboard = globalThis.SpecAppDashboard;

const APP_WIDGET = { id: "w-current", key: "spec-board" };

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function boardWidget(overrides = {}) {
  return {
    id: "old-widget",
    key: "spec-board",
    x: 0,
    y: 0,
    width: 6,
    height: 8,
    widget: { id: "w-stale" },
    ...overrides,
  };
}

/**
 * Stateful fake of the YouTrack REST calls the dashboard code makes.
 * Mutations update the state so a second run observes the first run's writes.
 */
function fakeHost({ dashboard: initialDashboard = null, groups = [{ id: "g-all", name: "All Users" }], rejectDuplicate = false } = {}) {
  const state = {
    dashboard: clone(initialDashboard),
    apps: [{ id: "app-1", name: "spec-graph-app", widgets: [clone(APP_WIDGET)] }],
    groups: clone(groups),
    rejectDuplicate,
    calls: [],
    nextWidget: 1,
  };

  function duplicate() {
    const error = new Error("'key' should be unique within a dashboard");
    error.status = 400;
    return error;
  }

  async function fetchYouTrack(rawUrl, init = {}) {
    const method = init.method ?? "GET";
    const url = new URL(rawUrl, "http://yt.test");
    const pathname = url.pathname;
    state.calls.push({ method, pathname, search: url.search, body: init.body ? clone(init.body) : null });

    if (method === "GET" && pathname === "/admin/apps") return clone(state.apps);
    if (method === "GET" && pathname === "/groups") return clone(state.groups);
    if (method === "GET" && pathname === "/dashboards") {
      return state.dashboard ? [{ id: state.dashboard.id, name: state.dashboard.name }] : [];
    }
    if (method === "POST" && pathname === "/dashboards") {
      state.dashboard = {
        id: "dash-new",
        name: init.body.name,
        widgets: [],
        readSharingSettings: { permittedGroups: [], permittedUsers: [] },
        updateSharingSettings: { permittedGroups: [], permittedUsers: [] },
      };
      return { id: state.dashboard.id, name: state.dashboard.name };
    }
    const dashMatch = /^\/dashboards\/([^/]+)$/u.exec(pathname);
    if (dashMatch && method === "GET") {
      if (!state.dashboard || state.dashboard.id !== dashMatch[1]) throw new Error("dashboard not found");
      return clone(state.dashboard);
    }
    if (dashMatch && method === "POST") {
      if (!state.dashboard || state.dashboard.id !== dashMatch[1]) throw new Error("dashboard not found");
      const body = init.body;
      state.dashboard.readSharingSettings = {
        permittedGroups: clone(body.readSharingSettings?.permittedGroups ?? []),
        permittedUsers: clone(body.readSharingSettings?.permittedUsers ?? []),
      };
      state.dashboard.updateSharingSettings = clone(body.updateSharingSettings ?? state.dashboard.updateSharingSettings);
      return {};
    }
    const widgetsMatch = /^\/dashboards\/([^/]+)\/widgets$/u.exec(pathname);
    if (widgetsMatch && method === "GET") {
      if (!state.dashboard || state.dashboard.id !== widgetsMatch[1]) throw new Error("dashboard not found");
      return clone(state.dashboard.widgets);
    }
    if (widgetsMatch && method === "POST") {
      if (!state.dashboard || state.dashboard.id !== widgetsMatch[1]) throw new Error("dashboard not found");
      const existing = state.dashboard.widgets.filter((entry) => entry.key === init.body.key);
      if (state.rejectDuplicate && existing.length > 0) throw duplicate();
      const created = {
        id: `new-widget-${state.nextWidget++}`,
        key: init.body.key,
        x: init.body.x,
        y: init.body.y,
        width: init.body.width,
        height: init.body.height,
        widget: clone(init.body.widget),
      };
      state.dashboard.widgets.push(created);
      return clone(created);
    }
    const widgetMatch = /^\/dashboards\/([^/]+)\/widgets\/([^/]+)$/u.exec(pathname);
    if (widgetMatch && method === "DELETE") {
      if (!state.dashboard || state.dashboard.id !== widgetMatch[1]) throw new Error("dashboard not found");
      state.dashboard.widgets = state.dashboard.widgets.filter((entry) => entry.id !== widgetMatch[2]);
      return {};
    }
    throw new Error(`unhandled ${method} ${pathname}${url.search}`);
  }

  return { state, host: { fetchYouTrack } };
}

function provisionedDashboard(overrides = {}) {
  return {
    id: "dash-1",
    name: "Spec Stack",
    widgets: [boardWidget({ id: "current-widget", width: 12, widget: { id: APP_WIDGET.id } })],
    readSharingSettings: { permittedGroups: [{ id: "g-all", name: "All Users" }], permittedUsers: [] },
    updateSharingSettings: { permittedGroups: [], permittedUsers: [] },
    ...overrides,
  };
}

function mutations(host) {
  return host.state.calls.filter((call) => call.method !== "GET");
}

test("inspectDashboard distinguishes a healthy board from stale shapes", () => {
  assert.deepEqual(dashboard.inspectDashboard({ widgets: [boardWidget({ width: 12, widget: { id: APP_WIDGET.id } })] }, APP_WIDGET.id).state, "ok");
  assert.deepEqual(dashboard.inspectDashboard({ widgets: [boardWidget()] }, APP_WIDGET.id), {
    state: "stale",
    widgetId: "w-stale",
  });
  assert.deepEqual(dashboard.inspectDashboard({ widgets: [boardWidget({ width: 6, widget: { id: APP_WIDGET.id } })] }, APP_WIDGET.id), {
    state: "wrong-width",
    width: 6,
  });
  assert.deepEqual(
    dashboard.inspectDashboard({ widgets: [boardWidget(), boardWidget({ id: "second" })] }, APP_WIDGET.id),
    { state: "duplicate", count: 2 },
  );
  assert.deepEqual(dashboard.inspectDashboard({ widgets: [] }, APP_WIDGET.id), { state: "missing-widget" });
  assert.deepEqual(dashboard.inspectDashboard(null, APP_WIDGET.id), { state: "missing" });
});

test("checkDashboard is green only for one full-width widget shared with All Users", async () => {
  const healthy = fakeHost({ dashboard: provisionedDashboard() });
  assert.equal((await dashboard.checkDashboard(healthy.host)).status, "ok");

  const stale = fakeHost({ dashboard: provisionedDashboard({ widgets: [boardWidget()] }) });
  const staleHealth = await dashboard.checkDashboard(stale.host);
  assert.equal(staleHealth.status, "warn");
  assert.match(staleHealth.detail, /outdated app widget/u);

  const narrow = fakeHost({ dashboard: provisionedDashboard({ widgets: [boardWidget({ width: 6, widget: { id: APP_WIDGET.id } })] }) });
  assert.match((await dashboard.checkDashboard(narrow.host)).detail, /full width/u);

  const duplicate = fakeHost({
    dashboard: provisionedDashboard({ widgets: [boardWidget({ id: "a", width: 12, widget: { id: APP_WIDGET.id } }), boardWidget({ id: "b", width: 12, widget: { id: APP_WIDGET.id } })] }),
  });
  assert.match((await dashboard.checkDashboard(duplicate.host)).detail, /2 spec-board widgets/u);

  const unshared = fakeHost({ dashboard: provisionedDashboard({ readSharingSettings: { permittedGroups: [] } }) });
  const unsharedHealth = await dashboard.checkDashboard(unshared.host);
  assert.equal(unsharedHealth.status, "warn");
  assert.match(unsharedHealth.detail, /not shared with All Users/u);
});

test("provisionDashboard replaces a stale widget and shares, then is idempotent", async () => {
  const { host, state } = fakeHost({
    dashboard: provisionedDashboard({ widgets: [boardWidget()], readSharingSettings: { permittedGroups: [], permittedUsers: [] } }),
  });

  const first = await dashboard.provisionDashboard(host);
  assert.equal(first.ok, true);
  assert.equal(first.board.changed, true);
  assert.equal(first.share.shared, true);
  assert.equal(first.share.added, true);

  const widgetPost = state.calls.find((call) => call.method === "POST" && /\/widgets$/u.test(call.pathname));
  assert.ok(widgetPost, "a new board widget was posted");
  assert.equal(widgetPost.body.width, 12);
  assert.equal(widgetPost.body.widget.id, APP_WIDGET.id);
  assert.ok(
    state.calls.some((call) => call.method === "DELETE" && call.pathname.endsWith("/widgets/old-widget")),
    "the stale embedding was removed",
  );
  const sharePost = state.calls.find((call) => call.method === "POST" && call.pathname === "/dashboards/dash-1");
  assert.ok(sharePost, "sharing was persisted");
  assert.deepEqual(sharePost.body.readSharingSettings.permittedGroups.map((group) => group.id), ["g-all"]);

  const afterFirst = mutations({ state }).length;
  const second = await dashboard.provisionDashboard(host);
  assert.equal(second.ok, true);
  assert.equal(second.board.changed, false);
  assert.equal(second.share.added, false);
  assert.equal(mutations({ state }).length, afterFirst, "a second run writes nothing");
});

test("provisionDashboard falls back to delete-then-create only on a duplicate-key refusal", async () => {
  const { host, state } = fakeHost({ dashboard: provisionedDashboard({ widgets: [boardWidget()] }), rejectDuplicate: true });
  const result = await dashboard.provisionDashboard(host);
  assert.equal(result.ok, true);
  assert.equal(result.board.atomic, false);
  const writes = state.calls.filter((call) => call.method !== "GET");
  const firstPost = writes.findIndex((call) => call.method === "POST" && /\/widgets$/u.test(call.pathname));
  const deletion = writes.findIndex((call) => call.method === "DELETE");
  const secondPost = writes.findIndex((call, index) => index > firstPost && call.method === "POST" && /\/widgets$/u.test(call.pathname));
  assert.ok(firstPost >= 0 && deletion > firstPost && secondPost > deletion, "refusal -> delete -> create");
});

test("provisionDashboard fails instead of reporting success when All Users is missing", async () => {
  const { host, state } = fakeHost({ dashboard: provisionedDashboard({ readSharingSettings: { permittedGroups: [] } }), groups: [] });
  await assert.rejects(() => dashboard.provisionDashboard(host), /share group not found: All Users/u);
  assert.ok(
    !state.calls.some((call) => call.method === "POST" && call.pathname === "/dashboards/dash-1"),
    "no sharing write was attempted",
  );
});

test("shareDashboard is idempotent when All Users is already permitted", async () => {
  const { host, state } = fakeHost({ dashboard: provisionedDashboard() });
  const result = await dashboard.shareDashboard(host, "dash-1");
  assert.deepEqual(result, { shared: true, added: false, groups: ["All Users"] });
  assert.ok(!state.calls.some((call) => call.method === "POST" && call.pathname === "/dashboards/dash-1"));
});

test("checkSnapshot queries the configured marker project and validates completeness", async () => {
  const calls = [];
  const marker = {
    schemaVersion: "BoardSnapshotV1",
    complete: true,
    snapshot: { schemaVersion: "BoardSnapshotV1", complete: true, page: null, nodes: [], edges: [] },
  };
  const host = {
    fetchYouTrack: async (url) => {
      calls.push(url);
      return [{
        id: "SPEC-1",
        description: `SPEC-SYNC-STATE\n${JSON.stringify(marker)}`,
        customFields: [{ name: "SpecId", value: { text: "SPEC:SYNC-STATE" } }],
      }];
    },
  };
  const health = await dashboard.checkSnapshot(host, { project: "ACME" });
  assert.equal(health.status, "ok");
  assert.match(calls[0], /project%3A%20ACME/u);

  const incomplete = {
    ...marker,
    snapshot: { ...marker.snapshot, complete: false },
  };
  const badHost = {
    fetchYouTrack: async () => [{
      id: "SPEC-1",
      description: `SPEC-SYNC-STATE\n${JSON.stringify(incomplete)}`,
      customFields: [{ name: "SpecId", value: { text: "SPEC:SYNC-STATE" } }],
    }],
  };
  assert.deepEqual(await dashboard.checkSnapshot(badHost, { project: "ACME" }), {
    status: "error",
    detail: "snapshot is incomplete",
  });
});
