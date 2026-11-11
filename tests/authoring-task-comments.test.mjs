import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { executeExtendedQuery } from "../src/kernel/query/extended.js";

const repositoryRoot = process.cwd();
const specsDirName = "." + "specs";
const SPEC = "spec-mcp-access-gate";

async function listTasks(root) {
  const graph = (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
  return executeExtendedQuery(graph, "listTasks", { spec: SPEC, includeComments: true }).data.tasks;
}

describe("task comments in the task listing", () => {
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
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  });

  async function appendTask(text) {
    const file = path.join(tempRoot, specsDirName, SPEC, "TASKS.md");
    const original = await readFile(file, "utf8");
    await writeFile(file, `${original}\n${text}`);
  }

  it("returns comments as structured entries in authored order", async () => {
    await appendTask(
      [
        "## TASK-94 \u2014 Commented task",
        "",
        "- **Status:** todo",
        "",
        "- **Comment (alice, 2026-11-01 10:00):** first note",
        "- **Comment (bob, 2026-11-02 11:30):** second note",
        "",
      ].join("\n")
    );
    const tasks = await listTasks(tempRoot);
    const withComments = tasks.find((task) => task.localId === "TASK-94");
    assert.ok(withComments, "the appended task must be listed");
    for (const comment of withComments.comments) {
      assert.equal(typeof comment.actor, "string");
      assert.ok(comment.actor.length > 0);
      assert.equal(typeof comment.text, "string");
      assert.equal(typeof comment.at, "string");
    }
    const body = withComments.body ?? "";
    const authored = body
      .split(/\r?\n/u)
      .filter((line) => /\*\*Comment \(/u.test(line))
      .map((line) => line.replace(/^.*\*\*Comment \([^,]+,\s*[^)]+\):\*\*\s*/u, "").trim());
    assert.deepEqual(
      withComments.comments.map((comment) => comment.text),
      authored
    );
  });

  it("returns an empty array for a task without comments", async () => {
    const tasks = await listTasks(tempRoot);
    const withoutComments = tasks.find(
      (task) => task.localId !== "TASK-94" && !/\*\*Comment \(/u.test(task.body ?? "")
    );
    assert.ok(withoutComments, "the fixture corpus must carry a task without comments");
    assert.deepEqual(withoutComments.comments, []);
  });
});
