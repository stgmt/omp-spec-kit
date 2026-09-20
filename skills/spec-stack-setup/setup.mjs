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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
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

const YT_HOST = "http://127.0.0.1:8089";
const YT_NET = "http://youtrack:8080"; // in-network name the service calls
const GIT_NET = "git://spec-git/specs.git"; // auto-created by the git container
const SVC_HOST = "http://127.0.0.1:8644";
const TENANT = "demo";
const SCOPE = "demo/stack";
const YT_PROJECT = "DEMO";
const GROUPS = {
  hub: "spec-demo-users",
  owner: "spec-demo-owners",
  writer: "spec-demo-writers",
  reader: "spec-demo-readers",
};

const log = (msg) => console.log(`[stack] ${msg}`);
const compose = (args) =>
  spawnSync("docker", ["compose", ...args], { cwd: SKILL_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const composeMust = (args, label = args.join(" ")) => {
  const r = compose(args);
  if (r.status !== 0) throw new Error(`docker compose ${label} failed:\n${r.stdout}\n${r.stderr}`);
  return r;
};
const composeLogs = (service) => compose(["logs", "--no-color", "--tail", "500", service]).stdout ?? "";

function writeConfig(serviceToken) {
  mkdirSync(RUNTIME, { recursive: true });
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify(
      {
        specsRepo: GIT_NET,
        branch: "main",
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
      null,
      2,
    ),
  );
}

async function appZipPath() {
  const dist = path.join(REPO_ROOT, "dist");
  const existing = existsSync(dist)
    ? (await import("node:fs")).readdirSync(dist).filter((f) => /^spec-graph-app-.*\.zip$/.test(f)).sort().pop()
    : null;
  if (existing) return path.join(dist, existing);
  log("building the app ZIP (npm run build:youtrack-app)");
  const r = spawnSync("npm", ["run", "build:youtrack-app"], { cwd: REPO_ROOT, shell: true, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`app build failed:\n${r.stdout}\n${r.stderr}`);
  const built = (await import("node:fs")).readdirSync(dist).filter((f) => /^spec-graph-app-.*\.zip$/.test(f)).sort().pop();
  return path.join(dist, built);
}

/** Uploads the app ZIP through the same endpoint the UI uses (sniffed live). */
async function uploadAppZip(zipPath) {
  const fd = new FormData();
  fd.append("file", new Blob([readFileSync(zipPath)], { type: "application/zip" }), path.basename(zipPath));
  const res = await fetch(`${YT_HOST}/api/admin/apps/import`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${ADMIN_LOGIN}:${ADMIN_PASSWORD}`).toString("base64")}` },
    body: fd,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`app import failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function mcpClient(token) {
  const transport = new StreamableHTTPClientTransport(new URL(`${SVC_HOST}/mcp`), {
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
  const spec = await admin.createProject({ name: "Spec", shortName: "SPEC", leaderId: (await admin.meNative()).id });
  const fields = await admin.call("GET", "/api/admin/customFieldSettings/customFields?fields=id,name");
  const ids = new Map((fields ?? []).map((f) => [f.name, f.id]));
  for (const [name, fieldType] of Object.entries({ SpecId: "text", ContentHash: "text", Evidence: "text", SpecKind: "enum[1]" })) {
    if (ids.has(name)) continue;
    const created = await admin.call("POST", "/api/admin/customFieldSettings/customFields?fields=id,name", { body: { fieldType: { id: fieldType }, name } });
    ids.set(name, created.id);
  }
  const attached = new Set(((await admin.call("GET", `/api/admin/projects/${spec.id}/customFields?fields=field(name)`)) ?? []).map((r) => r.field?.name));
  for (const name of ["SpecId", "ContentHash", "Evidence"]) {
    if (attached.has(name)) continue;
    await admin.call("POST", `/api/admin/projects/${spec.id}/customFields?fields=id`, {
      body: { $type: "TextProjectCustomField", field: { id: ids.get(name) }, canBeEmpty: true },
    });
  }
  if (!attached.has("SpecKind")) {
    let bundle = (await admin.call("GET", "/api/admin/customFieldSettings/bundles/enum?fields=id,name&query=SpecKind"))?.[0];
    if (!bundle) {
      bundle = await admin.call("POST", "/api/admin/customFieldSettings/bundles/enum?fields=id", {
        body: { name: "SpecKind values", values: [{ name: "ROADMAP" }, { name: "FUNCTIONAL_REQUIREMENT" }, { name: "TASK" }] },
      });
    }
    // Typed entity refs are mandatory here — bare ids return 500.
    await admin.call("POST", `/api/admin/projects/${spec.id}/customFields?fields=id`, {
      body: {
        $type: "EnumProjectCustomField",
        field: { id: ids.get("SpecKind"), $type: "CustomField" },
        bundle: { id: bundle.id, $type: "EnumBundle" },
        canBeEmpty: true,
        emptyFieldText: "No SpecKind",
      },
    });
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

/** Clones the specs repo and projects the graph into YouTrack issues — the
 *  same cron-shaped step the customer runs, done once by the skill. */
async function runProjectionSync(admin, adminUserId, serviceIds) {
  const cloneDir = path.join(RUNTIME, "specs-clone");
  const env = { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "" };
  rmSync(cloneDir, { recursive: true, force: true }); // fresh clone every run — the pointer is rewritten anyway
  execFileSync("git", ["clone", "-q", "--depth", "1", "git://127.0.0.1:9419/specs.git", cloneDir], { env });
  const syncToken = (await admin.createPermanentToken({ userId: adminUserId, name: "spec-stack-sync", serviceIds })).token;
  execFileSync(process.execPath, [path.join(REPO_ROOT, "scripts", "spec-graph-sync.mjs"), "--host", YT_HOST, "--project", "SPEC", "--provision"], {
    cwd: REPO_ROOT,
    env: { ...env, OMP_SPEC_KIT_ROOT: path.join(cloneDir, SCOPE), YOUTRACK_TOKEN: syncToken },
    timeout: 180_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
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
  // Re-provision the embedding: an earlier run may have created a small one.
  const existing = await admin.call("GET", `/api/dashboards/${dash.id}/widgets?fields=id`);
  for (const w of existing ?? []) {
    await admin.call("DELETE", `/api/dashboards/${dash.id}/widgets/${w.id}`).catch(() => {});
  }
  await admin.call("POST", `/api/dashboards/${dash.id}/widgets`, {
    body: { key: "spec-board", widget: { id: board.id }, x: 0, y: 0, width: 12, height: 8 },
  });
  return `${YT_HOST}/dashboard?id=${dash.id}`;
}

async function main() {
  log("phase 1 — compose up (all three services)");
  writeConfig("pending"); // placeholder so the bind mount never resolves to a dir
  composeMust(["up", "-d"], "up -d");

  log("phase 2 — YouTrack wizard + service token");
  await waitFor(`${YT_HOST}/`, { label: "YouTrack HTTP", timeoutMs: 300_000 });
  if (await youtrackNeedsWizard(YT_HOST)) {
    await completeWizard({ adminPassword: ADMIN_PASSWORD, url: YT_HOST, getLogs: () => composeLogs("youtrack"), logger: log });
  }
  const admin = createYouTrackAdmin({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD, baseUrl: YT_HOST, logger: log });
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
  writeConfig(serviceToken);
  composeMust(["restart", "spec-registryd"], "restart spec-registryd");
  await waitFor(`${SVC_HOST}/mcp`, {
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
  await admin.setAppSettings(app.id, { serviceUrl: SVC_HOST, serviceBridgeToken: BRIDGE_TOKEN });
  const project = await admin.createProject({ name: "Spec Stack Demo", shortName: YT_PROJECT, leaderId: (await admin.meNative()).id });
  await admin.attachAppToProject(app.id, project.id).catch(() => {});

  log("phase 5 — template spec via MCP");
  await admin.revokePermanentTokens({ userId: me.id, name: "spec-stack-seed" }).catch(() => {});
  const seedToken = (await admin.createPermanentToken({ userId: me.id, name: "spec-stack-seed", serviceIds })).token;
  const seeded = await loadTemplateSpec(seedToken);

  log("phase 6 — SPEC projection (issues + sync pointer)");
  await provisionSpecProjection(admin);
  await runProjectionSync(admin, me.id, serviceIds);

  log("phase 7 — Spec Board dashboard");
  const dashboardUrl = await provisionDashboard(admin);

  console.log("\n━━━ spec-stack ready ━━━");
  console.log(`YouTrack:    ${YT_HOST}`);
  console.log(`Login:       ${ADMIN_LOGIN} / ${ADMIN_PASSWORD}`);
  console.log(`Specs:       ${seeded}`);
  console.log(`Dashboard:   ${dashboardUrl}`);
}

main().catch((error) => {
  console.error(`\n[stack] FAILED: ${error?.message ?? error}`);
  process.exit(1);
});
