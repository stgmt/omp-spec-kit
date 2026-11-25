import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { validateMigration } from "../src/authoring/migration.js";
import { sha256, specificationDirectoryDigest } from "../src/authoring/transactions.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";

const spec = "migration-source";
const storyDoc = `${spec}-user-stories.feature`;
const caseDoc = `${spec}-use-cases.feature`;
const oldFeature = `Feature: Preview
  @id:SCEN-preview @neighbor:US-9
  Scenario: Show
    Given one edit
    When the author requests preview
    Then the diff appears
`;
const story = `Feature: Stories
  Context: Feature Preview
  @story:US-1
  Rule: Review
    Actor: Author
    Goal: Inspect
    Benefit: Safety
    @id:SCEN-preview @neighbor:US-9
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
async function workspace(t) {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "omp-cross-migration-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const dir = path.join(root, ".specs", spec);
  await mkdir(dir, { recursive: true });
  for (const [doc, text] of Object.entries({
    "README.md": "# Source\nStatus: DRAFT\n",
    "USER_STORIES.md": "# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n",
    "USE_CASES.md": "# Cases\n## UC-1: Review\nStory: US-1\nActor: Author\n",
    [`${spec}.feature`]: oldFeature,
  })) await writeFile(path.join(dir, doc), text);
  const neighbor = path.join(root, ".specs", "neighbor");
  await mkdir(neighbor, { recursive: true });
  await writeFile(path.join(neighbor, "README.md"), "# Neighbor\nStatus: DRAFT\n");
  await writeFile(path.join(neighbor, "USER_STORIES.md"), "# Stories\n## US-9: Remote\n");
  await writeFile(path.join(neighbor, "neighbor.feature"), "Feature: Neighbor\n");
  const graph = async () => buildKernelGraph(await readRepositorySpecs({ root })).graph;
  const service = new SpecPatchService(root, graph, graph);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
  const map = (sourceDocument, sourceStartLine, sourceEndLine, targetDocument, targetStartLine, targetEndLine) => ({
    sourceDocument, sourceSha256: hashes[sourceDocument], sourceStartLine, sourceEndLine,
    targetDocument, targetStartLine, targetEndLine,
  });
  return { root, dir, neighbor, service, input: {
    intent: "migrateSpec", spec, requestId: "cross-migration", reason: "Migrate selected spec",
    snapshot: snapshot.digest,
    fieldDecisions: Object.entries({ Boundary: "MCP", Trigger: "Request", Precondition: "An edit exists", Success: "The diff appears",
      "Step:inspect": "Inspect the edit", "Branch:ok": "inspect | An edit exists | The diff appears | end", "ScenarioRef:ok": "SCEN-preview" })
      .map(([field, value]) => ({ entityId: "UC-1", field, value, reason: "Test owner approved the case field",
        sourceDocument: "USE_CASES.md", sourceSha256: hashes["USE_CASES.md"], sourceStartLine: 2, sourceEndLine: 4 })),
    mapping: [
      map("USER_STORIES.md", 1, 1, storyDoc, 1, 1),
      map("USER_STORIES.md", 2, 5, storyDoc, 3, 7),
      map("USE_CASES.md", 1, 1, caseDoc, 1, 1),
      map("USE_CASES.md", 2, 4, caseDoc, 2, 4),
      map(`${spec}.feature`, 1, 1, storyDoc, 1, 2),
      map(`${spec}.feature`, 2, 6, storyDoc, 8, 12),
    ],
    operations: [
      { kind: "replace_document", document: storyDoc, content: story },
      { kind: "replace_document", document: caseDoc, content: useCase },
    ],
  } };
}

test("migration preserves an existing link to a not-yet-migrated neighboring spec", async (t) => {
  const { root, service, input, neighbor } = await workspace(t);
  const before = await readFile(path.join(neighbor, "USER_STORIES.md"), "utf8");
  const preview = await service.execute({ ...input, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.deepEqual(preview.data.findings.map(({ code, target, sourceCanonicalId, sourceDocument }) => ({ code, target, sourceCanonicalId, sourceDocument })), [{
    code: "PENDING_LEGACY_REFERENCE", target: "neighbor:US-9", sourceCanonicalId: `${spec}:SCEN-preview`, sourceDocument: `${spec}.feature`,
  }]);
  assert.equal(await readFile(path.join(neighbor, "USER_STORIES.md"), "utf8"), before);
  const applied = await service.execute({ ...input, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));

  const independentEdit = await service.execute({
    spec, requestId: "independent-edit", reason: "Update requirements", dryRun: true,
    operations: [{ kind: "replace_document", document: "FR.md", content: "# Requirements\n" }],
  });
  assert.equal(independentEdit.data?.outcome, "PREVIEW", JSON.stringify(independentEdit));

  const invented = await service.execute({
    spec, requestId: "invented-reference", reason: "Add another reference", dryRun: true,
    operations: [{ kind: "replace_document", document: storyDoc, content: story.replace("@neighbor:US-9", "@neighbor:US-9 @neighbor:US-10") }],
  });
  assert.equal(invented.error?.code, "VALIDATION_FAILED", JSON.stringify(invented));
  assert.match(JSON.stringify(invented.error?.findings), /neighbor:US-10/u);

  await rm(path.join(neighbor, "USER_STORIES.md"));
  await rm(path.join(neighbor, "neighbor.feature"));
  await writeFile(path.join(neighbor, "neighbor-user-stories.feature"), "Feature: Neighbor stories\n");
  await writeFile(path.join(neighbor, "neighbor-use-cases.feature"), "Feature: Neighbor cases\n");
  const migratedGraph = buildKernelGraph(await readRepositorySpecs({ root }));
  assert.ok(migratedGraph.diagnostics.some((entry) => entry.code === "BROKEN_REFERENCE" && entry.message.includes("neighbor:US-9")));
});

test("scenario identity tags are not treated as references to a legacy spec named id", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const other = path.join(root, ".specs", "id");
  await mkdir(other, { recursive: true });
  await writeFile(path.join(other, "README.md"), "# id\nStatus: DRAFT\n");
  await writeFile(path.join(other, "USER_STORIES.md"), "# Stories\n## US-1: Existing\n");
  await writeFile(path.join(other, "id.feature"), "Feature: Other\n");
  const sources = await Promise.all(["USER_STORIES.md", "USE_CASES.md", `${spec}.feature`].map(async (document) => {
    const text = await readFile(path.join(dir, document), "utf8");
    return { document, text, sha256: sha256(Buffer.from(text)) };
  }));
  const result = validateMigration({ spec, sources,
    targets: input.operations.map(({ document, content }) => ({ document, text: content })),
    mapping: input.mapping, fieldDecisions: input.fieldDecisions });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.preservedReferences.map(({ target }) => target), ["neighbor:US-9"]);
  const preview = await service.execute({ ...input, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.deepEqual(preview.data.findings.map(({ target }) => target), ["neighbor:US-9"]);
});

test("a legacy story reference is kept on that story as a pending graph reference", async (t) => {
  const { root, dir, neighbor, service, input } = await workspace(t);
  const sourceStory = "# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n**Refs:** neighbor:US-9\n";
  const sourceFeature = oldFeature.replace(" @neighbor:US-9", "");
  const targetStory = story.replace("    Benefit: Safety\n", "    Benefit: Safety\n    Refs: neighbor:US-9\n").replace(" @neighbor:US-9", "");
  await writeFile(path.join(dir, "USER_STORIES.md"), sourceStory);
  await writeFile(path.join(dir, `${spec}.feature`), sourceFeature);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
  const revised = {
    ...input, snapshot: snapshot.digest,
    mapping: input.mapping.map((item) => ({
      ...item, sourceSha256: hashes[item.sourceDocument],
      ...(item.sourceDocument === "USER_STORIES.md" && item.sourceStartLine === 2 ? { sourceEndLine: 6, targetEndLine: 8 } : {}),
      ...(item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { targetStartLine: 9, targetEndLine: 13 } : {}),
    })),
    operations: [{ ...input.operations[0], content: targetStory }, input.operations[1]],
  };
  const preview = await service.execute({ ...revised, dryRun: true });
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.ok(preview.data.findings.some(({ code, target, sourceCanonicalId, sourceDocument }) =>
    code === "PENDING_LEGACY_REFERENCE" && target === "neighbor:US-9" &&
    sourceCanonicalId === `${spec}:US-1` && sourceDocument === "USER_STORIES.md"));
  const applied = await service.execute({ ...revised, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  const next = await service.execute({ spec, requestId: "after-story-ref", reason: "Independent edit", dryRun: true,
    operations: [{ kind: "replace_document", document: "FR.md", content: "# Requirements\n" }] });
  assert.equal(next.data?.outcome, "PREVIEW", JSON.stringify(next));
  await rm(path.join(neighbor, "USER_STORIES.md"));
  await rm(path.join(neighbor, "neighbor.feature"));
  await writeFile(path.join(neighbor, "neighbor-user-stories.feature"), "Feature: Neighbor stories\n");
  await writeFile(path.join(neighbor, "neighbor-use-cases.feature"), "Feature: Neighbor cases\n");
  const migrated = buildKernelGraph(await readRepositorySpecs({ root }));
  assert.ok(migrated.diagnostics.some((entry) => entry.code === "BROKEN_REFERENCE" && entry.message.includes("neighbor:US-9")));
});

test("a reference on one source case cannot authorize a reference on another target story", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  await writeFile(path.join(dir, "USE_CASES.md"), "# Cases\n## UC-1: Review\nStory: US-1\nActor: Author\n**Refs:** neighbor:US-9\n");
  await writeFile(path.join(dir, `${spec}.feature`), oldFeature.replace(" @neighbor:US-9", ""));
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
  const movedReference = story.replace("    Benefit: Safety\n", "    Benefit: Safety\n    Refs: neighbor:US-9\n").replace(" @neighbor:US-9", "");
  const result = await service.execute({ ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: input.mapping.map((item) => ({ ...item, sourceSha256: hashes[item.sourceDocument],
      ...(item.sourceDocument === "USE_CASES.md" && item.sourceStartLine === 2 ? { sourceEndLine: 5 } : {}),
      ...(item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { targetStartLine: 9, targetEndLine: 13 } : {}),
    })),
    fieldDecisions: input.fieldDecisions.map((item) => ({ ...item, sourceSha256: hashes["USE_CASES.md"] })),
    operations: [{ ...input.operations[0], content: movedReference }, input.operations[1]],
  });
  assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
  assert.match(result.error.message, /UC-1 must preserve neighbor:US-9/u);
});

test("quoted, nested list, table and HTML references do not authorize a Rule reference", async (t) => {
  for (const example of [
    "> Example only:\nRefs: neighbor:US-9",
    "> Example only:\n[Remote](../neighbor/USER_STORIES.md#us-9-remote)",
    "- Example only:\nRefs: neighbor:US-9",
    "- Example only:\n\n  Refs: neighbor:US-9",
    "- Example only:\n\n  [Remote](../neighbor/USER_STORIES.md#us-9-remote)",
    "| Example |\n| --- |\nRefs: neighbor:US-9",
    "| Example |\n| --- |\n[Remote](../neighbor/USER_STORIES.md#us-9-remote)",
    "Example <!--\nRefs: neighbor:US-9\n-->",
    "Example <!--\n[Remote](../neighbor/USER_STORIES.md#us-9-remote)\n-->",
  ]) {
    const { root, dir, service, input } = await workspace(t);
    const sourceStory = `# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n\n${example}\n`;
    const sourceFeature = oldFeature.replace(" @neighbor:US-9", "");
    await writeFile(path.join(dir, "USER_STORIES.md"), sourceStory);
    await writeFile(path.join(dir, `${spec}.feature`), sourceFeature);
    const snapshot = await specificationDirectoryDigest(root, spec);
    const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
    const targetStory = story.replace("    Benefit: Safety\n",
      `    Benefit: Safety\n    Refs: neighbor:US-9\n    Context:\n${example.split("\n").map((line) => `      ${line}`).join("\n")}\n`)
      .replace(" @neighbor:US-9", "");
    const sourceEndLine = sourceStory.split("\n").length - 1;
    const scenarioLine = targetStory.split("\n").findIndex((line) => line.includes("@id:SCEN-preview")) + 1;
    const request = { ...input, snapshot: snapshot.digest,
      mapping: input.mapping.map((item) => ({ ...item, sourceSha256: hashes[item.sourceDocument],
        ...(item.sourceDocument === "USER_STORIES.md" && item.sourceStartLine === 2 ? { sourceEndLine, targetEndLine: scenarioLine - 1 } : {}),
        ...(item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { targetStartLine: scenarioLine, targetEndLine: scenarioLine + 4 } : {}),
      })),
      operations: [{ ...input.operations[0], content: targetStory }, input.operations[1]],
    };
    for (const dryRun of [true, false]) {
      const result = await service.execute({ ...request, dryRun, ...(dryRun ? {} : { expectedProposalHash: "0".repeat(64) }) });
      assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
      assert.match(result.error?.message ?? "", /unsupported direct reference neighbor:US-9/u, JSON.stringify(example));
      assert.equal(await readFile(path.join(dir, "USER_STORIES.md"), "utf8"), sourceStory);
      await assert.rejects(readFile(path.join(dir, storyDoc)), { code: "ENOENT" });
    }
  }
});

test("a Markdown link to a real legacy heading becomes a pending Rule reference", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const oldLink = "**Related:** [Remote](../neighbor/USER_STORIES.md#us-9-remote)";
  await writeFile(path.join(dir, "USER_STORIES.md"), `# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n${oldLink}\n`);
  await writeFile(path.join(dir, `${spec}.feature`), oldFeature.replace(" @neighbor:US-9", ""));
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
  const target = story.replace("    Benefit: Safety\n", `    Benefit: Safety\n    Refs: neighbor:US-9\n    Context: ${oldLink}\n`).replace(" @neighbor:US-9", "");
  const result = await service.execute({ ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: input.mapping.map((item) => ({ ...item, sourceSha256: hashes[item.sourceDocument],
      ...(item.sourceDocument === "USER_STORIES.md" && item.sourceStartLine === 2 ? { sourceEndLine: 6, targetEndLine: 9 } : {}),
      ...(item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { targetStartLine: 10, targetEndLine: 14 } : {}),
    })),
    operations: [{ ...input.operations[0], content: target }, input.operations[1]],
  });
  assert.equal(result.data?.outcome, "PREVIEW", JSON.stringify(result));
  assert.ok(result.data.findings.some(({ code, target: id, sourceCanonicalId, sourceDocument }) =>
    code === "PENDING_LEGACY_REFERENCE" && id === "neighbor:US-9" && sourceCanonicalId === `${spec}:US-1` && sourceDocument === "USER_STORIES.md"));
});

test("Context text does not create Rule edges and a newly invented resolved Rule link is rejected during migration", async (t) => {
  const withContext = story.replace("    Benefit: Safety\n", "    Benefit: Safety\n    Context: Notes\n    Refs: ghost:US-99\n").replace(" @neighbor:US-9", "");
  const graph = buildKernelGraph({ files: [
    { path: `.specs/${spec}/${storyDoc}`, bytes: Buffer.from(withContext) },
    { path: `.specs/${spec}/${caseDoc}`, bytes: Buffer.from(useCase) },
  ] }).graph;
  assert.equal(graph.referenceOccurrences.some((ref) => ref.rawTarget === "ghost:US-99"), false);
  const { root, dir, service, input } = await workspace(t);
  await writeFile(path.join(dir, `${spec}.feature`), oldFeature.replace(" @neighbor:US-9", ""));
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
  const invented = story.replace("    Benefit: Safety\n", "    Benefit: Safety\n    Refs: US-1\n").replace(" @neighbor:US-9", "");
  const result = await service.execute({ ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: input.mapping.map((item) => ({ ...item, sourceSha256: hashes[item.sourceDocument],
      ...(item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { targetStartLine: 9, targetEndLine: 13 } : {}),
    })), operations: [{ ...input.operations[0], content: invented }, input.operations[1]] });
  assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
  assert.match(result.error.message, /unsupported direct reference US-1/u);
});

test("an unresolvable legacy Markdown heading link is not silently converted or discarded", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const oldLink = "**Related:** [Remote](../neighbor/USER_STORIES.md#us-9-missing)";
  await writeFile(path.join(dir, "USER_STORIES.md"), `# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n${oldLink}\n`);
  await writeFile(path.join(dir, `${spec}.feature`), oldFeature.replace(" @neighbor:US-9", ""));
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
  const target = story.replace("    Benefit: Safety\n", `    Benefit: Safety\n    Context: ${oldLink}\n`).replace(" @neighbor:US-9", "");
  const result = await service.execute({ ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: input.mapping.map((item) => ({ ...item, sourceSha256: hashes[item.sourceDocument],
      ...(item.sourceDocument === "USER_STORIES.md" && item.sourceStartLine === 2 ? { sourceEndLine: 6, targetEndLine: 8 } : {}),
      ...(item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { targetStartLine: 9, targetEndLine: 13 } : {}),
    })), operations: [{ ...input.operations[0], content: target }, input.operations[1]] });
  assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
  assert.match(result.error.message, /legacy Markdown link target heading does not exist/u);
});

test("a legacy Markdown link cannot resolve to a story heading inside a list", async (t) => {
  const { root, dir, neighbor, service, input } = await workspace(t);
  const oldLink = "**Related:** [Remote](../neighbor/USER_STORIES.md#us-9-remote)";
  await writeFile(path.join(neighbor, "USER_STORIES.md"), "# Stories\n- Example:\n  ## US-9: Remote\n");
  await writeFile(path.join(dir, "USER_STORIES.md"), `# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n${oldLink}\n`);
  await writeFile(path.join(dir, `${spec}.feature`), oldFeature.replace(" @neighbor:US-9", ""));
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
  const target = story.replace("    Benefit: Safety\n", `    Benefit: Safety\n    Refs: neighbor:US-9\n    Context: ${oldLink}\n`).replace(" @neighbor:US-9", "");
  const result = await service.execute({ ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: input.mapping.map((item) => ({ ...item, sourceSha256: hashes[item.sourceDocument],
      ...(item.sourceDocument === "USER_STORIES.md" && item.sourceStartLine === 2 ? { sourceEndLine: 6, targetEndLine: 9 } : {}),
      ...(item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2 ? { targetStartLine: 10, targetEndLine: 14 } : {}),
    })), operations: [{ ...input.operations[0], content: target }, input.operations[1]] });
  assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID", JSON.stringify(result));
  assert.match(result.error.message, /not a top-level story or case/u);
});

test("owner-approved exact repairs make invalid legacy steps migratable and remain bound to preview", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const invalid = oldFeature.replace("When the author requests preview", "Or the author requests preview");
  await writeFile(path.join(dir, `${spec}.feature`), invalid);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const file = snapshot.files.find(({ path: name }) => name === `${spec}.feature`);
  const before = "    Or the author requests preview\n";
  const replacement = "    When the author requests preview\n";
  const repair = { sourceDocument: `${spec}.feature`, sourceSha256: file.sha256, scenarioId: "SCEN-preview",
    sourceStartLine: 5, sourceEndLine: 5, beforeSha256: sha256(Buffer.from(before)), afterSha256: sha256(Buffer.from(replacement)),
    replacement, reason: "Owner confirms the action keyword" };
  const revised = { ...input, snapshot: snapshot.digest, mapping: input.mapping.map((entry) =>
    entry.sourceDocument === `${spec}.feature` ? { ...entry, sourceSha256: file.sha256 } : entry), repairs: [repair] };
  const noRepair = await service.execute({ ...revised, repairs: [], dryRun: true });
  assert.equal(noRepair.error?.code, "VALIDATION_FAILED", JSON.stringify(noRepair));
  const writer = { hostedCoverage: true, coverageOwner: false };
  const owner = { hostedCoverage: true, coverageOwner: true };
  const denied = await service.execute({ ...revised, dryRun: true }, writer);
  assert.equal(denied.error?.code, "PATH_FORBIDDEN", JSON.stringify(denied));
  for (const bad of [
    { ...repair, beforeSha256: "0".repeat(64) },
    { ...repair, afterSha256: "0".repeat(64) },
    { ...repair, sourceSha256: "0".repeat(64) },
    { ...repair, scenarioId: "SCEN-somewhere-else" },
  ]) {
    const refused = await service.execute({ ...revised, repairs: [bad], dryRun: true }, owner);
    assert.equal(refused.error?.code, "VALIDATION_FAILED", JSON.stringify(refused));
  }
  const preview = await service.execute({ ...revised, dryRun: true }, owner);
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.equal(preview.data.migration.summary.repairs[0].before, before);
  assert.equal(preview.data.migration.summary.repairs[0].after, replacement);
  const deniedApply = await service.execute({ ...revised, dryRun: false, expectedProposalHash: preview.data.proposalHash }, writer);
  assert.equal(deniedApply.error?.code ?? deniedApply.data?.error?.code, "PATH_FORBIDDEN", JSON.stringify(deniedApply));
  const changed = await service.execute({ ...revised, repairs: [{ ...repair, reason: "Changed approval" }],
    dryRun: false, expectedProposalHash: preview.data.proposalHash }, owner);
  assert.equal(changed.data?.error?.code, "CONFLICT", JSON.stringify(changed));
  await writeFile(path.join(dir, "README.md"), "# Changed concurrently\n");
  const stale = await service.execute({ ...revised, dryRun: false, expectedProposalHash: preview.data.proposalHash }, owner);
  assert.equal(stale.error?.code ?? stale.data?.error?.code, "CONFLICT", JSON.stringify(stale));
  assert.equal(await readFile(path.join(dir, `${spec}.feature`), "utf8"), invalid);
});

test("multiple reviewed repairs can add missing steps but cannot change tags or overlap", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const invalid = oldFeature.replace("When the author requests preview\n    Then the diff appears", "Or the author requests preview");
  await writeFile(path.join(dir, `${spec}.feature`), invalid);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const file = snapshot.files.find(({ path: name }) => name === `${spec}.feature`);
  const makeRepair = (line, before, replacement) => ({ sourceDocument: `${spec}.feature`, sourceSha256: file.sha256, scenarioId: "SCEN-preview",
    sourceStartLine: line, sourceEndLine: line, beforeSha256: sha256(Buffer.from(before)), afterSha256: sha256(Buffer.from(replacement)),
    replacement, reason: "Owner confirmed the missing step" });
  const repairs = [makeRepair(4, "    Given one edit\n", "    Given one edit\n    And another condition\n"),
    makeRepair(5, "    Or the author requests preview\n", "    When the author requests preview\n    Then the diff appears\n")];
  const target = story.replace("      Given one edit\n", "      Given one edit\n      And another condition\n");
  const revised = { ...input, snapshot: snapshot.digest, repairs, mapping: input.mapping.map((entry) =>
    entry.sourceDocument === `${spec}.feature` ? { ...entry, sourceSha256: file.sha256,
      ...(entry.sourceStartLine === 2 ? { sourceEndLine: 5, targetEndLine: 13 } : {}) } : entry),
    operations: [{ ...input.operations[0], content: target }, input.operations[1]], dryRun: true };
  const preview = await service.execute(revised);
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.equal(preview.data.migration.summary.repairs.length, 2);
  const overlap = await service.execute({ ...revised, repairs: [repairs[0], repairs[0]] });
  assert.match(overlap.error?.message ?? "", /overlap/u);
  const tag = makeRepair(2, "  @id:SCEN-preview @neighbor:US-9\n", "    Given forged\n");
  const refused = await service.execute({ ...revised, repairs: [tag] });
  assert.match(refused.error?.message ?? "", /only complete scenario step lines/u);
  const applied = await service.execute({ ...revised, dryRun: false, expectedProposalHash: preview.data.proposalHash });
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  assert.equal(await readFile(path.join(dir, storyDoc), "utf8"), target);
  await assert.rejects(readFile(path.join(dir, `${spec}.feature`)), { code: "ENOENT" });
});

test("migration does not excuse an invented unresolved reference", async (t) => {
  const { service, input } = await workspace(t);
  const revised = {
    ...input,
    operations: [{ ...input.operations[0], content: story.replace("@neighbor:US-9", "@neighbor:US-9 @neighbor:US-10") }, input.operations[1]],
    dryRun: true,
  };
  const result = await service.execute(revised);
  assert.equal(result.error?.code, "VALIDATION_FAILED", JSON.stringify(result));
  assert.equal(result.error?.causeCode, "MIGRATION_MAPPING_INVALID");
});

test("an old reference to a nonexistent specification remains an error", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  await writeFile(path.join(dir, `${spec}.feature`), oldFeature.replace("@neighbor:US-9", "@ghost:US-9"));
  const current = await specificationDirectoryDigest(root, spec);
  const sourceHash = current.files.find(({ path: name }) => name === `${spec}.feature`).sha256;
  const revised = {
    ...input,
    snapshot: current.digest,
    mapping: input.mapping.map((item) => item.sourceDocument === `${spec}.feature` ? { ...item, sourceSha256: sourceHash } : item),
    operations: [{ ...input.operations[0], content: story.replace("@neighbor:US-9", "@ghost:US-9") }, input.operations[1]],
    dryRun: true,
  };
  const result = await service.execute(revised);
  assert.equal(result.error?.code, "VALIDATION_FAILED", JSON.stringify(result));
  assert.match(JSON.stringify(result.error?.findings), /ghost:US-9/u);
});

test("adjacent Markdown stories migrate without overlapping their next heading", async (t) => {
  const { root, dir, service, input } = await workspace(t);
  const storySource = "# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n\n## US-2: Explore\nActor: Viewer\nGoal: Learn\nBenefit: Context\n";
  const featureSource = oldFeature + "\n  @id:SCEN-second\n  Scenario: Explore\n    Given a page\n    When the viewer reads\n    Then the page appears\n";
  await writeFile(path.join(dir, "USER_STORIES.md"), storySource);
  await writeFile(path.join(dir, `${spec}.feature`), featureSource);
  const snapshot = await specificationDirectoryDigest(root, spec);
  const hashes = Object.fromEntries(snapshot.files.map(({ path: name, sha256 }) => [name, sha256]));
  const extra = `  @story:US-2
  Rule: Explore
    Actor: Viewer
    Goal: Learn
    Benefit: Context
    @id:SCEN-second
    Scenario: Explore
      Given a page
      When the viewer reads
      Then the page appears
`;
  const map = (sourceDocument, sourceStartLine, sourceEndLine, targetStartLine, targetEndLine) => ({
    sourceDocument, sourceSha256: hashes[sourceDocument], sourceStartLine, sourceEndLine,
    targetDocument: storyDoc, targetStartLine, targetEndLine,
  });
  const revised = {
    ...input, snapshot: snapshot.digest, dryRun: true,
    mapping: [
      ...input.mapping.map((entry) => ({ ...entry, sourceSha256: hashes[entry.sourceDocument] })),
      map("USER_STORIES.md", 7, 10, 13, 17),
      map(`${spec}.feature`, 8, 12, 18, 22),
    ],
    operations: [{ ...input.operations[0], content: story + extra }, input.operations[1]],
  };
  const result = await service.execute(revised);
  assert.equal(result.data?.outcome, "PREVIEW", JSON.stringify(result));
});
