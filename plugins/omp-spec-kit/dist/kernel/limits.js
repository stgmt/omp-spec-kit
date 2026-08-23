// Default and hard limits from NFR.md "Hard input and query limits".
// Callers may choose stricter values; hard maxima are clamped, never raised.

export const DEFAULT_LIMITS = Object.freeze({
  maxSpecs: 100,
  maxDocuments: 2000,
  maxBytesPerDocument: 2 * 1024 * 1024,
  maxAggregateBytes: 50 * 1024 * 1024,
  maxPathBytes: 512,
  maxLinesPerDocument: 100000,
  maxDefinitionOccurrences: 100000,
  maxReferenceOccurrences: 500000,
  maxMarkdownHeadingOccurrences: 250000,
  maxMarkdownLinkOccurrences: 500000,
  maxDiagnostics: 10000,
  defaultPageLimit: 50,
  maxPageLimit: 200,
  defaultTraceDepth: 2,
  maxTraceDepth: 8,
  defaultTraceVisited: 1000,
  maxTraceVisited: 5000,
  maxSearchScalars: 256,
  maxCursorBytes: 512,
  maxResponseBytes: 1024 * 1024,
});

export const LIMIT_NAMES = Object.freeze(Object.keys(DEFAULT_LIMITS));

// Merge caller-supplied partial limits over defaults, clamping every value to
// [1, hard maximum]. Unknown names are ignored (fail-closed validation of
// requests happens in the query service; build callers pass known keys).
export function resolveLimits(partial) {
  const resolved = {};
  for (const name of LIMIT_NAMES) {
    let value = DEFAULT_LIMITS[name];
    const supplied = partial?.[name];
    if (typeof supplied === "number" && Number.isInteger(supplied) && supplied >= 1) {
      value = Math.min(supplied, DEFAULT_LIMITS[name]);
    }
    resolved[name] = value;
  }
  return Object.freeze(resolved);
}

export function canonicalLimitsJson(limits) {
  const ordered = {};
  for (const name of LIMIT_NAMES) ordered[name] = limits[name];
  return JSON.stringify(ordered);
}
