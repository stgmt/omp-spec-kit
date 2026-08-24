// FC-7 / FR-9: dependency-free read-only stdio MCP server over the shared
// v0.2 kernel query service. Newline-delimited JSON-RPC 2.0 (MCP stdio
// transport; no Content-Length headers). Maps the eight SCHEMA-11 tools
// one-to-one onto the eight query operations and answers every call with
// exactly one canonical QueryEnvelope as structured content. There are no
// mutation tools, no filesystem writes, and no stdout traffic other than
// JSON-RPC responses.
//
// Repository-root resolution (see plugins/omp-spec-kit/.mcp.json):
//   1. OMP_SPEC_KIT_ROOT environment variable (absolute or cwd-relative),
//   2. otherwise the server process working directory.

import { createInterface } from "node:readline";
import { KERNEL_SCHEMA_VERSION } from "../kernel/index.js";
import { createSpecService, resolveRepositoryRoot, summarizeEnvelope } from "../adapters/query-service.js";
import { TOOL_CONTRACTS, jsonSchemaFor } from "../adapters/tool-contracts.js";

const PROTOCOL_VERSION_FALLBACK = "2025-03-26";
const SERVER_NAME = "omp-spec-kit";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function respondError(id, code, message) {
  writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function internalErrorEnvelope(operation, requestId) {
  return {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    requestId: requestId ?? null,
    operation,
    ok: false,
    graph: null,
    page: null,
    data: null,
    error: {
      code: "INTERNAL_INVARIANT_ERROR",
      message: "unexpected adapter failure while executing the query",
      operation,
      parameter: null,
      receivedType: null,
      receivedSummary: null,
      expected: null,
      limitName: null,
      limitValue: null,
      observedValue: null,
      specSlug: null,
      localId: null,
      canonicalId: null,
      path: null,
      anchor: null,
      headingOccurrenceId: null,
      linkOccurrenceId: null,
      rewriteKey: null,
      candidates: [],
      diagnosticIds: [],
      retryable: false,
      causeCode: null,
    },
    diagnostics: [],
  };
}

// SCHEMA-11 common transport fields are stripped before the closed op args
// reach the kernel so the kernel's own unknown-field validation stays exact.
function splitCommonFields(rawArguments) {
  const { schemaVersion, requestId, ...args } = rawArguments;
  return {
    args,
    requestId: requestId === undefined ? null : requestId,
    schemaVersion,
  };
}

const contractsByName = new Map(TOOL_CONTRACTS.map((contract) => [contract.tool, contract]));
// One lazily-built graph per process, rooted once at startup.
const service = createSpecService(resolveRepositoryRoot());

async function handleMessage(message) {
  const hasId = isPlainObject(message) && Object.prototype.hasOwnProperty.call(message, "id");
  if (!isPlainObject(message) || message.jsonrpc !== "2.0") {
    respondError(hasId ? message.id : null, -32600, "Invalid Request");
    return;
  }
  if (typeof message.method !== "string") {
    if (hasId) respondError(message.id, -32600, "Invalid Request");
    return;
  }
  // Notifications (including notifications/initialized) carry no reply.
  if (!hasId || message.id === undefined) return;
  const { id, method } = message;

  if (method === "initialize") {
    const requested =
      isPlainObject(message.params) && typeof message.params.protocolVersion === "string"
        ? message.params.protocolVersion
        : PROTOCOL_VERSION_FALLBACK;
    respond(id, {
      protocolVersion: requested,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: KERNEL_SCHEMA_VERSION },
    });
    return;
  }
  if (method === "ping") {
    respond(id, {});
    return;
  }
  if (method === "tools/list") {
    respond(id, {
      tools: TOOL_CONTRACTS.map((contract) => ({
        name: contract.tool,
        description: contract.description,
        inputSchema: jsonSchemaFor(contract),
        annotations: { readOnlyHint: true },
      })),
    });
    return;
  }
  if (method === "tools/call") {
    const params = isPlainObject(message.params) ? message.params : {};
    const contract = typeof params.name === "string" ? contractsByName.get(params.name) : undefined;
    if (!contract) {
      respondError(id, -32602, `Unknown tool: ${typeof params.name === "string" ? params.name : "<missing>"}`);
      return;
    }
    const rawArguments = isPlainObject(params.arguments) ? params.arguments : {};
    const { args, requestId, schemaVersion } = splitCommonFields(rawArguments);
    let envelope;
    try {
      envelope = await service.runQuery(contract.operation, args, { requestId, schemaVersion });
    } catch {
      envelope = internalErrorEnvelope(contract.operation, requestId);
    }
    respond(id, {
      content: [{ type: "text", text: summarizeEnvelope(envelope) }],
      structuredContent: envelope,
      isError: !envelope.ok,
    });
    return;
  }
  respondError(id, -32601, `Method not found: ${method}`);
}

let pendingRequests = 0;
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && pendingRequests === 0) process.exit(0);
}

function handleLine(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    writeMessage({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    return;
  }
  pendingRequests += 1;
  handleMessage(message)
    .catch(() => {
      if (isPlainObject(message) && Object.prototype.hasOwnProperty.call(message, "id")) {
        respondError(message.id, -32603, "Internal error");
      }
    })
    .then(() => {
      pendingRequests -= 1;
      maybeExit();
    });
}

const readlineInterface = createInterface({ input: process.stdin });
readlineInterface.on("line", handleLine);
readlineInterface.on("close", () => {
  stdinClosed = true;
  maybeExit();
});

