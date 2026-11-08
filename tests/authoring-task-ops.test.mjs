import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { applyOperation } from "../src/authoring/proposals.js";
import { SpecPatchService } from "../src/authoring/service.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { query } from "../src/kernel/index.js";
import { parseTaskDescription } from "../src/kernel/task-description.js";
import { executeExtendedQuery } from "../src/kernel/query/extended.js";

const repositoryRoot = process.cwd();
const specsDirName = "." + "specs";
const SPEC = "spec-mcp-access-gate";
const TASKS_DOCUMENT = "TASKS.md";

async function graphAt(root) {
  return (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
}

function serviceAt(root, options = {}) {
  return new SpecPatchService(root, () => graphAt(root), () => graphAt(root), options);
}

function tasksPath(root) {
  return path.join(root, specsDirName, SPEC, TASKS_DOCUMENT);
}

async function tasksText(root) {
  return readFile(tasksPath(root), "utf8");
}

const statusChange = (status, expectedStatus) => ({
  kind: "replace_task_status",
  document: TASKS_DOCUMENT,
  entity: "TASK-3",
  status,
  expectedStatus,
});

const upsertTask3 = {
  kind: "upsert_task",
  document: TASKS_DOCUMENT,
  localId: "TASK-90",
  title: "Registry owned task",
  body: "the registry writes task structure",
  owner: "registry-owner",
  tracking: "agent-teams:tokenplan-ops/8f14e45f-ceea-467f-a387-fa0d7c3d0b10",
  status: "todo",
  requirements: ["FR-1"],
  dependsOn: ["TASK-1"],
};

describe("structured task operations", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "omp-task-ops-"));
    await cp(
      path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus", specsDirName),
      path.join(tempRoot, specsDirName),
      { recursive: true },
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("refuses a stale expectedStatus and reports the current status", () => {
    const text = ["# Tasks", "", "## TASK-3 — Task", "", "- **Status:** todo", ""].join("\n");
    const result = applyOperation(text, statusChange("done", "ready"));
    assert.equal(result.ok, false);
    assert.equal(result.code, "STATUS_CONFLICT");
    assert.equal(result.currentStatus, "todo");
    assert.equal(result.text, undefined, "a refused transition must not carry replacement text");
  });

  it("returns unchanged when the task already holds the target status", () => {
    const text = ["# Tasks", "", "## TASK-3 — Task", "", "- **Status:** todo", ""].join("\n");
    const result = applyOperation(text, statusChange("todo", "todo"));
    assert.equal(result.ok, true);
    assert.equal(result.unchanged, true);
    assert.equal(result.transition, null);
    assert.equal(result.text, text);
  });

  it("applies a status transition only when expectedStatus matches, with no write on conflict", async () => {
    const before = await tasksText(tempRoot);
    const refused = await serviceAt(tempRoot).execute({
      requestId: "task-ops-stale-1",
      intent: "patch",
      spec: SPEC,
      reason: "stale expected status test",
      dryRun: false,
      operations: [statusChange("done", "ready")],
    });
    assert.equal(refused.ok, true);
    assert.equal(refused.data.outcome, "REFUSED");
    assert.equal(refused.data.error.code, "STATUS_CONFLICT");
    assert.equal(refused.data.error.currentStatus, "todo");
    assert.equal(await tasksText(tempRoot), before, "a refused transition must not touch TASKS.md");
  });

  it("returns a transition receipt with requestId, from, to, actor and at", async () => {
    const applied = await serviceAt(tempRoot, { actor: "alice" }).execute({
      requestId: "task-ops-apply-1",
      intent: "patch",
      spec: SPEC,
      reason: "transition receipt test",
      dryRun: false,
      operations: [statusChange("in-progress", "todo")],
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.data.outcome, "APPLIED");
    const transitions = applied.data.receipt.transitions;
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].requestId, "task-ops-apply-1");
    assert.equal(transitions[0].localId, "TASK-3");
    assert.equal(transitions[0].from, "todo");
    assert.equal(transitions[0].to, "in-progress");
    assert.equal(transitions[0].actor, "alice");
    assert.match(transitions[0].at, /^\d{4}-\d{2}-\d{2}T/u);
    assert.match(await tasksText(tempRoot), /## TASK-3:[\s\S]*?\*\*Status:\*\* in-progress/u);
  });

  it("replays one requestId without a second transition and reports unchanged at the target status", async () => {
    const service = serviceAt(tempRoot);
    const request = {
      requestId: "task-ops-replay-1",
      intent: "patch",
      spec: SPEC,
      reason: "replay test",
      dryRun: false,
      operations: [statusChange("in-progress", "todo")],
    };
    const first = await service.execute(request);
    assert.equal(first.data.outcome, "APPLIED");
    const afterFirst = await tasksText(tempRoot);
    const replay = await service.execute(request);
    assert.deepEqual(replay, first);
    assert.equal(await tasksText(tempRoot), afterFirst, "a replay must not write again");

    const atTarget = await service.execute({
      requestId: "task-ops-replay-2",
      intent: "patch",
      spec: SPEC,
      reason: "already at target",
      dryRun: false,
      operations: [statusChange("in-progress", "in-progress")],
    });
    assert.equal(atTarget.ok, true);
    assert.equal(atTarget.data.outcome, "UNCHANGED");
    assert.deepEqual(atTarget.data.transitions, []);
    assert.equal(await tasksText(tempRoot), afterFirst);

    const staleAfterTransition = await service.execute({
      requestId: "task-ops-replay-3",
      intent: "patch",
      spec: SPEC,
      reason: "stale after transition",
      dryRun: false,
      operations: [statusChange("done", "todo")],
    });
    assert.equal(staleAfterTransition.data.outcome, "REFUSED");
    assert.equal(staleAfterTransition.data.error.code, "STATUS_CONFLICT");
    assert.equal(staleAfterTransition.data.error.currentStatus, "in-progress");
  });

  it("creates a task through upsert_task and is idempotent on identical input", async () => {
    const service = serviceAt(tempRoot);
    const created = await service.execute({
      requestId: "task-ops-upsert-1",
      intent: "patch",
      spec: SPEC,
      reason: "upsert task test",
      dryRun: false,
      operations: [upsertTask3],
    });
    assert.equal(created.ok, true, JSON.stringify(created.error ?? created.data?.error));
    assert.equal(created.data.outcome, "APPLIED");
    const afterCreate = await tasksText(tempRoot);
    const expectedBlock = [
      "## TASK-90 — Registry owned task",
      "",
      "- **Status:** todo",
      "- **Owner:** registry-owner",
      "",
      "**Implements:** FR-1",
      "",
      "**Depends On:** TASK-1",
      "",
      "- **Tracking:** agent-teams:tokenplan-ops/8f14e45f-ceea-467f-a387-fa0d7c3d0b10",
      "",
      "- **Done When:** the registry writes task structure",
      "",
    ].join("\n");
    assert.ok(afterCreate.includes(expectedBlock), `created block shape drifted:\n${afterCreate.slice(-1200)}`);

    const repeated = await service.execute({
      requestId: "task-ops-upsert-2",
      intent: "patch",
      spec: SPEC,
      reason: "upsert task test",
      dryRun: false,
      operations: [upsertTask3],
    });
    assert.equal(repeated.ok, true);
    assert.equal(repeated.data.outcome, "UNCHANGED");
    assert.equal(await tasksText(tempRoot), afterCreate, "an identical upsert must not rewrite the document");
  });

  it("rejects malformed creation tokens without writing a task or marker", async () => {
    const service = serviceAt(tempRoot);
    const before = await tasksText(tempRoot);
    const malformedToken = "not-a-valid-creation-token";
    const direct = applyOperation(before, { ...upsertTask3, creationToken: malformedToken });
    assert.equal(direct.ok, false);
    assert.equal(direct.code, "INVALID_REQUEST");
    const refused = await service.execute({
      requestId: "task-ops-invalid-creation-token",
      intent: "patch",
      spec: SPEC,
      reason: "reject malformed task creation token",
      dryRun: false,
      operations: [{ ...upsertTask3, creationToken: malformedToken }],
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "INVALID_REQUEST");
    assert.equal(await tasksText(tempRoot), before, "a rejected token must not change TASKS.md");
    assert.equal(before.includes(malformedToken), false);
    assert.equal((await graphAt(tempRoot)).nodes.some((node) => node.canonicalId === `${SPEC}:TASK-90`), false);

    const validToken = `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.${"b".repeat(64)}`;
    const created = await service.execute({
      requestId: "task-ops-valid-creation-token",
      intent: "patch",
      spec: SPEC,
      reason: "valid task creation token control",
      dryRun: false,
      operations: [{ ...upsertTask3, creationToken: validToken }],
    });
    assert.equal(created.ok, true, JSON.stringify(created.error ?? created.data?.error));
    assert.equal(created.data.outcome, "APPLIED");
    assert.ok((await tasksText(tempRoot)).includes(`<!-- agent-teams-creation:${validToken} -->`));
    const listed = executeExtendedQuery(await graphAt(tempRoot), "listTasks", { spec: SPEC });
    const task = listed.data.tasks.find((entry) => entry.localId === "TASK-90");
    assert.equal(task.creationToken, validToken);
  });

  it("exposes owner, tracking, contentHash and derived dependency edges in task and board views", async () => {
    await serviceAt(tempRoot).execute({
      requestId: "task-ops-read-1",
      intent: "patch",
      spec: SPEC,
      reason: "projection read test",
      dryRun: false,
      operations: [upsertTask3],
    });
    const graph = await graphAt(tempRoot);

    const listed = executeExtendedQuery(graph, "listTasks", { spec: SPEC });
    assert.equal(listed.ok, true, JSON.stringify(listed.error ?? null));
    const task = listed.data.tasks.find((entry) => entry.localId === "TASK-90");
    assert.ok(task, "upserted task is missing from the task list");
    assert.equal(task.owner, "registry-owner");
    assert.equal(task.tracking, upsertTask3.tracking);
    assert.equal(task.status, "todo");
    assert.deepEqual(task.requirements, [`${SPEC}:FR-1`]);
    assert.equal(task.estimate, null);
    assert.deepEqual(task.doneWhen, ["the registry writes task structure"]);
    assert.deepEqual(task.refs, [`${SPEC}:FR-1`]);
    assert.equal(typeof task.contentHash, "string");
    assert.deepEqual(task.dependsOn, [`${SPEC}:TASK-1`]);
    assert.deepEqual(task.blockedBy, [`${SPEC}:TASK-1`]);
    assert.deepEqual(task.blocks, []);
    const authoredTask = listed.data.tasks.find((entry) => entry.localId === "TASK-1");
    assert.equal(authoredTask.estimate, "1 day");
    assert.deepEqual(authoredTask.doneWhen, [
      "`decision.js` contains exactly the two authoring names and six public result codes.",
      "Name near misses follow the path matrix; multi-target precedence matches REQUIREMENTS.",
      "The 512-byte reason preserves code and redirect and contains no absolute or raw error data.",
      "CHK-FR2-01, CHK-FR4-01, and the output portion of CHK-FR5-01 pass against reviewed fixtures.",
    ]);
    assert.deepEqual(authoredTask.requirements, [`${SPEC}:FR-2`, `${SPEC}:FR-4`, `${SPEC}:FR-5`]);
    assert.deepEqual(authoredTask.refs, [`${SPEC}:FR-2`, `${SPEC}:FR-4`, `${SPEC}:FR-5`]);

    const board = query(graph, "board", { specSlugs: [SPEC] });
    assert.equal(board.ok, true);
    const taskNode = board.data.nodes.find((node) => node.canonicalId === `${SPEC}:TASK-90`);
    assert.ok(taskNode, "upserted task is missing from the board projection");
    assert.equal(taskNode.owner, "registry-owner");
    assert.equal(taskNode.tracking, upsertTask3.tracking);
    assert.equal(typeof taskNode.contentHash, "string");
    assert.deepEqual(taskNode.dependsOn, [`${SPEC}:TASK-1`]);
    assert.deepEqual(taskNode.blockedBy, [`${SPEC}:TASK-1`]);
    assert.deepEqual(taskNode.blocks, []);
    assert.equal(taskNode.estimate, null);
    assert.deepEqual(taskNode.doneWhen, ["the registry writes task structure"]);
    assert.deepEqual(taskNode.refs, [`${SPEC}:FR-1`]);
    const authoredTaskNode = board.data.nodes.find((node) => node.canonicalId === `${SPEC}:TASK-1`);
    assert.equal(authoredTaskNode.estimate, "1 day");
    assert.deepEqual(authoredTaskNode.doneWhen, authoredTask.doneWhen);
    assert.deepEqual(authoredTaskNode.refs, authoredTask.refs);
  });

  it("returns the full canonical reference list, including acceptance criteria, in task cards", async () => {
    const operation = {
      ...upsertTask3,
      localId: "TASK-91",
      requirements: ["FR-1", "AC-1.1"],
      refs: ["NFR-SEC-1"],
    };
    const created = await serviceAt(tempRoot).execute({
      requestId: "task-ops-read-refs-1",
      intent: "patch",
      spec: SPEC,
      reason: "card reference projection regression",
      dryRun: false,
      operations: [operation],
    });
    assert.equal(created.ok, true, JSON.stringify(created.error ?? created.data?.error));
    const graph = await graphAt(tempRoot);
    const listed = executeExtendedQuery(graph, "listTasks", { spec: SPEC });
    const task = listed.data.tasks.find((entry) => entry.localId === "TASK-91");
    assert.deepEqual(task.requirements, [`${SPEC}:AC-1.1`, `${SPEC}:FR-1`, `${SPEC}:NFR-SEC-1`]);
    assert.deepEqual(task.refs, [`${SPEC}:AC-1.1`, `${SPEC}:FR-1`, `${SPEC}:NFR-SEC-1`]);
    const board = query(graph, "board", { specSlugs: [SPEC] });
    const taskNode = board.data.nodes.find((node) => node.canonicalId === `${SPEC}:TASK-91`);
    assert.deepEqual(taskNode.refs, task.refs);

  });
  it("round-trips multiline descriptions without changing criteria or introducing graph references", async () => {
    const service = serviceAt(tempRoot);
    const description = [
      "First line",
      "## TASK-999 — injected",
      "**Implements:** FR-2",
      "[other requirement](#FR-2)",
      "<https://example.invalid>",
      "<!-- agent-teams-description:end -->",
      "backslash \\\\ and carriage return \r",
      "",
    ].join("\n");
    const patch = (requestId, operation) => service.execute({
      requestId, intent: "patch", spec: SPEC, reason: "description round trip",
      dryRun: false, operations: [operation],
    });
    const created = await patch("task-description-create", { ...upsertTask3, description });
    assert.equal(created.data.outcome, "APPLIED", JSON.stringify(created.error ?? created.data?.error));
    let graph = await graphAt(tempRoot);
    let listed = executeExtendedQuery(graph, "listTasks", { spec: SPEC });
    let task = listed.data.tasks.find((entry) => entry.localId === "TASK-90");
    assert.equal(task.description, description);
    assert.deepEqual(task.requirements, [`${SPEC}:FR-1`]);
    assert.equal(graph.nodes.some((node) => node.localId === "TASK-999"), false);
    assert.match(await tasksText(tempRoot), /\*\*Done When:\*\* the registry writes task structure/u);

    const updated = await patch("task-description-clear", {
      kind: "upsert_task", document: TASKS_DOCUMENT, localId: "TASK-90",
      title: upsertTask3.title, description: "",
    });
    assert.equal(updated.data.outcome, "APPLIED");
    graph = await graphAt(tempRoot);
    listed = executeExtendedQuery(graph, "listTasks", { spec: SPEC });
    task = listed.data.tasks.find((entry) => entry.localId === "TASK-90");
    assert.equal(task.description, "");
    assert.match(await tasksText(tempRoot), /\*\*Done When:\*\* the registry writes task structure/u);
  });

  it("preserves legacy criteria and refuses malformed description blocks", () => {
    const legacy = "# Tasks\n\n## TASK-90 — Legacy\n\n- **Status:** todo\n- **Done When:** keep this\n";
    const operation = {
      kind: "upsert_task", document: TASKS_DOCUMENT, localId: "TASK-90", title: "Legacy",
      description: "new description\nwith two lines",
    };
    const added = applyOperation(legacy, operation);
    assert.equal(added.ok, true);
    assert.match(added.text, /\*\*Done When:\*\* keep this/u);
    const repeated = applyOperation(added.text, operation);
    assert.equal(repeated.unchanged, true);
    const malformed = added.text.replace("> new description", "new description");
    const refused = applyOperation(malformed, { ...operation, description: "replacement" });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, "VALIDATION_FAILED");
  });

  it("does not interpret description markers inside a fenced code example", () => {
    const example = [
      "```md",
      "<!-- agent-teams-description:start -->",
      "> example",
      "<!-- agent-teams-description:end -->",
      "```",
    ].join("\n");
    const original = `# Tasks\n\n## TASK-90 — Legacy\n\n- **Status:** todo\n\n${example}\n`;
    assert.deepEqual(parseTaskDescription(original), { kind: "absent" });
    const result = applyOperation(original, {
      kind: "upsert_task", document: TASKS_DOCUMENT, localId: "TASK-90", title: "Legacy",
      description: "actual description",
    });
    assert.equal(result.ok, true);
    assert.ok(result.text.includes(example), "the code example must remain byte-for-byte unchanged");
    assert.equal(parseTaskDescription(result.text).value, "actual description");
    assert.match(result.text, /> actual description/u);
  });

  it("clears an owner and guards deletion and restoration by the observed status", async () => {
    const service = serviceAt(tempRoot);
    const statusBefore = executeExtendedQuery(await graphAt(tempRoot), "getSpecStatus", { spec: SPEC });
    assert.equal(statusBefore.ok, true);
    const deletedBefore = statusBefore.data.specs[0].taskStatuses.deleted;
    assert.equal(typeof deletedBefore, "number");
    const patch = (requestId, operation) => service.execute({
      requestId, intent: "patch", spec: SPEC, reason: "owner and trash", dryRun: false,
      operations: [operation],
    });
    await patch("task-trash-create", upsertTask3);
    const owner = await patch("task-owner-clear", {
      kind: "replace_task_owner", document: TASKS_DOCUMENT, entity: "TASK-90", owner: null,
    });
    assert.equal(owner.data.outcome, "APPLIED");
    const status = (target, expected) => ({
      kind: "replace_task_status", document: TASKS_DOCUMENT, entity: "TASK-90",
      status: target, expectedStatus: expected,
    });
    assert.equal((await patch("task-trash-delete", status("deleted", "todo"))).data.outcome, "APPLIED");
    const stale = await patch("task-trash-stale", status("todo", "todo"));
    assert.equal(stale.data.error.code, "STATUS_CONFLICT");
    const deleted = executeExtendedQuery(await graphAt(tempRoot), "listTasks", { spec: SPEC, statuses: ["deleted"] });
    const task = deleted.data.tasks.find((entry) => entry.localId === "TASK-90");
    assert.equal(task.owner, null);
    const statusAfterDelete = executeExtendedQuery(await graphAt(tempRoot), "getSpecStatus", { spec: SPEC });
    assert.equal(statusAfterDelete.ok, true);
    assert.equal(statusAfterDelete.data.kind, "status");
    assert.equal(statusAfterDelete.data.specs[0].taskStatuses.deleted, deletedBefore + 1);
    assert.equal((await patch("task-trash-restore", status("todo", "deleted"))).data.outcome, "APPLIED");
  });

  it("refuses free-form task fields in TASKS.md and leaves the document untouched", async () => {
    const before = await tasksText(tempRoot);
    const refused = await serviceAt(tempRoot).execute({
      requestId: "task-ops-freeform-1",
      intent: "patch",
      spec: SPEC,
      reason: "free-form task body test",
      dryRun: false,
      operations: [
        {
          kind: "insert_at_eof",
          document: TASKS_DOCUMENT,
          text: "\n## TASK-91 — Hand written\n\n- **Status:** todo\n- **Owner:** someone\n",
        },
      ],
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "INVALID_REQUEST");
    assert.match(refused.error.message, /STRUCTURED_TASK_OP_REQUIRED/u);
    assert.equal(await tasksText(tempRoot), before);
  });

  it("refuses free-form status edits inside a task section", async () => {
    const refused = await serviceAt(tempRoot).execute({
      requestId: "task-ops-freeform-2",
      intent: "patch",
      spec: SPEC,
      reason: "free-form status edit test",
      dryRun: true,
      operations: [
        {
          kind: "replace_in_section",
          document: TASKS_DOCUMENT,
          heading: "TASK-3",
          oldText: "**Status:** todo",
          newText: "**Status:** done",
        },
      ],
    });
    assert.equal(refused.ok, false);
    assert.match(refused.error.message, /STRUCTURED_TASK_OP_REQUIRED/u);
  });

  it("keeps bare task headings writable so unrelated authoring still works", async () => {
    const preview = await serviceAt(tempRoot).execute({
      requestId: "task-ops-heading-1",
      intent: "patch",
      spec: SPEC,
      reason: "bare heading test",
      dryRun: true,
      operations: [
        { kind: "insert_at_eof", document: TASKS_DOCUMENT, text: "\n## TASK-92 — Heading only\n" },
      ],
    });
    assert.equal(preview.ok, true, JSON.stringify(preview.error ?? null));
    assert.equal(preview.data.outcome, "PREVIEW");
  });
});
