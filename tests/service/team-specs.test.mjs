import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { createDispatcher } from "../../src/service/dispatch.js";
import { createStore } from "../../src/service/ledger.js";
import { createTeamSpecsOps, TEAM_SPECS_CONTRACTS } from "../../src/service/ops/team-specs.js";
import { scopeFromContext } from "../../src/service/scope.js";

const PROJECT_A = "stgmt/alpha";
const PROJECT_B = "stgmt/beta";
const stores = [];
const directories = [];

async function storeAt(file) {
  const store = await createStore({ file });
  stores.push(store);
  return store;
}

function context({ userId = "alice-id", role = "owner", projects = [PROJECT_A, PROJECT_B], defaultScope = null } = {}) {
  return {
    identity: { userId },
    idp: "default",
    role,
    scope: scopeFromContext({ scopes: projects, defaultScope }),
  };
}

function dispatcherFor(store) {
  const mounts = {
    requireConfigured() {},
    requireRepoReady() {},
    async listBranches(project) {
      if (project === PROJECT_A) return { branches: [{ kind: "spec", spec: "spec-real" }] };
      if (project === PROJECT_B) return { branches: [{ kind: "spec", spec: "spec-other" }] };
      return { branches: [] };
    },
  };
  return createDispatcher({
    mounts,
    serviceOps: createTeamSpecsOps({ store, mounts }),
    serviceContracts: TEAM_SPECS_CONTRACTS,
  });
}

function call(dispatcher, args, ctx = context()) {
  return dispatcher.callTool({ tool: "team_specs", args, ctx });
}

function data(result) {
  assert.equal(result.envelope.ok, true, JSON.stringify(result.envelope.error));
  return result.envelope.data;
}

function errorCode(result) {
  assert.equal(result.envelope.ok, false, "expected a refusal");
  return result.envelope.error.code;
}

afterEach(async () => {
  for (const store of stores.splice(0)) store.close?.();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("team_specs authoritative server registry", () => {
  for (const driver of ["sqlite-or-default", "existing-json"]) {
    it(`persists registry identity and fences registration for ${driver}`, async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "team-identity-"));
      directories.push(directory);
      const file = path.join(directory, "registry.db");
      if (driver === "existing-json") {
        await writeFile(`${file}.json`, JSON.stringify({
          claims: [], ledger: [], access_log: [], repo_bindings: [], repo_credentials: [],
          idp_bindings: [], idp_credentials: [], teams: [], teamSpecBindings: [],
          teamSpecRequests: [], teamTaskBindings: [{ project: PROJECT_A, spec: "spec-real", taskId: "TASK-42", teamId: "old-team", linkedAt: "old" }],
        }));
      }
      const store = await storeAt(file);
      const dispatcher = dispatcherFor(store);
      const identityRequest = { action: "identity", project: PROJECT_A, requestId: "identity-1" };
      const identity = data(await call(dispatcher, identityRequest));
      assert.match(identity.securityStoreId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
      assert.equal(identity.idp, "default");
      assert.equal(identity.userId, "alice-id");
      const expected = {
        expectedSecurityStoreId: identity.securityStoreId,
        expectedIdp: identity.idp,
        expectedUserId: identity.userId,
      };
      const register = { action: "register", project: PROJECT_A, requestId: "identity-register", ...expected };
      assert.equal(errorCode(await call(dispatcher, { ...register, expectedUserId: "bob-id" })), "TEAM_IDENTITY_MISMATCH");
      assert.equal(errorCode(await call(dispatcher, { ...register, expectedIdp: "" })), "INVALID_REQUEST");
      const partial = { ...register };
      delete partial.expectedIdp;
      assert.equal(errorCode(await call(dispatcher, partial)), "INVALID_REQUEST");
      assert.equal(errorCode(await call(dispatcher, register, context({ userId: "bob-id" }))), "TEAM_IDENTITY_MISMATCH");
      const registered = data(await call(dispatcher, register));
      assert.deepEqual({ securityStoreId: registered.securityStoreId, idp: registered.idp, userId: registered.userId }, identity);
      assert.deepEqual(registered.bindings, []);
      store.close?.();
      stores.splice(stores.indexOf(store), 1);
      const reopened = await storeAt(file);
      const afterRestart = dispatcherFor(reopened);
      assert.deepEqual(data(await call(afterRestart, identityRequest)), identity);
      assert.deepEqual(data(await call(afterRestart, register)), registered);
      assert.equal(errorCode(await call(afterRestart, {
        action: "list", teamId: registered.teamId, requestId: "other-user-list",
      }, context({ userId: "bob-id" }))), "TEAM_ACCESS_DENIED");
      if (driver === "existing-json") {
        const persisted = JSON.parse(await readFile(`${file}.json`, "utf8"));
        assert.equal(persisted.teamTaskBindings[0].taskId, "TASK-42");
      }
    });
  }

  it("registers a server-issued team id and durably replays its request after restart", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "team-specs-"));
    directories.push(directory);
    const file = path.join(directory, "registry.db");
    const store = await storeAt(file);
    const dispatcher = dispatcherFor(store);
    const request = { action: "register", project: PROJECT_A, requestId: "team-register-1" };

    const first = data(await call(dispatcher, request));
    assert.match(first.teamId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    assert.deepEqual(first.bindings, []);

    store.close();
    stores.splice(stores.indexOf(store), 1);
    const reopened = await storeAt(file);
    const recovered = data(await call(dispatcherFor(reopened), request));
    assert.deepEqual(recovered, first);
  });

  it("links only an existing scoped project spec and returns authoritative bindings", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "team-specs-"));
    directories.push(directory);
    const store = await storeAt(path.join(directory, "registry.db"));
    const dispatcher = dispatcherFor(store);
    const created = data(await call(dispatcher, { action: "register", project: PROJECT_A, requestId: "team-register-2" }));
    const link = { action: "link", teamId: created.teamId, project: PROJECT_A, spec: "spec-real", requestId: "team-link-1" };

    const linked = data(await call(dispatcher, link));
    assert.deepEqual(linked, { teamId: created.teamId, bindings: [{ project: PROJECT_A, spec: "spec-real" }] });
    assert.deepEqual(
      await store.listTeamSpecsTeamsForBinding({ project: PROJECT_A, spec: "spec-real" }),
      [{ teamId: created.teamId, ownerPrincipal: JSON.stringify(["default", "alice-id"]) }],
    );
    assert.deepEqual(data(await call(dispatcher, link)), linked, "replaying a request keeps one binding and returns current state");

    const listed = data(await call(dispatcher, { action: "list", teamId: created.teamId, requestId: "team-list-1" }));
    assert.deepEqual(listed, linked);
    const unlinked = data(await call(dispatcher, {
      action: "unlink", teamId: created.teamId, project: PROJECT_A, spec: "spec-real", requestId: "team-unlink-1",
    }));
    assert.deepEqual(unlinked, { teamId: created.teamId, bindings: [] });
  });

  it("rechecks unique team assignment atomically when task binding commits", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "team-specs-"));
    directories.push(directory);
    const store = await storeAt(path.join(directory, "registry.db"));
    const dispatcher = dispatcherFor(store);
    const first = data(await call(dispatcher, { action: "register", project: PROJECT_A, requestId: "team-register-inferred-1" }));
    const second = data(await call(dispatcher, { action: "register", project: PROJECT_A, requestId: "team-register-inferred-2" }));
    data(await call(dispatcher, {
      action: "link", teamId: first.teamId, project: PROJECT_A, spec: "spec-real", requestId: "team-link-inferred-1",
    }));
    const inferredBinding = {
      teamId: first.teamId,
      ownerPrincipal: JSON.stringify(["default", "alice-id"]),
      project: PROJECT_A,
      spec: "spec-real",
      taskId: "TASK-9",
      createdAt: new Date().toISOString(),
      requireUnambiguous: true,
    };
    data(await call(dispatcher, {
      action: "link", teamId: second.teamId, project: PROJECT_A, spec: "spec-real", requestId: "team-link-inferred-2",
    }));

    await assert.rejects(
      async () => store.applyTeamSpecsTaskBindings({ action: "bind", bindings: [inferredBinding] }),
      { code: "TEAM_ID_REQUIRED" },
    );
    assert.equal(await store.getTeamSpecsTaskBinding(inferredBinding), null);
  });

  it("refuses to unlink a spec while its team has registered shared tasks", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "team-specs-"));
    directories.push(directory);
    const store = await storeAt(path.join(directory, "registry.db"));
    const dispatcher = dispatcherFor(store);
    const created = data(await call(dispatcher, { action: "register", project: PROJECT_A, requestId: "team-register-task-bound" }));
    const link = { action: "link", teamId: created.teamId, project: PROJECT_A, spec: "spec-real", requestId: "team-link-task-bound" };
    data(await call(dispatcher, link));
    const taskBinding = {
      teamId: created.teamId,
      ownerPrincipal: JSON.stringify(["default", "alice-id"]),
      project: PROJECT_A,
      spec: "spec-real",
      taskId: "TASK-1",
      createdAt: new Date().toISOString(),
    };
    await store.applyTeamSpecsTaskBindings({ action: "bind", bindings: [taskBinding] });
    assert.deepEqual(
      (await store.listTeamSpecsTaskBindings({ teamId: created.teamId, project: PROJECT_A, spec: "spec-real" })).map((binding) => binding.taskId),
      ["TASK-1"],
    );

    assert.equal(errorCode(await call(dispatcher, {
      action: "unlink", teamId: created.teamId, project: PROJECT_A, spec: "spec-real", requestId: "team-unlink-task-bound",
    })), "TEAM_TASKS_STILL_BOUND");
    assert.deepEqual(data(await call(dispatcher, { action: "list", teamId: created.teamId, requestId: "team-list-task-bound" })).bindings, [
      { project: PROJECT_A, spec: "spec-real" },
    ]);
  });

  it("requires the registering authenticated principal and project scope, not a supplied UUID", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "team-specs-"));
    directories.push(directory);
    const store = await storeAt(path.join(directory, "registry.db"));
    const dispatcher = dispatcherFor(store);
    const created = data(await call(dispatcher, { action: "register", project: PROJECT_A, requestId: "team-register-3" }));

    const otherPrincipal = context({ userId: "bob-id" });
    assert.equal(errorCode(await call(dispatcher, {
      action: "list", teamId: created.teamId, requestId: "team-list-2",
    }, otherPrincipal)), "TEAM_ACCESS_DENIED");

    assert.equal(errorCode(await call(dispatcher, {
      action: "link", teamId: created.teamId, project: PROJECT_B, spec: "spec-other", requestId: "team-link-out-of-scope",
    }, context({ projects: [PROJECT_A], defaultScope: PROJECT_A }))), "PROJECT_NOT_ALLOWED");

    assert.equal(errorCode(await call(dispatcher, {
      action: "list", teamId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", requestId: "team-list-random",
    })), "TEAM_ACCESS_DENIED");
  });

  it("rejects missing project specs and conflicting requestId reuse without creating bindings", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "team-specs-"));
    directories.push(directory);
    const store = await storeAt(path.join(directory, "registry.db"));
    const dispatcher = dispatcherFor(store);
    const created = data(await call(dispatcher, { action: "register", project: PROJECT_A, requestId: "team-register-4" }));

    assert.equal(errorCode(await call(dispatcher, {
      action: "link", teamId: created.teamId, project: PROJECT_A, spec: "spec-absent", requestId: "team-link-missing",
    })), "SPEC_NOT_FOUND");

    const link = { action: "link", teamId: created.teamId, project: PROJECT_A, spec: "spec-real", requestId: "team-link-2" };
    data(await call(dispatcher, link));
    assert.equal(errorCode(await call(dispatcher, {
      ...link, spec: "spec-absent",
    })), "TEAM_REQUEST_ID_REUSED");
    assert.deepEqual(data(await call(dispatcher, { action: "list", teamId: created.teamId, requestId: "team-list-3" })).bindings, [
      { project: PROJECT_A, spec: "spec-real" },
    ]);
  });
});
