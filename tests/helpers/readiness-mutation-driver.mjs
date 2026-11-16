import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const root = process.env.READINESS_MUTATION_ROOT;
assert.equal(typeof root, "string", "run through scripts/verify-readiness-mutations.mjs");
const relative = path.relative(path.resolve(tmpdir()), path.resolve(root));
assert.ok(relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), "mutation writes require an isolated temporary worker");
const mutation = JSON.parse(process.env.READINESS_MUTATION_CASE);
const load = (file) => import(pathToFileURL(path.join(root, file)).href);
const { readVerifiedCucumberFixture } = await load("tests/helpers/release-candidate-world.mjs");
// Authenticate the genuine capture against pristine inputs BEFORE deliberately
// mutating the implementation under test, never the evidence/provenance receipt.
const bytes = await readVerifiedCucumberFixture(root);
const frames = bytes.toString("utf8").trimEnd().split(/\r?\n/u).map((line) => JSON.parse(line));
const feature = frames.find((frame) => frame.source).source.data;
const target = path.join(root, "src", "evidence", "service.js");
if (mutation.from) {
  const source = await readFile(target, "utf8");
  assert.equal(source.split(mutation.from).length - 1, 1, "unique mutation anchor");
  await writeFile(target, source.replace(mutation.from, mutation.to));
}
const { executeEvidenceOperation, withReadinessEvidence } = await import(pathToFileURL(target).href + "?case=" + mutation.id);
const { buildKernelGraph } = await load("src/kernel/graph/build.js");
const { specReadiness } = await load("src/kernel/readiness.js");
const spec = "execution-proof";
const files = [
  ["README.md", "# Execution proof\nStatus: DRAFT\n"],
  ["FR.md", "# Requirements\n\n## FR-1 — Execution proof\n\nProve the execution boundary.\n"],
  ["ACCEPTANCE_CRITERIA.md", "# Criteria\n\n## AC-1.1 — FR-1\n\nGiven execution, when it ends, then there is producer evidence.\n"],
  ["DESIGN.md", "# Design\n\n" + "The source-bound producer proves the actual execution. ".repeat(8)],
  ["TASKS.md", "# Tasks\n"],
  ["execution-proof.feature", feature],
].map(([name, text]) => ({ path: `.specs/${spec}/${name}`, bytes: Buffer.from(text) }));
const graph = buildKernelGraph({ files }).graph;
const project = path.join(root, ".omp-spec-kit", "mutation-project");
const evidence = path.join(project, ".omp-spec-kit", "evidence", "last-test-run.ndjson");
await mkdir(path.dirname(evidence), { recursive: true });
const encode = (items) => Buffer.from(items.map((frame) => JSON.stringify(frame)).join("\n") + "\n");
async function level(capture) {
  await writeFile(evidence, capture);
  return specReadiness(await withReadinessEvidence(project, graph), spec).level;
}

test("unchanged real producer capture proves L3", async () => {
  assert.equal(await level(bytes), "L3");
});
test("unsuccessful producer run cannot prove L3", async () => {
  const changed = structuredClone(frames);
  changed.find((frame) => frame.testRunFinished).testRunFinished.success = false;
  assert.equal(await level(encode(changed)), "L2");
});
test("different executed source cannot prove L3", async () => {
  const changed = structuredClone(frames);
  changed.find((frame) => frame.source).source.data += "\n# different source\n";
  assert.equal(await level(encode(changed)), "L2");
});
test("malformed producer capture cannot prove L3", async () => {
  assert.equal(await level(Buffer.concat([bytes, Buffer.from("not-json\n")])), "L2");
});
test("escaped evidence directory cannot prove project execution", async () => {
  const directory = path.dirname(evidence);
  const saved = directory + "-saved";
  const outside = path.join(root, ".omp-spec-kit", "outside-evidence");
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(outside, "last-test-run.ndjson"), bytes);
  await rename(directory, saved);
  try {
    await symlink(outside, directory, "junction");
    const scenario = graph.nodes.find((node) => node.kind === "SCENARIO");
    const result = await executeEvidenceOperation(project, graph, "getTestResult", { scenarioId: scenario.canonicalId, spec });
    assert.equal(result.ok, true);
    assert.equal(result.data.result, "NOT_RUN");
    assert.equal(result.data.source, null);
    assert.equal(specReadiness(await withReadinessEvidence(project, graph), spec).level, "L2");
    assert.deepEqual(await readFile(path.join(outside, "last-test-run.ndjson")), bytes);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    await rename(saved, directory);
  }
});
