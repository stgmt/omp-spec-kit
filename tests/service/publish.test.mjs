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
const SPEC_KEY = "stgmt/alpha/spec-kernel";
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

async function setup({ syncIntervalMs = 0 } = {}) {
  const fixture = await loadLiveFixture();
  const base = await tempDir("spec-publish-");
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
  const service = await startService({ configPath, cloneDir: path.join(base, "clone"), port: 0, identity: IDENTITY, logger: () => {}, syncIntervalMs });
  servers.push(service.server);
  services.push(service);
  return {
    fixture,
    service,
    bare,
    cloneDir: path.join(base, "clone"),
    url: `http://127.0.0.1:${service.server.address().port}/mcp`,
    tokens: { alice: await fixture.userToken("alice") },
  };
}

function patchArgs(overrides = {}) {
  return {
    intent: "patch",
    spec: "spec-kernel",
    reason: "publish test",
    dryRun: false,
    operations: [{ kind: "insert_at_eof", document: "README.md", text: "\nStatus: ACTIVE\nVersion: 1.0.0\n" }],
    requestId: "p1",
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

async function flipActive(url, token, version) {
  const result = await callTool(url, token, "spec_patch", patchArgs({
    operations: [{ kind: "insert_at_eof", document: "README.md", text: `\nStatus: ACTIVE\nVersion: ${version}\n` }],
    requestId: `flip-${version}`,
  }));
  assert.equal(result.isError, false, JSON.stringify(result.structuredContent?.error ?? result.structuredContent?.data?.error ?? {}));
  assert.equal(result.structuredContent.data.outcome, "APPLIED");
}

const TAG = "spec/stgmt/alpha/spec-kernel";

describe("publish pipeline (TASK-9): ACTIVE → immutable tag + ledger", () => {
  it("tags and ledgers a spec flipped to ACTIVE, and is a no-op on repeat", async () => {
    const { bare, service, url, tokens } = await setup();
    await flipActive(url, tokens.alice, "1.0.0");

    const head = await git(bare, ["rev-parse", "main"]);
    const tags = await git(bare, ["tag", "-l"]);
    assert.match(tags, new RegExp(`^${TAG.replaceAll("/", "\\/")}\\/1\\.0\\.0$`, "m"), `remote tags: ${tags}`);
    // The tag peels to the exact commit the spec went ACTIVE on.
    const tagCommit = await git(bare, ["rev-parse", `refs/tags/${TAG}/1.0.0^{}`]);
    assert.equal(tagCommit, head);
    // Annotated tag carries the bot identity — that is the attestation.
    const tagger = await git(bare, ["for-each-ref", `refs/tags/${TAG}/1.0.0`, "--format=%(taggeremail)"]);
    assert.equal(tagger, `<${IDENTITY.email}>`);

    const rows = service.store.getLedger(SPEC_KEY);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].version, "1.0.0");
    assert.equal(rows[0].commitSha, head);
    // The digest is the tree hash of the spec dir at that commit.
    const tree = await git(bare, ["rev-parse", `${head}:stgmt/alpha/.specs/spec-kernel`]);
    assert.equal(rows[0].digest, tree);

    const again = await service.publisher.publishSpec("stgmt/alpha", "spec-kernel");
    assert.equal(again.outcome, "noop");
    assert.equal(service.store.getLedger(SPEC_KEY).length, 1);
    assert.equal((await git(bare, ["tag", "-l"])).split("\n").filter(Boolean).length, 1);
  });

  it("leaves DRAFT specs unpublished", async () => {
    const { bare, service, url, tokens } = await setup();
    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-1 — draft edit\n" }],
      requestId: "draft-1",
    }));
    assert.equal(result.structuredContent.data.outcome, "APPLIED");
    const results = await service.publisher.publishAll();
    assert.ok(results.every((r) => r.outcome === "skipped"));
    assert.equal(await git(bare, ["tag", "-l"]), "");
    assert.equal(service.store.getLedger(SPEC_KEY).length, 0);
  });

  it("publishes a bumped version as a second tag without touching the first", async () => {
    const { bare, service, url, tokens } = await setup();
    await flipActive(url, tokens.alice, "1.0.0");
    // Bump the version in place: replace the README wholesale.
    const readme = await git(bare, ["show", "main:stgmt/alpha/.specs/spec-kernel/README.md"]);
    const bumped = readme.replace("Version: 1.0.0", "Version: 1.1.0");
    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({
      operations: [{ kind: "replace_document", document: "README.md", content: bumped }],
      requestId: "bump-1.1",
    }));
    assert.equal(result.structuredContent.data.outcome, "APPLIED");

    const tags = (await git(bare, ["tag", "-l"])).split("\n").sort();
    assert.deepEqual(tags, [`${TAG}/1.0.0`, `${TAG}/1.1.0`]);
    const rows = service.store.getLedger(SPEC_KEY);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].version, "1.1.0");
    // The old tag still resolves to its original commit — immutable.
    const first = rows.find((r) => r.version === "1.0.0");
    assert.equal(await git(bare, ["rev-parse", `refs/tags/${TAG}/1.0.0^{}`]), first.commitSha);
  });

  it("rejects different content under an existing version and surfaces it in /drift", async () => {
    const { bare, service, url, tokens } = await setup();
    await flipActive(url, tokens.alice, "1.0.0");
    const publishedTag = await git(bare, ["rev-parse", `refs/tags/${TAG}/1.0.0^{}`]);

    // Same version, changed content — version squatting must be refused.
    const readme = await git(bare, ["show", "main:stgmt/alpha/.specs/spec-kernel/README.md"]);
    const tampered = readme + "\n\nSilent rewrite under the same version.\n";
    const result = await callTool(url, tokens.alice, "spec_patch", patchArgs({
      operations: [{ kind: "replace_document", document: "README.md", content: tampered }],
      requestId: "squat-1",
    }));
    assert.equal(result.structuredContent.data.outcome, "APPLIED", "the spec write itself still lands — publication is what is refused");

    assert.equal(service.store.getLedger(SPEC_KEY).length, 1, "no second ledger row");
    assert.equal(await git(bare, ["rev-parse", `refs/tags/${TAG}/1.0.0^{}`]), publishedTag, "the tag is never moved");

    const drift = await service.driftReport();
    const rejected = drift.events.filter((event) => event.kind === "publish-rejected");
    assert.ok(rejected.some((event) => event.spec === "spec-kernel"), `drift must surface the rejection: ${JSON.stringify(drift.events)}`);
  });

  it("serves versioned reads from the tagged commit, not the moved HEAD", async () => {
    const { service, url, tokens } = await setup();
    await flipActive(url, tokens.alice, "1.0.0");

    // Move the document after publishing.
    const moved = await callTool(url, tokens.alice, "spec_patch", patchArgs({
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-88 — after publish\n" }],
      requestId: "after-publish",
    }));
    assert.equal(moved.structuredContent.data.outcome, "APPLIED");

    const live = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "TASKS.md" });
    assert.match(live.structuredContent.data.content, /TASK-88 — after publish/u, "live read sees the moved HEAD");

    const frozen = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "TASKS.md", version: "1.0.0" });
    assert.equal(frozen.isError, false, JSON.stringify(frozen.structuredContent?.error ?? {}));
    assert.ok(!frozen.structuredContent.data.content.includes("TASK-88"), "versioned read returns the published snapshot");
    assert.equal(frozen.structuredContent.data.published.version, "1.0.0");
    assert.equal(frozen.structuredContent.data.published.commit, service.store.getLedger(SPEC_KEY)[0].commitSha);

    const missing = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "TASKS.md", version: "9.9.9" });
    assert.equal(missing.isError, true);
    assert.equal(missing.structuredContent.error.code, "VERSION_NOT_FOUND");
  });

  it("concurrent publishes of one spec produce exactly one tag and one row", async () => {
    const { bare, cloneDir, service } = await setup();
    // An ACTIVE spec lands out-of-band so no publish has run yet — then two
    // callers race the same publish path (post-push and post-reconcile style).
    const operator = await tempDir("spec-pub-race-");
    const work = path.join(operator, "work");
    await execFileAsync("git", ["clone", bare, work]);
    await git(work, ["config", "user.email", "operator@example.invalid"]);
    await git(work, ["config", "user.name", "operator"]);
    await cp(FIXTURE_SPEC, path.join(work, "stgmt", "alpha", ".specs", "spec-kernel"), { recursive: true });
    await writeFile(path.join(work, "stgmt", "alpha", ".specs", "spec-kernel", "README.md"), "# Spec Kernel\n\nStatus: ACTIVE\nVersion: 1.0.0\n");
    await execFileAsync("git", ["-C", work, "add", "."]);
    await execFileAsync("git", ["-C", work, "commit", "-m", "break-glass: activate spec-kernel"]);
    await execFileAsync("git", ["-C", work, "push", "-q", "origin", "HEAD:refs/heads/main"]);
    await execFileAsync("git", ["-C", cloneDir, "fetch", "origin"]);
    await execFileAsync("git", ["-C", cloneDir, "merge", "--ff-only", "origin/main"]);

    const [a, b] = await Promise.all([
      service.publisher.publishSpec("stgmt/alpha", "spec-kernel"),
      service.publisher.publishSpec("stgmt/alpha", "spec-kernel"),
    ]);
    const outcomes = [a.outcome, b.outcome].sort();
    assert.ok(outcomes.every((o) => ["published", "adopted", "noop"].includes(o)), JSON.stringify([a, b]));
    assert.equal((await git(bare, ["tag", "-l"])).split("\n").filter(Boolean).length, 1);
    assert.equal(service.store.getLedger(SPEC_KEY).length, 1);
  });

  it("publishes an ACTIVE spec that arrived by an out-of-band push after reconcile", async () => {
    const { bare, cloneDir, service, url, tokens } = await setup({ syncIntervalMs: 0 });
    // Operator pushes an ACTIVE spec straight to the remote (break-glass).
    const operator = await tempDir("spec-pub-operator-");
    const work = path.join(operator, "work");
    await execFileAsync("git", ["clone", bare, work]);
    await git(work, ["config", "user.email", "operator@example.invalid"]);
    await git(work, ["config", "user.name", "operator"]);
    await cp(FIXTURE_SPEC, path.join(work, "stgmt", "alpha", ".specs", "spec-kernel"), { recursive: true });
    await writeFile(path.join(work, "stgmt", "alpha", ".specs", "spec-kernel", "README.md"), "# Spec Kernel\n\nStatus: ACTIVE\nVersion: 2.0.0\n");
    await execFileAsync("git", ["-C", work, "add", "."]);
    await execFileAsync("git", ["-C", work, "commit", "-m", "break-glass: activate spec-kernel 2.0.0"]);
    await execFileAsync("git", ["-C", work, "push", "-q", "origin", "HEAD:refs/heads/main"]);

    // Reconcile the clone, then run the publish pass the sync loop would run.
    await execFileAsync("git", ["-C", cloneDir, "fetch", "origin"]);
    await execFileAsync("git", ["-C", cloneDir, "merge", "--ff-only", "origin/main"]);
    const results = await service.publisher.publishAll();
    assert.ok(results.some((r) => r.outcome === "published" && r.version === "2.0.0"), JSON.stringify(results));
    const tagCommit = await git(bare, ["rev-parse", `refs/tags/${TAG}/2.0.0^{}`]);
    assert.equal(tagCommit, await git(bare, ["rev-parse", "main"]));
    assert.equal(service.store.getLedger(SPEC_KEY).length, 1);
    void tokens; void url;
  });
});
