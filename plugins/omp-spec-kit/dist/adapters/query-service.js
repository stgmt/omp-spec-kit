// Shared read-only service composition used by both transports (the OMP
// extension tools and the stdio MCP server). Resolves ONE explicit repository
// root, lazily builds the kernel graph once per service from
// readRepositorySpecs({ root }), and projects every answer through the pure
// kernel query() so each caller receives exactly one canonical QueryEnvelope.
// This module adds no parsing, filtering, or resolution semantics.

import path from "node:path";
import { createHash } from "node:crypto";
import { KERNEL_SCHEMA_VERSION, buildKernelGraph, query } from "../kernel/index.js";
import { readRepositorySpecs } from "../kernel/adapters/fs.js";

export { KERNEL_SCHEMA_VERSION };

// Optional root override for explicit diagnostics and controlled integration.
// Normal installed MCP execution relies on OMP's active project cwd. An absent
// legacy name-indirection literal, a placeholder, or a relative value must not
// redirect a server toward package-local data.
export function resolveRepositoryRoot(env = process.env, cwd = process.cwd()) {
  const fallback = path.resolve(cwd);
  const raw = env?.OMP_SPEC_KIT_ROOT;
  if (
    typeof raw === "string" &&
    raw.length > 0 &&
    !raw.includes("${") &&
    raw !== "OMP_SPEC_KIT_ROOT" &&
    path.isAbsolute(raw)
  ) {
    return path.resolve(raw);
  }
  return fallback;
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

export function createSpecService(root) {
  if (typeof root !== "string" || root.length === 0) {
    throw new Error("createSpecService requires an explicit repository root");
  }
  let settled = null;

  // Once per service (per process/session per root): reader failure and graph
  // alike are cached so repeated queries never re-read the repository.
  async function ensure() {
    if (settled === null) {
      settled = (async () => {
        let read;
        try {
          read = await readRepositorySpecs({ root });
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

  async function runQuery(operation, args, { requestId = null, schemaVersion } = {}) {
    // Error precedence mirrors SCHEMA-10: schema version first, then request
    // shape, then graph availability; everything else is validated by the
    // pure kernel query service.
    if (schemaVersion !== undefined && schemaVersion !== KERNEL_SCHEMA_VERSION) {
      return makeErrorEnvelope({
        operation,
        requestId,
        code: "UNSUPPORTED_SCHEMA_VERSION",
        message: "unsupported or missing schemaVersion",
        extra: { parameter: "schemaVersion", expected: KERNEL_SCHEMA_VERSION },
      });
    }
    if (requestId !== null && typeof requestId !== "string") {
      return makeErrorEnvelope({
        operation,
        requestId: null,
        code: "INVALID_REQUEST",
        message: "requestId must be a string or null",
        extra: { parameter: "requestId", expected: "string|null", receivedType: typeof requestId },
      });
    }
    const state = await ensure();
    if (state.status === "error") {
      const summaries = adapterDiagnosticSummaries(state.readerError);
      const firstCode =
        typeof state.readerError?.diagnostics?.[0]?.code === "string"
          ? state.readerError.diagnostics[0].code
          : null;
      return makeErrorEnvelope({
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
      });
    }
    const envelope = query(state.graph, operation, args ?? {});
    envelope.requestId = requestId ?? null;
    return envelope;
  }

  return { root, ensure, runQuery };
}

// One-line human summary for tool text content; the canonical envelope always
// travels beside it (details / structuredContent).
export function summarizeEnvelope(envelope) {
  const head = `${envelope.operation} ${envelope.ok ? "ok" : `error ${envelope.error.code}`}`;
  if (!envelope.ok) {
    const detail = envelope.error.parameter ? ` (${envelope.error.parameter})` : "";
    return `${head}${detail}`;
  }
  const page = envelope.page;
  const paging =
    page && typeof page.returned === "number" ? `, returned=${page.returned}/${page.totalMatched}` : "";
  return `${head}${paging}`;
}
