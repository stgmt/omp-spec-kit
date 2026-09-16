import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { After, AfterAll, Before, BeforeAll, Given, setDefaultTimeout, Status, Then, When } from "@cucumber/cucumber";
import { chromium } from "playwright-core";
import { ADMIN_PASSWORD, APP_NAME, BRIDGE_TOKEN, USERS, deployApp } from "../e2e/lib/bootstrap.mjs";
import { E2E_DIR, SERVICE_URL, YT_URL } from "../e2e/lib/compose.mjs";
import { createYouTrackAdmin } from "../e2e/lib/youtrack.mjs";
import { browserLogin, widgetFrame } from "../e2e/lib/browser.mjs";
import { attachAppToProjectViaUI, fillAppSettings, openAppsPage, openAppTab, uploadAppZip } from "../e2e/lib/app-admin-ui.mjs";
import { ensureExtYoutrack, extAdmin, extBindBody, EXT_YT_HOST_URL, EXT_TENANT, EXT_USERS } from "../e2e/lib/idp-fixture.mjs";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const RUN_LIVE = path.join(REPO_ROOT, "tests", "e2e", "run-live.mjs");
const ARTIFACTS = path.join(E2E_DIR, "artifacts");
const APP_DIR = path.join(REPO_ROOT, "tools", "spec-graph-app");
const SERVICE_SETTINGS = {
  serviceUrl: "http://spec-registryd:8642",
  serviceBridgeToken: BRIDGE_TOKEN,
};

// Stack bring-up and UI steps both far exceed the 5s cucumber default.
setDefaultTimeout(300_000);

/** Suite-level state built once by BeforeAll (the stack run takes minutes). */
const live = { issue: null, zipPath: null, manifest: null, browser: null };
const admin = () => createYouTrackAdmin({ login: "admin", password: ADMIN_PASSWORD });
const basicAuth = `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`;

// These hooks bootstrap a real compose stack and a browser — they must not
// fire for unrelated cucumber runs. cucumber.mjs glob-imports every step
// file for ALL runs (docker-bdd container, safe-authoring, staged, …), so
// the container check alone is not enough: on a host runner the stack would
// still be built. Register the hooks only when this invocation explicitly
// targets the live feature (or is opted in via env for debugging).
const hostOnly = process.env.OMP_SPEC_KIT_BDD_CONTAINER !== "1"
  && process.env.OMP_SPEC_KIT_LIVE_E2E === "1";
if (hostOnly) BeforeAll({ timeout: 900_000 }, async () => {
  // Real stack, no app: the scenario uploads it through the UI itself.
  const { stdout } = await execFileAsync(
    process.execPath, [RUN_LIVE, "--bootstrap-only", "--skip-app"],
    { timeout: 840_000, maxBuffer: 16 * 1024 * 1024 },
  ).catch((error) => {
    throw new Error(`stack bootstrap failed: ${(error.stdout ?? error.message).slice(-2000)}`);
  });
  console.log(stdout.trim().split("\n").pop());

  // A previous run may have left the app installed — remove it via the API so
  // the scenario exercises a genuine fresh upload (the UI path is the test).
  const installed = await admin().appByName(APP_NAME).catch(() => null);
  if (installed) await admin().uninstallApp(installed.id);

  // The exact artifact CI produces — same build command, same output path.
  const manifest = JSON.parse(await readFile(path.join(APP_DIR, "manifest.json"), "utf8"));
  live.manifest = manifest;
  live.zipPath = path.join(REPO_ROOT, "dist", `${APP_NAME}-${manifest.version}.zip`);
  await execFileAsync(process.execPath, [path.join(REPO_ROOT, "scripts", "build-youtrack-app.mjs")], { timeout: 120_000 });

  // The anchor issue is provisioned by the bootstrap; fetch it like the
  // fixture does (it is not persisted to projects.json).
  const issues = await fetch(`${YT_URL}/api/issues?query=project:SPEC&fields=id,idReadable`, {
    headers: { authorization: basicAuth, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  }).then((response) => (response.ok ? response.json() : []));
  assert.ok(Array.isArray(issues) && issues.length > 0, "no anchor issue in project SPEC");
  live.issue = issues[0];

  live.browser = await chromium.launch({ channel: "chrome", headless: true });
});

if (hostOnly) Before(async function () {
  this.adminPage = await live.browser.newPage();
  this.adminPage.setDefaultTimeout(60_000);
});

if (hostOnly) AfterAll(async () => {
  await live.browser?.close();
});

// Failure artifact: whatever the operator would see on screen at the point
// of failure — admin page and alice's issue page side by side.
if (hostOnly) After(async function (scenario) {
  if (scenario.result?.status !== Status.FAILED) return;
  for (const [name, page] of [["admin", this.adminPage], ["alice", this.alicePage], ["mia", this.miaPage]]) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(ARTIFACTS, `live-failed-${name}.png`), fullPage: true }).catch(() => {});
    }
  }
});

Given("the live stack without the spec-graph-app installed", async function () {
  const health = await fetch(`${SERVICE_URL}/health`, { signal: AbortSignal.timeout(5_000) });
  assert.ok(health.ok, "spec-registryd is not healthy — the UI suite needs the live stack");
  const installed = await admin().appByName(APP_NAME).catch(() => null);
  assert.equal(installed, null, `${APP_NAME} must be absent before the UI upload`);
});

Given("the built release zip", async function () {
  const { size } = await stat(live.zipPath);
  assert.ok(size > 0, `release zip missing: ${live.zipPath}`);
});

When("the admin signs in and opens the Apps administration page", async function () {
  await browserLogin(this.adminPage, "admin", ADMIN_PASSWORD);
  await openAppsPage(this.adminPage);
});

When("uploads the zip through the Add app menu", async function () {
  await uploadAppZip(this.adminPage, live.zipPath);
  await this.adminPage.screenshot({ path: path.join(ARTIFACTS, "live-upload.png"), fullPage: true }).catch(() => {});
});

Then("the app card opens for the uploaded app", async function () {
  assert.match(this.adminPage.url(), /selected=\d+-\d+/, "the app card must auto-select after upload");
  await this.adminPage.getByText("Spec Graph", { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
});

Then("the installed version equals the manifest version", async function () {
  const app = await admin().appByName(APP_NAME);
  assert.equal(app.version, live.manifest.version);
});

When("the admin attaches the app to the Spec E2E project", async function () {
  await openAppTab(this.adminPage, "Projects");
  await attachAppToProjectViaUI(this.adminPage, "Spec E2E");
  // The Projects tab badge counts usages; assert the attach landed via API.
  const app = await admin().appByName(APP_NAME);
  const usages = await admin().call("GET", `/api/admin/apps/${app.id}/usages?fields=id,project(shortName)`);
  assert.ok(usages.some((u) => u.project?.shortName === "SPEC"), `SPEC missing from usages: ${JSON.stringify(usages)}`);
});

// YouTrack does not mount the widget while required settings are empty
// (verified live: globalSettings {} -> no iframe). A syntactically valid but
// unreachable URL mounts the widget and surfaces the handler's error —
// the honest way to exercise the failure UX through the UI.
When("the admin fills the service connection settings with an unreachable URL", async function () {
  await openAppTab(this.adminPage, "Settings");
  await fillAppSettings(this.adminPage, { ...SERVICE_SETTINGS, serviceUrl: "http://spec-registryd:9999" });
});

When("alice opens the SPEC anchor issue", async function () {
  this.aliceContext = await live.browser.newContext();
  this.alicePage = await this.aliceContext.newPage();
  this.alicePage.setDefaultTimeout(60_000);
  await browserLogin(this.alicePage, "alice", USERS.alice.password);
  await this.alicePage.goto(`${YT_URL}/issue/${live.issue.idReadable}`, { waitUntil: "domcontentloaded" });
});

Then("the service widget shows a connection error", async function () {
  const frame = await widgetFrame(this.alicePage);
  const text = await frame.locator('[data-testid="service-error"]').innerText();
  assert.ok(text.trim().length > 0, "an unreachable service must surface a readable error");
  await this.alicePage.screenshot({ path: path.join(ARTIFACTS, "live-widget-error.png"), fullPage: true }).catch(() => {});
});

When("the admin fills the service connection settings", async function () {
  await openAppTab(this.adminPage, "Settings");
  await fillAppSettings(this.adminPage, SERVICE_SETTINGS);
  // Persisted config is the observable result of the UI save.
  const app = await admin().appByName(APP_NAME);
  const config = await admin().call("GET", `/api/admin/apps/${app.id}/globalConfig?fields=globalSettings`);
  const saved = JSON.parse(config.globalSettings ?? "{}");
  assert.equal(saved.serviceUrl, SERVICE_SETTINGS.serviceUrl, `settings not saved: ${config.globalSettings}`);
});

When("alice reloads the anchor issue", async function () {
  await this.alicePage.goto(`${YT_URL}/issue/${live.issue.idReadable}`, { waitUntil: "domcontentloaded" });
});

Then("the service widget lists alpha-spec", async function () {
  const frame = await widgetFrame(this.alicePage);
  const text = await frame.locator('[data-testid="spec-list"]').innerText();
  assert.match(text, /alpha-spec/, "the UI-installed app must render the remote spec");
  await this.alicePage.screenshot({ path: path.join(ARTIFACTS, "live-widget-specs.png"), fullPage: true }).catch(() => {});
});

// ---- TASK-17: BYO specs repository through the widget ----------------------

const BYO_REPO_URL = "git://spec-git/byo.git";
const BYO_REPO_PATH = "/srv/git/byo.git";

/** Widget's inner frame once the repo section is rendered (spec list or repo list). */
async function widgetRepoFrame(page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const marker = await frame.locator('[data-testid="repo-form"], [data-testid="repo-list"], [data-testid="service-error"]').count().catch(() => 0);
      if (marker > 0) return frame;
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error("widget repo section did not render");
}

Given("the spec-graph-app is installed with the service settings", async function () {
  const app = await admin().appByName(APP_NAME);
  assert.ok(app, `${APP_NAME} must be installed (previous scenario uploads it)`);
  const config = await admin().call("GET", `/api/admin/apps/${app.id}/globalConfig?fields=globalSettings`);
  const saved = JSON.parse(config.globalSettings ?? "{}");
  assert.equal(saved.serviceUrl, SERVICE_SETTINGS.serviceUrl, "service settings must be in place");
});

Given("a second specs repo exists in the stack", async function () {
  // The compose git daemon exports anything under /srv/git with receive-pack
  // enabled — a second bare repo is a second tenant's repository.
  const script = `if [ ! -d "${BYO_REPO_PATH}" ]; then git init --bare --initial-branch=main "${BYO_REPO_PATH}"; fi && ls "${BYO_REPO_PATH}/HEAD"`;
  const { stdout } = await execFileAsync("docker", ["exec", "spec-auth-e2e-spec-git-1", "sh", "-c", script]);
  assert.match(stdout, /HEAD/u, `byo repo was not created: ${stdout}`);
});

Given("alice is viewing the SPEC anchor issue", async function () {
  this.aliceContext = await live.browser.newContext();
  this.alicePage = await this.aliceContext.newPage();
  this.alicePage.setDefaultTimeout(60_000);
  await browserLogin(this.alicePage, "alice", USERS.alice.password);
  await this.alicePage.goto(`${YT_URL}/issue/${live.issue.idReadable}`, { waitUntil: "domcontentloaded" });
  await widgetRepoFrame(this.alicePage);
});

When("alice tests the repository connection in the widget", async function () {
  const frame = await widgetRepoFrame(this.alicePage);
  await frame.locator('[data-testid="repo-url"]').fill(BYO_REPO_URL);
  await frame.locator('[data-testid="repo-token"]').fill("e2e-unused-git-daemon");
  await frame.locator('[data-testid="repo-branch"]').fill("main");
  await frame.locator('[data-testid="repo-test"]').click();
  await frame.locator('[data-testid="repo-result"][data-outcome="ok"]').waitFor({ state: "attached", timeout: 30_000 });
});

Then("the widget reports the repository connection is ok", async function () {
  const frame = await widgetRepoFrame(this.alicePage);
  const text = await frame.locator('[data-testid="repo-result"]').innerText();
  assert.match(text, /connection ok/u, `probe outcome: ${text}`);
});

When("alice binds the project to her repository", async function () {
  const frame = await widgetRepoFrame(this.alicePage);
  await frame.locator('[data-testid="repo-url"]').fill(BYO_REPO_URL);
  await frame.locator('[data-testid="repo-token"]').fill("e2e-unused-git-daemon");
  await frame.locator('[data-testid="repo-bind"]').click();
  // The widget reloads after a successful bind — wait for the bound state.
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const bound = await widgetRepoFrame(this.alicePage)
      .then((f) => f.locator('[data-testid="repo-status-active"]').count())
      .catch(() => 0);
    if (bound > 0) return;
    await this.alicePage.waitForTimeout(1_500);
  }
  throw new Error("widget never reached the bound state after bind");
});

Then("the widget shows the bound repository state", async function () {
  const frame = await widgetRepoFrame(this.alicePage);
  const text = await frame.locator('[data-testid="repo-list"]').innerText();
  assert.match(text, /byo\.git/u, `binding not visible: ${text}`);
  await this.alicePage.screenshot({ path: path.join(ARTIFACTS, "live-widget-repo-bound.png"), fullPage: true }).catch(() => {});
});

Then("the project specs landed in her repository", async function () {
  const { stdout } = await execFileAsync("docker", [
    "exec", "spec-auth-e2e-spec-git-1", "git", `--git-dir=${BYO_REPO_PATH}`, "show", "main:stgmt/alpha/.specs/alpha-spec/README.md",
  ]);
  assert.match(stdout, /Alpha Spec/u, `migrated README missing in byo repo: ${stdout.slice(0, 200)}`);
});

When("alice unbinds the project in the widget", async function () {
  const frame = await widgetRepoFrame(this.alicePage);
  await frame.locator('[data-testid="repo-unbind"]').click();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const back = await widgetRepoFrame(this.alicePage)
      .then((f) => f.locator('[data-testid="repo-status-default"]').count())
      .catch(() => 0);
    if (back > 0) return;
    await this.alicePage.waitForTimeout(1_500);
  }
  throw new Error("widget never returned to the default state after unbind");
});

Then("the project uses the default repository again", async function () {
  // The default clone still holds the migrated-away snapshot; reads resolve there.
  const { stdout } = await execFileAsync("docker", [
    "exec", "spec-auth-e2e-spec-git-1", "git", "--git-dir=/srv/git/specs.git", "show", "main:stgmt/alpha/.specs/alpha-spec/README.md",
  ]);
  assert.match(stdout, /Alpha Spec/u, "default repo must still carry alpha-spec");
});

// --- TASK-13: external YouTrack binding through the widget -----------------
// The customer-IdP flow end to end: the ext YouTrack is a real second
// instance in the same compose network; the app upload on it goes through
// the official CLI exactly like the operator install.

/** Widget frame once the IdP section is rendered. */
async function widgetIdpFrame(page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const marker = await frame.locator('[data-testid="idp-form"], [data-testid="idp-list"], [data-testid="service-error"]').count().catch(() => 0);
      if (marker > 0) return frame;
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error("widget IdP section did not render");
}

Given("a second YouTrack is provisioned for the external tenant", async function () {
  live.ext = await ensureExtYoutrack();
  // A previous run's binding persists in the service volume — the widget
  // only shows the install block on a fresh bind, so unbind first. Carol is
  // an owner on the operator IdP and may unbind any tenant.
  const carol = await admin().findUserByLogin("carol");
  const serviceIds = [await admin().youtrackServiceId(), await admin().hubServiceId()];
  const ownerToken = await admin().createPermanentToken({ userId: carol.id, name: "idp-e2e-owner", serviceIds });
  await fetch(`${SERVICE_URL}/idp/unbind`, {
    method: "POST",
    headers: { authorization: `Bearer ${ownerToken.token}`, "content-type": "application/json" },
    body: JSON.stringify({ tenant: EXT_TENANT }),
  }).then((r) => r.json()).catch(() => ({})); // NOT_BOUND tolerated
  await admin().revokePermanentTokens({ userId: carol.id, name: "idp-e2e-owner" });
  // The ext tenant needs its own project + anchor issue for the app to
  // attach to, and mia on the project team so the widget renders for her.
  const ext = extAdmin();
  const me = await ext.meNative();
  const project = await ext.createProject({ name: "Acme E2E", shortName: "ACME", leaderId: me.id });
  const hubProjectId = await ext.hubProjectId("ACME");
  await ext.addUserToProjectTeam({ hubProjectId, userId: live.ext.users.mia.id });
  const existing = await fetch(`${EXT_YT_HOST_URL}/api/issues?query=project:ACME&fields=id,idReadable`, {
    headers: { authorization: basicAuth, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    live.ext.issue = existing[0];
  } else {
    const created = await fetch(`${EXT_YT_HOST_URL}/api/issues?fields=id,idReadable`, {
      method: "POST",
      headers: { authorization: basicAuth, "content-type": "application/json" },
      body: JSON.stringify({ project: { id: project.id }, summary: "External IdP E2E anchor issue" }),
      signal: AbortSignal.timeout(30_000),
    });
    assert.ok(created.ok, `ext anchor issue creation failed: ${created.status}`);
    live.ext.issue = await created.json();
  }
  live.ext.project = project;
});

When("alice binds the external YouTrack in the widget", async function () {
  const frame = await widgetIdpFrame(this.alicePage);
  const body = extBindBody({ serviceToken: live.ext.serviceToken });
  await frame.locator('[data-testid="idp-tenant"]').fill(body.tenant);
  await frame.locator('[data-testid="idp-url"]').fill(body.youtrackUrl);
  await frame.locator('[data-testid="idp-token"]').fill(body.serviceToken);
  await frame.locator('[data-testid="idp-projects"]').fill(body.projects.join(","));
  await frame.locator('[data-testid="idp-hubgroups"]').fill(body.hubGroups.join(","));
  await frame.locator('[data-testid="idp-owners"]').fill(body.roleGroups.owner.join(","));
  await frame.locator('[data-testid="idp-writers"]').fill(body.roleGroups.writer.join(","));
  await frame.locator('[data-testid="idp-readers"]').fill(body.roleGroups.reader.join(","));
  await frame.locator('[data-testid="idp-test"]').click();
  await frame.locator('[data-testid="idp-result"][data-outcome="ok"]').waitFor({ state: "attached", timeout: 30_000 });
  await frame.locator('[data-testid="idp-bind"]').click();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const bound = await widgetIdpFrame(this.alicePage)
      .then((f) => f.locator(`[data-testid="idp-row-${EXT_TENANT}"] [data-testid="idp-status-active"]`).count())
      .catch(() => 0);
    if (bound > 0) return;
    await this.alicePage.waitForTimeout(1_500);
  }
  throw new Error("widget never reached the bound IdP state");
});

Then("the widget shows the minted app settings for the external tenant", async function () {
  const frame = await widgetIdpFrame(this.alicePage);
  const install = frame.locator('[data-testid="idp-install"]');
  await install.waitFor({ state: "visible", timeout: 15_000 });
  const text = await install.innerText();
  const urlMatch = text.match(/serviceUrl = (\S+)/);
  assert.ok(urlMatch, `install block missing serviceUrl: ${text}`);
  const tokenMatch = text.match(/serviceBridgeToken = (\S+)/);
  assert.ok(tokenMatch, `install block missing the minted bridge token: ${text}`);
  live.ext.serviceUrl = urlMatch[1];
  live.ext.bridgeToken = tokenMatch[1];
  await this.alicePage.screenshot({ path: path.join(ARTIFACTS, "live-widget-idp-bound.png"), fullPage: true }).catch(() => {});
});

When("the app is installed on the external YouTrack with the minted settings", async function () {
  const appId = await deployApp({ admin: extAdmin(), token: live.ext.serviceToken, hostUrl: EXT_YT_HOST_URL });
  // Use the settings exactly as the widget displayed them — the operator
  // copies serviceUrl + bridge token into their own YouTrack's app settings.
  await extAdmin().setAppSettings(appId, { serviceUrl: live.ext.serviceUrl, serviceBridgeToken: live.ext.bridgeToken });
  await extAdmin().attachAppToProject(appId, live.ext.project.id);
});

Then("mia sees her tenant specs through the external app", async function () {
  this.miaContext = await live.browser.newContext();
  this.miaPage = await this.miaContext.newPage();
  this.miaPage.setDefaultTimeout(60_000);
  await browserLogin(this.miaPage, "mia", EXT_USERS.mia.password, EXT_YT_HOST_URL);
  await this.miaPage.goto(`${EXT_YT_HOST_URL}/issue/${live.ext.issue.idReadable}`, { waitUntil: "domcontentloaded" });
  const frame = await widgetFrame(this.miaPage);
  const text = await frame.locator('[data-testid="spec-list"]').innerText();
  assert.match(text, /gamma-spec/, `ext widget must list the tenant spec, got: ${text}`);
  await this.miaPage.screenshot({ path: path.join(ARTIFACTS, "live-widget-idp-mia.png"), fullPage: true }).catch(() => {});
});

When("alice unbinds the external YouTrack in the widget", async function () {
  const frame = await widgetIdpFrame(this.alicePage);
  await frame.locator(`[data-testid="idp-row-${EXT_TENANT}"] [data-testid="idp-unbind"]`).click();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const gone = await widgetIdpFrame(this.alicePage)
      .then((f) => f.locator(`[data-testid="idp-row-${EXT_TENANT}"]`).count())
      .catch(() => 0);
    if (gone === 0) return;
    await this.alicePage.waitForTimeout(1_500);
  }
  throw new Error("widget still shows the binding after unbind");
});

Then("the external tenant loses access", async function () {
  // Direct token and minted bridge secret both die with the binding — the
  // auth cache may serve the previous ctx for up to its TTL, so poll.
  const deadline = Date.now() + 30_000;
  for (;;) {
    const direct = await fetch(`${SERVICE_URL}/me`, { headers: { authorization: `Bearer ${live.ext.users.mia.token}` } });
    const bridge = await fetch(`${SERVICE_URL}/me`, {
      headers: { authorization: `Bearer ${live.ext.bridgeToken}`, "x-spec-user": "mia" },
    });
    if (direct.status === 401 && bridge.status === 401) return;
    if (Date.now() > deadline) {
      throw new Error(`access not revoked within 30s (direct=${direct.status}, bridge=${bridge.status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
});
