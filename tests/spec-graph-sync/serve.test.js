import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { startServe } from "../../scripts/spec-graph-sync.mjs";

function issue(overrides = {}) {
  return {
    id: "3-99",
    idReadable: "SPEC-1",
    project: { shortName: "SPEC" },
    customFields: [
      { name: "SpecId", value: "demo:TASK-1" },
      { name: "SpecKind", value: "TASK" },
      { name: "State", value: { name: "Fixed" } },
    ],
    ...overrides,
  };
}

function boardWith(taskStatus, canonicalId = "demo:TASK-1") {
  return {
    nodes: [{ canonicalId, specSlug: "demo", localId: "TASK-1", kind: "TASK", taskStatus }],
  };
}

function committedWith({ cardIds = { "demo:TASK-1": "SPEC-1" }, snapshotStatus = "todo" } = {}) {
  return {
    readCommitted: async () => ({
      valid: true,
      cardIds,
      snapshot: { nodes: [{ canonicalId: "demo:TASK-1", kind: "TASK", taskStatus: snapshotStatus }] },
    }),
  };
}

async function serve({ client, writeback, writebackToken = "test-token", sourceReader, syncState, sweep, sweepIntervalMs } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "spec-serve-test-"));
  const outbox = path.join(dir, "outbox.jsonl");
  const calls = [];
  const server = startServe({
    port: 0,
    projectShortName: "SPEC",
    outbox,
    writebackToken,
    sweep,
    sweepIntervalMs,
    client: client ?? { get: async () => issue() },
    sourceReader: sourceReader ?? { readBoard: async () => boardWith("todo") },
    syncState: syncState ?? committedWith(),
    writeback: writeback ?? { setSpecTaskStatus: async (args) => { calls.push(args); return { ok: true }; } },
  });
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port + "/writeback";
  return { server, url, outbox, dir, calls };
}

async function post(url, body, token = "test-token") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-Spec-Writeback-Token"] = token;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

describe("writeback listener", () => {
  const servers = [];
  after(async () => {
    for (const server of servers.splice(0)) await new Promise((resolve) => server.close(resolve));
  });
  const track = (ctx) => { servers.push(ctx.server); return ctx; };

  it("rejects non-writeback routes and malformed events", async () => {
    const { url, server } = track(await serve());
    const miss = await fetch("http://127.0.0.1:" + server.address().port + "/nope", { method: "POST", body: "{}" });
    assert.equal(miss.status, 404);
    assert.equal((await post(url, "{")).status, 400);
    assert.equal((await post(url, { specId: "TASK-1", toState: "Fixed", issueId: "3-99" })).status, 400);
  });

  it("rejects oversized event bodies", async () => {
    const { url } = track(await serve());
    const big = JSON.stringify({ specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99", pad: "x".repeat(70 * 1024) });
    const response = await post(url, big);
    assert.equal(response.status, 413);
  });

  it("verifies the event against the tracker before patching the spec", async () => {
    const ctx = track(await serve());
    const result = await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" });
    assert.equal(result.status, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.applied, true);
    assert.equal(result.json.status, "done");
    assert.deepEqual(ctx.calls, [{ specId: "demo:TASK-1", status: "done" }]);
    const drafts = (await readFile(ctx.outbox, "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].specId, "demo:TASK-1");
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("does not trust the claimed toState: uses the tracker-held State", async () => {
    const ctx = track(await serve({
      sourceReader: { readBoard: async () => boardWith("done") },
      syncState: committedWith({ snapshotStatus: "done" }),
      client: { get: async () => issue({ customFields: [
        { name: "SpecId", value: "demo:TASK-1" },
        { name: "SpecKind", value: "TASK" },
        { name: "State", value: { name: "Open" } },
      ] }) },
    }));
    const result = await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" });
    assert.equal(result.status, 200);
    assert.equal(result.json.applied, true);
    assert.equal(result.json.status, "todo");
    assert.deepEqual(ctx.calls, [{ specId: "demo:TASK-1", status: "todo" }]);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("rejects a forged specId that the tracker does not hold", async () => {
    const ctx = track(await serve({
      client: { get: async () => issue({ customFields: [
        { name: "SpecId", value: "demo:TASK-7" },
        { name: "SpecKind", value: "TASK" },
        { name: "State", value: { name: "Fixed" } },
      ] }) },
    }));
    const result = await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" });
    assert.equal(result.status, 409);
    assert.equal(ctx.calls.length, 0);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("applies nothing for unmapped tracker states", async () => {
    const ctx = track(await serve({
      client: { get: async () => issue({ customFields: [
        { name: "SpecId", value: "demo:TASK-1" },
        { name: "SpecKind", value: "TASK" },
        { name: "State", value: { name: "Won't fix" } },
      ] }) },
    }));
    const result = await post(ctx.url, { specId: "demo:TASK-1", toState: "Won't fix", issueId: "3-99" });
    assert.equal(result.status, 200);
    assert.equal(result.json.applied, false);
    assert.equal(result.json.reason, "unmapped tracker state");
    assert.equal(ctx.calls.length, 0);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("never regresses a spec status the tracker cannot represent", async () => {
    const ctx = track(await serve({
      sourceReader: { readBoard: async () => boardWith("in-progress") },
      syncState: committedWith({ snapshotStatus: "in-progress" }),
    }));
    const result = await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" });
    assert.equal(result.status, 200);
    assert.equal(result.json.applied, false);
    assert.equal(result.json.reason, "spec status not representable in tracker; spec wins");
    assert.equal(ctx.calls.length, 0);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("refuses cards the committed snapshot does not own", async () => {
    const ctx = track(await serve({
      syncState: committedWith({ cardIds: { "demo:TASK-1": "SPEC-2" } }),
    }));
    const result = await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" });
    assert.equal(result.status, 409);
    assert.equal(ctx.calls.length, 0);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("rejects issues outside the project and unreachable issues", async () => {
    const ctx = track(await serve({
      client: { get: async () => issue({ project: { shortName: "OTHER" } }) },
    }));
    assert.equal((await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" })).status, 404);
    const gone = track(await serve({
      client: { get: async () => { throw new Error("GET /api/issues/3-98 => 404 Not Found"); } },
    }));
    assert.equal((await post(gone.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-98" })).status, 404);
    assert.equal(gone.calls.length + ctx.calls.length, 0);
    await rm(ctx.dir, { recursive: true, force: true });
    await rm(gone.dir, { recursive: true, force: true });
  });

  it("keeps the draft and answers 502 when the governed patch fails", async () => {
    const ctx = track(await serve({
      writeback: { setSpecTaskStatus: async () => { throw new Error("spec_patch unavailable"); } },
    }));
    const result = await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" });
    assert.equal(result.status, 502);
    assert.equal(result.json.ok, false);
    const drafts = (await readFile(ctx.outbox, "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(drafts.length, 1);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("rejects writeback for non-TASK cards", async () => {
    const ctx = track(await serve({
      client: { get: async () => issue({ customFields: [
        { name: "SpecId", value: "demo:FR-1" },
        { name: "SpecKind", value: "FR" },
        { name: "State", value: { name: "Fixed" } },
      ] }) },
    }));
    const result = await post(ctx.url, { specId: "demo:FR-1", toState: "Fixed", issueId: "3-99" });
    assert.equal(result.status, 422);
    assert.equal(ctx.calls.length, 0);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("proves liveness with an HMAC health answer", async () => {
    const { server } = track(await serve());
    const port = server.address().port;
    const plain = await fetch("http://127.0.0.1:" + port + "/health");
    const plainBody = await plain.json();
    assert.equal(plain.status, 200);
    assert.equal(plainBody.ok, true);
    assert.equal(plainBody.service, "spec-graph-sync");
    assert.equal("proof" in plainBody, false);

    const { createHmac } = await import("node:crypto");
    const nonce = "abc123nonce";
    const proven = await fetch("http://127.0.0.1:" + port + "/health?nonce=" + nonce);
    const provenBody = await proven.json();
    const expected = createHmac("sha256", "test-token").update("spec-graph-sync/health:" + nonce, "utf8").digest("hex");
    assert.equal(provenBody.proof, expected);
  });

  it("requires the writeback token on every request", async () => {
    const ctx = track(await serve({ writebackToken: "secret-token" }));
    const denied = await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" }, "");
    assert.equal(denied.status, 401);
    const wrong = await post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" }, "wrong-token");
    assert.equal(wrong.status, 401);
    const allowed = await fetch(ctx.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Spec-Writeback-Token": "secret-token" },
      body: JSON.stringify({ specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" }),
    });
    assert.equal(allowed.status, 200);
    assert.deepEqual(ctx.calls, [{ specId: "demo:TASK-1", status: "done" }]);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("runs the status sweep once on startup to replay missed events", async () => {
    const sweeps = [];
    let release;
    const done = new Promise((resolve) => { release = resolve; });
    const ctx = track(await serve({
      sweep: { sweep: async () => { sweeps.push(1); release(); } },
    }));
    await done;
    assert.equal(sweeps.length, 1);
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("serializes concurrent events in arrival order", async () => {
    const order = [];
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const ctx = track(await serve({
      writeback: { setSpecTaskStatus: async ({ specId }) => { order.push("start:" + specId); await gate; order.push("end:" + specId); return { ok: true }; } },
    }));
    const first = post(ctx.url, { specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" });
    const second = post(ctx.url, { specId: "demo:TASK-1", toState: "Open", issueId: "3-99" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    release();
    const [one, two] = await Promise.all([first, second]);
    assert.equal(one.status, 200);
    assert.equal(two.status, 200);
    assert.deepEqual(order, ["start:demo:TASK-1", "end:demo:TASK-1", "start:demo:TASK-1", "end:demo:TASK-1"]);
    await rm(ctx.dir, { recursive: true, force: true });
  });
});
