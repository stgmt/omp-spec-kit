import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
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

/** Bare specs repo with one seeded project + a live-auth service in front of it. */
async function setup({ projects = ["stgmt/alpha"] } = {}) {
  const fixture = await loadLiveFixture();
  const base = await tempDir("spec-http-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  const seed = path.join(base, "seed");
  await execFileAsync("git", ["clone", bare, seed]);
  await execFileAsync("git", ["-C", seed, "config", "user.email", "seed@example.invalid"]);
  await execFileAsync("git", ["-C", seed, "config", "user.name", "seed"]);
  await cp(FIXTURE_SPEC, path.join(seed, "stgmt", "alpha", ".specs", "spec-kernel"), { recursive: true });
  await execFileAsync("git", ["-C", seed, "add", "."]);
  await execFileAsync("git", ["-C", seed, "commit", "-m", "seed"]);
  await execFileAsync("git", ["-C", seed, "push", "-q", "origin", "HEAD:refs/heads/main"]);
  await rm(seed, { recursive: true, force: true });

  const configPath = await fixture.writeServiceConfig(bare, { projects });
  const service = await startService({ configPath, cloneDir: path.join(base, "clone"), port: 0, identity: IDENTITY, logger: () => {} });
  servers.push(service.server);
  services.push(service);
  return { fixture, service, bare, url: `http://127.0.0.1:${service.server.address().port}/mcp` };
}

async function rpc(url, body, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, sessionId: response.headers.get("mcp-session-id"), json, text };
}

async function callTool(url, token, name, args) {
  const { json } = await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, token);
  return json?.result;
}

function withoutProvenance(envelope) {
  const copy = { ...envelope };
  delete copy.provenance;
  return copy;
}

describe("POST /mcp — official SDK, stateless, YouTrack-verified callers", () => {
  it("serves tools/list and tools/call for a verified writer without an initialize handshake", async () => {
    const { fixture, url } = await setup();
    const token = await fixture.userToken("alice");
    const listed = await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/list" }, token);
    assert.equal(listed.status, 200);
    assert.equal(listed.sessionId, null);
    const names = listed.json.result.tools.map((tool) => tool.name);
    assert.equal(names.length, 14, "10 kernel tools + 4 service ops for a writer");
    assert.ok(names.includes("spec_patch"));

    const result = await callTool(url, token, "spec_catalog", { view: "specs", requestId: "http-1" });
    assert.equal(result.isError, false, JSON.stringify(result.structuredContent?.error ?? {}));
    const envelope = result.structuredContent;
    assert.equal(envelope.ok, true);
    assert.equal(envelope.operation, "catalog");
    assert.equal(envelope.schemaVersion, "spec-kernel@2");
    assert.deepEqual(envelope.data.specs, ["spec-kernel"]);
  });

  it("rejects GET and DELETE with 405 and anonymous calls with 401", async () => {
    const { url } = await setup();
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url, { method: "DELETE" })).status, 405);
    const anonymous = await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.json.error, /MISSING_TOKEN/);
  });

  it("honors the project parameter and refuses out-of-scope projects", async () => {
    const { fixture, url } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"] });
    const token = await fixture.userToken("alice");
    const alpha = (await callTool(url, token, "spec_catalog", { project: "stgmt/alpha", view: "specs" })).structuredContent;
    const beta = (await callTool(url, token, "spec_catalog", { project: "stgmt/beta", view: "specs" })).structuredContent;
    assert.deepEqual(alpha.data.specs, ["spec-kernel"]);
    assert.deepEqual(beta.data.specs, []);

    const outOfScope = await callTool(url, token, "spec_catalog", { project: "acme/unknown", view: "specs" });
    assert.equal(outOfScope.isError, true);
    assert.match(outOfScope.structuredContent.error.message, /outside the caller's allowed set/);
  });

  it("refuses a user without tenant groups (live NO_SCOPES)", async () => {
    const { fixture, url } = await setup();
    const daveToken = await fixture.userToken("dave");
    const response = await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/list" }, daveToken);
    assert.equal(response.status, 403);
    assert.match(response.json.error, /NO_SCOPES/);
  });

  it("filters tools/list by role (reader has no write tools)", async () => {
    const { fixture, url } = await setup();
    const bobToken = await fixture.userToken("bob");
    const listed = await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/list" }, bobToken);
    assert.equal(listed.status, 200);
    const names = listed.json.result.tools.map((tool) => tool.name);
    assert.equal(names.length, 11, "reader sees 9 reads + registry + drift");
    assert.ok(!names.includes("spec_patch"));
  });

  it("returns envelopes identical to the kernel dispatch modulo provenance", async () => {
    const { fixture, service, url } = await setup();
    const token = await fixture.userToken("alice");
    for (const [tool, operation, args] of [
      ["spec_catalog", "catalog", { view: "specs" }],
      ["spec_catalog", "catalog", { view: "types" }],
      ["spec_entities", "entities", { mode: "find", kinds: ["FUNCTIONAL_REQUIREMENT"] }],
      ["spec_documents", "documents", { action: "list", spec: "spec-kernel" }],
    ]) {
      const viaHttp = (await callTool(url, token, tool, { ...args, requestId: "parity" })).structuredContent;
      const viaKernel = await service.mounts.serviceFor("stgmt/alpha").runQuery(operation, args, { requestId: "parity" });
      assert.deepEqual(withoutProvenance(viaHttp), withoutProvenance(viaKernel), `parity failed for ${tool}`);
    }
  });
});
