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
import { TOOL_CONTRACTS } from "../src/adapters/tool-contracts.js";

const run = promisify(execFile);
const temporary = [];
after(async () => {
  for (const dir of temporary) await rm(dir, { recursive: true, force: true });
});

function fakeStore(state = {}) {
  return {
    state,
    getRegistration: (project) => (state.registration?.project === project ? state.registration : null),
    listRegistrations: ({ registeredBy = null } = {}) => {
      const rows = state.registration ? [state.registration] : [];
      return registeredBy === null ? rows : rows.filter((row) => row.registeredBy === registeredBy);
    },
    putRegistration: (registration) => {
      state.registration = registration;
      state.registrationWrites = (state.registrationWrites ?? 0) + 1;
    },
    getBinding: (project) => (state.binding?.project === project ? state.binding : null),
    putBinding: (binding) => {
      state.binding = binding;
      state.bindingWrites = (state.bindingWrites ?? 0) + 1;
    },
    putCredential: () => {
      state.credentialWrites = (state.credentialWrites ?? 0) + 1;
    },
    deleteBinding: () => {},
    deleteCredential: () => {},
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
    const error = await rejection(manager({ store }).register({
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
    const error = await rejection(manager({ store }).register({
      ctx: { role: "writer", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "FORBIDDEN_ROLE");
  });

  it("refuses a malformed project id", async () => {
    const store = fakeStore();
    const error = await rejection(manager({ store }).register({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "PROJECT_ID_INVALID");
  });

  it("refuses to take over a project another principal registered", async () => {
    const store = fakeStore({ registration: { project: "acme/widgets", registeredBy: "bob", repoUrl: "https://example.invalid/acme/widgets.git", branch: "main", status: "active" } });
    const error = await rejection(manager({ store }).register({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/alice/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "PROJECT_ALREADY_REGISTERED");
  });

  it("refuses a project the operator already configured", async () => {
    const store = fakeStore();
    const error = await rejection(manager({ store, config: { projects: ["acme/widgets"] } }).register({
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
    }).register({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl: "https://example.invalid/acme/widgets.git",
      token: "x",
    }));
    assert.equal(error.code, "PROJECT_ALREADY_CONFIGURED");
  });

  it("refuses a project that already has a binding, so ids cannot be hijacked", async () => {
    const store = fakeStore({ binding: { project: "acme/widgets", repoUrl: "https://example.invalid/acme/widgets.git", branch: "main", status: "active" } });
    const error = await rejection(manager({ store }).register({
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
    const result = await manager({ store, mounts: { ensureMount: async () => { mounted = true; } } }).register({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl,
      branch: "main",
      token: "x",
    });
    assert.equal(result.unchanged, true);
    assert.equal(result.credential.repository, "verified");
    assert.equal(mounted, false, "an idempotent re-registration must not touch the remote");
    assert.equal(store.state.registrationWrites ?? 0, 0);
  });

  it("registers a project, binds it and records who did it", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "spec-kit-registration-"));
    temporary.push(dir);
    const bare = path.join(dir, "widgets.git");
    await run("git", ["init", "--bare", "--initial-branch=main", bare]);
    const repoUrl = pathToFileURL(bare).href;
    const store = fakeStore();
    const result = await manager({ store, config: { projects: [], repoPolicy: { allowedHosts: ["file"] } } }).register({
      ctx: { role: "owner", identity: { login: "alice" } },
      project: "acme/widgets",
      repoUrl,
      token: "file-token",
      username: "alice",
    });
    assert.equal(result.unchanged, false);
    assert.equal(result.registration.project, "acme/widgets");
    assert.equal(result.registration.registeredBy, "alice");
    assert.equal(result.binding.status, "active");
    assert.equal(store.state.credentialWrites, 1, "the credential is sealed into the store");
    assert.equal(store.state.registrationWrites, 1);
    assert.equal(store.state.audit.at(-1).op, "project-register");
    assert.match(store.state.audit.at(-1).result, /^ok:registered:/u);
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
