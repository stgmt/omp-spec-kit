import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { startService } from "../src/service/index.js";
import { loadLiveFixture } from "./e2e/lib/live-fixture.mjs";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const SPEC_KEY = "stgmt/alpha/spec-kernel";
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
  const seed = path.join(base, "seed");
  await execFileAsync("git", ["clone", bare, seed]);
  await git(seed, ["config", "user.email", "seed@example.invalid"]);
  await git(seed, ["config", "user.name", "seed"]);
  for (const project of projects) {
    await cp(FIXTURE_SPEC, path.join(seed, project, ".specs", "spec-kernel"), { recursive: true });
  }
  if (extraSeed) await extraSeed(seed);
  await execFileAsync("git", ["-C", seed, "add", "."]);
  await execFileAsync("git", ["-C", seed, "commit", "-m", "seed"]);
  await execFileAsync("git", ["-C", seed, "push", "-q", "origin", "HEAD:refs/heads/main"]);
  await rm(seed, { recursive: true, force: true });

  const byoBare = path.join(base, "byo.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", byoBare]);
  const byoUrl = pathToFileURL(byoBare).href;

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

async function bind(api, token, args) {
  return rest(api, token, "POST", "/repos/bind", { project: "stgmt/alpha", repoUrl: args.repoUrl, token: args.token ?? BYO_TOKEN, migrate: args.migrate, branch: args.branch });
}

describe("BYO specs repo (TASK-17): bindings, migration, routing", () => {
  it("reports the default repo in /me until a binding exists", async () => {
    const { api, bare, tokens } = await setup();
    const me = await rest(api, tokens.alice, "GET", "/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.login, "alice");
    assert.equal(me.body.role, "writer");
    const alpha = me.body.repos.find((r) => r.project === "stgmt/alpha");
    assert.equal(alpha.bound, false);
    assert.equal(alpha.status, "default");
    assert.equal(alpha.repoUrl, bare);
    const bindings = await rest(api, tokens.alice, "GET", "/repos/bindings");
    assert.deepEqual(bindings.body.bindings, []);
  });

  it("refuses bind for readers, scope-outsiders, and non-private non-allowlisted hosts", async () => {
    const { api, byoUrl, tokens } = await setup();
    const reader = await bind(api, tokens.bob, { repoUrl: byoUrl });
    assert.equal(reader.status, 403);
    assert.equal(reader.body.error, "FORBIDDEN_ROLE");

    const publicHost = await bind(api, tokens.alice, { repoUrl: "https://git.example.com/x/y.git" });
    assert.equal(publicHost.status, 400);
    assert.equal(publicHost.body.error, "REPO_HOST_FORBIDDEN");

    const badScheme = await bind(api, tokens.alice, { repoUrl: "ssh://git@git.example.com/x/y.git" });
    assert.equal(badScheme.body.error, "REPO_HOST_FORBIDDEN");

    // file:// is allowlisted in this config, so the failure must come from the
    // reachability probe, not policy.
    const deadPath = await bind(api, tokens.alice, { repoUrl: "file:///nonexistent/definitely-missing.git" });
    assert.equal(deadPath.body.error, "REPO_PROBE_FAILED");
  });

  it("requires a credential and probes reachability before binding", async () => {
    const { api, byoUrl, tokens } = await setup();
    const noToken = await rest(api, tokens.alice, "POST", "/repos/bind", { project: "stgmt/alpha", repoUrl: byoUrl });
    assert.equal(noToken.status, 400);
    assert.equal(noToken.body.error, "REPO_TOKEN_REQUIRED");

    const missing = await rest(api, tokens.alice, "POST", "/repos/probe", { project: "stgmt/alpha", repoUrl: "file:///nonexistent/dead.git", token: "x" });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error, "REPO_PROBE_FAILED");

    const probe = await rest(api, tokens.alice, "POST", "/repos/probe", { project: "stgmt/alpha", repoUrl: byoUrl, token: "x" });
    assert.equal(probe.status, 200);
    assert.equal(probe.body.ok, true);
  });

  it("bind + migrate copies the .specs snapshot into the user's repo", async () => {
    const { api, byoBare, byoUrl, tokens } = await setup();
    const res = await bind(api, tokens.alice, { repoUrl: byoUrl, migrate: true });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.binding.status, "active");
    assert.equal(res.body.binding.repoUrl, byoUrl);

    // The snapshot landed in the user's repo as a bot commit.
    const readme = await gitDir(byoBare, ["show", "main:stgmt/alpha/.specs/spec-kernel/README.md"]);
    assert.match(readme, /Spec Kernel|Status:/u);
    const subject = await gitDir(byoBare, ["log", "--format=%s", "-1"]);
    assert.match(subject, /migrate stgmt\/alpha/u);
  });

  it("routes reads and writes to the bound repo, never the default one", async () => {
    const { api, url, bare, byoBare, byoUrl, tokens } = await setup();
    await bind(api, tokens.alice, { repoUrl: byoUrl, migrate: true });

    const catalog = await callTool(url, tokens.alice, "spec_catalog", { view: "specs" });
    assert.ok(catalog.structuredContent.data.specs.includes("spec-kernel"));

    const before = await gitDir(byoBare, ["rev-list", "--count", "main"]);
    const write = await callTool(url, tokens.alice, "spec_patch", {
      intent: "patch",
      spec: "spec-kernel",
      reason: "byo write",
      dryRun: false,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-BYO\n" }],
      requestId: "byo-write-1",
    });
    assert.equal(write.structuredContent.data.outcome, "APPLIED");
    const after = await gitDir(byoBare, ["rev-list", "--count", "main"]);
    assert.ok(Number(after) > Number(before), "the write pushed to the bound repo");
    const tasks = await gitDir(byoBare, ["show", "main:stgmt/alpha/.specs/spec-kernel/TASKS.md"]);
    assert.match(tasks, /TASK-BYO/u);
    const defaultLog = await gitDir(bare, ["log", "--format=%s", "main"]);
    assert.ok(!defaultLog.includes("apply"), "the default repo got no write");
  });

  it("records the bound repo in ledger rows and serves old versions from the old clone", async () => {
    const { api, url, byoUrl, service, tokens } = await setup();
    await flipActive(url, tokens.alice, "1.0.0");
    const v1 = service.store.getLedger(SPEC_KEY).find((r) => r.version === "1.0.0");
    assert.equal(v1.repoUrl, service.mounts.config.specsRepo);

    await bind(api, tokens.alice, { repoUrl: byoUrl, migrate: true });

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
    assert.equal(v2.repoBranch, "main");

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
    const { api, byoBare, byoUrl, tokens } = await setup();
    await bind(api, tokens.alice, { repoUrl: byoUrl, migrate: true });
    const commits = await gitDir(byoBare, ["rev-list", "--count", "main"]);
    const again = await bind(api, tokens.alice, { repoUrl: byoUrl, migrate: true });
    assert.equal(again.status, 200);
    assert.equal(again.body.unchanged, true);
    assert.equal(await gitDir(byoBare, ["rev-list", "--count", "main"]), commits, "no extra migration commit");
  });

  it("never persists or returns the repo credential in plaintext", async () => {
    const { api, byoUrl, storeFile, service, tokens } = await setup();
    await bind(api, tokens.alice, { repoUrl: byoUrl, token: BYO_TOKEN, migrate: true });
    const raw = await readFile(storeFile, "utf8").catch(() => readFile(`${storeFile}.json`, "utf8"));
    assert.ok(!raw.includes(BYO_TOKEN), "the sealed token must not appear in the store file");
    const bindings = await rest(api, tokens.alice, "GET", "/repos/bindings");
    assert.ok(!JSON.stringify(bindings.body).includes(BYO_TOKEN));
    const cred = service.store.getCredential("stgmt/alpha");
    assert.equal(cred.repoUrl, byoUrl);
    assert.ok(!cred.tokenEnc.includes(BYO_TOKEN));
  });

  it("unbind returns the project to the default repo; history stays readable", async () => {
    const { api, url, bare, byoUrl, service, tokens } = await setup();
    await flipActive(url, tokens.alice, "1.0.0");
    await bind(api, tokens.alice, { repoUrl: byoUrl, migrate: true });
    const unbind = await rest(api, tokens.alice, "POST", "/repos/unbind", { project: "stgmt/alpha" });
    assert.equal(unbind.status, 200);
    assert.equal(unbind.body.previous, byoUrl);

    const me = await rest(api, tokens.alice, "GET", "/me");
    assert.equal(me.body.repos.find((r) => r.project === "stgmt/alpha").bound, false);
    // Reads/writes resolve the default clone again — the snapshot copy left
    // the source intact, so the spec is still listed.
    const catalog = await callTool(url, tokens.alice, "spec_catalog", { view: "specs" });
    assert.ok(catalog.structuredContent.data.specs.includes("spec-kernel"));
    const frozen = await callTool(url, tokens.alice, "spec_documents", { action: "read", spec: "spec-kernel", doc: "README.md", version: "1.0.0" });
    assert.equal(frozen.isError, false);
    assert.equal(service.store.getCredential("stgmt/alpha"), null, "the credential is gone");
    const log = await gitDir(bare, ["log", "--format=%s", "main"]);
    assert.ok(log.length > 0);
  });

  it("X-Spec-Project supplies the default scope and is still scope-checked", async () => {
    const tenants = [
      { tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: null },
      { tenant: "beta", projects: ["stgmt/beta"], hubGroups: ["spec-beta"], defaultProject: null },
    ];
    const { api, url, tokens } = await setup({ projects: ["stgmt/alpha", "stgmt/beta"], tenants });
    // frank is a writer in both tenants: no default scope without the header.
    const noHint = await callTool(url, tokens.frank, "spec_catalog", { view: "specs" });
    assert.equal(noHint.structuredContent.ok, false);
    const hinted = await callTool(url, tokens.frank, "spec_catalog", { view: "specs" }, { "x-spec-project": "stgmt/alpha" });
    assert.equal(hinted.structuredContent.ok, true);
    const outside = await callTool(url, tokens.frank, "spec_catalog", { view: "specs" }, { "x-spec-project": "stgmt/gamma" });
    assert.equal(outside.structuredContent.ok, false);
  });
});
