import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { executeExtendedQuery } from "../src/kernel/query/extended.js";

const repositoryRoot = process.cwd();
const specsDirName = "." + "specs";
const spec = "spec-mcp-access-gate";

async function graphAt(root) {
  return (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
}

function serviceAt(root) {
  return new SpecPatchService(root, () => graphAt(root), () => graphAt(root));
}

describe("task comments in the listing", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "omp-task-comments-"));
    await cp(
      path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus", specsDirName),
      path.join(tempRoot, specsDirName),
      { recursive: true }
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  async function addComment(requestId, actor, text) {
    const result = await serviceAt(tempRoot).execute({
      requestId,
      intent: "addTaskComment",
      spec,
      reason: "task comment",
      dryRun: false,
      entity: "TASK-1",
      actor,
      text,
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
  }

  it("exposes authored comments as objects only when includeComments is true", async () => {
    await addComment("comments-1", "alice", "First note");
    await addComment("comments-2", "bob", "Second note");

    const graph = await graphAt(tempRoot);
    const withComments = executeExtendedQuery(graph, "listTasks", {
      spec,
      includeComments: true,
    });
    const entry = withComments.data.tasks.find((task) => task.localId === "TASK-1");
    assert.ok(entry, "fixture corpus must contain TASK-1");
    assert.ok(Array.isArray(entry.comments), "comments must be an array");
    assert.equal(entry.comments.length, 2);
    assert.deepEqual(
      entry.comments.map(({ actor, text }) => ({ actor, text })),
      [
        { actor: "alice", text: "First note" },
        { actor: "bob", text: "Second note" },
      ]
    );
    for (const comment of entry.comments) {
      assert.match(comment.at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/u);
    }

    const withoutComments = executeExtendedQuery(graph, "listTasks", { spec });
    const plain = withoutComments.data.tasks.find((task) => task.localId === "TASK-1");
    assert.equal(Object.hasOwn(plain, "comments"), false);
    assert.equal(Object.hasOwn(plain, "body"), false);
  });

  it("keeps a task without comments at an empty array", async () => {
    const graph = await graphAt(tempRoot);
    const result = executeExtendedQuery(graph, "listTasks", { spec, includeComments: true });
    const entry = result.data.tasks.find((task) => task.localId === "TASK-1");
    assert.ok(entry);
    assert.deepEqual(entry.comments, []);
  });
});
