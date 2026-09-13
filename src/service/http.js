import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, InitializeRequestSchema, ListToolsRequestSchema, PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createDispatcher, serverInfo } from "./dispatch.js";

/**
 * Shared tool dispatch for the HTTP transport: same contracts, same argument
 * normalization, same envelopes as the stdio server. Transport-only fields
 * (`project`, `identity`, `force`) are stripped before the closed op args
 * reach the kernel.
 */
export function createServiceApp({ mounts, authenticate, serviceOps = {} }) {
  const dispatcher = createDispatcher({ mounts, serviceOps });

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4mb" }));
  app.use("/mcp", (req, res, next) => {
    try {
      req.ctx = authenticate(req);
    } catch (error) {
      res.status(401).json({ error: "unauthorized", message: error?.message ?? "authentication failed" });
      return;
    }
    next();
  });

  app.get("/mcp", (_req, res) => {
    res.set("Allow", "POST");
    res.status(405).json({ error: "method not allowed: this endpoint is stateless and serves JSON-RPC over POST only" });
  });
  app.delete("/mcp", (_req, res) => {
    res.set("Allow", "POST");
    res.status(405).json({ error: "method not allowed: nothing to terminate in stateless mode" });
  });

  app.post("/mcp", async (req, res) => {
    // Stateless mode per SDK docs: a fresh transport per request, no session id.
    const info = serverInfo();
    const server = new Server(info, { capabilities: { tools: {} } });
    wireProtocolHandlers(server, dispatcher, req.ctx);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ error: "internal error", message: String(error?.message ?? error) });
    }
  });

  return app;
}

function wireProtocolHandlers(server, dispatcher, ctx) {
  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    const requested = typeof request.params?.protocolVersion === "string" ? request.params.protocolVersion : "2025-03-26";
    const info = serverInfo();
    return {
      protocolVersion: requested,
      capabilities: { tools: {} },
      serverInfo: { name: info.name, version: info.version },
      instructions: info.instructions,
    };
  });
  server.setRequestHandler(PingRequestSchema, async () => ({}));
  server.setRequestHandler(ListToolsRequestSchema, async () => dispatcher.toolListPayload());
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArguments } = request.params ?? {};
    if (typeof name !== "string") {
      throw Object.assign(new Error("Unknown tool: <missing>"), { code: -32602 });
    }
    const { envelope, unknownTool } = await dispatcher.callTool({ tool: name, args: rawArguments, ctx });
    if (unknownTool) {
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
    }
    const text = JSON.stringify(envelope);
    return {
      content: [{ type: "text", text }],
      structuredContent: envelope,
      isError: !envelope.ok || envelope.data?.outcome === "REFUSED",
    };
  });
}

export function bearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}
