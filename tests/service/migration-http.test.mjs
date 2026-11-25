import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { startService } from "../../src/service/index.js";
import { specWorkBranchName } from "../../src/service/spec-binding.js";
import { commitToSpecBranch, seedSpecBranch } from "./lib/spec-repo.mjs";
import { startMigrationAuthMock } from "./lib/migration-http-auth.mjs";
import { isolateGitEnvironment } from "../helpers/git-env.mjs";

const exec = promisify(execFile);
const project = "stgmt/alpha";
const spec = "migration-http";
const branch = `spec-${spec}`;
const storyDoc = `${spec}-user-stories.feature`;
const caseDoc = `${spec}-use-cases.feature`;
const oldFeatureDoc = `${spec}.feature`;
const identity = { name: "spec-bot", email: "bot@example.invalid" };
const rmOptions = { recursive: true, force: true, maxRetries: 20, retryDelay: 250 };

const oldStory = "# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n";
const oldCase = "# Cases\n## UC-1: Review\nActor: Author\n";
const oldFeature = "Feature: Preview\n  @id:SCEN-preview\n  Scenario: Show\n    Given one edit\n    When the author requests preview\n    Then the diff appears\n";
const story = `Feature: Stories
  Context: Feature Preview
  @story:US-1
  Rule: Review
    Actor: Author
    Goal: Inspect
    Benefit: Safety
    @id:SCEN-preview
    Scenario: Show
      Given one edit
      When the author requests preview
      Then the diff appears
`;
const useCase = `Feature: Cases
  @case:UC-1 @story:US-1
  Rule: Review
    Actor: Author
    Boundary: MCP
    Trigger: Request
    Precondition: An edit exists
    Success: The diff appears
    Step: inspect | Inspect the edit
    Branch: ok | inspect | An edit exists | The diff appears | end
    ScenarioRef: ok | SCEN-preview
`;

async function git(cwd, args) {
  return (await exec("git", args, { cwd, maxBuffer: 32 * 1024 * 1024 })).stdout.trim();
}

async function tool(url, token, name, args) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const body = await response.json();
  assert.ok(body.result?.structuredContent, `HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body.result.structuredContent;
}

async function setup(t, { sourceLink = false, userStories = oldStory } = {}) {
  isolateGitEnvironment();
  const base = await mkdtemp(path.join(tmpdir(), "spec-migration-http-"));
  let service;
  const authMock = await startMigrationAuthMock();
  t.after(async () => {
    service?.sync?.stop();
    service?.store?.close?.();
    if (service?.server) {
      service.server.closeAllConnections?.();
      await new Promise((resolve) => service.server.close(resolve));
    }
    await authMock.close();
    await rm(base, rmOptions);
  });
  const bare = path.join(base, "specs.git");
  const sentinel = path.join(base, "scenario-executed");
  await exec("git", ["init", "--bare", "--initial-branch=main", bare]);
  const legacyFiles = {
    "README.md": "# Migration test\n\nStatus: DRAFT\n",
    "USER_STORIES.md": userStories,
    "USE_CASES.md": oldCase,
    [oldFeatureDoc]: oldFeature,
    "FR.md": "# Requirements\n",
    "execution-probe.mjs": `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'executed');\n`,
  };
  const canonicalFiles = {
    "README.md": "# Migration test\n\nStatus: DRAFT\n\n[Future](../demo-http/demo-http-user-stories.feature#us-1)\n",
    [storyDoc]: "Feature: Stories\n",
    [caseDoc]: "Feature: Cases\n",
  };
  await seedSpecBranch(bare, { project, spec, files: sourceLink ? canonicalFiles : legacyFiles });
  const neighborLegacy = {
    "README.md": "# Neighbor\n\nStatus: DRAFT\n",
    "USER_STORIES.md": "# Stories\n",
    "USE_CASES.md": "# Cases\n",
    "neighbor.feature": "Feature: Neighbor\n",
  };
  const neighborCanonical = { "README.md": "# Neighbor\n\nStatus: DRAFT\n", "neighbor-user-stories.feature": "Feature: Stories\n", "neighbor-use-cases.feature": "Feature: Cases\n" };
  await seedSpecBranch(bare, { project, spec: "neighbor", files: sourceLink ? neighborCanonical : neighborLegacy });
  const configPath = path.join(base, "config.json");
  const authUrl = authMock.url;
  await writeFile(configPath, JSON.stringify(authMock.config(project, bare)));
  const env = { ...process.env, SPEC_REGISTRY_YT_URL: authUrl, SPEC_REGISTRY_YT_SERVICE_TOKEN: "service-token-0123456789", SPEC_REGISTRY_PROJECTION: "0" };
  const start = () => startService({ configPath, cloneDir: path.join(base, "clone"), storeFile: path.join(base, "registry.db"), port: 0, identity, logger: () => {}, env });
  service = await start();
  const ctx = { base, bare, sentinel, service, authCalls: authMock.calls, owner: authMock.owner, writer: authMock.writer };
  ctx.url = `http://127.0.0.1:${service.server.address().port}/mcp`;
  ctx.restart = async () => {
    service.sync?.stop();
    service.store?.close?.();
    service.server.closeAllConnections?.();
    await new Promise((resolve) => service.server.close(resolve));
    service = await start();
    ctx.service = service;
    ctx.url = `http://127.0.0.1:${service.server.address().port}/mcp`;
  };
  return ctx;
}

async function inventory(ctx, topic) {
  const result = await tool(ctx.url, ctx.owner, "spec_documents", { action: "list", project, spec, includeSnapshot: true, ...(topic ? { topic } : {}) });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.ok(result.data.docs.includes("USER_STORIES.md"));
  assert.ok(result.data.docs.includes(oldFeatureDoc));
  assert.match(result.data.snapshot, /^snapshot-v1\./u);
  return result.data;
}

function migration(inventoryData, topic) {
  const hashes = Object.fromEntries(inventoryData.files.map((item) => [item.path, item.sha256]));
  const map = (sourceDocument, sourceStartLine, sourceEndLine, targetDocument, targetStartLine, targetEndLine) => ({
    sourceDocument, sourceSha256: hashes[sourceDocument], sourceStartLine, sourceEndLine, targetDocument, targetStartLine, targetEndLine,
  });
  return {
    intent: "migrateSpec", project, spec, ...(topic ? { topic } : {}), requestId: `migrate-${topic ?? "canonical"}`,
    reason: "Migrate this specification", snapshot: inventoryData.snapshot,
    decisions: [{ caseId: "UC-1", storyId: "US-1", reason: "Owner confirmed the relation" }],
    fieldDecisions: Object.entries({ Boundary: "MCP", Trigger: "Request", Precondition: "An edit exists", Success: "The diff appears",
      "Step:inspect": "Inspect the edit", "Branch:ok": "inspect | An edit exists | The diff appears | end", "ScenarioRef:ok": "SCEN-preview" })
      .map(([field, value]) => ({ entityId: "UC-1", field, value, reason: "Test owner approved the case field",
        sourceDocument: "USE_CASES.md", sourceSha256: hashes["USE_CASES.md"], sourceStartLine: 2, sourceEndLine: 3 })),
    mapping: [
      map("USER_STORIES.md", 1, 1, storyDoc, 1, 1),
      map("USER_STORIES.md", 2, 5, storyDoc, 3, 7),
      map("USE_CASES.md", 1, 1, caseDoc, 1, 1),
      map("USE_CASES.md", 2, 3, caseDoc, 2, 4),
      map(oldFeatureDoc, 1, 1, storyDoc, 1, 2),
      map(oldFeatureDoc, 2, 6, storyDoc, 8, 12),
    ],
    operations: [
      { kind: "replace_document", document: storyDoc, content: story },
      { kind: "replace_document", document: caseDoc, content: useCase },
    ],
  };
}

async function preview(ctx, data, topic) {
  const args = migration(data, topic);
  const result = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(result.ok, true, JSON.stringify(result.error ?? result.data));
  assert.equal(result.data.outcome, "PREVIEW", JSON.stringify(result));
  return { args, hash: result.data.proposalHash };
}

async function remoteFile(ctx, ref, file) {
  return git(ctx.bare, ["show", `${ref}:.specs/${spec}/${file}`]);
}

test("hosted HTTP MCP reads legacy and atomically migrates exactly one specification", async (t) => {
  const ctx = await setup(t);
  const initialHead = await git(ctx.bare, ["rev-parse", branch]);
  const neighborHead = await git(ctx.bare, ["rev-parse", "spec-neighbor"]);
  const data = await inventory(ctx);
  const read = await tool(ctx.url, ctx.writer, "spec_documents", { action: "read", project, spec, doc: "USER_STORIES.md", snapshot: data.snapshot, readForEdit: true });
  assert.equal(read.ok, true, JSON.stringify(read.error));
  assert.equal(read.data.content, oldStory);
  const patch = { intent: "patch", project, spec, requestId: "ordinary-write", reason: "Update requirements", operations: [{ kind: "replace_document", document: "FR.md", content: "# Updated requirements\n" }], dryRun: false };
  const blocked = await tool(ctx.url, ctx.writer, "spec_patch", patch);
  assert.equal(blocked.ok, false, JSON.stringify(blocked));
  assert.equal(blocked.error.causeCode, "LEGACY_SPEC_LAYOUT");
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), initialHead);
  const { args, hash } = await preview(ctx, data);
  const denied = await tool(ctx.url, ctx.writer, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(denied.ok, false, JSON.stringify(denied));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), initialHead);
  const applied = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(applied.ok, true, JSON.stringify(applied.error ?? applied.data));
  assert.equal(applied.data.outcome, "APPLIED", JSON.stringify(applied));
  const migratedHead = await git(ctx.bare, ["rev-parse", branch]);
  assert.notEqual(migratedHead, initialHead);
  assert.equal(await git(ctx.bare, ["rev-parse", "spec-neighbor"]), neighborHead);
  assert.equal(await remoteFile(ctx, branch, storyDoc), story.trimEnd());
  assert.equal(await remoteFile(ctx, branch, caseDoc), useCase.trimEnd());
  const tree = await git(ctx.bare, ["ls-tree", "--name-only", `${branch}:.specs/${spec}`]);
  for (const name of ["USER_STORIES.md", "USE_CASES.md", oldFeatureDoc]) assert.ok(!tree.split("\n").includes(name));
  assert.ok(tree.split("\n").includes("execution-probe.mjs"));
  const replay = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(replay.ok, true, JSON.stringify(replay.error ?? replay.data));
  assert.equal(replay.data.outcome, "APPLIED", JSON.stringify(replay));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), migratedHead, "replay must not create a second commit");
  await ctx.restart();
  const replayAfterRestart = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(replayAfterRestart.ok, true, JSON.stringify(replayAfterRestart.error ?? replayAfterRestart.data));
  assert.equal(replayAfterRestart.data.outcome, "APPLIED", JSON.stringify(replayAfterRestart));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), migratedHead, "replay after process restart must not create a second commit");
  const retried = await tool(ctx.url, ctx.writer, "spec_patch", patch);
  assert.equal(retried.ok, true, JSON.stringify(retried.error ?? retried.data));
  assert.equal(retried.data.outcome, "APPLIED");
  assert.equal(await remoteFile(ctx, branch, "FR.md"), "# Updated requirements");
  await assert.rejects(access(ctx.sentinel), { code: "ENOENT" }, "the specification scenario and attached executable were never run");
});

test("hosted HTTP MCP migrates a 7 MiB legacy story through preview and apply", async (t) => {
  const largeContext = "APIKey-Case-Sensitive ".repeat(330000);
  const sourceStory = `${oldStory}Context: ${largeContext}\n`;
  const ctx = await setup(t, { userStories: sourceStory });
  const neighborHead = await git(ctx.bare, ["rev-parse", "spec-neighbor"]);
  const inventoryData = await inventory(ctx);
  assert.ok(Buffer.byteLength(sourceStory) > 2 * 1024 * 1024);
  assert.ok(Buffer.byteLength(sourceStory) < 8 * 1024 * 1024);

  let offset = 0;
  let readBack = "";
  for (;;) {
    const page = await tool(ctx.url, ctx.writer, "spec_documents", {
      action: "read", project, spec, doc: "USER_STORIES.md", snapshot: inventoryData.snapshot,
      byteOffset: offset, byteLimit: 1_500_000,
    });
    assert.equal(page.ok, true, JSON.stringify(page.error));
    readBack += page.data.content;
    offset = page.data.nextByteOffset;
    if (!page.data.truncated) break;
  }
  assert.equal(readBack, sourceStory);

  const targetStory = story.replace("    Benefit: Safety\n", `    Benefit: Safety\n    Context: ${largeContext}\n`);
  const proposal = migration(inventoryData);
  const sourceHash = proposal.mapping.find((item) => item.sourceDocument === "USER_STORIES.md").sourceSha256;
  proposal.mapping.push({
    sourceDocument: "USER_STORIES.md", sourceSha256: sourceHash, sourceStartLine: 6, sourceEndLine: 6,
    targetDocument: storyDoc, targetStartLine: 8, targetEndLine: 8,
  });
  proposal.mapping = proposal.mapping.map((item) => item.sourceDocument === oldFeatureDoc && item.sourceStartLine === 2
    ? { ...item, targetStartLine: item.targetStartLine + 1, targetEndLine: item.targetEndLine + 1 }
    : item);
  proposal.operations[0].content = targetStory;
  const preview = await tool(ctx.url, ctx.owner, "spec_patch", { ...proposal, dryRun: true });
  assert.equal(preview.ok, true, JSON.stringify(preview.error ?? preview.data));
  assert.equal(preview.data.outcome, "PREVIEW");

  const applied = await tool(ctx.url, ctx.owner, "spec_patch", {
    ...proposal, expectedProposalHash: preview.data.proposalHash, dryRun: false,
  });
  assert.equal(applied.ok, true, JSON.stringify(applied.error ?? applied.data));
  assert.equal(applied.data.outcome, "APPLIED");
  assert.equal(await remoteFile(ctx, branch, storyDoc), targetStory.trimEnd());
  const tree = await git(ctx.bare, ["ls-tree", "--name-only", `${branch}:.specs/${spec}`]);
  for (const name of ["USER_STORIES.md", "USE_CASES.md", oldFeatureDoc]) assert.ok(!tree.split("\n").includes(name));
  assert.equal(await git(ctx.bare, ["rev-parse", "spec-neighbor"]), neighborHead);
  await assert.rejects(access(ctx.sentinel), { code: "ENOENT" });
});

test("hosted migration refuses a snapshot after remote HEAD changed", async (t) => {
  const ctx = await setup(t);
  const data = await inventory(ctx);
  const { args, hash } = await preview(ctx, data);
  await commitToSpecBranch(ctx.bare, { spec, files: { "FR.md": "# Changed by another writer\n" } });
  const changedHead = await git(ctx.bare, ["rev-parse", branch]);
  const result = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.error?.code ?? result.data?.error?.code, "CONFLICT", JSON.stringify(result));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), changedHead);
  assert.equal(await remoteFile(ctx, branch, "USER_STORIES.md"), oldStory.trimEnd());
});

test("hosted topic migration changes only its selected work branch", async (t) => {
  const ctx = await setup(t);
  const topic = "try-migration";
  const topicBranch = specWorkBranchName(spec, topic);
  const initialHead = await git(ctx.bare, ["rev-parse", branch]);
  await git(ctx.bare, ["update-ref", `refs/heads/${topicBranch}`, initialHead]);
  const neighborHead = await git(ctx.bare, ["rev-parse", "spec-neighbor"]);
  const data = await inventory(ctx, topic);
  const incompatible = await tool(ctx.url, ctx.owner, "spec_documents", { action: "list", project, spec, topic, includeArchived: true, includeSnapshot: true });
  assert.equal(incompatible.ok, false, JSON.stringify(incompatible));
  const beforeCatalog = await tool(ctx.url, ctx.owner, "spec_catalog", { view: "branches", project });
  assert.equal(beforeCatalog.ok, true, JSON.stringify(beforeCatalog));
  assert.equal(beforeCatalog.data.branches.find((item) => item.branch === branch)?.layout, "legacy");
  assert.equal(beforeCatalog.data.branches.find((item) => item.branch === topicBranch)?.layout, "legacy");
  const { args, hash } = await preview(ctx, data, topic);
  const wrongScope = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, topic: undefined, expectedProposalHash: hash, dryRun: false });
  assert.equal(wrongScope.ok, false, JSON.stringify(wrongScope));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), initialHead);
  const result = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(result.ok, true, JSON.stringify(result.error ?? result.data));
  assert.equal(result.data.outcome, "APPLIED", JSON.stringify(result));
  assert.notEqual(await git(ctx.bare, ["rev-parse", topicBranch]), initialHead);
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), initialHead);
  assert.equal(await git(ctx.bare, ["rev-parse", "spec-neighbor"]), neighborHead);
  assert.equal(await remoteFile(ctx, topicBranch, storyDoc), story.trimEnd());
  assert.equal(await remoteFile(ctx, branch, "USER_STORIES.md"), oldStory.trimEnd());
  const afterCatalog = await tool(ctx.url, ctx.owner, "spec_catalog", { view: "branches", project });
  assert.equal(afterCatalog.ok, true, JSON.stringify(afterCatalog));
  assert.equal(afterCatalog.data.branches.find((item) => item.branch === branch)?.layout, "legacy");
  assert.equal(afterCatalog.data.branches.find((item) => item.branch === topicBranch)?.layout, "canonical");
});

test("failed push does not report success and retry applies only after the remote accepts it", async (t) => {
  const ctx = await setup(t);
  const oldHead = await git(ctx.bare, ["rev-parse", branch]);
  const data = await inventory(ctx);
  const { args, hash } = await preview(ctx, data);
  const hook = path.join(ctx.bare, "hooks", "pre-receive");
  await writeFile(hook, "#!/bin/sh\necho 'test denies push' >&2\nexit 1\n", { mode: 0o755 });
  await chmod(hook, 0o755);
  const denied = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(denied.ok, false, JSON.stringify(denied));
  assert.notEqual(denied.data?.outcome, "APPLIED", JSON.stringify(denied));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), oldHead);
  assert.equal(await remoteFile(ctx, branch, "USER_STORIES.md"), oldStory.trimEnd());
  await rm(hook, { force: true });
  const retried = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(retried.ok, true, JSON.stringify(retried.error ?? retried.data));
  assert.equal(retried.data.outcome, "APPLIED", JSON.stringify(retried));
  assert.notEqual(await git(ctx.bare, ["rev-parse", branch]), oldHead);
});

test("a fresh demo scaffold with an unresolved inbound reference is not deleted", async (t) => {
  const ctx = await setup(t, { sourceLink: true });
  const created = await tool(ctx.url, ctx.writer, "spec_branch", { action: "create", project, spec: "demo-http", demo: true, requestId: "demo-create" });
  assert.equal(created.ok, true, JSON.stringify(created.error));
  const oldHead = await git(ctx.bare, ["rev-parse", "spec-demo-http"]);
  const denied = await tool(ctx.url, ctx.writer, "spec_branch", { action: "deleteSpec", project, spec: "demo-http", requestId: "demo-delete" });
  assert.equal(denied.ok, false, JSON.stringify(denied));
  assert.equal(denied.error.code, "DEPENDENTS_UNVERIFIED", JSON.stringify(denied));
  assert.equal(await git(ctx.bare, ["rev-parse", "spec-demo-http"]), oldHead);
});

test("migration refuses an unrelated staged binding without modifying it", async (t) => {
  const ctx = await setup(t);
  const data = await inventory(ctx);
  const { args, hash } = await preview(ctx, data);
  const worktree = await ctx.service.mounts.worktreeFor(project, spec, { preserveChanges: true });
  const filename = path.join(worktree.cwd, ".spec-kit.json");
  const original = JSON.parse(await readFile(filename, "utf8"));
  const userBytes = `${JSON.stringify({ ...original, userNote: "not part of migration" }, null, 2)}\n`;
  await writeFile(filename, userBytes);
  await git(worktree.cwd, ["add", "--", ".spec-kit.json"]);
  const staged = await git(worktree.cwd, ["diff", "--cached", "--", ".spec-kit.json"]);
  const before = await git(ctx.bare, ["rev-parse", branch]);
  const result = await tool(ctx.url, ctx.owner, "spec_patch", { ...args, expectedProposalHash: hash, dryRun: false });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.error?.causeCode, "SPEC_WORKTREE_DIRTY", JSON.stringify(result));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), before);
  assert.equal(await readFile(filename, "utf8"), userBytes);
  assert.equal(await git(worktree.cwd, ["diff", "--cached", "--", ".spec-kit.json"]), staged);
  assert.equal(await remoteFile(ctx, branch, "USER_STORIES.md"), oldStory.trimEnd());
});

test("merge refuses an unrelated staged binding without modifying it", async (t) => {
  const ctx = await setup(t, { sourceLink: true });
  const topic = "dirty-index";
  const workBranch = specWorkBranchName(spec, topic);
  const created = await tool(ctx.url, ctx.owner, "spec_branch", { action: "create", project, spec, topic, requestId: "create-dirty-index" });
  assert.equal(created.ok, true, JSON.stringify(created));
  await commitToSpecBranch(ctx.bare, { spec, branch: workBranch, files: { "FR.md": "# A planned change\n" } });
  const worktree = await ctx.service.mounts.worktreeFor(project, spec, { preserveChanges: true });
  const filename = path.join(worktree.cwd, ".spec-kit.json");
  const original = JSON.parse(await readFile(filename, "utf8"));
  const userBytes = `${JSON.stringify({ ...original, userNote: "not part of merge" }, null, 2)}\n`;
  await writeFile(filename, userBytes);
  await git(worktree.cwd, ["add", "--", ".spec-kit.json"]);
  const staged = await git(worktree.cwd, ["diff", "--cached", "--", ".spec-kit.json"]);
  const before = await git(ctx.bare, ["rev-parse", branch]);
  const result = await tool(ctx.url, ctx.owner, "spec_branch", { action: "merge", project, spec, topic, requestId: "merge-dirty-index" });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.error?.code, "SPEC_WORKTREE_DIRTY", JSON.stringify(result));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), before);
  assert.equal(await readFile(filename, "utf8"), userBytes);
  assert.equal(await git(worktree.cwd, ["diff", "--cached", "--", ".spec-kit.json"]), staged);
});

