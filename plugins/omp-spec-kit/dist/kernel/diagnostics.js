import { canonicalJson, sha256Hex } from "./normalize.js";
import { DIAGNOSTIC_DEFAULT_SEVERITY, DIAGNOSTIC_CODES } from "./types.js";

// Closed diagnostic construction and stable sorting.

function boundedMessage(text) {
  const value = typeof text === "string" ? text : String(text ?? "");
  return value.length > 2048 ? `${value.slice(0, 2048)}...` : value;
}

export function makeDiagnostic({
  code,
  severity,
  message,
  span = null,
  relatedSpans = [],
  specSlug = null,
  localId = null,
  canonicalId = null,
  referenceOccurrenceId = null,
  expected = null,
  actual = null,
  limitName = null,
  limitValue = null,
  observedValue = null,
}) {
  if (!DIAGNOSTIC_CODES.includes(code)) throw new Error(`unknown diagnostic code: ${code}`);
  const resolvedSeverity =
    severity ?? DIAGNOSTIC_DEFAULT_SEVERITY[code] ?? "WARNING";
  // Stable identity: hash of code, primary span, canonical ID, and related spans.
  const identitySource = {
    code,
    severity: resolvedSeverity,
    span,
    relatedSpans,
    specSlug,
    localId,
    canonicalId,
    referenceOccurrenceId,
  };
  const diagnosticId = sha256Hex(canonicalJson(identitySource));
  return Object.freeze({
    diagnosticId,
    code,
    severity: resolvedSeverity,
    message: boundedMessage(message),
    remediation: code,
    span: span ?? null,
    relatedSpans: Object.freeze(relatedSpans.slice()),
    specSlug: specSlug ?? null,
    localId: localId ?? null,
    canonicalId: canonicalId ?? null,
    referenceOccurrenceId: referenceOccurrenceId ?? null,
    details: Object.freeze({
      expected: expected ?? null,
      actual: actual ?? null,
      limitName: limitName ?? null,
      limitValue: limitValue ?? null,
      observedValue: observedValue ?? null,
    }),
  });
}

const SEVERITY_RANK = { ERROR: 0, WARNING: 1, INFO: 2 };

export function sortDiagnostics(diagnostics) {
  return diagnostics.slice().sort((a, b) => {
    const rankA = SEVERITY_RANK[a.severity];
    const rankB = SEVERITY_RANK[b.severity];
    if (rankA !== rankB) return rankA - rankB;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    const pathA = a.span?.path ?? null;
    const pathB = b.span?.path ?? null;
    if (pathA !== pathB) {
      if (pathA === null) return 1;
      if (pathB === null) return -1;
      return pathA < pathB ? -1 : 1;
    }
    if (pathA !== null) {
      const offsetA = a.span.startOffset;
      const offsetB = b.span.startOffset;
      if (offsetA !== offsetB) return offsetA - offsetB;
    }
    const cidA = a.canonicalId ?? null;
    const cidB = b.canonicalId ?? null;
    if (cidA !== cidB) {
      if (cidA === null) return 1;
      if (cidB === null) return -1;
      return cidA < cidB ? -1 : 1;
    }
    return a.diagnosticId < b.diagnosticId ? -1 : a.diagnosticId > b.diagnosticId ? 1 : 0;
  });
}
