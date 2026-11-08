import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { after, describe, it } from "node:test";
import { createServiceApp } from "../src/service/http.js";
import { RequestScope, scopeFromContext } from "../src/service/scope.js";
import { createRepoManager } from "../src/service/repos.js";
import { secretsKeyFromEnv } from "../src/service/secrets.js";
import { createDispatcher } from "../src/service/dispatch.js";
import { REPO_CONTRACTS } from "../src/service/ops/repos.js";
import { createRegistrationJobs } from "../src/service/registration-jobs.js";
import { TOOL_CONTRACTS } from "../src/adapters/tool-contracts.js";

const run = promisify(execFile);
const temporary = [];
after(async () => {
  for (const dir of temporary) await rm(dir, { recursive: true, force: true });
});

function fakeStore(state = {}) {
  state.registrations ??= {};
  state.bindings ??= {};
  state.credentials ??= {};
  state.phases ??= [];
  if (state.registration) {
    state.registrations[state.registration.project] = state.registration;
    delete state.registration;
  }
  if (state.binding) {
    state.bindings[state.binding.project] = state.binding;
    delete state.binding;
  }
  return {
    state,
    getRegistration: (project) => state.registrations[project] ?? null,
    listRegistrations: ({ registeredBy = null } = {}) => {
      const rows = Object.values(state.registrations);
      return registeredBy === null ? rows : rows.filter((row) => row.registeredBy === registeredBy);
    },
    putRegistration: (row) => {
      state.registrations[row.project] = { ...(state.registrations[row.project] ?? {}), ...row };
      state.registrationWrites = (state.registrationWrites ?? 0) + 1;
      return state.registrations[row.project];
    },
    updateRegistration: (project, patch) => {
      const current = state.registrations[project];
      if (current === undefined) return null;
      state.registrations[project] = { ...current, ...patch };
      if (patch.phase) state.phases.push(patch.phase);
      return state.registrations[project];
    },
    getBinding: (project) => state.bindings[project] ?? null,
    putBinding: (binding) => {
      state.bindings[binding.project] = { ...(state.bindings[binding.project] ?? {}), ...binding };
      state.bindingWrites = (state.bindingWrites ?? 0) + 1;
    },
    putCredential: (project, credential) => {
      state.credentials[project] = credential;
      state.credentialWrites = (state.credentialWrites ?? 0) + 1;
    },
    getCredential: (project) => state.credentials[project] ?? null,
    deleteBinding: (project) => {
      delete state.bindings[project];
    },
    deleteCredential: (project) => {
      delete state.credentials[project];
    },
    logAccess: (entry) => {
      state.audit = [...(state.audit ?? []), entry];
    },
  };
}

function manager({ store, config = {}, mounts = {} } = {}) {
  return createRepoManager({
    mounts: {
      clonesRoot: path.join(tmpdir(), "spec-kit-probe-root"),
      descriptorFor: (repoUrl, branch, auth) => ({ key: `${repoUrl}#${branch}`, repoUrl, branch, auth }),
      ensureMount: async () => {},
      projectRoot: async () => path.join(tmpdir(), "spec-kit-probe-root"),
      ...mounts,
    },
    store,
    config,
    identity: { name: "bot", email: "bot@example.invalid" },
    secretsKey: secretsKeyFromEnv({ SPEC_REGISTRY_SECRETS_KEY: "project-registration-test-key" }),
    logger: () => {},
  });
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
}

describe("project refusals name the way out", () => {
  it("PROJECT_NOT_ALLOWED carries the allowed set and one registration action", () => {
    const scope = new RequestScope({ projects: ["acme/existing"] });
    const decision = scope.resolve({ explicitProject: "acme/unknown" });
    assert.equal(decision.error.code, "PROJECT_NOT_ALLOWED");
    assert.deepEqual(decision.error.extra.candidates, ["acme/existing"]);
    assert.equal(decision.error.extra.causeCode, "PROJECT_NOT_REGISTERED");
    assert.match(decision.error.extra.nextAction, /"action":"register"/u);
    assert.match(decision.error.extra.nextAction, /acme\/unknown/u);
    assert.match(decision.error.message, /allowed: acme\/existing/u);
  });

  it("a caller with no project at all still learns how to register one", () => {
    const decision = new RequestScope({ projects: [] }).resolve({});
    assert.equal(decision.error.code, "PROJECT_REQUIRED");
    assert.deepEqual(decision.error.extra.candidates, []);
    assert.equal(decision.error.extra.causeCode, "PROJECT_NOT_REGISTERED");
    assert.match(decision.error.extra.nextAction, /"action":"register"/u);
  });

  it("a listing is still allowed without a selected project", () => {
    const scope = new RequestScope({ projects: ["acme/one", "acme/two"] });
    assert.deepEqual(scopeFromContext({ scopes: ["acme/one"] }).resolve({ listing: true }), { allScopes: true, source: null });
    assert.equal(scope.resolve({ listing: true }).allScopes, true);
  });
});

describe("self-service registration gate", () => {
  it("refuses an external-IdP caller before anything else", async () => {
    const store = fakeStore();
    const error = await rejection(manager({ store }).registerStart({
      ctx: { role: "owner", idp: { tenant: "customer" }, identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "FORBIDDEN_IDP");
    assert.equal(store.state.bindingWrites ?? 0, 0);
  });

  it("refuses a writer: creating a project is an owner act", async () => {
    const store = fakeStore();
    const error = await rejection(manager({ store }).registerStart({
      ctx: { role: "writer", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "FORBIDDEN_ROLE");
  });

  it("refuses a malformed project id", async () => {
    const store = fakeStore();
    const error = await rejection(manager({ store }).registerStart({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "PROJECT_ID_INVALID");
  });

  it("refuses to take over a project another principal registered", async () => {
    const store = fakeStore({ registration: { project: "acme/widgets", registeredBy: "bob", repoUrl: "https://example.invalid/acme/widgets.git", branch: "main", status: "active" } });
    const error = await rejection(manager({ store }).registerStart({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/alice/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "PROJECT_ALREADY_REGISTERED");
  });

  it("refuses a project the operator already configured", async () => {
    const store = fakeStore();
    const error = await rejection(manager({ store, config: { projects: ["acme/widgets"] } }).registerStart({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "PROJECT_ALREADY_CONFIGURED");
  });

  it("refuses a project an external tenant already claims", async () => {
    const store = fakeStore();
    const error = await rejection(manager({
      store,
      mounts: { isExternalProject: (project) => project === "acme/widgets" },
    }).registerStart({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "PROJECT_ALREADY_CONFIGURED");
  });

  it("refuses a project that already has a binding, so ids cannot be hijacked", async () => {
    const store = fakeStore({ binding: { project: "acme/widgets", repoUrl: "https://example.invalid/acme/widgets.git", branch: "main", status: "active" } });
    const error = await rejection(manager({ store }).registerStart({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/alice/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "PROJECT_ALREADY_BOUND");
  });

  it("re-registering the same repository is an idempotent no-op", async () => {
    const repoUrl = "https://example.invalid/acme/widgets.git";
    const store = fakeStore({
      registration: { project: "acme/widgets", registeredBy: "alice", repoUrl, branch: "main", status: "active" },
      binding: { project: "acme/widgets", repoUrl, branch: "main", status: "active" },
    });
    let mounted = false;
    const started = await manager({ store, mounts: { ensureMount: async () => { mounted = true; } } }).registerStart({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl,
      branch: "main",
      token: "x",
    });
    assert.equal(started.job, null, "nothing to run");
    assert.equal(started.data.unchanged, true);
    assert.equal(started.data.pending, false);
    assert.equal(started.data.credential.repository, "verified");
    assert.equal(mounted, false, "an idempotent re-registration must not touch the remote");
    assert.equal(store.state.registrationWrites ?? 0, 0);
    assert.equal(store.state.credentialWrites ?? 0, 0, "no credential is re-sealed for a no-op");
  });

  it("queues the work and reports the phase instead of blocking on the clone", async () => {
    const store = fakeStore();
    const mgr = manager({ store, config: { projects: [], repoPolicy: { allowedHosts: ["example.invalid"] } } });
    const args = {
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
      username: "alice",
    };
    const first = await mgr.registerStart(args);
    assert.equal(first.data.pending, true);
    assert.equal(first.data.registration.status, "pending");
    assert.equal(first.data.progress.phase, "queued");
    assert.match(first.data.nextAction, /"action":"status"/u);
    assert.ok(first.job, "the job input is returned to the runner, never to the caller");
    assert.equal(store.state.credentialWrites, 1, "the credential is sealed before the work starts, so a restart can resume");

    const again = await mgr.registerStart(args);
    assert.equal(again.job, null, "a queued registration does not queue a second clone");
    assert.equal(again.data.pending, true);
    assert.equal(again.data.unchanged, true);
  });

  it("registers a project, binds it, records who did it and leaves the row active", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "spec-kit-registration-"));
    temporary.push(dir);
    const bare = path.join(dir, "widgets.git");
    await run("git", ["init", "--bare", "--initial-branch=main", bare]);
    const repoUrl = pathToFileURL(bare).href;
    const store = fakeStore();
    const mgr = manager({ store, config: { projects: [], repoPolicy: { allowedHosts: ["file"] } } });
    const started = await mgr.registerStart({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl,
      token: "file-token",
      username: "alice",
    });
    assert.equal(started.data.pending, true);
    const view = await mgr.registerRun(started.job);
    assert.equal(view.registration.status, "active");
    assert.equal(view.registration.project, "acme/widgets");
    assert.equal(view.registration.registeredBy, "alice");
    assert.equal(view.binding.status, "active");
    assert.equal(view.pending, false);
    assert.equal(store.state.credentialWrites, 2, "sealed when queued, re-affirmed when bound");
    assert.equal(store.state.registrationWrites, 1, "queued once; later transitions are progress updates");
    assert.equal(store.state.audit.at(-1).op, "project-register");
    assert.match(store.state.audit.at(-1).result, /^ok:registered:/u);
    assert.deepEqual(store.state.phases.filter((phase) => phase === "mirroring"), ["mirroring"], "the long phase is reported before the wait");

    const status = mgr.registrationStatus({ project: "acme/widgets" });
    assert.equal(status.pending, false);
    assert.equal(status.progress.phase, "active");
    assert.equal(status.registration.status, "active");
  });

  it("turns a failed run into an error row with the reason", async () => {
    const store = fakeStore();
    const mgr = manager({ store, config: { projects: [], repoPolicy: { allowedHosts: ["example.invalid"] } } });
    const started = await mgr.registerStart({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/missing.git",
      token: "x",
    });
    let failure = null;
    try {
      await mgr.registerRun(started.job);
    } catch (error) {
      failure = error;
    }
    assert.ok(failure, "the run rejects so the job logs it");
    const status = mgr.registrationStatus({ project: "acme/widgets" });
    assert.equal(status.registration.status, "error");
    assert.equal(status.registration.phase, "error");
    assert.equal(status.pending, false);
    assert.match(status.nextAction, /"action":"register"/u);
    assert.match(status.credential.repair, /"action":"register"/u);
  });
});

describe("dispatch: registration and diagnosis for an unknown project", () => {
  function registrationDispatcher(onRun) {
    return createDispatcher({
      mounts: {
        requireConfigured: () => { throw new Error("the scope gate must not run for a registration"); },
        requireRepoReady: () => {},
        serviceFor: () => { throw new Error("no corpus access during registration"); },
      },
      serviceOps: {
        specRepo: {
          listing: false,
          async run({ args, ctx, project }) {
            onRun({ action: args.action, project, login: ctx.identity?.login ?? null });
            return { envelope: { schemaVersion: "spec-kernel@2", requestId: null, operation: "specRepo", ok: true, graph: null, page: null, data: { ok: true }, error: null, diagnostics: [], provenance: null } };
          },
        },
      },
      serviceContracts: REPO_CONTRACTS,
    });
  }

  it("passes the unknown project through to the handler for an owner", async () => {
    const seen = [];
    const dispatcher = registrationDispatcher((entry) => seen.push(entry));
    const ctx = { role: "owner", scopes: [], identity: { login: "alice" }, defaultScope: null };
    const result = await dispatcher.callTool({
      tool: "spec_repo",
      args: { schemaVersion: "spec-kernel@2", project: "acme/widgets", action: "register", repoUrl: "https://example.invalid/acme/widgets.git", token: "x" },
      ctx: { ...ctx, scope: scopeFromContext(ctx) },
    });
    assert.equal(result.envelope.ok, true);
    assert.deepEqual(seen, [{ action: "register", project: "acme/widgets", login: "alice" }]);
  });

  it("still refuses an unknown project for a non-registration action", async () => {
    const dispatcher = registrationDispatcher(() => { throw new Error("handler must not run"); });
    const ctx = { role: "owner", scopes: [], identity: { login: "alice" }, defaultScope: null };
    const result = await dispatcher.callTool({
      tool: "spec_repo",
      args: { schemaVersion: "spec-kernel@2", project: "acme/widgets", action: "bind", repoUrl: "https://example.invalid/acme/widgets.git", token: "x" },
      ctx: { ...ctx, scope: scopeFromContext(ctx) },
    });
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.error.code, "PROJECT_NOT_ALLOWED");
    assert.match(result.envelope.error.nextAction, /"action":"register"/u);
  });

  it("preflight answers for an unregistered project when the caller is an owner", async () => {
    let seen = null;
    const dispatcher = createDispatcher({
      mounts: { requireConfigured: () => { throw new Error("preflight must not require a configuration"); } },
      wrappers: {
        mcpPreflight: async ({ project }) => {
          seen = project;
          return { envelope: { schemaVersion: "spec-kernel@2", requestId: null, operation: "mcpPreflight", ok: true, graph: null, page: null, data: { setup: { required: true } }, error: null, diagnostics: [], provenance: null } };
        },
      },
      serviceContracts: TOOL_CONTRACTS,
    });
    const owner = { role: "owner", scopes: [], identity: { login: "alice" }, defaultScope: null };
    const result = await dispatcher.callTool({
      tool: "mcp_preflight",
      args: { schemaVersion: "spec-kernel@2", project: "acme/widgets" },
      ctx: { ...owner, scope: scopeFromContext(owner) },
    });
    assert.equal(result.envelope.ok, true);
    assert.equal(seen, "acme/widgets");
  });

  it("preflight still refuses an unknown project for a writer", async () => {
    const dispatcher = createDispatcher({
      mounts: {},
      wrappers: { mcpPreflight: async () => { throw new Error("must not run"); } },
      serviceContracts: TOOL_CONTRACTS,
    });
    const writer = { role: "writer", scopes: [], identity: { login: "bob" }, defaultScope: null };
    const result = await dispatcher.callTool({
      tool: "mcp_preflight",
      args: { schemaVersion: "spec-kernel@2", project: "acme/widgets" },
      ctx: { ...writer, scope: scopeFromContext(writer) },
    });
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.error.code, "PROJECT_NOT_ALLOWED");
  });

  it("the hosted transport never serves a corpus from a worktree path", async () => {
    const dispatcher = createDispatcher({ mounts: {}, serviceContracts: TOOL_CONTRACTS });
    const ctx = { role: "owner", scopes: ["acme/known"], identity: { login: "alice" }, defaultScope: null };
    const result = await dispatcher.callTool({
      tool: "spec_catalog",
      args: { schemaVersion: "spec-kernel@2", project: "acme/known", declaredWorktree: "E:/work/acme", view: "specs" },
      ctx: { ...ctx, scope: scopeFromContext(ctx) },
    });
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.error.code, "WORKTREE_ROUTING_UNSUPPORTED");
  });
});

describe("the auth boundary widens a scope with the caller's own registrations only", () => {
  async function scopesFor(login) {
    const app = createServiceApp({
      mounts: {
        registeredProjectsBy: (who) => (who === "alice" ? ["acme/widgets"] : []),
        configuredProjects: () => ["acme/widgets"],
        boot: async () => ({}),
      },
      authenticate: async () => ({ identity: { login }, role: "owner", scopes: ["acme/existing"], defaultScope: null }),
      serviceOps: {},
      serviceContracts: [],
      endpoints: { me: (ctx) => ({ login: ctx.identity.login, scopes: ctx.scope.projects }) },
    });
    const server = app.listen(0);
    await once(server, "listening");
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/me`, { headers: { authorization: "Bearer test" } });
      assert.equal(response.status, 200);
      return (await response.json()).scopes.sort();
    } finally {
      server.close();
    }
  }

  it("adds the project the caller registered", async () => {
    assert.deepEqual(await scopesFor("alice"), ["acme/existing", "acme/widgets"]);
  });

  it("leaves another login's scope untouched", async () => {
    assert.deepEqual(await scopesFor("bob"), ["acme/existing"]);
  });
});

describe("registration jobs fence duplicates and resume after a restart", () => {
  it("runs one job per project and reports it as running", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const seen = [];
    const jobs = createRegistrationJobs({
      repos: { registerRun: async ({ projectId }) => { seen.push(projectId); await gate; } },
      store: fakeStore(),
    });
    assert.equal(jobs.start({ projectId: "acme/widgets" }), true);
    assert.equal(jobs.start({ projectId: "acme/widgets" }), false, "a second start is fenced");
    assert.equal(jobs.isRunning("acme/widgets"), true);
    assert.equal(jobs.runningCount(), 1);
    release();
    await jobs.whenSettled("acme/widgets");
    assert.equal(jobs.isRunning("acme/widgets"), false, "the fence clears once the job settles");
    assert.deepEqual(seen, ["acme/widgets"], "the clone runs once");
  });

  it("logs a failure without leaving an unhandled rejection", async () => {
    const logged = [];
    const jobs = createRegistrationJobs({
      repos: { registerRun: async () => { throw new Error("REPO_BIND_FAILED: boom"); } },
      store: fakeStore(),
      logger: (line) => logged.push(line),
    });
    jobs.start({ projectId: "acme/widgets" });
    await jobs.whenSettled("acme/widgets");
    assert.equal(logged.length, 1);
    assert.match(logged[0], /registration acme\/widgets failed: REPO_BIND_FAILED/u);
    assert.equal(jobs.isRunning("acme/widgets"), false);
  });

  it("resumes queued registrations and fails the ones whose credential is gone", () => {
    const store = fakeStore({
      registrations: {
        "acme/queued": { project: "acme/queued", repoUrl: "https://example.invalid/a.git", branch: "main", status: "pending", phase: "mirroring" },
        "acme/lost": { project: "acme/lost", repoUrl: "https://example.invalid/b.git", branch: "main", status: "pending", phase: "queued" },
        "acme/done": { project: "acme/done", repoUrl: "https://example.invalid/c.git", branch: "main", status: "active", phase: "active" },
      },
    });
    const started = [];
    const failed = [];
    const jobs = createRegistrationJobs({
      repos: {
        registerRun: async (input) => { started.push(input.projectId); },
        registrationInput: (row) => (row.project === "acme/queued" ? { projectId: row.project } : null),
        failRegistration: (project, message) => { failed.push({ project, message }); return {}; },
      },
      store,
    });
    assert.equal(jobs.resume(), 1, "only the resumable pending row starts");
    return jobs.whenSettled("acme/queued").then(() => {
      assert.deepEqual(started, ["acme/queued"]);
      assert.equal(failed.length, 1);
      assert.equal(failed[0].project, "acme/lost");
      assert.match(failed[0].message, /register the project again/u);
    });
  });
});
