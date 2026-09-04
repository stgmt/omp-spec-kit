// Shared read-only service composition used by both transports (the OMP
// extension tools and the stdio MCP server). Resolves ONE explicit repository
// root, lazily builds the kernel graph once per service from
// readRepositorySpecs({ root }), and projects every answer through the pure
// kernel query() so each caller receives exactly one canonical QueryEnvelope.
// This module adds no parsing, filtering, or resolution semantics.

import path from "node:path";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { KERNEL_SCHEMA_VERSION, buildKernelGraph, query } from "../kernel/index.js";
import { ENTITY_TYPE_DESCRIPTORS, EDGE_TYPE_DESCRIPTORS } from "../kernel/types.js";
import { readRepositorySpecs } from "../kernel/adapters/fs.js";
import { EXTENDED_OPERATIONS, executeExtendedQuery } from "../kernel/query/extended.js";
import { DOCUMENT_OPERATIONS, executeDocumentOperation } from "./document-service.js";
import { EVIDENCE_OPERATIONS, executeEvidenceOperation } from "../evidence/service.js";
import { AUTHORING_OPERATIONS, createAuthoringService } from "../authoring/service.js";
import { readConsistentRepositorySpecs } from "../authoring/transactions.js";

export { KERNEL_SCHEMA_VERSION };

// Optional root override for explicit diagnostics and controlled integration.
// Normal installed MCP execution relies on OMP's active project cwd. An absent
// legacy name-indirection literal, a placeholder, or a relative value must not
// redirect a server toward package-local data.
function canonicalPhysicalPath(value) {
  const resolved = path.resolve(value);
  try {
    return realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function physicalPathKey(value) {
  const canonical = canonicalPhysicalPath(value);
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}

const ROOT_ID_NAMESPACE = "omp-spec-kit-root-provenance-v1";

function rootIdentity(root) {
  return createHash("sha256")
    .update(`${ROOT_ID_NAMESPACE}\u0000${physicalPathKey(root)}`)
    .digest("hex");
}

export function createResponseProvenance({
  resolvedRoot,
  activeProjectRoot = resolvedRoot,
  rootMode = "active-project",
} = {}) {
  if (typeof resolvedRoot !== "string" || resolvedRoot.length === 0) {
    throw new Error("createResponseProvenance requires a resolved repository root");
  }
  if (typeof activeProjectRoot !== "string" || activeProjectRoot.length === 0) {
    throw new Error("createResponseProvenance requires an active project root");
  }
  const resolvedKey = physicalPathKey(resolvedRoot);
  const activeKey = physicalPathKey(activeProjectRoot);
  const matchesActiveProject = resolvedKey === activeKey;
  return Object.freeze({
    serverName: "omp-spec-kit",
    resolvedRootId: rootIdentity(resolvedRoot),
    activeProjectRootId: rootIdentity(activeProjectRoot),
    rootMode: !matchesActiveProject ? "explicit-absolute-override" : "active-project",
    matchesActiveProject,
  });
}

export function resolveRepositoryContext(env = process.env, cwd = process.cwd()) {
  const fallback = canonicalPhysicalPath(cwd);
  const packageRoot =
    typeof env?.OMP_SPEC_KIT_PACKAGE_ROOT === "string" &&
    path.isAbsolute(env.OMP_SPEC_KIT_PACKAGE_ROOT)
      ? canonicalPhysicalPath(env.OMP_SPEC_KIT_PACKAGE_ROOT)
      : null;
  if (packageRoot !== null && physicalPathKey(fallback) === physicalPathKey(packageRoot)) {
    throw new Error("PACKAGE_ROOT_REFUSED");
  }
  const raw = env?.OMP_SPEC_KIT_ROOT;
  if (
    typeof raw === "string" &&
    raw.length > 0 &&
    !raw.includes("${") &&
    raw !== "OMP_SPEC_KIT_ROOT" &&
    path.isAbsolute(raw)
  ) {
    const candidate = canonicalPhysicalPath(raw);
    if (packageRoot !== null && physicalPathKey(candidate) === physicalPathKey(packageRoot)) {
      return {
        resolvedRoot: fallback,
        activeProjectRoot: fallback,
        rootMode: "active-project",
      };
    }
    return {
      resolvedRoot: candidate,
      activeProjectRoot: fallback,
      rootMode:
        physicalPathKey(candidate) === physicalPathKey(fallback)
          ? "active-project"
          : "explicit-absolute-override",
    };
  }
  return {
    resolvedRoot: fallback,
    activeProjectRoot: fallback,
    rootMode: "active-project",
  };
}

export function resolveRepositoryRoot(env = process.env, cwd = process.cwd()) {
  return resolveRepositoryContext(env, cwd).resolvedRoot;
}

function adapterDiagnosticSummaries(readerError) {
  const diagnostics = Array.isArray(readerError?.diagnostics) ? readerError.diagnostics : [];
  return diagnostics.slice(0, 8).map((diagnostic) => {
    const code = typeof diagnostic?.code === "string" ? diagnostic.code : "IO_READ_FAILED";
    const relativePath = typeof diagnostic?.path === "string" ? diagnostic.path : null;
    return {
      diagnosticId: createHash("sha256").update(`${code}\u0000${relativePath ?? ""}`).digest("hex"),
      code,
      severity: "ERROR",
      message: code,
      remediation: "check-repository-root-and-specs-layout",
      source: null,
      canonicalId: null,
    };
  });
}

const ERROR_RECOVERY = Object.freeze({
  STALE_CURSOR: "Recovery: retry the same list operation without cursor to obtain a fresh page, then continue with the returned nextCursor.",
  CONFLICT: "Recovery: rerun spec_overview, resolve the reported conflict, create and review a fresh proposal, then call apply_proposed_patch with a new requestId.",
});

function rootFingerprintRecoveryMessage(provenance) {
  return "repositoryRootFingerprint may be from another project or stale snapshot. activeProjectRootId=" + provenance.activeProjectRootId + " resolvedRootId=" + provenance.resolvedRootId + ". Run mcp_preflight with the current working directory; reconnect if matchesResolvedRoot is false. Otherwise refresh spec_catalog with overview view and create a new proposal.";
}

function actionableErrorMessage(code, message) {
  const recovery = ERROR_RECOVERY[code];
  if (!recovery || message.includes(recovery)) return message;
  return message + " " + recovery;
}

// Full SCHEMA-10 QueryError shape; every field is always present.
function makeErrorEnvelope({ operation, requestId, code, message, extra = {}, summaries = [] }) {
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
      message: actionableErrorMessage(code, message),
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
    diagnostics: summaries,
  };
}

function graphSummary(graph) {
  return {
    schemaVersion: graph.schemaVersion,
    fingerprint: graph.fingerprint,
    valid: graph.valid,
    specCount: new Set(graph.documents.map((document) => document.specSlug)).size,
    documentCount: graph.counts.discoveredDocuments,
    nodeCount: graph.nodes.length,
    edgeOccurrenceCount: graph.edges.length,
    unresolvedReferenceCount: graph.counts.unresolvedReferenceOccurrences,
    markdownHeadingOccurrenceCount: graph.counts.markdownHeadingOccurrences,
    markdownLinkOccurrenceCount: graph.counts.markdownLinkOccurrences,
    diagnosticCount: graph.diagnostics.length,
  };
}

function makeSuccessEnvelope({ graph, operation, requestId, data, page = null }) {
  return {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    requestId: requestId ?? null,
    operation,
    ok: true,
    graph: graphSummary(graph),
    page,
    data,
    error: null,
    diagnostics: [],
  };
}

function makeAdapterSuccessEnvelope({ operation, requestId, data }) {
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
  };
}

export function createSpecService(root, context = {}) {
  if (typeof root !== "string" || root.length === 0) {
    throw new Error("createSpecService requires an explicit repository root");
  }
  const resolvedRoot = canonicalPhysicalPath(root);
  const provenance = createResponseProvenance({
    resolvedRoot,
    activeProjectRoot: context.activeProjectRoot ?? resolvedRoot,
    rootMode: context.rootMode,
  });
  const stage = "single-surface";
  let settled = null;

  function withProvenance(envelope) {
    if (!envelope.ok && envelope.error && typeof envelope.error.message === "string") {
      const message = envelope.error.causeCode === "REPOSITORY_ROOT_FINGERPRINT_MISMATCH" ? rootFingerprintRecoveryMessage(provenance) : actionableErrorMessage(envelope.error.code, envelope.error.message);
      return { ...envelope, error: { ...envelope.error, message }, provenance };
    }
    if (envelope.data?.outcome === "REFUSED" && envelope.data.error && typeof envelope.data.error.message === "string") {
      const message = envelope.data.error.causeCode === "REPOSITORY_ROOT_FINGERPRINT_MISMATCH" ? rootFingerprintRecoveryMessage(provenance) : actionableErrorMessage(envelope.data.error.code, envelope.data.error.message);
      return { ...envelope, data: { ...envelope.data, error: { ...envelope.data.error, message } }, provenance };
    }
    return { ...envelope, provenance };
  }

  // Once per service (per process/session per root context): reader failure
  // and graph alike are cached so repeated queries never re-read the
  // repository.
  async function ensure() {
    if (settled === null) {
      settled = (async () => {
        let read;
        try {
          read = await readConsistentRepositorySpecs({ root: resolvedRoot });
        } catch {
          read = {
            error: {
              code: "ADAPTER_READ_ERROR",
              diagnostics: [{ code: "IO_READ_FAILED", path: "" }],
            },
          };
        }
        if (read.error) return { status: "error", readerError: read.error };
        try {
          const built = buildKernelGraph({ files: read.files });
          return { status: "ready", graph: built.graph };
        } catch {
          return {
            status: "error",
            readerError: {
              code: "INTERNAL_INVARIANT_ERROR",
              diagnostics: [{ code: "INVARIANT_VIOLATION", path: "" }],
            },
          };
        }
      })();
    }
    return settled;
  }
  let authoring;
  function refresh() {
    settled = null;
  }
  function getAuthoring() {
    if (authoring) return authoring;
    authoring = createAuthoringService(
      resolvedRoot,
      async () => {
        refresh();
        const state = await ensure();
        if (state.status === "error") throw Object.assign(new Error(state.readerError.message || state.readerError.code), { code: state.readerError.code });
        return state.graph;
      },
      async () => {
        refresh();
        const state = await ensure();
        if (state.status === "error") throw Object.assign(new Error(state.readerError.message || state.readerError.code), { code: state.readerError.code });
        return state.graph;
      },
    );
    return authoring;
  }

  function handleReaderError(readerError, op, reqId) {
    const summaries = adapterDiagnosticSummaries(readerError);
    const firstCode = typeof readerError?.diagnostics?.[0]?.code === "string" ? readerError.diagnostics[0].code : null;
    return withProvenance(
      makeErrorEnvelope({
        operation: op,
        requestId: reqId,
        code: readerError.code,
        message: `spec repository is unavailable at the resolved root (${readerError.code})`,
        extra: {
          causeCode: firstCode,
          retryable: true,
          diagnosticIds: summaries.map((summary) => summary.diagnosticId),
        },
        summaries,
      }),
    );
  }

  async function runQuery(operation, args, { requestId = null, schemaVersion } = {}) {
    if (schemaVersion !== undefined && schemaVersion !== KERNEL_SCHEMA_VERSION) {
      return withProvenance(
        makeErrorEnvelope({
          operation,
          requestId,
          code: "UNSUPPORTED_SCHEMA_VERSION",
          message: "unsupported or missing schemaVersion",
          extra: { parameter: "schemaVersion", expected: KERNEL_SCHEMA_VERSION },
        }),
      );
    }
    if (requestId !== null && typeof requestId !== "string") {
      return withProvenance(
        makeErrorEnvelope({
          operation,
          requestId: null,
          code: "INVALID_REQUEST",
          message: "requestId must be a string or null",
          extra: { parameter: "requestId", expected: "string|null", receivedType: typeof requestId },
        }),
      );
    }

    const effectiveArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};

    // 1. mcpPreflight
    if (operation === "mcpPreflight") {
      try {
        const docRes = await executeDocumentOperation(resolvedRoot, "mcpPreflight", effectiveArgs, { stage, provenance });
        return withProvenance(
          docRes.ok
            ? makeAdapterSuccessEnvelope({ operation: "mcpPreflight", requestId, data: docRes.data })
            : makeErrorEnvelope({ operation: "mcpPreflight", requestId, code: docRes.error.code, message: docRes.error.message, extra: docRes.error })
        );
      } catch (err) {
        return withProvenance(
          makeErrorEnvelope({ operation: "mcpPreflight", requestId, code: "INTERNAL_INVARIANT_ERROR", message: err?.message ?? "preflight failed" })
        );
      }
    }

    // 2. catalog
    if (operation === "catalog") {
      const view = effectiveArgs.view ?? "specs";
      if (view === "types") {
        return withProvenance(
          makeAdapterSuccessEnvelope({
            operation: "catalog",
            requestId,
            data: {
              kind: "types",
              entityKinds: ENTITY_TYPE_DESCRIPTORS,
              edgeTypes: EDGE_TYPE_DESCRIPTORS,
              count: ENTITY_TYPE_DESCRIPTORS.length + EDGE_TYPE_DESCRIPTORS.length,
            },
          })
        );
      }
      const state = await ensure();
      if (state.status === "error") return handleReaderError(state.readerError, "catalog", requestId);

      if (view === "specs") {
        const ext = executeExtendedQuery(state.graph, "listSpecs", {});
        return withProvenance(
          ext.ok
            ? makeSuccessEnvelope({ graph: state.graph, operation: "catalog", requestId, data: ext.data })
            : makeErrorEnvelope({ operation: "catalog", requestId, code: ext.error.code, message: ext.error.message, extra: ext.error })
        );
      }
      if (view === "inventory") {
        const q = query(state.graph, "inventory", {
          specSlugs: effectiveArgs.specSlugs ?? [],
          includeDocuments: effectiveArgs.includeDocuments ?? false,
          limit: effectiveArgs.limit ?? 50,
          cursor: effectiveArgs.cursor ?? null,
        });
        return withProvenance({ ...q, operation: "catalog", requestId });
      }
      if (view === "overview") {
        const q = query(state.graph, "overview", {
          specSlugs: effectiveArgs.specSlugs ?? [],
        });
        return withProvenance({ ...q, operation: "catalog", requestId });
      }
      if (view === "status") {
        const ext = executeExtendedQuery(state.graph, "getSpecStatus", {
          spec: effectiveArgs.spec,
          view: effectiveArgs.statusView,
        });
        return withProvenance(
          ext.ok
            ? makeSuccessEnvelope({ graph: state.graph, operation: "catalog", requestId, data: ext.data })
            : makeErrorEnvelope({ operation: "catalog", requestId, code: ext.error.code, message: ext.error.message, extra: ext.error })
        );
      }
    }

    // 3. entities
    if (operation === "entities") {
      const state = await ensure();
      if (state.status === "error") return handleReaderError(state.readerError, "entities", requestId);

      const mode = effectiveArgs.mode ?? "get";
      if (mode === "get") {
        const q = query(state.graph, "getNode", {
          canonicalId: effectiveArgs.canonicalId,
          projection: effectiveArgs.projection ?? "summary",
          includeIncidentCounts: effectiveArgs.includeIncidentCounts ?? false,
        });
        return withProvenance({ ...q, operation: "entities", requestId });
      }
      if (mode === "find") {
        const q = query(state.graph, "findNodes", {
          specSlugs: effectiveArgs.specSlugs ?? [],
          kinds: effectiveArgs.kinds ?? [],
          canonicalIds: effectiveArgs.canonicalIds ?? [],
          text: effectiveArgs.text ?? null,
          projection: effectiveArgs.projection ?? "summary",
          limit: effectiveArgs.limit ?? 50,
          cursor: effectiveArgs.cursor ?? null,
        });
        return withProvenance({ ...q, operation: "entities", requestId });
      }
    }

    // 4. graph
    if (operation === "graph") {
      const state = await ensure();
      if (state.status === "error") return handleReaderError(state.readerError, "graph", requestId);

      const view = effectiveArgs.view ?? "edges";
      if (view === "edges") {
        const q = query(state.graph, "getEdges", {
          canonicalId: effectiveArgs.canonicalId,
          direction: effectiveArgs.direction ?? "both",
          types: effectiveArgs.types ?? [],
          aggregate: effectiveArgs.aggregate ?? false,
          limit: effectiveArgs.limit ?? 50,
          cursor: effectiveArgs.cursor ?? null,
        });
        return withProvenance({ ...q, operation: "graph", requestId });
      }
      if (view === "trace") {
        const q = query(state.graph, "trace", {
          canonicalId: effectiveArgs.canonicalId,
          direction: effectiveArgs.direction ?? "both",
          types: effectiveArgs.types ?? [],
          maxDepth: effectiveArgs.maxDepth ?? 5,
          maxVisited: effectiveArgs.maxVisited ?? 200,
          projection: effectiveArgs.projection ?? "summary",
          limit: effectiveArgs.limit ?? 50,
          cursor: effectiveArgs.cursor ?? null,
        });
        return withProvenance({ ...q, operation: "graph", requestId });
      }
    }

    // 5. documents
    if (operation === "documents") {
      const action = effectiveArgs.action ?? "list";
      let docOp = "listSpecDocs";
      if (action === "read") docOp = "readSpecDoc";
      else if (action === "attachment") docOp = "readAttachment";

      try {
        const docRes = await executeDocumentOperation(resolvedRoot, docOp, effectiveArgs, { stage, provenance });
        return withProvenance(
          docRes.ok
            ? makeAdapterSuccessEnvelope({ operation: "documents", requestId, data: docRes.data })
            : makeErrorEnvelope({ operation: "documents", requestId, code: docRes.error.code, message: docRes.error.message, extra: docRes.error })
        );
      } catch (err) {
        return withProvenance(
          makeErrorEnvelope({ operation: "documents", requestId, code: "ADAPTER_READ_ERROR", message: err?.message ?? "document operation failed" })
        );
      }
    }

    // 6. inspect
    if (operation === "inspect") {
      const check = effectiveArgs.check;
      const state = await ensure();
      if (state.status === "error") return handleReaderError(state.readerError, "inspect", requestId);

      if (check === "diagnostics") {
        const q = query(state.graph, "diagnostics", {
          severities: effectiveArgs.severities ?? [],
          codes: effectiveArgs.codes ?? [],
          specSlugs: effectiveArgs.specSlugs ?? [],
          paths: effectiveArgs.paths ?? [],
          limit: effectiveArgs.limit ?? 100,
          cursor: effectiveArgs.cursor ?? null,
        });
        return withProvenance({ ...q, operation: "inspect", requestId });
      }

      let extOp = check;
      if (check === "scenariosByTags") extOp = "findByTags";
      else if (check === "orphans") extOp = "findOrphans";
      else if (check === "anchor") extOp = "validateAnchor";
      else if (check === "requirementMetadata") extOp = "validateRequirementMetadata";
      else if (check === "requirementsPolicy") extOp = "policyQueryRequirements";
      else if (check === "archivalProof") extOp = "getArchivalProof";
      else if (check === "specValidation") extOp = "validateSpec";

      const ext = executeExtendedQuery(state.graph, extOp, effectiveArgs);
      return withProvenance(
        ext.ok
          ? makeSuccessEnvelope({ graph: state.graph, operation: "inspect", requestId, data: ext.data })
          : makeErrorEnvelope({ operation: "inspect", requestId, code: ext.error.code, message: ext.error.message, extra: ext.error })
      );
    }

    // 7. tasks
    if (operation === "tasks") {
      const state = await ensure();
      if (state.status === "error") return handleReaderError(state.readerError, "tasks", requestId);

      const ext = executeExtendedQuery(state.graph, "listTasks", {
        spec: effectiveArgs.spec,
        statuses: effectiveArgs.statuses,
        phase: effectiveArgs.phase,
        requirement: effectiveArgs.requirement,
        includeComments: effectiveArgs.includeComments,
        limit: effectiveArgs.limit,
        cursor: effectiveArgs.cursor,
      });
      return withProvenance(
        ext.ok
          ? makeSuccessEnvelope({ graph: state.graph, operation: "tasks", requestId, data: ext.data, page: ext.page })
          : makeErrorEnvelope({ operation: "tasks", requestId, code: ext.error.code, message: ext.error.message, extra: ext.error })
      );
    }

    // 8. evidence
    if (operation === "evidence") {
      const view = effectiveArgs.view ?? "result";
      const state = await ensure();
      if (state.status === "error") return handleReaderError(state.readerError, "evidence", requestId);

      const evOp = view === "trace" ? "getScenarioTrace" : "getTestResult";
      const evRes = await executeEvidenceOperation(resolvedRoot, state.graph, evOp, {
        scenarioId: effectiveArgs.scenarioId,
        spec: effectiveArgs.spec,
      });
      return withProvenance(
        evRes.ok
          ? makeSuccessEnvelope({ graph: state.graph, operation: "evidence", requestId, data: evRes.data, page: evRes.page })
          : makeErrorEnvelope({ operation: "evidence", requestId, code: evRes.error.code, message: evRes.error.message, extra: evRes.error })
      );
    }

    // 9. markdown
    if (operation === "markdown") {
      const state = await ensure();
      if (state.status === "error") return handleReaderError(state.readerError, "markdown", requestId);

      const q = query(state.graph, "markdownInventory", {
        specSlugs: effectiveArgs.specSlugs ?? [],
        mode: effectiveArgs.mode ?? "all",
        focusPath: effectiveArgs.focusPath ?? null,
        focusAnchor: effectiveArgs.focusAnchor ?? null,
        direction: effectiveArgs.direction ?? "both",
        outcomes: effectiveArgs.outcomes ?? [],
        includeHeadings: effectiveArgs.includeHeadings ?? true,
        includeLinks: effectiveArgs.includeLinks ?? true,
        limit: effectiveArgs.limit ?? 50,
        cursor: effectiveArgs.cursor ?? null,
      });
      return withProvenance({ ...q, operation: "markdown", requestId });
    }

    // 10. proposePatch
    if (operation === "proposePatch") {
      refresh();
      const freshState = await ensure();
      if (freshState.status === "error") return handleReaderError(freshState.readerError, "proposePatch", requestId);

      const authoredInput = { ...effectiveArgs };
      if (requestId !== null && authoredInput.requestId === undefined) authoredInput.requestId = requestId;

      const intent = authoredInput.intent ?? "patch";
      const targetOp = intent === "patch" ? "proposePatch" : intent;

      try {
        const authored = await getAuthoring().compileFacade(targetOp, authoredInput);
        const envelope = authored.ok
          ? makeSuccessEnvelope({
              graph: freshState.graph,
              operation: "proposePatch",
              requestId,
              data: authored.data,
            })
          : makeErrorEnvelope({
              operation: "proposePatch",
              requestId,
              code: authored.error.code,
              message: authored.error.message,
              extra: authored.error,
            });
        return withProvenance({ ...envelope, requestId: requestId ?? null });
      } catch (err) {
        return withProvenance(
          makeErrorEnvelope({
            operation: "proposePatch",
            requestId,
            code: err?.code ?? "INTERNAL_INVARIANT_ERROR",
            message: err?.message ?? "authoring compile failed",
          })
        );
      }
    }

    // 11. applyProposedPatch
    if (operation === "applyProposedPatch") {
      refresh();
      const freshState = await ensure();
      if (freshState.status === "error") return handleReaderError(freshState.readerError, "applyProposedPatch", requestId);

      const authoredInput = { ...effectiveArgs };
      if (requestId !== null && authoredInput.requestId === undefined) authoredInput.requestId = requestId;

      try {
        const authored = await getAuthoring().compileFacade("applyProposedPatch", authoredInput);
        const envelope = authored.ok
          ? makeSuccessEnvelope({
              graph: freshState.graph,
              operation: "applyProposedPatch",
              requestId,
              data: authored.data,
            })
          : makeErrorEnvelope({
              operation: "applyProposedPatch",
              requestId,
              code: authored.error.code,
              message: authored.error.message,
              extra: authored.error,
            });
        return withProvenance({ ...envelope, requestId: requestId ?? null });
      } catch (err) {
        return withProvenance(
          makeErrorEnvelope({
            operation: "applyProposedPatch",
            requestId,
            code: err?.code ?? "INTERNAL_INVARIANT_ERROR",
            message: err?.message ?? "apply failed",
          })
        );
      }
    }

    // -----------------------------------------------------------------------
    // Internal primitive fallback for internal scripts and test fixtures
    // -----------------------------------------------------------------------
    if (DOCUMENT_OPERATIONS.includes(operation)) {
      try {
        const documentResult = await executeDocumentOperation(resolvedRoot, operation, effectiveArgs, { stage, provenance });
        return withProvenance(
          documentResult.ok
            ? makeAdapterSuccessEnvelope({ operation, requestId, data: documentResult.data })
            : makeErrorEnvelope({ operation, requestId, code: documentResult.error.code, message: documentResult.error.message, extra: documentResult.error })
        );
      } catch {
        return withProvenance(
          makeErrorEnvelope({ operation, requestId, code: "ADAPTER_READ_ERROR", message: "specification document adapter failed" })
        );
      }
    }

    const state = await ensure();
    if (state.status === "error") return handleReaderError(state.readerError, operation, requestId);

    if (AUTHORING_OPERATIONS.includes(operation)) {
      try {
        refresh();
        const freshState = await ensure();
        if (freshState.status === "error") return handleReaderError(freshState.readerError, operation, requestId);

        const authoredInput = { ...effectiveArgs };
        if (requestId !== null && authoredInput.requestId === undefined) authoredInput.requestId = requestId;
        const authored = await getAuthoring().compileFacade(operation, authoredInput);
        const envelope = authored.ok
          ? makeSuccessEnvelope({ graph: freshState.graph, operation, requestId, data: authored.data })
          : makeErrorEnvelope({ operation, requestId, code: authored.error.code, message: authored.error.message, extra: authored.error });
        return withProvenance({ ...envelope, requestId: requestId ?? null });
      } catch (err) {
        return withProvenance(
          makeErrorEnvelope({ operation, requestId, code: err?.code ?? "INTERNAL_INVARIANT_ERROR", message: err?.message ?? "authoring adapter failed" })
        );
      }
    }

    if (EVIDENCE_OPERATIONS.includes(operation)) {
      const evidence = await executeEvidenceOperation(resolvedRoot, state.graph, operation, effectiveArgs);
      const envelope = evidence.ok
        ? makeSuccessEnvelope({ graph: state.graph, operation, requestId, data: evidence.data, page: evidence.page })
        : makeErrorEnvelope({ operation, requestId, code: evidence.error.code, message: evidence.error.message, extra: evidence.error });
      return withProvenance({ ...envelope, requestId: requestId ?? null });
    }

    try {
      if (EXTENDED_OPERATIONS.includes(operation)) {
        const extended = executeExtendedQuery(state.graph, operation, effectiveArgs);
        const envelope = extended.ok
          ? makeSuccessEnvelope({ graph: state.graph, operation, requestId, data: extended.data, page: extended.page })
          : makeErrorEnvelope({ operation, requestId, code: extended.error.code, message: extended.error.message, extra: extended.error });
        return withProvenance({ ...envelope, requestId: requestId ?? null });
      }
      const envelope = query(state.graph, operation, effectiveArgs);
      return withProvenance({ ...envelope, requestId: requestId ?? null });
    } catch {
      return withProvenance(
        makeErrorEnvelope({ operation, requestId, code: "INTERNAL_INVARIANT_ERROR", message: "unexpected adapter failure while executing the query" })
      );
    }
  }

  return { root: resolvedRoot, provenance, ensure, runQuery, refresh };
}
