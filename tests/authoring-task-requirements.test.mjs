import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { writeCoveredSpec } from "./helpers/approved-coverage-fixture.mjs";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";

const repositoryRoot = process.cwd();
const specsDirName = "." + "specs";

async function graphAt(root) {
  return (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
}

function serviceAt(root) {
  return new SpecPatchService(root, () => graphAt(root), () => graphAt(root));
}

describe("task creation requirement integrity", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "omp-task-req-"));
    await cp(
      path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus", specsDirName),
      path.join(tempRoot, specsDirName),
      { recursive: true }
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("refuses a task whose requirement does not exist in the specification", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "task-req-unknown-1",
      intent: "confirmTaskCreation",
      spec: "spec-mcp-access-gate",
      reason: "requirement integrity",
      dryRun: true,
      entity: "TASK-88",
      subject: "Задача с выдуманным требованием",
      requirements: ["FR-999"],
    });
    assert.equal(result.ok, false);
    // FR-2: the link, not the shape, is what is missing.
    assert.equal(result.error?.code, "TASK_NOT_TRACEABLE");
    assert.equal(result.error?.retryable, false);
    assert.equal(result.error?.fix?.[0]?.tool, "spec_patch");
    assert.equal(result.error?.fix?.[0]?.arguments?.requirements?.length, 1);
  });

  it("accepts a task whose requirement exists in the corpus and has approved coverage", async () => {
    // The converted fixture cannot approve an example; use a covered corpus
    // for the positive control instead of weakening the coverage gate.
    const { spec } = await writeCoveredSpec(tempRoot, "task-requirement-integrity");
    const result = await serviceAt(tempRoot).execute({
      requestId: "task-req-known-1",
      intent: "confirmTaskCreation",
      spec,
      reason: "requirement integrity",
      dryRun: true,
      entity: "TASK-89",
      subject: "Задача с существующим требованием",
      requirements: ["FR-1"],
    }, { hostedCoverage: true });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
  });
});

describe("dangling references are refused at write time", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "omp-task-ref-"));
    await cp(
      path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus", specsDirName),
      path.join(tempRoot, specsDirName),
      { recursive: true }
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("refuses an acceptance criterion attached to an unknown requirement", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "ac-unknown-1",
      intent: "addAcceptanceCriterion",
      spec: "spec-mcp-access-gate",
      reason: "reference integrity",
      dryRun: true,
      requirement: "FR-999",
      criterion: "должно быть отказано",
    });
    assert.equal(result.ok, false, JSON.stringify(result.error ?? {}).slice(0, 300));
    assert.equal(result.error?.code, "VALIDATION_FAILED");
  });

  it("refuses every backlog intent, including one naming an unknown requirement", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "backlog-unknown-1",
      intent: "addBacklogTask",
      spec: "spec-mcp-access-gate",
      reason: "reference integrity",
      dryRun: true,
      title: "Задача с выдуманным требованием",
      requirements: ["FR-999"],
    });
    assert.equal(result.ok, false, JSON.stringify(result.error ?? {}).slice(0, 300));
    assert.equal(result.error?.code, "BACKLOG_FORBIDDEN");
  });

  it("refuses a raw patch that writes a task into TASKS.md", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "patch-unknown-ref-1",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "reference integrity",
      dryRun: true,
      operations: [
        {
          kind: "insert_at_eof",
          document: "TASKS.md",
          text: "\n## TASK-91 — Проба\n\n- **Status:** todo\n- **Requirements:** FR-999\n",
        },
      ],
    });
    assert.equal(result.ok, false, JSON.stringify(result.error ?? {}).slice(0, 300));
    assert.equal(result.error?.code, "TASK_DOCUMENT_BYPASS");
  });
});
