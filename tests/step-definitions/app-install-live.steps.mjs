import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { After, AfterAll, Before, BeforeAll, Given, setDefaultTimeout, Status, Then, When } from "@cucumber/cucumber";
import { chromium } from "playwright-core";
import { ADMIN_PASSWORD, APP_NAME, BRIDGE_TOKEN, USERS } from "../e2e/lib/bootstrap.mjs";
import { E2E_DIR, SERVICE_URL, YT_URL } from "../e2e/lib/compose.mjs";
import { createYouTrackAdmin } from "../e2e/lib/youtrack.mjs";
import { browserLogin, widgetFrame } from "../e2e/lib/browser.mjs";
import { attachAppToProjectViaUI, fillAppSettings, openAppsPage, openAppTab, uploadAppZip } from "../e2e/lib/app-admin-ui.mjs";

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
// fire for unrelated cucumber runs. The docker-bdd container glob-imports
// every step file for its release-evidence pass, where compose/docker and
// chrome do not exist; register the hooks only outside the container.
const hostOnly = process.env.OMP_SPEC_KIT_BDD_CONTAINER !== "1";
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
  for (const [name, page] of [["admin", this.adminPage], ["alice", this.alicePage]]) {
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
