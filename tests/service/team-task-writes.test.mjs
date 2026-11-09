import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preflightTeamTaskWrites } from "../../src/service/team-task-writes.js";
import { scopeFromContext } from "../../src/service/scope.js";

const PROJECT = "stgmt/alpha";
const SPEC = "spec-real";
const TEAM_ID = "9f6efbbb-9fbb-4fb0-8c37-4424a649bac9";
const OWNER = JSON.stringify(["default", "alice"]);
const TASK_ID = "TASK-7";
const TASK_CANONICAL_ID = `${SPEC}:${TASK_ID}`;
const REQUIREMENT_ID = `${SPEC}:FR-1`;
const graph = {
  nodes: [
    { canonicalId: REQUIREMENT_ID, specSlug: SPEC, localId: "FR-1", kind: "FUNCTIONAL_REQUIREMENT", attributes: {} },
    { canonicalId: TASK_CANONICAL_ID, specSlug: SPEC, localId: TASK_ID, kind: "TASK", attributes: { tracking: "agent-teams:team-name" } },
  ],
  edges: [{ from: TASK_CANONICAL_ID, to: REQUIREMENT_ID, type: "IMPLEMENTS" }],
};

function context(userId = "alice") {
  return {
    identity: { userId },
    idp: "default",
    role: "writer",
    scope: scopeFromContext({ scopes: [PROJECT] }),
  };
}

function registry({ binding = null, ownerPrincipal = OWNER, specLinked = true, linkedTeams = null } = {}) {
  const candidates = linkedTeams ?? (specLinked ? [{ teamId: TEAM_ID, ownerPrincipal }] : []);
  return {
    async getTeamSpecsTaskBinding() { return binding; },
    async getTeamSpecsTeam(teamId) { return teamId === TEAM_ID ? { teamId, ownerPrincipal } : null; },
    async listTeamSpecsBindings(teamId) { return teamId === TEAM_ID && specLinked ? [{ project: PROJECT, spec: SPEC }] : []; },
    async listTeamSpecsTeamsForBinding({ project, spec }) {
      return project === PROJECT && spec === SPEC ? candidates.map((team) => ({ ...team })) : [];
    },
    async applyTeamSpecsTaskBindings() {},
  };
}

function authoringService(currentGraph = graph) {
  return { async ensure() { return { status: "ready", graph: currentGraph }; } };
}

function upsert(overrides = {}) {
  return {
    kind: "upsert_task",
    document: "TASKS.md",
    localId: TASK_ID,
    title: "Shared work",
    teamId: TEAM_ID,
    requirements: ["FR-1"],
    ...overrides,
  };
}

describe("shared-task server write preflight", () => {
  it("authorizes the registered owner and binds a task to its linked spec", async () => {
    const result = await preflightTeamTaskWrites({
      args: { intent: "patch", spec: SPEC, operations: [upsert()] },
      ctx: context(),
      project: PROJECT,
      store: registry(),
      authoringService: authoringService(),
    });
    assert.equal(result.binds.length, 1);
    const { createdAt, ...binding } = result.binds[0];
    assert.deepEqual(binding, {
      teamId: TEAM_ID,
      ownerPrincipal: OWNER,
      project: PROJECT,
      spec: SPEC,
      taskId: TASK_ID,
    });
    assert.ok(Number.isFinite(Date.parse(createdAt)));
  });

  it("auto-assigns a direct task write when exactly one team is linked to the selected spec", async () => {
    const taskFreeGraph = {
      nodes: graph.nodes.filter((node) => node.kind !== "TASK"),
      edges: [],
    };
    const result = await preflightTeamTaskWrites({
      args: { intent: "patch", spec: SPEC, operations: [upsert({ localId: "TASK-8", teamId: undefined })] },
      ctx: context(),
      project: PROJECT,
      store: registry({ linkedTeams: [{ teamId: TEAM_ID, ownerPrincipal: OWNER }] }),
      authoringService: authoringService(taskFreeGraph),
    });
    assert.equal(result.binds.length, 1);
    assert.equal(result.binds[0].teamId, TEAM_ID);
    assert.equal(result.binds[0].taskId, "TASK-8");
    await assert.rejects(
      preflightTeamTaskWrites({
        args: {
          intent: "patch",
          spec: SPEC,
          operations: [upsert({ localId: "TASK-9", teamId: undefined, requirements: [] })],
        },
        ctx: context(),
        project: PROJECT,
        store: registry({ linkedTeams: [{ teamId: TEAM_ID, ownerPrincipal: OWNER }] }),
        authoringService: authoringService(taskFreeGraph),
      }),
      { code: "TEAM_REQUIREMENT_REQUIRED" },
    );
  });

  it("requires an explicit team id when several teams share the selected spec", async () => {
    const taskFreeGraph = {
      nodes: graph.nodes.filter((node) => node.kind !== "TASK"),
      edges: [],
    };
    await assert.rejects(
      preflightTeamTaskWrites({
        args: { intent: "patch", spec: SPEC, operations: [upsert({ localId: "TASK-8", teamId: undefined })] },
        ctx: context(),
        project: PROJECT,
        store: registry({
          linkedTeams: [
            { teamId: TEAM_ID, ownerPrincipal: OWNER },
            { teamId: "4f3eb914-fd36-4b52-a51d-9901c790da18", ownerPrincipal: OWNER },
          ],
        }),
        authoringService: authoringService(taskFreeGraph),
      }),
      { code: "TEAM_ID_REQUIRED" },
    );
    const selected = await preflightTeamTaskWrites({
      args: { intent: "patch", spec: SPEC, operations: [upsert({ localId: "TASK-10" })] },
      ctx: context(),
      project: PROJECT,
      store: registry({
        linkedTeams: [
          { teamId: TEAM_ID, ownerPrincipal: OWNER },
          { teamId: "4f3eb914-fd36-4b52-a51d-9901c790da18", ownerPrincipal: OWNER },
        ],
      }),
      authoringService: authoringService(taskFreeGraph),
    });
    assert.equal(selected.binds[0].teamId, TEAM_ID);
  });

  it("rejects a requirement node from another specification", async () => {
    const taskFreeGraph = {
      nodes: [
        ...graph.nodes.filter((node) => node.kind !== "TASK"),
        { canonicalId: "spec-other:FR-9", specSlug: "spec-other", localId: "FR-9", kind: "FUNCTIONAL_REQUIREMENT", attributes: {} },
      ],
      edges: [],
    };
    await assert.rejects(
      preflightTeamTaskWrites({
        args: { intent: "patch", spec: SPEC, operations: [upsert({ localId: "TASK-8", requirements: ["spec-other:FR-9"] })] },
        ctx: context(),
        project: PROJECT,
        store: registry(),
        authoringService: authoringService(taskFreeGraph),
      }),
      { code: "TEAM_REQUIREMENT_INVALID" },
    );
  });

  it("leaves ordinary untracked task writes outside the team registry", async () => {
    const personalGraph = {
      nodes: graph.nodes.map((node) => node.kind === "TASK" ? { ...node, attributes: {} } : node),
      edges: graph.edges,
    };
    const result = await preflightTeamTaskWrites({
      args: {
        intent: "patch",
        spec: SPEC,
        operations: [{ kind: "replace_task_status", document: "TASKS.md", entity: TASK_ID, status: "in-progress", expectedStatus: "todo" }],
      },
      ctx: context(),
      project: PROJECT,
      store: registry({ specLinked: false }),
      authoringService: { async ensure() { return { status: "ready", graph: personalGraph }; } },
    });
    assert.deepEqual(result, { binds: [], deletes: [] });
  });

  it("does not infer ownership of existing unbound tasks from a linked team", async () => {
    const personalGraph = {
      nodes: graph.nodes.map((node) => node.kind === "TASK" ? { ...node, attributes: {} } : node),
      edges: graph.edges,
    };
    for (const operation of [
      upsert({ teamId: undefined }),
      { kind: "replace_task_status", document: "TASKS.md", entity: TASK_ID, status: "in-progress", expectedStatus: "todo" },
    ]) {
      const result = await preflightTeamTaskWrites({
        args: { intent: "patch", spec: SPEC, operations: [operation] },
        ctx: context(),
        project: PROJECT,
        store: registry(),
        authoringService: authoringService(personalGraph),
      });
      assert.deepEqual(result, { binds: [], deletes: [] });
    }
  });

  it("rejects another authenticated principal and an unlinked project spec", async () => {
    const args = { intent: "patch", spec: SPEC, operations: [upsert()] };
    await assert.rejects(
      preflightTeamTaskWrites({ args, ctx: context("bob"), project: PROJECT, store: registry(), authoringService: authoringService() }),
      { code: "TEAM_ACCESS_DENIED" },
    );
    await assert.rejects(
      preflightTeamTaskWrites({ args, ctx: context(), project: PROJECT, store: registry({ specLinked: false }), authoringService: authoringService() }),
      { code: "TEAM_SPEC_NOT_LINKED" },
    );
  });

  it("requires the team id for existing shared tasks and preserves the last valid requirement", async () => {
    const missingId = {
      intent: "patch",
      spec: SPEC,
      operations: [{ kind: "replace_task_status", document: "TASKS.md", entity: TASK_ID, status: "in-progress", expectedStatus: "todo" }],
    };
    await assert.rejects(
      preflightTeamTaskWrites({
        args: missingId,
        ctx: context(),
        project: PROJECT,
        store: registry({ binding: { project: PROJECT, spec: SPEC, taskId: TASK_ID, teamId: TEAM_ID } }),
        authoringService: authoringService(),
      }),
      { code: "TEAM_ID_REQUIRED" },
    );

    await assert.rejects(
      preflightTeamTaskWrites({
        args: {
          intent: "patch",
          spec: SPEC,
          operations: [{ kind: "replace_task_links", document: "TASKS.md", entity: TASK_ID, teamId: TEAM_ID, requirements: [] }],
        },
        ctx: context(),
        project: PROJECT,
        store: registry({ binding: { project: PROJECT, spec: SPEC, taskId: TASK_ID, teamId: TEAM_ID } }),
        authoringService: authoringService(),
      }),
      { code: "TEAM_REQUIREMENT_REQUIRED" },
    );
  });

  it("refuses whole-document edits that would bypass a shared task id", async () => {
    await assert.rejects(
      preflightTeamTaskWrites({
        args: { intent: "deleteSpecDoc", spec: SPEC, doc: "TASKS.md" },
        ctx: context(),
        project: PROJECT,
        store: registry(),
        authoringService: authoringService(),
      }),
      { code: "TEAM_TASK_OPERATION_REQUIRED" },
    );
  });

});
