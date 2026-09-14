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

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

async function setup() {
  const fixture = await loadLiveFixture();
  const base = await tempDir("spec-write-");
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

  const configPath = await fixture.writeServiceConfig(bare);
  const service = await startService({ configPath, cloneDir: path.join(base, "clone"), port: 0, identity: IDENTITY, logger: () => {} });
  servers.push(service.server);
  services.push(service);
  return {
    fixture,
    bare,
    cloneDir: path.join(base, "clone"),
    url: `http://127.0.0.1:${service.server.address().port}/mcp`,
    tokens: {
      alice: await fixture.userToken("alice"),
      erin: await fixture.userToken("erin"),
      carol: await fixture.userToken("carol"),
    },
  };
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

async function callTool(url, token, name, args) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const json = await response.json();
  if (!json?.result) throw new Error(`tool call failed (${response.status}): ${JSON.stringify(json).slice(0, 200)}`);
  return json.result;
}

describe("write path over POST /mcp (live-verified identity)", () => {
  it("lands a remote spec_patch as a bot commit with the verified login trailer", async () => {
    const { bare, url, tokens } = await setup();
    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs());
    assert.equal(result.isError, false, JSON.stringify(result?.structuredContent?.error ?? {}));
    assert.equal(result.structuredContent.data.outcome, "APPLIED");

    const body = await git(bare, ["log", "--format=%B", "-1", "main"]);
    assert.match(body, /spec\(stgmt\/alpha\): apply/u);
    assert.match(body, /Spec-Author: alice/u, "the trailer must carry the YouTrack-verified login");
    assert.match(body, /Spec-Request-Id: w1/u);
    assert.equal(await git(bare, ["log", "--format=%an", "-1", "main"]), "spec-bot");

    const remoteTasks = await git(bare, ["show", "main:stgmt/alpha/.specs/spec-kernel/TASKS.md"]);
    assert.match(remoteTasks, /TASK-99 — e2e write/u);
  });

  it("refuses a stale fingerprint with CONFLICT retryable", async () => {
    const { url, tokens } = await setup();
    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({ repositoryRootFingerprint: "stale-fingerprint", requestId: "w2" }));
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.data.outcome, "REFUSED");
    assert.equal(result.structuredContent.data.error.code, "CONFLICT");
    assert.equal(result.structuredContent.data.error.retryable, true);
  });

  it("enforces claim discipline and owner-only force with verified logins", async () => {
    const { url, tokens } = await setup();
    const claim = await callTool(url, tokens.alice, "spec_claim", { spec: "spec-kernel", ttlMinutes: 30, requestId: "c1" });
    assert.equal(claim.isError, false, JSON.stringify(claim.structuredContent?.error ?? {}));
    assert.equal(claim.structuredContent.data.holder, "alice", "claim holder is the verified login");

    const blocked = await callTool(url, tokens.erin, "spec_patch", patchArgs({ requestId: "w3" }));
    assert.equal(blocked.isError, true);
    assert.equal(blocked.structuredContent.error.code, "CLAIM_HELD");
    assert.equal(blocked.structuredContent.error.holder, "alice");

    const writerForce = await callTool(url, tokens.erin, "spec_patch", patchArgs({ requestId: "w4", force: true }));
    assert.equal(writerForce.isError, true);
    assert.match(writerForce.structuredContent.error.message, /force requires owner role/);

    const ownerForce = await callTool(url, tokens.carol, "spec_patch", patchArgs({ requestId: "w5", force: true, dryRun: true }));
    assert.equal(ownerForce.isError, false, JSON.stringify(ownerForce.structuredContent?.error ?? {}));
  });

  it("reports a push failure as retryable and keeps the commit on the clone", async () => {
    const { bare, cloneDir, url, tokens } = await setup();
    await rm(bare, { recursive: true, force: true });
    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({ requestId: "w6" }));
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, "INTERNAL_ERROR");
    assert.equal(result.structuredContent.error.causeCode, "GIT_PUSH_FAILED");
    assert.equal(result.structuredContent.error.retryable, true);
    assert.match(await git(cloneDir, ["log", "--format=%s", "-1"]), /spec\(stgmt\/alpha\): apply/u);
  });
});
