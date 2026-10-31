#!/usr/bin/env node
/**
 * Provision the canonical Spec Stack dashboard for an installed Spec Graph app.
 *
 * Idempotent: finds the dashboard by name, replaces only its `spec-board`
 * embedding, and merges the requested groups into `readSharingSettings`.
 * Works on self-hosted YouTrack with an admin permanent token. This is the
 * headless half of the release delivery contract; the Spec Service page offers
 * the same operation in the browser.
 */
import { parseArgs } from "node:util";
import { YouTrackClient } from "../src/adapters/youtrack-store.js";

const { values } = parseArgs({
  options: {
    host: { type: "string" },
    token: { type: "string" },
    name: { type: "string", default: "Spec Stack" },
    groups: { type: "string", default: "All Users" },
    app: { type: "string", default: "spec-graph-app" },
    widget: { type: "string", default: "spec-board" },
    width: { type: "string", default: "12" },
    height: { type: "string", default: "8" },
    "no-share": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
  strict: true,
});

const host = values.host ?? process.env.YOUTRACK_URL;
const token = values.token ?? process.env.YOUTRACK_TOKEN;
if (!host || !token) {
  console.error("spec-dashboard-setup: provide --host/--token or YOUTRACK_URL/YOUTRACK_TOKEN");
  process.exit(2);
}
const client = new YouTrackClient({ host, token });
const dashboardName = values.name;
const groupNames = values.groups.split(",").map((name) => name.trim()).filter(Boolean);

function fail(message) {
  console.error(`spec-dashboard-setup: ${message}`);
  process.exit(1);
}

async function boardWidget() {
  const apps = (await client.get("/api/admin/apps?fields=id,name,widgets(id,key)&$top=500")) ?? [];
  const list = Array.isArray(apps) ? apps : [];
  const app = list.find((entry) => entry.name === values.app);
  if (!app) fail(`app ${values.app} is not installed`);
  const widget = (app.widgets ?? []).find((entry) => entry.key === values.widget);
  if (!widget) fail(`widget ${values.widget} is not registered on ${values.app}`);
  return widget;
}

async function findDashboard() {
  const rows = (await client.get("/api/dashboards?fields=id,name,owner(id)&$top=200")) ?? [];
  const list = Array.isArray(rows) ? rows : [];
  return list.find((entry) => entry.name === dashboardName) ?? null;
}

async function createDashboard() {
  return client.post("/api/dashboards?fields=id,name", { name: dashboardName });
}

async function ensureWidget(dashboardId, widget) {
  const existing = (await client.get(`/api/dashboards/${dashboardId}/widgets?fields=id,key`)) ?? [];
  for (const entry of (Array.isArray(existing) ? existing : []).filter((row) => row.key === values.widget)) {
    await client.delete(`/api/dashboards/${dashboardId}/widgets/${entry.id}`);
  }
  await client.post(`/api/dashboards/${dashboardId}/widgets`, {
    key: values.widget,
    widget: { id: widget.id },
    x: 0,
    y: 0,
    width: Number(values.width),
    height: Number(values.height),
  });
}

async function share(dashboardId) {
  if (values["no-share"] || groupNames.length === 0) return [];
  const dash = await client.get(
    `/api/dashboards/${dashboardId}?fields=id,name,pinned,isDefault,canEdit,canTransfer,canShare,` +
    "owner(id),widgets(id,key,x,y,width,height,widget(id),settings)," +
    "readSharingSettings(permittedGroups(id,name,ringId),permittedUsers(id))," +
    "updateSharingSettings(permittedGroups(id,name,ringId),permittedUsers(id))",
  );
  const groups = (await client.get("/api/groups?fields=id,name,ringId&$top=500")) ?? [];
  const available = Array.isArray(groups) ? groups : [];
  const wanted = [];
  for (const name of groupNames) {
    const group = available.find((entry) => entry.name === name) ||
      (name === "All Users" ? available.find((entry) => entry.$type === "AllUsersGroup") : null);
    if (!group) fail(`share group not found: ${name}`);
    wanted.push(group);
  }
  const merge = (existing = [], extra = []) => {
    const byId = new Map((existing ?? []).map((entry) => [entry.id, entry]));
    for (const entry of extra) byId.set(entry.id, entry);
    return [...byId.values()].map((entry) => ({
      id: entry.id,
      name: entry.name,
      ringId: entry.ringId,
      icon: entry.icon ?? null,
    }));
  };
  const readGroups = merge(dash.readSharingSettings?.permittedGroups, wanted);
  const body = {
    id: dash.id,
    name: dash.name,
    pinned: dash.pinned,
    isDefault: dash.isDefault,
    canEdit: dash.canEdit,
    canTransfer: dash.canTransfer,
    canShare: dash.canShare,
    owner: { id: dash.owner?.id },
    widgets: (dash.widgets ?? []).map((widget) => ({
      id: widget.id,
      key: widget.key,
      x: widget.x,
      y: widget.y,
      width: widget.width,
      height: widget.height,
      widget: widget.widget,
      settings: widget.settings,
    })),
    readSharingSettings: {
      permittedGroups: readGroups,
      permittedUsers: (dash.readSharingSettings?.permittedUsers ?? []).map((user) => ({ id: user.id })),
    },
    updateSharingSettings: {
      permittedGroups: (dash.updateSharingSettings?.permittedGroups ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        ringId: group.ringId,
        icon: group.icon ?? null,
      })),
      permittedUsers: (dash.updateSharingSettings?.permittedUsers ?? []).map((user) => ({ id: user.id })),
    },
  };
  await client.post(`/api/dashboards/${dashboardId}`, body);
  return readGroups;
}

const widget = await boardWidget();
let dashboard = await findDashboard();
const created = !dashboard;
if (!dashboard) {
  if (values["dry-run"]) {
    console.log(JSON.stringify({ action: "create", name: dashboardName, widget: widget.key, groups: groupNames }, null, 2));
    process.exit(0);
  }
  dashboard = await createDashboard();
}
if (values["dry-run"]) {
  console.log(JSON.stringify({ action: "update", dashboardId: dashboard.id, name: dashboardName, widget: widget.key, groups: groupNames }, null, 2));
  process.exit(0);
}
await ensureWidget(dashboard.id, widget);
const shared = await share(dashboard.id);
console.log(JSON.stringify({
  ok: true,
  created,
  dashboardId: dashboard.id,
  name: dashboardName,
  widget: values.widget,
  groups: shared.map((group) => group.name),
  url: `${host.replace(/\/+$/, "")}/dashboard?id=${dashboard.id}`,
}, null, 2));
