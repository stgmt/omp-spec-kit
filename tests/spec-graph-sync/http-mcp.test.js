import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpMcpClient, HttpBoardReader, HttpTaskStatusWriteback } from "../../scripts/spec-graph-sync.mjs";

function fakeMcpServer(handler) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init, message: JSON.parse(init.body) });
    const message = JSON.parse(init.body);
    const data = await handler(message);
    const envelope = { ok: true, data };
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result:
          message.method === "tools/call"
            ? { content: [{ type: "text", text: JSON.stringify(envelope) }], structuredContent: envelope }
            : { serverInfo: { name: "spec-registryd" } },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  return { calls, fetch };
}

describe("HttpMcpClient", () => {
  it("handshakes then issues tools/call and returns the envelope data", async () => {
    const server = fakeMcpServer(async (message) =>
      message.method === "tools/call" ? { nodes: [] } : {},
    );
    const real = globalThis.fetch;
    globalThis.fetch = server.fetch;
    try {
      const client = new HttpMcpClient({ baseUrl: "http://registry.test/", token: "tok" });
      const data = await client.callTool("spec_graph", { view: "board", specSlugs: [] });
      assert.deepEqual(data, { nodes: [] });
      assert.deepEqual(server.calls.map((c) => c.message.method), ["initialize", "tools/call"]);
      assert.equal(server.calls[0].init.headers.Authorization, "Bearer tok");
      assert.equal(server.calls[0].url, "http://registry.test/mcp");
    } finally {
      globalThis.fetch = real;
    }
  });

  it("sends the x-spec-project hint when configured", async () => {
    const server = fakeMcpServer(async () => ({}));
    const real = globalThis.fetch;
    globalThis.fetch = server.fetch;
    try {
      const client = new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok", project: "demo/stack" });
      await client.callTool("spec_graph", { view: "board" });
      assert.equal(server.calls[0].init.headers["x-spec-project"], "demo/stack");
    } finally {
      globalThis.fetch = real;
    }
  });

  it("rejects on a non-ok envelope and on transport errors", async () => {
    const real = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 2, result: { structuredContent: { ok: false, error: { message: "CLAIM_HELD" } } } }),
        { status: 200 },
      );
    try {
      const client = new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" });
      await assert.rejects(client.callTool("spec_patch", {}), /CLAIM_HELD/);
      globalThis.fetch = async () => new Response("nope", { status: 503 });
      await assert.rejects(client.callTool("spec_graph", {}), /MCP HTTP 503/);
    } finally {
      globalThis.fetch = real;
    }
  });

  it("rejects invalid JSON bodies, JSON-RPC errors, and honors the content-text fallback", async () => {
    const real = globalThis.fetch;
    try {
      const client = new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" });
      // 200 with a non-JSON body → typed invalid-JSON error, not a SyntaxError.
      globalThis.fetch = async () => new Response("<html>proxy error</html>", { status: 200 });
      await assert.rejects(client.callTool("spec_graph", {}), /invalid JSON/);
      // A JSON-RPC error member rejects with its message.
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, error: { message: "method not found" } }), { status: 200 });
      await assert.rejects(client.callTool("spec_graph", {}), /method not found/);
      // Legacy content-text envelope (no structuredContent) is still parsed.
      globalThis.fetch = async (url, init = {}) => {
        const message = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            result:
              message.method === "tools/call"
                ? { content: [{ type: "text", text: JSON.stringify({ ok: true, data: { via: "text" } }) }] }
                : { serverInfo: { name: "spec-registryd" } },
          }),
          { status: 200 },
        );
      };
      const data = await client.callTool("spec_graph", {});
      assert.deepEqual(data, { via: "text" });
    } finally {
      globalThis.fetch = real;
    }
  });
});

describe("HttpTaskStatusWriteback", () => {
  it("routes spec_patch to the project recorded in the committed marker", async () => {
    const toolCalls = [];
    const server = fakeMcpServer(async (message) => {
      if (message.method === "tools/call") toolCalls.push(message.params);
      return { outcome: "APPLIED" };
    });
    const real = globalThis.fetch;
    globalThis.fetch = server.fetch;
    try {
      const writeback = new HttpTaskStatusWriteback({
        client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
        specProjects: async () => ({ "demo-spec": "demo/stack" }),
      });
      const result = await writeback.setSpecTaskStatus({ specId: "demo-spec:TASK-1", status: "done" });
      assert.equal(result.writeCalls, 1);
      const call = toolCalls.find((p) => p.name === "spec_patch");
      assert.equal(call.arguments.spec, "demo-spec");
      assert.equal(call.arguments.project, "demo/stack");
      assert.equal(call.arguments.entity, "TASK-1");
      assert.equal(call.arguments.intent, "setEntityStatus");
      assert.equal(call.arguments.status, "done");
      assert.equal(call.arguments.dryRun, false);
    } finally {
      globalThis.fetch = real;
    }
  });

  it("refuses to guess the project when the marker predates specProjects", async () => {
    const writeback = new HttpTaskStatusWriteback({
      client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
      specProjects: async () => ({}),
    });
    await assert.rejects(writeback.setSpecTaskStatus({ specId: "demo-spec:TASK-1", status: "done" }), /serving project/);
  });

  it("rejects malformed specId and unknown status before any network call", async () => {
    const real = globalThis.fetch;
    let fetches = 0;
    globalThis.fetch = async () => {
      fetches += 1;
      return new Response("{}", { status: 200 });
    };
    try {
      const writeback = new HttpTaskStatusWriteback({
        client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
        specProjects: async () => ({ "demo-spec": "demo/stack" }),
      });
      for (const specId of ["demo:", ":TASK-1", "nocolon", "", null]) {
        await assert.rejects(writeback.setSpecTaskStatus({ specId, status: "done" }), TypeError, `specId=${specId}`);
      }
      await assert.rejects(
        writeback.setSpecTaskStatus({ specId: "demo-spec:TASK-1", status: "bogus" }),
        TypeError,
      );
      assert.equal(fetches, 0, "validation failures never reach the wire");
    } finally {
      globalThis.fetch = real;
    }
  });
});

describe("HttpBoardReader", () => {
  it("merges one board per serving project and re-derives the specProjects map", async () => {
    const toolCalls = [];
    const server = fakeMcpServer(async (message) => {
      if (message.method === "tools/call") {
        toolCalls.push(message.params);
        const project = message.params.arguments.project;
        return {
          fingerprint: project === "a/p" ? "a".repeat(64) : "b".repeat(64),
          scope: { specSlugs: ["spec-" + project.replace("/", "")] },
          nodes: [{ canonicalId: project + ":1", specSlug: project, kind: "TASK" }],
          edges: [],
        };
      }
      return {};
    });
    const real = globalThis.fetch;
    globalThis.fetch = server.fetch;
    try {
      const reader = new HttpBoardReader({
        client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
        specProjects: async () => ({ s1: "a/p", s2: "b/p" }),
      });
      const board = await reader.readBoard({ specSlugs: [] });
      const projects = toolCalls.filter((p) => p.name === "spec_graph").map((p) => p.arguments.project);
      assert.deepEqual(projects, ["a/p", "b/p"]);
      assert.equal(board.nodes.length, 2);
      assert.ok(board.fingerprint);
      assert.deepEqual(
        { ...board.specProjects },
        { "spec-ap": "a/p", "spec-bp": "b/p" },
        "the reader re-derives the routing map so republish does not sign nulls",
      );
    } finally {
      globalThis.fetch = real;
    }
  });

  it("throws on a canonicalId or slug claimed by two projects instead of picking a silent winner", async () => {
    for (const collide of ["node", "slug"]) {
      const server = fakeMcpServer(async (message) => {
        if (message.method === "tools/call") {
          const project = message.params.arguments.project;
          return {
            fingerprint: "f".repeat(64),
            scope: { specSlugs: [collide === "slug" ? "shared-slug" : "spec-" + project.replace("/", "")] },
            nodes: [{ canonicalId: collide === "node" ? "shared:1" : project + ":1", specSlug: project, kind: "TASK" }],
            edges: [],
          };
        }
        return {};
      });
      const real = globalThis.fetch;
      globalThis.fetch = server.fetch;
      try {
        const reader = new HttpBoardReader({
          client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
          specProjects: async () => ({ s1: "a/p", s2: "b/p" }),
        });
        await assert.rejects(reader.readBoard({ specSlugs: [] }), /served by both a\/p and b\/p/);
      } finally {
        globalThis.fetch = real;
      }
    }
  });

  it("falls back to a single unhinted board when specProjects is empty", async () => {
    const toolCalls = [];
    const server = fakeMcpServer(async (message) => {
      if (message.method === "tools/call") {
        toolCalls.push(message.params);
        return { fingerprint: "f".repeat(64), scope: { specSlugs: [] }, nodes: [], edges: [] };
      }
      return {};
    });
    const real = globalThis.fetch;
    globalThis.fetch = server.fetch;
    try {
      const reader = new HttpBoardReader({
        client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
        specProjects: async () => ({}),
      });
      await reader.readBoard({ specSlugs: [] });
      const calls = toolCalls.filter((p) => p.name === "spec_graph");
      assert.equal(calls.length, 1);
      assert.equal("project" in calls[0].arguments, false);
    } finally {
      globalThis.fetch = real;
    }
  });
});
