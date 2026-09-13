import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { bootService } from "../../src/service/index.js";
import { createServiceApp } from "../../src/service/http.js";
import { preAuthContext } from "../../src/service/dispatch.js";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const servers = [];
after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});
const tempDirs = [];

async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

/** One bare specs repo; `stgmt/alpha` is seeded with the spec-kernel fixture spec. */
async function setup({ projects, seedAlpha = true } = {}) {
  const base = await tempDir("spec-http-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  if (seedAlpha) {
    const seed = path.join(base, "seed");
    await execFileAsync("git", ["clone", bare, seed]);
    await git(seed, ["config", "user.email", "seed@example.invalid"]);
    await git(seed, ["config", "user.name", "seed"]);
    const target = path.join(seed, "stgmt", "alpha", ".specs", "spec-kernel");
    await cp(FIXTURE_SPEC, target, { recursive: true });
    await execFileAsync("git", ["add", "."], { cwd: seed });
    await execFileAsync("git", ["commit", "-m", "seed: spec-kernel fixture"], { cwd: seed });
    await execFileAsync("git", ["push", "origin", "HEAD:refs/heads/main"], { cwd: seed });
    await rm(seed, { recursive: true, force: true });
  }
  const configPath = path.join(base, "projects.json");
  await writeFile(configPath, JSON.stringify({ specsRepo: bare, branch: "main", projects: projects.map((id) => ({ id })) }));
  const { mounts } = await bootService({ configPath, cloneDir: path.join(base, "clone"), identity: IDENTITY });
  const app = createServiceApp({ mounts, authenticate: () => preAuthContext(mounts) });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  servers.push(server);
  return { base, bare, mounts, url: `http://127.0.0.1:${server.address().port}/mcp` };
}

async function rpc(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, sessionId: response.headers.get("mcp-session-id"), json, text };
}

async function callTool(url, name, args) {
  const { json } = await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  return json?.result;
}

function withoutProvenance(envelope) {
  const copy = { ...envelope };
  delete copy.provenance;
  return copy;
}

describe("POST /mcp — official SDK, stateless", () => {
  it("serves tools/list and tools/call without an initialize handshake", async () => {
    const { url } = await setup({ projects: ["stgmt/alpha"] });
    const listed = await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.equal(listed.status, 200);
    assert.equal(listed.sessionId, null);
    const names = listed.json.result.tools.map((tool) => tool.name);
    assert.equal(names.length, 10);
    assert.ok(names.includes("spec_patch"));

    const result = await callTool(url, "spec_catalog", { view: "specs", requestId: "http-1" });
    assert.equal(result.isError, false);
    const envelope = result.structuredContent;
    assert.equal(envelope.ok, true);
    assert.equal(envelope.operation, "catalog");
    assert.equal(envelope.requestId, "http-1");
    assert.equal(envelope.schemaVersion, "spec-kernel@2");
    assert.deepEqual(envelope.data.specs, ["spec-kernel"]);
  });

  it("rejects GET and DELETE with 405", async () => {
    const { url } = await setup({ projects: ["stgmt/alpha"] });
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url, { method: "DELETE" })).status, 405);
  });

  it("honors the project parameter against the mounted scopes", async () => {
    const { url } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"] });
    const alpha = (await callTool(url, "spec_catalog", { project: "stgmt/alpha", view: "specs" })).structuredContent;
    const beta = (await callTool(url, "spec_catalog", { project: "stgmt/beta", view: "specs" })).structuredContent;
    assert.deepEqual(alpha.data.specs, ["spec-kernel"]);
    assert.deepEqual(beta.data.specs, []);
  });

  it("refuses an out-of-scope project outright", async () => {
    const { url } = await setup({ projects: ["stgmt/alpha"] });
    const result = await callTool(url, "spec_catalog", { project: "acme/unknown", view: "specs" });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, "INVALID_REQUEST");
    assert.match(result.structuredContent.error.message, /outside the caller's allowed set/u);
  });

  it("refuses a targeted call without project when the default is ambiguous", async () => {
    const { url } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"] });
    const result = await callTool(url, "spec_catalog", { view: "specs" });
    assert.equal(result.isError, true);
    assert.match(result.structuredContent.error.message, /no default scope/u);
  });

  it("returns envelopes identical to the kernel dispatch modulo provenance", async () => {
    const { mounts, url } = await setup({ projects: ["stgmt/alpha"] });
    for (const [tool, operation, args] of [
      ["spec_catalog", "catalog", { view: "specs" }],
      ["spec_catalog", "catalog", { view: "types" }],
      ["spec_entities", "entities", { mode: "find", kinds: ["FUNCTIONAL_REQUIREMENT"] }],
      ["spec_documents", "documents", { action: "list", spec: "spec-kernel" }],
    ]) {
      const viaHttp = (await callTool(url, tool, { ...args, requestId: "parity" })).structuredContent;
      const viaKernel = await mounts.serviceFor("stgmt/alpha").runQuery(operation, args, { requestId: "parity" });
      assert.deepEqual(withoutProvenance(viaHttp), withoutProvenance(viaKernel), `parity failed for ${tool}`);
    }
  });
});
