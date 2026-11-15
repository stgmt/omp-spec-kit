import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, InitializeRequestSchema, ListToolsRequestSchema, PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createDispatcher, serverInfo } from "./dispatch.js";
import { sanitizeRepoUrl } from "./mounts.js";
import { scopeFromContext, requireScope } from "./scope.js";

/**
 * Shared tool dispatch for the HTTP transport: same contracts, same argument
 * normalization, same envelopes as the stdio server. Transport-only fields
 * (`project`, `identity`, `force`) are stripped before the closed op args
 * reach the kernel. Auth failures map to HTTP: 401/403 from the verifier,
 * 503 (retryable) when YouTrack cannot be reached.
 */
export function createServiceApp({ mounts, authenticate, serviceOps = {}, serviceContracts = [], wrappers = {}, endpoints = {}, audit, sync = null, webhookSecret = null, env = process.env }) {
  // The hosted transport selects a corpus by project only: a local worktree
  // path is refused rather than silently routed.
  const dispatcher = createDispatcher({ mounts, serviceOps, serviceContracts, wrappers, allowDeclaredWorktree: false });

  const app = express();
  app.disable("x-powered-by");

  // GitHub push webhook (FR-10): the low-latency trigger the spec already
  // allows. The signature is computed over the raw bytes, so this route owns
  // its body parser and must stay above the shared JSON middleware.
  app.post("/webhook/github", express.raw({ type: "application/json", limit: "2mb" }), async (req, res) => {
    if (typeof webhookSecret !== "string" || webhookSecret.length === 0) {
      res.status(503).json({ error: "WEBHOOK_DISABLED", message: "SPEC_REGISTRY_WEBHOOK_SECRET is not set" });
      return;
    }
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!verifyGitHubSignature(webhookSecret, raw, req.get("x-hub-signature-256"))) {
      res.status(401).json({ error: "INVALID_SIGNATURE", message: "X-Hub-Signature-256 does not match the payload" });
      return;
    }
    if (req.get("x-github-event") !== "push") {
      res.status(202).json({ ok: true, ignored: "event" });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      res.status(400).json({ error: "INVALID_PAYLOAD", message: "webhook body is not JSON" });
      return;
    }
    const repoUrl = payload?.repository?.clone_url ?? payload?.repository?.html_url ?? null;
    const ref = typeof payload?.ref === "string" ? payload.ref : null;
    const projects = typeof repoUrl === "string" ? mounts.projectsForRepo(repoUrl) : [];
    if (projects.length === 0) {
      res.status(202).json({ ok: true, ignored: "repository", projects: [] });
      return;
    }
    if (ref !== null && !ref.startsWith("refs/heads/spec-")) {
      res.status(202).json({ ok: true, ignored: "ref", projects: [] });
      return;
    }
    for (const project of projects) mounts.markStale(project);
    // The push is already accepted: answer immediately and let the reconcile
    // fetch, publish and re-project in the background.
    Promise.resolve().then(() => sync?.reconcile?.()).catch(() => {});
    res.status(202).json({ ok: true, projects });
  });

  app.use(express.json({ limit: "4mb" }));

  const authGate = (req, res, next) => {
    Promise.resolve()
      .then(() => authenticate(req))
      .then((ctx) => {
        // One construction site for the request scope: every surface below
        // (MCP dispatch, /status, /me, bindings) reads it
        // from here instead of filtering project lists of its own.
        //
        // A login's own registrations widen its scope and nothing else: the
        // scope set still comes from the verified identity, so a registration
        // can never grant access to a project someone else registered.
        const registered = mounts?.registeredProjectsBy?.(ctx?.identity?.login) ?? [];
        const scopes = registered.length === 0
          ? ctx?.scopes
          : [...new Set([...(Array.isArray(ctx?.scopes) ? ctx.scopes : []), ...registered])];
        req.ctx = { ...ctx, scopes, scope: scopeFromContext({ ...ctx, scopes }) };
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
    res.json({
      ok: true,
      service: "spec-registryd",
      // Instance fingerprint distinguishes this registry from a sibling stack
      // answering on a neighbouring port; unauthenticated so endpoint probes
      // and the registry doctor can verify identity before trusting a URL.
      fingerprint: mounts?.config?.fingerprint ?? process.env.SPEC_REGISTRY_INSTANCE ?? null,
    });
  });

  // Machine-local agent onboarding. A caller on the registry's own host asks
  // for its own agent credential instead of hunting one down in YouTrack. Two
  // gates, both fail-closed, decided before any minting work: the request must
  // arrive from this host (nothing is presented, so the peer address IS the
  // authorization) and the operator must have named the login to mint for.
  app.post("/local/token", async (req, res) => {
    if (!isLocalBootstrapPeer(req.socket?.remoteAddress)) {
      res.status(403).json({
        error: "LOCAL_BOOTSTRAP_FORBIDDEN",
        message: "local token bootstrap is only available to callers on this host",
      });
      return;
    }
    const login = typeof env.SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN === "string" ? env.SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN.trim() : "";
    if (login.length === 0) {
      res.status(409).json({
        error: "LOCAL_BOOTSTRAP_DISABLED",
        message: "set SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN to the login the local bootstrap may mint for",
      });
      return;
    }
    if (typeof endpoints.localToken !== "function") {
      res.status(501).json({ error: "local token bootstrap is not wired" });
      return;
    }
    try {
      // The value goes back to the caller that asked for it and nowhere else:
      // no log line, no audit row — only the fact of issuance is recorded.
      const issued = await endpoints.localToken({ login, serviceUrl: `${req.protocol}://${req.get("host")}` });
      res.json({ token: issued.token, login: issued.login ?? login });
    } catch (error) {
      const status = Number.isSafeInteger(error?.status) ? error.status : 500;
      res.status(status).json({
        error: error?.code ?? "LOCAL_BOOTSTRAP_FAILED",
        message: String(error?.message ?? error),
        ...(error?.retryable === true ? { retryable: true } : {}),
      });
    }
  });

  app.get("/status", authGate, async (req, res) => {
    const scope = requireScope(req.ctx?.scope, "GET /status");
    const projects = [];
    for (const project of scope.projects) {
      const row = mounts.store?.getBinding?.(project) ?? null;
      const active = row?.status === "active";
      let specs = null;
      let error = null;
      try {
        const { branches } = await mounts.listBranches(project);
        specs = branches.filter((branch) => branch.kind === "spec").length;
      } catch (cause) {
        error = cause?.code ?? "ADAPTER_READ_ERROR";
      }
      projects.push({
        project,
        binding: row?.status ?? "required",
        repoUrl: active ? sanitizeRepoUrl(row.repoUrl) : null,
        specs,
        error,
        setup: active
          ? { required: false, code: null, command: null }
          : {
              required: true,
              code: "REPO_BINDING_REQUIRED",
              command: `call spec_repo {"action":"bind","project":"${project}","repoUrl":"<git-url>","token":"<fine-grained-pat-with-contents-rw>"}`,
            },
      });
    }
    res.json({ ok: true, projects });
  });

  // Tracker projection ops: inspect the serialized sync loop and force a
  // re-projection on demand (after tracker-side cleanup or a v-bump). These
  // are operator surface — a sync writes cards across EVERY mounted project
  // and re-publishes the committed marker, so tenant-scoped caller roles
  // (writer/reader) must not reach them.
  const ownerGate = (req, res, next) => {
    if (req.ctx?.role !== "owner") {
      res.status(403).json({ error: "FORBIDDEN_ROLE", message: `projection ops require the owner role (caller role: ${req.ctx?.role ?? "none"})` });
      return;
    }
    next();
  };
  app.get("/projection/status", authGate, ownerGate, async (req, res) => {
    if (typeof endpoints.projectionStatus !== "function") {
      res.status(501).json({ error: "projection status endpoint is not wired" });
      return;
    }
    try {
      res.json(await endpoints.projectionStatus(req.ctx));
    } catch (error) {
      res.status(500).json({ error: "projection status failed", message: String(error?.message ?? error) });
    }
  });
  app.post("/projection/sync", authGate, ownerGate, async (req, res) => {
    if (typeof endpoints.projectionSync !== "function") {
      res.status(501).json({ error: "projection sync endpoint is not wired" });
      return;
    }
    try {
      res.json(await endpoints.projectionSync(req.ctx));
    } catch (error) {
      res.status(500).json({ error: "projection sync failed", message: String(error?.message ?? error) });
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
      // Snippets generated here feed host-side client configs, so the URL is
      // host-validated by default; in-network callers (the app bridge) opt out
      // explicitly with audience "internal".
      const audience = req.body?.audience === "internal" ? "internal" : "host";
      res.json(await endpoints.onboarding({ ctx: req.ctx, serviceUrl, project: req.body?.project, repo: req.body?.repo, token: req.body?.token, audience }));
    } catch (error) {
      const status = Number.isSafeInteger(error?.status) ? error.status : 500;
      res.status(status).json({
        error: error?.code ?? "ONBOARDING_FAILED",
        message: String(error?.message ?? error),
        ...(error?.retryable === true ? { retryable: true } : {}),
      });
    }
  });

  // Identity is a session read, not spec data: role, tenant and the repository
  // state of each project in the caller's scope (the scope object above).
  app.get("/me", authGate, async (req, res) => {
    try {
      res.json(await endpoints.me(req.ctx));
    } catch (error) {
      res.status(500).json({ error: "me failed", message: String(error?.message ?? error) });
    }
  });
  // Repository binding is a tool (spec_repo): its REST mirrors were a second
  // surface with a second scope filter and are gone.
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
    // The header is gone for good: a client that still sends it must learn that
    // rather than get a corpus chosen behind the call's back.
    if (req.headers["x-spec-project"] !== undefined) {
      res.status(400).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32600,
          message: "PROJECT_HEADER_REMOVED: X-Spec-Project is no longer read; pass project (owner/project) on the call, or configure the workspace project record",
        },
      });
      return;
    }
    // Stateless mode per SDK docs: a fresh transport per request, no session id.
    const info = serverInfo();
    const server = new Server(info, { capabilities: { tools: {} } });
    wireProtocolHandlers(server, dispatcher, req.ctx, audit);
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

/**
 * Addresses that mean "this very machine". Only literals are accepted: a
 * hostname would have to be resolved, and `req.socket.remoteAddress` already
 * reports the connected address (IPv4 peers arrive as `::ffff:127.0.0.1`).
 */
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** The strict form: the peer really is the loopback interface. */
export function isLoopbackAddress(remoteAddress) {
  return typeof remoteAddress === "string" && LOOPBACK_ADDRESSES.has(remoteAddress);
}

/**
 * Where a *containerized* service sees its own host. Docker publishes a bound
 * port by NAT, so a request from the host arrives from the container's default
 * gateway (measured: 172.18.0.1 inside the e2e compose network), never from
 * 127.0.0.1. Sibling containers keep their own addresses and are still refused.
 * Read from the kernel rather than assumed, because the bridge subnet is not
 * fixed. Outside a container (no /.dockerenv, e.g. Windows or macOS) the answer
 * is null and locality means loopback only.
 */
export function containerHostAddress(readFile = (path) => readFileSync(path, "utf8"), exists = (path) => existsSync(path)) {
  try {
    if (!exists("/.dockerenv")) return null;
    const defaultRoute = readFile("/proc/net/route")
      .split("\n")
      .slice(1)
      .map((line) => line.trim().split(/\s+/u))
      .find((columns) => columns[1] === "00000000");
    const gateway = defaultRoute?.[2];
    if (typeof gateway !== "string" || !/^[0-9a-fA-F]{8}$/u.test(gateway)) return null;
    // The kernel writes the IPv4 address little-endian in hex.
    const octets = gateway.match(/../gu).map((pair) => parseInt(pair, 16)).reverse();
    return octets.join(".");
  } catch {
    return null;
  }
}

/**
 * The local bootstrap's whole authorization: the caller is on this host — the
 * loopback interface itself, or the container gateway that *is* the host when
 * the registry runs in a container.
 */
export function isLocalBootstrapPeer(remoteAddress, hostAddress = containerHostAddress()) {
  if (isLoopbackAddress(remoteAddress)) return true;
  return typeof hostAddress === "string" && hostAddress.length > 0 && remoteAddress === hostAddress;
}

/**
 * Constant-time check of GitHub's `X-Hub-Signature-256` against the raw body.
 * A missing secret or header is never a match.
 */
export function verifyGitHubSignature(secret, rawBody, header) {
  if (typeof secret !== "string" || secret.length === 0) return false;
  if (typeof header !== "string" || header.length === 0) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(header, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function wireProtocolHandlers(server, dispatcher, ctx, audit) {
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
    const { envelope, unknownTool, project: servedProject } = await dispatcher.callTool({ tool: name, args: rawArguments, ctx });
    if (unknownTool) {
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
    }
    if (typeof audit === "function") {
      try {
        audit({
          tenant: Array.isArray(ctx?.tenant) ? ctx.tenant.join(",") : ctx?.tenant ?? null,
          login: ctx?.identity?.login ?? null,
          role: ctx?.role ?? null,
          project: servedProject ?? null,
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
