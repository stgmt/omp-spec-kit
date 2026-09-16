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

/** Roles gate operations (FR-8): readers read, writers write, owners force. */
const WRITE_OPERATIONS = new Set(["specPatch", "specClaim", "specRelease"]);
const ROLE_RANK = Object.freeze({ reader: 0, writer: 1, owner: 2 });

function roleAllows(ctx, operation, force) {
  const rank = ROLE_RANK[ctx.role] ?? -1;
  if (rank < 0) return false;
  if (WRITE_OPERATIONS.has(operation) && rank < ROLE_RANK.writer) return false;
  if (force === true && rank < ROLE_RANK.owner) return false;
  return true;
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
export function createDispatcher({ mounts, serviceOps = {}, serviceContracts = [], wrappers = {} }) {
  const contractsByName = new Map([...TOOL_CONTRACTS, ...serviceContracts].map((contract) => [contract.tool, contract]));

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

  async function callTool({ tool, args, ctx, projectHint = null }) {
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

    const { project: rawProject, identity: _retiredIdentity, force, schemaVersion, requestId: _requestId, ...restArgs } = raw;
    void _retiredIdentity;
    const normalized = normalizeToolArguments(restArgs);
    if (!normalized.ok) {
      return { envelope: errorEnvelope(operation, requestId, normalized.error.code, normalized.error.message, { parameter: normalized.error.parameter }) };
    }

    if (!roleAllows(ctx, operation, force)) {
      const needed = force === true ? "owner" : "writer";
      return {
        envelope: invalidRequest(operation, requestId, `${force === true ? "force" : operation} requires ${needed} role (caller role: ${ctx.role ?? "none"})`, {
          parameter: force === true ? "force" : null,
          expected: needed,
          receivedSummary: ctx.role ?? null,
        }),
      };
    }

    const isServiceOp = Object.hasOwn(serviceOps, contract.operation);
    const serviceEntry = isServiceOp ? serviceOps[contract.operation] : null;
    const listing = isServiceOp && serviceEntry.listing === true;
    // X-Spec-Project (from .mcp.json) supplies a per-client default scope —
    // a hint only, still validated against ctx.scopes like an explicit arg.
    const hinted = rawProject === undefined && typeof projectHint === "string" && projectHint.length > 0 ? projectHint : rawProject;
    const resolved = resolveProject({ rawProject: hinted, ctx, operation, requestId, listing });
    if (resolved.error) return { envelope: resolved.error };

    if (resolved.allScopes || !resolved.project) {
      if (!isServiceOp || !resolved.allScopes) {
        return { envelope: invalidRequest(operation, requestId, "project is required: the caller context has no default scope", { parameter: "project", expected: "owner/project" }) };
      }
    } else {
      try {
        mounts.requireConfigured(resolved.project);
        // An external-tenant project without a repo binding refuses here —
        // its specs must live in the customer's repo, never the operator's.
        mounts.requireRepoReady?.(resolved.project);
      } catch (error) {
        return { envelope: invalidRequest(operation, requestId, error.message, { parameter: "project", receivedSummary: resolved.project }) };
      }
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

    if (isServiceOp) {
      return serviceEntry.run({ args: argsForKernel, ctx, project: resolved.project ?? null, allScopes: resolved.allScopes === true, force, requestId, schemaVersion: raw.schemaVersion, contract });
    }

    const wrapper = wrappers[contract.operation];
    if (wrapper) {
      return wrapper({ args: argsForKernel, ctx, project: resolved.project, force, requestId, schemaVersion: raw.schemaVersion, contract });
    }

    const envelope = await mounts.serviceFor(resolved.project).runQuery(contract.operation, argsForKernel, { requestId, schemaVersion: raw.schemaVersion });
    return { envelope };
  }

  function toolListPayload(ctx) {
    const rank = ROLE_RANK[ctx?.role] ?? ROLE_RANK.reader;
    const visible = [...TOOL_CONTRACTS, ...serviceContracts].filter((contract) => {
      if (rank >= ROLE_RANK.writer) return true;
      return !WRITE_OPERATIONS.has(contract.operation);
    });
    return {
      tools: visible.map((contract) => ({
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

export function serviceSuccess(operation, requestId, data) {
  return {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    requestId: requestId ?? null,
    operation,
    ok: true,
    graph: null,
    page: null,
    data,
    error: null,
    diagnostics: [],
    provenance: null,
  };
}

export { errorEnvelope as serviceErrorEnvelope };

export function serverInfo() {
  return { name: "omp-spec-kit-registry", version: KERNEL_SCHEMA_VERSION, instructions: MCP_SERVER_INSTRUCTIONS };
}
