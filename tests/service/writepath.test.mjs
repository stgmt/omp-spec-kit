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

  it("reconciles a diverged clone so a moved remote never blocks the next write", async () => {
    const { bare, cloneDir, url, tokens } = await setup();
    // Simulate a push that was rejected earlier: the clone carries a local
    // commit of its own while the remote moves ahead out of band.
    await git(cloneDir, ["config", "user.email", "bot@example.invalid"]);
    await git(cloneDir, ["config", "user.name", "spec-bot"]);
    await git(cloneDir, ["commit", "--allow-empty", "-m", "local-only: simulated rejected push"]);

    const operator = await tempDir("spec-write-operator-");
    await execFileAsync("git", ["clone", bare, operator]);
    await git(operator, ["config", "user.email", "operator@example.invalid"]);
    await git(operator, ["config", "user.name", "operator"]);
    await writeFile(path.join(operator, "BREAK-GLASS.md"), "# break-glass\n\nOperator pushed directly.\n");
    await execFileAsync("git", ["-C", operator, "add", "."]);
    await execFileAsync("git", ["-C", operator, "commit", "-m", "chore: operator break-glass note"]);
    await execFileAsync("git", ["-C", operator, "push", "-q", "origin", "HEAD:refs/heads/main"]);
    await rm(operator, { recursive: true, force: true });

    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({ requestId: "w-reconcile" }));
    assert.equal(result.isError, false, JSON.stringify(result?.structuredContent?.error ?? {}));
    assert.equal(result.structuredContent.data.outcome, "APPLIED", "the write must land even though the remote moved");

    const log = await git(bare, ["log", "--format=%s", "-4", "main"]);
    assert.match(log, /operator break-glass note/u, "the out-of-band commit must stay on the remote");
    assert.match(log, /local-only: simulated rejected push/u, "the local commit must be replayed, not dropped");
    assert.match(log, /apply/u, "the bot commit must land on top of both");
    assert.match(await git(bare, ["show", "main:stgmt/alpha/.specs/spec-kernel/TASKS.md"]), /TASK-99/u);
  });

  it("keeps the local commit and stays up when a break-glass rewrite conflicts", async () => {
    const { bare, cloneDir, url, tokens } = await setup();
    await git(cloneDir, ["config", "user.email", "bot@example.invalid"]);
    await git(cloneDir, ["config", "user.name", "spec-bot"]);
    // A local commit rewriting a document the remote will rewrite too.
    await writeFile(
      path.join(cloneDir, "stgmt", "alpha", ".specs", "spec-kernel", "TASKS.md"),
      "# Tasks\n\nStatus: DRAFT\n\n## TASK-77 — local only\n- **Status:** todo\n",
    );
    await git(cloneDir, ["add", "."]);
    await git(cloneDir, ["commit", "-m", "local-only: conflicting write"]);

    const operator = await tempDir("spec-write-conflict-");
    await execFileAsync("git", ["clone", bare, operator]);
    await git(operator, ["config", "user.email", "operator@example.invalid"]);
    await git(operator, ["config", "user.name", "operator"]);
    await writeFile(
      path.join(operator, "stgmt", "alpha", ".specs", "spec-kernel", "TASKS.md"),
      "# Tasks\n\nStatus: DRAFT\n\n## TASK-78 — operator rewrite\n- **Status:** todo\n",
    );
    await execFileAsync("git", ["-C", operator, "add", "."]);
    await execFileAsync("git", ["-C", operator, "commit", "-m", "chore: operator rewrite of TASKS.md"]);
    await execFileAsync("git", ["-C", operator, "push", "-q", "origin", "HEAD:refs/heads/main"]);
    await rm(operator, { recursive: true, force: true });

    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({ requestId: "w-conflict" }));
    assert.equal(result.isError, true, "a conflicting divergence must surface as an error, not a crash");
    assert.equal(result.structuredContent.error.retryable, true);
    assert.equal(result.structuredContent.error.causeCode, "GIT_PUSH_FAILED");
    // The local commits are never dropped, and no rebase is left half-done.
    const subjects = await git(cloneDir, ["log", "--format=%s", "-3"]);
    assert.match(subjects, /local-only: conflicting write/u, "the local commit must survive the aborted rebase");
    const status = await git(cloneDir, ["status", "--porcelain"]);
    assert.ok(!status.includes("rebase"), `no rebase must be left in progress: ${status}`);
    assert.equal(await git(cloneDir, ["rev-parse", "--abbrev-ref", "HEAD"]), "main");
  });

  it("refuses to publish commits the service did not author", async () => {
    const { bare, cloneDir, url, tokens } = await setup();
    await git(cloneDir, ["config", "user.email", "bot@example.invalid"]);
    await git(cloneDir, ["config", "user.name", "spec-bot"]);
    // A foreign commit inside the clone — what a hijacked git context or an
    // operator committing into the clone looks like.
    await writeFile(path.join(cloneDir, "FOREIGN.md"), "# foreign\n");
    await git(cloneDir, ["add", "."]);
    await git(cloneDir, ["-c", "user.email=intruder@example.invalid", "-c", "user.name=intruder", "commit", "-m", "foreign: not the service"]);

    const remoteBefore = await git(bare, ["rev-parse", "main"]);
    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({ requestId: "w-foreign" }));
    assert.equal(result.isError, true, "a foreign author must be refused, not published");
    assert.equal(result.structuredContent.error.causeCode, "FOREIGN_COMMITS");
    assert.equal(result.structuredContent.error.retryable, false);
    assert.equal(await git(bare, ["rev-parse", "main"]), remoteBefore, "nothing may reach the remote");
    assert.match(await git(bare, ["log", "--format=%s", "-1", "main"]), /seed/u);
  });

  it("keeps the foreign-commit refusal non-retryable when it surfaces after a reconcile", async () => {
    const { bare, cloneDir, url, tokens } = await setup();
    await git(cloneDir, ["config", "user.email", "bot@example.invalid"]);
    await git(cloneDir, ["config", "user.name", "spec-bot"]);
    // A foreign commit in the clone AND a moved remote: the first push is
    // rejected, the reconcile replays both sides, and the retry must still
    // refuse on authorship — as a policy refusal, not a transient failure.
    await writeFile(path.join(cloneDir, "FOREIGN.md"), "# foreign\n");
    await git(cloneDir, ["add", "."]);
    await git(cloneDir, ["-c", "user.email=intruder@example.invalid", "-c", "user.name=intruder", "commit", "-m", "foreign: not the service"]);

    const operator = await tempDir("spec-write-foreign-");
    await execFileAsync("git", ["clone", bare, operator]);
    await git(operator, ["config", "user.email", "operator@example.invalid"]);
    await git(operator, ["config", "user.name", "operator"]);
    await writeFile(path.join(operator, "BREAK-GLASS.md"), "# break-glass\n");
    await execFileAsync("git", ["-C", operator, "add", "."]);
    await execFileAsync("git", ["-C", operator, "commit", "-m", "chore: operator note"]);
    await execFileAsync("git", ["-C", operator, "push", "-q", "origin", "HEAD:refs/heads/main"]);
    await rm(operator, { recursive: true, force: true });

    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({ requestId: "w-foreign-retry" }));
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.causeCode, "FOREIGN_COMMITS", JSON.stringify(result.structuredContent.error));
    assert.equal(result.structuredContent.error.retryable, false, "a policy refusal must never be reported as retryable");
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

  it("serializes concurrent writes on one spec into a linear bot-only history", async () => {
    const { bare, url, tokens } = await setup();
    const N = 6;
    const before = Number(await git(bare, ["rev-list", "--count", "main"]));
    // Ten-users-at-once, scaled to the CI box: the writes race through HTTP at
    // the same instant; the write lock and the serialized git queue must turn
    // them into a linear sequence — never interleaved, never dropped.
    const attempt = (i) =>
      callTool(url, tokens.alice, "spec_patch", patchArgs({
        requestId: `w-concurrent-${i}`,
        operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: `\n## TASK-${200 + i} — concurrent write ${i}\n` }],
      }));
    const results = await Promise.all(Array.from({ length: N }, (_, i) => attempt(i)));

    const refusals = results.filter((r) => r.isError === true);
    assert.ok(results.some((r) => r.isError === false), "at least the first writer must land");
    for (const refusal of refusals) {
      // Kernel refusals carry data.error; service-level errors carry error.
      const error = refusal.structuredContent.error ?? refusal.structuredContent.data?.error;
      assert.equal(error?.retryable, true, `a loser of the race must be retryable, not destructive: ${JSON.stringify(refusal.structuredContent)}`);
    }
    // Losers retry as any client would (CONFLICT is retryable by contract):
    // every refused write must land on top of the winner's commit.
    for (let i = 0; i < N; i += 1) {
      if (results[i].isError !== true) continue;
      const retried = await attempt(i);
      assert.equal(retried.isError, false, `retry of ${i}: ${JSON.stringify(retried.structuredContent?.error ?? retried.structuredContent?.data?.error)}`);
      assert.equal(retried.structuredContent.data.outcome, "APPLIED");
      results[i] = retried;
    }

    const after = Number(await git(bare, ["rev-list", "--count", "main"]));
    assert.equal(after - before, N, "exactly one commit per write — no merge commits, no lost writes");
    const authors = await git(bare, ["log", `--format=%ae`, `-${N}`, "main"]);
    for (const author of authors.split("\n")) {
      assert.equal(author, IDENTITY.email, "every landed commit is bot-authored");
    }
    const remoteTasks = await git(bare, ["show", "main:stgmt/alpha/.specs/spec-kernel/TASKS.md"]);
    for (let i = 0; i < N; i += 1) {
      assert.match(remoteTasks, new RegExp(`TASK-${200 + i} — concurrent write ${i}`, "u"), `write ${i} must reach the remote`);
    }
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
