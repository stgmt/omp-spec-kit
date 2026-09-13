import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { startService } from "../../src/service/index.js";
import { createStore } from "../../src/service/ledger.js";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const TOKEN = "token-alpha-123456";
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

async function setup({ syncIntervalMs = 0 } = {}) {
  const base = await tempDir("spec-task6-");
  const bare = path.join(base, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  const seed = path.join(base, "seed");
  await execFileAsync("git", ["clone", bare, seed]);
  await git(seed, ["config", "user.email", "seed@example.invalid"]);
  await git(seed, ["config", "user.name", "seed"]);
  await cp(FIXTURE_SPEC, path.join(seed, "stgmt", "alpha", ".specs", "spec-kernel"), { recursive: true });
  await writeFile(path.join(seed, "stgmt", "alpha", ".specs", "spec-kernel", "README.md"), "# Spec Kernel\n\nStatus: DRAFT\n\nSeeded fixture corpus for service tests.\n");
  await execFileAsync("git", ["add", "."], { cwd: seed });
  await execFileAsync("git", ["commit", "-m", "seed: spec-kernel fixture"], { cwd: seed });
  await execFileAsync("git", ["push", "-q", "origin", "HEAD:refs/heads/main"], { cwd: seed });
  await rm(seed, { recursive: true, force: true });
  const configPath = path.join(base, "projects.json");
  await writeFile(configPath, JSON.stringify({
    specsRepo: bare,
    branch: "main",
    projects: [{ id: "stgmt/alpha" }],
    tenants: [{ token: TOKEN, tenant: "alpha", projects: ["stgmt/alpha"] }],
  }));
  const service = await startService({
    configPath,
    cloneDir: path.join(base, "clone"),
    storeFile: path.join(base, "registry.db"),
    syncIntervalMs,
    port: 0,
    identity: IDENTITY,
    logger: () => {},
  });
  servers.push(service.server);
  services.push(service);
  return { base, bare, service, url: `http://127.0.0.1:${service.server.address().port}/mcp` };
}

async function get(url, pathname, token = TOKEN) {
  const response = await fetch(`${url.replace(/\/mcp$/, "")}${pathname}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

describe("store persistence (TASK-6)", () => {
  it("claims and tenants survive a restart via the store", async () => {
    const { base, service, url } = await setup();
    const claimResponse = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${TOKEN}`, "x-spec-author": "alice" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "spec_claim", arguments: { spec: "spec-kernel", ttlMinutes: 30, requestId: "c1" } } }),
    });
    const claimResult = (await claimResponse.json()).result;
    assert.equal(claimResult.isError, false, JSON.stringify(claimResult?.structuredContent));

    const reopened = await createStore({ file: path.join(base, "registry.db") });
    const persisted = reopened.getClaim("stgmt/alpha/spec-kernel");
    assert.ok(persisted, "claim must be persisted");
    assert.equal(persisted.holder, "alice");
    const tenant = reopened.getTenantByTokenHash((await import("node:crypto")).createHash("sha256").update(TOKEN).digest("hex"));
    assert.equal(tenant.id, "alpha");
    assert.deepEqual(tenant.scopes, ["stgmt/alpha"]);
    void service;
  });

  it("expired leases auto-release on read", async () => {
    const { base } = await setup();
    const store = await createStore({ file: path.join(base, "registry.db") });
    store.putClaim({ specKey: "stgmt/alpha/spec-old", holder: "alice", expiresAtMs: Date.now() - 1000 });
    const { createClaimStore } = await import("../../src/service/claims.js");
    const claims = createClaimStore({ store });
    assert.equal(claims.get("stgmt/alpha", "spec-old"), null);
  });
});

describe("registry index and drift endpoints (TASK-6)", () => {
  it("/registry serves the projected index; /drift reports non-bot commits", async () => {
    const { bare, service, url } = await setup();
    const registry = await get(url, "/registry");
    assert.equal(registry.status, 200);
    const alpha = registry.body.projects.find((project) => project.id === "stgmt/alpha");
    const entry = alpha.specs.find((spec) => spec.slug === "spec-kernel");
    assert.equal(entry.status, "DRAFT");
    assert.match(entry.digest, /^[0-9a-f]{64}$/u);
    assert.equal(entry.claim, null);

    // break-glass push by a non-bot identity
    const rogue = path.join(await tempDir("spec-rogue-"), "rogue");
    await execFileAsync("git", ["clone", bare, rogue]);
    await git(rogue, ["config", "user.email", "admin@example.invalid"]);
    await git(rogue, ["config", "user.name", "admin"]);
    await writeFile(path.join(rogue, "stgmt", "alpha", ".specs", "spec-kernel", "README.md"), "# Spec Kernel\n\nStatus: DRAFT\n\ntampered\n");
    await execFileAsync("git", ["add", "."], { cwd: rogue });
    await execFileAsync("git", ["commit", "-m", "break-glass edit"], { cwd: rogue });
    await execFileAsync("git", ["push", "-q", "origin", "HEAD:refs/heads/main"], { cwd: rogue });

    const drift = await get(url, "/drift");
    assert.equal(drift.status, 200);
    const nonBot = drift.body.events.filter((event) => event.kind === "non-bot-commit");
    assert.ok(nonBot.some((event) => event.author === "admin"), "break-glass commit must appear in drift");
    void service;
  });

  it("ops endpoints require a token when tenants are configured", async () => {
    const { url } = await setup();
    const anonymous = await get(url, "/registry", null);
    assert.equal(anonymous.status, 401);
    const health = await get(url, "/health", null);
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
  });
});

describe("sync loop (TASK-6)", () => {
  it("fast-forwards the clone when only the remote moved", async () => {
    const { bare, service, url } = await setup({ syncIntervalMs: 50 });
    // remote-only commit via a second clone
    const second = path.join(await tempDir("spec-second-"), "second");
    await execFileAsync("git", ["clone", bare, second]);
    await git(second, ["config", "user.email", "bot@example.invalid"]);
    await git(second, ["config", "user.name", "spec-bot"]);
    await writeFile(path.join(second, "stgmt", "alpha", ".specs", "spec-kernel", "NFR.md"), "# NFR\n\nStatus: DRAFT\n\nremote-only change\n");
    await execFileAsync("git", ["add", "."], { cwd: second });
    await execFileAsync("git", ["commit", "-m", "docs(spec): remote-only"], { cwd: second });
    await execFileAsync("git", ["push", "-q", "origin", "HEAD:refs/heads/main"], { cwd: second });

    // A coalesced reconcile may still be in flight from before the push;
    // poll until the clone catches up (eventual consistency, FR-10).
    let cloneNfr = "";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await service.sync.reconcile();
      cloneNfr = await readFile(cloneNfrPath(service.mounts.cloneDir), "utf8").catch(() => "");
      if (cloneNfr.includes("remote-only change")) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(cloneNfr, /remote-only change/u);
  });
});

function cloneNfrPath(cloneDir) {
  return path.join(cloneDir, "stgmt", "alpha", ".specs", "spec-kernel", "NFR.md");
}
