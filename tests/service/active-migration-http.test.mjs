import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { startService } from "../../src/service/index.js";
import { createStore } from "../../src/service/ledger.js";
import { commitToSpecBranch, seedSpecBranch } from "./lib/spec-repo.mjs";
import { startMigrationAuthMock } from "./lib/migration-http-auth.mjs";
import { isolateGitEnvironment } from "../helpers/git-env.mjs";

const exec = promisify(execFile);
const project = "stgmt/alpha";
const spec = "active-migration";
const branch = `spec-${spec}`;
const storyDoc = `${spec}-user-stories.feature`;
const caseDoc = `${spec}-use-cases.feature`;
const oldFeatureDoc = `${spec}.feature`;
const oldStory = "# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n";
const oldCase = "# Cases\n## UC-1: Review\nStory: US-1\nActor: Author\n";
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
const cases = `Feature: Cases
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
const identity = { name: "spec-bot", email: "bot@example.invalid" };
const tagRef = (version) => `refs/tags/spec/${project}/${spec}/${version}`;
const git = async (cwd, args) => (await exec("git", args, { cwd })).stdout.trim();

async function tool(ctx, token, name, args) {
  const response = await fetch(ctx.url, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const body = await response.json();
  assert.ok(body.result?.structuredContent, JSON.stringify(body));
  return body.result.structuredContent;
}

async function setup(t) {
  isolateGitEnvironment();
  const base = await mkdtemp(path.join(tmpdir(), "active-migration-"));
  const auth = await startMigrationAuthMock();
  let service;
  t.after(async () => {
    service?.sync?.stop();
    service?.store?.close?.();
    if (service?.server) { service.server.closeAllConnections?.(); await new Promise((resolve) => service.server.close(resolve)); }
    await auth.close();
    await rm(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  });
  const bare = path.join(base, "specs.git");
  await exec("git", ["init", "--bare", "--initial-branch=main", bare]);
  await seedSpecBranch(bare, { project, spec, files: {
    "README.md": "# Published\n\nStatus: ACTIVE\nVersion: 1.0.0\n", "USER_STORIES.md": oldStory, "USE_CASES.md": oldCase, [oldFeatureDoc]: oldFeature, "FR.md": "# Requirements\n",
  } });
  const oldHead = await git(bare, ["rev-parse", branch]);
  const oldTree = await git(bare, ["rev-parse", `${oldHead}:.specs/${spec}`]);
  await git(bare, ["-c", "user.name=spec-bot", "-c", "user.email=bot@example.invalid", "tag", "-a", `spec/${project}/${spec}/1.0.0`, oldHead, "-m", "old publication"]);
  const config = path.join(base, "config.json");
  await writeFile(config, JSON.stringify(auth.config(project, bare)));
  const env = { ...process.env, SPEC_REGISTRY_YT_URL: auth.url, SPEC_REGISTRY_YT_SERVICE_TOKEN: "service-token-0123456789", SPEC_REGISTRY_PROJECTION: "0" };
  const options = { configPath: config, cloneDir: path.join(base, "clone"), storeFile: path.join(base, "registry.db"), port: 0, identity, logger: () => {}, env };
  service = await startService(options);
  assert.equal(service.store.driver, "sqlite");
  service.store.insertLedgerIfAbsent({ specKey: `${project}/${spec}`, version: "1.0.0", digest: oldTree, commitSha: oldHead, repoUrl: bare, repoBranch: branch });
  const ctx = { base, bare, oldHead, oldTree, service, auth, options, url: `http://127.0.0.1:${service.server.address().port}/mcp` };
  ctx.stop = async () => {
    service.sync?.stop();
    service.store.close();
    service.server.closeAllConnections?.();
    await new Promise((resolve) => service.server.close(resolve));
    service = null;
  };
  ctx.restart = async () => {
    service = await startService(options);
    ctx.service = service;
    ctx.url = `http://127.0.0.1:${service.server.address().port}/mcp`;
  };
  return ctx;
}

async function migration(ctx, version = null, topic = null) {
  const inventory = await tool(ctx, ctx.auth.owner, "spec_documents", { action: "list", project, spec, includeSnapshot: true, ...(topic ? { topic } : {}) });
  assert.equal(inventory.ok, true, JSON.stringify(inventory.error));
  const hashes = Object.fromEntries(inventory.data.files.map((file) => [file.path, file.sha256]));
  const map = (sourceDocument, sourceStartLine, sourceEndLine, targetDocument, targetStartLine, targetEndLine) => ({ sourceDocument, sourceSha256: hashes[sourceDocument], sourceStartLine, sourceEndLine, targetDocument, targetStartLine, targetEndLine });
  return {
    intent: "migrateSpec", project, spec, ...(topic ? { topic } : {}), requestId: "active-migration-request", reason: "Migrate published spec", snapshot: inventory.data.snapshot,
    fieldDecisions: Object.entries({ Boundary: "MCP", Trigger: "Request", Precondition: "An edit exists", Success: "The diff appears", "Step:inspect": "Inspect the edit", "Branch:ok": "inspect | An edit exists | The diff appears | end", "ScenarioRef:ok": "SCEN-preview" })
      .map(([field, value]) => ({ entityId: "UC-1", field, value, reason: "Test owner approved the case field", sourceDocument: "USE_CASES.md", sourceSha256: hashes["USE_CASES.md"], sourceStartLine: 2, sourceEndLine: 4 })),
    mapping: [map("USER_STORIES.md", 1, 1, storyDoc, 1, 1), map("USER_STORIES.md", 2, 5, storyDoc, 3, 7), map("USE_CASES.md", 1, 1, caseDoc, 1, 1), map("USE_CASES.md", 2, 4, caseDoc, 2, 4), map(oldFeatureDoc, 1, 1, storyDoc, 1, 2), map(oldFeatureDoc, 2, 6, storyDoc, 8, 12)],
    operations: [
      { kind: "replace_document", document: storyDoc, content: story },
      { kind: "replace_document", document: caseDoc, content: cases },
      ...(version ? [{ kind: "replace_document", document: "README.md", content: `# Published\n\nStatus: ACTIVE\nVersion: ${version}\n` }] : []),
    ],
  };
}

test("published ACTIVE migration requires owner and a free Version, atomically tags and records the new commit, and preserves old snapshot", async (t) => {
  const ctx = await setup(t);
  const missing = await tool(ctx, ctx.auth.owner, "spec_patch", { ...(await migration(ctx)), dryRun: true });
  assert.equal(missing.error?.causeCode, "MIGRATION_VERSION_REQUIRED", JSON.stringify(missing));
  const same = await tool(ctx, ctx.auth.owner, "spec_patch", { ...(await migration(ctx, "1.0.0")), dryRun: true });
  assert.equal(same.error?.causeCode, "MIGRATION_VERSION_REQUIRED", JSON.stringify(same));
  const args = await migration(ctx, "1.0.1");
  const denied = await tool(ctx, ctx.auth.writer, "spec_patch", { ...args, dryRun: true });
  assert.equal(denied.error?.causeCode, "PUBLICATION_OWNER_REQUIRED", JSON.stringify(denied));
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.equal(preview.data.migration.publication.nextVersion, "1.0.1");
  const applied = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  const head = await git(ctx.bare, ["rev-parse", branch]);
  assert.notEqual(head, ctx.oldHead);
  assert.equal(await git(ctx.bare, ["cat-file", "-t", tagRef("1.0.1")]), "tag");
  assert.equal(await git(ctx.bare, ["rev-parse", `${tagRef("1.0.1")}^{}`]), head);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).find((row) => row.version === "1.0.1").commitSha, head);
  const prior = await tool(ctx, ctx.auth.owner, "spec_documents", { action: "read", project, spec, doc: "USER_STORIES.md", version: "1.0.0" });
  assert.equal(prior.ok, true, JSON.stringify(prior.error));
  assert.equal(prior.data.content, oldStory);
  const replay = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(replay.data?.outcome, "APPLIED", JSON.stringify(replay));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), head);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).filter((row) => row.version === "1.0.1").length, 1);
});

test("a competing version tag during atomic push leaves the published branch and original tag unchanged", async (t) => {
  const ctx = await setup(t);
  const args = await migration(ctx, "1.0.1");
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const oldTagObject = await git(ctx.bare, ["rev-parse", tagRef("1.0.0")]);
  const hook = path.join(ctx.bare, "hooks", "pre-receive");
  await writeFile(hook, `#!/bin/sh\nunset GIT_QUARANTINE_PATH GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES\ngit update-ref '${tagRef("1.0.1")}' '${oldTagObject}' || exit 1\n`, { mode: 0o755 });
  await chmod(hook, 0o755);
  const result = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.notEqual(result.data?.outcome, "APPLIED", JSON.stringify(result));
  assert.equal(result.error?.causeCode, "VERSION_EXISTS", JSON.stringify(result));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), ctx.oldHead);
  assert.equal(await git(ctx.bare, ["rev-parse", tagRef("1.0.0")]), oldTagObject);
  assert.equal(await git(ctx.bare, ["rev-parse", tagRef("1.0.1")]), oldTagObject);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).some((row) => row.version === "1.0.1"), false);
  assert.equal(ctx.service.store.getPublicationReservation(`${project}/${spec}`, "1.0.1"), null);
  const mirror = await ctx.service.mounts.ensureRepo(project, { fetch: false });
  const local = await mirror.git.revParse(tagRef("1.0.1"), { cwd: mirror.mirrorDir }).catch(() => null);
  assert.ok(local === null || local === oldTagObject, `owned temporary tag leaked locally: ${local}`);
});

test("migration refuses a dirty managed worktree without erasing the local edits", async (t) => {
  const ctx = await setup(t);
  const args = await migration(ctx, "1.0.1");
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const worktree = await ctx.service.mounts.worktreeFor(project, spec, { strict: true, preserveChanges: true });
  const readme = path.join(worktree.cwd, ".specs", spec, "README.md");
  const localText = "# Local unsaved work\n";
  await writeFile(readme, localText);
  const result = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.notEqual(result.data?.outcome, "APPLIED", JSON.stringify(result));
  assert.equal(await readFile(readme, "utf8"), localText);
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), ctx.oldHead);
});

test("a published ACTIVE migration cannot be downgraded to DRAFT through a work-branch merge", async (t) => {
  const ctx = await setup(t);
  const topic = "downgrade";
  const workBranch = `${branch}--${topic}`;
  await git(ctx.bare, ["update-ref", `refs/heads/${workBranch}`, ctx.oldHead]);
  const args = await migration(ctx, "1.0.1", topic);
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const applied = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), ctx.oldHead);
  await commitToSpecBranch(ctx.bare, { spec, branch: workBranch, files: { "README.md": "# Published\n\nStatus: DRAFT\nVersion: 1.0.1\n" } });
  const beforeTopic = await git(ctx.bare, ["rev-parse", workBranch]);
  const result = await tool(ctx, ctx.auth.owner, "spec_branch", { action: "merge", project, spec, topic, requestId: "downgrade-merge" });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.error?.causeCode, "MIGRATION_STATUS_CHANGED", JSON.stringify(result));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), ctx.oldHead);
  assert.equal(await git(ctx.bare, ["rev-parse", workBranch]), beforeTopic);
});

test("merging a migrated ACTIVE work branch publishes the merge commit atomically", async (t) => {
  const ctx = await setup(t);
  const topic = "published-work";
  const workBranch = `${branch}--${topic}`;
  await git(ctx.bare, ["update-ref", `refs/heads/${workBranch}`, ctx.oldHead]);
  const args = await migration(ctx, "1.0.1", topic);
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const applied = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), ctx.oldHead);
  await assert.rejects(git(ctx.bare, ["rev-parse", "--verify", tagRef("1.0.1")]));
  const merged = await tool(ctx, ctx.auth.owner, "spec_branch", { action: "merge", project, spec, topic, requestId: "published-merge" });
  assert.equal(merged.ok, true, JSON.stringify(merged.error));
  const head = await git(ctx.bare, ["rev-parse", branch]);
  assert.equal(await git(ctx.bare, ["rev-parse", `${tagRef("1.0.1")}^{}`]), head);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).find((row) => row.version === "1.0.1").commitSha, head);
});

test("crash after durable reservation and before Git push resumes the same commit and tag", async (t) => {
  const ctx = await setup(t);
  const args = await migration(ctx, "1.0.1");
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const mirrorDir = (await ctx.service.mounts.ensureRepo(project, { fetch: false })).mirrorDir;
  await ctx.stop();
  const gitUrl = pathToFileURL(path.resolve("src/service/git.js")).href;
  const serviceUrl = pathToFileURL(path.resolve("src/service/index.js")).href;
  const script = `import {GitClient} from ${JSON.stringify(gitUrl)}; const original=GitClient.prototype.runBounded; GitClient.prototype.runBounded=function(args,options){if(args[0]==='push'&&args.includes('--atomic')) process.exit(42); return original.call(this,args,options)}; const {startService}=await import(${JSON.stringify(serviceUrl)}); const service=await startService({configPath:process.argv[1],cloneDir:process.argv[2],storeFile:process.argv[3],port:0,identity:${JSON.stringify(identity)},logger:()=>{},env:process.env}); process.stdout.write('READY:'+service.server.address().port+'\\n');`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "--input-type=module", "-e", script, ctx.options.configPath, ctx.options.cloneDir, ctx.options.storeFile], { env: ctx.options.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  let childError = "";
  child.stderr.on("data", (chunk) => { childError += String(chunk); });
  const exited = once(child, "exit");
  const ready = await Promise.race([once(child.stdout, "data").then(([chunk]) => String(chunk)), exited.then(() => { throw new Error(`child exited before readiness: ${childError}`); })]);
  const port = Number(/READY:(\d+)/u.exec(ready)?.[1]);
  assert.ok(port, ready);
  ctx.url = `http://127.0.0.1:${port}/mcp`;
  await assert.rejects(tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash }));
  const [exitCode] = await exited;
  assert.equal(exitCode, 42, childError);
  const store = await createStore({ file: ctx.options.storeFile });
  const pending = store.getPublicationReservation(`${project}/${spec}`, "1.0.1");
  assert.ok(pending, "reservation must survive process death");
  assert.equal(store.insertLedgerIfAbsent({ specKey: `${project}/${spec}`, version: "1.0.1", digest: "a".repeat(40), commitSha: "b".repeat(40), repoUrl: ctx.bare, repoBranch: branch }), false);
  store.putClaim({ specKey: `${project}/other`, holder: "writer", expiresAtMs: Date.now() + 60_000 });
  store.close();
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), ctx.oldHead);
  const protectedRef = `refs/omp-spec-kit/pending/${pending.requestHash}`;
  assert.equal(await git(mirrorDir, ["rev-parse", protectedRef]), pending.tagObject);
  await git(mirrorDir, ["gc", "--prune=now"]);
  assert.equal(await git(mirrorDir, ["rev-parse", `${pending.tagObject}^{}`]), pending.commitSha);
  await ctx.restart();
  const replay = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(replay.data?.outcome, "APPLIED", JSON.stringify(replay));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), pending.commitSha);
  assert.equal(await git(ctx.bare, ["rev-parse", tagRef("1.0.1")]), pending.tagObject);
  assert.equal(ctx.service.store.getPublicationReservation(`${project}/${spec}`, "1.0.1"), null);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).find((row) => row.version === "1.0.1").commitSha, pending.commitSha);
  await assert.rejects(git(mirrorDir, ["rev-parse", "--verify", protectedRef]));
});

test("crash after protecting the tag but before reservation safely resumes the same request", async (t) => {
  const ctx = await setup(t);
  const args = await migration(ctx, "1.0.1");
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const mirrorDir = (await ctx.service.mounts.ensureRepo(project, { fetch: false })).mirrorDir;
  await ctx.stop();
  const gitUrl = pathToFileURL(path.resolve("src/service/git.js")).href;
  const serviceUrl = pathToFileURL(path.resolve("src/service/index.js")).href;
  const script = `import {GitClient} from ${JSON.stringify(gitUrl)}; const original=GitClient.prototype.run; GitClient.prototype.run=async function(args,options){const value=await original.call(this,args,options); if(args[0]==='update-ref'&&args[1].startsWith('refs/omp-spec-kit/pending/')) process.exit(46); return value}; const {startService}=await import(${JSON.stringify(serviceUrl)}); const service=await startService({configPath:process.argv[1],cloneDir:process.argv[2],storeFile:process.argv[3],port:0,identity:${JSON.stringify(identity)},logger:()=>{},env:process.env}); process.stdout.write('READY:'+service.server.address().port+'\\n');`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "--input-type=module", "-e", script, ctx.options.configPath, ctx.options.cloneDir, ctx.options.storeFile], { env: ctx.options.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  let childError = "";
  child.stderr.on("data", (chunk) => { childError += String(chunk); });
  const exited = once(child, "exit");
  const ready = await Promise.race([once(child.stdout, "data").then(([chunk]) => String(chunk)), exited.then(() => { throw new Error(`child exited before readiness: ${childError}`); })]);
  const port = Number(/READY:(\d+)/u.exec(ready)?.[1]);
  assert.ok(port, ready);
  ctx.url = `http://127.0.0.1:${port}/mcp`;
  await assert.rejects(tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash }));
  assert.equal((await exited)[0], 46, childError);
  const store = await createStore({ file: ctx.options.storeFile });
  assert.equal(store.getPublicationReservation(`${project}/${spec}`, "1.0.1"), null);
  store.close();
  const protectedRef = await git(mirrorDir, ["for-each-ref", "--format=%(refname)", "refs/omp-spec-kit/pending/"]);
  assert.match(protectedRef, /^refs\/omp-spec-kit\/pending\/[0-9a-f]{64}$/u);
  const tagObject = await git(mirrorDir, ["rev-parse", protectedRef]);
  const commit = await git(mirrorDir, ["rev-parse", `${tagObject}^{}`]);
  await git(mirrorDir, ["gc", "--prune=now"]);
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), ctx.oldHead);
  await ctx.restart();
  const replay = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(replay.data?.outcome, "APPLIED", JSON.stringify(replay));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), commit);
  assert.equal(await git(ctx.bare, ["rev-parse", tagRef("1.0.1")]), tagObject);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).find((row) => row.version === "1.0.1").commitSha, commit);
  await assert.rejects(git(mirrorDir, ["rev-parse", "--verify", protectedRef]));
});

test("crash after atomic Git push recovers the ledger without a second commit or tag", async (t) => {
  const ctx = await setup(t);
  const args = await migration(ctx, "1.0.1");
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  await ctx.stop();
  const gitUrl = pathToFileURL(path.resolve("src/service/git.js")).href;
  const serviceUrl = pathToFileURL(path.resolve("src/service/index.js")).href;
  const script = `import {GitClient} from ${JSON.stringify(gitUrl)}; const original=GitClient.prototype.runBounded; GitClient.prototype.runBounded=async function(args,options){const result=await original.call(this,args,options); if(args[0]==='push'&&args.includes('--atomic')) process.exit(43); return result}; const {startService}=await import(${JSON.stringify(serviceUrl)}); const service=await startService({configPath:process.argv[1],cloneDir:process.argv[2],storeFile:process.argv[3],port:0,identity:${JSON.stringify(identity)},logger:()=>{},env:process.env}); process.stdout.write('READY:'+service.server.address().port+'\\n');`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "--input-type=module", "-e", script, ctx.options.configPath, ctx.options.cloneDir, ctx.options.storeFile], { env: ctx.options.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  let childError = "";
  child.stderr.on("data", (chunk) => { childError += String(chunk); });
  const exited = once(child, "exit");
  const ready = await Promise.race([once(child.stdout, "data").then(([chunk]) => String(chunk)), exited.then(() => { throw new Error(`child exited before readiness: ${childError}`); })]);
  const port = Number(/READY:(\d+)/u.exec(ready)?.[1]);
  assert.ok(port, ready);
  ctx.url = `http://127.0.0.1:${port}/mcp`;
  await assert.rejects(tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash }));
  assert.equal((await exited)[0], 43, childError);
  const store = await createStore({ file: ctx.options.storeFile });
  const pending = store.getPublicationReservation(`${project}/${spec}`, "1.0.1");
  assert.ok(pending);
  assert.equal(store.getLedger(`${project}/${spec}`).some((row) => row.version === "1.0.1"), false);
  store.close();
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), pending.commitSha);
  assert.equal(await git(ctx.bare, ["rev-parse", tagRef("1.0.1")]), pending.tagObject);
  await ctx.restart();
  const replay = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(replay.data?.outcome, "APPLIED", JSON.stringify(replay));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), pending.commitSha);
  assert.equal(await git(ctx.bare, ["rev-parse", tagRef("1.0.1")]), pending.tagObject);
  assert.equal(ctx.service.store.getPublicationReservation(`${project}/${spec}`, "1.0.1"), null);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).find((row) => row.version === "1.0.1").commitSha, pending.commitSha);
});

for (const beforeReservation of [false, true]) {
test(beforeReservation ? "crash before ACTIVE merge reservation resumes the protected merge commit" : "crash before ACTIVE merge push resumes the reserved merge commit without losing the work branch", async (t) => {
  const ctx = await setup(t);
  const topic = "recover-merge";
  const workBranch = `${branch}--${topic}`;
  await git(ctx.bare, ["update-ref", `refs/heads/${workBranch}`, ctx.oldHead]);
  const args = await migration(ctx, "1.0.1", topic);
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const applied = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  const topicHead = await git(ctx.bare, ["rev-parse", workBranch]);
  const mirrorDir = (await ctx.service.mounts.ensureRepo(project, { fetch: false })).mirrorDir;
  await ctx.stop();
  const gitUrl = pathToFileURL(path.resolve("src/service/git.js")).href;
  const serviceUrl = pathToFileURL(path.resolve("src/service/index.js")).href;
  const injection = beforeReservation
    ? "const original=GitClient.prototype.run; GitClient.prototype.run=async function(args,options){const result=await original.call(this,args,options); if(args[0]==='update-ref'&&args[1].startsWith('refs/omp-spec-kit/pending/')) process.exit(47); return result}"
    : "const original=GitClient.prototype.runBounded; GitClient.prototype.runBounded=function(args,options){if(args[0]==='push'&&args.includes('--atomic')) process.exit(44); return original.call(this,args,options)}";
  const script = `import {GitClient} from ${JSON.stringify(gitUrl)}; ${injection}; const {startService}=await import(${JSON.stringify(serviceUrl)}); const service=await startService({configPath:process.argv[1],cloneDir:process.argv[2],storeFile:process.argv[3],port:0,identity:${JSON.stringify(identity)},logger:()=>{},env:process.env}); process.stdout.write('READY:'+service.server.address().port+'\\n');`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "--input-type=module", "-e", script, ctx.options.configPath, ctx.options.cloneDir, ctx.options.storeFile], { env: ctx.options.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  let childError = "";
  child.stderr.on("data", (chunk) => { childError += String(chunk); });
  const exited = once(child, "exit");
  const ready = await Promise.race([once(child.stdout, "data").then(([chunk]) => String(chunk)), exited.then(() => { throw new Error(`child exited before readiness: ${childError}`); })]);
  const port = Number(/READY:(\d+)/u.exec(ready)?.[1]);
  assert.ok(port, ready);
  ctx.url = `http://127.0.0.1:${port}/mcp`;
  const mergeArgs = { action: "merge", project, spec, topic, requestId: "recover-merge-request" };
  await assert.rejects(tool(ctx, ctx.auth.owner, "spec_branch", mergeArgs));
  assert.equal((await exited)[0], beforeReservation ? 47 : 44, childError);
  const store = await createStore({ file: ctx.options.storeFile });
  let pending = store.getPublicationReservation(`${project}/${spec}`, "1.0.1");
  const protectedRef = await git(mirrorDir, ["for-each-ref", "--format=%(refname)", "refs/omp-spec-kit/pending/"]);
  assert.match(protectedRef, /^refs\/omp-spec-kit\/pending\/[0-9a-f]{64}$/u);
  if (beforeReservation) {
    assert.equal(pending, null);
    const tagObject = await git(mirrorDir, ["rev-parse", protectedRef]);
    pending = { requestHash: protectedRef.split("/").at(-1), tagObject, commitSha: await git(mirrorDir, ["rev-parse", `${tagObject}^{}`]) };
  } else {
    assert.ok(pending);
    assert.equal(protectedRef, `refs/omp-spec-kit/pending/${pending.requestHash}`);
  }
  store.close();
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), ctx.oldHead);
  assert.equal(await git(ctx.bare, ["rev-parse", workBranch]), topicHead);
  assert.equal(await git(mirrorDir, ["rev-parse", protectedRef]), pending.tagObject);
  await git(mirrorDir, ["gc", "--prune=now"]);
  assert.equal(await git(mirrorDir, ["rev-parse", `${pending.tagObject}^{}`]), pending.commitSha);
  await ctx.restart();
  const recovered = await tool(ctx, ctx.auth.owner, "spec_branch", mergeArgs);
  assert.equal(recovered.ok, true, JSON.stringify(recovered.error));
  assert.equal(recovered.data.commit, pending.commitSha);
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), pending.commitSha);
  assert.equal(await git(ctx.bare, ["rev-parse", tagRef("1.0.1")]), pending.tagObject);
  assert.equal(ctx.service.store.getPublicationReservation(`${project}/${spec}`, "1.0.1"), null);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).find((row) => row.version === "1.0.1").commitSha, pending.commitSha);
  await assert.rejects(git(mirrorDir, ["rev-parse", "--verify", protectedRef]));
});
}

test("crash after ACTIVE merge push recovers its ledger and safely removes the merged work branch", async (t) => {
  const ctx = await setup(t);
  const topic = "recover-landed-merge";
  const workBranch = `${branch}--${topic}`;
  await git(ctx.bare, ["update-ref", `refs/heads/${workBranch}`, ctx.oldHead]);
  const args = await migration(ctx, "1.0.1", topic);
  const preview = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const applied = await tool(ctx, ctx.auth.owner, "spec_patch", { ...args, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  await ctx.stop();
  const gitUrl = pathToFileURL(path.resolve("src/service/git.js")).href;
  const serviceUrl = pathToFileURL(path.resolve("src/service/index.js")).href;
  const script = `import {GitClient} from ${JSON.stringify(gitUrl)}; const original=GitClient.prototype.runBounded; GitClient.prototype.runBounded=async function(args,options){const result=await original.call(this,args,options); if(args[0]==='push'&&args.includes('--atomic')) process.exit(45); return result}; const {startService}=await import(${JSON.stringify(serviceUrl)}); const service=await startService({configPath:process.argv[1],cloneDir:process.argv[2],storeFile:process.argv[3],port:0,identity:${JSON.stringify(identity)},logger:()=>{},env:process.env}); process.stdout.write('READY:'+service.server.address().port+'\\n');`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "--input-type=module", "-e", script, ctx.options.configPath, ctx.options.cloneDir, ctx.options.storeFile], { env: ctx.options.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  let childError = "";
  child.stderr.on("data", (chunk) => { childError += String(chunk); });
  const exited = once(child, "exit");
  const ready = await Promise.race([once(child.stdout, "data").then(([chunk]) => String(chunk)), exited.then(() => { throw new Error(`child exited before readiness: ${childError}`); })]);
  const port = Number(/READY:(\d+)/u.exec(ready)?.[1]);
  assert.ok(port, ready);
  ctx.url = `http://127.0.0.1:${port}/mcp`;
  const mergeArgs = { action: "merge", project, spec, topic, requestId: "recover-landed-merge-request" };
  await assert.rejects(tool(ctx, ctx.auth.owner, "spec_branch", mergeArgs));
  assert.equal((await exited)[0], 45, childError);
  const store = await createStore({ file: ctx.options.storeFile });
  const pending = store.getPublicationReservation(`${project}/${spec}`, "1.0.1");
  assert.ok(pending);
  store.close();
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), pending.commitSha);
  await ctx.restart();
  const recovered = await tool(ctx, ctx.auth.owner, "spec_branch", mergeArgs);
  assert.equal(recovered.ok, true, JSON.stringify(recovered.error));
  assert.equal(await git(ctx.bare, ["rev-parse", branch]), pending.commitSha);
  assert.equal(await git(ctx.bare, ["rev-parse", tagRef("1.0.1")]), pending.tagObject);
  assert.equal(ctx.service.store.getPublicationReservation(`${project}/${spec}`, "1.0.1"), null);
  assert.equal(ctx.service.store.getLedger(`${project}/${spec}`).find((row) => row.version === "1.0.1").commitSha, pending.commitSha);
  await assert.rejects(git(ctx.bare, ["rev-parse", "--verify", `refs/heads/${workBranch}`]));
});
