import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { startService } from "../../src/service/index.js";
import { loadLiveFixture } from "../e2e/lib/live-fixture.mjs";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const servers = [];
const services = [];
const tempDirs = [];
after(async () => {
  for (const service of services) {
    service.sync?.stop();
    service.store?.close?.();
  }
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
});

async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

async function setup() {
  const fixture = await loadLiveFixture();
  const base = await tempDir("spec-onboarding-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  const seed = path.join(base, "seed");
  await execFileAsync("git", ["clone", bare, seed]);
  await git(seed, ["config", "user.email", "seed@example.invalid"]);
  await git(seed, ["config", "user.name", "seed"]);
  await cp(FIXTURE_SPEC, path.join(seed, "stgmt", "alpha", ".specs", "spec-kernel"), { recursive: true });
  await execFileAsync("git", ["-C", seed, "add", "."]);
  await execFileAsync("git", ["-C", seed, "commit", "-m", "seed"]);
  await execFileAsync("git", ["-C", seed, "push", "-q", "origin", "HEAD:refs/heads/main"]);
  await rm(seed, { recursive: true, force: true });

  const cloneDir = path.join(base, "clone");
  const configPath = await fixture.writeServiceConfig(bare);
  const service = await startService({ configPath, cloneDir, port: 0, identity: IDENTITY, logger: () => {} });
  servers.push(service.server);
  services.push(service);
  const port = service.server.address().port;
  return {
    fixture,
    bare,
    storePath: path.join(base, "registry.db"),
    serviceUrl: `http://127.0.0.1:${port}`,
    url: `http://127.0.0.1:${port}/mcp`,
    tokens: { alice: await fixture.userToken("alice") },
  };
}

async function mcpCall(url, token, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...payload }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, text };
}

async function toolCall(url, token, name, args) {
  const { json, status, text } = await mcpCall(url, token, { method: "tools/call", params: { name, arguments: args } });
  if (!json?.result) throw new Error(`tool call failed (${status}): ${text.slice(0, 200)}`);
  return json.result;
}

describe("onboarding over POST /onboarding/token (live-verified identity)", () => {
  it("issues the caller a YouTrack token that works against the service, and audits the fact only", async () => {
    const { bare, storePath, serviceUrl, url, tokens } = await setup();
    const response = await fetch(`${serviceUrl}/onboarding/token`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ serviceUrl }),
    });
    const responseText = await response.text();
    assert.equal(response.status, 200, responseText.slice(0, 300));
    const issued = JSON.parse(responseText);
    assert.ok(typeof issued.token === "string" && issued.token.length > 20, `no token in response: ${JSON.stringify(issued).slice(0, 200)}`);
    assert.equal(issued.url, `${serviceUrl}/mcp`);
    assert.equal(issued.login, "alice", "the response must name the verified caller for the widget's confirmation line");
    assert.equal(issued.project, "stgmt/alpha", "the response must name the pinned project scope");
    const snippet = JSON.parse(issued.mcpJson);
    assert.equal(snippet.mcpServers["omp-spec-kit"].headers.Authorization, `Bearer ${issued.token}`);

    // The issued token is a real caller: same verified identity as alice.
    const listed = await mcpCall(url, issued.token, { method: "tools/list" });
    assert.equal(listed.status, 200, `issued token must authenticate (got ${listed.status}: ${listed.text.slice(0, 160)})`);
    const names = listed.json.result.tools.map((tool) => tool.name);
    assert.ok(names.includes("spec_patch"), "alice is a writer, so the issued token must see write tools");

    const read = await toolCall(url, issued.token, "spec_catalog", { project: "stgmt/alpha", view: "specs" });
    assert.equal(read.isError, false, JSON.stringify(read.structuredContent?.error ?? {}));

    const write = await toolCall(url, issued.token, "spec_patch", {
      intent: "patch", spec: "spec-kernel", reason: "write with the onboarding-issued token", dryRun: false, requestId: "onb-1",
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-98 — written with an issued token\n" }],
    });
    assert.equal(write.structuredContent.data.outcome, "APPLIED", JSON.stringify(write.structuredContent?.error ?? {}));
    const body = await git(bare, ["log", "--format=%B", "-1", "main"]);
    assert.match(body, /Spec-Author: alice/u, "the issued token carries the same verified login");

    // Audited as a fact; the value itself must never be stored.
    const db = new DatabaseSync(storePath);
    const rows = db.prepare("SELECT login, op, result FROM access_log WHERE op = 'onboarding'").all();
    db.close();
    assert.equal(rows.length, 1, `expected exactly one onboarding audit row, got ${JSON.stringify(rows)}`);
    assert.equal(rows[0].login, "alice");
    const stored = await readFile(storePath);
    assert.ok(!stored.includes(issued.token), "the issued token value must not be stored");
  });

  it("accepts a caller-supplied YouTrack token after verifying it belongs to the caller", async () => {
    const { serviceUrl, url, tokens } = await setup();
    // The MINT_NOT_PERMITTED fallback: the widget pastes the user's own
    // permanent token; the service verifies it resolves to alice before
    // wrapping it in a snippet. Nothing is minted or persisted.
    const response = await fetch(`${serviceUrl}/onboarding/token`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ serviceUrl, token: tokens.alice }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body).slice(0, 300));
    assert.equal(body.token, tokens.alice);
    assert.equal(body.login, "alice");
    assert.equal(body.project, "stgmt/alpha");

    const listed = await mcpCall(url, body.token, { method: "tools/list" });
    assert.equal(listed.status, 200, `pasted token must authenticate (got ${listed.status})`);

    const foreign = await fetch(`${serviceUrl}/onboarding/token`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ serviceUrl, token: "perm-bogus-token-that-is-not-hers" }),
    });
    assert.equal(foreign.status, 400, `a token YouTrack cannot resolve must be refused (got ${foreign.status})`);
    assert.equal((await foreign.json()).error, "TOKEN_INVALID");
  });

  it("refuses an anonymous caller and an unknown route shape", async () => {
    const { serviceUrl } = await setup();
    const anonymous = await fetch(`${serviceUrl}/onboarding/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceUrl }),
    });
    assert.equal(anonymous.status, 401, `anonymous onboarding must be refused (got ${anonymous.status})`);
  });
});
