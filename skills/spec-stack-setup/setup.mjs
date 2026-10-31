#!/usr/bin/env node
/**
 * spec-stack-setup — brings the full local spec-registry stack to a working
 * state and prints a ready-to-open Spec Board dashboard link.
 *
 * The skill OWNS this stack: admin credentials live here, all provisioning is
 * done as admin, and every step is idempotent so a re-run converges instead
 * of duplicating.
 *
 *   node skills/spec-stack-setup/setup.mjs
 *
 * Requires: docker (compose v2), node >= 22, a Chrome build for the one-time
 * YouTrack configuration wizard (playwright-core channel:"chrome").
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomBytes } from "node:crypto";
import { findAvailablePort, tcpProbe } from "../../src/tools/endpoint-alloc.js";
import { writeRuntimeManifest } from "../../src/tools/runtime-manifest.js";
import { waitFor } from "../../tests/e2e/lib/compose.mjs";
import { completeWizard, youtrackNeedsWizard } from "../../tests/e2e/lib/wizard.mjs";
import { createYouTrackAdmin } from "../../tests/e2e/lib/youtrack.mjs";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = path.resolve(SKILL_DIR, "..", "..");
const RUNTIME = path.join(SKILL_DIR, "runtime");
const CONFIG_PATH = path.join(RUNTIME, "projects.json");
const TEMPLATE_DIR = path.join(SKILL_DIR, "template");

// The skill owns the stack — these are the stack's own credentials.
const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "SpecDemo!2026";
const BRIDGE_TOKEN = "spec-demo-bridge-token-0123456789";
const APP_NAME = "spec-graph-app";
// Demo seeding is explicit. The release/fresh-install path runs with
// --no-demo: the dashboard exists but the board has zero valid specs.
const WITH_DEMO = !process.argv.includes("--no-demo");

// Preferred host ports; a busy or foreign-held candidate is remapped through
// a generated compose.override.yml rather than silently diverging configs.
const PORTS = {
  youtrack: { host: 8089, container: 8080 },
  "spec-git": { host: 9419, container: 9418 },
  "spec-registryd": { host: 8644, container: 8642 },
};

const ports = Object.fromEntries(Object.entries(PORTS).map(([k, v]) => [k, v.host]));

const YT_HOST = () => `http://127.0.0.1:${ports.youtrack}`;
const SVC_HOST = () => `http://127.0.0.1:${ports["spec-registryd"]}`;
const YT_NET = "http://youtrack:8080"; // in-network name the service calls
const GIT_NET = "git://spec-git/specs.git"; // auto-created by the git container
const SVC_NET = "http://spec-registryd:8642"; // in-network: the app bridge calls this from inside the YouTrack container — 127.0.0.1 there is the container itself
const TENANT = "demo";
const SCOPE = "demo/stack";
const YT_PROJECT = "DEMO";
const GROUPS = {
  hub: "spec-demo-users",
  owner: "spec-demo-owners",
  writer: "spec-demo-writers",
  reader: "spec-demo-readers",
};

const OVERRIDE_PATH = path.join(SKILL_DIR, "compose.override.yml");

const log = (msg) => console.log(`[stack] ${msg}`);
const compose = (args) =>
  spawnSync("docker", ["compose", ...args], { cwd: SKILL_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const composeMust = (args, label = args.join(" ")) => {
  const r = compose(args);
  if (r.status !== 0) throw new Error(`docker compose ${label} failed:\n${r.stdout}\n${r.stderr}`);
  return r;
};
const composeLogs = (service) => compose(["logs", "--no-color", "--tail", "500", service]).stdout ?? "";

/**
 * Phase 0 — prove the host ports before anything binds them.
 *
 * Re-runs keep their own published bindings (containers of this project hold
 * the ports — probing them would report "busy" and remap over ourselves).
 * A fresh run probes every preferred port: free → use it; held by a foreign
 * process or service → next free candidate via compose.override.yml; the
 * registry answers with our instance fingerprint → reattach. Skips are loud —
 * a port that "should" be free but isn't is exactly how dead client configs
 * get minted.
 */
async function allocateStackPorts(fingerprint) {
  const running = (compose(["ps", "--services", "--filter", "status=running"]).stdout ?? "").trim();
  if (running.length > 0) {
    log("phase 0 — stack containers already run; keeping their published ports");
    for (const service of Object.keys(PORTS)) {
      const binding = (compose(["port", service, String(PORTS[service].container)]).stdout ?? "").trim();
      const match = /:(\d+)$/.exec(binding);
      if (match) ports[service] = Number(match[1]);
    }
    return;
  }

  // A stale override from an earlier remapped run must not shadow the probe.
  rmSync(OVERRIDE_PATH, { force: true });
  const probe = tcpProbe();
  const overrides = [];
  for (const [service, def] of Object.entries(PORTS)) {
    const result = await findAvailablePort({
      preferred: def.host,
      probe,
      expectedFingerprint: service === "spec-registryd" ? fingerprint : null,
    });
    for (const s of result.skipped) log(`phase 0 — port ${s.port} skipped (${s.reason})`);
    if (result.outcome === "reattached") {
      log(`phase 0 — port ${result.port} already serves this instance; reattaching`);
    }
    if (result.port !== def.host) {
      overrides.push({ service, internal: def.container, port: result.port });
      ports[service] = result.port;
    }
  }
  if (overrides.length > 0) {
    const yaml = `${[
      "# generated by spec-stack-setup — the preferred ports were occupied or foreign",
      "services:",
      ...overrides.flatMap((o) => [`  ${o.service}:`, `    ports:`, `      - "127.0.0.1:${o.port}:${o.internal}"`]),
    ].join("\n")}\n`;
    writeFileSync(OVERRIDE_PATH, yaml);
    log(`phase 0 — wrote compose.override.yml (${overrides.map((o) => `${o.service}→${o.port}`).join(", ")})`);
  }
}

function writeConfig(serviceToken, { fingerprint }) {
  mkdirSync(RUNTIME, { recursive: true });
  writeRuntimeManifest({
    path: CONFIG_PATH,
    manifest: {
      fingerprint,
      hostUrl: SVC_HOST(),
      internalUrl: SVC_NET,
      bindings: [{ project: SCOPE, repoUrl: GIT_NET }],
      publicUrl: "http://spec-registryd:8642",
      projects: [{ id: SCOPE }],
      tenants: [{ tenant: TENANT, projects: [SCOPE], hubGroups: [GROUPS.hub], defaultProject: SCOPE }],
      auth: {
        youtrack: { baseUrl: YT_NET, serviceToken },
        appBridge: { token: BRIDGE_TOKEN },
        roleGroups: {
          owner: [GROUPS.owner],
          writer: [GROUPS.writer],
          reader: [GROUPS.reader],
        },
      },
    },
  });
}

async function appZipPath() {
  const dist = path.join(REPO_ROOT, "dist");
  const zips = () => (existsSync(dist) ? readdirSync(dist).filter((f) => /^spec-graph-app-.*\.zip$/.test(f)).sort() : []);
  const existing = zips().pop();
  if (existing) return path.join(dist, existing);
  log("building the app ZIP (npm run build:youtrack-app)");
  const r = spawnSync("npm", ["run", "build:youtrack-app"], { cwd: REPO_ROOT, shell: true, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`app build failed:\n${r.stdout}\n${r.stderr}`);
  const built = zips().pop();
  if (!built) throw new Error("app build produced no ZIP in dist/");
  return path.join(dist, built);
}

/** Uploads the app ZIP through the same endpoint the UI uses (sniffed live). */
async function uploadAppZip(zipPath) {
  const fd = new FormData();
  fd.append("file", new Blob([readFileSync(zipPath)], { type: "application/zip" }), path.basename(zipPath));
  const res = await fetch(`${YT_HOST()}/api/admin/apps/import`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${ADMIN_LOGIN}:${ADMIN_PASSWORD}`).toString("base64")}` },
    body: fd,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`app import failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function mcpClient(token) {
  const transport = new StreamableHTTPClientTransport(new URL(`${SVC_HOST()}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}`, "X-Spec-Project": SCOPE } },
  });
  const client = new Client({ name: "spec-stack-setup", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

function patchOutcome(result) {
  const j = JSON.parse(result.content?.[0]?.text ?? "{}");
  const refused = j.data?.outcome === "REFUSED" ? j.data.error ?? { code: "REFUSED" } : j.ok === false ? j.error ?? { code: "ERR" } : null;
  return { j, refused };
}

/* Loads every template/{slug}/spec.json corpus through real MCP calls — the
 * skill ships the spec, the loader never hand-builds one. */
async function loadTemplateSpec(token) {
  const metas = readdirSync(TEMPLATE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(TEMPLATE_DIR, e.name, "spec.json")))
    .map((e) => {
      const meta = JSON.parse(readFileSync(path.join(TEMPLATE_DIR, e.name, "spec.json"), "utf8"));
      const docs = readdirSync(path.join(TEMPLATE_DIR, e.name))
        .filter((f) => /\.(md|feature)$/.test(f))
        .sort()
        .map((f) => ({ document: f, content: readFileSync(path.join(TEMPLATE_DIR, e.name, f), "utf8") }));
      return { ...meta, docs };
    });
  const mcp = await mcpClient(token);
  let n = 0;
  const stamp = Date.now();
  try {
    // Idempotent re-run: specs that already exist skip createSpec/createRoadmap
    // (a create on an existing slug is a CONFLICT, not an "exists" error).
    const cat = await mcp.callTool({ name: "spec_catalog", arguments: { view: "specs" } });
    const have = new Set(JSON.parse(cat.content?.[0]?.text ?? "{}").data?.specs ?? []);
    for (const meta of metas) {
      const patch = async (intent, extra = {}) => {
        const args = { intent, requestId: `stack-${stamp}-${++n}`, reason: "spec-stack-setup template load", spec: meta.slug, dryRun: false, ...extra };
        let { j, refused } = patchOutcome(await mcp.callTool({ name: "spec_patch", arguments: args }));
        for (const code of ["ELICITATION_REQUIRED", "CONFLICT"]) {
          if (refused?.code !== code) continue;
          await new Promise((r) => setTimeout(r, 1_500));
          ({ j, refused } = patchOutcome(await mcp.callTool({ name: "spec_patch", arguments: { ...args, requestId: `stack-${stamp}-${++n}-${code}` } })));
        }
        if (j.ok === false || refused) throw new Error(`${intent} ${meta.slug}: ${refused?.code ?? j.error?.message}`);
        return j;
      };
      await mcp.callTool({ name: "spec_claim", arguments: { spec: meta.slug } });
      if (!have.has(meta.slug)) {
        const created = await mcp.callTool({ name: "spec_branch", arguments: { action: "create", spec: meta.slug } });
        const branch = JSON.parse(created.content?.[0]?.text ?? "{}");
        if (branch.ok === false && branch.error?.code !== "SPEC_EXISTS") {
          throw new Error(`create branch ${meta.slug}: ${branch.error?.code ?? "unknown"}`);
        }
        try {
          await patch("createSpec", { title: meta.title });
        } catch (e) {
          if (!/already exists|SPEC_EXISTS|EXISTS/i.test(e.message)) throw e;
        }
        if (meta.docs.some((d) => d.document === "ROADMAP.md")) {
          try {
            await patch("createRoadmap", { title: meta.title });
          } catch (e) {
            if (!/already|exist|marker/i.test(e.message)) throw e;
          }
        }
      }
      for (const { document, content } of meta.docs) {
        // replace_document = idempotent overwrite; a re-run converges to the
        // template instead of appending duplicates.
        await patch("patch", { operations: [{ kind: "replace_document", document, content }] });
        log(`seeded ${meta.slug}/${document}`);
      }
      await mcp.callTool({ name: "spec_release", arguments: { spec: meta.slug } }).catch(() => {});
    }
  } finally {
    await mcp.close();
  }
  return metas.map((m) => `${m.slug} — ${m.title}`).join(", ");
}

/** The SPEC projection target: the board reads the SPEC:SYNC-STATE pointer
 *  issue, which spec-graph-sync writes into this project. One-time admin work —
 *  the skill does it because it owns the stack. */
async function provisionSpecProjection(admin) {
  const projects = (await admin.call("GET", "/api/admin/projects?fields=id,shortName")) ?? [];
  let spec = projects.find((p) => p.shortName === "SPEC");
  if (!spec) spec = await admin.createProject({ name: "Spec", shortName: "SPEC", leaderId: (await admin.meNative()).id });

  const fields = await admin.call("GET", "/api/admin/customFieldSettings/customFields?fields=id,name");
  const ids = new Map((fields ?? []).map((f) => [f.name, f.id]));
  for (const [name, fieldType] of Object.entries({ SpecId: "text", ContentHash: "text", Evidence: "text", SpecKind: "enum[1]" })) {
    if (ids.has(name)) continue;
    const created = await admin.call("POST", "/api/admin/customFieldSettings/customFields?fields=id,name", { body: { fieldType: { id: fieldType }, name } });
    ids.set(name, created.id);
  }

  // The SpecKind bundle must be found by EXACT name: a `query=` filter is not
  // applied to bundles, so taking the first row attaches the Priority bundle
  // and every card then fails with "entity with the specified name not found".
  const kindNames = ["ROADMAP", "FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT", "ACCEPTANCE_CRITERION", "TASK", "SCENARIO"];
  const bundles = (await admin.call("GET", "/api/admin/customFieldSettings/bundles/enum?fields=id,name,values(name)&$top=200")) ?? [];
  let specKindBundle = bundles.find((b) => b.name === "SpecKind values");
  if (!specKindBundle) {
    specKindBundle = await admin.call("POST", "/api/admin/customFieldSettings/bundles/enum?fields=id,name,values(name)", {
      body: { name: "SpecKind values", values: kindNames.map((name) => ({ name })) },
    });
  }
  const haveKind = new Set((specKindBundle.values ?? []).map((v) => v.name));
  for (const name of kindNames) {
    if (haveKind.has(name)) continue;
    await admin.call("POST", `/api/admin/customFieldSettings/bundles/enum/${specKindBundle.id}/values?fields=id,name`, { body: { name } });
  }

  const attached = (await admin.call("GET", `/api/admin/projects/${spec.id}/customFields?fields=id,field(name),bundle(id)`)) ?? [];
  const attachedByName = new Map(attached.map((row) => [row.field?.name, row]));
  for (const name of ["SpecId", "ContentHash", "Evidence"]) {
    if (attachedByName.has(name)) continue;
    await admin.call("POST", `/api/admin/projects/${spec.id}/customFields?fields=id`, {
      body: { $type: "TextProjectCustomField", field: { id: ids.get(name) }, canBeEmpty: true },
    });
  }
  const kindEntry = attachedByName.get("SpecKind");
  if (!kindEntry) {
    // Typed entity refs are mandatory here — bare ids return 500.
    await admin.call("POST", `/api/admin/projects/${spec.id}/customFields?fields=id`, {
      body: {
        $type: "EnumProjectCustomField",
        field: { id: ids.get("SpecKind"), $type: "CustomField" },
        bundle: { id: specKindBundle.id, $type: "EnumBundle" },
        canBeEmpty: true,
        emptyFieldText: "No SpecKind",
      },
    });
  } else if (kindEntry.bundle?.id !== specKindBundle.id) {
    // Repair a project provisioned before the exact-name lookup existed.
    await admin.call("POST", `/api/admin/projects/${spec.id}/customFields/${kindEntry.id}`, {
      body: { $type: "EnumProjectCustomField", bundle: { id: specKindBundle.id, $type: "EnumBundle" } },
    });
  }

  // The projection writes node kinds into the stock Type field; its default
  // bundle has no Constraint/Criterion/Roadmap/Scenario values and YouTrack
  // rejects an issue without a Type, pointer included.
  const typeEntry = ((await admin.call("GET", `/api/admin/projects/${spec.id}/customFields?fields=id,field(name),bundle(id,values(id,name))`)) ?? []).find(
    (row) => row.field?.name === "Type",
  );
  if (typeEntry?.bundle?.id) {
    const typeValues = new Set((typeEntry.bundle.values ?? []).map((v) => v.name));
    for (const name of ["Constraint", "Criterion", "Roadmap", "Scenario", "Requirement"]) {
      if (typeValues.has(name)) continue;
      await admin.call("POST", `/api/admin/customFieldSettings/bundles/enum/${typeEntry.bundle.id}/values?fields=id,name`, { body: { name } });
      typeValues.add(name);
    }
    const taskValue = ((await admin.call("GET", `/api/admin/projects/${spec.id}/customFields?fields=id,field(name),bundle(id,values(id,name))`)) ?? [])
      .find((row) => row.field?.name === "Type")
      ?.bundle?.values?.find((v) => v.name === "Task");
    if (taskValue) {
      await admin.call("POST", `/api/admin/projects/${spec.id}/customFields/${typeEntry.id}`, {
        body: { $type: "EnumProjectCustomField", canBeEmpty: true, defaultValues: [{ id: taskValue.id, $type: "EnumBundleElement" }] },
      });
    }
  }

  // The stock duplicates workflow can wedge issue creation on a fixture
  // instance — detach it everywhere (same workaround as the e2e contour).
  for (const p of (await admin.call("GET", "/api/admin/projects?fields=id,shortName")) ?? []) {
    for (const w of (await admin.call("GET", `/api/admin/projects/${p.id}/workflows?fields=id,workflow(name)`)) ?? []) {
      if (w.workflow?.name?.includes("duplicates")) {
        await admin.call("DELETE", `/api/admin/projects/${p.id}/workflows/${w.id}`).catch(() => {});
      }
    }
  }
  return spec;
}

/** The projection is only correct once the SPEC project, its bundles and the
 *  link types exist; until then every write fails with a tracker error. The
 *  setup starts the service with projection disabled and flips it on here. */
async function verifyProjection(admin) {
  const deadline = Date.now() + 300_000;
  let cards = 0;
  let pointer = null;
  while (Date.now() < deadline) {
    const rows =
      (await admin.call(
        "GET",
        "/api/issues?query=project:SPEC&fields=idReadable,summary,customFields(name,value(name,text))&$top=1000",
      )) ?? [];
    cards = rows.length;
    for (const row of rows) {
      const specId = (row.customFields ?? []).find((f) => f.name === "SpecId")?.value?.text;
      if (specId === "SPEC:SYNC-STATE") pointer = row.idReadable;
    }
    // A fresh --no-demo install has only the pointer card; that is a valid
    // empty projection, not a failed one.
    if (pointer && cards >= 1) return { cards, pointer };
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`SPEC projection did not converge: ${cards} card(s), pointer ${pointer ?? "missing"}`);
}

/** The management page belongs to the administration menu. A package built
 *  before the move still declares MAIN_MENU_ITEM and would silently put the
 *  entry back into the left navigation, so a stale package fails the install
 *  instead of being accepted as a fallback. */
async function verifyAppPlacement(admin) {
  const app = await admin.appByName(APP_NAME);
  const full = await admin.call("GET", `/api/admin/apps/${app.id}?fields=version,widgets(key,extensionPoint(id))`);
  const widgets = full.widgets ?? [];
  const legacy = widgets.filter((widget) => widget.extensionPoint?.id === "MAIN_MENU_ITEM");
  if (legacy.length > 0) {
    throw new Error(`app package is stale: ${legacy.map((widget) => widget.key).join(", ")} still target MAIN_MENU_ITEM`);
  }
  const page = widgets.find((widget) => widget.key === "spec-app");
  if (page?.extensionPoint?.id !== "ADMINISTRATION_MENU_ITEM") {
    throw new Error(`app package is stale: spec-app targets ${page?.extensionPoint?.id ?? "nothing"}, expected ADMINISTRATION_MENU_ITEM`);
  }
  return full.version;
}

/** Install the OpenCode guard for the operator's global config. OpenCode is
 *  optional on a server host, so the phase is skipped only when the agent
 *  config directory is absent; a detected install must succeed. */
function installOpenCodeGuard(token) {
  const configDir = path.join(os.homedir(), ".config", "opencode");
  if (!existsSync(configDir)) return null;
  const script = path.join(REPO_ROOT, "scripts", "install-opencode-guard.mjs");
  const result = spawnSync(process.execPath, [script, "--url", `${SVC_HOST()}/mcp`], {
    env: { ...process.env, OMP_SPEC_REGISTRY_TOKEN: token },
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(`OpenCode guard install failed: ${(result.stderr ?? "").trim().slice(0, 400)}`);
  }
  return configDir;
}

/** Install the Codex guard for the operator's global config. Codex is
 *  optional on a server host, so the phase is skipped only when ~/.codex is
 *  absent; a detected install must succeed. */
function installCodexGuard(token) {
  const codexHome = path.join(os.homedir(), ".codex");
  if (!existsSync(codexHome)) return null;
  const script = path.join(REPO_ROOT, "scripts", "install-codex-guard.mjs");
  const result = spawnSync(process.execPath, [script, "--url", `${SVC_HOST()}/mcp`], {
    env: { ...process.env, OMP_SPEC_REGISTRY_TOKEN: token },
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(`Codex guard install failed: ${(result.stderr ?? "").trim().slice(0, 400)}`);
  }
  return codexHome;
}

async function provisionDashboard(admin) {
  const app = await admin.appByName(APP_NAME);
  const widgets = (await admin.call("GET", `/api/admin/apps/${app.id}?fields=id,widgets(id,key)`)).widgets;
  const board = widgets.find((w) => w.key === "spec-board");
  if (!board) throw new Error("spec-board widget not found on the installed app");
  const name = "Spec Stack";
  const dashboards = await admin.call("GET", `/api/dashboards?fields=id,name`);
  let dash = (dashboards ?? []).find((d) => d.name === name);
  if (!dash) dash = await admin.call("POST", "/api/dashboards", { body: { name } });
  // Re-provision OUR embedding only — widgets the user added themselves
  // stay put; a stale spec-board cell from an earlier run is replaced.
  const existing = await admin.call("GET", `/api/dashboards/${dash.id}/widgets?fields=id,key`);
  for (const w of (existing ?? []).filter((w) => w.key === "spec-board")) {
    await admin.call("DELETE", `/api/dashboards/${dash.id}/widgets/${w.id}`).catch(() => {});
  }
  await admin.call("POST", `/api/dashboards/${dash.id}/widgets`, {
    body: { key: "spec-board", widget: { id: board.id }, x: 0, y: 0, width: 12, height: 8 },
  });
  // A dashboard created through the admin API is private to the admin. The
  // requirement is that every tenant user sees the board in their dashboard
  // list, so share it with the tenant group and with All Users explicitly.
  const shared = await admin.shareDashboard(dash.id, ["All Users", GROUPS.hub]);
  log(`dashboard ${dash.id} shared with ${shared.map((group) => group.name).join(", ")}`);
  return `${YT_HOST()}/dashboard?id=${dash.id}`;
}

async function main() {
  log("phase 0 — port allocation");
  const existing = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, "utf8")) : {};
  const fingerprint = typeof existing.fingerprint === "string" ? existing.fingerprint : randomBytes(8).toString("hex");
  await allocateStackPorts(fingerprint);

  log("phase 1 — compose up (projection off until the tracker target exists)");
  writeConfig("pending", { fingerprint }); // placeholder so the bind mount never resolves to a dir
  process.env.SPEC_REGISTRY_PROJECTION = "0";
  composeMust(["up", "-d"], "up -d");

  log("phase 2 — YouTrack wizard + service token");
  await waitFor(`${YT_HOST()}/`, { label: "YouTrack HTTP", timeoutMs: 300_000 });
  if (await youtrackNeedsWizard(YT_HOST())) {
    await completeWizard({ adminPassword: ADMIN_PASSWORD, url: YT_HOST(), getLogs: () => composeLogs("youtrack"), logger: log });
  }
  const admin = createYouTrackAdmin({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD, baseUrl: YT_HOST(), logger: log });
  const me = await admin.me();
  const serviceIds = [await admin.youtrackServiceId(), await admin.hubServiceId()];
  for (const g of Object.values(GROUPS)) {
    const group = await admin.createGroup(g);
    // admin must carry the hub + owner + writer groups to own the tenant
    if ([GROUPS.hub, GROUPS.owner, GROUPS.writer].includes(g)) {
      await admin.addUserToGroup(group.id, me.id).catch(() => {});
    }
  }
  await admin.revokePermanentTokens({ userId: me.id, name: "spec-stack-service" }).catch(() => {});
  const serviceToken = (await admin.createPermanentToken({ userId: me.id, name: "spec-stack-service", serviceIds })).token;

  log("phase 3 — real service config + registryd restart");
  writeConfig(serviceToken, { fingerprint });
  composeMust(["restart", "spec-registryd"], "restart spec-registryd");
  await waitFor(`${SVC_HOST()}/mcp`, {
    label: "spec-registryd /mcp",
    timeoutMs: 120_000,
    accept: (r) => r.status === 400 || r.status === 401 || r.status === 405 || r.ok,
  });

  log("phase 4 — app ZIP import + settings + project attach");
  const zip = await appZipPath();
  await uploadAppZip(zip).catch(async (e) => {
    // Already installed at this version → keep it, settings get re-applied.
    if (/exist|duplicate|same/i.test(e.message)) return;
    throw e;
  });
  const app = await admin.appByName(APP_NAME);
  await admin.setAppSettings(app.id, { serviceUrl: SVC_NET, serviceBridgeToken: BRIDGE_TOKEN });
  const project = await admin.createProject({ name: "Spec Stack Demo", shortName: YT_PROJECT, leaderId: (await admin.meNative()).id });
  await admin.attachAppToProject(app.id, project.id).catch(() => {});
  const appVersion = await verifyAppPlacement(admin);
  log(`app ${appVersion} verified: Spec Service is an administration-menu page`);

  log("phase 5 - template spec via MCP");
  await admin.revokePermanentTokens({ userId: me.id, name: "spec-stack-seed" }).catch(() => {});
  const seedToken = (await admin.createPermanentToken({ userId: me.id, name: "spec-stack-seed", serviceIds })).token;
  let seeded;
  if (WITH_DEMO) {
    seeded = await loadTemplateSpec(seedToken);
  } else {
    seeded = "no demo specs (fresh install)";
    log("phase 5 - --no-demo: skipping template seeding; the board starts empty");
  }

  log("phase 6 — SPEC projection target (issues + sync pointer)");
  await provisionSpecProjection(admin);

  log("phase 7 — enabling service-side projection by default");
  process.env.SPEC_REGISTRY_PROJECTION = "1";
  composeMust(["up", "-d"], "up -d with projection");
  const projection = await verifyProjection(admin);
  log(`projection ready: ${projection.cards} card(s), pointer ${projection.pointer}`);

  log("phase 8 — Spec Board dashboard");
  const dashboardUrl = await provisionDashboard(admin);

  log("phase 9 — OpenCode guard");
  const guardDir = installOpenCodeGuard(seedToken);
  if (guardDir === null) log("phase 9 — no OpenCode config on this host; guard not installed");
  else log(`phase 9 — guard installed in ${guardDir}`);

  log("phase 10 — Codex guard");
  const codexHome = installCodexGuard(seedToken);
  if (codexHome === null) log("phase 10 — no Codex home on this host; guard not installed");
  else log(`phase 10 — guard installed in ${codexHome}; run /hooks once to trust it`);

  console.log("\n━━━ spec-stack ready ━━━");
  console.log(`YouTrack:    ${YT_HOST()}`);
  console.log(`Login:       ${ADMIN_LOGIN} / ${ADMIN_PASSWORD}`);
  console.log(`Specs:       ${seeded}`);
  console.log(`Dashboard:   ${dashboardUrl}`);
}

main().catch((error) => {
  console.error(`\n[stack] FAILED: ${error?.message ?? error}`);
  process.exit(1);
});
