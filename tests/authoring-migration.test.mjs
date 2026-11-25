import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { specificationDirectoryDigest, sha256 } from "../src/authoring/transactions.js";
import { validateMigration } from "../src/authoring/migration.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { createSpecService } from "../src/adapters/query-service.js";
import { spec, storyDoc, caseDoc, oldStory, oldCase, oldFeature, story, useCase, migrationInput } from "./helpers/migration-fixture.mjs";

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(path.join(parent, "omp-migration-test-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const dir = path.join(root, ".specs", spec);
  await mkdir(dir, { recursive: true });
  for (const [doc, text] of Object.entries({
    "README.md": "# Migration test\n\nStatus: DRAFT\n",
    "USER_STORIES.md": oldStory,
    "USE_CASES.md": oldCase,
    [`${spec}.feature`]: oldFeature,
    "FR.md": "# Requirements\n",
  })) await writeFile(path.join(dir, doc), text);
  const graph = async () => buildKernelGraph(await readRepositorySpecs({ root })).graph;
  const service = new SpecPatchService(root, graph, graph);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const input = migrationInput({ snapshot: snapshot.digest, files: snapshot.files });
  return { root, dir, service, input };
}

test("migration rejects changes to case-sensitive source values before applying", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const source = oldStory.replace("Goal: Inspect", "Goal: Inspect APIKey ABC");
  await writeFile(path.join(dir, "USER_STORIES.md"), source);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const request = migrationInput({ snapshot: snapshot.digest, files: snapshot.files });
  request.operations[0].content = story.replace("Goal: Inspect", "Goal: inspect apikey abc");
  for (const dryRun of [true, false]) {
    const result = await service.execute({ ...request, dryRun, ...(dryRun ? {} : { expectedProposalHash: "0".repeat(64) }) });
    assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
    assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), source);
  }
});

test("legacy documents can only be changed through a reviewed atomic migration", async (t) => {
  const { dir, service, input } = await workspace(t);
  for (const dryRun of [true, false]) {
    const blocked = await service.execute({
      spec, requestId: `blocked-${dryRun}`, reason: "Edit requirements", dryRun,
      operations: [{ kind: "replace_document", document: "FR.md", content: "# Changed\n" }],
    });
    assert.equal(blocked.error?.causeCode, "LEGACY_SPEC_LAYOUT", JSON.stringify(blocked));
    assert.equal(await readFile(path.join(dir, "FR.md"), "utf8"), "# Requirements\n");
  }
  const preview = await service.execute({ ...input, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.equal(preview.data.operations.filter((entry) => entry.afterSha256 === null).length, 3);
  assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), oldStory);
  const result = await service.execute({ ...input, expectedProposalHash: preview.data.proposalHash, dryRun: false });
  assert.equal(result.data?.outcome, "APPLIED", JSON.stringify(result));
  assert.equal(await readFile(path.join(dir, storyDoc), "utf8"), story);
  assert.equal(await readFile(path.join(dir, caseDoc), "utf8"), useCase);
  for (const doc of ["USER_STORIES.md", "USE_CASES.md", `${spec}.feature`]) {
    await assert.rejects(readFile(path.join(dir, doc)), { code: "ENOENT" });
  }
});

test("migration preview binds the trusted project, topic and branch tip", async (t) => {
  const { root, dir, input } = await workspace(t);
  const service = createSpecService(root);
  const base = { project: "owner/project", spec, topic: null, head: "a".repeat(40) };
  const invoke = (scope, dryRun, expectedProposalHash) => service.runQuery("specPatch", {
    ...input, dryRun, ...(expectedProposalHash ? { expectedProposalHash } : {}),
  }, { requestId: input.requestId, hostedCoverage: true, coverageOwner: true, migrationScope: scope });
  const original = await invoke(base, true);
  assert.equal(original.ok, true, JSON.stringify(original.error));
  for (const scope of [
    { ...base, project: "owner/other" },
    { ...base, topic: "topic-one" },
    { ...base, head: "b".repeat(40) },
  ]) {
    const preview = await invoke(scope, true);
    assert.equal(preview.ok, true, JSON.stringify(preview.error));
    assert.notEqual(preview.data.proposalHash, original.data.proposalHash);
    const apply = await invoke(scope, false, original.data.proposalHash);
    assert.equal(apply.data?.outcome, "REFUSED", JSON.stringify(apply));
    assert.equal(apply.data.error.code, "CONFLICT");
  }
  assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), oldStory);
});

test("migration refuses missing mappings, changed scenario steps, stale snapshots and wrong preview hashes", async (t) => {
  const { dir, service, input } = await workspace(t);
  const missing = await service.execute({ ...input, mapping: input.mapping.slice(1), dryRun: true });
  assert.equal(missing.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(missing));
  const forged = await service.execute({
    ...input, mapping: input.mapping.map((entry, index) => index === 1 ? { ...entry, targetStartLine: 1 } : entry), dryRun: true,
  });
  assert.match(forged.error?.message ?? "", /corresponding story, case or scenario/u);
  const changed = await service.execute({
    ...input, operations: [{ ...input.operations[0], content: story.replace("Then the diff appears", "Then the diff disappears") }, input.operations[1]], dryRun: true,
  });
  assert.equal(changed.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(changed));
  const invented = `${story}  @story:US-2\n  Rule: Invented\n    Actor: Author\n    Goal: Something\n    Benefit: None\n    @id:SCEN-invented\n    Scenario: Invented\n      Given a fact\n      When it changes\n      Then it changes\n`;
  const noSource = await service.execute({ ...input, operations: [{ ...input.operations[0], content: invented }, input.operations[1]], dryRun: true });
  assert.match(noSource.error?.message ?? "", /target US-2 has no mapped source/u);
  const preview = await service.execute({ ...input, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const wrong = await service.execute({ ...input, dryRun: false, expectedProposalHash: "0".repeat(64) });
  assert.equal(wrong.data?.error?.code, "CONFLICT", JSON.stringify(wrong));
  await writeFile(path.join(dir, "FR.md"), "# Changed concurrently\n");
  const stale = await service.execute({ ...input, dryRun: true });
  assert.equal(stale.error?.code, "CONFLICT", JSON.stringify(stale));
  assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), oldStory);
});

test("a use case without a source link cannot invent its story", async (t) => {
  const { dir, root, service, input } = await workspace(t);
  const unrelated = oldCase.replace("Story: US-1\n", "");
  await writeFile(path.join(dir, "USE_CASES.md"), unrelated);
  const current = await specificationDirectoryDigest(root, spec);
  const revised = {
    ...input,
    snapshot: current.digest,
    mapping: input.mapping.map((item) => item.sourceDocument === "USE_CASES.md" ? {
      ...item, sourceSha256: sha256(Buffer.from(unrelated)), sourceEndLine: Math.min(item.sourceEndLine, 3),
    } : item),
    fieldDecisions: input.fieldDecisions.map((item) => ({ ...item, sourceSha256: sha256(Buffer.from(unrelated)), sourceEndLine: 3 })),
  };
  const result = await service.execute({ ...revised, dryRun: true });
  assert.match(result.error?.message ?? "", /explicit owner review is required/u);
  const decision = { caseId: "UC-1", storyId: "US-1", reason: "Owner selected the story for this case" };
  const owner = { hostedCoverage: true, coverageOwner: true };
  const writer = { hostedCoverage: true, coverageOwner: false };
  const denied = await service.execute({ ...revised, decisions: [decision], dryRun: true }, writer);
  assert.equal(denied.error?.code, "PATH_FORBIDDEN", JSON.stringify(denied));
  for (const wrong of [
    { ...decision, storyId: "US-2" },
    { ...decision, caseId: "UC-2" },
    { ...decision, reason: "" },
  ]) {
    const refused = await service.execute({ ...revised, decisions: [wrong], dryRun: true }, owner);
    assert.equal(refused.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(refused));
  }
  const preview = await service.execute({ ...revised, decisions: [decision], dryRun: true }, owner);
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  const tampered = await service.execute({
    ...revised, decisions: [{ ...decision, reason: "Another reason" }], expectedProposalHash: preview.data.proposalHash, dryRun: false,
  }, owner);
  assert.equal(tampered.data?.error?.code, "CONFLICT", JSON.stringify(tampered));
  const applied = await service.execute({ ...revised, decisions: [decision], expectedProposalHash: preview.data.proposalHash, dryRun: false }, owner);
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
});

test("a negative mention of a story is not an explicit case association", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const source = "# Cases\n## UC-1: Review\nNote: This case is not related to US-1\nActor: Author\n";
  await writeFile(path.join(dir, "USE_CASES.md"), source);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const file = snapshot.files.find(({ path: name }) => name === "USE_CASES.md");
  const target = useCase.replace("    Actor: Author\n", "    Actor: Author\n    Context: Note: This case is not related to US-1\n");
  const revised = { ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: input.mapping.map((item) => item.sourceDocument === "USE_CASES.md"
      ? { ...item, sourceSha256: file.sha256, ...(item.sourceStartLine === 2 ? { targetEndLine: 12 } : {}) } : item),
    fieldDecisions: input.fieldDecisions.map((item) => ({ ...item, sourceSha256: file.sha256 })),
    operations: [input.operations[0], { ...input.operations[1], content: target }] };
  const preview = await service.execute(revised);
  assert.equal(preview.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(preview));
  assert.match(preview.error.message, /explicit owner review is required/u);
  const apply = await service.execute({ ...revised, dryRun: false, expectedProposalHash: "0".repeat(64) });
  assert.equal(apply.error?.causeCode ?? apply.data?.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(apply));
  assert.equal(await readFile(path.join(dir, "USE_CASES.md"), "utf8"), source);
});

test("a conflicting structured story or case field cannot be hidden in Context", async (t) => {
  const { dir, service, input } = await workspace(t);
  const forgedStory = story.replace("    Goal: Inspect\n", "    Goal: Delete all orders\n")
    .replace("    Benefit: Safety\n", "    Benefit: Safety\n    Context: Goal: Inspect\n");
  const forgedRequest = { ...input,
    mapping: input.mapping.map((item) => item.sourceDocument === "USER_STORIES.md" && item.sourceStartLine === 2
      ? { ...item, targetEndLine: 8 } : item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2
        ? { ...item, targetStartLine: 9, targetEndLine: 13 } : item),
    operations: [{ ...input.operations[0], content: forgedStory }, input.operations[1]] };
  const forged = await service.execute({ ...forgedRequest, dryRun: true });
  assert.equal(forged.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(forged));
  assert.match(forged.error.message, /US-1 Goal.*fieldDecision/u);
  const forgedApply = await service.execute({ ...forgedRequest, dryRun: false, expectedProposalHash: "0".repeat(64) });
  assert.equal(forgedApply.error?.causeCode ?? forgedApply.data?.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(forgedApply));
  assert.match(forgedApply.error?.message ?? forgedApply.data?.error?.message ?? "", /US-1 Goal.*fieldDecision/u);
  assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), oldStory);
  await assert.rejects(readFile(path.join(dir, storyDoc)), { code: "ENOENT" });
  const forgedCase = useCase.replace("    Actor: Author\n", "    Actor: Admin\n") + "    Context: Actor: Author\n";
  const caseRequest = { ...input,
    mapping: input.mapping.map((item) => item.sourceDocument === "USE_CASES.md" && item.sourceStartLine === 2
      ? { ...item, targetEndLine: 12 } : item),
    operations: [input.operations[0], { ...input.operations[1], content: forgedCase }] };
  const casePreview = await service.execute({ ...caseRequest, dryRun: true });
  assert.equal(casePreview.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(casePreview));
  assert.match(casePreview.error.message, /UC-1 Actor.*fieldDecision/u);
  const caseApply = await service.execute({ ...caseRequest, dryRun: false, expectedProposalHash: "0".repeat(64) });
  assert.equal(caseApply.error?.causeCode ?? caseApply.data?.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(caseApply));
  assert.match(caseApply.error?.message ?? caseApply.data?.error?.message ?? "", /UC-1 Actor.*fieldDecision/u);
  assert.equal(await readFile(path.join(dir, "USE_CASES.md"), "utf8"), oldCase);
  await assert.rejects(readFile(path.join(dir, caseDoc)), { code: "ENOENT" });
  const storyDecision = { entityId: "US-1", field: "Goal", value: "Delete all orders", reason: "Test owner explicitly approved the changed goal",
    sourceDocument: "USER_STORIES.md", sourceSha256: input.mapping[1].sourceSha256, sourceStartLine: 4, sourceEndLine: 4 };
  const approved = await service.execute({ ...input, dryRun: true, fieldDecisions: [...input.fieldDecisions, storyDecision],
    mapping: input.mapping.map((item) => item.sourceDocument === "USER_STORIES.md" && item.sourceStartLine === 2
      ? { ...item, targetEndLine: 8 } : item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2
        ? { ...item, targetStartLine: 9, targetEndLine: 13 } : item),
    operations: [{ ...input.operations[0], content: forgedStory }, input.operations[1]] });
  assert.equal(approved.data?.outcome, "PREVIEW", JSON.stringify(approved));
});

test("a negated source actor cannot be treated as the unnegated actor", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const source = oldStory.replace("Actor: Author", "Actor: not an admin");
  await writeFile(path.join(dir, "USER_STORIES.md"), source);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hash = snapshot.files.find(({ path: name }) => name === "USER_STORIES.md").sha256;
  const target = story.replace("    Actor: Author\n", "    Actor: admin\n")
    .replace("    Benefit: Safety\n", "    Benefit: Safety\n    Context: Actor: not an admin\n");
  const result = await service.execute({ ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: input.mapping.map((item) => item.sourceDocument === "USER_STORIES.md"
      ? { ...item, sourceSha256: hash, ...(item.sourceStartLine === 2 ? { targetEndLine: 8 } : {}) }
      : item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { ...item, targetStartLine: 9, targetEndLine: 13 } : item),
    operations: [{ ...input.operations[0], content: target }, input.operations[1]] });
  assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
  assert.match(result.error.message, /US-1 Actor.*fieldDecision/u);
});

test("new story fields require exact owner decisions tied to mapped source and preview", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  await rm(path.join(dir, "USER_STORIES.md"));
  await rm(path.join(dir, "USE_CASES.md"));
  const snapshot = await specificationDirectoryDigest(root, spec);
  const sourceHash = snapshot.files.find(({ path: name }) => name === `${spec}.feature`).sha256;
  const created = `Feature: Stories
  @story:US-1
  Rule: Review
    Actor: Emperor
    Goal: Delete production database
    Benefit: Destroy all customer data
    Context: Feature Preview
    @id:SCEN-preview
    Scenario: Show
      Given one edit
      When the author requests preview
      Then the diff appears
`;
  const mapping = [
    { sourceDocument: `${spec}.feature`, sourceSha256: sourceHash, sourceStartLine: 1, sourceEndLine: 1, targetDocument: storyDoc, targetStartLine: 7, targetEndLine: 7 },
    { sourceDocument: `${spec}.feature`, sourceSha256: sourceHash, sourceStartLine: 2, sourceEndLine: 6, targetDocument: storyDoc, targetStartLine: 8, targetEndLine: 12 },
  ];
  const request = { ...input, snapshot: snapshot.digest, mapping, fieldDecisions: [],
    operations: [{ ...input.operations[0], content: created }, { ...input.operations[1], content: "Feature: Cases\n" }] };
  const denied = await service.execute({ ...request, dryRun: true });
  assert.match(denied.error?.message ?? "", /US-1 Actor.*fieldDecision/u);
  const decisions = Object.entries({ Actor: "Emperor", Goal: "Delete production database", Benefit: "Destroy all customer data" }).map(([field, value]) => ({
    entityId: "US-1", field, value, reason: "Test owner approved this new field", sourceDocument: `${spec}.feature`, sourceSha256: sourceHash,
    sourceStartLine: 1, sourceEndLine: 1,
  }));
  const writer = await service.execute({ ...request, fieldDecisions: decisions, dryRun: true }, { hostedCoverage: true, coverageOwner: false });
  assert.equal(writer.error?.code, "PATH_FORBIDDEN", JSON.stringify(writer));
  const bad = await service.execute({ ...request, fieldDecisions: decisions.map((d) => ({ ...d, sourceDocument: "README.md" })), dryRun: true });
  assert.match(bad.error?.message ?? "", /no mapped source/u);
  const owner = { hostedCoverage: true, coverageOwner: true };
  const preview = await service.execute({ ...request, fieldDecisions: decisions, dryRun: true }, owner);
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.deepEqual(preview.data.migration.fieldDecisions, decisions);
  const changed = await service.execute({ ...request, fieldDecisions: decisions.map((d) => ({ ...d, reason: "Changed" })),
    expectedProposalHash: preview.data.proposalHash, dryRun: false }, owner);
  assert.equal(changed.data?.error?.code, "CONFLICT", JSON.stringify(changed));
  assert.equal(await readFile(path.join(dir, `${spec}.feature`), "utf8"), oldFeature);
  const applied = await service.execute({ ...request, fieldDecisions: decisions, expectedProposalHash: preview.data.proposalHash, dryRun: false }, owner);
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
});

test("Independent Test, Outcome and ScenarioRef cannot be introduced or hidden without matching source or owner decision", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const source = oldStory + "Independent Test: Read the preview\n";
  await writeFile(path.join(dir, "USER_STORIES.md"), source);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const sourceHash = snapshot.files.find(({ path: name }) => name === "USER_STORIES.md").sha256;
  const hidden = story.replace("    Benefit: Safety\n", "    Benefit: Safety\n    Context: Independent Test: Read the preview\n");
  const revised = { ...input, snapshot: snapshot.digest, mapping: input.mapping.map((item) => item.sourceDocument === "USER_STORIES.md"
    ? { ...item, sourceSha256: sourceHash, ...(item.sourceStartLine === 2 ? { sourceEndLine: 6, targetEndLine: 8 } : {}) }
    : item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { ...item, targetStartLine: 9, targetEndLine: 13 } : item),
    operations: [{ ...input.operations[0], content: hidden }, input.operations[1]], dryRun: true };
  const refused = await service.execute(revised);
  assert.match(refused.error?.message ?? "", /missing its source field Independent Test/u);
  const newOutcome = story.replace("    Benefit: Safety\n", "    Benefit: Safety\n    Outcome: ready | Result available\n");
  const outcomeRequest = { ...input, dryRun: true, operations: [{ ...input.operations[0], content: newOutcome }, input.operations[1]],
    mapping: input.mapping.map((item) => item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { ...item, targetStartLine: 9, targetEndLine: 13 } : item) };
  await writeFile(path.join(dir, "USER_STORIES.md"), oldStory);
  const outcome = await service.execute(outcomeRequest);
  assert.match(outcome.error?.message ?? "", /Outcome:ready.*fieldDecision/u);
  const withoutRefDecision = await service.execute({ ...input, dryRun: true,
    fieldDecisions: input.fieldDecisions.filter((decision) => decision.field !== "ScenarioRef:ok") });
  assert.match(withoutRefDecision.error?.message ?? "", /ScenarioRef:ok.*fieldDecision/u);
});

test("reordering the same words cannot hide a changed requirement", async (t) => {
  const { dir, root, service, input } = await workspace(t);
  const changedSource = oldStory.replace("Goal: Inspect", "Goal: Admin can edit user cannot");
  const changedTarget = story.replace("Goal: Inspect", "Goal: User can edit admin cannot");
  await writeFile(path.join(dir, "USER_STORIES.md"), changedSource);
  const current = await specificationDirectoryDigest(root, spec);
  const result = await service.execute({
    ...input, snapshot: current.digest,
    mapping: input.mapping.map((item) => item.sourceDocument === "USER_STORIES.md" ? { ...item, sourceSha256: sha256(Buffer.from(changedSource)) } : item),
    operations: [{ ...input.operations[0], content: changedTarget }, input.operations[1]], dryRun: true,
  });
  assert.match(result.error?.message ?? "", /source field|source content is missing or changed/u);
  const changedOperatorSource = oldStory.replace("Goal: Inspect", "Goal: Amount >= 10");
  const changedOperatorTarget = story.replace("Goal: Inspect", "Goal: Amount <= 10");
  await writeFile(path.join(dir, "USER_STORIES.md"), changedOperatorSource);
  const nextSnapshot = await specificationDirectoryDigest(root, spec);
  const flipped = await service.execute({
    ...input, snapshot: nextSnapshot.digest,
    mapping: input.mapping.map((item) => item.sourceDocument === "USER_STORIES.md" ? { ...item, sourceSha256: sha256(Buffer.from(changedOperatorSource)) } : item),
    operations: [{ ...input.operations[0], content: changedOperatorTarget }, input.operations[1]], dryRun: true,
  });
  assert.match(flipped.error?.message ?? "", /source field|source content is missing or changed/u);
});

test("migration preserves currency, decimals, URLs and meaningful quotation marks", async (t) => {
  const cases = [
    ["Price $100", "Price €100"],
    ["Amount 1.2", "Amount 1,2"],
    ["See https://example.test/a", "See https://example.test/b"],
    ['Status "approved"', "Status approved"],
    ["Amount >= 5", "Amount > 5"],
  ];
  for (const [before, after] of cases) {
    await t.test(`${before} -> ${after}`, async (child) => {
      const { root, dir, service, input } = await workspace(child);
      const original = oldStory.replace("Benefit: Safety", `**Benefit:** ${before}`);
      await writeFile(path.join(dir, "USER_STORIES.md"), original);
      const snapshot = await specificationDirectoryDigest(root, spec);
      const file = snapshot.files.find(({ path: name }) => name === "USER_STORIES.md");
      const revised = { ...input, snapshot: snapshot.digest,
        mapping: input.mapping.map((entry) => entry.sourceDocument === "USER_STORIES.md" ? { ...entry, sourceSha256: file.sha256 } : entry),
        operations: [{ ...input.operations[0], content: story.replace("Benefit: Safety", `Benefit: ${after}`) }, input.operations[1]] };
      const preview = await service.execute({ ...revised, dryRun: true });
      assert.equal(preview.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(preview));
      const apply = await service.execute({ ...revised, expectedProposalHash: "0".repeat(64), dryRun: false });
      assert.equal(apply.error?.causeCode ?? apply.data?.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(apply));
      assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), original);
      await assert.rejects(readFile(path.join(dir, storyDoc)), { code: "ENOENT" });
    });
  }
  await t.test("Markdown bold field becomes plain Gherkin field without changing its value", async (child) => {
    const { root, dir, service, input } = await workspace(child);
    await writeFile(path.join(dir, "USER_STORIES.md"), oldStory.replace("Benefit: Safety", "**Benefit:** Price $100"));
    const snapshot = await specificationDirectoryDigest(root, spec);
    const file = snapshot.files.find(({ path: name }) => name === "USER_STORIES.md");
    const preview = await service.execute({ ...input, snapshot: snapshot.digest, dryRun: true,
      mapping: input.mapping.map((entry) => entry.sourceDocument === "USER_STORIES.md" ? { ...entry, sourceSha256: file.sha256 } : entry),
      operations: [{ ...input.operations[0], content: story.replace("Benefit: Safety", "Benefit: Price $100") }, input.operations[1]] });
    assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  });
});

test("two source occurrences cannot reuse one target occurrence while a scenario remains reusable by ScenarioRef", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const original = oldStory + "Note: must retain\nNote: must retain\n";
  await writeFile(path.join(dir, "USER_STORIES.md"), original);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const sourceHash = snapshot.files.find(({ path: name }) => name === "USER_STORIES.md").sha256;
  const one = story.replace("    Benefit: Safety\n", "    Benefit: Safety\n    Context: Note: must retain\n");
  const map = (line, targetLine) => ({ sourceDocument: "USER_STORIES.md", sourceSha256: sourceHash,
    sourceStartLine: line, sourceEndLine: line, targetDocument: storyDoc, targetStartLine: targetLine, targetEndLine: targetLine });
  const baseMapping = input.mapping.map((item) => ({ ...item,
    ...(item.sourceDocument === "USER_STORIES.md" ? { sourceSha256: sourceHash } : {}),
    ...(item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { targetStartLine: 9, targetEndLine: 13 } : {}),
  }));
  const missingRequest = { ...input, snapshot: snapshot.digest,
    mapping: [...baseMapping, map(6, 8), map(7, 8)],
    operations: [{ ...input.operations[0], content: one }, input.operations[1]] };
  const missing = await service.execute({ ...missingRequest, dryRun: true });
  assert.equal(missing.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(missing));
  const missingApply = await service.execute({ ...missingRequest, dryRun: false, expectedProposalHash: "0".repeat(64) });
  assert.equal(missingApply.error?.causeCode ?? missingApply.data?.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(missingApply));
  assert.match(missingApply.error?.message ?? missingApply.data?.error?.message ?? "", /mapped source content is missing or changed/u);
  assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), original);
  await assert.rejects(readFile(path.join(dir, storyDoc)), { code: "ENOENT" });
  const two = one.replace("    Context: Note: must retain\n", "    Context: Note: must retain\n    Note: must retain\n");
  const positive = await service.execute({ ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: [...baseMapping.map((item) => item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2
      ? { ...item, targetStartLine: 10, targetEndLine: 14 } : item), map(6, 8), map(7, 9)],
    operations: [{ ...input.operations[0], content: two }, input.operations[1]] });
  assert.equal(positive.data?.outcome, "PREVIEW", JSON.stringify(positive));
  assert.match(input.operations[1].content, /ScenarioRef: ok \| SCEN-preview/u);
});

test("outline migration preserves unused Example columns and duplicate rows", () => {
  const source = `Feature: Data
  @feature1 @id:SCEN-table
  Scenario Outline: Compare
    Given value <used>
    When I inspect it
    Then the value is shown
    Examples:
      | used | extra |
      | x | a |
      | x | a |
`;
  const target = `Feature: Data
  @story:US-1
  Rule: Compare
    Actor: Author
    Goal: Inspect
    Benefit: Safety
    @feature1 @id:SCEN-table
    Scenario Outline: Compare
      Given value <used>
      When I inspect it
      Then the value is shown
      Examples:
        | used | extra | example_id |
        | x | a | first |
        | x | a | second |
`;
  const sourceDocument = `${spec}.feature`;
  const sourceHash = sha256(Buffer.from(source));
  const mapping = [
    { sourceDocument, sourceSha256: sourceHash, sourceStartLine: 1, sourceEndLine: 1, targetDocument: storyDoc, targetStartLine: 1, targetEndLine: 1 },
    { sourceDocument, sourceSha256: sourceHash, sourceStartLine: 2, sourceEndLine: 10, targetDocument: storyDoc, targetStartLine: 7, targetEndLine: 15 },
  ];
  const fieldDecisions = Object.entries({ Actor: "Author", Goal: "Inspect", Benefit: "Safety" }).map(([field, value]) => ({
    entityId: "US-1", field, value, reason: "Test owner approved the story field", sourceDocument, sourceSha256: sourceHash, sourceStartLine: 2, sourceEndLine: 10,
  }));
  const args = { spec, sources: [{ document: sourceDocument, sha256: sourceHash, text: source }], targets: [{ document: storyDoc, text: target }, { document: caseDoc, text: "Feature: Cases\n" }], mapping, fieldDecisions };
  assert.equal(validateMigration(args).ok, true);
  const lostUnused = target.replace("| x | a | second |", "| x | b | second |");
  assert.match(validateMigration({ ...args, targets: [{ document: storyDoc, text: lostUnused }, args.targets[1]] }).message, /Examples/u);
  const lostDuplicate = target.replace("| x | a | second |\n", "");
  assert.match(validateMigration({ ...args, targets: [{ document: storyDoc, text: lostDuplicate }, args.targets[1]] }).message, /Examples/u);
  const lostTag = target.replace("@feature1 @id", "@id");
  assert.match(validateMigration({ ...args, targets: [{ document: storyDoc, text: lostTag }, args.targets[1]] }).message, /tags/u);
});

test("missing canonical pair blocks edits while the exact new scaffold can be initialized", async (t) => {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(path.join(parent, "omp-layout-gate-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const incomplete = path.join(root, ".specs", "incomplete-probe");
  const scaffold = path.join(root, ".specs", "new-scaffold");
  await mkdir(incomplete, { recursive: true });
  await mkdir(scaffold, { recursive: true });
  await writeFile(path.join(incomplete, "DESIGN.md"), "# Existing design\n");
  const readme = "# new-scaffold\n\nStatus: DRAFT\n";
  await writeFile(path.join(scaffold, "README.md"), readme);
  const graph = async () => buildKernelGraph(await readRepositorySpecs({ root })).graph;
  const service = new SpecPatchService(root, graph, graph);
  const blocked = await service.execute({
    spec: "incomplete-probe", requestId: "missing-pair", reason: "edit", dryRun: false,
    operations: [{ kind: "replace_document", document: "DESIGN.md", content: "# Changed\n" }],
  });
  assert.equal(blocked.error?.causeCode, "INCOMPLETE_GHERKIN_PAIR", JSON.stringify(blocked));
  assert.equal(await readFile(path.join(incomplete, "DESIGN.md"), "utf8"), "# Existing design\n");
  const create = { spec: "new-scaffold", requestId: "initialize-scaffold", reason: "initialize", intent: "createSpec", title: "New", dryRun: false };
  const first = await service.execute(create);
  assert.equal(first.data?.error?.code, "ELICITATION_REQUIRED", JSON.stringify(first));
  const result = await service.execute(create);
  assert.equal(result.data?.outcome, "APPLIED", JSON.stringify(result));
  assert.equal(await readFile(path.join(scaffold, "README.md"), "utf8"), readme);
  assert.match(await readFile(path.join(scaffold, "new-scaffold-user-stories.feature"), "utf8"), /^Feature:/u);
  assert.match(await readFile(path.join(scaffold, "new-scaffold-use-cases.feature"), "utf8"), /^Feature:/u);
});

test("archive refuses an incomplete global graph before deleting a canonical specification", async (t) => {
  const { root, service } = await workspace(t);
  const target = path.join(root, ".specs", "archive-target");
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, "README.md"), "# Target\n\nStatus: DRAFT\n");
  await writeFile(path.join(target, "archive-target-user-stories.feature"), "Feature: Stories\n");
  await writeFile(path.join(target, "archive-target-use-cases.feature"), "Feature: Cases\n");
  const result = await service.execute({ intent: "archiveSpec", spec: "archive-target", requestId: "archive-incomplete", reason: "archive", dryRun: false });
  assert.equal(result.error?.causeCode, "INCOMPLETE_SPEC_GRAPH", JSON.stringify(result));
  assert.equal(await readFile(path.join(target, "README.md"), "utf8"), "# Target\n\nStatus: DRAFT\n");
});

test("migration preview binds its hash to the trusted hosted branch and HEAD", async (t) => {
  const { dir, service, input } = await workspace(t);
  const scope = { project: "owner/project", spec, topic: null, head: "a".repeat(40) };
  const preview = await service.execute({ ...input, dryRun: true }, { hostedCoverage: true, coverageOwner: true, migrationScope: scope });
  assert.deepEqual(preview.data?.migration?.scope, scope);
  const changed = await service.execute({ ...input, dryRun: false, expectedProposalHash: preview.data.proposalHash }, {
    hostedCoverage: true, coverageOwner: true, migrationScope: { ...scope, head: "b".repeat(40) },
  });
  assert.equal(changed.data?.error?.code, "CONFLICT", JSON.stringify(changed));
  assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), oldStory);
  const applied = await service.execute({ ...input, dryRun: false, expectedProposalHash: preview.data.proposalHash }, { hostedCoverage: true, coverageOwner: true, migrationScope: scope });
  assert.deepEqual(applied.data?.receipt?.migration?.scope, scope);
});

async function paragraphStoryRequest(t, { source, context = source, actor, goal, benefit }) {
  const { root, dir, service, input } = await workspace(t);
  const original = `# Stories\n## US-1: Review\n${source}\n`;
  await writeFile(path.join(dir, "USER_STORIES.md"), original);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const sourceSha256 = snapshot.files.find((file) => file.path === "USER_STORIES.md").sha256;
  const candidate = `Feature: Stories\n  Context: Feature Preview\n  @story:US-1\n  Rule: Review\n    Actor: ${actor}\n    Goal: ${goal}\n    Benefit: ${benefit}\n    Context:\n${context.split("\n").map((line) => `      ${line}`).join("\n")}\n    @id:SCEN-preview\n    Scenario: Show\n      Given one edit\n      When the author requests preview\n      Then the diff appears\n`;
  const scenarioLine = candidate.split("\n").findIndex((line) => line.includes("@id:SCEN-preview")) + 1;
  const storyEnd = original.split("\n").length - 1;
  const map = (sourceDocument, hash, start, end, targetDocument, targetStartLine, targetEndLine) => ({
    sourceDocument, sourceSha256: hash, sourceStartLine: start, sourceEndLine: end,
    targetDocument, targetStartLine, targetEndLine,
  });
  const caseHash = snapshot.files.find((file) => file.path === "USE_CASES.md").sha256;
  const featureHash = snapshot.files.find((file) => file.path === `${spec}.feature`).sha256;
  const mapping = [
    map("USER_STORIES.md", sourceSha256, 1, 1, storyDoc, 1, 1),
    map("USER_STORIES.md", sourceSha256, 2, storyEnd, storyDoc, 3, scenarioLine - 1),
    map("USE_CASES.md", caseHash, 1, 1, caseDoc, 1, 1),
    map("USE_CASES.md", caseHash, 2, 4, caseDoc, 2, 4),
    map(`${spec}.feature`, featureHash, 1, 1, storyDoc, 1, 2),
    map(`${spec}.feature`, featureHash, 2, 6, storyDoc, scenarioLine, scenarioLine + 4),
  ];
  return { dir, service, original, input: { ...input, snapshot: snapshot.digest, mapping,
    operations: [{ kind: "replace_document", document: storyDoc, content: candidate }, input.operations[1]] } };
}

test("standalone canonical story paragraphs provide exact field evidence without an owner decision", async (t) => {
  const examples = [
    { source: "As a spec owner, I want direct mutation of `.specs` blocked while the two proposal-first authoring operations remain available, so reviewed atomic changes are the only mutation route.",
      actor: "spec owner", goal: "direct mutation of `.specs` blocked while the two proposal-first authoring operations remain available", benefit: "reviewed atomic changes are the only mutation route." },
    { source: "As a product owner, I want agent reads and writes of canonical specifications to pass only through MCP so that the MCP server remains the single auditable authority.",
      actor: "product owner", goal: "agent reads and writes of canonical specifications to pass only through MCP", benefit: "the MCP server remains the single auditable authority." },
    { source: "As an **auditor**, I want to inspect $100 at https://example.test/a?q=1, so that the ledger stays correct.",
      actor: "auditor", goal: "to inspect $100 at https://example.test/a?q=1", benefit: "the ledger stays correct." },
  ];
  for (const example of examples) {
    const { service, input } = await paragraphStoryRequest(t, example);
    const preview = await service.execute({ ...input, dryRun: true });
    assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
    assert.equal(preview.data.migration.fieldDecisions.some((item) => item.entityId === "US-1"), false);
  }
});

test("quoted, fenced, negated and ambiguous story text does not prove user-story fields", async (t) => {
  const sentence = "As a product owner, I want the service to work so that users succeed.";
  const examples = [
    { source: `> ${sentence}`, context: `> ${sentence}` },
    { source: `\`\`\`text\n${sentence}\n\`\`\``, context: sentence },
    { source: `Note: ${sentence}`, context: `Note: ${sentence}` },
    { source: `As a product owner, I do not want the service to work so that users succeed.`, context: sentence },
    { source: `${sentence}\n\n${sentence}`, context: `${sentence}\n\n${sentence}` },
  ];
  for (const example of examples) {
    const { dir, service, input, original } = await paragraphStoryRequest(t, { ...example,
      actor: "product owner", goal: "the service to work", benefit: "users succeed." });
    const preview = await service.execute({ ...input, dryRun: true });
    assert.equal(preview.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(preview));
    assert.match(preview.error?.message ?? "", /US-1 Actor.*owner fieldDecision/u);
    assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), original);
  }
});

test("lazy quote and list continuations and comments do not establish story or field evidence", async (t) => {
  const sentence = "As a product owner, I want the service to work so that users succeed.";
  for (const source of [
    `> Quoted example:\n${sentence}`,
    `- List example:\n${sentence}`,
    `- List example:\n\n  ${sentence}`,
    `- List example:\n  - Nested example:\n    ${sentence}`,
    "> Quoted example:\nActor: product owner\nGoal: the service to work\nBenefit: users succeed.",
    "- List example:\nActor: product owner\nGoal: the service to work\nBenefit: users succeed.",
    "- List example:\n\n  Actor: product owner\n  Goal: the service to work\n  Benefit: users succeed.",
    "| Example |\n| --- |\nActor: product owner\nGoal: the service to work\nBenefit: users succeed.",
    "Example | Value\n--- | ---\nActor: product owner\nGoal: the service to work\nBenefit: users succeed.",
    "<!-- Quoted example:\nActor: product owner\nGoal: the service to work\nBenefit: users succeed.\n-->",
    "Example <!--\nActor: product owner\nGoal: the service to work\nBenefit: users succeed.\n-->",
  ]) {
    const { dir, service, input, original } = await paragraphStoryRequest(t, {
      source, actor: "product owner", goal: "the service to work", benefit: "users succeed.",
    });
    for (const dryRun of [true, false]) {
      const result = await service.execute({ ...input, dryRun, ...(dryRun ? {} : { expectedProposalHash: "0".repeat(64) }) });
      assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
      assert.match(result.error?.message ?? "", /US-1 Actor.*owner fieldDecision/u);
      assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), original);
      await assert.rejects(readFile(path.join(dir, storyDoc)), { code: "ENOENT" });
    }
  }
});

test("a standalone story after a blank line following a quote or list remains valid evidence", async (t) => {
  for (const prefix of ["> Quoted example.", "- List example."]) {
    const source = `${prefix}\n\nAs a product owner, I want the service to work so that users succeed.`;
    const { service, input, dir, original } = await paragraphStoryRequest(t, {
      source, actor: "product owner", goal: "the service to work", benefit: "users succeed.",
    });
    const preview = await service.execute({ ...input, dryRun: true });
    assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
    assert.equal(preview.data.migration.fieldDecisions.some((item) => item.entityId === "US-1"), false);
    assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), original);
  }
});

test("quoted, list, table and HTML Story fields do not establish the case-to-story association", async (t) => {
  for (const example of [
    "> Example link:\nStory: US-1",
    "- Example link:\nStory: US-1",
    "- Example link:\n\n  Story: US-1",
    "| Example |\n| --- |\nStory: US-1",
    "Example <!--\nStory: US-1\n-->",
  ]) {
    const { root, dir, service, input } = await workspace(t);
    const sourceCase = `# Cases\n## UC-1: Review\n${example}\n\nActor: Author\n`;
    await writeFile(path.join(dir, "USE_CASES.md"), sourceCase);
    const snapshot = await specificationDirectoryDigest(root, spec);
    const hash = snapshot.files.find((file) => file.path === "USE_CASES.md").sha256;
    const targetCase = useCase.replace("    ScenarioRef: ok | SCEN-preview\n",
      `    ScenarioRef: ok | SCEN-preview\n    Context:\n${example.split("\n").map((line) => `      ${line}`).join("\n")}\n`);
    const sourceEndLine = sourceCase.split("\n").length - 1;
    const request = { ...input, snapshot: snapshot.digest,
      mapping: input.mapping.map((entry) => entry.sourceDocument !== "USE_CASES.md" ? entry : {
        ...entry, sourceSha256: hash,
        ...(entry.sourceStartLine === 2 ? { sourceEndLine, targetEndLine: targetCase.split("\n").length - 1 } : {}),
      }),
      fieldDecisions: input.fieldDecisions.map((entry) => ({ ...entry, sourceSha256: hash, sourceEndLine })),
      operations: [input.operations[0], { ...input.operations[1], content: targetCase }],
    };
    for (const dryRun of [true, false]) {
      const result = await service.execute({ ...request, dryRun, ...(dryRun ? {} : { expectedProposalHash: "0".repeat(64) }) });
      assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
      assert.match(result.error?.message ?? "", /UC-1 has no unambiguous source link/u);
      assert.equal(await readFile(path.join(dir, "USE_CASES.md"), "utf8"), sourceCase);
      await assert.rejects(readFile(path.join(dir, caseDoc)), { code: "ENOENT" });
    }
  }
});

test("explicit structured list fields remain valid migration evidence", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const sourceStory = "# Stories\n## US-1: Review\n- Actor: Author\n- Goal: Inspect\n- Benefit: Safety\n";
  await writeFile(path.join(dir, "USER_STORIES.md"), sourceStory);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hash = snapshot.files.find((file) => file.path === "USER_STORIES.md").sha256;
  const request = { ...input, snapshot: snapshot.digest, mapping: input.mapping.map((entry) =>
    entry.sourceDocument === "USER_STORIES.md" ? { ...entry, sourceSha256: hash } : entry) };
  const preview = await service.execute({ ...request, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.equal(preview.data.migration.fieldDecisions.some((item) => item.entityId === "US-1"), false);
  assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), sourceStory);
});

test("a story heading nested inside a list does not establish a source entity or fields", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const sourceStory = "# Stories\n- Example:\n  ## US-1: Review\n  Actor: Author\n  Goal: Inspect\n  Benefit: Safety\n";
  await writeFile(path.join(dir, "USER_STORIES.md"), sourceStory);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hash = snapshot.files.find((file) => file.path === "USER_STORIES.md").sha256;
  const targetStory = story.replace("    Benefit: Safety\n", "    Benefit: Safety\n    Context:\n      - Example:\n");
  const scenarioLine = targetStory.split("\n").findIndex((line) => line.includes("@id:SCEN-preview")) + 1;
  const request = { ...input, snapshot: snapshot.digest,
    mapping: input.mapping.flatMap((entry) => {
      if (entry.sourceDocument === "USER_STORIES.md" && entry.sourceStartLine === 1) return [{ ...entry, sourceSha256: hash }];
      if (entry.sourceDocument === "USER_STORIES.md") return [
        { ...entry, sourceSha256: hash, sourceStartLine: 2, sourceEndLine: 2, targetStartLine: scenarioLine - 1, targetEndLine: scenarioLine - 1 },
        { ...entry, sourceSha256: hash, sourceStartLine: 3, sourceEndLine: 6, targetStartLine: 3, targetEndLine: 7 },
      ];
      return [{ ...entry, ...(entry.sourceDocument === `${spec}.feature` && entry.sourceStartLine === 2
        ? { targetStartLine: scenarioLine, targetEndLine: scenarioLine + 4 } : {}) }];
    }),
    operations: [{ ...input.operations[0], content: targetStory }, input.operations[1]],
  };
  for (const dryRun of [true, false]) {
    const result = await service.execute({ ...request, dryRun, ...(dryRun ? {} : { expectedProposalHash: "0".repeat(64) }) });
    assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
    assert.match(result.error?.message ?? "", /US-1 Actor.*owner fieldDecision/u);
    assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), sourceStory);
    await assert.rejects(readFile(path.join(dir, storyDoc)), { code: "ENOENT" });
  }
});

test("standalone story evidence preserves currency and link destinations", async (t) => {
  for (const example of [
    { source: "As an auditor, I want to inspect $100, so that the ledger stays correct.", goal: "to inspect €100" },
    { source: "As an auditor, I want to read [policy](https://example.test/a), so that the ledger stays correct.", goal: "to read policy" },
  ]) {
    const { service, input } = await paragraphStoryRequest(t, { ...example, actor: "auditor", benefit: "the ledger stays correct." });
    const preview = await service.execute({ ...input, dryRun: true });
    assert.equal(preview.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(preview));
    assert.match(preview.error?.message ?? "", /US-1 Goal.*owner fieldDecision/u);
  }
});

test("Primary actor is evidence for Actor, while conflicting actor fields need an owner decision", async (t) => {
  for (const conflicting of [false, true]) {
    const { root, dir, service, input } = await workspace(t);
    const sourceCase = `# Cases\n## UC-1: Review\nStory: US-1\n${conflicting ? "Actor: Author\n" : ""}**Primary actor:** ${conflicting ? "Different actor" : "Author"}\n`;
    await writeFile(path.join(dir, "USE_CASES.md"), sourceCase);
    const snapshot = await specificationDirectoryDigest(root, spec);
    const hash = snapshot.files.find(({ path: name }) => name === "USE_CASES.md").sha256;
    const request = { ...input, snapshot: snapshot.digest, dryRun: true,
      mapping: input.mapping.map((entry) => entry.sourceDocument === "USE_CASES.md" ? {
        ...entry, sourceSha256: hash,
        ...(entry.sourceStartLine === 2 ? { sourceEndLine: conflicting ? 5 : 4 } : {}),
      } : entry),
      fieldDecisions: input.fieldDecisions.map((entry) => ({ ...entry, sourceSha256: hash,
        ...(conflicting ? { sourceEndLine: 5 } : {}) })),
      operations: [input.operations[0], { ...input.operations[1] }],
    };
    if (!conflicting) {
      // Context is the last structured part of a Rule; keep required fields
      // ahead of it while retaining the exact legacy spelling.
      request.operations[1].content = useCase.replace("    ScenarioRef: ok | SCEN-preview\n", "    ScenarioRef: ok | SCEN-preview\n    Context:\n      **Primary actor:** Author\n");
      request.mapping = request.mapping.map((entry) => entry.sourceDocument === "USE_CASES.md" && entry.sourceStartLine === 2
        ? { ...entry, targetEndLine: request.operations[1].content.split("\n").length - 1 } : entry);
    }
    const preview = await service.execute(request);
    if (conflicting) {
      assert.equal(preview.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(preview));
      assert.match(preview.error?.message ?? "", /UC-1 Actor.*owner fieldDecision/u);
    } else {
      assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
      assert.equal(preview.data.migration.fieldDecisions.some((item) => item.entityId === "UC-1" && item.field === "Actor"), false);
    }
    assert.equal(await readFile(path.join(dir, "USE_CASES.md"), "utf8"), sourceCase);
  }
});
