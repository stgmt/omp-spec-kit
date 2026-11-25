// Compare diagnostics by the offending definition, preserving pre-existing
// violations while rejecting new ones. A rename retains the old identity.
const DEFINITION_INTEGRITY_CODES = new Set([
  "MALFORMED_GHERKIN",
  "UNSUPPORTED_GHERKIN_DIALECT",
  "MISSING_SCENARIO_ID",
  "DUPLICATE_SCENARIO_ID_TAG",
  "INVALID_LOCAL_ID",
  "MALFORMED_HEADING",
  "FORBIDDEN_EDGE_ENDPOINT",
  "DUPLICATE_DEFINITION",
  "BROKEN_REFERENCE",
  "MALFORMED_REFERENCE",
  "AMBIGUOUS_REFERENCE",
]);

// Permit only references proven to have belonged to the same original
// scenario, and only while their explicitly named destination still has
// legacy documents. These are unresolved warnings, never resolved edges.
export function preservedPendingReferences(graph, preserved = []) {
  const available = new Map();
  for (const item of preserved) {
    const key = `${item.sourceCanonicalId}\u0000${item.target}`;
    const items = available.get(key) ?? [];
    items.push(item);
    available.set(key, items);
  }
  const skippedDiagnosticIds = new Set();
  const pending = [];
  for (const ref of graph.referenceOccurrences ?? []) {
    if (ref.outcome !== "UNRESOLVED" || ref.unresolvedReason !== "MISSING_TARGET" || ref.requestedEdgeType !== "REFS") continue;
    const separator = ref.rawTarget.indexOf(":");
    if (separator < 1) continue;
    const targetSlug = ref.rawTarget.slice(0, separator);
    const layout = (graph.specLayouts ?? []).find((entry) => entry.specSlug === targetSlug);
    if (!layout || !["legacy", "mixed"].includes(layout.status) || !layout.legacyDocuments?.length) continue;
    const originals = available.get(`${ref.sourceCanonicalId}\u0000${ref.rawTarget}`);
    if (!originals?.length) continue;
    const original = originals.shift();
    for (const id of ref.diagnosticIds ?? []) skippedDiagnosticIds.add(id);
    pending.push({
      code: "PENDING_LEGACY_REFERENCE",
      severity: "WARNING",
      sourceCanonicalId: ref.sourceCanonicalId,
      target: ref.rawTarget,
      sourceDocument: original.sourceDocument,
      sourceStartLine: original.sourceStartLine,
      sourceEndLine: original.sourceEndLine,
      path: ref.span?.path ?? null,
      line: ref.span?.startLine ?? null,
      message: `Existing reference ${ref.rawTarget} cannot be verified until its target specification is migrated`,
    });
  }
  return { skippedDiagnosticIds, pending };
}

export function introducedDefinitionFindings(before, after, renamePairs = new Map()) {
  const identity = (diagnostic) => {
    const rawPath = diagnostic.span?.path ?? "";
    const path = renamePairs.get(rawPath) ?? rawPath;
    const content = diagnostic.canonicalId ?? diagnostic.actual ?? diagnostic.message ?? "";
    return `${diagnostic.code}\u0000${path}\u0000${content}`;
  };
  const counts = (diagnostics) => {
    const result = new Map();
    for (const diagnostic of diagnostics) {
      if (!DEFINITION_INTEGRITY_CODES.has(diagnostic.code)) continue;
      const key = identity(diagnostic);
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  };
  const beforeCounts = counts(before);
  const afterCounts = counts(after);
  const findings = new Map();
  for (const diagnostic of after) {
    if (!DEFINITION_INTEGRITY_CODES.has(diagnostic.code)) continue;
    const key = identity(diagnostic);
    if (findings.has(key) || (afterCounts.get(key) ?? 0) <= (beforeCounts.get(key) ?? 0)) continue;
    findings.set(key, {
      code: diagnostic.code,
      ...(diagnostic.span?.path ? { path: diagnostic.span.path } : {}),
      ...(diagnostic.span?.startLine ? { line: diagnostic.span.startLine } : {}),
      message: diagnostic.message ?? diagnostic.code,
    });
  }
  return [...findings.values()].sort((a, b) => (a.path ?? "").localeCompare(b.path ?? "") || a.code.localeCompare(b.code));
}
