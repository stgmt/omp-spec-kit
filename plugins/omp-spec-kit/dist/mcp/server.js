// FC-7 / FR-9: dependency-free read-only stdio MCP server over the shared
// v0.2 kernel query service. Newline-delimited JSON-RPC 2.0 (MCP stdio
// transport; no Content-Length headers). Maps the eight SCHEMA-11 tools
// one-to-one onto the eight query operations and answers every call with
// exactly one canonical QueryEnvelope as structured content. There are no
// mutation tools, no filesystem writes, and no stdout traffic other than
// JSON-RPC responses.
//
// Repository-root resolution (see plugins/omp-spec-kit/.mcp.json):
//   1. OMP_SPEC_KIT_ROOT environment variable, when absolute,
//   2. otherwise the server process working directory.

import { createInterface } from "node:readline";
import { KERNEL_SCHEMA_VERSION } from "../kernel/index.js";
import {
  createSpecService,
  resolveRepositoryContext,
  summarizeEnvelope,
} from "../adapters/query-service.js";
import { activeStageForEnvironment, toolContractsForStage, jsonSchemaFor, validateContractArguments } from "../adapters/tool-contracts.js";

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

function internalErrorEnvelope(operation, requestId, provenance) {
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
    provenance,
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

const ARGUMENT_ALIASES = Object.freeze({
  spec_slugs: "specSlugs",
  include_documents: "includeDocuments",
  canonical_id: "canonicalId",
  include_incident_counts: "includeIncidentCounts",
  max_depth: "maxDepth",
  max_visited: "maxVisited",
  focus_path: "focusPath",
  focus_anchor: "focusAnchor",
  include_headings: "includeHeadings",
  include_links: "includeLinks",
  read_for_edit: "readForEdit",
  declared_worktree: "declaredWorktree",
  verification_method: "verificationMethod",
  safety_class: "safetyClass",
  verification_method_missing: "verificationMethodMissing",
  scenario_id: "scenarioId",
  proposal_id: "proposalId",
  proposal_sha256: "proposalSha256",
  expected_documents: "expectedDocuments",
  actor_ref: "actorRef",
  repository_root_fingerprint: "repositoryRootFingerprint",
  expected_sha: "expectedSha",
  old_string: "oldText",
  new_string: "newText",
  replace_all: "replaceAll",
  new_doc: "newDoc",
  node_id: "canonicalId",
});

function normalizeArguments(rawArguments) {
  const normalized = {};
  for (const [name, value] of Object.entries(rawArguments)) {
    const canonical = ARGUMENT_ALIASES[name] ?? name;
    if (Object.hasOwn(normalized, canonical)) {
      return { ok: false, error: { code: "DUPLICATE_FIELD", message: `tool argument has duplicate aliases: ${canonical}`, parameter: canonical } };
    }
    normalized[canonical] = value;
  }
  return { ok: true, args: normalized };
}

const requestedStage = globalThis.process?.env?.OMP_SPEC_KIT_STAGE ?? "v0.5.0";
const activeStage = activeStageForEnvironment(requestedStage);
const activeContracts = toolContractsForStage(activeStage);
const contractsByName = new Map(activeContracts.map((contract) => [contract.tool, contract]));
const rootContext = resolveRepositoryContext();
const service = createSpecService(rootContext.resolvedRoot, {
  ...rootContext,
  stage: activeStage ?? "v0.3.2",
});
function argumentErrorEnvelope(operation, requestId, validation) {
  const envelope = internalErrorEnvelope(operation, requestId, service.provenance);
  return {
    ...envelope,
    error: {
      ...envelope.error,
      code: validation.code,
      message: validation.message,
      parameter: validation.parameter ?? null,
      expected: validation.expected ?? null,
      receivedType: validation.receivedType ?? null,
    },
  };
}

function respondTool(id, envelope) {
  const text = envelope.operation === "inventory" ? summarizeEnvelope(envelope) : JSON.stringify(envelope);
  respond(id, {
    content: [{ type: "text", text }],
    structuredContent: envelope,
    isError: !envelope.ok,
  });
}

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
      tools: activeContracts.map((contract) => ({
        name: contract.tool,
        description: contract.description,
        inputSchema: jsonSchemaFor(contract),
        annotations: {
          readOnlyHint:
            !contract.operation.startsWith("apply") &&
            !contract.operation.startsWith("set") &&
            !contract.operation.startsWith("delete") &&
            !contract.operation.startsWith("rename") &&
            !contract.operation.startsWith("create") &&
            !contract.operation.startsWith("archive") &&
            !contract.operation.startsWith("add") &&
            !contract.operation.startsWith("register"),
        },
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
    const hasArguments = Object.prototype.hasOwnProperty.call(params, "arguments");
    const invalidArgumentShape = hasArguments && !isPlainObject(params.arguments);
    const rawArguments = isPlainObject(params.arguments) ? params.arguments : {};
    const split = splitCommonFields(rawArguments);
    const { requestId, schemaVersion } = split;
    let envelope;
    try {
      if (
        (schemaVersion !== undefined && schemaVersion !== KERNEL_SCHEMA_VERSION) ||
        (requestId !== null && typeof requestId !== "string")
      ) {
        envelope = await service.runQuery(contract.operation, {}, { requestId, schemaVersion });
      } else if (invalidArgumentShape) {
        envelope = argumentErrorEnvelope(contract.operation, requestId, {
          code: "INVALID_REQUEST",
          message: "tool arguments must be an object",
          parameter: "arguments",
          expected: "object",
          receivedType: Array.isArray(params.arguments) ? "array" : typeof params.arguments,
        });
      } else {
        const normalized = normalizeArguments(split.args);
        if (!normalized.ok) {
          envelope = argumentErrorEnvelope(contract.operation, requestId, normalized.error);
        } else {
          const args = normalized.args;
          if (contract.fields.some((entry) => entry.name === "requestId") && requestId !== null) args.requestId = requestId;
          const validation = validateContractArguments(contract, args);
          envelope = validation.ok
            ? await service.runQuery(contract.operation, args, { requestId, schemaVersion })
            : argumentErrorEnvelope(contract.operation, requestId, validation);
        }
      }
    } catch {
      envelope = internalErrorEnvelope(contract.operation, requestId, service.provenance);
    }
    respondTool(id, envelope);
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

