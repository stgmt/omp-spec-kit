import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { startService } from "../src/service/index.js";
import { loadLiveFixture } from "./e2e/lib/live-fixture.mjs";
import { seedSpecBranch } from "./service/lib/spec-repo.mjs";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const SPEC_KEY = "stgmt/alpha/spec-kernel";
const SPEC_BRANCH = "spec-spec-kernel";
const SECRETS_KEY = "suite-secrets-key-0123456789";
const BYO_TOKEN = "byo-user-token-SECRET";
const servers = [];
const services = [];
const tempDirs = [];

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

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

async function gitDir(bare, args) {
  return (await execFileAsync("git", ["--git-dir", bare, ...args])).stdout.trim();
}

/**
 * Default specs repo is a local bare path (service treats it like any other
 * remote). The BYO target is a second bare repo reached through a file:// URL:
 * real clone/push/ls-remote semantics, allowed only because the test config
 * opts in via repoPolicy.allowedHosts:["file"].
 */
async function setup({ projects = ["stgmt/alpha"], tenants = null, extraSeed = null } = {}) {
  const fixture = await loadLiveFixture();
  const base = await tempDir("spec-repos-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  await seedSpecBranch(bare, { project: "stgmt/alpha", spec: "spec-kernel", sourceDir: FIXTURE_SPEC });

  const byoBare = path.join(base, "byo.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", byoBare]);
  const byoUrl = pathToFileURL(byoBare).href;
  await seedSpecBranch(byoBare, {
    project: "stgmt/alpha",
    spec: "spec-kernel",
    sourceDir: FIXTURE_SPEC,
    repoUrl: byoUrl,
    files: { "README.md": "# Spec Kernel\n\nStatus: ACTIVE\nVersion: 1.0.0\n" },
  });

  const config = fixture.serviceConfigFor(bare, { projects });
  if (tenants) config.tenants = tenants;
  config.repoPolicy = { allowedHosts: ["file"] };
  const configPath = path.join(base, "projects.json");
  await writeFile(configPath, JSON.stringify(config, null, 2));

  const storeFile = path.join(base, "registry.db");
  const service = await startService({
    configPath,
    cloneDir: path.join(base, "clone"),
    storeFile,
    port: 0,
    identity: IDENTITY,
    logger: () => {},
    env: { ...process.env, SPEC_REGISTRY_SECRETS_KEY: SECRETS_KEY },
  });
  servers.push(service.server);
  services.push(service);
  const api = `http://127.0.0.1:${service.server.address().port}`;
  return {
    fixture,
    service,
    base,
    bare,
    byoBare,
    byoUrl,
    storeFile,
    api,
    url: `${api}/mcp`,
    tokens: {
      alice: await fixture.userToken("alice"),
      bob: await fixture.userToken("bob"),
      frank: await fixture.userToken("frank"),
    },
  };
}

async function callTool(url, token, name, args, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const json = await response.json();
  if (!json?.result) throw new Error(`tool call failed (${response.status}): ${JSON.stringify(json).slice(0, 200)}`);
  return json.result;
}

async function rest(api, token, method, route, body) {
  const response = await fetch(`${api}${route}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function flipActive(url, token, version) {
  const result = await callTool(url, token, "spec_patch", {
    intent: "patch",
    spec: "spec-kernel",
    reason: "byo test",
    dryRun: false,
    operations: [{ kind: "insert_at_eof", document: "README.md", text: `\nStatus: ACTIVE\nVersion: ${version}\n` }],
    requestId: `flip-${version}`,
  });
  assert.equal(result.isError, false, JSON.stringify(result.structuredContent?.error ?? {}));
  assert.equal(result.structuredContent.data.outcome, "APPLIED");
}

/** Repository binding is an MCP tool call now: no REST mirror exists. */
async function bind(url, token, args) {
  const result = await callTool(url, token, "spec_repo", {
    action: "bind",
    project: "stgmt/alpha",
    repoUrl: args.repoUrl,
    token: args.token ?? BYO_TOKEN,
    migrate: args.migrate,
    branch: args.branch,
  });
  return result.structuredContent;
}

describe("BYO specs repo (TASK-17): bindings, migration, routing", () => {
  it("reports the configured binding in /me and through spec_repo", async () => {
    const { api, url, bare, tokens } = await setup();
    const me = await rest(api, tokens.alice, "GET", "/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.login, "alice");
    assert.equal(me.body.role, "writer");
    const alpha = me.body.repos.find((r) => r.project === "stgmt/alpha");
    assert.equal(alpha.bound, true);
    assert.equal(alpha.status, "active");
    assert.equal(alpha.repoUrl, bare);
    const bindings = (await callTool(url, tokens.alice, "spec_repo", { action: "bindings" })).structuredContent;
    assert.deepEqual(bindings.data.bindings.map((b) => b.project), ["stgmt/alpha"]);
  });

  it("refuses bind for readers, scope-outsiders, and non-private non-allowlisted hosts", async () => {
    const { url, byoUrl, tokens } = await setup();
    const reader = await bind(url, tokens.bob, { repoUrl: byoUrl });
    assert.equal(reader.ok, false);
    assert.match(reader.error.message, /requires writer role/u);

    const publicHost = await bind(url, tokens.alice, { repoUrl: "https://git.example.com/x/y.git" });
    assert.equal(publicHost.ok, false);
    assert.equal(publicHost.error.code, "REPO_HOST_FORBIDDEN");

    const badScheme = await bind(url, tokens.alice, { repoUrl: "ssh://git@git.example.com/x/y.git" });
    assert.equal(badScheme.error.code, "REPO_HOST_FORBIDDEN");

    // file:// is allowlisted in this config, so the failure must come from the
    // reachability probe, not policy.
    const deadPath = await bind(url, tokens.alice, { repoUrl: "file:///nonexistent/definitely-missing.git" });
    assert.equal(deadPath.error.code, "REPO_PROBE_FAILED");
  });

  it("requires a credential and probes reachability before binding", async () => {
    const { url, byoUrl, tokens } = await setup();
    const noToken = (await callTool(url, tokens.alice, "spec_repo", { action: "bind", project: "stgmt/alpha", repoUrl: byoUrl })).structuredContent;
    assert.equal(noToken.ok, false);
    // The bind variant declares token required, so the refusal arrives at the
    // contract boundary and names the missing parameter instead of reaching git.
    assert.equal(noToken.error.code, "INVALID_REQUEST");
    assert.equal(noToken.error.parameter, "token");

    const missing = (await callTool(url, tokens.alice, "spec_repo", { action: "probe", project: "stgmt/alpha", repoUrl: "file:///nonexistent/dead.git", token: "x" })).structuredContent;
    assert.equal(missing.ok, false);
    assert.equal(missing.error.code, "REPO_PROBE_FAILED");

    const probe = (await callTool(url, tokens.alice, "spec_repo", { action: "probe", project: "stgmt/alpha", repoUrl: byoUrl, token: "x" })).structuredContent;
    assert.equal(probe.ok, true, JSON.stringify(probe.error ?? {}));
  });

  it("bind attaches the spec branch already present in the user's repo", async () => {
    const { url, byoBare, byoUrl, tokens } = await setup();
    const res = await bind(url, tokens.alice, { repoUrl: byoUrl, migrate: true });
    assert.equal(res.ok, true, JSON.stringify(res.error ?? {}));
    assert.equal(res.data.binding.status, "active");
    assert.equal(res.data.binding.repoUrl, byoUrl);

    // The spec branch is the source of truth: binding attaches it, and the
    // pre-existing commit is exactly what the service serves.
    const readme = await gitDir(byoBare, ["show", `${SPEC_BRANCH}:.specs/spec-kernel/README.md`]);
    assert.match(readme, /Spec Kernel|Status:/u);
    const subject = await gitDir(byoBare, ["log", "--format=%s", "-1", `refs/heads/${SPEC_BRANCH}`]);
    assert.match(subject, /seed/u);
  });

  it("routes reads and writes to the bound repo, never the previous one", async () => {
    const { url, bare, byoBare, byoUrl, tokens } = await setup();
    await bind(url, tokens.alice, { repoUrl: byoUrl, migrate: true });

    const catalog = await callTool(url, tokens.alice, "spec_catalog", { view: "specs" });
    assert.ok(catalog.structuredContent.data.specs.includes("spec-kernel"));

    const before = await gitDir(byoBare, ["rev-list", "--count", `refs/heads/${SPEC_BRANCH}`]);
    const write = await callTool(url, tokens.alice, "spec_patch", {
      intent: "patch",
      spec: "spec-kernel",
      reason: "byo write",
      dryRun: false,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-900: bound-repo write marker\n" }],
      requestId: "byo-write-1",
    });
    assert.equal(write.structuredContent.data.outcome, "APPLIED");
    const after = await gitDir(byoBare, ["rev-list", "--count", `refs/heads/${SPEC_BRANCH}`]);
    assert.ok(Number(after) > Number(before), "the write pushed to the bound repo");
    const tasks = await gitDir(byoBare, ["show", `${SPEC_BRANCH}:.specs/spec-kernel/TASKS.md`]);
    assert.match(tasks, /TASK-900/u);
    const defaultLog = await gitDir(bare, ["log", "--format=%s", `refs/heads/${SPEC_BRANCH}`]);
    assert.ok(!defaultLog.includes("apply"), "the default repo got no write");
  });

  it("records the bound repo in ledger rows and serves old versions from the old clone", async () => {
    const { url, bare, byoUrl, service, tokens } = await setup();
    await flipActive(url, tokens.alice, "1.0.0");
    const v1 = service.store.getLedger(SPEC_KEY).find((r) => r.version === "1.0.0");
    assert.equal(v1.repoUrl, bare);

    await bind(url, tokens.alice, { repoUrl: byoUrl, migrate: true });

    // Bump to a second version in the bound repo and publish it there.
    const readme = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "README.md" });
    const bumped = readme.structuredContent.data.content.replace("Version: 1.0.0", "Version: 2.0.0");
    const write = await callTool(url, tokens.alice, "spec_patch", {
      intent: "patch", spec: "spec-kernel", reason: "bump", dryRun: false,
      operations: [{ kind: "replace_document", document: "README.md", content: bumped }],
      requestId: "bump-2.0",
    });
    assert.equal(write.structuredContent.data.outcome, "APPLIED");
    const v2 = service.store.getLedger(SPEC_KEY).find((r) => r.version === "2.0.0");
    assert.equal(v2.repoUrl, byoUrl);
    assert.equal(v2.repoBranch, SPEC_BRANCH);

    // v1 still resolves — through the recorded repo, i.e. the old clone.
    const frozen = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "README.md", version: "1.0.0" });
    assert.equal(frozen.isError, false, JSON.stringify(frozen.structuredContent?.error ?? {}));
    assert.match(frozen.structuredContent.data.content, /Version: 1\.0\.0/u);
    assert.equal(frozen.structuredContent.data.published.commit, v1.commitSha);

    const current = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "README.md", version: "2.0.0" });
    assert.equal(current.isError, false);
    assert.equal(current.structuredContent.data.published.commit, v2.commitSha);
  });

  it("re-binding the same repo is a no-op and cannot revert bound content", async () => {
    const { url, byoBare, byoUrl, tokens } = await setup();
    await bind(url, tokens.alice, { repoUrl: byoUrl, migrate: true });
    const commits = await gitDir(byoBare, ["rev-list", "--count", `refs/heads/${SPEC_BRANCH}`]);
    const again = await bind(url, tokens.alice, { repoUrl: byoUrl, migrate: true });
    assert.equal(again.ok, true, JSON.stringify(again.error ?? {}));
    assert.equal(again.data.unchanged, true);
    assert.equal(await gitDir(byoBare, ["rev-list", "--count", `refs/heads/${SPEC_BRANCH}`]), commits, "no extra migration commit");
  });

  it("never persists or returns the repo credential in plaintext", async () => {
    const { api, url, byoUrl, storeFile, service, tokens } = await setup();
    await bind(url, tokens.alice, { repoUrl: byoUrl, token: BYO_TOKEN, migrate: true });
    const raw = await readFile(storeFile, "utf8").catch(() => readFile(`${storeFile}.json`, "utf8"));
    assert.ok(!raw.includes(BYO_TOKEN), "the sealed token must not appear in the store file");
    const bindings = (await callTool(url, tokens.alice, "spec_repo", { action: "bindings" })).structuredContent;
    assert.ok(!JSON.stringify(bindings.data).includes(BYO_TOKEN));
    const cred = service.store.getCredential("stgmt/alpha");
    assert.equal(cred.repoUrl, byoUrl);
    assert.ok(!cred.tokenEnc.includes(BYO_TOKEN));
  });

  it("unbind leaves the project unbound; published history stays readable", async () => {
    const { api, url, bare, byoUrl, service, tokens } = await setup();
    await flipActive(url, tokens.alice, "1.0.0");
    await bind(url, tokens.alice, { repoUrl: byoUrl, migrate: true });
    const unbind = (await callTool(url, tokens.alice, "spec_repo", { action: "unbind", project: "stgmt/alpha" })).structuredContent;
    assert.equal(unbind.ok, true, JSON.stringify(unbind.error ?? {}));
    assert.equal(unbind.data.previous, byoUrl);

    const me = await rest(api, tokens.alice, "GET", "/me");
    assert.equal(me.body.repos.find((r) => r.project === "stgmt/alpha").bound, false);
    assert.equal(me.body.repos.find((r) => r.project === "stgmt/alpha").status, "required");
    // No silent fallback to another repository: the project must be bound.
    const catalog = await callTool(url, tokens.alice, "spec_catalog", { view: "specs" });
    assert.equal(catalog.structuredContent.ok, false);
    assert.match(catalog.structuredContent.error.message, /no specs repository/u);
    // Published versions resolve through the recorded repo, not the binding.
    // Unbound projects refuse reads entirely — no silent fallback...
    const frozenUnbound = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "README.md", version: "1.0.0" });
    assert.equal(frozenUnbound.isError, true);
    assert.equal(service.store.getCredential("stgmt/alpha"), null, "the credential is gone");
    // ...but once the project is bound again, the ledger still serves v1 from
    // the repo it was published into.
    const rebound = await bind(url, tokens.alice, { repoUrl: byoUrl });
    assert.equal(rebound.ok, true, JSON.stringify(rebound.error ?? {}));
    const frozen = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "README.md", version: "1.0.0" });
    assert.equal(frozen.isError, false, JSON.stringify(frozen.structuredContent?.error ?? {}));
    assert.equal(frozen.structuredContent.data.published.commit, service.store.getLedger(SPEC_KEY).find((r) => r.version === "1.0.0").commitSha);
    const log = await gitDir(bare, ["log", "--format=%s", `refs/heads/${SPEC_BRANCH}`]);
    assert.ok(log.length > 0);
  });

  it("refuses the retired project hint header while selection stays per call", async () => {
    const tenants = [
      { tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: null },
      { tenant: "beta", projects: ["stgmt/beta"], hubGroups: ["spec-beta"], defaultProject: null },
    ];
    const { url, tokens } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"], tenants });
    // frank is a writer in both tenants: no default scope without a selection.
    const noSelection = await callTool(url, tokens.frank, "spec_catalog", { view: "specs" });
    assert.equal(noSelection.structuredContent.ok, false);
    assert.equal(noSelection.structuredContent.error.code, "PROJECT_SELECTION_REQUIRED");
    // The transport hint was removed: a client still sending it learns so
    // instead of getting a corpus chosen behind the call's back.
    const hinted = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${tokens.frank}`,
        "x-spec-project": "stgmt/alpha",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "spec_catalog", arguments: { view: "specs" } } }),
    });
    assert.equal(hinted.status, 400);
    assert.match(JSON.stringify(await hinted.json()), /PROJECT_HEADER_REMOVED/u);
    // An explicit per-call project is the documented selection path.
    const explicit = await callTool(url, tokens.frank, "spec_catalog", { project: "stgmt/beta", view: "specs" });
    assert.equal(explicit.structuredContent.ok, true);
    assert.equal(explicit.structuredContent.provenance.project, "stgmt/beta");
  });
});
