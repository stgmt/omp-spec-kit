import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { After, AfterAll, Before, BeforeAll, Given, setDefaultTimeout, Then, When } from "@cucumber/cucumber";
import { chromium } from "playwright-core";
import { ADMIN_PASSWORD, APP_NAME, BRIDGE_TOKEN, USERS, deployApp } from "../e2e/lib/bootstrap.mjs";
import { E2E_DIR, SERVICE_URL, YT_URL } from "../e2e/lib/compose.mjs";
import { createYouTrackAdmin } from "../e2e/lib/youtrack.mjs";
import { browserLogin } from "../e2e/lib/browser.mjs";
import { attachAppToProjectViaUI, fillAppSettings, openAppsPage, openAppTab, uploadAppZip } from "../e2e/lib/app-admin-ui.mjs";
import { loadLiveFixture } from "../e2e/lib/live-fixture.mjs";
import { digest } from "../../src/adapters/youtrack-projection.js";
import { OmpSpecKitSetup } from "../../src/hosts/opencode/setup.mjs";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const RUN_LIVE = path.join(REPO_ROOT, "tests", "e2e", "run-live.mjs");
const SYNC = path.join(REPO_ROOT, "scripts", "spec-graph-sync.mjs");
const ARTIFACTS = path.join(E2E_DIR, "artifacts");
const APP_DIR = path.join(REPO_ROOT, "tools", "spec-graph-app");
const SERVICE_SETTINGS = {
  serviceUrl: "http://spec-registryd:8642",
  serviceBridgeToken: BRIDGE_TOKEN,
};
const APP_PAGE_PATH = "/app/spec-graph-app/spec-app";
const LIVE = process.env.OMP_SPEC_KIT_DELIVERY_LIVE === "1";

// Stack bring-up, upload and dashboard provisioning all exceed the default.
setDefaultTimeout(300_000);

const live = {
  browser: null,
  zipPath: null,
  manifest: null,
  issue: null,
  appId: null,
  appVersion: null,
  specProjectId: null,
  demoSpec: null,
};

const admin = () => createYouTrackAdmin({ login: "admin", password: ADMIN_PASSWORD });

if (LIVE) BeforeAll({ timeout: 1_200_000 }, async () => {
  await mkdir(ARTIFACTS, { recursive: true });
  const { stdout } = await execFileAsync(
    process.execPath,
    [RUN_LIVE, "--bootstrap-only", "--skip-app"],
    { timeout: 900_000, maxBuffer: 16 * 1024 * 1024 },
  ).catch((error) => {
    throw new Error(`stack bootstrap failed: ${(error.stdout ?? error.message).slice(-2000)}`);
  });
  console.log(stdout.trim().split("\n").pop());

  const installed = await admin().appByName(APP_NAME).catch(() => null);
  if (installed) await admin().uninstallApp(installed.id);

  live.manifest = JSON.parse(await readFile(path.join(APP_DIR, "manifest.json"), "utf8"));
  live.zipPath = path.join(REPO_ROOT, "dist", `${APP_NAME}-${live.manifest.version}.zip`);
  await execFileAsync(process.execPath, [path.join(REPO_ROOT, "scripts", "build-youtrack-app.mjs")], { timeout: 180_000 });

  const projects = (await admin().call("GET", "/api/admin/projects?fields=id,shortName")) ?? [];
  live.specProjectId = projects.find((project) => project.shortName === "SPEC")?.id ?? null;
  assert.ok(live.specProjectId, "the e2e stack must have the SPEC project");

  const issues = await fetch(`${YT_URL}/api/issues?query=project:SPEC&fields=id,idReadable`, {
    headers: {
      authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  }).then((response) => (response.ok ? response.json() : []));
  assert.ok(Array.isArray(issues) && issues.length > 0, "no anchor issue in project SPEC");
  live.issue = issues[0];

  live.browser = await chromium.launch({ channel: "chrome", headless: true });
});

if (LIVE) AfterAll(async () => {
  await live.browser?.close();
});

if (LIVE) Before(async function () {
  this.pages = [];
});

if (LIVE) After(async function () {
  for (const page of this.pages ?? []) await page.close().catch(() => {});
});

async function newPage(world) {
  const page = await live.browser.newPage();
  page.setDefaultTimeout(60_000);
  world.pages.push(page);
  return page;
}

async function ensureAppInstalled() {
  let app = await admin().appByName(APP_NAME).catch(() => null);
  if (!app) {
    const token = await loadLiveFixture().then((fixture) => fixture.userToken("admin"));
    const id = await deployApp({ admin: admin(), token });
    await admin().attachAppToProject(id, live.specProjectId);
    app = await admin().appByName(APP_NAME);
  }
  live.appId = app.id;
  live.appVersion = app.version;
  return app;
}

async function ensureAdminPage(world) {
  if (!world.adminPage) {
    world.adminPage = await newPage(world);
    await browserLogin(world.adminPage, "admin", ADMIN_PASSWORD);
  }
  return world.adminPage;
}

async function appFrame(page, selector, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const count = await frame.locator(selector).count().catch(() => 0);
      if (count > 0) return frame;
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error(`app page did not render ${selector}; frames: ${page.frames().map((frame) => frame.url()).join(", ").slice(0, 400)}`);
}

async function openAppPage(page) {
  await page.goto(`${YT_URL}${APP_PAGE_PATH}`, { waitUntil: "domcontentloaded" });
  return appFrame(page, '[data-testid="health"], [data-testid="wizard"], [data-testid="service-error"]');
}

async function healthFrame(page) {
  return appFrame(page, '[data-testid="health"]');
}

async function specCatalog(token) {
  return mcpCall(token, "stgmt/alpha", "spec_catalog", { view: "specs" });
}

async function boardFor(token, specSlugs = []) {
  return mcpCall(token, "stgmt/alpha", "spec_graph", { view: "board", specSlugs });
}

let rpcId = 0;
async function mcpCall(token, project, name, args) {
  const response = await fetch(`${SERVICE_URL}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "X-Spec-Project": project,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name} -> HTTP ${response.status}: ${text.slice(0, 300)}`);
  let payload = text;
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const line = text.split("\n").find((entry) => entry.startsWith("data:"));
    payload = line ? line.slice(5).trim() : text;
  }
  const frame = JSON.parse(payload);
  if (frame.error) throw new Error(`${name} JSON-RPC error: ${JSON.stringify(frame.error).slice(0, 300)}`);
  const structured = frame.result?.structuredContent;
  if (!structured) throw new Error(`${name} returned no structured envelope`);
  return structured;
}

function expectOk(name, envelope) {
  if (envelope.ok !== true || envelope.data?.outcome === "REFUSED") {
    const detail = envelope.error ?? envelope.data?.error ?? envelope;
    throw new Error(`${name} refused: ${detail?.code ?? "unknown"} ${detail?.message ?? JSON.stringify(detail).slice(0, 600)}`);
  }
}

/**
 * The authoring surface gates the first creation of a Markdown document behind
 * an elicitation retry and serializes concurrent patches with CONFLICT. The
 * setup skill retries both; the live scenario must do the same.
 */
async function mutateWithRetry(token, project, name, args, { attempts = 4 } = {}) {
  let last = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await mcpCall(token, project, name, {
      ...args,
      requestId: `${args.requestId ?? name}-${attempt}-${Date.now()}`,
    });
    if (last.ok === true && last.data?.outcome !== "REFUSED") return last;
    const code = last.data?.error?.code ?? last.error?.code;
    if (code !== "ELICITATION_REQUIRED" && code !== "CONFLICT") {
      expectOk(name, last);
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  expectOk(name, last);
  return last;
}

async function syncSnapshot() {
  const liveFixture = await loadLiveFixture();
  const { provisionSpecProjection } = await import("../../skills/spec-stack-setup/provision-spec.mjs");
  await provisionSpecProjection(admin());
  // Preferred path: the service owns the projection and publishes the v7 root
  // index plus per-project pointers. Owner role, tenant header.
  const carol = await liveFixture.userToken("carol");
  const projectionResponse = await fetch(`${SERVICE_URL}/projection/sync`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${carol}`,
      "content-type": "application/json",
      "X-Spec-Project": "stgmt/alpha",
    },
    body: "{}",
    signal: AbortSignal.timeout(300_000),
  });
  if (projectionResponse.ok) {
    const payload = await projectionResponse.json();
    return payload.last ?? payload;
  }
  if (projectionResponse.status !== 501) {
    const detail = await projectionResponse.text().catch(() => "");
    throw new Error(`projection sync failed: ${projectionResponse.status} ${detail.slice(0, 300)}`);
  }
  // Fallback for a stack with projection disabled (older contour): run the
  // manual sync. It publishes the aggregate marker only.
  const adminToken = await liveFixture.userToken("admin");
  const aliceToken = await liveFixture.userToken("alice");
  const markerKey = digest("projection-marker:e2e-local-secrets-key-not-for-production");
  const { stdout, stderr } = await execFileAsync(process.execPath, [SYNC, "--project", "SPEC"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      YOUTRACK_HOST: YT_URL,
      YOUTRACK_TOKEN: adminToken,
      SPEC_REGISTRY_URL: SERVICE_URL,
      SPEC_AGENT_TOKEN: aliceToken,
      SPEC_REGISTRY_PROJECT: "stgmt/alpha",
      SPEC_SYNC_MARKER_KEY: markerKey,
    },
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const last = stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
  if (!/"outcome":"(SYNCED|SKIPPED|PARTIAL)"/u.test(last)) {
    throw new Error(`snapshot sync did not report an outcome: ${last}\n${stderr.slice(-800)}`);
  }
  return JSON.parse(last);
}

function dashboardIdFrom(url) {
  const match = /[?&]id=([^&]+)/u.exec(url);
  if (!match) throw new Error(`dashboard URL has no id: ${url}`);
  return decodeURIComponent(match[1]);
}

async function dashboardState(id) {
  return admin().call(
    "GET",
    `/api/dashboards/${encodeURIComponent(id)}?fields=id,name,widgets(id,key,x,y,width,height,widget(id)),` +
      "readSharingSettings(permittedGroups(id,name,ringId))",
  );
}

// ---- SCEN-delivery-placement ------------------------------------------------

Given("the app was installed through Administration -> Apps", { timeout: 600_000 }, async function () {
  this.adminPage = await newPage(this);
  await browserLogin(this.adminPage, "admin", ADMIN_PASSWORD);
  await openAppsPage(this.adminPage);
  await uploadAppZip(this.adminPage, live.zipPath);
  await openAppTab(this.adminPage, "Projects");
  await attachAppToProjectViaUI(this.adminPage, "Spec E2E");
  await openAppTab(this.adminPage, "Settings");
  await fillAppSettings(this.adminPage, SERVICE_SETTINGS);
  const app = await admin().appByName(APP_NAME);
  assert.equal(app.version, live.manifest.version, "the uploaded app must equal the built manifest");
  live.appId = app.id;
  live.appVersion = app.version;
});

When("an administrator opens the Spec Service page", async function () {
  await ensureAdminPage(this);
  await openAppPage(this.adminPage);
});

Then("Spec Service is listed under Administration -> Integrations", async function () {
  const { verifyAppPlacement } = await import("../../skills/spec-stack-setup/provision-spec.mjs");
  const version = await verifyAppPlacement(admin());
  assert.equal(version, live.manifest.version);
  await openAppsPage(this.adminPage);
  await this.adminPage.getByText("Spec Graph", { exact: false }).first().waitFor({ state: "visible", timeout: 20_000 });
});

Then("no widget declares MAIN_MENU_ITEM", async function () {
  const manifest = JSON.parse(await readFile(path.join(APP_DIR, "manifest.json"), "utf8"));
  const legacy = (manifest.widgets ?? []).filter((widget) => widget.extensionPoint === "MAIN_MENU_ITEM");
  assert.deepEqual(legacy, [], "the app package must not declare MAIN_MENU_ITEM");
});

Then("the main left navigation contains no Spec Graph item", async function () {
  await this.adminPage.goto(`${YT_URL}/issues`, { waitUntil: "domcontentloaded" });
  await this.adminPage.waitForTimeout(2_000);
  const links = await this.adminPage.locator('a[href*="/app/spec-graph-app"]').count();
  assert.equal(links, 0, "the main navigation must not link to the Spec Service page");
});

Then("the issue view contains no Open Spec Service link", async function () {
  await this.adminPage.goto(`${YT_URL}/issue/${live.issue.idReadable}`, { waitUntil: "domcontentloaded" });
  await this.adminPage.waitForTimeout(5_000);
  const text = await this.adminPage.locator("body").innerText();
  assert.doesNotMatch(text, /Open Spec Service/u, "issue pages must not expose a setup door");
});

// ---- SCEN-delivery-health ---------------------------------------------------

Given("the app is installed without serviceUrl and serviceBridgeToken", async function () {
  const app = await ensureAppInstalled();
  await admin().setAppSettings(app.id, {});
});

Then("the health probe names the missing settings and the next action", async function () {
  // YouTrack does not mount a widget while required settings are empty, so the
  // handler itself is exercised with the settings the host would pass. The
  // live page is covered in the next steps with a mounted (unreachable) URL.
  const source = await readFile(path.join(APP_DIR, "spec-handler.js"), "utf8");
  const exported = {};
  const sandbox = {
    exports: exported,
    module: { exports: exported },
    require: (name) => {
      assert.equal(name, "@jetbrains/youtrack-scripting-api/http");
      return { Connection: class { addHeader() {} bearerAuth() {} postSync() { return null; } getSync() { return null; } } };
    },
  };
  const vm = await import("node:vm");
  vm.runInNewContext(source, sandbox, { filename: "spec-handler.js" });
  let response = null;
  sandbox.exports.httpHandler.endpoints[0].handle({
    settings: {},
    request: { json: () => ({ method: "health/app" }) },
    response: { json: (value) => { response = value; } },
    currentUser: null,
  });
  assert.equal(response.ok, false);
  assert.equal(response.missing.join(","), "serviceUrl,serviceBridgeToken");
  assert.equal(response.markerProject, "SPEC");
  assert.ok(!JSON.stringify(response).includes(BRIDGE_TOKEN), "the probe must not echo the bridge token");
});

When("the administrator sets an unreachable service URL", async function () {
  const app = await admin().appByName(APP_NAME);
  await admin().setAppSettings(app.id, {
    ...SERVICE_SETTINGS,
    serviceUrl: "http://spec-registryd:9999",
  });
});

Then("the Health panel renders six checks and the next action", async function () {
  const frame = await healthFrame(this.adminPage);
  const rows = await frame.locator(".health-row").count();
  assert.equal(rows, 6, `expected six health rows, got ${rows}`);
  const next = await frame.locator('[data-testid="health-next"]').innerText();
  assert.match(next, /Next: check the service URL/u);
});

Then("it offers Provision dashboard", async function () {
  const frame = await healthFrame(this.adminPage);
  assert.equal(await frame.locator('[data-testid="dashboard-provision"]').count(), 1);
});

// ---- SCEN-delivery-second-user ---------------------------------------------

Given("the app settings are restored and a committed snapshot exists", { timeout: 600_000 }, async function () {
  const app = await ensureAppInstalled();
  await admin().setAppSettings(app.id, SERVICE_SETTINGS);
  const result = await syncSnapshot();
  assert.ok(["SYNCED", "SKIPPED", "PARTIAL"].includes(result.outcome));
});

When("an administrator provisions the Spec Stack dashboard on the page", { timeout: 300_000 }, async function () {
  await ensureAdminPage(this);
  // The canonical headless half creates/repairs the dashboard; the page then
  // exercises the idempotent verify/share path a user sees. This YouTrack build
  // does not complete dashboard writes from a widget host, so the page reports
  // the headless command instead of hanging (see README).
  const token = await loadLiveFixture().then((fixture) => fixture.userToken("admin"));
  await execFileAsync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts", "spec-dashboard-setup.mjs"), "--host", YT_URL, "--token", token],
    { timeout: 120_000 },
  );
  await this.adminPage.goto(`${YT_URL}${APP_PAGE_PATH}`, { waitUntil: "domcontentloaded" });
  const frame = await healthFrame(this.adminPage);
  await frame.locator('[data-testid="dashboard-provision"]').click();
  const result = frame.locator('[data-testid="health-result"]');
  await result.waitFor({ state: "visible", timeout: 30_000 });
  const deadline = Date.now() + 120_000;
  let text = "";
  while (Date.now() < deadline) {
    text = await result.innerText();
    if (/Dashboard ready|Provision failed/u.test(text)) break;
    await this.adminPage.waitForTimeout(1_000);
  }
  assert.match(text, /Dashboard ready/u, `provision did not finish: ${text}`);
  await frame.locator('[data-testid="dashboard-link"]').waitFor({ state: "visible", timeout: 30_000 });
  const href = await frame.locator('[data-testid="dashboard-link"]').getAttribute("href");
  assert.ok(href && href.includes("/dashboard?id="), `dashboard link missing: ${href}`);
  this.dashboardUrl = href;
});

Then("the dashboard has one full-width spec-board widget shared with All Users", async function () {
  const id = dashboardIdFrom(this.dashboardUrl);
  const dashboard = await dashboardState(id);
  const boards = (dashboard.widgets ?? []).filter((widget) => widget.key === "spec-board");
  assert.equal(boards.length, 1, "exactly one spec-board widget");
  assert.equal(Number(boards[0].width), 12, "the board must be full width");
  const groups = dashboard.readSharingSettings?.permittedGroups ?? [];
  assert.ok(groups.some((group) => group.name === "All Users"), "the board must be shared with All Users");
});

When("a non-admin reader signs in and opens Spec Stack", async function () {
  this.readerPage = await newPage(this);
  await browserLogin(this.readerPage, "bob", USERS.bob.password);
  await this.readerPage.goto(`${YT_URL}${this.dashboardUrl}`, { waitUntil: "domcontentloaded" });
  this.boardFrame = await appFrame(this.readerPage, ".node-card", { timeoutMs: 90_000 });
});

Then("the Spec Board renders committed snapshot nodes", async function () {
  const cards = await this.boardFrame.locator(".node-card").count();
  assert.ok(cards > 0, "the shared board must render committed nodes for the second user");
  const text = await this.boardFrame.locator("body").innerText();
  assert.match(text, /alpha-spec|Alpha seeded|seed task/u, "the seeded corpus must be visible");
});

// ---- SCEN-delivery-upgrade --------------------------------------------------

Given("an existing corpus and the provisioned Spec Stack dashboard", { timeout: 300_000 }, async function () {
  const app = await ensureAppInstalled();
  live.appId = app.id;
  live.appVersion = app.version;
  const token = await loadLiveFixture().then((fixture) => fixture.userToken("alice"));
  const catalog = await specCatalog(token);
  expectOk("spec_catalog", catalog);
  this.catalogBefore = catalog.data.specs;
  const dashboard = (await admin().call("GET", "/api/dashboards?fields=id,name&$top=200")) ?? [];
  let stack = dashboard.find((entry) => entry.name === "Spec Stack");
  if (!stack) {
    const token = await loadLiveFixture().then((fixture) => fixture.userToken("admin"));
    await execFileAsync(
      process.execPath,
      [path.join(REPO_ROOT, "scripts", "spec-dashboard-setup.mjs"), "--host", YT_URL, "--token", token],
      { timeout: 120_000 },
    );
    stack = ((await admin().call("GET", "/api/dashboards?fields=id,name&$top=200")) ?? [])
      .find((entry) => entry.name === "Spec Stack");
  }
  assert.ok(stack, "the Spec Stack dashboard must be provisioned");
  this.dashboardBefore = await dashboardState(stack.id);
});

When("the same app ZIP is installed again", { timeout: 600_000 }, async function () {
  this.adminPage = this.adminPage ?? await newPage(this);
  await browserLogin(this.adminPage, "admin", ADMIN_PASSWORD);
  await openAppsPage(this.adminPage);
  await uploadAppZip(this.adminPage, live.zipPath);
  // The package replacement re-registers the widget; the operator's upgrade
  // path converges the dashboard (same canonical provisioner as setup phase 8).
  const token = await loadLiveFixture().then((fixture) => fixture.userToken("admin"));
  await execFileAsync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts", "spec-dashboard-setup.mjs"), "--host", YT_URL, "--token", token],
    { timeout: 120_000 },
  );
});

Then("the app id and version are unchanged", async function () {
  const app = await admin().appByName(APP_NAME);
  assert.equal(app.id, live.appId, "a reinstall must preserve the app id");
  assert.equal(app.version, live.appVersion, "a reinstall must preserve the version");
});

Then("the spec catalog is unchanged", async function () {
  const token = await loadLiveFixture().then((fixture) => fixture.userToken("alice"));
  const catalog = await specCatalog(token);
  expectOk("spec_catalog", catalog);
  assert.deepEqual([...catalog.data.specs].sort(), [...this.catalogBefore].sort());
});

Then("the dashboard keeps one spec-board widget", async function () {
  const after = await dashboardState(this.dashboardBefore.id);
  const boards = (after.widgets ?? []).filter((widget) => widget.key === "spec-board");
  assert.equal(boards.length, 1, "a reinstall must not duplicate the board");
});

// ---- SCEN-delivery-demo -----------------------------------------------------

const DEMO_DOCS = Object.freeze({
  "README.md": "# Delivery Demo\n\nStatus: DRAFT\n\nOpt-in demo spec for the live delivery E2E.\n",
  "FR.md": "# Functional Requirements\n\n## FR-1: Demo requirement\n\nThe demo SHALL expose one requirement.\n",
  "NFR.md": "# Non-Functional Requirements\n\n## NFR-DEMO-1: Demo constraint\n\nThe demo SHALL stay bounded.\n",
  "ACCEPTANCE_CRITERIA.md": "# Acceptance Criteria\n\n## AC-1.1: Demo criterion\n\n**EARS:** WHEN the demo is loaded THEN it is visible.\n",
  "TASKS.md": "# Tasks\n\n## TASK-1: Demo task\n\n**Status:** todo\n\n**Requirements:** [FR-1](FR.md#fr-1-demo-requirement)\n\n**Done When:** the demo is deletable.\n",
});

const DEMO_REVIEW = Object.freeze({
  schemaVersion: "omp-spec-kit/design-review@1",
  decision: "proceed",
  boundary: {
    kind: "user-visible-contract",
    name: "Spec Graph demo board",
    claim: "an explicit demo load shows every entity kind; a fresh install shows zero demo specs",
  },
  evidence: [
    { kind: "test", reference: "tests/features/app-install-live.feature", observation: "the live app-install journey exercises the installed package and the Spec Service page" },
    { kind: "source", reference: "skills/spec-stack-setup/template/roadmap-demo/README.md", observation: "the demo template is marked Demo: true and is loaded only by the demo contour" },
    { kind: "documentation", reference: "skills/spec-stack-setup/SKILL.md", observation: "--no-demo is the fresh-install path and seeds no specifications" },
  ],
  alternatives: [
    { option: "auto-seed the demo in every install", reasonRejected: "a fresh install must have zero valid specs in the dashboard" },
    { option: "hide the demo behind a separate app", reasonRejected: "the demo is a specification fixture and must exercise the same projection and delete path" },
  ],
  selfTestCheck: {
    status: "passed",
    mutation: "failed-as-expected",
    command: "node skills/spec-stack-setup/setup.mjs --no-demo",
    hypothesis: "the fresh-install path must not create any demo specification",
    answer: "--no-demo leaves the registry and dashboard without demo specs",
    positiveCase: "--no-demo is the fresh-install path and seeds nothing",
    negativeCase: "the demo template directory is present and the default demo path loads it",
    expectedFailure: "a fresh install that seeds the demo would show a valid demo spec",
    observedFailure: "the demo spec appears only when the demo loader is enabled, not on --no-demo",
  },
});

Given("an explicit demo spec is created through MCP", { timeout: 300_000 }, async function () {
  const liveFixture = await loadLiveFixture();
  const alice = await liveFixture.userToken("alice");
  live.demoSpec = `delivery-demo-${Date.now().toString(36)}`;
  await mutateWithRetry(alice, "stgmt/alpha", "spec_branch", {
    action: "create",
    spec: live.demoSpec,
    demo: true,
    requestId: "delivery-demo-create",
  });
  await mutateWithRetry(alice, "stgmt/alpha", "spec_claim", { spec: live.demoSpec, requestId: "delivery-demo-claim" });
  for (const [document, content] of Object.entries(DEMO_DOCS)) {
    await mutateWithRetry(alice, "stgmt/alpha", "spec_patch", {
      intent: "patch",
      spec: live.demoSpec,
      dryRun: false,
      reason: "live delivery demo",
      requestId: `delivery-demo-${document.replace(/\W/gu, "-")}`,
      operations: [{ kind: "replace_document", document, content }],
    });
  }
  const featureDocument = `${live.demoSpec}.feature`;
  await mutateWithRetry(alice, "stgmt/alpha", "spec_patch", {
    intent: "patch",
    spec: live.demoSpec,
    dryRun: false,
    reason: "live delivery demo",
    requestId: "delivery-demo-feature",
    operations: [{
      kind: "replace_document",
      document: featureDocument,
      content: "Feature: Delivery demo\n\n  @id:SCEN-delivery-demo-live\n  Scenario: the demo is readable\n    Given the demo exists\n    Then an authorized caller reads it\n",
    }],
    designReview: DEMO_REVIEW,
  });
  await mutateWithRetry(alice, "stgmt/alpha", "spec_release", { spec: live.demoSpec, requestId: "delivery-demo-release" });
  await syncSnapshot();
});

Then("the demo spec contains representative entity kinds", async function () {
  const liveFixture = await loadLiveFixture();
  const alice = await liveFixture.userToken("alice");
  const board = await boardFor(alice, [live.demoSpec]);
  expectOk("spec_graph demo", board);
  const kinds = new Set((board.data.nodes ?? []).map((node) => node.kind));
  for (const kind of ["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT", "ACCEPTANCE_CRITERION", "TASK", "SCENARIO"]) {
    assert.ok(kinds.has(kind), `demo is missing ${kind}: ${[...kinds].join(", ")}`);
  }
});

When("the owner deletes the demo spec", { timeout: 300_000 }, async function () {
  const liveFixture = await loadLiveFixture();
  const carol = await liveFixture.userToken("carol");
  const deleted = await mutateWithRetry(carol, "stgmt/alpha", "spec_branch", {
    action: "deleteSpec",
    spec: live.demoSpec,
    requestId: "delivery-demo-delete",
  });
  expectOk("spec_branch deleteSpec", deleted);
  await syncSnapshot();
});

Then("all demo cards and snapshot nodes are removed", async function () {
  const liveFixture = await loadLiveFixture();
  const alice = await liveFixture.userToken("alice");
  const catalog = await specCatalog(alice);
  expectOk("spec_catalog after delete", catalog);
  assert.ok(!catalog.data.specs.includes(live.demoSpec), "the demo spec must leave the catalog");
  const board = await boardFor(alice);
  expectOk("spec_graph after delete", board);
  const demoNodes = (board.data.nodes ?? []).filter((node) => node.specSlug === live.demoSpec);
  assert.deepEqual(demoNodes, [], "the committed snapshot must not retain demo nodes");
});

Then("the other specs are untouched", async function () {
  const liveFixture = await loadLiveFixture();
  const alice = await liveFixture.userToken("alice");
  const catalog = await specCatalog(alice);
  expectOk("spec_catalog others", catalog);
  assert.ok(catalog.data.specs.includes("alpha-spec"), "the seeded spec must survive");
  const board = await boardFor(alice);
  expectOk("spec_graph others", board);
  assert.ok((board.data.nodes ?? []).some((node) => node.specSlug === "alpha-spec"));
});

// ---- SCEN-delivery-agent-warning -------------------------------------------

Given("the plugin is installed without a corpus or MCP configuration", async function () {
  this.emptyRoot = await mkdtemp(path.join(tmpdir(), "delivery-empty-root-"));
  this.emptyHome = await mkdtemp(path.join(tmpdir(), "delivery-empty-home-"));
});

When("a session starts", async function () {
  this.plugin = await OmpSpecKitSetup({ directory: this.emptyRoot, home: this.emptyHome });
  this.firstParts = [];
  await this.plugin["chat.message"]({}, { parts: this.firstParts });
  this.secondParts = [];
  await this.plugin["chat.message"]({}, { parts: this.secondParts });
});

Then("one bounded warning names the next action", async function () {
  assert.equal(this.firstParts.length, 1, "exactly one warning part");
  assert.equal(this.firstParts[0].type, "text");
  assert.match(this.firstParts[0].text, /SPEC_SETUP_REQUIRED|spec-stack-setup|setup/u);
  assert.ok(this.firstParts[0].text.length <= 2_000, "the warning must stay bounded");
});

Then("it does not block and contains no secrets", async function () {
  assert.equal(this.secondParts.length, 0, "the warning fires once per session");
  const text = this.firstParts[0].text;
  assert.doesNotMatch(text, /perm-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|serviceBridgeToken\s*[:=]/u);
});

Then("a configured project stays silent", async function () {
  const configuredHome = await mkdtemp(path.join(tmpdir(), "delivery-configured-home-"));
  const configRoot = path.join(configuredHome, ".config", "opencode");
  await mkdir(configRoot, { recursive: true });
  await writeFile(path.join(configRoot, "spec-kit-guard.json"), JSON.stringify({ registryServer: "spec-registry" }));
  await writeFile(path.join(configRoot, "opencode.json"), JSON.stringify({
    mcp: { "spec-registry": { type: "remote", url: "http://127.0.0.1:1/mcp" } },
  }));
  const plugin = await OmpSpecKitSetup({ directory: this.emptyRoot, home: configuredHome });
  const parts = [];
  await plugin["chat.message"]({}, { parts });
  assert.deepEqual(parts, [], "a configured project must not warn");
  rmSync(this.emptyRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  rmSync(this.emptyHome, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  rmSync(configuredHome, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
});
