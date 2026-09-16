import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { startService } from "../src/service/index.js";
import { createYouTrackAuth } from "../src/service/auth.js";
import { loadLiveFixture } from "./e2e/lib/live-fixture.mjs";
import { ensureExtYoutrack, extBindBody, EXT_TENANT, EXT_YT_HOST_URL, EXT_USERS } from "./e2e/lib/idp-fixture.mjs";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const SECRETS_KEY = "suite-secrets-key-0123456789";
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const servers = [];
const services = [];
const tempDirs = [];
let ext = null;

before(async () => {
  ext = await ensureExtYoutrack({ logger: (m) => console.log(`  ext-yt: ${m}`) });
}, 600_000);

after(async () => {
  for (const service of services) {
    service.sync?.stop();
    service.store?.close?.();
  }
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
});

async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * In-process service against the live fixture: default IdP is the e2e
 * YouTrack (127.0.0.1:8081), the external IdP is youtrack-ext (8082). Auth
 * cache is pinned to 1ms so binding changes take effect on the next call.
 */
async function setup() {
  const fixture = await loadLiveFixture();
  const base = await tempDir("spec-idps-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  // Seed the external tenant's project so catalog/patch have content.
  const seed = path.join(base, "seed");
  await execFileAsync("git", ["clone", bare, seed]);
  await execFileAsync("git", ["-C", seed, "config", "user.email", "seed@example.invalid"]);
  await execFileAsync("git", ["-C", seed, "config", "user.name", "seed"]);
  await cp(FIXTURE_SPEC, path.join(seed, "acme/gamma/.specs", "gamma-spec"), { recursive: true });
  await execFileAsync("git", ["-C", seed, "add", "."]);
  await execFileAsync("git", ["-C", seed, "commit", "-m", "seed"]);
  await execFileAsync("git", ["-C", seed, "push", "-q", "origin", "HEAD:refs/heads/main"]);
  await rm(seed, { recursive: true, force: true });
  // The tenant's own specs repo: a second bare reached through file:// —
  // real clone/push/ls-remote, opted in via repoPolicy like repos.test.mjs.
  const byoBare = path.join(base, "byo.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", byoBare]);
  const byoUrl = pathToFileURL(byoBare).href;
  const config = fixture.serviceConfigFor(bare);
  config.repoPolicy = { allowedHosts: ["file"] };
  const configPath = path.join(base, "projects.json");
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const service = await startService({
    configPath,
    cloneDir: path.join(base, "clone"),
    storeFile: path.join(base, "registry.db"),
    port: 0,
    identity: IDENTITY,
    logger: () => {},
    env: { ...process.env, SPEC_REGISTRY_SECRETS_KEY: SECRETS_KEY, SPEC_REGISTRY_AUTH_CACHE_MS: "1" },
  });
  servers.push(service.server);
  services.push(service);
  const api = `http://127.0.0.1:${service.server.address().port}`;
  return {
    fixture,
    service,
    api,
    url: `${api}/mcp`,
    byoBare,
    byoUrl,
    tokens: {
      alice: await fixture.userToken("alice"),
      bob: await fixture.userToken("bob"),
      carol: await fixture.userToken("carol"),
      mia: ext.users.mia.token,
      noa: ext.users.noa.token,
      oda: ext.users.oda.token,
    },
  };
}

async function rest(api, token, method, route, body, headers = {}) {
  const response = await fetch(`${api}${route}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function callTool(url, token, name, args, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const json = await response.json();
  if (!json?.result) throw new Error(`tool call failed (${response.status}): ${JSON.stringify(json).slice(0, 300)}`);
  return json.result;
}

describe("External IdP binding (TASK-13): probe, bind, auth, isolation", () => {
  it("lists no bindings initially; /me reports the operator IdP", async () => {
    const { api, tokens } = await setup();
    const list = await rest(api, tokens.alice, "GET", "/idp/bindings");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.bindings, []);
    const me = await rest(api, tokens.alice, "GET", "/me");
    assert.equal(me.body.login, "alice");
    assert.equal(me.body.idp, null);
  });

  it("probe validates policy and token before anything persists", async () => {
    const { api, tokens } = await setup();
    const badScheme = await rest(api, tokens.alice, "POST", "/idp/probe", { youtrackUrl: "ftp://x", serviceToken: ext.serviceToken });
    assert.equal(badScheme.status, 400);
    assert.equal(badScheme.body.error, "IDP_HOST_FORBIDDEN");

    const publicHttp = await rest(api, tokens.alice, "POST", "/idp/probe", { youtrackUrl: "http://yt.example.com", serviceToken: ext.serviceToken });
    assert.equal(publicHttp.status, 400);
    assert.equal(publicHttp.body.error, "IDP_HOST_FORBIDDEN");

    const shortToken = await rest(api, tokens.alice, "POST", "/idp/probe", { youtrackUrl: EXT_YT_HOST_URL, serviceToken: "x" });
    assert.equal(shortToken.status, 400);
    assert.equal(shortToken.body.error, "IDP_TOKEN_REQUIRED");

    const wrongToken = await rest(api, tokens.alice, "POST", "/idp/probe", { youtrackUrl: EXT_YT_HOST_URL, serviceToken: "wrong-token-0123456789" });
    assert.equal(wrongToken.status, 400);
    assert.equal(wrongToken.body.error, "IDP_TOKEN_REJECTED");

    const unreachable = await rest(api, tokens.alice, "POST", "/idp/probe", { youtrackUrl: "http://127.0.0.1:19999", serviceToken: ext.serviceToken });
    assert.equal(unreachable.status, 400);
    assert.equal(unreachable.body.error, "IDP_PROBE_FAILED");

    const ok = await rest(api, tokens.alice, "POST", "/idp/probe", { youtrackUrl: EXT_YT_HOST_URL, serviceToken: ext.serviceToken });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.ok, true);
    assert.equal(ok.body.serviceLogin, "admin");
  });

  it("bind provisions a tenant; external users authenticate under it (token + bridge)", async () => {
    const { api, tokens } = await setup();
    const bound = await rest(api, tokens.alice, "POST", "/idp/bind", extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL }));
    assert.equal(bound.status, 200, JSON.stringify(bound.body));
    assert.equal(bound.body.binding.tenant, EXT_TENANT);
    assert.equal(bound.body.binding.status, "active");
    assert.equal(bound.body.binding.boundBy, "alice");
    assert.equal(typeof bound.body.bridgeToken, "string");
    assert.ok(bound.body.bridgeToken.length >= 32);
    assert.equal(bound.body.install.serviceBridgeToken, bound.body.bridgeToken);
    assert.match(bound.body.install.serviceUrl, /^http/);

    // Direct token path: mia's ext-YouTrack token resolves her tenant ctx.
    const me = await rest(api, tokens.mia, "GET", "/me");
    assert.equal(me.status, 200, JSON.stringify(me.body));
    assert.equal(me.body.login, "mia");
    assert.deepEqual(me.body.tenant, [EXT_TENANT]);
    assert.deepEqual(me.body.scopes, ["acme/gamma"]);
    assert.equal(me.body.role, "writer");
    assert.equal(me.body.idp, EXT_TENANT);

    // Bridge path: the ext app's backend asserts X-Spec-User under the
    // minted bridge secret — resolved against the ext IdP, not the default.
    const bridged = await rest(api, bound.body.bridgeToken, "GET", "/me", undefined, { "x-spec-user": "mia" });
    assert.equal(bridged.status, 200, JSON.stringify(bridged.body));
    assert.equal(bridged.body.login, "mia");
    assert.equal(bridged.body.idp, EXT_TENANT);

    // Bridge secret without X-Spec-User is refused.
    const noUser = await rest(api, bound.body.bridgeToken, "GET", "/me");
    assert.equal(noUser.status, 401);
    assert.equal(noUser.body.error, "MISSING_USER");

    // The X-Spec-Idp hint resolves too — and a wrong hint is only a routing
    // preference, never a lockout.
    const hinted = await rest(api, tokens.mia, "GET", "/me", undefined, { "x-spec-idp": EXT_TENANT });
    assert.equal(hinted.status, 200);
    const wrongHint = await rest(api, tokens.mia, "GET", "/me", undefined, { "x-spec-idp": "nonexistent" });
    assert.equal(wrongHint.status, 200);
    assert.equal(wrongHint.body.login, "mia");
  });

  it("enforces tenant isolation and group gating for external users", async () => {
    const { api, url, tokens } = await setup();
    await rest(api, tokens.alice, "POST", "/idp/bind", extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL }));

    // Ext scopes do not include operator projects — dispatch refuses before
    // the kernel ever sees the request.
    const outOfScope = await callTool(url, tokens.mia, "spec_catalog", { view: "specs", project: "stgmt/alpha" }).then((r) => r.structuredContent);
    assert.equal(outOfScope.ok, false);
    assert.equal(outOfScope.error.code, "INVALID_REQUEST");
    assert.match(outOfScope.error.message, /outside the caller's allowed set/);

    // A group-less ext user is refused by the binding's hubGroups, not YouTrack.
    const noScopes = await rest(api, tokens.oda, "GET", "/me");
    assert.equal(noScopes.status, 403);
    assert.equal(noScopes.body.error, "NO_SCOPES");

    // External users cannot nest-bind IdPs.
    const nested = await rest(api, tokens.mia, "POST", "/idp/bind", extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL }));
    assert.equal(nested.status, 403);
    assert.equal(nested.body.error, "FORBIDDEN_IDP");

    // Operator users keep resolving through the default IdP (regression).
    const me = await rest(api, tokens.alice, "GET", "/me");
    assert.equal(me.body.login, "alice");
    assert.equal(me.body.idp, null);
  });

  it("external users read and write inside their own project scope — from their own repo", async () => {
    const { api, url, tokens, byoBare, byoUrl } = await setup();
    const bound = await rest(api, tokens.alice, "POST", "/idp/bind", extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL }));
    assert.equal(bound.status, 200, JSON.stringify(bound.body));

    // Without a repo binding the external project refuses every data op —
    // customer specs must never land in the operator's shared repo.
    const refused = await callTool(url, tokens.mia, "spec_catalog", { view: "specs" }).then((r) => r.structuredContent);
    assert.equal(refused.ok, false);
    assert.match(refused.error.message, /repos\/bind|no specs repository/u);

    // The tenant binds its own repo (mia is a writer in the acme scope) —
    // migration carries the seeded .specs tree into byo.git.
    const repoBound = await rest(api, tokens.mia, "POST", "/repos/bind", { project: "acme/gamma", repoUrl: byoUrl, token: "unused-for-file" });
    assert.equal(repoBound.status, 200, JSON.stringify(repoBound.body));
    assert.equal(repoBound.body.binding.status, "active");

    // mia patches a spec in her tenant project — the write lands under
    // acme/gamma in the CUSTOMER repo, never the operator's.
    const patch = await callTool(url, tokens.mia, "spec_patch", {
      intent: "patch",
      spec: "gamma-spec",
      reason: "ext idp write path",
      dryRun: false,
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "\nExternal write\n" }],
      requestId: "ext-write-1",
    }).then((r) => r.structuredContent);
    assert.equal(patch.ok, true, JSON.stringify(patch.error ?? {}));
    assert.equal(patch.data.outcome, "APPLIED");

    const { stdout } = await execFileAsync("git", ["--git-dir", byoBare, "show", "main:acme/gamma/.specs/gamma-spec/README.md"]);
    assert.match(stdout, /External write/u, `ext write did not land in the customer repo: ${stdout.slice(0, 200)}`);

    const catalog = await callTool(url, tokens.mia, "spec_catalog", { view: "specs" }).then((r) => r.structuredContent);
    assert.equal(catalog.ok, true);
    assert.ok(catalog.data.specs.includes("gamma-spec"), JSON.stringify(catalog.data));
  });

  it("restart preserves the binding; unbind revokes external access", async () => {
    const { api, tokens, service, byoUrl } = await setup();
    await rest(api, tokens.alice, "POST", "/idp/bind", extBindBody({
      serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL,
      repo: { url: byoUrl, token: "unused-for-file" },
    }));
    const meBefore = await rest(api, tokens.mia, "GET", "/me");
    assert.equal(meBefore.status, 200);

    // Non-binder non-owner cannot unbind.
    const denied = await rest(api, tokens.bob, "POST", "/idp/unbind", { tenant: EXT_TENANT });
    assert.equal(denied.status, 403);

    // Owner can (carol has the owner role on the default IdP).
    const unbound = await rest(api, tokens.carol, "POST", "/idp/unbind", { tenant: EXT_TENANT });
    assert.equal(unbound.status, 200);
    assert.equal(unbound.body.unbound, EXT_TENANT);

    // The tenant's repo binding goes with it — a stale row would resurface
    // if another tenant later claimed the same project id.
    assert.equal(service.store.getBinding("acme/gamma"), null);

    const meAfter = await rest(api, tokens.mia, "GET", "/me");
    assert.equal(meAfter.status, 401);
    assert.equal(meAfter.body.error, "INVALID_TOKEN");
  });

  it("refuses project-claim takeover, stranger re-bind, and credential-in-URL", async () => {
    const { api, tokens, service } = await setup();

    // Claiming an operator-configured project is refused before any probe.
    const claim = await rest(api, tokens.alice, "POST", "/idp/bind", extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL, projects: ["stgmt/alpha"] }));
    assert.equal(claim.status, 409);
    assert.equal(claim.body.error, "IDP_PROJECT_TAKEN");

    // A URL carrying userinfo must not persist credentials.
    const withCreds = await rest(api, tokens.alice, "POST", "/idp/bind", extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL.replace("http://", "http://alice:SECRET@") }));
    assert.equal(withCreds.status, 200, JSON.stringify(withCreds.body));
    assert.equal(withCreds.body.binding.youtrackUrl, EXT_YT_HOST_URL);
    assert.equal(service.store.getIdpBinding(EXT_TENANT).youtrackUrl, EXT_YT_HOST_URL);

    // A stranger cannot re-bind the tenant to their own YouTrack — the
    // ownership gate fires before any probe of the supplied URL.
    const hijack = await rest(api, tokens.bob, "POST", "/idp/bind", extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: "http://127.0.0.1:19998" }));
    assert.equal(hijack.status, 403);
    assert.equal(hijack.body.error, "FORBIDDEN");

    // The binder re-binding the same URL with different parameters is an
    // explicit 409 — a silent scope change would be worse than a refusal.
    const drifted = await rest(api, tokens.alice, "POST", "/idp/bind", extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL, projects: ["acme/gamma", "acme/delta"] }));
    assert.equal(drifted.status, 409);
    assert.equal(drifted.body.error, "IDP_EXISTS");

    // A second tenant may not reuse the bound YouTrack nor claim a project
    // the first tenant owns.
    const sameUrl = await rest(api, tokens.bob, "POST", "/idp/bind", { ...extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: EXT_YT_HOST_URL, projects: ["acme/delta"] }), tenant: "acme-two" });
    assert.equal(sameUrl.status, 409);
    assert.equal(sameUrl.body.error, "IDP_URL_TAKEN");
    const sameProject = await rest(api, tokens.bob, "POST", "/idp/bind", { ...extBindBody({ serviceToken: ext.serviceToken, youtrackUrl: "http://127.0.0.1:19998" }), tenant: "acme-two" });
    assert.equal(sameProject.status, 409);
    assert.equal(sameProject.body.error, "IDP_PROJECT_TAKEN");

    await rest(api, tokens.carol, "POST", "/idp/unbind", { tenant: EXT_TENANT });
  });

  it("bind repo block wires the tenant's own repo in the same call", async () => {
    const { api, url, tokens, byoBare, byoUrl } = await setup();
    const bound = await rest(api, tokens.alice, "POST", "/idp/bind", extBindBody({
      serviceToken: ext.serviceToken,
      youtrackUrl: EXT_YT_HOST_URL,
      repo: { url: byoUrl, token: "unused-for-file" },
    }));
    assert.equal(bound.status, 200, JSON.stringify(bound.body));
    assert.equal(bound.body.repos["acme/gamma"].binding.status, "active");

    // The migrated tree landed in the customer repo, and reads serve it.
    const { stdout } = await execFileAsync("git", ["--git-dir", byoBare, "show", "main:acme/gamma/.specs/gamma-spec/TASKS.md"]);
    assert.match(stdout, /TASK-1/u, `migrated TASKS missing in the customer repo: ${stdout.slice(0, 160)}`);

    const catalog = await callTool(url, tokens.mia, "spec_catalog", { view: "specs" }).then((r) => r.structuredContent);
    assert.equal(catalog.ok, true, JSON.stringify(catalog.error ?? {}));
    assert.ok(catalog.data.specs.includes("gamma-spec"));

    await rest(api, tokens.carol, "POST", "/idp/unbind", { tenant: EXT_TENANT });
  });

  it("a dead bound IdP degrades only its own tenant, not the fan-out", async () => {
    // Unit-level: stub the IdP list and transport — a refusing bound IdP
    // must not turn operator tokens or bad tokens into a global outage.
    const auth = createYouTrackAuth({
      youtrack: { baseUrl: "http://op.invalid", serviceToken: "op-service-token-0000" },
      appBridgeToken: "op-bridge-token-000000000000",
      tenants: [{ tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" }],
      roleGroups: { owner: ["spec-owners"], writer: ["spec-writers"], reader: ["spec-readers"] },
      idps: {
        list: async () => [{
          tenant: "dead", baseUrl: "http://dead.invalid", serviceToken: "dead-service-token", bridgeTokenHash: "00",
          status: "active", projects: ["acme/gamma"], hubGroups: ["g"], roleGroups: { reader: ["g"] }, defaultProject: "acme/gamma",
        }],
      },
      cacheTtlMs: 1,
      fetchImpl: async (url, init) => {
        if (url.startsWith("http://dead.invalid")) throw new Error("connect ECONNREFUSED");
        const bearer = init?.headers?.authorization ?? "";
        if (url.includes("/users/me")) {
          return bearer === "Bearer alice-token"
            ? { ok: true, status: 200, json: async () => ({ login: "alice", id: "u1" }) }
            : { ok: false, status: 401, json: async () => ({}) };
        }
        if (url.includes("/users?query=login:")) {
          return { ok: true, status: 200, json: async () => ({ users: [{ login: "alice", id: "u1", transitiveGroups: [{ name: "spec-alpha" }, { name: "spec-writers" }] }] }) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });

    // The operator's user still authenticates — the dead tenant is skipped.
    const ctx = await auth.authenticate({ headers: { authorization: "Bearer alice-token" } });
    assert.equal(ctx.identity.login, "alice");

    // A token nobody could verify stays fail-closed: 503 (a dead IdP might
    // have issued it), never a confident 401.
    await assert.rejects(
      () => auth.authenticate({ headers: { authorization: "Bearer garbage" } }),
      (error) => error.status === 503 && error.code === "UNAVAILABLE",
    );
  });
});
