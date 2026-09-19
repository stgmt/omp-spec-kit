#!/usr/bin/env node
/**
 * Live auth E2E (TASK-12) — real YouTrack, real git, real service.
 * No mocks, no fallbacks: every assertion runs against the compose stack
 * `spec-auth-e2e`, including the browser login into "our YouTrack".
 *
 * Usage:
 *   node tests/e2e/run-live.mjs            # full run (wizard if needed)
 *   node tests/e2e/run-live.mjs --reset    # wipe volumes first (re-runs the wizard)
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright-core";
import { compose, composeEnv, containerLogs, E2E_DIR, SERVICE_URL, waitFor, YT_URL } from "./lib/compose.mjs";
import { completeWizard, youtrackNeedsWizard } from "./lib/wizard.mjs";
import { ADMIN_PASSWORD, bootstrapFixture, USERS } from "./lib/bootstrap.mjs";
import { appFrame, browserLogin } from "./lib/browser.mjs";

const execFileAsync = promisify(execFile);
const ARTIFACTS = path.join(E2E_DIR, "artifacts");
const CONFIG_PATH = path.join(ARTIFACTS, "projects.json");

const results = [];
function record(id, title, ok, detail = "") {
  results.push({ id, title, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${title}${detail ? ` — ${detail}` : ""}`);
}

async function scenario(id, title, fn) {
  try {
    const detail = await fn();
    record(id, title, true, detail ?? "");
  } catch (error) {
    record(id, title, false, error?.message?.slice(0, 220) ?? String(error));
    throw error;
  }
}

async function mcpCall(token, { method, params, headers = {} }) {
  const response = await fetch(`${SERVICE_URL}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, text };
}

async function toolCall(token, name, args, headers) {
  const { json, status, text } = await mcpCall(token, { method: "tools/call", params: { name, arguments: args }, headers });
  if (!json) throw new Error(`non-JSON response (${status}): ${text.slice(0, 160)}`);
  return json.result;
}

async function callTool(token, name, args, headers) {
  const { json, status, text } = await mcpCall(token, { method: "tools/call", params: { name, arguments: args }, headers });
  if (!json?.result) throw new Error(`tool call failed (${status}): ${text.slice(0, 200)}`);
  return json.result;
}

async function remoteLog(gitUrl, args) {
  const work = path.join(ARTIFACTS, "remote");
  await rm(work, { recursive: true, force: true });
  await execFileAsync("git", ["clone", "--no-tags", gitUrl, work]);
  const output = (await execFileAsync("git", args, { cwd: work })).stdout.trim();
  return { work, output };
}

async function main() {
  const reset = process.argv.includes("--reset");
  // --bootstrap-only: bring the stack up and stop before the scenarios (the
  // UI BDD suite drives the operator path itself). --skip-app additionally
  // leaves the app uninstalled so the suite can upload it through the UI.
  const bootstrapOnly = process.argv.includes("--bootstrap-only");
  const skipApp = process.argv.includes("--skip-app");
  if (skipApp && !bootstrapOnly) {
    console.warn("--skip-app only makes sense with --bootstrap-only: the scenarios need the app installed");
  }
  await mkdir(ARTIFACTS, { recursive: true });

  if (reset) {
    compose(["down", "-v"], { env: composeEnv({ configPath: CONFIG_PATH }), allowFailure: true });
  }

  console.log("phase 1: youtrack + spec-git");
  compose(["up", "-d", "--build", "youtrack", "spec-git"], { env: composeEnv({ configPath: CONFIG_PATH }) });
  await waitFor(`${YT_URL}/`, { label: "YouTrack HTTP", timeoutMs: 300_000 });

  if (await youtrackNeedsWizard()) {
    await completeWizard({ adminPassword: ADMIN_PASSWORD });
  } else {
    console.log("wizard: already configured (volume persists)");
  }

  console.log("phase 2: bootstrap fixture (live APIs)");
  const fixture = await bootstrapFixture({ deployApp: !skipApp, logger: (message) => console.log(`  bootstrap: ${message}`) });
  await writeFile(CONFIG_PATH, JSON.stringify(fixture.config, null, 2));

  console.log("phase 3: spec-registryd");
  // The bootstrap mints fresh tokens into the config file; force-recreate so
  // the service boots with the current config, not a stale in-memory copy.
  compose(["up", "-d", "--build", "--force-recreate", "spec-registryd"], { env: composeEnv({ configPath: CONFIG_PATH }) });
  await waitFor(`${SERVICE_URL}/health`, { label: "service health", timeoutMs: 180_000 });
  // wait until the service actually serves the seeded corpus through MCP
  await waitFor(`${SERVICE_URL}/health`, { label: "service readiness", timeoutMs: 60_000 });

  if (bootstrapOnly) {
    console.log(`bootstrap complete${skipApp ? " (app not installed)" : ""}`);
    return;
  }

  const gitUrl = "git://127.0.0.1:9418/specs.git";
  const { users } = fixture;

  await scenario("S1", "browser: alice sees only her project's specs (service data)", async () => {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(60_000);
      await browserLogin(page, "alice", USERS.alice.password);
      await page.goto(`${YT_URL}/issue/${fixture.issue.idReadable}`, { waitUntil: "domcontentloaded" });
      const frame = await appFrame(page);
      const text = await frame.locator('[data-testid="spec-list"]').innerText();
      assert.match(text, /alpha-spec/, "widget must list the spec that exists only in the service's specs repo");
      await page.screenshot({ path: path.join(ARTIFACTS, "s1-alice-widget.png"), fullPage: true }).catch(() => {});
      return "alpha-spec rendered from spec-registryd";
    } finally {
      await browser.close();
    }
  });

  await scenario("S2", "browser: alice applies a patch -> remote commit Spec-Author: alice", async () => {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(60_000);
      await browserLogin(page, "alice", USERS.alice.password);
      await page.goto(`${YT_URL}/issue/${fixture.issue.idReadable}`, { waitUntil: "domcontentloaded" });
      const frame = await appFrame(page);
      await frame.locator('[data-testid="apply-patch"]').click();
      await frame.locator('[data-testid="apply-result"][data-outcome="APPLIED"]').waitFor({ timeout: 60_000 });
      await page.screenshot({ path: path.join(ARTIFACTS, "s2-alice-applied.png"), fullPage: true }).catch(() => {});
      const { work } = await remoteLog(gitUrl, ["log", "--format=%an|%B", "-1", "main"]);
      const body = (await execFileAsync("git", ["log", "--format=%B", "-1", "main"], { cwd: work })).stdout;
      assert.match(body, /Spec-Author: alice/, "verified login must land in the trailer");
      return "widget apply -> bot commit with Spec-Author: alice";
    } finally {
      await browser.close();
    }
  });

  await scenario("S3", "browser: dave (no groups) is refused by the service", async () => {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(60_000);
      await browserLogin(page, "dave", USERS.dave.password);
      await page.goto(`${YT_URL}/issue/${fixture.issue.idReadable}`, { waitUntil: "domcontentloaded" });
      const frame = await appFrame(page);
      const text = await frame.locator('[data-testid="service-error"]').innerText();
      assert.match(text, /no scopes matched/, "service must refuse the scopeless user");
      return text.slice(0, 80);
    } finally {
      await browser.close();
    }
  });

  await scenario("S4", "agent path: alice reads her project; dave refused", async () => {
    const ok = await callTool(users.alice.token, "spec_catalog", { project: "stgmt/alpha", view: "specs" });
    assert.equal(ok.isError, false, JSON.stringify(ok.structuredContent?.error ?? {}));
    assert.ok(ok.structuredContent.data.specs.includes("alpha-spec"));
    const refused = await mcpCall(users.dave.token, { method: "tools/list" });
    assert.equal(refused.status, 403, `dave must be refused (got ${refused.status})`);
    assert.match(refused.json.error, /NO_SCOPES/);
    return "alice ok, dave 403 NO_SCOPES";
  });

  await scenario("S5", "roles: reader sees no write tools and cannot patch", async () => {
    const listed = await mcpCall(users.bob.token, { method: "tools/list" });
    assert.equal(listed.status, 200);
    const names = listed.json.result.tools.map((tool) => tool.name);
    assert.ok(!names.includes("spec_patch"), "reader must not see spec_patch");
    const denied = await callTool(users.bob.token, "spec_patch", { intent: "patch", spec: "alpha-spec", reason: "role gate", dryRun: true, operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n" }], requestId: "s5" });
    assert.equal(denied.isError, true);
    assert.match(denied.structuredContent.error.message, /requires writer role/);
    return "tools/list filtered; write denied";
  });

  await scenario("S6", "claims: CLAIM_HELD names alice; writer force requires owner", async () => {
    const claim = await callTool(users.alice.token, "spec_claim", { spec: "alpha-spec", ttlMinutes: 30, requestId: "s6-claim" });
    assert.equal(claim.isError, false, JSON.stringify(claim.structuredContent?.error ?? {}));
    const blocked = await callTool(users.erin.token, "spec_patch", {
      intent: "patch", spec: "alpha-spec", reason: "claim check", dryRun: false,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-91 — erin\n" }], requestId: "s6-erin",
    });
    assert.equal(blocked.isError, true);
    assert.equal(blocked.structuredContent.error.code, "CLAIM_HELD");
    assert.equal(blocked.structuredContent.error.holder, "alice");
    const forcedByWriter = await callTool(users.erin.token, "spec_patch", {
      intent: "patch", spec: "alpha-spec", reason: "writer force attempt", dryRun: false, force: true,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-91b — erin forced\n" }], requestId: "s6-erin-force",
    });
    assert.equal(forcedByWriter.isError, true);
    assert.match(forcedByWriter.structuredContent.error.message, /force requires owner role/);
    return `CLAIM_HELD holder=${blocked.structuredContent.error.holder}; writer force denied`;
  });

  await scenario("S7", "owner force over alice's claim lands and is logged", async () => {
    const forced = await callTool(users.carol.token, "spec_patch", {
      intent: "patch", spec: "alpha-spec", reason: "owner force", dryRun: false, force: true,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-92 — carol forced\n" }], requestId: "s7",
    });
    assert.equal(forced.isError, false, JSON.stringify(forced.structuredContent?.error ?? {}));
    assert.equal(forced.structuredContent.data.outcome, "APPLIED");
    const logs = containerLogs("spec-registryd", { tail: 200 });
    assert.match(logs, /forced write over claim.*holder=alice/, "owner force must be logged");
    return "APPLIED + forced-write log line";
  });

  await scenario("S8", "revoked token stops working within the cache TTL", async () => {
    await fixture.admin.revokePermanentToken({ userId: users.bob.id, tokenId: users.bob.tokenId });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const revoked = await mcpCall(users.bob.token, { method: "tools/list" });
    assert.equal(revoked.status, 401, `revoked token must fail (got ${revoked.status})`);
    return "401 after revocation";
  });

  await scenario("S9", "banned user is refused (token invalidated or BANNED)", async () => {
    await fixture.admin.banUser(users.carol.id, true);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const banned = await mcpCall(users.carol.token, { method: "tools/list" });
    assert.ok([401, 403].includes(banned.status), `banned user must be refused (got ${banned.status})`);
    // Bridge path resolves the user with the service token, so the BANNED
    // branch is observable there even after the ban revokes the user's token.
    const bridge = await mcpCall(fixture.config.auth.appBridge.token, { method: "tools/list", headers: { "x-spec-user": "carol" } });
    assert.equal(bridge.status, 403, `bridge for banned user must be 403 (got ${bridge.status}: ${bridge.text.slice(0, 160)})`);
    assert.match(bridge.json.error, /BANNED/);
    await fixture.admin.banUser(users.carol.id, false);
    return `token ${banned.status}; bridge 403 BANNED`;
  });

  await scenario("S10", "audit: access_log carries verified login + role; no tenants table", async () => {
    const dbPath = path.join(ARTIFACTS, "registry.db");
    await execFileAsync("docker", ["cp", "spec-auth-e2e-spec-registryd-1:/data/registry.db", dbPath]);
    const { stdout } = await execFileAsync("python", ["-c", `
import sqlite3, json
db = sqlite3.connect(${JSON.stringify(dbPath)})
rows = db.execute("SELECT login, role, op, result FROM access_log ORDER BY id").fetchall()
tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
claims = db.execute("SELECT spec_key, holder FROM claims").fetchall()
print(json.dumps({"rows": rows, "tables": tables, "claims": claims}))
`]);
    const audit = JSON.parse(stdout);
    assert.ok(!audit.tables.includes("tenants"), "tenants table must not exist");
    assert.ok(audit.rows.some((row) => row[0] === "alice" && row[1] === "writer"), "alice's write must be audited with her role");
    assert.ok(audit.claims.some(([, holder]) => holder === "alice"), "claim holder must be the verified login");
    return `${audit.rows.length} audit rows, holder=alice`;
  });

  await scenario("S11", "service restart: claim survives, cache re-verifies", async () => {
    compose(["restart", "spec-registryd"], { env: composeEnv({ configPath: CONFIG_PATH }) });
    await waitFor(`${SERVICE_URL}/health`, { label: "service after restart", timeoutMs: 180_000 });
    const read = await callTool(users.alice.token, "spec_catalog", { project: "stgmt/alpha", view: "specs" });
    assert.equal(read.isError, false, JSON.stringify(read.structuredContent?.error ?? {}));
    const dbPath = path.join(ARTIFACTS, "registry-after-restart.db");
    await execFileAsync("docker", ["cp", "spec-auth-e2e-spec-registryd-1:/data/registry.db", dbPath]);
    const { stdout } = await execFileAsync("python", ["-c", `
import sqlite3
db = sqlite3.connect(${JSON.stringify(dbPath)})
print(db.execute("SELECT holder FROM claims WHERE spec_key = 'stgmt/alpha/alpha-spec'").fetchone()[0])
`]);
    assert.equal(stdout.trim(), "alice", "claim must survive the restart");
    return "read ok after restart; claim intact";
  });

  await scenario("S12", "bridge token without the verified user header is refused", async () => {
    const response = await mcpCall(fixture.config.auth.appBridge.token, { method: "tools/list" });
    assert.equal(response.status, 401, `bridge without X-Spec-User must fail (got ${response.status})`);
    assert.match(response.json.error, /MISSING_USER/);
    return "401 MISSING_USER";
  });

  await scenario("S13", "AC-4 multi-project: an explicit project stays inside its own scope", async () => {
    const beta = await callTool(users.frank.token, "spec_catalog", { project: "stgmt/beta", view: "specs" });
    assert.equal(beta.isError, false, JSON.stringify(beta.structuredContent?.error ?? {}));
    assert.deepEqual(beta.structuredContent.data.specs, ["beta-spec"], "beta must serve only its own spec");
    const alpha = await callTool(users.frank.token, "spec_catalog", { project: "stgmt/alpha", view: "specs" });
    assert.ok(alpha.structuredContent.data.specs.includes("alpha-spec"));
    assert.ok(!alpha.structuredContent.data.specs.includes("beta-spec"), "alpha must not expose beta's spec");
    const crossRead = await callTool(users.frank.token, "spec_documents", {
      project: "stgmt/beta", action: "read", spec: "alpha-spec", doc: "README.md",
    });
    assert.equal(crossRead.isError, true, "a spec of another project must not be reachable through beta");
    const foreign = await callTool(users.alice.token, "spec_catalog", { project: "stgmt/beta", view: "specs" });
    assert.equal(foreign.isError, true, "a project outside the caller's scopes must be refused");
    return "beta=[beta-spec]; alpha=[alpha-spec]; cross-project read and foreign project refused";
  });

  await scenario("S14", "AC-4 multi-project: two matched tenants force an explicit project", async () => {
    const ambiguous = await mcpCall(users.frank.token, {
      method: "tools/call", params: { name: "spec_catalog", arguments: { view: "specs" } },
    });
    const envelope = ambiguous.json?.result?.structuredContent;
    assert.equal(envelope?.ok, false, "two matched tenants must refuse an omitted project");
    assert.match(envelope.error.message, /project is required/, `unexpected refusal: ${envelope.error.message}`);
    const single = await callTool(users.alice.token, "spec_catalog", { view: "specs" });
    assert.equal(single.isError, false, "a single matched tenant resolves its default project");
    assert.ok(single.structuredContent.data.specs.includes("alpha-spec"));
    return `ambiguous refused (${envelope.error.code}); single-tenant default resolves`;
  });

  await scenario("S15", "AC-6 proposal parity: the app path matches the agent path; a stale apply is refused", async () => {
    const operations = [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-93 — parity probe\n" }];
    const reason = "proposal parity probe";
    // The proposal hash covers the requestId, so "the same call" means the
    // same arguments on both paths; a dryRun preview is never replayed, so
    // reusing the id for the second path is safe.
    const requestId = "s15-parity";
    const app = await mcpCall(fixture.config.auth.appBridge.token, {
      method: "tools/call",
      params: { name: "spec_patch", arguments: { intent: "patch", spec: "alpha-spec", reason, dryRun: true, operations, requestId } },
      headers: { "x-spec-user": "alice" },
    });
    const appEnvelope = app.json?.result?.structuredContent;
    assert.equal(appEnvelope?.data?.outcome, "PREVIEW", JSON.stringify(appEnvelope?.error ?? {}));
    const agent = await callTool(users.alice.token, "spec_patch", {
      intent: "patch", spec: "alpha-spec", reason, dryRun: true, operations, requestId,
    });
    assert.equal(agent.structuredContent.data.outcome, "PREVIEW");
    assert.deepEqual(appEnvelope.data.operations, agent.structuredContent.data.operations, "previews must match the agent path");
    assert.equal(appEnvelope.data.proposalHash, agent.structuredContent.data.proposalHash, "proposalHash must match");
    assert.equal(appEnvelope.data.baseGenerationSha256, agent.structuredContent.data.baseGenerationSha256);
    const drifted = await callTool(users.alice.token, "spec_patch", {
      intent: "patch", spec: "alpha-spec", reason: "drift the snapshot", dryRun: false, requestId: "s15-drift",
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-94 — drift probe\n" }],
    });
    assert.equal(drifted.structuredContent.data.outcome, "APPLIED", JSON.stringify(drifted.structuredContent?.error ?? {}));
    const stale = await callTool(users.alice.token, "spec_patch", {
      intent: "patch", spec: "alpha-spec", reason, dryRun: false, operations, requestId: "s15-stale",
      repositoryRootFingerprint: appEnvelope.data.baseGenerationSha256,
    });
    assert.equal(stale.isError, true, "a proposal built on a stale snapshot must be refused, not applied");
    const refusal = stale.structuredContent.data?.error ?? stale.structuredContent.error;
    assert.equal(refusal?.code, "CONFLICT", JSON.stringify(refusal ?? {}));
    assert.equal(refusal?.retryable, true);
    // The refusal path carries the compile message (the causeCode itself is
    // dropped there — recorded as an observation, not a blocker).
    assert.match(refusal?.message ?? "", /does not match the current graph snapshot/, `unexpected refusal: ${refusal?.message}`);
    return `preview parity ok (${appEnvelope.data.proposalHash.slice(0, 12)}…); stale apply refused`;
  });

  const failed = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
  if (failed.length > 0) {
    console.log("failures:");
    for (const entry of failed) console.log(`  ${entry.id} ${entry.title}: ${entry.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`E2E run failed: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
