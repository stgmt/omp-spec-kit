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
  const stage = typeof context.stage === "string"
    ? context.stage
    : globalThis.process?.env?.OMP_SPEC_KIT_STAGE ?? "v0.3.2";
  let settled = null;

  function withProvenance(envelope) {
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

  async function runQuery(operation, args, { requestId = null, schemaVersion } = {}) {
    // Error precedence mirrors SCHEMA-10: schema version first, then request
    // shape, then graph availability; everything else is validated by the
    // pure kernel query service.
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
    if (DOCUMENT_OPERATIONS.includes(operation)) {
      try {
        const documentResult = await executeDocumentOperation(resolvedRoot, operation, args ?? {}, { stage, provenance });
        const envelope = documentResult.ok
          ? makeAdapterSuccessEnvelope({ operation, requestId, data: documentResult.data })
          : makeErrorEnvelope({
              operation,
              requestId,
              code: documentResult.error.code,
              message: documentResult.error.message,
              extra: documentResult.error,
            });
        return withProvenance({ ...envelope, requestId: requestId ?? null });
      } catch {
        return withProvenance(
          makeErrorEnvelope({
            operation,
            requestId,
            code: "ADAPTER_READ_ERROR",
            message: "specification document adapter failed",
          }),
        );
      }
    }
    const state = await ensure();
    if (state.status === "error") {
      const summaries = adapterDiagnosticSummaries(state.readerError);
      const firstCode =
        typeof state.readerError?.diagnostics?.[0]?.code === "string"
          ? state.readerError.diagnostics[0].code
          : null;
      return withProvenance(
        makeErrorEnvelope({
          operation,
          requestId,
          code: state.readerError.code,
          message: `spec repository is unavailable at the resolved root (${state.readerError.code})`,
          extra: {
            causeCode: firstCode,
            retryable: true,
            diagnosticIds: summaries.map((summary) => summary.diagnosticId),
          },
          summaries,
        }),
      );
    }
    if (AUTHORING_OPERATIONS.includes(operation)) {
      try {
        refresh();
        const freshState = await ensure();
        if (freshState.status === "error") {
          const summaries = adapterDiagnosticSummaries(freshState.readerError);
          const firstCode = typeof freshState.readerError?.diagnostics?.[0]?.code === "string" ? freshState.readerError.diagnostics[0].code : null;
          return withProvenance(
            makeErrorEnvelope({
              operation,
              requestId,
              code: freshState.readerError.code ?? "ADAPTER_READ_ERROR",
              message: freshState.readerError.message ?? `spec repository is unavailable (${freshState.readerError.code})`,
              extra: {
                causeCode: firstCode,
                retryable: freshState.readerError.retryable === true,
                diagnosticIds: summaries.map((summary) => summary.diagnosticId),
              },
              summaries,
            }),
          );
        }
        const authoredInput = args && typeof args === "object" && !Array.isArray(args) ? { ...args } : {};
        if (requestId !== null && authoredInput.requestId === undefined) authoredInput.requestId = requestId;
        const authored = await getAuthoring().compileFacade(operation, authoredInput);
        const envelope = authored.ok
          ? makeSuccessEnvelope({
              graph: freshState.graph,
              operation,
              requestId,
              data: authored.data,
            })
          : makeErrorEnvelope({
              operation,
              requestId,
              code: authored.error.code,
              message: authored.error.message,
              extra: authored.error,
            });
        return withProvenance({ ...envelope, requestId: requestId ?? null });
      } catch (err) {
        return withProvenance(
          makeErrorEnvelope({
            operation,
            requestId,
            code: err?.code ?? "INTERNAL_INVARIANT_ERROR",
            message: err?.message ?? "authoring adapter failed before filesystem mutation",
          }),
        );
      }
    }
    if (EVIDENCE_OPERATIONS.includes(operation)) {
      const evidence = await executeEvidenceOperation(resolvedRoot, state.graph, operation, args ?? {});
      const envelope = evidence.ok
        ? makeSuccessEnvelope({
            graph: state.graph,
            operation,
            requestId,
            data: evidence.data,
            page: evidence.page,
          })
        : makeErrorEnvelope({
            operation,
            requestId,
            code: evidence.error.code,
            message: evidence.error.message,
            extra: evidence.error,
          });
      return withProvenance({ ...envelope, requestId: requestId ?? null });
    }
    try {
      if (EXTENDED_OPERATIONS.includes(operation)) {
        const extended = executeExtendedQuery(state.graph, operation, args ?? {});
        const envelope = extended.ok
          ? makeSuccessEnvelope({
              graph: state.graph,
              operation,
              requestId,
              data: extended.data,
              page: extended.page,
            })
          : makeErrorEnvelope({
              operation,
              requestId,
              code: extended.error.code,
              message: extended.error.message,
              extra: extended.error,
            });
        return withProvenance({ ...envelope, requestId: requestId ?? null });
      }
      const envelope = query(state.graph, operation, args ?? {});
      return withProvenance({ ...envelope, requestId: requestId ?? null });
    } catch {
      return withProvenance(
        makeErrorEnvelope({
          operation,
          requestId,
          code: "INTERNAL_INVARIANT_ERROR",
          message: "unexpected adapter failure while executing the query",
        }),
      );
    }
  }

  return { root: resolvedRoot, provenance, ensure, runQuery, refresh };
}

// One-line human summary for tool text content; the canonical envelope always
// travels beside it (details / structuredContent).
export function summarizeEnvelope(envelope) {
  const head = `${envelope.operation} ${envelope.ok ? "ok" : `error ${envelope.error.code}`}`;
  const mismatch =
    envelope.provenance?.matchesActiveProject === false
      ? ", source=explicit-absolute-override, active-project-mismatch"
      : "";
  if (!envelope.ok) {
    const detail = envelope.error.parameter ? ` (${envelope.error.parameter})` : "";
    return `${head}${detail}${mismatch}`;
  }
  const page = envelope.page;
  const paging =
    page && typeof page.returned === "number" ? `, returned=${page.returned}/${page.totalMatched}` : "";
  return `${head}${paging}${mismatch}`;
}
