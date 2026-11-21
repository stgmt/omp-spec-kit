import { serviceKernelFixture } from "./lib/service-kernel-fixture.mjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { startService } from "../../src/service/index.js";
import { createWritePipeline } from "../../src/service/writepath.js";
import { loadLiveFixture } from "../e2e/lib/live-fixture.mjs";
import { seedSpecBranch } from "./lib/spec-repo.mjs";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const SPEC_BRANCH = "spec-spec-kernel";
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
  await seedSpecBranch(bare, { project: "stgmt/alpha", spec: "spec-kernel", files: await serviceKernelFixture() });

  const configPath = await fixture.writeServiceConfig(bare);
  const service = await startService({ configPath, cloneDir: path.join(base, "clone"), port: 0, identity: IDENTITY, logger: () => {} });
  servers.push(service.server);
  services.push(service);
  const worktree = await service.mounts.worktreeFor("stgmt/alpha", "spec-kernel");
  return {
    fixture,
    bare,
    worktree,
    cloneDir: worktree.cwd,
    projectRoot: await service.mounts.projectRoot("stgmt/alpha"),
    url: `http://127.0.0.1:${service.server.address().port}/mcp`,
    tokens: {
      alice: await fixture.userToken("alice"),
      erin: await fixture.userToken("erin"),
      carol: await fixture.userToken("carol"),
    },
  };
}

const ARCHIVE_REVIEW = Object.freeze({
  schemaVersion: "omp-spec-kit/design-review@1",
  decision: "proceed",
  boundary: {
    kind: "user-visible-contract",
    name: "Spec registry archive move",
    claim: "archiving a specification removes its source tree and keeps the archived documents addressable",
  },
  evidence: [
    { kind: "test", reference: "tests/service/writepath.test.mjs", observation: "the archive write lands as one bot commit on the spec branch" },
    { kind: "source", reference: "src/service/writepath.js", observation: "the write path commits after the kernel applies the change" },
  ],
  alternatives: [
    { option: "leave the source directory in place", reasonRejected: "an archived spec must not stay live in the corpus" },
  ],
  selfTestCheck: {
    status: "passed",
    mutation: "failed-as-expected",
    command: "node --test tests/service/writepath.test.mjs",
    hypothesis: "archiveSpec must land as a remote commit",
    answer: "the remote branch gains the archive move",
    positiveCase: "the archive commit carries the moved documents",
    negativeCase: "the source directory still exists on the branch",
    expectedFailure: "APPLIED without a commit leaves the source tree live",
    observedFailure: "the source tree stays on the remote branch",
  },
});

function patchArgs(overrides = {}) {
  return {
    intent: "patch",
    spec: "spec-kernel",
    reason: "e2e write path",
    dryRun: false,
    operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\ne2e write marker\n" }],
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

    const body = await git(bare, ["log", "--format=%B", "-1", SPEC_BRANCH]);
    assert.match(body, /spec\(stgmt\/alpha\): apply/u);
    assert.match(body, /Spec-Author: alice/u, "the trailer must carry the YouTrack-verified login");
    assert.match(body, /Spec-Request-Id: w1/u);
    assert.equal(await git(bare, ["log", "--format=%an", "-1", SPEC_BRANCH]), "spec-bot");

    const remoteTasks = await git(bare, ["show", `${SPEC_BRANCH}:.specs/spec-kernel/TASKS.md`]);
    assert.match(remoteTasks, /e2e write marker/u);
  });

  it("lands archiveSpec as a bot commit that removes the source tree", async () => {
    const { bare, url, tokens } = await setup();
    const result = await callTool(url, tokens.alice, "spec_patch", {
      intent: "archiveSpec",
      spec: "spec-kernel",
      reason: "archive the fixture",
      dryRun: false,
      requestId: "w-archive",
      designReview: ARCHIVE_REVIEW,
    });
    assert.equal(result.isError, false, JSON.stringify(result.structuredContent?.error ?? result.structuredContent?.data?.error ?? {}));
    assert.equal(result.structuredContent.data.outcome, "APPLIED");

    const body = await git(bare, ["log", "--format=%B", "-1", SPEC_BRANCH]);
    assert.match(body, /spec\(stgmt\/alpha\): archive/u, "the archive must land as a bot commit");
    assert.match(body, /Spec-Author: alice/u);
    const tree = await git(bare, ["ls-tree", "-r", "--name-only", SPEC_BRANCH, ".specs"]);
    assert.ok(!tree.split("\n").includes(".specs/spec-kernel/README.md"), "the source tree must be removed on the branch");
    assert.ok(tree.split("\n").includes(".specs/archive/spec-kernel/README.md"), "the archived documents must be committed");
    const binding = JSON.parse(await git(bare, ["show", `${SPEC_BRANCH}:.spec-kit.json`]));
    assert.equal(binding.archive.path, ".specs/archive/spec-kernel");
    assert.equal(binding.archive.by, "alice");
  });

  it("hides an archived spec until includeArchived and keeps it read-only", async () => {
    const { bare, url, tokens } = await setup();
    const archived = await callTool(url, tokens.alice, "spec_patch", {
      intent: "archiveSpec",
      spec: "spec-kernel",
      reason: "archive for visibility",
      dryRun: false,
      requestId: "w-archive-visibility",
      designReview: ARCHIVE_REVIEW,
    });
    assert.equal(archived.isError, false, JSON.stringify(archived.structuredContent?.error ?? archived.structuredContent?.data?.error ?? {}));

    const hidden = await callTool(url, tokens.alice, "spec_catalog", { view: "branches", requestId: "archive-hidden" });
    assert.equal(hidden.isError, false, JSON.stringify(hidden.structuredContent?.error ?? {}));
    assert.equal(hidden.structuredContent.data.branches.some((entry) => entry.spec === "spec-kernel"), false, "archived specs stay out of the normal branch list");

    const shown = await callTool(url, tokens.alice, "spec_catalog", { view: "branches", includeArchived: true, requestId: "archive-shown" });
    assert.equal(shown.isError, false, JSON.stringify(shown.structuredContent?.error ?? {}));
    const entry = shown.structuredContent.data.branches.find((candidate) => candidate.spec === "spec-kernel");
    assert.ok(entry, "includeArchived must expose the archived branch");
    assert.equal(entry.archived, true);
    assert.equal(entry.archive.path, ".specs/archive/spec-kernel");

    const doc = await callTool(url, tokens.alice, "spec_documents", {
      action: "read",
      spec: "spec-kernel",
      doc: "README.md",
      includeArchived: true,
      requestId: "archive-doc",
    });
    assert.equal(doc.isError, false, JSON.stringify(doc.structuredContent?.error ?? {}));
    assert.equal(doc.structuredContent.data.archived.path, ".specs/archive/spec-kernel");
    assert.ok(doc.structuredContent.data.content.length > 0);

    const hiddenDoc = await callTool(url, tokens.alice, "spec_documents", {
      action: "read",
      spec: "spec-kernel",
      doc: "README.md",
      requestId: "archive-doc-hidden",
    });
    assert.equal(hiddenDoc.isError, true, "the archived document must not be readable without the flag");

    const write = await callTool(url, tokens.alice, "spec_patch", patchArgs({ requestId: "archive-write" }));
    assert.equal(write.isError, true);
    assert.equal(write.structuredContent.error.code, "SPEC_ARCHIVED");

    const claim = await callTool(url, tokens.alice, "spec_claim", { spec: "spec-kernel", requestId: "archive-claim" });
    assert.equal(claim.isError, true);
    assert.equal(claim.structuredContent.error.code, "SPEC_ARCHIVED");

    const branchDelete = await callTool(url, tokens.carol, "spec_branch", {
      action: "deleteSpec",
      spec: "spec-kernel",
      requestId: "archive-branch-delete",
    });
    assert.equal(branchDelete.isError, true);
    assert.equal(branchDelete.structuredContent.error.code, "SPEC_ARCHIVED");
  });

  it("replays a successful patch with the same requestId without a second effect", async () => {
    const { bare, url, tokens } = await setup();
    const args = patchArgs({
      requestId: "w-patch-replay",
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\nreplay marker\n" }],
    });
    const first = await callTool(url, tokens.alice, "spec_patch", args);
    assert.equal(first.isError, false, JSON.stringify(first.structuredContent?.error ?? first.structuredContent?.data?.error ?? {}));
    assert.equal(first.structuredContent.data.outcome, "APPLIED");
    const before = await git(bare, ["rev-parse", SPEC_BRANCH]);

    const replay = await callTool(url, tokens.alice, "spec_patch", args);
    assert.equal(replay.isError, false, JSON.stringify(replay.structuredContent ?? {}).slice(0, 1000));
    assert.equal(replay.structuredContent.data.outcome, "APPLIED");
    assert.equal(await git(bare, ["rev-parse", SPEC_BRANCH]), before, "a replay must not create another commit");
    const remoteTasks = await git(bare, ["show", `${SPEC_BRANCH}:.specs/spec-kernel/TASKS.md`]);
    assert.equal(remoteTasks.split("replay marker").length - 1, 1, "a replay must not apply the patch twice");
  });

  it("replays a successful archive with the same requestId as APPLIED", async () => {
    const { bare, url, tokens } = await setup();
    const args = {
      intent: "archiveSpec",
      spec: "spec-kernel",
      reason: "archive the fixture",
      dryRun: false,
      requestId: "w-archive-replay",
      designReview: ARCHIVE_REVIEW,
    };
    const first = await callTool(url, tokens.alice, "spec_patch", args);
    assert.equal(first.isError, false, JSON.stringify(first.structuredContent?.error ?? first.structuredContent?.data?.error ?? {}));
    assert.equal(first.structuredContent.data.outcome, "APPLIED");
    const before = await git(bare, ["rev-parse", SPEC_BRANCH]);

    const replay = await callTool(url, tokens.alice, "spec_patch", args);
    assert.equal(replay.isError, false, JSON.stringify(replay.structuredContent ?? {}).slice(0, 1000));
    assert.equal(replay.structuredContent.data.outcome, "APPLIED");
    assert.equal(await git(bare, ["rev-parse", SPEC_BRANCH]), before, "a replay must not create another commit");
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
    await git(operator, ["checkout", "-B", SPEC_BRANCH, `origin/${SPEC_BRANCH}`]);
    await git(operator, ["config", "user.email", "operator@example.invalid"]);
    await git(operator, ["config", "user.name", "operator"]);
    await writeFile(path.join(operator, "BREAK-GLASS.md"), "# break-glass\n\nOperator pushed directly.\n");
    await execFileAsync("git", ["-C", operator, "add", "."]);
    await execFileAsync("git", ["-C", operator, "commit", "-m", "chore: operator break-glass note"]);
    await execFileAsync("git", ["-C", operator, "push", "-q", "origin", `HEAD:refs/heads/${SPEC_BRANCH}`]);
    await rm(operator, { recursive: true, force: true });

    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({ requestId: "w-reconcile" }));
    assert.equal(result.isError, false, JSON.stringify(result?.structuredContent?.error ?? {}));
    assert.equal(result.structuredContent.data.outcome, "APPLIED", "the write must land even though the remote moved");

    const log = await git(bare, ["log", "--format=%s", "-4", SPEC_BRANCH]);
    assert.match(log, /operator break-glass note/u, "the out-of-band commit must stay on the remote");
    assert.match(log, /local-only: simulated rejected push/u, "the local commit must be replayed, not dropped");
    assert.match(log, /apply/u, "the bot commit must land on top of both");
    assert.match(await git(bare, ["show", `${SPEC_BRANCH}:.specs/spec-kernel/TASKS.md`]), /e2e write marker/u);
  });

  it("keeps the local commit and stays up when a break-glass rewrite conflicts", async () => {
    const { bare, cloneDir, url, tokens } = await setup();
    await git(cloneDir, ["config", "user.email", "bot@example.invalid"]);
    await git(cloneDir, ["config", "user.name", "spec-bot"]);
    // A local commit rewriting a document the remote will rewrite too.
    await writeFile(
      path.join(cloneDir, ".specs", "spec-kernel", "TASKS.md"),
      "# Tasks\n\nStatus: DRAFT\n\n## TASK-77 — local only\n- **Status:** todo\n",
    );
    await git(cloneDir, ["add", "."]);
    await git(cloneDir, ["commit", "-m", "local-only: conflicting write"]);

    const operator = await tempDir("spec-write-conflict-");
    await execFileAsync("git", ["clone", bare, operator]);
    await git(operator, ["checkout", "-B", SPEC_BRANCH, `origin/${SPEC_BRANCH}`]);
    await git(operator, ["config", "user.email", "operator@example.invalid"]);
    await git(operator, ["config", "user.name", "operator"]);
    await writeFile(
      path.join(operator, ".specs", "spec-kernel", "TASKS.md"),
      "# Tasks\n\nStatus: DRAFT\n\n## TASK-78 — operator rewrite\n- **Status:** todo\n",
    );
    await execFileAsync("git", ["-C", operator, "add", "."]);
    await execFileAsync("git", ["-C", operator, "commit", "-m", "chore: operator rewrite of TASKS.md"]);
    await execFileAsync("git", ["-C", operator, "push", "-q", "origin", `HEAD:refs/heads/${SPEC_BRANCH}`]);
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
    assert.equal(await git(cloneDir, ["rev-parse", "--abbrev-ref", "HEAD"]), "work/spec-spec-kernel");
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

    const remoteBefore = await git(bare, ["rev-parse", `refs/heads/${SPEC_BRANCH}`]);
    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({ requestId: "w-foreign" }));
    assert.equal(result.isError, true, "a foreign author must be refused, not published");
    assert.equal(result.structuredContent.error.causeCode, "FOREIGN_COMMITS");
    assert.equal(result.structuredContent.error.retryable, false);
    assert.equal(await git(bare, ["rev-parse", `refs/heads/${SPEC_BRANCH}`]), remoteBefore, "nothing may reach the remote");
    assert.match(await git(bare, ["log", "--format=%s", "-1", SPEC_BRANCH]), /seed/u);
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
    await git(operator, ["checkout", "-B", SPEC_BRANCH, `origin/${SPEC_BRANCH}`]);
    await git(operator, ["config", "user.email", "operator@example.invalid"]);
    await git(operator, ["config", "user.name", "operator"]);
    await writeFile(path.join(operator, "BREAK-GLASS.md"), "# break-glass\n");
    await execFileAsync("git", ["-C", operator, "add", "."]);
    await execFileAsync("git", ["-C", operator, "commit", "-m", "chore: operator note"]);
    await execFileAsync("git", ["-C", operator, "push", "-q", "origin", `HEAD:refs/heads/${SPEC_BRANCH}`]);
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
    const before = Number(await git(bare, ["rev-list", "--count", `refs/heads/${SPEC_BRANCH}`]));
    // Ten-users-at-once, scaled to the CI box: the writes race through HTTP at
    // the same instant; the write lock and the serialized git queue must turn
    // them into a linear sequence — never interleaved, never dropped.
    const attempt = (i) =>
      callTool(url, tokens.alice, "spec_patch", patchArgs({
        requestId: `w-concurrent-${i}`,
        // A plain marker, not a task heading: the admission gate refuses a raw
        // heading in TASKS.md, and this case is about the write queue, not the
        // corpus rules.
        operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: `concurrent write ${i}\n` }],
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

    const after = Number(await git(bare, ["rev-list", "--count", `refs/heads/${SPEC_BRANCH}`]));
    assert.equal(after - before, N, "exactly one commit per write — no merge commits, no lost writes");
    const authors = await git(bare, ["log", `--format=%ae`, `-${N}`, SPEC_BRANCH]);
    for (const author of authors.split("\n")) {
      assert.equal(author, IDENTITY.email, "every landed commit is bot-authored");
    }
    const remoteTasks = await git(bare, ["show", `${SPEC_BRANCH}:.specs/spec-kernel/TASKS.md`]);
    for (let i = 0; i < N; i += 1) {
      assert.match(remoteTasks, new RegExp(`concurrent write ${i}`, "u"), `write ${i} must reach the remote`);
    }
  });

  it("creates a canonical branch when createSpec targets a new slug", async () => {
    const { bare, url, tokens } = await setup();
    const result = await callTool(url, tokens.alice, "spec_patch", {
      intent: "createSpec",
      spec: "created-spec",
      title: "Created Spec",
      reason: "branch bootstrap",
      dryRun: false,
      requestId: "create-spec-1",
    });
    const retried = result.isError
      ? await callTool(url, tokens.alice, "spec_patch", {
          intent: "createSpec",
          spec: "created-spec",
          title: "Created Spec",
          reason: "branch bootstrap",
          dryRun: false,
          requestId: "create-spec-2",
        })
      : result;
    if (retried.isError) assert.fail(JSON.stringify(retried.structuredContent ?? {}).slice(0, 1500));
    assert.equal(retried.isError, false, JSON.stringify(retried.structuredContent ?? {}).slice(0, 1500));
    assert.equal(retried.structuredContent.data.outcome, "APPLIED");
    assert.equal(await git(bare, ["rev-parse", "--verify", "refs/heads/spec-created-spec"]).then(() => true), true);
    const metadata = JSON.parse(await git(bare, ["show", "spec-created-spec:.spec-kit.json"]));
    assert.equal(metadata.project, "stgmt/alpha");
    assert.equal(metadata.spec, "created-spec");
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

const ARCHIVE_RECEIPT = Object.freeze({
  proposalHash: "a".repeat(64),
  archive: { spec: "demo", destination: ".specs/archive/demo", fileCount: 1 },
});

async function pipelineFixture({
  receipt = ARCHIVE_RECEIPT,
  commitError = null,
  staged = true,
  branchArchived = false,
  readArchive = true,
  worktreeArchived = false,
  applied = false,
} = {}) {
  const base = await tempDir("spec-pipeline-");
  const readRoot = path.join(base, "read");
  const worktreeDir = path.join(base, "worktree");
  if (readArchive) {
    await mkdir(path.join(readRoot, ".specs", "archive", "demo"), { recursive: true });
    await writeFile(path.join(readRoot, ".specs", "archive", "demo", "README.md"), "# archived\n");
  }
  await mkdir(path.join(worktreeDir, ".specs", "demo"), { recursive: true });
  await writeFile(path.join(worktreeDir, ".specs", "demo", "README.md"), "# live\n");
  await writeFile(path.join(worktreeDir, ".spec-kit.json"), `${JSON.stringify({
    schema: "omp-spec-kit/spec-binding@1",
    project: "stgmt/alpha",
    spec: "demo",
    repo: "stgmt/alpha",
    branch: "spec-demo",
    createdAt: "2026-11-21T00:00:00.000Z",
  }, null, 2)}\n`);
  const calls = [];
  const refreshes = [];
  const forgotten = [];
  const git = {
    add: async (paths) => { calls.push({ op: "add", paths }); },
    commit: async () => {
      calls.push({ op: "commit" });
      if (commitError) throw commitError;
    },
    commitAuthors: async () => [],
    revParse: async () => null,
    objectType: async (_revision, filePath) => (
      branchArchived && filePath === ".specs/archive/demo" ? "tree" : null
    ),
    hasStagedChanges: async () => staged,
    push: async () => { calls.push({ op: "push" }); },
  };
  const pipeline = createWritePipeline({
    mounts: {
      acquireWriteLock: async () => () => {},
      worktreeFor: async () => ({ git, cwd: worktreeDir, branch: "spec-demo", archived: worktreeArchived }),
      projectRoot: async () => readRoot,
      serviceFor: () => ({
        runQuery: async () => ({ ok: true, data: { outcome: "APPLIED", receipt } }),
        forgetApplied: (requestId) => { forgotten.push(requestId); },
        hasApplied: () => applied,
      }),
      refreshProject: async () => { refreshes.push("refresh"); },
    },
    claims: { get: () => null },
    identity: IDENTITY,
    logger: () => {},
  });
  const result = await pipeline.specPatch({
    args: { spec: "demo", dryRun: false, requestId: "pipeline-1", reason: "archive the demo" },
    ctx: { identity: { login: "alice" }, role: "owner" },
    project: "stgmt/alpha",
    requestId: "pipeline-1",
  });
  return { result, calls, refreshes, forgotten, worktreeDir };
}

describe("write pipeline archive staging", () => {
  it("stages the archive move instead of copying the source the kernel removed", async () => {
    const { result, calls, worktreeDir } = await pipelineFixture();
    assert.equal(result.envelope.ok, true, JSON.stringify(result.envelope.error ?? {}));
    assert.deepEqual(calls[0], { op: "add", paths: [".spec-kit.json", ".specs/demo", ".specs/archive/demo"] });
    assert.equal(await readFile(path.join(worktreeDir, ".specs", "archive", "demo", "README.md"), "utf8"), "# archived\n");
    const marker = JSON.parse(await readFile(path.join(worktreeDir, ".spec-kit.json"), "utf8"));
    assert.equal(marker.archive.by, "alice");
    assert.equal(marker.archive.path, ".specs/archive/demo");
    assert.equal(marker.archive.reason, "archive the demo");
    await assert.rejects(
      readFile(path.join(worktreeDir, ".specs", "demo", "README.md")),
      (error) => error?.code === "ENOENT",
    );
    assert.equal(calls.filter((call) => call.op === "commit").length, 1);
    assert.equal(calls.filter((call) => call.op === "push").length, 1);
  });

  it("reports a failed commit instead of a successful push of an empty range", async () => {
    const { result, calls, refreshes, forgotten } = await pipelineFixture({ commitError: new Error("index is corrupt") });
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.error.causeCode, "GIT_COMMIT_FAILED");
    assert.equal(result.envelope.error.stage, "commit");
    assert.equal(result.envelope.error.retryable, true);
    assert.equal(calls.some((call) => call.op === "push"), false, "an uncommitted apply must never be pushed as success");
    assert.deepEqual(refreshes, ["refresh"], "the materialised root must be rebuilt from the branches");
    assert.deepEqual(forgotten, ["pipeline-1"], "a failed commit must drop the APPLIED memo so a retry can recompile");
  });

  it("reports a failed staging step with its own cause code", async () => {
    const { result, calls, refreshes, forgotten } = await pipelineFixture({ readArchive: false });
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.error.causeCode, "WRITE_STAGING_FAILED");
    assert.equal(result.envelope.error.stage, "sync");
    assert.equal(calls.some((call) => call.op === "commit"), false);
    assert.equal(calls.some((call) => call.op === "push"), false);
    assert.deepEqual(refreshes, ["refresh"]);
    assert.deepEqual(forgotten, ["pipeline-1"]);
  });

  it("returns APPLIED without a second commit when the archive already landed", async () => {
    const { result, calls, forgotten } = await pipelineFixture({ branchArchived: true, staged: false });
    assert.equal(result.envelope.ok, true, JSON.stringify(result.envelope.error ?? {}));
    assert.equal(calls.some((call) => call.op === "commit"), false, "a replay must not create another commit");
    assert.equal(calls.some((call) => call.op === "push"), true);
    assert.deepEqual(forgotten, []);
  });

  it("refuses a write on an archived spec before the kernel sees it", async () => {
    const { result, calls } = await pipelineFixture({ worktreeArchived: true, applied: false });
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.error.code, "SPEC_ARCHIVED");
    assert.equal(result.envelope.error.retryable, false);
    assert.deepEqual(calls, [], "an archived spec must not reach git");
  });

  it("refuses an archive receipt that names a destination outside the archive root", async () => {
    const { result, calls, refreshes } = await pipelineFixture({
      receipt: { proposalHash: "a".repeat(64), archive: { spec: "demo", destination: ".specs/elsewhere" } },
    });
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.error.causeCode, "ARCHIVE_DESTINATION_INVALID");
    assert.deepEqual(calls, []);
    assert.deepEqual(refreshes, ["refresh"]);
  });
});
