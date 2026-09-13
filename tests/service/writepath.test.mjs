import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { startService } from "../../src/service/index.js";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const TOKEN = "token-alpha-123456";
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

async function setup({ tenants = [{ token: TOKEN, tenant: "alpha", projects: ["stgmt/alpha"] }] } = {}) {
  const base = await tempDir("spec-write-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  const seed = path.join(base, "seed");
  await execFileAsync("git", ["clone", bare, seed]);
  await git(seed, ["config", "user.email", "seed@example.invalid"]);
  await git(seed, ["config", "user.name", "seed"]);
  await cp(FIXTURE_SPEC, path.join(seed, "stgmt", "alpha", ".specs", "spec-kernel"), { recursive: true });
  await execFileAsync("git", ["add", "."], { cwd: seed });
  await execFileAsync("git", ["commit", "-m", "seed: spec-kernel fixture"], { cwd: seed });
  await execFileAsync("git", ["push", "-q", "origin", "HEAD:refs/heads/main"], { cwd: seed });
  await rm(seed, { recursive: true, force: true });
  const configPath = path.join(base, "projects.json");
  await writeFile(configPath, JSON.stringify({
    specsRepo: bare,
    branch: "main",
    projects: [{ id: "stgmt/alpha" }],
    tenants,
  }));
  const service = await startService({ configPath, cloneDir: path.join(base, "clone"), port: 0, identity: IDENTITY, logger: () => {} });
  servers.push(service.server);
  services.push(service);
  const url = `http://127.0.0.1:${service.server.address().port}/mcp`;
  return { base, bare, cloneDir: path.join(base, "clone"), url, service };
}

function patchArgs(overrides = {}) {
  return {
    intent: "patch",
    spec: "spec-kernel",
    reason: "e2e write path",
    dryRun: false,
    operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-99 — e2e write\n" }],
    requestId: "w1",
    ...overrides,
  };
}

async function callTool(url, name, args, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const json = await response.json();
  return json.result;
}

describe("write path over POST /mcp (TASK-5)", () => {
  it("lands a remote spec_patch as an attributed bot commit with trailers", async () => {
    const { bare, url } = await setup();
    const result = await callTool(url, "spec_patch", patchArgs(), { authorization: `Bearer ${TOKEN}`, "x-spec-author": "stigm" });
    assert.equal(result.isError, false, JSON.stringify(result?.structuredContent?.error ?? result));
    assert.equal(result.structuredContent.data.outcome, "APPLIED");

    const body = await git(bare, ["log", "--format=%B", "-1", "main"]);
    assert.match(body, /spec\(stgmt\/alpha\): apply/u);
    assert.match(body, /Spec-Author: stigm/u);
    assert.match(body, /Spec-Request-Id: w1/u);
    const author = await git(bare, ["log", "--format=%an", "-1", "main"]);
    assert.equal(author, "spec-bot");

    const remoteTasks = await git(bare, ["show", "main:stgmt/alpha/.specs/spec-kernel/TASKS.md"]);
    assert.match(remoteTasks, /TASK-99 — e2e write/u);
  });

  it("refuses a stale fingerprint with CONFLICT retryable", async () => {
    const { url } = await setup();
    const result = await callTool(url, "spec_patch", patchArgs({ repositoryRootFingerprint: "stale-fingerprint", requestId: "w2" }), { authorization: `Bearer ${TOKEN}` });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.data.outcome, "REFUSED");
    assert.equal(result.structuredContent.data.error.code, "CONFLICT");
    assert.equal(result.structuredContent.data.error.retryable, true);
  });

  it("enforces claim discipline: CLAIM_HELD without force, write passes with force", async () => {
    const { url } = await setup();
    const claim = await callTool(url, "spec_claim", { spec: "spec-kernel", ttlMinutes: 30, requestId: "c1" }, { authorization: `Bearer ${TOKEN}`, "x-spec-author": "alice" });
    assert.equal(claim.isError, false);
    assert.equal(claim.structuredContent.data.holder, "alice");

    const blocked = await callTool(url, "spec_patch", patchArgs({ requestId: "w3" }), { authorization: `Bearer ${TOKEN}`, "x-spec-author": "bob" });
    assert.equal(blocked.isError, true);
    assert.equal(blocked.structuredContent.error.code, "CLAIM_HELD");
    assert.equal(blocked.structuredContent.error.holder, "alice");
    assert.equal(typeof blocked.structuredContent.error.expiresAt, "string");

    const forced = await callTool(url, "spec_patch", patchArgs({ requestId: "w4", dryRun: true }), { authorization: `Bearer ${TOKEN}`, "x-spec-author": "bob" });
    assert.equal(forced.isError, false);
  });

  it("reports a push failure as retryable and keeps the commit on the clone", async () => {
    const { bare, cloneDir, url } = await setup();
    await rm(bare, { recursive: true, force: true });
    const result = await callTool(url, "spec_patch", patchArgs({ requestId: "w5" }), { authorization: `Bearer ${TOKEN}` });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, "INTERNAL_ERROR");
    assert.equal(result.structuredContent.error.causeCode, "GIT_PUSH_FAILED");
    assert.equal(result.structuredContent.error.retryable, true);
    const localSubjects = await git(cloneDir, ["log", "--format=%s", "-1"]);
    assert.match(localSubjects, /spec\(stgmt\/alpha\): apply/u);
  });
});
