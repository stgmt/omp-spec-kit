import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { captureGherkinEvidence } from "../scripts/capture-gherkin-evidence.mjs";
import { executeEvidenceOperation } from "../src/evidence/service.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";

const spec = "projection-test";
const projection = "execution/check.feature";
const feature = `Feature: Executable projection with different prose
  @other
  Scenario: Unrelated
    Given something else

  @id:SCEN-refusal
  Scenario Outline: Independently named scenario
    Given a proposed edit with <fault>
    When the author previews it
    Then the proposal is refused
    Examples:
      | example_id | fault |
      | a | a broken anchor |
      | b | a broken anchor |
`;

async function setup(t) {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "omp-projection-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const dir = path.join(root, ".specs", spec);
  await mkdir(dir, { recursive: true });
  await mkdir(path.join(root, "execution"));
  const fill = "A proposed change shows its exact effect before any edit is committed. ".repeat(5);
  const documents = {
    "README.md": "# Projection test\n\nStatus: DRAFT\n",
    "REQUIREMENTS.md": `# Index\n\n${fill}\n`,
    "FR.md": "# Behavior\n\n## FR-1: Preview\n\nA proposal can be previewed.\n",
    "NFR.md": "# Quality\n\n## NFR-PERF-1: Latency\n\nRequest latency is bounded.\n",
    "ACCEPTANCE_CRITERIA.md": "# Criteria\n\n## AC-1.1: Refused\n\n**Covers:** FR-1\n",
    "DESIGN.md": `# Design\n\n${fill}\n`,
    [`${spec}_SCHEMA.md`]: `# Schema\n\n${fill}\n`,
    "TASKS.md": "# Tasks\n",
    [`${spec}-user-stories.feature`]: `Feature: User stories\n  @story:US-1\n  Rule: Review\n    Actor: Author\n    Goal: Inspect a diff\n    Benefit: Avoid unexpected edits\n    @id:SCEN-preview\n    Scenario: Show a diff\n      Given one current snapshot\n      When the author previews an edit\n      Then a diff is returned\n`,
    [`${spec}-use-cases.feature`]: `Feature: Canonical use cases\n  @case:UC-1 @story:US-1\n  Rule: Preview\n    Actor: Author\n    Boundary: MCP\n    Trigger: Preview request\n    Precondition: A current snapshot exists\n    Success: A diff is returned\n    Step: check | Check references\n    Branch: invalid | check | Broken anchor | Refused | end\n    ScenarioRef: invalid | SCEN-refusal#a\n    @id:SCEN-refusal @spec-ready @feature1\n    Scenario Outline: Canonical refusal\n      Given a proposed edit with <fault>\n      When the author previews it\n      Then the proposal is refused\n      Examples:\n        | example_id | fault |\n        | a | a broken anchor |\n        | b | a broken anchor |\n`,
  };
  for (const [name, content] of Object.entries(documents)) await writeFile(path.join(dir, name), content);
  await writeFile(path.join(root, projection), feature);
  const steps = path.join(root, "steps.mjs");
  await writeFile(steps, `import { Given, When, Then } from ${JSON.stringify(import.meta.resolve("@cucumber/cucumber"))};\nGiven("a proposed edit with a broken anchor", function () {});\nWhen("the author previews it", function () {});\nThen("the proposal is refused", function () {});\n`);
  const graph = async () => buildKernelGraph(await readRepositorySpecs({ root })).graph;
  const capture = (projectionPaths = [projection]) => captureGherkinEvidence({ root, spec, imports: [steps], projectionPaths, stderr: new PassThrough() });
  const evidence = path.join(root, ".omp-spec-kit/evidence/last-test-run.ndjson");
  await mkdir(path.dirname(evidence), { recursive: true });
  const observe = async (messages, g) => {
    await writeFile(evidence, messages);
    return (await executeEvidenceOperation(root, g ?? await graph(), "getTestResult", { spec, scenarioId: "SCEN-refusal" })).data;
  };
  return { root, dir, graph, capture, observe };
}

test("projection evidence binds current sources and matches canonical step and row identities", async (t) => {
  const { root, dir, graph, capture, observe } = await setup(t);
  const canonical = await graph();
  assert.equal(canonical.valid, true, JSON.stringify(canonical.diagnostics));
  const run = await capture();
  assert.equal(run.success, true);
  assert.equal((await observe(run.messages)).result, "PASSED");
  const records = run.messages.trim().split("\n").map(JSON.parse);
  const pickle = records.find(({ pickle }) => pickle?.tags.some(({ name }) => name === "@id:SCEN-refusal"));
  const encode = (frames) => frames.map((frame) => JSON.stringify(frame)).join("\n") + "\n";
  const changed = structuredClone(records);
  changed.find(({ pickle: p }) => p?.id === pickle.pickle.id).pickle.steps[0].text = "different step";
  assert.equal((await observe(encode(changed))).result, "UNKNOWN");
  assert.equal((await observe(encode(records.filter((entry) => entry !== pickle)))).result, "UNKNOWN");
  const tampered = structuredClone(records);
  tampered[0].ompSpecKitEvidence.binding.graphFingerprint = "wrong";
  assert.equal((await observe(encode(tampered))).result, "UNKNOWN");
  await writeFile(path.join(root, projection), feature.replace("different prose", "changed prose"));
  assert.equal((await observe(run.messages)).result, "UNKNOWN");
  await rm(path.join(root, projection));
  assert.equal((await observe(run.messages)).result, "UNKNOWN");
  await writeFile(path.join(root, projection), feature.replace("| b | a broken anchor |", "| c | a broken anchor |"));
  assert.equal((await observe((await capture()).messages)).result, "UNKNOWN");
  await writeFile(path.join(root, projection), feature.replace("Then the proposal is refused", "Then the proposal is rejected"));
  assert.equal((await observe((await capture()).messages)).result, "UNKNOWN");
  await writeFile(path.join(root, projection), feature.replace("Feature: Executable", "@id:SCEN-refusal\nFeature: Executable"));
  await assert.rejects(capture(), /declared directly/u);
  await writeFile(path.join(root, projection), feature);
  await writeFile(path.join(dir, "FR.md"), (await readFile(path.join(dir, "FR.md"), "utf8")).replace("can be previewed", "requires approval"));
  assert.equal((await observe(run.messages, await graph())).result, "UNKNOWN");
  await assert.rejects(capture(["../outside.feature"]), /outside the project root/u);
});
