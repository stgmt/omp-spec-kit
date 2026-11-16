import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readVerifiedCucumberFixture } from "./release-candidate-world.mjs";
import { snapshotTree } from "../support/world.mjs";

const SPEC = "readiness-execution-proof";
const REMOVE_OPTIONS = { recursive: true, force: true, maxRetries: 20, retryDelay: 250 };

// Positive evidence is an unchanged, provenance-verified real Cucumber capture.
// Only negative cases below edit it, deliberately, in the disposable project.
export async function runReadinessE2E({ callTool, projectRoot, repositoryRoot }) {
  const bytes = await readVerifiedCucumberFixture(repositoryRoot);
  const frames = bytes.toString("utf8").trimEnd().split(/\r?\n/u).map((line) => JSON.parse(line));
  const sources = frames.filter((frame) => typeof frame.source?.data === "string");
  assert.equal(sources.length, 1, "the proof corpus must identify its single executed feature");
  const feature = sources[0].source.data;
  const scenarioId = frames.find((frame) => frame.pickle).pickle.tags.find((tag) => tag.name.startsWith("@id:")).name.slice(4);
  const specDir = path.join(projectRoot, ".specs", SPEC);
  const evidencePath = path.join(projectRoot, ".omp-spec-kit", "evidence", "last-test-run.ndjson");
  let priorEvidence;
  try { priorEvidence = await readFile(evidencePath); } catch (error) { if (error.code !== "ENOENT") throw error; }
  await mkdir(specDir);
  let request = 0;
  const rpc = async (tool, args, { write = false } = {}) => {
    const before = await snapshotTree(projectRoot);
    const requestId = `readiness-e2e-${++request}`;
    const response = await callTool(tool, { ...args, requestId });
    assert.equal(response.error, undefined, JSON.stringify(response.error));
    const value = response.result?.structuredContent;
    assert.ok(value, "real tools/call must return a structured envelope");
    assert.equal(value.requestId, requestId);
    assert.equal(value.operation, tool === "spec_patch" ? "specPatch" : tool === "spec_evidence" ? "evidence" : "inspect");
    const serialized = JSON.stringify(value);
    assert.ok(Buffer.byteLength(serialized) < 32_000, "readiness responses stay bounded");
    for (const root of [projectRoot, repositoryRoot]) {
      assert.equal(serialized.includes(path.resolve(root).replaceAll("\\", "/")), false);
      assert.equal(serialized.includes(path.resolve(root)), false);
    }
    if (!write) assert.deepEqual(await snapshotTree(projectRoot), before, `${tool} must preserve project bytes`);
    return value;
  };
  const inspect = async (level) => {
    const value = await rpc("spec_inspect", { check: "readiness", spec: SPEC });
    assert.equal(value.ok, true, JSON.stringify(value.error));
    assert.equal(value.data.level, level, JSON.stringify(value.data));
    assert.equal(value.data.reached.evidence, level === "L3" || level === "L4");
    assert.deepEqual(value.data.blockers.map((entry) => entry.code), level === "L2" ? ["NO_EXECUTION_EVIDENCE"] : level === "L3" ? ["NO_TASKS"] : []);
    const preview = await rpc("spec_patch", {
      intent: "patch", spec: SPEC, dryRun: true, reason: "readiness evidence parity",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "\n<!-- preview only -->\n" }],
    });
    assert.equal(preview.ok, true, JSON.stringify(preview.error));
    assert.equal(preview.data.outcome, "PREVIEW");
    assert.deepEqual(preview.data.readiness, Object.fromEntries(Object.entries(value.data).filter(([key]) => key !== "kind")));
    assert.equal(preview.graph.fingerprint, value.graph.fingerprint);
    return value;
  };
  const encode = (items) => Buffer.from(items.map((frame) => JSON.stringify(frame)).join("\n") + "\n");
  try {
    for (const [name, text] of [
      ["README.md", "# Execution proof\n\nStatus: DRAFT\n"],
      ["FR.md", "# Functional requirements\n\n## FR-1 — Release evidence\n\nThe release pipeline proves its execution boundary.\n"],
      ["ACCEPTANCE_CRITERIA.md", "# Acceptance criteria\n\n## AC-1.1 — FR-1\n\nGiven the producer runs, when it completes, then the recorded execution is complete.\n"],
      ["DESIGN.md", "# Design\n\n## DEC-1 — Producer evidence\n\n" + "Use the captured Cucumber source and complete terminal attempts, never authored pass status. ".repeat(4)],
      ["TASKS.md", "# Tasks\n"],
      [`${SPEC}.feature`, feature],
    ]) await writeFile(path.join(specDir, name), text);
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, bytes);
    await inspect("L3");
    const evidenceResult = async (expected) => {
      const result = await rpc("spec_evidence", { view: "result", scenarioId: `${SPEC}:${scenarioId}`, spec: SPEC });
      assert.equal(result.ok, true, JSON.stringify(result.error));
      assert.equal(result.data.result, expected);
      if (expected === "NOT_RUN") assert.equal(result.data.source, null, "escaped capture must not be read or hashed");
      else assert.match(result.data.source.sha256, /^[a-f0-9]{64}$/u);
    };
    await evidenceResult("PASSED");
    const outside = await mkdtemp(path.join(tmpdir(), "omp-readiness-outside-"));
    try {
      const outsideFile = path.join(outside, "last-test-run.ndjson");
      await writeFile(outsideFile, bytes);
      const outsideBefore = await snapshotTree(outside);
      const directory = path.dirname(evidencePath);
      const savedDirectory = directory + "-readiness-saved";
      await rename(directory, savedDirectory);
      try {
        await symlink(outside, directory, "junction");
        await evidenceResult("NOT_RUN");
        await inspect("L2");
        assert.deepEqual(await snapshotTree(outside), outsideBefore);
      } finally {
        await rm(directory, REMOVE_OPTIONS);
        await rename(savedDirectory, directory);
      }
      await evidenceResult("PASSED");
      const savedFile = evidencePath + ".readiness-saved";
      await rename(evidencePath, savedFile);
      try {
        await symlink(outsideFile, evidencePath, "file");
        await evidenceResult("NOT_RUN");
        await inspect("L2");
        assert.deepEqual(await snapshotTree(outside), outsideBefore);
      } finally {
        await rm(evidencePath, { force: true });
        await rename(savedFile, evidencePath);
      }
      await evidenceResult("PASSED");
    } finally {
      await rm(outside, REMOVE_OPTIONS);
    }
    const applied = await rpc("spec_patch", {
      intent: "confirmTaskCreation", spec: SPEC, entity: "TASK-1", subject: "Verify execution evidence",
      requirements: ["FR-1"], reason: "prove L4 through the admitted task path", dryRun: false,
    }, { write: true });
    assert.equal(applied.ok, true, JSON.stringify(applied.error));
    assert.equal(applied.data.outcome, "APPLIED");
    const complete = await inspect("L4");

    const unsuccessful = structuredClone(frames);
    unsuccessful.find((frame) => frame.testRunFinished).testRunFinished.success = false;
    await writeFile(evidencePath, encode(unsuccessful));
    assert.equal((await inspect("L2")).graph.fingerprint, complete.graph.fingerprint, "an evidence-only update preserves document identity");
    await writeFile(evidencePath, bytes);
    await inspect("L4");

    const wrongRun = structuredClone(frames);
    wrongRun.find((frame) => frame.testRunFinished).testRunFinished.testRunStartedId = "another-run";
    await writeFile(evidencePath, encode(wrongRun));
    await inspect("L2");
    const retryOnly = structuredClone(frames);
    retryOnly.find((frame) => frame.testCaseFinished).testCaseFinished.willBeRetried = true;
    await writeFile(evidencePath, encode(retryOnly));
    await inspect("L2");
    const missingPickle = frames.findIndex((frame) => frame.pickle);
    await writeFile(evidencePath, encode(frames.filter((_, index) => index !== missingPickle)));
    await inspect("L2");

    const firstStep = frames.findIndex((frame) => frame.testStepFinished);
    await writeFile(evidencePath, encode(frames.filter((_, index) => index !== firstStep)));
    await inspect("L2");
    await writeFile(evidencePath, Buffer.concat([bytes, Buffer.from("not-json\n")]));
    await inspect("L2");
    const wrongSource = structuredClone(frames);
    wrongSource.find((frame) => frame.source).source.data += "\n# different executed source\n";
    await writeFile(evidencePath, encode(wrongSource));
    await inspect("L2");
    await writeFile(evidencePath, Buffer.concat([Buffer.from(JSON.stringify({ ompSpecKitEvidence: { binding: { graphFingerprint: "stale", scenarioContentHash: "stale" } } }) + "\n"), bytes]));
    await inspect("L2");
    await writeFile(evidencePath, bytes);
    await writeFile(path.join(specDir, `${SPEC}.feature`), feature + "\n# changed corpus\n");
    await inspect("L2");
    await writeFile(path.join(specDir, `${SPEC}.feature`), feature);
    await inspect("L4");

    const invalid = await rpc("spec_inspect", { check: "readiness", spec: SPEC, unexpected: true });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error.code, "UNKNOWN_FIELD");
    const absent = await rpc("spec_inspect", { check: "readiness", spec: "missing-readiness-spec" });
    assert.equal(absent.ok, false);
    assert.equal(absent.error.code, "NOT_FOUND");
    return { levels: ["L3", "L4"], negativeCases: 11, calls: request };
  } finally {
    if (priorEvidence === undefined) await rm(evidencePath, { force: true });
    else await writeFile(evidencePath, priorEvidence);
    await rm(specDir, REMOVE_OPTIONS);
    // Restore the long-lived server's document snapshot after deliberately
    // removing the copied proof corpus; later phases must not reuse its hash.
    const removed = await rpc("spec_inspect", { check: "readiness", spec: SPEC });
    assert.equal(removed.ok, false);
    assert.equal(removed.error.code, "NOT_FOUND");
  }
}
