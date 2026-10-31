import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensureWidget, provisionDashboard } from "../../../scripts/spec-dashboard-setup.mjs";

function fakeYouTrack(overrides = {}) {
  const state = {
    calls: [],
    dashboards: [{ id: "d1", name: "Spec Stack", owner: { id: "u1" } }],
    widgets: [{ id: "old-board", key: "spec-board" }],
    apps: [{ id: "app1", name: "spec-graph-app", widgets: [{ id: "w1", key: "spec-board" }] }],
    groups: [
      { id: "g-all", name: "Everyone", ringId: "ring-all", $type: "AllUsersGroup" },
      { id: "g-readers", name: "spec-readers", ringId: "ring-r" },
    ],
    shareBody: null,
    widgetFailure: null,
    ...overrides,
  };
  const client = {
    async get(url) {
      state.calls.push({ method: "GET", url });
      if (url.startsWith("/api/admin/apps")) return state.apps;
      if (url.startsWith("/api/groups")) {
        assert.match(url, /\$type/u, "the group query must request $type for All Users");
        return state.groups;
      }
      if (/^\/api\/dashboards\?/u.test(url)) return state.dashboards;
      if (/^\/api\/dashboards\/d1\/widgets\?/u.test(url)) return state.widgets;
      if (/^\/api\/dashboards\/d1\?/u.test(url)) {
        const dash = state.dashboards.find((entry) => entry.id === "d1");
        return {
          ...dash,
          pinned: false,
          isDefault: false,
          canEdit: true,
          canTransfer: true,
          canShare: true,
          widgets: state.widgets.map((widget) => ({ ...widget, x: 0, y: 0, width: 12, height: 8, widget: { id: "w1" }, settings: null })),
          readSharingSettings: { permittedGroups: [], permittedUsers: [] },
          updateSharingSettings: { permittedGroups: [], permittedUsers: [] },
        };
      }
      throw new Error(`unexpected GET ${url}`);
    },
    async post(url, body) {
      state.calls.push({ method: "POST", url, body });
      if (url.startsWith("/api/dashboards?fields=")) {
        const created = { id: `d${state.dashboards.length + 1}`, name: body.name, owner: { id: "u1" } };
        state.dashboards.push(created);
        return created;
      }
      if (url === "/api/dashboards/d1/widgets") {
        if (state.widgetFailure === "duplicate") {
          state.widgetFailure = null;
          const error = new Error("widget key already exists");
          error.status = 409;
          throw error;
        }
        if (state.widgetFailure === "unique") {
          state.widgetFailure = null;
          throw new Error("POST /api/dashboards/d1/widgets => 400 {\"error\":\"Bad Request\",\"error_description\":\"'key' should be unique within a dashboard\"}");
        }
        if (state.widgetFailure === "network") {
          state.widgetFailure = null;
          throw new Error("socket hang up");
        }
        state.widgets.push({ id: "new-board", key: body.key });
        return { id: "new-board" };
      }
      if (url === "/api/dashboards/d1") {
        state.shareBody = body;
        return body;
      }
      throw new Error(`unexpected POST ${url}`);
    },
    async delete(url) {
      state.calls.push({ method: "DELETE", url });
      const id = url.split("/").pop();
      state.widgets = state.widgets.filter((widget) => widget.id !== id);
    },
  };
  return { client, state };
}

describe("spec-dashboard-setup", () => {
  it("creates the replacement widget before deleting the previous one", async () => {
    const { client, state } = fakeYouTrack();
    const result = await provisionDashboard({ client });
    assert.equal(result.ok, true);
    assert.equal(result.widgets.atomic, true);
    const firstPost = state.calls.findIndex((call) => call.method === "POST" && call.url.endsWith("/widgets"));
    const firstDelete = state.calls.findIndex((call) => call.method === "DELETE");
    assert.ok(firstPost >= 0 && firstDelete >= 0);
    assert.ok(firstPost < firstDelete, "the new widget must exist before the old one is removed");
  });

  it("resolves All Users by $type when the display name differs", async () => {
    const { client, state } = fakeYouTrack();
    const result = await provisionDashboard({ client, options: { groups: "All Users" } });
    assert.deepEqual(result.groups, ["Everyone"]);
    assert.equal(state.shareBody.readSharingSettings.permittedGroups[0].id, "g-all");
  });

  it("leaves the existing board intact when the widget POST fails for a non-duplicate reason", async () => {
    const { client, state } = fakeYouTrack({ widgetFailure: "network" });
    await assert.rejects(() => provisionDashboard({ client }), /socket hang up/u);
    assert.deepEqual(state.widgets.map((widget) => widget.id), ["old-board"]);
    assert.equal(state.calls.some((call) => call.method === "DELETE"), false);
  });

  it("falls back to delete-then-create only on a duplicate-key refusal", async () => {
    const { client, state } = fakeYouTrack({ widgetFailure: "duplicate" });
    const result = await provisionDashboard({ client });
    assert.equal(result.widgets.atomic, false);
    assert.deepEqual(state.widgets.map((widget) => widget.id), ["new-board"]);
  });

  it("treats YouTrack's unique-key 400 as a duplicate refusal", async () => {
    const { client, state } = fakeYouTrack({ widgetFailure: "unique" });
    const result = await provisionDashboard({ client });
    assert.equal(result.widgets.atomic, false);
    assert.deepEqual(state.widgets.map((widget) => widget.id), ["new-board"]);
  });

  it("does not mutate anything in dry-run mode", async () => {
    const { client, state } = fakeYouTrack({ dashboards: [] });
    const result = await provisionDashboard({ client, options: { dryRun: true } });
    assert.equal(result.action, "create");
    assert.equal(state.calls.some((call) => call.method !== "GET"), false);
  });

  it("ensureWidget is a no-op creation when the board is absent", async () => {
    const { client, state } = fakeYouTrack({ widgets: [] });
    const result = await ensureWidget(client, "d1", { id: "w1", key: "spec-board" }, {});
    assert.deepEqual(result, { created: 1, replaced: 0, atomic: true });
    assert.equal(state.widgets.length, 1);
  });
});
