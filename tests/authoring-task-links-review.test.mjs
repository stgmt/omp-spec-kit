import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { executeExtendedQuery } from "../src/kernel/query/extended.js";

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
    assert.match(diff, new RegExp(`\\*\\*Refs:\\*\\* ${tasks[1].localId}`, "u"));
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
    assert.doesNotMatch(diff, /^\+.*\*\*Refs:\*\* $/mu);

    // The listing must expose what was written: a review verdict and a link.
    const applied = await serviceAt(tempRoot).execute({
      requestId: "links-5",
      intent: "updateTask",
      spec: "spec-mcp-access-gate",
      reason: "links",
      dryRun: false,
      entity: task.localId,
      review: "approved",
      owner: "agent-x",
      refs: other ? [other.localId] : [],
    });
    assert.equal(applied.ok, true, JSON.stringify(applied.error ?? {}).slice(0, 300));
    const listed = executeExtendedQuery(await graphAt(tempRoot), "listTasks", {
      spec: "spec-mcp-access-gate",
    });
    const entry = listed.data.tasks.find((item) => item.localId === task.localId);
    assert.equal(entry.review, "approved");
    assert.equal(entry.owner, "agent-x");
    assert.ok(other, "fixture corpus must carry a second task");
    assert.deepEqual(entry.links, [other.canonicalId]);
  });
});

describe("design-level reference integrity", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "omp-design-refs-"));
    await cp(
      path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus", specsDirName),
      path.join(tempRoot, specsDirName),
      { recursive: true }
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  function appendOperation(text) {
    return {
      requestId: "refs-1",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "refs",
      dryRun: true,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text }],
    };
  }

  it("accepts a design entity that exists", async () => {
    const graph = await graphAt(tempRoot);
    const criterion = graph.nodes.find(
      (node) => node.kind === "ACCEPTANCE_CRITERION" && node.specSlug === "spec-mcp-access-gate"
    );
    assert.ok(criterion);
    const result = await serviceAt(tempRoot).execute(
      appendOperation(`\n## TASK-96 — Проба критерия\n\n- **Status:** todo\n- **Implements:** ${criterion.localId}\n`)
    );
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
  });


  it("does not refuse sample reference lines inside fenced code", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "refs-fence",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "docs sample",
      dryRun: true,
      operations: [
        {
          kind: "insert_at_eof",
          document: "DESIGN.md",
          text: "\n## Пример\n\n```markdown\n- **Refs:** AC-99.9\n```\n\nЖивая ссылка: FR-1.\n",
        },
      ],
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
  });


  it("accepts a reference to an entity the same proposal defines", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "refs-batch",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "define and link",
      dryRun: true,
      operations: [
        { kind: "insert_at_eof", document: "FR.md", text: "\n## FR-50 — Probe requirement\n" },
        {
          kind: "insert_at_eof",
          document: "TASKS.md",
          text: "\n## TASK-96 — Probe task\n\n- **Status:** todo\n- **Requirements:** FR-50\n",
        },
      ],
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
  });

  it("does not refuse an edit that leaves an older dangling reference untouched", async () => {
    const tasksPath = path.join(tempRoot, specsDirName, "spec-mcp-access-gate", "TASKS.md");
    const original = await readFile(tasksPath, "utf8");
    await writeFile(tasksPath, `${original}\n## TASK-90 — Legacy\n\n- **Status:** todo\n- **Refs:** TASK-777\n`);
    const result = await serviceAt(tempRoot).execute({
      requestId: "refs-legacy",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "rename only",
      dryRun: true,
      operations: [
        {
          kind: "replace_document",
          document: "TASKS.md",
          content: `${original}\n## TASK-90 — Legacy renamed\n\n- **Status:** todo\n- **Refs:** TASK-777\n`,
        },
      ],
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
  });

  it("refuses a link type the endpoint matrix forbids", async () => {
    const graph = await graphAt(tempRoot);
    const task = graph.nodes.find(
      (node) => node.kind === "TASK" && node.specSlug === "spec-mcp-access-gate"
    );
    const requirement = graph.nodes.find(
      (node) => node.kind === "FUNCTIONAL_REQUIREMENT" && node.specSlug === "spec-mcp-access-gate"
    );
    assert.ok(task && requirement);
    const result = await serviceAt(tempRoot).execute({
      requestId: "refs-endpoint",
      intent: "updateTask",
      spec: "spec-mcp-access-gate",
      reason: "bad edge",
      dryRun: true,
      entity: task.localId,
      dependsOn: [requirement.localId],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "VALIDATION_FAILED");
  });

  it("refuses a design entity that exists nowhere", async () => {
    const result = await serviceAt(tempRoot).execute(
      appendOperation("\n## TASK-96 — Проба критерия\n\n- **Status:** todo\n- **Implements:** AC-99.9\n")
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "VALIDATION_FAILED");
    assert.equal(result.error.findings?.[0]?.code, "REFERENCE_NOT_FOUND");
  });

  it("refuses a qualified reference to a missing entity", async () => {
    const result = await serviceAt(tempRoot).execute(
      appendOperation("\n## TASK-96 — Проба критерия\n\n- **Status:** todo\n- **Refs:** plugin-distribution:DEC-404\n")
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.findings?.[0]?.code, "REFERENCE_NOT_FOUND");
  });

  it("refuses a bare id that only exists in another specification", async () => {
    const graph = await graphAt(tempRoot);
    const ownLocalIds = new Set(
      graph.nodes
        .filter((node) => node.specSlug === "spec-mcp-access-gate")
        .map((node) => node.localId)
    );
    const foreign = graph.nodes.find(
      (node) =>
        node.specSlug !== "spec-mcp-access-gate" &&
        typeof node.localId === "string" &&
        /^(?:AC|DEC|US)-[0-9]/u.test(node.localId) &&
        !ownLocalIds.has(node.localId)
    );
    assert.ok(foreign, "fixture corpus must carry an entity outside the target spec");
    const result = await serviceAt(tempRoot).execute(
      appendOperation(`\n## TASK-96 — Проба критерия\n\n- **Status:** todo\n- **Refs:** ${foreign.localId}\n`)
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.findings?.[0]?.code, "UNQUALIFIED_CROSS_SPEC_REFERENCE");
    assert.ok((result.error.findings?.[0]?.candidates ?? []).length > 0);
  });
});
