import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { createSpecService } from "../../src/adapters/query-service.js";
import { createDispatcher } from "../../src/service/dispatch.js";
import { createStore } from "../../src/service/ledger.js";
import { scopeFromContext } from "../../src/service/scope.js";
import { createTeamTaskReads } from "../../src/service/team-task-reads.js";

const PROJECT = "stgmt/alpha";
const SPEC = "shared-spec";
const TEAM_A = "9f6efbbb-9fbb-4fb0-8c37-4424a649bac9";
const TEAM_B = "4f3eb914-fd36-4b52-a51d-9901c790da18";
const OWNER_A = JSON.stringify(["default", "alice"]);
const OWNER_B = JSON.stringify(["default", "bob"]);
const directories = [];
const stores = [];

afterEach(async () => {
  for (const store of stores.splice(0)) store.close?.();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function context(userId) {
  return {
    identity: { userId },
    idp: "default",
    role: "reader",
    scope: scopeFromContext({ scopes: [PROJECT] }),
  };
}

async function registerTeam(store, teamId, ownerPrincipal) {
  const createdAt = new Date().toISOString();
  await store.registerTeamSpecsTeam({
    teamId,
    ownerPrincipal,
    requestId: `register-${teamId}`,
    payload: JSON.stringify({ action: "register", project: PROJECT }),
    project: PROJECT,
    createdAt,
  });
  const payload = JSON.stringify({ action: "link", teamId, project: PROJECT, spec: SPEC });
  await store.applyTeamSpecsBinding({
    teamId,
    ownerPrincipal,
    requestId: `link-${teamId}`,
    payload,
    action: "link",
    project: PROJECT,
    spec: SPEC,
    createdAt,
    allowedProjects: [PROJECT],
  });
}

describe("team-authorized spec_tasks reads", () => {
  it("filters by persistent team-task bindings before pagination, not by Tracking", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "team-task-read-"));
    directories.push(directory);
    const root = path.join(directory, "repo");
    const specRoot = path.join(root, ".specs", SPEC);
    await mkdir(specRoot, { recursive: true });
    await writeFile(path.join(specRoot, "FR.md"), [
      "# Functional Requirements",
      "",
      "## FR-1 — Shared capability",
      "Every team task in this fixture can reference this requirement.",
      "",
    ].join("\n"));
    await writeFile(path.join(specRoot, "TASKS.md"), [
      "# Tasks",
      "",
      "## TASK-1 — Directly assigned to team A",
      "",
      "**Status:** todo",
      "",
      "**Requirements:** [FR-1](FR.md#fr-1-shared-capability)",
      "",
      "## TASK-2 — Assigned to team B but marked as team A",
      "",
      "**Status:** todo",
      "",
      "**Tracking:** agent-teams:team-a",
      "",
      "**Requirements:** [FR-1](FR.md#fr-1-shared-capability)",
      "",
      "## TASK-3 — Unassigned but marked as team A",
      "",
      "**Status:** todo",
      "",
      "**Tracking:** agent-teams:team-a",
      "",
      "**Requirements:** [FR-1](FR.md#fr-1-shared-capability)",
      "",
    ].join("\n"));

    const store = await createStore({ file: path.join(directory, "registry.db") });
    stores.push(store);
    await registerTeam(store, TEAM_A, OWNER_A);
    await registerTeam(store, TEAM_B, OWNER_B);
    const createdAt = new Date().toISOString();
    await store.applyTeamSpecsTaskBindings({
      action: "bind",
      bindings: [
        { teamId: TEAM_A, ownerPrincipal: OWNER_A, project: PROJECT, spec: SPEC, taskId: "TASK-1", createdAt },
        { teamId: TEAM_B, ownerPrincipal: OWNER_B, project: PROJECT, spec: SPEC, taskId: "TASK-2", createdAt },
      ],
    });

    const queryService = createSpecService(root);
    const mounts = {
      requireConfigured() {},
      requireRepoReady() {},
      serviceFor() { return queryService; },
    };
    const reads = createTeamTaskReads({ store, mounts });
    const dispatcher = createDispatcher({ mounts, wrappers: { tasks: reads.tasks } });
    const call = (args, userId) => dispatcher.callTool({ tool: "spec_tasks", args: { project: PROJECT, spec: SPEC, ...args }, ctx: context(userId) });

    const teamA = await call({ teamId: TEAM_A }, "alice");
    assert.equal(teamA.envelope.ok, true, JSON.stringify(teamA.envelope.error));
    assert.deepEqual(teamA.envelope.data.tasks.map((task) => task.localId), ["TASK-1"]);

    const teamB = await call({ teamId: TEAM_B, limit: 1 }, "bob");
    assert.equal(teamB.envelope.ok, true, JSON.stringify(teamB.envelope.error));
    assert.deepEqual(teamB.envelope.data.tasks.map((task) => task.localId), ["TASK-2"]);
    assert.equal(teamB.envelope.page.totalMatched, 1, "ownership filtering occurs before pagination");

    const generic = await call({}, "alice");
    assert.equal(generic.envelope.ok, true, JSON.stringify(generic.envelope.error));
    assert.deepEqual(generic.envelope.data.tasks.map((task) => task.localId), ["TASK-1", "TASK-2", "TASK-3"]);

    const foreignOwner = await call({ teamId: TEAM_A }, "bob");
    assert.equal(foreignOwner.envelope.ok, false);
    assert.equal(foreignOwner.envelope.error.code, "TEAM_ACCESS_DENIED");

    const directAdapterBypass = await queryService.runQuery("tasks", { spec: SPEC, teamId: TEAM_A });
    assert.equal(directAdapterBypass.ok, false);
    assert.equal(directAdapterBypass.error.code, "TEAM_TASK_FILTER_REQUIRED");
  });
});
