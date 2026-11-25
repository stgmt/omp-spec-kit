import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { createSpecService } from "../src/adapters/query-service.js";
import { coverageRegion } from "../src/authoring/bdd-coverage.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { compareGherkinMigration, inspectGherkinMigration, inspectMigratedPair } from "../scripts/verify-gherkin-migration.mjs";
import { fileURLToPath } from "node:url";
import { readReleaseScenarios } from "../scripts/release-gherkin.mjs";
import { resolveCorpusRoot } from "../scripts/corpus-root.mjs";

const spec = "gherkin-review";
const storiesDoc = `${spec}-user-stories.feature`;
const casesDoc = `${spec}-use-cases.feature`;
const stories = `Feature: User stories
  @story:US-1
  Rule: Review proposed edits
    Actor: Author
    Goal: Inspect a diff
    Benefit: Avoid unexpected edits
    @id:SCEN-preview
    Scenario: Show a diff
      Given one current snapshot
      When the author previews an edit
      Then a diff is returned
`;
const cases = `Feature: Use cases
  @case:UC-1 @story:US-1
  Rule: Preview proposed edits
    Actor: Author
    Boundary: MCP
    Trigger: Preview request
    Precondition: A current snapshot exists
    Success: A diff is returned
    Step: check | Check the proposed references
    Branch: valid | check | The edit is valid | A diff is returned | end
    Branch: invalid | check | The anchor is broken | The proposal is refused | end
    ScenarioRef: valid | SCEN-preview
    ScenarioRef: invalid | SCEN-refusal
    @id:SCEN-refusal
    Scenario: Refuse an invalid edit
      Given a proposed edit with a broken anchor
      When the author previews it
      Then the proposal is refused
`;
const map = {
  schema: "omp-spec-kit/bdd-coverage@1",
  outcomes: {
    valid: { requirements: ["FR-1"], criteria: ["AC-1.1"], rule: "UC-1", outcome: "valid" },
    invalid: { requirements: ["FR-1"], criteria: ["AC-1.2"], rule: "UC-1", outcome: "invalid" },
  },
  scopes: { preview: { requirements: ["FR-1"], outcomes: ["valid", "invalid"] } },
};

async function workspace(testContext, seed = true) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(path.join(parent, "omp-gherkin-authoring-"));
  assert.equal(path.dirname(await realpath(root)), parent);
  testContext.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const dir = path.join(root, ".specs", spec);
  await mkdir(seed ? dir : path.dirname(dir), { recursive: true });
  const fill = "A proposed change shows its exact effect before any edit is committed. ".repeat(5);
  if (seed) for (const [document, content] of Object.entries({
    "README.md": "# Gherkin review\n\nStatus: DRAFT\n",
    "REQUIREMENTS.md": `# Index\n\n${fill}\n`,
    "FR.md": "# Behavior\n\n## FR-1: Preview\n\nA proposal can be previewed.\n\n## FR-2: Apply\n\nAn approved proposal can be applied.\n",
    "NFR.md": "# Quality\n\n## NFR-PERF-1: Latency\n\nRequest latency is bounded.\n",
    "ACCEPTANCE_CRITERIA.md": "# Criteria\n\n## AC-1.1: Valid preview\n\n**Covers:** FR-1\n\n## AC-1.2: Refused preview\n\n**Covers:** FR-1\n",
    "DESIGN.md": `# Design\n\n${fill}\n`,
    [`${spec}_SCHEMA.md`]: `# Schema\n\n${fill}\n`,
    "TASKS.md": "# Tasks\n",
    [storiesDoc]: stories,
    [casesDoc]: cases,
  })) await writeFile(path.join(dir, document), content);
  const graph = async () => buildKernelGraph(await readRepositorySpecs({ root })).graph;
  const service = new SpecPatchService(root, graph, graph);
  let id = 0;
  const owner = { hostedCoverage: true, coverageOwner: true };
  const writer = { hostedCoverage: true };
  const invoke = (args, context = writer) => service.execute({
    spec, reason: "gherkin authoring pilot", requestId: `pilot-${++id}`, ...args,
  }, context);
  return { root, dir, graph, invoke, owner, writer };
}

function createTask(entity = "TASK-1", requirements = ["FR-1"]) {
  return { intent: "confirmTaskCreation", entity, requirements, subject: "Implement preview", coverageScope: "preview", dryRun: false };
}

test("new specification creates the canonical pair, and a use case needs the same-spec story", async (t) => {
  const blank = await workspace(t, false);
  const elicitation = await blank.invoke({ intent: "createSpec", title: "Demo", dryRun: false });
  assert.equal(elicitation.data?.error?.code, "ELICITATION_REQUIRED");
  const created = await blank.invoke({ intent: "createSpec", title: "Demo", dryRun: false });
  assert.equal(created.data?.outcome, "APPLIED", JSON.stringify(created.error));
  assert.match(await readFile(path.join(blank.dir, storiesDoc), "utf8"), /^Feature: Demo/u);
  assert.match(await readFile(path.join(blank.dir, casesDoc), "utf8"), /^Feature: Demo/u);
  await assert.rejects(readFile(path.join(blank.dir, `${spec}.feature`)), { code: "ENOENT" });
  const absent = await blank.invoke({
    intent: "patch", dryRun: true, operations: [{ kind: "replace_document", document: casesDoc, content: cases }],
  });
  assert.equal(absent.error?.code, "VALIDATION_FAILED");
  assert.ok(absent.error.findings.some(({ message }) => message.includes("existing story")));
});

test("deleting a Gherkin rule preserves the next rule's exact bytes", async (t) => {
  const { dir, invoke } = await workspace(t);
  const separator = "\r\n  # Second history\r\n";
  const storyRule = stories.slice(stories.indexOf("  @story:US-1")).replaceAll("\n", "\r\n");
  const spare = storyRule.replaceAll("US-1", "US-2").replaceAll("SCEN-preview", "SCEN-spare");
  const original = "Feature: User stories\r\n" + spare + separator + storyRule;
  await writeFile(path.join(dir, storiesDoc), original);
  const live = await invoke({ intent: "deleteEntity", entity: "US-1", forceDelete: true, dryRun: false });
  assert.equal(live.error?.code, "VALIDATION_FAILED");
  assert.equal(await readFile(path.join(dir, storiesDoc), "utf8"), original);
  const unused = await invoke({ intent: "deleteEntity", entity: "US-2", dryRun: false });
  assert.equal(unused.data?.outcome, "APPLIED", JSON.stringify(unused.error));
  assert.equal(await readFile(path.join(dir, storiesDoc), "utf8"), "Feature: User stories\r\n" + separator + storyRule);
  const caseRule = cases.slice(cases.indexOf("  @case:UC-1")).replaceAll("\n", "\r\n");
  const spareCase = caseRule.replaceAll("UC-1", "UC-2").replaceAll("SCEN-refusal", "SCEN-spare-refusal");
  await writeFile(path.join(dir, casesDoc), "Feature: Use cases\r\n" + spareCase + separator + caseRule);
  const removedCase = await invoke({ intent: "deleteEntity", entity: "UC-2", forceDelete: true, dryRun: false });
  assert.equal(removedCase.data?.outcome, "APPLIED", JSON.stringify(removedCase.error));
  assert.equal(await readFile(path.join(dir, casesDoc), "utf8"), "Feature: Use cases\r\n" + separator + caseRule);
});

test("approved coverage counts the effective Then, rejects changed task scope, and protects the map", async (t) => {
  const { dir, graph, invoke, owner } = await workspace(t);
  const denied = await invoke({ intent: "approveBddCoverage", map, dryRun: false });
  assert.equal(denied.error?.code, "BDD_COVERAGE_PROTECTED");
  const before = await invoke(createTask());
  assert.equal(before.error?.code, "BDD_COVERAGE_INCOMPLETE", JSON.stringify(before));
  const preview = await invoke({ intent: "approveBddCoverage", map, dryRun: true }, owner);
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview.error));
  const approval = await invoke({
    intent: "approveBddCoverage", map, dryRun: false, repositoryRootFingerprint: preview.data.baseGenerationSha256,
  }, owner);
  assert.equal(approval.data?.outcome, "APPLIED", JSON.stringify(approval.error ?? approval.data));
  const criteriaPath = path.join(dir, "ACCEPTANCE_CRITERIA.md");
  const originalCriteria = await readFile(criteriaPath, "utf8");
  assert.equal(coverageRegion(originalCriteria).map.outcomes.invalid.approvedExamples[0].ref, "SCEN-refusal");
  const blockedPatch = await invoke({ intent: "patch", dryRun: false, operations: [{
    kind: "replace_document", document: "ACCEPTANCE_CRITERIA.md", content: originalCriteria.replace("SCEN-refusal", "SCEN-preview"),
  }] });
  assert.equal(blockedPatch.error?.code, "BDD_COVERAGE_PROTECTED");
  const task = await invoke(createTask());
  assert.equal(task.data?.outcome, "APPLIED", JSON.stringify(task.error ?? task.data));
  assert.equal((await graph()).nodes.find(({ localId }) => localId === "TASK-1").attributes.coverageScope, "preview");
  const change = await invoke({ intent: "patch", dryRun: false, operations: [{
    kind: "replace_task_links", document: "TASKS.md", entity: "TASK-1", requirements: ["FR-1", "FR-2"],
  }] });
  assert.equal(change.error?.code, "BDD_COVERAGE_INCOMPLETE", JSON.stringify(change));
  const taskPath = path.join(dir, "TASKS.md");
  const taskBytes = await readFile(taskPath, "utf8");
  const replacement = await invoke({ intent: "patch", dryRun: false, operations: [{
    kind: "replace_document", document: "TASKS.md", content: taskBytes.replace("Requirements:** FR-1", "Requirements:** FR-1, FR-2"),
  }] });
  assert.equal(replacement.error?.code, "BDD_COVERAGE_INCOMPLETE");
  assert.equal(await readFile(taskPath, "utf8"), taskBytes);
  const comment = await invoke({ intent: "addTaskComment", entity: "TASK-1", text: "Owner is reviewing this.", dryRun: false });
  assert.equal(comment.data?.outcome, "APPLIED", JSON.stringify(comment.error));
  const draft = await invoke({ intent: "patch", dryRun: false, operations: [{
    kind: "replace_document", document: casesDoc, content: cases.replace("Then the proposal is refused", "Then the proposal is accepted"),
  }] });
  assert.equal(draft.data?.outcome, "APPLIED", JSON.stringify(draft.error));
  const stale = await invoke(createTask("TASK-2"));
  assert.equal(stale.error?.code, "BDD_COVERAGE_INCOMPLETE");
  assert.equal(stale.error.findings[0].outcome, "invalid");
  const replayedApproval = await invoke({
    intent: "approveBddCoverage", map, dryRun: false, repositoryRootFingerprint: preview.data.baseGenerationSha256,
  }, owner);
  assert.equal(replayedApproval.data?.error?.code ?? replayedApproval.error?.code, "CONFLICT");
});

test("promotion requires owner-approved coverage, without running scenarios", async (t) => {
  const { invoke, owner } = await workspace(t);
  const ready = cases.replace("@id:SCEN-refusal", "@id:SCEN-refusal @feature1 @spec-ready");
  const preview = await invoke({ intent: "patch", dryRun: true, operations: [{
    kind: "replace_document", document: casesDoc, content: ready,
  }] });
  assert.equal(preview.error?.code, "BDD_COVERAGE_INCOMPLETE");
  const approvalPreview = await invoke({ intent: "approveBddCoverage", map, dryRun: true }, owner);
  const approved = await invoke({
    intent: "approveBddCoverage", map, dryRun: false, repositoryRootFingerprint: approvalPreview.data.baseGenerationSha256,
  }, owner);
  assert.equal(approved.data?.outcome, "APPLIED", JSON.stringify(approved.error));
  const promoted = await invoke({ intent: "patch", dryRun: false, operations: [{
    kind: "replace_document", document: casesDoc, content: ready,
  }] });
  assert.equal(promoted.data?.outcome, "APPLIED", JSON.stringify(promoted.error));
  const stale = await invoke({ intent: "patch", dryRun: true, operations: [{
    kind: "replace_document", document: casesDoc, content: ready.replace("Then the proposal is refused", "Then the proposal is accepted"),
  }] });
  assert.equal(stale.error?.code, "BDD_COVERAGE_INCOMPLETE");
});

test("Gherkin migration requires reviewed repairs for valid legacy syntax with missing BDD steps", async () => {
  const file = new URL("./fixtures/gherkin-migration/plugin-distribution.feature", import.meta.url);
  const original = await readFile(file, "utf8");
  const legacy = inspectGherkinMigration(original);
  const incomplete = [...legacy.values()].filter(({ missing }) => missing.length);
  assert.equal(incomplete.length, 2);
  assert.deepEqual(incomplete.map(({ missing }) => missing), [["When"], ["Given"]]);
  const updated = inspectGherkinMigration(original
    .replace("    Given the public mutation inventory is inspected\n", "    Given an available mutation inventory\n    When the public mutation inventory is inspected\n")
    .replace("    When a manager reads product status\n", "    Given a product roadmap is available\n    When a manager reads product status\n"));
  const review = compareGherkinMigration(legacy, updated);
  assert.equal(review.length, 2);
  const repairs = Object.fromEntries(review.map(({ id, beforeSha256, afterSha256 }) => [id, {
    beforeSha256, afterSha256, reason: "Supply the explicit context or observation without changing the assertion",
  }]));
  assert.deepEqual(compareGherkinMigration(legacy, updated, repairs), []);
  repairs[review[0].id].afterSha256 = "stale";
  assert.equal(compareGherkinMigration(legacy, updated, repairs)[0].id, review[0].id);
});


test("migration detects removed scenario references", () => {
  const original = `Feature: References
  @id:SCEN-linked
  Scenario: A linked scenario
    Refs: FR-1, FR-2
    Given a request
    When the request is processed
    Then the result is recorded
`;
  const before = inspectGherkinMigration(original);
  const same = inspectGherkinMigration(original.replace("FR-1, FR-2", "FR-2 FR-1"));
  assert.deepEqual(compareGherkinMigration(before, same), []);
  const removed = inspectGherkinMigration(original.replace("Refs: FR-1, FR-2\n", ""));
  assert.equal(compareGherkinMigration(before, removed)[0].id, "SCEN-linked");
});
test("migration rejects a byte-preserving rename with top-level scenarios", () => {
  const result = inspectMigratedPair({
    storyPath: storiesDoc,
    storyText: "Feature: Unmigrated\n  @id:SCEN-before\n  Scenario: Before\n    Given preparation\n    When action\n    Then outcome\n",
    casePath: casesDoc,
    caseText: "Feature: Use cases\n",
  });
  assert.match(JSON.stringify(result), /scenarios belong to a story, use case or contract Rule/u);
});

test("release fixture preserves the migrated scenario pair", async () => {
  const source = new URL("./fixtures/gherkin-migration/plugin-distribution.feature", import.meta.url);
  const repairs = JSON.parse(await readFile(new URL("./fixtures/gherkin-migration/plugin-distribution-repairs.json", import.meta.url), "utf8"));
  const corpusRoot = fileURLToPath(new URL("./fixtures/kernel/authoring-real-corpus", import.meta.url));
  const storyPath = path.join(corpusRoot, ".specs", "plugin-distribution", "plugin-distribution-user-stories.feature");
  const casePath = path.join(corpusRoot, ".specs", "plugin-distribution", "plugin-distribution-use-cases.feature");
  const storyText = await readFile(storyPath, "utf8");
  const caseText = await readFile(casePath, "utf8");
  const migrated = inspectMigratedPair({ storyPath, storyText, casePath, caseText });
  assert.deepEqual(migrated.findings, []);
  assert.equal(migrated.definitions.size, 33);
  assert.deepEqual(compareGherkinMigration(inspectGherkinMigration(await readFile(source, "utf8")), migrated.definitions, repairs), []);
  assert.throws(() => resolveCorpusRoot({ root: null }), /explicitly name an absolute corpus root/u);
});

test("release checks use their own feature file and reject incomplete release tags", async (t) => {
  const selected = await readReleaseScenarios();
  assert.equal(selected.requirements.size, 6);
  assert.equal(selected.requirements.get("SCEN-mri-active-project-root"), "plugin-distribution:FR-19");
  assert.equal(selected.requirements.get("SCEN-mri-terminal-json-rpc"), "plugin-distribution:FR-20");
  const { root } = await workspace(t);
  const featurePath = path.join(root, "release-check.feature");
  await writeFile(featurePath, "Feature: Release\n  @release-evidence @id:SCEN-release\n  Scenario: Check\n    Given preparation\n    When action\n    Then outcome\n");
  await assert.rejects(readReleaseScenarios({ featurePath }), /invalid release-evidence scenario tags/u);
});
