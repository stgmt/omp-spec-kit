import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { startService } from "../../src/service/index.js";
import { loadLiveFixture } from "../e2e/lib/live-fixture.mjs";
import { seedSpecBranch } from "./lib/spec-repo.mjs";

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
async function setup({ projects = ["stgmt/alpha"], unbound = [], extraSpecs = [] } = {}) {
  const fixture = await loadLiveFixture();
  const base = await tempDir("spec-http-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  await seedSpecBranch(bare, { project: "stgmt/alpha", spec: "spec-kernel", sourceDir: FIXTURE_SPEC });
  for (const { project, spec } of extraSpecs) {
    await seedSpecBranch(bare, { project, spec, sourceDir: FIXTURE_SPEC });
  }

  const configPath = await fixture.writeServiceConfig(bare, { projects });
  if (unbound.length > 0) {
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.bindings = config.bindings.filter((binding) => !unbound.includes(binding.project));
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }
  const storePath = path.join(base, "registry.db");
  const service = await startService({ configPath, storePath, cloneDir: path.join(base, "clone"), port: 0, identity: IDENTITY, logger: () => {} });
  servers.push(service.server);
  services.push(service);
  return { fixture, service, bare, storePath, url: `http://127.0.0.1:${service.server.address().port}/mcp` };
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
    assert.ok(names.includes("spec_patch"));
    assert.ok(names.includes("spec_branch"));

    const result = await callTool(url, token, "spec_catalog", { view: "specs", requestId: "http-1" });
    assert.equal(result.isError, false, JSON.stringify(result.structuredContent?.error ?? {}));
    const envelope = result.structuredContent;
    assert.equal(envelope.ok, true);
    assert.equal(envelope.operation, "catalog");
    assert.equal(envelope.schemaVersion, "spec-kernel@2");
    assert.deepEqual(envelope.data.specs, ["spec-kernel"]);

    const branchResult = await callTool(url, token, "spec_catalog", { view: "branches", requestId: "http-branches" });
    assert.equal(branchResult.isError, false, JSON.stringify(branchResult.structuredContent?.error ?? {}));
    const branchData = branchResult.structuredContent.data;
    assert.equal(branchData.kind, "branches");
    assert.deepEqual(branchData.branches.map((entry) => entry.branch), ["spec-spec-kernel"]);
    assert.equal(branchData.branches[0].kind, "spec");

    const status = await fetch(`${url.replace(/\/mcp$/u, "")}/status`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(status.status, 200);
    const statusBody = await status.json();
    assert.deepEqual(statusBody.projects.map((entry) => [entry.project, entry.binding, entry.specs, entry.setup.required]), [["stgmt/alpha", "active", 1, false]]);
  });

  it("deletes a demo-marked spec through the hosted spec_branch surface", async () => {
    const { fixture, url } = await setup();
    const token = await fixture.userToken("alice");
    const created = await callTool(url, token, "spec_branch", { action: "create", spec: "demo-http", demo: true, requestId: "demo-create" });
    assert.equal(created.isError, false, JSON.stringify(created.structuredContent?.error ?? {}));
    const deleted = await callTool(url, token, "spec_branch", { action: "deleteSpec", spec: "demo-http", requestId: "demo-delete" });
    assert.equal(deleted.isError, false, JSON.stringify(deleted.structuredContent?.error ?? {}));
    assert.equal(deleted.structuredContent.data.action, "deleteSpec");
  });

  it("reports SETUP_REQUIRED only for an unbound project and keeps the bound one working", async () => {
    const { fixture, url } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"], unbound: ["stgmt/beta"] });
    const token = await fixture.userToken("alice");
    const unbound = await callTool(url, token, "spec_catalog", { project: "stgmt/beta", view: "specs" });
    assert.equal(unbound.isError, true);
    assert.equal(unbound.structuredContent.error.code, "SETUP_REQUIRED");
    assert.equal(unbound.structuredContent.error.causeCode, "REPO_BINDING_REQUIRED");
    assert.match(unbound.structuredContent.error.message, /spec_repo/u, "setup names the tool call an agent must make");

    const bound = await callTool(url, token, "spec_catalog", { project: "stgmt/alpha", view: "specs" });
    assert.equal(bound.isError, false, JSON.stringify(bound.structuredContent?.error ?? {}));
    assert.deepEqual(bound.structuredContent.data.specs, ["spec-kernel"]);

    const status = await fetch(`${url.replace(/\/mcp$/u, "")}/status`, { headers: { authorization: `Bearer ${token}` } });
    const projects = (await status.json()).projects;
    assert.deepEqual(projects.map((entry) => [entry.project, entry.binding, entry.setup.required]), [
      ["stgmt/alpha", "active", false],
      ["stgmt/beta", "required", true],
    ]);
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

  it("advertises project on every tool's input schema", async () => {
    const { fixture, url } = await setup();
    const token = await fixture.userToken("alice");
    const listed = await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/list" }, token);
    assert.equal(listed.status, 200);
    for (const tool of listed.json.result.tools) {
      assert.equal(tool.inputSchema?.properties?.project?.type, "string", `${tool.name} must advertise project`);
      assert.equal(tool.inputSchema?.properties?.declaredWorktree?.type, "string", `${tool.name} must advertise declaredWorktree`);
      assert.equal((tool.inputSchema.required ?? []).includes("project"), false, `${tool.name} must not require project`);
      // The root object closes unknown keys: an advertised argument cannot be
      // rejected by a branch that does not repeat it.
      assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} must close unknown root keys`);
      for (const branch of tool.inputSchema.oneOf ?? []) {
        assert.ok(!(branch.required ?? []).includes("project"), `${tool.name} branch must not require project`);
      }
    }
    const initialized = await rpc(url, { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } }, token);
    const instructions = initialized.json.result.instructions;
    assert.match(instructions, /optional project/u);
    assert.match(instructions, /local stdio\/test transport/u, "instructions describe worktree routing as local-only");
  });

  it("honors a per-call project across A/B/A on one connection while the session default stays unchanged", async () => {
    const { fixture, url } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"], extraSpecs: [{ project: "stgmt/beta", spec: "spec-beta" }] });
    const token = await fixture.userToken("alice");
    const session = await rpc(url, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } }, token);
    assert.equal(session.status, 200);

    const first = (await callTool(url, token, "spec_catalog", { project: "stgmt/alpha", view: "specs", requestId: "aba-1" })).structuredContent;
    const second = (await callTool(url, token, "spec_catalog", { project: "stgmt/beta", view: "specs", requestId: "aba-2" })).structuredContent;
    const third = (await callTool(url, token, "spec_catalog", { project: "stgmt/alpha", view: "specs", requestId: "aba-3" })).structuredContent;

    assert.deepEqual(first.data.specs, ["spec-kernel"]);
    assert.deepEqual(second.data.specs, ["spec-beta"]);
    assert.deepEqual(third.data.specs, ["spec-kernel"], "returning to A yields A's catalog again");

    assert.equal(first.provenance.project, "stgmt/alpha");
    assert.equal(second.provenance.project, "stgmt/beta");
    assert.equal(third.provenance.project, "stgmt/alpha");

    // The explicit per-call selection did not replace any session default.
    const unselected = await callTool(url, token, "spec_catalog", { view: "specs", requestId: "aba-4" });
    assert.equal(unselected.isError, true);
    assert.equal(unselected.structuredContent.error.code, "PROJECT_SELECTION_REQUIRED", "two candidate scopes and no default: the caller must choose, and nothing was stored by the cross-project calls");
    assert.deepEqual(unselected.structuredContent.error.candidates.sort(), ["stgmt/alpha", "stgmt/beta"]);
  });

  it("records the project that actually served each hosted call in the audit log", async () => {
    const { fixture, url, storePath } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"], extraSpecs: [{ project: "stgmt/beta", spec: "spec-beta" }] });
    const token = await fixture.userToken("alice");
    const sequence = ["stgmt/alpha", "stgmt/beta", "stgmt/alpha"];
    for (const [index, project] of sequence.entries()) {
      const result = await callTool(url, token, "spec_catalog", { project, view: "specs", requestId: `audit-${index}` });
      assert.equal(result.isError, false, JSON.stringify(result.structuredContent?.error ?? {}));
      assert.equal(result.structuredContent.provenance.project, project);
    }

    const db = new DatabaseSync(storePath);
    const rows = db.prepare("SELECT project, op, request_id FROM access_log WHERE request_id LIKE 'audit-%' ORDER BY id").all();
    db.close();
    assert.deepEqual(
      rows.map((row) => ({ project: row.project, op: row.op, requestId: row.request_id })),
      sequence.map((project, index) => ({ project, op: "spec_catalog", requestId: `audit-${index}` })),
      "each audit row names the project that served that call, not the session default",
    );
  });

  it("refuses declaredWorktree on the hosted transport instead of routing by a local path", async () => {
    const { fixture, url } = await setup();
    const token = await fixture.userToken("alice");
    const result = await callTool(url, token, "spec_catalog", { project: "stgmt/alpha", declaredWorktree: path.resolve("."), view: "specs" });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, "WORKTREE_ROUTING_UNSUPPORTED");
    assert.match(result.structuredContent.error.message, /local stdio\/test transport/u);
    assert.match(result.structuredContent.error.message, /project argument/u);
  });

  it("refuses an unconfigured or malformed project before any corpus read", async () => {
    const { fixture, url } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"] });
    const token = await fixture.userToken("alice");
    const numeric = await callTool(url, token, "spec_catalog", { project: 42, view: "specs" });
    assert.equal(numeric.isError, true);
    assert.equal(numeric.structuredContent.error.code, "INVALID_REQUEST");
    assert.equal(numeric.structuredContent.error.parameter, "project");

    const missing = await callTool(url, token, "spec_documents", { action: "list", spec: "spec-kernel" });
    assert.equal(missing.isError, true);
    assert.equal(missing.structuredContent.error.code, "PROJECT_SELECTION_REQUIRED");
    assert.match(missing.structuredContent.error.message, /pass project/u);
  });

  it("reports the selected project and binding truthfully through mcp_preflight", async () => {
    const { fixture, url } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"] });
    const token = await fixture.userToken("alice");
    const result = await callTool(url, token, "mcp_preflight", { project: "stgmt/alpha" });
    assert.equal(result.isError, false, JSON.stringify(result.structuredContent?.error ?? {}));
    const data = result.structuredContent.data;
    assert.equal(result.structuredContent.provenance.project, "stgmt/alpha");
    assert.equal(data.connection.healthy, true);
    assert.equal(data.connection.transport, "http");
    assert.equal(data.project.selected, "stgmt/alpha");
    assert.equal(data.project.source, "explicit");
    assert.equal(data.repository.binding, "active");
    assert.equal(data.worktree.transport, "http");
    assert.equal(data.worktree.declared, false);
    assert.equal(data.corpus.present, true);
    assert.equal(data.mutationReady, true);
    assert.equal("matchesResolvedRoot" in data.worktree, false, "no self-comparison root match");
    assert.equal(typeof data.repository.rootId, "string");
    assert.doesNotMatch(JSON.stringify(data.repository), /[A-Za-z]:[\\/]/u, "no absolute path is echoed");
    assert.equal(data.setup.required, false);
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
    const tools = listed.json.result.tools;
    const names = tools.map((tool) => tool.name);
    assert.ok(!names.includes("spec_patch"), "a mutating-only tool is hidden");
    assert.ok(!names.includes("spec_claim"), "a mutating-only tool is hidden");
    assert.ok(!names.includes("spec_branch"), "a mutating-only tool is hidden");
    // spec_repo stays visible because it carries read-only actions, and its
    // advertised truth is the union of those actions: mutating overall.
    const repo = tools.find((tool) => tool.name === "spec_repo");
    assert.ok(repo, "spec_repo stays visible for its read-only actions");
    assert.equal(repo.annotations.readOnlyHint, false, "a tool with mutating actions is not advertised read-only");
    const actions = repo.inputSchema.oneOf.map((branch) => branch.properties.action.enum[0]).sort();
    assert.deepEqual(actions, ["bind", "bindings", "probe", "register", "status", "unbind"], "every action is advertised once");
    // The root closes unknown keys and declares the transport context once; a
    // caller that passes an undeclared field is rejected by the root, which is
    // exactly what validateContractArguments enforces.
    assert.equal(repo.inputSchema.additionalProperties, false, "the root closes unknown keys");
    assert.ok(Object.keys(repo.inputSchema.properties).includes("project"), "the root accepts the transport project");
    for (const branch of repo.inputSchema.oneOf) {
      assert.equal(branch.additionalProperties, undefined, `branch ${branch.title} does not duplicate the root closure`);
    }
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
