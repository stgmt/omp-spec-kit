import { KERNEL_SCHEMA_VERSION } from "../kernel/index.js";
import {
  annotationsFor,
  jsonSchemaFor,
  KERNEL_ENVELOPE_OUTPUT_SCHEMA,
  MCP_SERVER_INSTRUCTIONS,
  TOOL_CONTRACTS,
  validateContractArguments,
  normalizeToolArguments,
} from "../adapters/tool-contracts.js";

const SUPPORTED_SCHEMA_VERSIONS = new Set([undefined, "spec-kernel@1", KERNEL_SCHEMA_VERSION]);

function errorEnvelope(operation, requestId, code, message, extra = {}) {
  return {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    requestId: requestId ?? null,
    operation,
    ok: false,
    graph: null,
    page: null,
    data: null,
    error: {
      code,
      message,
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
      ...extra,
    },
    diagnostics: [],
    provenance: null,
  };
}

function invalidRequest(operation, requestId, message, extra = {}) {
  return errorEnvelope(operation, requestId, "INVALID_REQUEST", message, extra);
}

/**
 * Caller context for one request. In phase 1 (pre-onboarding) the service
 * trusts its own configured project set; TASK-5 replaces this with
 * `token → tenant → allowed scopes`.
 */
export function preAuthContext(mounts) {
  const scopes = [...mounts.projects];
  return {
    tenant: "local",
    scopes,
    defaultScope: scopes.length === 1 ? scopes[0] : null,
    identity: null,
  };
}

function hasRequestIdField(contract) {
  return (
    (contract.fields ?? []).some((entry) => entry.name === "requestId") ||
    (contract.commonFields ?? []).some((entry) => entry.name === "requestId")
  );
}

function injectRequestId(contract, args, requestId) {
  if (hasRequestIdField(contract) && requestId !== null && args.requestId === undefined) {
    return { ...args, requestId };
  }
  return args;
}

/**
 * Shared tool dispatch for the HTTP transport: same contracts, same argument
 * normalization, same envelopes as the stdio server. Transport-only fields
 * (`project`, `identity`, `force`) are stripped before the closed op args
 * reach the kernel.
 */
export function createDispatcher({ mounts, serviceOps = {} }) {
  const contractsByName = new Map(TOOL_CONTRACTS.map((contract) => [contract.tool, contract]));

  function resolveProject({ rawProject, ctx, operation, requestId, listing = false }) {
    if (rawProject !== undefined && typeof rawProject !== "string") {
      return { error: invalidRequest(operation, requestId, "project must be a string", { parameter: "project", expected: "string", receivedType: typeof rawProject }) };
    }
    if (rawProject === undefined || rawProject === "") {
      if (listing) return { allScopes: true };
      if (ctx.defaultScope) return { project: ctx.defaultScope };
      return {
        error: invalidRequest(operation, requestId, "project is required: the caller context has no default scope", {
          parameter: "project",
          expected: "owner/project",
        }),
      };
    }
    if (!ctx.scopes.includes(rawProject)) {
      return {
        error: invalidRequest(operation, requestId, `project is outside the caller's allowed set: ${rawProject}`, {
          parameter: "project",
          receivedSummary: rawProject,
        }),
      };
    }
    return { project: rawProject };
  }

  async function callTool({ tool, args, ctx }) {
    const contract = contractsByName.get(tool);
    if (!contract) return { unknownTool: true };
    const raw = args && typeof args === "object" && !Array.isArray(args) ? args : {};
    const requestId = raw.requestId === undefined ? null : raw.requestId;
    const operation = contract.operation;

    if (!SUPPORTED_SCHEMA_VERSIONS.has(raw.schemaVersion)) {
      return {
        envelope: errorEnvelope(operation, requestId, "UNSUPPORTED_SCHEMA_VERSION", "unsupported or missing schemaVersion", {
          parameter: "schemaVersion",
          expected: `spec-kernel@1, ${KERNEL_SCHEMA_VERSION}`,
        }),
      };
    }
    if (requestId !== null && typeof requestId !== "string") {
      return { envelope: invalidRequest(operation, requestId, "requestId must be a string or null", { parameter: "requestId", expected: "string|null", receivedType: typeof requestId }) };
    }

    const { project: rawProject, identity, force, schemaVersion, requestId: _requestId, ...restArgs } = raw;
    const normalized = normalizeToolArguments(restArgs);
    if (!normalized.ok) {
      return { envelope: errorEnvelope(operation, requestId, normalized.error.code, normalized.error.message, { parameter: normalized.error.parameter }) };
    }

    const isServiceOp = Object.hasOwn(serviceOps, contract.operation);
    const listing = isServiceOp && serviceOps[contract.operation].listing === true;
    const resolved = resolveProject({ rawProject, ctx, operation, requestId, listing });
    if (resolved.error) return { envelope: resolved.error };

    if (isServiceOp) {
      return serviceOps[contract.operation]({ args: normalized.args, ctx, project: resolved.project ?? null, allScopes: resolved.allScopes === true, identity, force, requestId, contract });
    }

    if (resolved.allScopes || !resolved.project) {
      return { envelope: invalidRequest(operation, requestId, "project is required: the caller context has no default scope", { parameter: "project", expected: "owner/project" }) };
    }
    try {
      mounts.requireConfigured(resolved.project);
    } catch (error) {
      return { envelope: invalidRequest(operation, requestId, error.message, { parameter: "project", receivedSummary: resolved.project }) };
    }

    const argsForKernel = injectRequestId(contract, normalized.args, requestId);
    const validation = validateContractArguments(contract, argsForKernel);
    if (!validation.ok) {
      return {
        envelope: errorEnvelope(operation, requestId, validation.code, validation.message, {
          parameter: validation.parameter ?? null,
          expected: validation.expected ?? null,
          receivedType: validation.receivedType ?? null,
        }),
      };
    }

    const envelope = await mounts.serviceFor(resolved.project).runQuery(contract.operation, argsForKernel, { requestId, schemaVersion: raw.schemaVersion });
    return { envelope };
  }

  function toolListPayload() {
    return {
      tools: TOOL_CONTRACTS.map((contract) => ({
        name: contract.tool,
        title: contract.label,
        description: contract.description,
        outputSchema: KERNEL_ENVELOPE_OUTPUT_SCHEMA,
        inputSchema: jsonSchemaFor(contract),
        annotations: annotationsFor(contract),
      })),
    };
  }

  return { callTool, contractsByName, toolListPayload };
}

export function serverInfo() {
  return { name: "omp-spec-kit-registry", version: KERNEL_SCHEMA_VERSION, instructions: MCP_SERVER_INSTRUCTIONS };
}
