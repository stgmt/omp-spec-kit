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

  it("sends the project as a per-call argument, never as a connection header", async () => {
    const server = fakeMcpServer(async () => ({}));
    const real = globalThis.fetch;
    globalThis.fetch = server.fetch;
    try {
      const client = new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok", project: "demo/stack" });
      await client.callTool("spec_graph", { view: "board" });
      assert.equal(server.calls[0].init.headers["x-spec-project"], undefined);
      const call = server.calls.find((entry) => entry.message.method === "tools/call");
      assert.equal(call.message.params.arguments.project, "demo/stack");
      assert.equal(call.message.params.arguments.view, "board");
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
  it("routes spec_patch from the card's own qualified project key", async () => {
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
      });
      const result = await writeback.setSpecTaskStatus({ specId: "demo/stack::demo-spec:TASK-1", status: "done" });
      assert.equal(result.writeCalls, 1);
      const call = toolCalls.find((p2) => p2.name === "spec_patch");
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

  it("resolves two projects that share a slug without a lookup, touching only the addressed card", async () => {
    const patched = [];
    const server = fakeMcpServer(async (message) => {
      if (message.method === "tools/call" && message.params.name === "spec_patch") patched.push(message.params.arguments);
      return { outcome: "APPLIED" };
    });
    const real = globalThis.fetch;
    globalThis.fetch = server.fetch;
    try {
      const writeback = new HttpTaskStatusWriteback({
        client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
      });
      await writeback.setSpecTaskStatus({ specId: "team-b::native-task-review:T-12", status: "done" });
      assert.equal(patched.length, 1, "exactly one card writeback");
      assert.equal(patched[0].project, "team-b");
      assert.equal(patched[0].spec, "native-task-review");
      assert.equal(patched[0].entity, "T-12");
      assert.ok(!patched.some((call) => call.project === "team-a"), "team-a is never touched");
    } finally {
      globalThis.fetch = real;
    }
  });

  it("refuses to guess the project when the card identity carries none", async () => {
    const writeback = new HttpTaskStatusWriteback({
      client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
    });
    await assert.rejects(
      writeback.setSpecTaskStatus({ specId: "demo-spec:TASK-1", status: "done" }),
      /carries no project/,
    );
  });

  it("accepts an explicit project alongside a bare specId", async () => {
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
      });
      await writeback.setSpecTaskStatus({ specId: "demo-spec:TASK-1", project: "demo/stack", status: "todo" });
      const call = toolCalls.find((p2) => p2.name === "spec_patch");
      assert.equal(call.arguments.project, "demo/stack");
      assert.equal(call.arguments.entity, "TASK-1");
    } finally {
      globalThis.fetch = real;
    }
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
      });
      for (const specId of ["demo:", ":TASK-1", "nocolon", "", null]) {
        await assert.rejects(
          writeback.setSpecTaskStatus({ specId, project: "demo/stack", status: "done" }),
          TypeError,
          `specId=${specId}`,
        );
      }
      await assert.rejects(
        writeback.setSpecTaskStatus({ specId: "demo/stack::demo-spec:TASK-1", status: "bogus" }),
        TypeError,
      );
      assert.equal(fetches, 0, "validation failures never reach the wire");
    } finally {
      globalThis.fetch = real;
    }
  });
});

describe("HttpBoardReader", () => {
  it("merges one board per project named by the root index and tags every node", async () => {
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
        projects: async () => ["a/p", "b/p"],
      });
      const board = await reader.readBoard({ specSlugs: [] });
      const projects = toolCalls.filter((p2) => p2.name === "spec_graph").map((p2) => p2.arguments.project);
      assert.deepEqual(projects, ["a/p", "b/p"]);
      assert.equal(board.nodes.length, 2);
      assert.deepEqual(board.nodes.map((node) => node.project).sort(), ["a/p", "b/p"]);
      assert.equal("specProjects" in board, false, "no flat routing map on the board payload");
      assert.ok(board.fingerprint);
    } finally {
      globalThis.fetch = real;
    }
  });

  it("keeps the same slug and the same canonicalId in two projects, and errors only for one project duplicating itself", async () => {
    const shared = async (message) => {
      if (message.method === "tools/call") {
        const project = message.params.arguments.project;
        return {
          fingerprint: "f".repeat(64),
          scope: { specSlugs: ["native-task-review"] },
          nodes: [{ canonicalId: "native-task-review:T-12", specSlug: "native-task-review", kind: "TASK" }],
          edges: [],
        };
      }
      return {};
    };
    const real = globalThis.fetch;
    globalThis.fetch = fakeMcpServer(shared).fetch;
    try {
      const reader = new HttpBoardReader({
        client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
        projects: async () => ["team-a", "team-b"],
      });
      const board = await reader.readBoard({ specSlugs: [] });
      assert.equal(board.nodes.length, 2, "both projects keep their own card");
      assert.deepEqual(board.nodes.map((n) => n.canonicalId), ["native-task-review:T-12", "native-task-review:T-12"]);
      assert.deepEqual(board.scope.specSlugs, ["native-task-review"], "the slug is listed once");
    } finally {
      globalThis.fetch = real;
    }

    globalThis.fetch = fakeMcpServer(async (message) => {
      if (message.method === "tools/call") {
        return {
          fingerprint: "f".repeat(64),
          scope: { specSlugs: ["s"] },
          nodes: [
            { canonicalId: "s:1", specSlug: "s", kind: "TASK" },
            { canonicalId: "s:1", specSlug: "s", kind: "TASK" },
          ],
          edges: [],
        };
      }
      return {};
    }).fetch;
    try {
      const reader = new HttpBoardReader({
        client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
        projects: async () => ["a/p"],
      });
      await assert.rejects(reader.readBoard({ specSlugs: [] }), /served by both a\/p and a\/p/);
    } finally {
      globalThis.fetch = real;
    }
  });

  it("reads no board at all when the root index names no project", async () => {
    const toolCalls = [];
    const real = globalThis.fetch;
    globalThis.fetch = fakeMcpServer(async (message) => {
      if (message.method === "tools/call") toolCalls.push(message.params);
      return { fingerprint: "f".repeat(64), scope: { specSlugs: [] }, nodes: [], edges: [] };
    }).fetch;
    try {
      const reader = new HttpBoardReader({
        client: new HttpMcpClient({ baseUrl: "http://registry.test", token: "tok" }),
        projects: async () => [],
      });
      const board = await reader.readBoard({ specSlugs: [] });
      assert.equal(toolCalls.filter((p2) => p2.name === "spec_graph").length, 0);
      assert.deepEqual(board.nodes, []);
    } finally {
      globalThis.fetch = real;
    }
  });
});
