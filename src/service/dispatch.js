import { KERNEL_SCHEMA_VERSION } from "../kernel/index.js";
import {
  annotationsFor,
  contractExposesReadAction,
  contractIsMutating,
  jsonSchemaFor,
  KERNEL_ENVELOPE_OUTPUT_SCHEMA,
  MCP_SERVER_INSTRUCTIONS,
  TOOL_CONTRACTS,
  validateContractArguments,
  normalizeToolArguments,
} from "../adapters/tool-contracts.js";
import { withServedProject } from "../adapters/query-service.js";
import { requireScope } from "./scope.js";

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
 * Roles gate operations (FR-8): readers read, writers write, owners force.
 * Whether an action writes is declared once per contract/variant through its
 * annotations (`contractIsMutating`), so no separate list of write operations
 * can drift from what the tool advertises.
 */
const SETUP_EXEMPT_OPERATIONS = new Set(["mcpPreflight"]);
const ROLE_RANK = Object.freeze({ reader: 0, writer: 1, owner: 2 });

/** The operation a variant runs as; a plain tool is its own operation. */
function effectiveOperation(contract, args) {
  const variant = contract.discriminator ? contract.variants?.[args?.[contract.discriminator]] : null;
  return typeof variant?.operation === "string" ? variant.operation : contract.operation;
}

/** The action being performed, for tools whose variants own their semantics. */
function effectiveAction(contract, args) {
  return contract.discriminator ? (args?.[contract.discriminator] ?? null) : null;
}

/** The MCP call an agent makes to finish setup, and the operator fallback. */
export function setupAction(project) {
  return {
    tool: "spec_repo",
    arguments: { action: "bind", project, repoUrl: "<git-url>", token: "<fine-grained-pat-with-contents-rw>" },
  };
}

export function setupCommand(project) {
  const action = setupAction(project);
  return `call ${action.tool} ${JSON.stringify(action.arguments)}`;
}

function roleAllows(ctx, contract, args, force) {
  const rank = ROLE_RANK[ctx.role] ?? -1;
  if (rank < 0) return false;
  const writes = annotationsFor(contract, effectiveAction(contract, args)).readOnlyHint === false;
  if (writes && rank < ROLE_RANK.writer) return false;
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
export function createDispatcher({ mounts, serviceOps = {}, serviceContracts = [], wrappers = {}, allowDeclaredWorktree = false }) {
  const contractsByName = new Map([...TOOL_CONTRACTS, ...serviceContracts].map((contract) => [contract.tool, contract]));

  // One selection contract per call: an explicit project argument wins, then a
  // request-scoped project supplied by the host for this request, then the
  // caller's existing default scope. Missing, unauthorized and unknown projects
  // are separate refusals, all raised before any graph lookup or write.
  function resolveProject({ scope, rawProject, operation, requestId, listing }) {
    if (rawProject !== undefined && typeof rawProject !== "string") {
      return { error: invalidRequest(operation, requestId, "project must be a string", { parameter: "project", expected: "owner/project", receivedType: typeof rawProject }) };
    }
    const decision = scope.resolve({ explicitProject: rawProject, listing });
    if (!decision.error) return decision;
    return {
      error: errorEnvelope(operation, requestId, decision.error.code, decision.error.message, decision.error.extra ?? {}),
    };
  }

  async function callTool({ tool, args, ctx }) {
    const contract = contractsByName.get(tool);
    if (!contract) return { unknownTool: true };
    const scope = requireScope(ctx?.scope, `tool ${tool}`);
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
    // declaredWorktree routes by a local filesystem path, which only the local
    // stdio/test transport can honor. Accepting it here would silently serve a
    // different corpus than the caller asked for.
    if (!allowDeclaredWorktree && restArgs.declaredWorktree !== undefined) {
      return {
        envelope: errorEnvelope(operation, requestId, "WORKTREE_ROUTING_UNSUPPORTED", "declaredWorktree is a local stdio/test transport capability; this hosted transport selects the corpus with the project argument instead", {
          parameter: "declaredWorktree",
          expected: "project (owner/project)",
          receivedType: typeof restArgs.declaredWorktree,
        }),
      };
    }
    const normalized = normalizeToolArguments(restArgs);
    if (!normalized.ok) {
      return { envelope: errorEnvelope(operation, requestId, normalized.error.code, normalized.error.message, { parameter: normalized.error.parameter }) };
    }

    if (!roleAllows(ctx, contract, normalized.args, force)) {
      const needed = force === true ? "owner" : "writer";
      const gated = effectiveOperation(contract, normalized.args);
      return {
        envelope: invalidRequest(operation, requestId, `${force === true ? "force" : gated} requires ${needed} role (caller role: ${ctx.role ?? "none"})`, {
          parameter: force === true ? "force" : null,
          expected: needed,
          receivedSummary: ctx.role ?? null,
        }),
      };
    }

    const isServiceOp = Object.hasOwn(serviceOps, contract.operation);
    const serviceEntry = isServiceOp ? serviceOps[contract.operation] : null;
    const variant = contract.discriminator ? contract.variants?.[normalized.args?.[contract.discriminator]] : null;
    // A listing variant treats an absent project as "every project I may see";
    // a targeted variant answers only for the selected project.
    const listing = (variant ? variant.listing === true : serviceEntry?.listing === true);
    // An explicit authorized project affects this call only. Otherwise the
    // scope's session project applies (the host's verified request context, then
    // the caller's default scope), and a call with neither falls back to the
    // caller's existing default scope. No selection is ever stored.
    const resolved = resolveProject({ scope, rawProject, operation, requestId, listing });
    if (resolved.error) return { envelope: resolved.error };

    if (!resolved.allScopes) {
      // Setup and preflight must answer for a project with no binding yet:
      // they are how a caller completes (or repairs) setup.
      const setupExempt = SETUP_EXEMPT_OPERATIONS.has(contract.operation) || variant?.setupExempt === true;
      try {
        mounts.requireConfigured(resolved.project);
        // An external-tenant project without a repo binding refuses here —
        // its specs must live in the customer's repo, never the operator's.
        if (!setupExempt) mounts.requireRepoReady?.(resolved.project);
      } catch (error) {
        // Authorized but unknown to this service: an operator/config drift, not
        // a missing document. Refuse with its own actionable diagnosis.
        if (error?.code === "PROJECT_NOT_CONFIGURED") {
          return {
            envelope: errorEnvelope(operation, requestId, "PROJECT_NOT_CONFIGURED", `${error.message}; this service has no repository binding for it`, {
              parameter: "project",
              receivedSummary: resolved.project,
            }),
          };
        }
        if (error?.code === "REPO_BINDING_REQUIRED" && !SETUP_EXEMPT_OPERATIONS.has(contract.operation)) {
          return {
            envelope: errorEnvelope(operation, requestId, "SETUP_REQUIRED", `${error.message}. Setup: ${setupCommand(resolved.project)}`, {
              parameter: "project",
              receivedSummary: resolved.project,
              causeCode: "REPO_BINDING_REQUIRED",
            }),
          };
        }
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
      const result = await serviceEntry.run({ args: argsForKernel, ctx, project: resolved.project ?? null, projectSource: resolved.source ?? null, allScopes: resolved.allScopes === true, force, requestId, schemaVersion: raw.schemaVersion, contract });
      return stampResult(result, resolved.project, resolved.source);
    }

    const wrapper = wrappers[contract.operation];
    if (wrapper) {
      const wrapped = await wrapper({ args: argsForKernel, ctx, project: resolved.project, projectSource: resolved.source ?? null, force, requestId, schemaVersion: raw.schemaVersion, contract });
      if (wrapped !== undefined && wrapped !== null) {
        return stampResult(wrapped, resolved.project, resolved.source);
      }
    }

    const envelope = await mounts.serviceFor(resolved.project).runQuery(contract.operation, argsForKernel, {
      requestId,
      schemaVersion: raw.schemaVersion,
      project: resolved.project,
      projectSource: resolved.source ?? null,
    });
    return stampResult({ envelope }, resolved.project, resolved.source);
  }

  // Every scoped result reports the project that actually served it, through
  // the one provenance contract (withServedProject in query-service). Every
  // path returns `{ envelope }` — no second shape to guess at.
  function stampResult(result, project, projectSource) {
    const envelope = result?.envelope;
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      throw new Error("dispatch: every execution path must return an envelope object");
    }
    return {
      envelope: { ...envelope, provenance: withServedProject(envelope.provenance, project) },
      project: project ?? null,
      projectSource: projectSource ?? null,
    };
  }

  function toolListPayload(ctx) {
    const rank = ROLE_RANK[ctx?.role] ?? ROLE_RANK.reader;
    // A reader sees read tools and multi-action tools that still expose a read
    // action; a tool whose every action writes stays hidden.
    const visible = [...TOOL_CONTRACTS, ...serviceContracts].filter((contract) => (
      rank >= ROLE_RANK.writer || !contractIsMutating(contract) || contractExposesReadAction(contract)
    ));
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
