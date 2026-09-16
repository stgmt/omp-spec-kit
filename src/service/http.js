import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, InitializeRequestSchema, ListToolsRequestSchema, PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createDispatcher, serverInfo } from "./dispatch.js";

/**
 * Shared tool dispatch for the HTTP transport: same contracts, same argument
 * normalization, same envelopes as the stdio server. Transport-only fields
 * (`project`, `identity`, `force`) are stripped before the closed op args
 * reach the kernel. Auth failures map to HTTP: 401/403 from the verifier,
 * 503 (retryable) when YouTrack cannot be reached.
 */
export function createServiceApp({ mounts, authenticate, serviceOps = {}, serviceContracts = [], wrappers = {}, endpoints = {}, audit }) {
  const dispatcher = createDispatcher({ mounts, serviceOps, serviceContracts, wrappers });

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4mb" }));

  const authGate = (req, res, next) => {
    Promise.resolve()
      .then(() => authenticate(req))
      .then((ctx) => {
        req.ctx = ctx;
        next();
      })
      .catch((error) => {
        const status = Number.isSafeInteger(error?.status) ? error.status : 401;
        res.status(status).json({
          error: error?.code ?? "UNAUTHORIZED",
          message: error?.message ?? "authentication failed",
          ...(error?.retryable === true ? { retryable: true } : {}),
        });
      });
  };
  app.use("/mcp", (req, res, next) => {
    // Stateless endpoint: only POST carries JSON-RPC; other methods are 405
    // regardless of credentials (handlers registered below the gate).
    if (req.method !== "POST") {
      next();
      return;
    }
    authGate(req, res, next);
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "spec-registryd" });
  });

  app.get("/registry", authGate, async (req, res) => {
    if (typeof endpoints.registry !== "function") {
      res.status(501).json({ error: "registry endpoint is not wired" });
      return;
    }
    try {
      res.json(await endpoints.registry(req.ctx));
    } catch (error) {
      res.status(500).json({ error: "registry projection failed", message: String(error?.message ?? error) });
    }
  });
  app.get("/drift", authGate, async (req, res) => {
    if (typeof endpoints.drift !== "function") {
      res.status(501).json({ error: "drift endpoint is not wired" });
      return;
    }
    try {
      res.json(await endpoints.drift(req.ctx));
    } catch (error) {
      res.status(500).json({ error: "drift report failed", message: String(error?.message ?? error) });
    }
  });

  app.post("/onboarding/token", authGate, async (req, res) => {
    if (typeof endpoints.onboarding !== "function") {
      res.status(501).json({ error: "onboarding endpoint is not wired" });
      return;
    }
    try {
      const requested = req.body?.serviceUrl;
      const serviceUrl = typeof requested === "string" && requested.length > 0 ? requested : `${req.protocol}://${req.get("host")}`;
      res.json(await endpoints.onboarding({ ctx: req.ctx, serviceUrl, project: req.body?.project, repo: req.body?.repo }));
    } catch (error) {
      const status = Number.isSafeInteger(error?.status) ? error.status : 500;
      res.status(status).json({
        error: error?.code ?? "ONBOARDING_FAILED",
        message: String(error?.message ?? error),
        ...(error?.retryable === true ? { retryable: true } : {}),
      });
    }
  });

  // Repo bindings (TASK-17): caller identity, scopes and the bound repo set.
  app.get("/me", authGate, async (req, res) => {
    try {
      res.json(await endpoints.me(req.ctx));
    } catch (error) {
      res.status(500).json({ error: "me failed", message: String(error?.message ?? error) });
    }
  });
  app.get("/repos/bindings", authGate, async (req, res) => {
    try {
      res.json(await endpoints.repoBindings(req.ctx));
    } catch (error) {
      res.status(500).json({ error: "bindings failed", message: String(error?.message ?? error) });
    }
  });

  const repoWrite = (fn) => async (req, res) => {
    try {
      res.json(await fn({ ctx: req.ctx, ...req.body }));
    } catch (error) {
      const status = Number.isSafeInteger(error?.status) ? error.status : 500;
      res.status(status).json({
        error: error?.code ?? "REPO_OP_FAILED",
        message: String(error?.message ?? error),
        ...(error?.retryable === true ? { retryable: true } : {}),
      });
    }
  };
  app.post("/repos/probe", authGate, repoWrite((input) => endpoints.repoProbe(input)));
  app.post("/repos/bind", authGate, repoWrite((input) => endpoints.repoBind(input)));
  app.post("/repos/unbind", authGate, repoWrite((input) => endpoints.repoUnbind(input)));

  // External IdP bindings (TASK-13): probe/bind/unbind a customer's own
  // YouTrack. The minted bridge secret is returned once on bind, wrapped in
  // the install instructions for their app settings.
  app.get("/idp/bindings", authGate, async (req, res) => {
    try {
      res.json(await endpoints.idpBindings(req.ctx));
    } catch (error) {
      const status = Number.isSafeInteger(error?.status) ? error.status : 500;
      res.status(status).json({ error: error?.code ?? "IDP_FAILED", message: String(error?.message ?? error) });
    }
  });
  const idpWrite = (fn) => async (req, res) => {
    try {
      res.json(await fn({ ctx: req.ctx, ...req.body }, req));
    } catch (error) {
      const status = Number.isSafeInteger(error?.status) ? error.status : 500;
      res.status(status).json({
        error: error?.code ?? "IDP_OP_FAILED",
        message: String(error?.message ?? error),
        ...(error?.retryable === true ? { retryable: true } : {}),
      });
    }
  };
  app.post("/idp/probe", authGate, idpWrite((input) => endpoints.idpProbe(input)));
  app.post("/idp/bind", authGate, idpWrite(async (input, req) => {
    const result = await endpoints.idpBind(input);
    if (typeof result?.bridgeToken === "string") {
      const serviceUrl = mounts.config?.publicUrl ?? `${req.protocol}://${req.get("host")}`;
      result.install = {
        serviceUrl: `${serviceUrl.replace(/\/+$/, "")}`,
        serviceBridgeToken: result.bridgeToken,
        note: "store this bridge token in the YouTrack app settings on the bound instance — it is shown once",
      };
    }
    return result;
  }));
  app.post("/idp/unbind", authGate, idpWrite((input) => endpoints.idpUnbind(input)));

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
    wireProtocolHandlers(server, dispatcher, req.ctx, audit, { projectHint: req.headers["x-spec-project"] });
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

function wireProtocolHandlers(server, dispatcher, ctx, audit, { projectHint } = {}) {
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
  server.setRequestHandler(ListToolsRequestSchema, async () => dispatcher.toolListPayload(ctx));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArguments } = request.params ?? {};
    if (typeof name !== "string") {
      throw Object.assign(new Error("Unknown tool: <missing>"), { code: -32602 });
    }
    const { envelope, unknownTool } = await dispatcher.callTool({ tool: name, args: rawArguments, ctx, projectHint });
    if (unknownTool) {
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
    }
    if (typeof audit === "function") {
      try {
        audit({
          tenant: Array.isArray(ctx?.tenant) ? ctx.tenant.join(",") : ctx?.tenant ?? null,
          login: ctx?.identity?.login ?? null,
          role: ctx?.role ?? null,
          project: typeof rawArguments?.project === "string" ? rawArguments.project : null,
          op: name,
          spec: typeof rawArguments?.spec === "string" ? rawArguments.spec : null,
          requestId: typeof rawArguments?.requestId === "string" ? rawArguments.requestId : null,
          result: envelope.ok && envelope.data?.outcome !== "REFUSED" ? "ok" : `error:${envelope.error?.code ?? envelope.data?.error?.code ?? "REFUSED"}`,
        });
      } catch {}
    }
    const text = JSON.stringify(envelope);
    return {
      content: [{ type: "text", text }],
      structuredContent: envelope,
      isError: !envelope.ok || envelope.data?.outcome === "REFUSED",
    };
  });
}
