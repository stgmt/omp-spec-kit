import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it } from "node:test";
import { stableJson, SYNC_STATE_SPEC_ID } from "../../src/adapters/youtrack-projection.js";

const execFileAsync = promisify(execFile);
const SYNC_SCRIPT = path.resolve("scripts/spec-graph-sync.mjs");
const ENSURE_SCRIPT = path.resolve("scripts/spec-listener-ensure.mjs");
const MARKER_SECRET = "cli-test-marker-secret-0123456789abcdef";

async function run(script, { args = [], env = {}, timeout = 60_000 } = {}) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...args], {
      env: { ...process.env, ...env },
      timeout,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? String(error) };
  }
}

/** In-process stub: request -> {method, url, body} -> handler -> [status, data]. */
async function stubServer(handler) {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    let body = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {}
    const [status, data] = await handler(req.method, req.url, body, req.headers);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

describe("spec-graph-sync CLI wiring", () => {
  it("registry mode refuses to start without SPEC_AGENT_TOKEN", async () => {
    const result = await run(SYNC_SCRIPT, {
      env: {
        SPEC_REGISTRY_URL: "http://127.0.0.1:1",
        SPEC_AGENT_TOKEN: "",
        YOUTRACK_TOKEN: "yt-token-0123456789abcdef",
        SPEC_SYNC_MARKER_KEY: MARKER_SECRET,
      },
    });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /SPEC_AGENT_TOKEN/);
  });

  it("a registry-mode sync republishes the marker with a usable specProjects map", async () => {
    // Seeded v3 marker signed with MARKER_SECRET — ownership must verify.
    const unsigned = {
      schemaVersion: "BoardSnapshotV1",
      projectionVersion: 3,
      complete: true,
      fingerprint: "x".repeat(64),
      snapshotHash: "s".repeat(64),
      projectionDigest: "d".repeat(64),
      scope: { mode: "corpus", specSlugs: ["demo-spec"] },
      nodeCount: 1,
      edgeCount: 0,
      mountHeads: {},
      mountsClean: true,
      specProjects: { "demo-spec": "demo/stack" },
      skippedProjects: [],
      cardIds: {},
      snapshot: { nodes: [], edges: [] },
      committedAt: new Date(0).toISOString(),
    };
    const marker = {
      ...unsigned,
      signature: createHmac("sha256", MARKER_SECRET).update(stableJson(unsigned), "utf8").digest("hex"),
    };
    const markerIssue = {
      id: "3-99",
      idReadable: "SPEC-1",
      summary: SYNC_STATE_SPEC_ID,
      description: "SPEC-SYNC-STATE\n" + JSON.stringify(marker),
      customFields: [{ name: "SpecId", value: SYNC_STATE_SPEC_ID }],
    };

    const ytWrites = [];
    const yt = await stubServer(async (method, url, body) => {
      const pathname = url.split("?")[0];
      if (method === "GET" && pathname === "/api/admin/projects") return [200, [{ id: "0-1", shortName: "SPEC" }]];
      if (method === "GET" && pathname === "/api/issues") return [200, [markerIssue]];
      if (method === "GET" && pathname.startsWith("/api/admin/projects/")) return [200, []];
      if (method === "GET" && pathname === "/api/issueLinkTypes") return [200, []];
      if (method === "GET" && /\/api\/issues\/[^/]+\/links$/.test(pathname)) return [200, []];
      if (method === "POST" && /\/api\/issues\/[^/]+/.test(pathname)) {
        ytWrites.push(body);
        return [200, { id: "3-99" }];
      }
      if (method === "POST" && pathname === "/api/issues") {
        ytWrites.push(body);
        return [200, { id: "3-100", idReadable: "SPEC-2" }];
      }
      if (method === "POST" && pathname === "/api/commands") return [200, {}];
      if (method === "DELETE") return [200, {}];
      return [404, { error: `unhandled ${method} ${pathname}` }];
    });

    const boardCalls = [];
    const mcp = await stubServer(async (method, url, body) => {
      assert.equal(method, "POST", "MCP is POST-only");
      if (body?.method === "initialize") return [200, { jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "spec-registryd" } } }];
      if (body?.method === "tools/call") {
        boardCalls.push(body.params);
        const data = {
          fingerprint: "f".repeat(64),
          scope: { mode: "corpus", specSlugs: ["demo-spec"] },
          nodes: [
            {
              canonicalId: "demo-spec:TASK-1",
              specSlug: "demo-spec",
              localId: "TASK-1",
              kind: "TASK",
              title: "t",
              body: "Status: todo",
              contentHash: "h1",
              source: { path: "FR.md" },
              taskStatus: "todo",
            },
          ],
          edges: [],
          counts: { nodes: 1, edges: 0 },
        };
        return [200, { jsonrpc: "2.0", id: body.id, result: { structuredContent: { ok: true, data }, content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }] } }];
      }
      return [404, { error: "unhandled" }];
    });

    try {
      const result = await run(SYNC_SCRIPT, {
        env: {
          SPEC_REGISTRY_URL: mcp.base,
          SPEC_AGENT_TOKEN: "agent-token-0123456789abcdef",
          SPEC_SYNC_MARKER_KEY: MARKER_SECRET,
          YOUTRACK_HOST: yt.base,
          YOUTRACK_TOKEN: "yt-token-0123456789abcdef",
        },
      });
      assert.equal(result.code, 0, `stderr: ${result.stderr}`);
      // The per-project board fetch carried the project from the committed marker.
      const graphCalls = boardCalls.filter((call) => call.name === "spec_graph");
      assert.equal(graphCalls.length, 1);
      assert.equal(graphCalls[0].arguments.project, "demo/stack");
      // The republished marker keeps a usable routing map instead of null.
      const markerWrite = ytWrites.find((w) => typeof w?.description === "string" && w.description.startsWith("SPEC-SYNC-STATE"));
      assert.ok(markerWrite, "the marker was republished");
      const republished = JSON.parse(markerWrite.description.slice("SPEC-SYNC-STATE\n".length));
      assert.deepEqual(republished.specProjects, { "demo-spec": "demo/stack" });
    } finally {
      await Promise.all([yt.close(), mcp.close()]);
    }
  });

  it("--serve in registry mode routes writeback spec_patch through the service /mcp", async () => {
    // Seeded v3 marker: the card SPEC-2 owns demo-spec:TASK-1, served by
    // project demo/stack — writeback must resolve the project from it.
    const unsigned = {
      schemaVersion: "BoardSnapshotV1",
      projectionVersion: 3,
      complete: true,
      fingerprint: "x".repeat(64),
      snapshotHash: "s".repeat(64),
      projectionDigest: "d".repeat(64),
      scope: { mode: "corpus", specSlugs: ["demo-spec"] },
      nodeCount: 1,
      edgeCount: 0,
      mountHeads: {},
      mountsClean: true,
      specProjects: { "demo-spec": "demo/stack" },
      skippedProjects: [],
      cardIds: { "demo-spec:TASK-1": "SPEC-2" },
      snapshot: { nodes: [{ canonicalId: "demo-spec:TASK-1", kind: "TASK", taskStatus: "todo" }], edges: [] },
      committedAt: new Date(0).toISOString(),
    };
    const marker = {
      ...unsigned,
      signature: createHmac("sha256", MARKER_SECRET).update(stableJson(unsigned), "utf8").digest("hex"),
    };
    const markerIssue = {
      id: "3-99",
      idReadable: "SPEC-1",
      summary: SYNC_STATE_SPEC_ID,
      description: "SPEC-SYNC-STATE\n" + JSON.stringify(marker),
      customFields: [{ name: "SpecId", value: SYNC_STATE_SPEC_ID }],
    };
    const cardIssue = {
      id: "3-5",
      idReadable: "SPEC-2",
      project: { shortName: "SPEC" },
      customFields: [
        { name: "SpecId", value: "demo-spec:TASK-1" },
        { name: "SpecKind", value: "TASK" },
        { name: "State", value: { name: "Fixed" } },
      ],
    };
    const yt = await stubServer(async (method, url) => {
      const pathname = url.split("?")[0];
      if (method === "GET" && pathname === "/api/admin/projects") return [200, [{ id: "0-1", shortName: "SPEC" }]];
      if (method === "GET" && pathname === "/api/issues/3-5") return [200, cardIssue];
      if (method === "GET" && pathname === "/api/issues") return [200, [markerIssue, cardIssue]];
      if (method === "GET" && pathname.startsWith("/api/admin/projects/")) return [200, []];
      if (method === "GET" && pathname === "/api/issueLinkTypes") return [200, []];
      if (method === "POST" && pathname === "/api/commands") return [200, {}];
      return [404, { error: `unhandled ${method} ${pathname}` }];
    });
    const patchCalls = [];
    const mcp = await stubServer(async (method, url, body) => {
      if (body?.method === "initialize") return [200, { jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "spec-registryd" } } }];
      if (body?.method === "tools/call") {
        patchCalls.push(body.params);
        const data =
          body.params.name === "spec_graph"
            ? {
                fingerprint: "f".repeat(64),
                scope: { mode: "corpus", specSlugs: ["demo-spec"] },
                nodes: [
                  {
                    canonicalId: "demo-spec:TASK-1",
                    specSlug: "demo-spec",
                    localId: "TASK-1",
                    kind: "TASK",
                    title: "t",
                    body: "Status: todo",
                    contentHash: "h1",
                    source: { path: "TASKS.md" },
                    taskStatus: "todo",
                  },
                ],
                edges: [],
                counts: { nodes: 1, edges: 0 },
              }
            : { outcome: "APPLIED" };
        return [200, { jsonrpc: "2.0", id: body.id, result: { structuredContent: { ok: true, data }, content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }] } }];
      }
      return [404, { error: "unhandled" }];
    });

    const dir = await mkdtemp(path.join(tmpdir(), "serve-cli-"));
    const outbox = path.join(dir, "outbox.jsonl");
    // Grab a free port, release it, hand it to the spawned listener.
    const probe = http.createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));

    const child = spawn(process.execPath, [SYNC_SCRIPT, "--serve", "--port", String(port)], {
      env: {
        ...process.env,
        SPEC_REGISTRY_URL: mcp.base,
        SPEC_AGENT_TOKEN: "agent-token-0123456789abcdef",
        SPEC_SYNC_MARKER_KEY: MARKER_SECRET,
        SPEC_WRITEBACK_TOKEN: "w".repeat(32),
        YOUTRACK_HOST: yt.base,
        YOUTRACK_TOKEN: "yt-token-0123456789abcdef",
        SPEC_SYNC_OUTBOX: outbox,
        SPEC_SYNC_SWEEP_INTERVAL_MS: "600000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let childErr = "";
    child.stderr.on("data", (d) => (childErr += d));
    try {
      const base = `http://127.0.0.1:${port}`;
      let up = false;
      for (let i = 0; i < 80; i += 1) {
        if (child.exitCode !== null) break;
        try {
          const health = await fetch(`${base}/health`);
          if (health.ok) {
            up = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.ok(up, `listener did not come up (exit=${child.exitCode}): ${childErr}`);
      const response = await fetch(`${base}/writeback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Spec-Writeback-Token": "w".repeat(32) },
        body: JSON.stringify({ specId: "demo-spec:TASK-1", toState: "Fixed", issueId: "3-5" }),
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.applied, true, JSON.stringify(result));
      assert.equal(result.status, "done");
      const patch = patchCalls.find((p) => p.name === "spec_patch");
      assert.ok(patch, "spec_patch reached the registry /mcp — not a local checkout");
      assert.equal(patch.arguments.project, "demo/stack", "routed to the marker-owned project");
      assert.equal(patch.arguments.spec, "demo-spec");
      assert.equal(patch.arguments.entity, "TASK-1");
      assert.equal(patch.arguments.status, "done");
    } finally {
      child.kill();
      await Promise.all([yt.close(), mcp.close(), rm(dir, { recursive: true, force: true }).catch(() => {})]);
    }
  });

  it("spec-listener-ensure warns loudly when the registry URL is unset", async () => {
    const result = await run(ENSURE_SCRIPT, {
      env: {
        SPEC_WRITEBACK_TOKEN: "t".repeat(32),
        YOUTRACK_TOKEN: "yt-token",
        SPEC_REGISTRY_URL: "",
        SPEC_SYNC_MARKER_KEY: MARKER_SECRET,
      },
    });
    // The listener spawn itself fails fast (no corpus root reachable), which is
    // expected — the assertion is on the diagnostic, not on a live listener.
    assert.match(result.stderr, /SPEC_REGISTRY_URL is unset/);
    assert.equal(result.stderr.includes("SPEC_SYNC_MARKER_KEY is unset"), false, "marker key set -> no marker warning");
    // Kill the spawned listener if it somehow came up.
    const pidMatch = /"pid":\s*(\d+)/.exec(result.stdout);
    if (pidMatch) {
      try {
        process.kill(Number(pidMatch[1]));
      } catch {}
    }
  });

  it("spec-listener-ensure warns loudly when SPEC_SYNC_MARKER_KEY is unset", async () => {
    const result = await run(ENSURE_SCRIPT, {
      env: {
        SPEC_WRITEBACK_TOKEN: "t".repeat(32),
        YOUTRACK_TOKEN: "yt-token",
        SPEC_REGISTRY_URL: "http://127.0.0.1:1",
        SPEC_SYNC_MARKER_KEY: "",
      },
    });
    assert.match(result.stderr, /SPEC_SYNC_MARKER_KEY is unset/);
    const pidMatch = /"pid":\s*(\d+)/.exec(result.stdout);
    if (pidMatch) {
      try {
        process.kill(Number(pidMatch[1]));
      } catch {}
    }
  });
});
