import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, realpath, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { SpecPatchService } from "../src/authoring/service.js";
import { specificationDirectoryDigest } from "../src/authoring/transactions.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";

const spec = "replay-migration";
const storyDoc = `${spec}-user-stories.feature`;
const caseDoc = `${spec}-use-cases.feature`;
const oldStory = "# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n";
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

function newService(root, options) {
  const graph = async () => buildKernelGraph(await readRepositorySpecs({ root })).graph;
  return new SpecPatchService(root, graph, graph, options);
}

async function setup(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(path.join(parent, "omp-migration-replay-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const dir = path.join(root, ".specs", spec);
  await mkdir(dir, { recursive: true });
  for (const [name, text] of Object.entries({
    "README.md": "# Replay migration\n\nStatus: DRAFT\n",
    "FR.md": "# Requirements\n",
    "USER_STORIES.md": oldStory,
    [`${spec}.feature`]: oldFeature,
  })) await writeFile(path.join(dir, name), text);
  const source = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(source.files.map((file) => [file.path, file.sha256]));
  const map = (sourceDocument, sourceStartLine, sourceEndLine, targetStartLine, targetEndLine) => ({
    sourceDocument, sourceSha256: hashes[sourceDocument], sourceStartLine, sourceEndLine,
    targetDocument: storyDoc, targetStartLine, targetEndLine,
  });
  const base = {
    intent: "migrateSpec", spec, requestId: "durable-migration-1", reason: "Preserve the existing specification",
    snapshot: source.digest,
    mapping: [
      map("USER_STORIES.md", 1, 1, 1, 1),
      map("USER_STORIES.md", 2, 5, 3, 7),
      map(`${spec}.feature`, 1, 1, 1, 2),
      map(`${spec}.feature`, 2, 6, 8, 12),
    ],
    operations: [
      { kind: "replace_document", document: storyDoc, content: story },
      { kind: "replace_document", document: caseDoc, content: "Feature: Cases\n" },
    ],
  };
  const preview = await newService(root).execute({ ...base, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  return { root, dir, input: { ...base, dryRun: false, expectedProposalHash: preview.data.proposalHash } };
}

async function crashDuringApply(root, input, point) {
  const imports = {
    service: pathToFileURL(path.resolve("src/authoring/service.js")).href,
    fs: pathToFileURL(path.resolve("src/kernel/adapters/fs.js")).href,
    graph: pathToFileURL(path.resolve("src/kernel/graph/build.js")).href,
  };
  const program = `
    const { SpecPatchService } = await import(${JSON.stringify(imports.service)});
    const { readRepositorySpecs } = await import(${JSON.stringify(imports.fs)});
    const { buildKernelGraph } = await import(${JSON.stringify(imports.graph)});
    const root = process.env.REPLAY_TEST_ROOT;
    const input = JSON.parse(process.env.REPLAY_TEST_INPUT);
    const graph = async () => buildKernelGraph(await readRepositorySpecs({root})).graph;
    const service = new SpecPatchService(root, graph, graph, {faultInjector(point) {
      if (point === process.env.REPLAY_TEST_FAULT) process.exit(87);
    }});
    await service.execute(input);
    process.exit(2);
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", program], {
      env: { ...process.env, REPLAY_TEST_ROOT: root, REPLAY_TEST_INPUT: JSON.stringify(input), REPLAY_TEST_FAULT: point },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (bytes) => { stderr += bytes; });
    child.on("error", reject);
    child.on("exit", (code) => code === 87 ? resolve() : reject(new Error(`child exited ${code}: ${stderr}`)));
  });
}

test("a new service replays a durable migration and rejects a reused requestId", async (t) => {
  const { root, dir, input } = await setup(t);
  const first = await newService(root).execute(input);
  assert.equal(first.data?.outcome, "APPLIED", JSON.stringify(first));
  const replay = await newService(root).execute(input);
  assert.deepEqual(replay, first);
  const conflict = await newService(root).execute({ ...input, reason: "A different proposal" });
  assert.equal(conflict.data?.error?.code, "CONFLICT", JSON.stringify(conflict));
  const reused = await newService(root).execute({
    spec, requestId: input.requestId, dryRun: false, reason: "Different operation",
    operations: [{ kind: "replace_document", document: "FR.md", content: "# Wrong\n" }],
  });
  assert.equal(reused.data?.error?.code, "CONFLICT", JSON.stringify(reused));
  assert.equal(await readFile(path.join(dir, "FR.md"), "utf8"), "# Requirements\n");
  const independent = await newService(root).execute({
    spec, requestId: "independent-request", dryRun: false, reason: "Update requirements",
    operations: [{ kind: "replace_document", document: "FR.md", content: "# Requirements\n\nNotes\n" }],
  });
  assert.equal(independent.data?.outcome, "APPLIED", JSON.stringify(independent));
  assert.deepEqual(await newService(root).execute(input), first);
  assert.equal(await readFile(path.join(dir, storyDoc), "utf8"), story);
  const entries = await readdir(path.join(root, ".specs", ".omp-spec-kit-staging"));
  assert.deepEqual(entries, [".receipts"]);
});

test("a committed crash recovers the receipt under a stale lock without a second write", async (t) => {
  const { root, dir, input } = await setup(t);
  await crashDuringApply(root, input, "after-commit-before-receipt");
  await assert.rejects(access(path.join(dir, "USER_STORIES.md")), { code: "ENOENT" });
  const serviceA = newService(root);
  const serviceB = newService(root);
  const results = await Promise.all([serviceA.execute(input), serviceB.execute(input)]);
  const success = results.find((result) => result.data?.outcome === "APPLIED");
  assert.ok(success, JSON.stringify(results));
  const replay = await newService(root).execute(input);
  assert.deepEqual(replay, success);
  assert.equal(await readFile(path.join(dir, storyDoc), "utf8"), story);
  assert.deepEqual(await readdir(path.join(root, ".specs", ".omp-spec-kit-staging")), [".receipts"]);
});

test("a crash before commit restores the original before retrying, while later edits are never overwritten", async (t) => {
  const { root, dir, input } = await setup(t);
  await crashDuringApply(root, input, "after-install");
  const result = await newService(root).execute(input);
  assert.equal(result.data?.outcome, "APPLIED", JSON.stringify(result));
  await writeFile(path.join(dir, storyDoc), "Feature: A later external edit\n");
  const replay = await newService(root).execute(input);
  assert.equal(replay.data?.error?.code, "CONFLICT", JSON.stringify(replay));
  assert.equal(await readFile(path.join(dir, storyDoc), "utf8"), "Feature: A later external edit\n");
});

test("hosted local staging does not retain a durable success receipt", async (t) => {
  const { root, input } = await setup(t);
  const result = await newService(root).execute(input, { hostedCoverage: true, coverageOwner: true });
  assert.equal(result.data?.outcome, "APPLIED", JSON.stringify(result));
  await assert.rejects(access(path.join(root, ".specs", ".omp-spec-kit-staging", ".receipts")), { code: "ENOENT" });
});

test("crash recovery refuses to overwrite a file edited while the service was down", async (t) => {
  const { root, dir, input } = await setup(t);
  await crashDuringApply(root, input, "after-install");
  const external = "Feature: External edit after the crash\n";
  await writeFile(path.join(dir, storyDoc), external);
  const result = await newService(root).execute(input);
  assert.equal(result.data?.error?.code, "RECOVERY_REQUIRED", JSON.stringify(result));
  assert.equal(await readFile(path.join(dir, storyDoc), "utf8"), external);
  assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), oldStory);
});

test("a corrupt durable receipt is rejected instead of fabricating replay success", async (t) => {
  const { root, dir, input } = await setup(t);
  const result = await newService(root).execute(input);
  assert.equal(result.data?.outcome, "APPLIED", JSON.stringify(result));
  const directory = path.join(root, ".specs", ".omp-spec-kit-staging", ".receipts");
  const [name] = await readdir(directory);
  const receiptPath = path.join(directory, name);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  receipt.changedDocuments[0].afterSha256 = "0".repeat(64);
  await writeFile(receiptPath, JSON.stringify(receipt));
  const replay = await newService(root).execute(input);
  assert.equal(replay.data?.error?.code, "RECOVERY_REQUIRED", JSON.stringify(replay));
  assert.equal(await readFile(path.join(dir, storyDoc), "utf8"), story);
});

test("durable replay is bound to the trusted migration scope", async (t) => {
  const { root, input } = await setup(t);
  const scope = { project: "owner/project", spec, topic: "review", head: "a".repeat(40) };
  const context = { migrationScope: scope };
  const preview = await newService(root).execute({ ...input, dryRun: true }, context);
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const scopedInput = { ...input, expectedProposalHash: preview.data.proposalHash };
  const applied = await newService(root).execute(scopedInput, context);
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  const wrongScope = await newService(root).execute(scopedInput, { migrationScope: { ...scope, head: "b".repeat(40) } });
  assert.equal(wrongScope.data?.error?.code, "CONFLICT", JSON.stringify(wrongScope));
  assert.deepEqual(await newService(root).execute(scopedInput, context), applied);
});
