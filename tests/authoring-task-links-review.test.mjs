import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
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

describe("task links and review state", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "omp-task-links-"));
    await cp(
      path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus", specsDirName),
      path.join(tempRoot, specsDirName),
      { recursive: true }
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("writes a requirement reference the corpus can resolve", async () => {
    const graph = await graphAt(tempRoot);
    const requirement = graph.nodes.find(
      (node) => node.kind === "FUNCTIONAL_REQUIREMENT" && node.specSlug === "spec-mcp-access-gate"
    );
    assert.ok(requirement);
    const result = await serviceAt(tempRoot).execute({
      requestId: "links-1",
      intent: "confirmTaskCreation",
      spec: "spec-mcp-access-gate",
      reason: "links",
      dryRun: true,
      entity: "TASK-95",
      subject: "Задача со ссылкой",
      requirements: [requirement.localId ?? requirement.canonicalId],
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
  });

  it("refuses a link to a task that does not exist", async () => {
    const graph = await graphAt(tempRoot);
    const task = graph.nodes.find(
      (node) => node.kind === "TASK" && node.specSlug === "spec-mcp-access-gate"
    );
    const result = await serviceAt(tempRoot).execute({
      requestId: "links-3",
      intent: "updateTask",
      spec: "spec-mcp-access-gate",
      reason: "links",
      dryRun: true,
      entity: task.localId,
      refs: ["TASK-404"],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "VALIDATION_FAILED");
    assert.equal(result.error.findings?.[0]?.code, "TASK_NOT_FOUND");
  });

  it("accepts the application link operation with existing targets", async () => {
    const graph = await graphAt(tempRoot);
    const tasks = graph.nodes.filter(
      (node) => node.kind === "TASK" && node.specSlug === "spec-mcp-access-gate"
    );
    assert.ok(tasks.length >= 2);
    const result = await serviceAt(tempRoot).execute({
      requestId: "links-4",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "links",
      dryRun: true,
      operations: [
        {
          kind: "replace_task_links",
          document: "TASKS.md",
          entity: tasks[0].localId,
          refs: [tasks[1].localId],
        },
      ],
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
    const diff = result.data.operations?.map((entry) => entry.diff ?? "").join("\n") ?? "";
    assert.match(diff, /\*\*Refs:\*\*/u);
  });

  it("stores review state and links on an existing task", async () => {
    const graph = await graphAt(tempRoot);
    const task = graph.nodes.find(
      (node) => node.kind === "TASK" && node.specSlug === "spec-mcp-access-gate"
    );
    assert.ok(task, "fixture corpus must contain a task");
    const other = graph.nodes.find(
      (node) =>
        node.kind === "TASK" && node.specSlug === "spec-mcp-access-gate" && node.localId !== task.localId
    );
    const result = await serviceAt(tempRoot).execute({
      requestId: "links-2",
      intent: "updateTask",
      spec: "spec-mcp-access-gate",
      reason: "links",
      dryRun: true,
      entity: task.localId,
      review: "approved",
      refs: other ? [other.localId] : [],
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
    const diff = result.data.operations?.map((entry) => entry.diff ?? "").join("\n") ?? "";
    assert.match(diff, /\*\*Review:\*\* approved/u);
  });
});
