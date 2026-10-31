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
import { pathToFileURL } from "node:url";
import { YouTrackClient } from "../src/adapters/youtrack-store.js";

export const DEFAULT_OPTIONS = Object.freeze({
  name: "Spec Stack",
  groups: "All Users",
  app: "spec-graph-app",
  widget: "spec-board",
  width: "12",
  height: "8",
  noShare: false,
  dryRun: false,
});

function optionValues(options = {}) {
  return {
    name: options.name ?? DEFAULT_OPTIONS.name,
    groups: options.groups ?? DEFAULT_OPTIONS.groups,
    app: options.app ?? DEFAULT_OPTIONS.app,
    widget: options.widget ?? DEFAULT_OPTIONS.widget,
    width: options.width ?? DEFAULT_OPTIONS.width,
    height: options.height ?? DEFAULT_OPTIONS.height,
    noShare: options.noShare === true,
    dryRun: options.dryRun === true,
  };
}

function splitGroups(groups) {
  return String(groups).split(",").map((name) => name.trim()).filter(Boolean);
}

/**
 * Resolve the installed app's widget registration. The widget id is what the
 * dashboard embedding references; the key is only the local name.
 */
export async function boardWidget(client, options) {
  const values = optionValues(options);
  const apps = (await client.get("/api/admin/apps?fields=id,name,widgets(id,key)&$top=500")) ?? [];
  const list = Array.isArray(apps) ? apps : [];
  const app = list.find((entry) => entry.name === values.app);
  if (!app) throw new Error(`app ${values.app} is not installed`);
  const widget = (app.widgets ?? []).find((entry) => entry.key === values.widget);
  if (!widget) throw new Error(`widget ${values.widget} is not registered on ${values.app}`);
  return widget;
}

export async function findDashboard(client, name) {
  const rows = (await client.get("/api/dashboards?fields=id,name,owner(id)&$top=200")) ?? [];
  const list = Array.isArray(rows) ? rows : [];
  return list.find((entry) => entry.name === name) ?? null;
}

/**
 * Install the board widget without a destructive window: create the
 * replacement first, then drop the previous embeddings. Only if the server
 * refuses a duplicate key do we fall back to delete-then-create, and the
 * result reports `atomic: false` so the caller can surface it.
 */
export async function ensureWidget(client, dashboardId, widget, options) {
  const values = optionValues(options);
  const body = {
    key: values.widget,
    widget: { id: widget.id },
    x: 0,
    y: 0,
    width: Number(values.width),
    height: Number(values.height),
  };
  const existing = (await client.get(`/api/dashboards/${dashboardId}/widgets?fields=id,key`)) ?? [];
  const previous = (Array.isArray(existing) ? existing : []).filter((row) => row.key === values.widget);
  if (previous.length === 0) {
    await client.post(`/api/dashboards/${dashboardId}/widgets`, body);
    return { created: 1, replaced: 0, atomic: true };
  }
  try {
    await client.post(`/api/dashboards/${dashboardId}/widgets`, body);
  } catch (error) {
    // Only a duplicate-key refusal warrants the destructive retry. A network
    // or validation failure must leave the existing board intact.
    const detail = `${error?.message ?? error}`;
    const duplicate = error?.status === 409 || /duplicate|already (?:exists|present)/iu.test(detail);
    if (!duplicate) throw error;
    for (const entry of previous) {
      await client.delete(`/api/dashboards/${dashboardId}/widgets/${entry.id}`);
    }
    await client.post(`/api/dashboards/${dashboardId}/widgets`, body);
    return { created: 1, replaced: previous.length, atomic: false };
  }
  for (const entry of previous) {
    await client.delete(`/api/dashboards/${dashboardId}/widgets/${entry.id}`);
  }
  return { created: 1, replaced: previous.length, atomic: true };
}

function mergeGroups(existing = [], extra = []) {
  const byId = new Map((existing ?? []).map((entry) => [entry.id, entry]));
  for (const entry of extra) byId.set(entry.id, entry);
  return [...byId.values()].map((entry) => ({
    id: entry.id,
    name: entry.name,
    ringId: entry.ringId,
    icon: entry.icon ?? null,
  }));
}

export async function shareDashboard(client, dashboardId, options) {
  const values = optionValues(options);
  const groupNames = splitGroups(values.groups);
  if (values.noShare || groupNames.length === 0) return [];
  const dash = await client.get(
    `/api/dashboards/${dashboardId}?fields=id,name,pinned,isDefault,canEdit,canTransfer,canShare,` +
    "owner(id),widgets(id,key,x,y,width,height,widget(id),settings)," +
    "readSharingSettings(permittedGroups(id,name,ringId),permittedUsers(id))," +
    "updateSharingSettings(permittedGroups(id,name,ringId),permittedUsers(id))",
  );
  const groups = (await client.get("/api/groups?fields=id,name,ringId,$type&$top=500")) ?? [];
  const available = Array.isArray(groups) ? groups : [];
  const wanted = [];
  for (const name of groupNames) {
    const group = available.find((entry) => entry.name === name) ||
      (name === "All Users" ? available.find((entry) => entry.$type === "AllUsersGroup") : null);
    if (!group) throw new Error(`share group not found: ${name}`);
    wanted.push(group);
  }
  const readGroups = mergeGroups(dash.readSharingSettings?.permittedGroups, wanted);
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

export async function provisionDashboard({ client, options = {} }) {
  const values = optionValues(options);
  const widget = await boardWidget(client, values);
  let dashboard = await findDashboard(client, values.name);
  const created = !dashboard;
  if (!dashboard) {
    if (values.dryRun) {
      return { action: "create", name: values.name, widget: widget.key, groups: splitGroups(values.groups) };
    }
    dashboard = await client.post("/api/dashboards?fields=id,name", { name: values.name });
  }
  if (values.dryRun) {
    return { action: "update", dashboardId: dashboard.id, name: values.name, widget: widget.key, groups: splitGroups(values.groups) };
  }
  const widgets = await ensureWidget(client, dashboard.id, widget, values);
  const shared = await shareDashboard(client, dashboard.id, values);
  return {
    ok: true,
    created,
    dashboardId: dashboard.id,
    name: values.name,
    widget: values.widget,
    widgets,
    groups: shared.map((group) => group.name),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      host: { type: "string" },
      token: { type: "string" },
      name: { type: "string", default: DEFAULT_OPTIONS.name },
      groups: { type: "string", default: DEFAULT_OPTIONS.groups },
      app: { type: "string", default: DEFAULT_OPTIONS.app },
      widget: { type: "string", default: DEFAULT_OPTIONS.widget },
      width: { type: "string", default: DEFAULT_OPTIONS.width },
      height: { type: "string", default: DEFAULT_OPTIONS.height },
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
  const result = await provisionDashboard({
    client,
    options: {
      name: values.name,
      groups: values.groups,
      app: values.app,
      widget: values.widget,
      width: values.width,
      height: values.height,
      noShare: values["no-share"],
      dryRun: values["dry-run"],
    },
  });
  if (result.action) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(JSON.stringify({
    ...result,
    url: `${host.replace(/\/+$/, "")}/dashboard?id=${result.dashboardId}`,
  }, null, 2));
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`spec-dashboard-setup: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
