// Bounded read-only query service over one immutable GraphSnapshot.
// Implements the eight closed operations of spec-kernel@1 with the exhaustive
// envelope, stable ordering, projections, fingerprint-bound cursors, and
// fail-closed validation. Pure; no clock, filesystem, or environment access.

import { createHash } from "node:crypto";
import {
  DIAGNOSTIC_CODES,
  DIAGNOSTIC_SEVERITIES,
  DOCUMENT_KINDS,
  EDGE_TYPES,
  FIXED_DOCUMENT_FILES,
  KERNEL_SCHEMA_VERSION,
  LINK_OUTCOMES,
  NODE_KINDS,
  NODE_PROJECTIONS,
  QUERY_OPERATIONS,
} from "../types.js";
import { isValidSpecSlug, splitCanonicalId } from "../identity.js";
import { canonicalJson } from "../normalize.js";
import { decodeCursor, encodeCursor } from "./cursor.js";

const OPERATION_ARG_FIELDS = {
  inventory: ["specSlugs", "includeDocuments", "limit", "cursor"],
  getNode: ["canonicalId", "projection", "includeIncidentCounts"],
  findNodes: ["specSlugs", "kinds", "canonicalIds", "text", "projection", "limit", "cursor"],
  getEdges: ["canonicalId", "direction", "types", "aggregate", "limit", "cursor"],
  trace: ["canonicalId", "direction", "types", "maxDepth", "maxVisited", "projection", "limit", "cursor"],
  diagnostics: ["severities", "codes", "specSlugs", "paths", "limit", "cursor"],
  overview: ["specSlugs"],
  validation: ["severities", "codes", "specSlugs", "paths", "limit", "cursor"],
  markdownInventory: [
    "specSlugs",
    "mode",
    "focusPath",
    "focusAnchor",
    "direction",
    "outcomes",
    "includeHeadings",
    "includeLinks",
    "limit",
    "cursor",
  ],
};

const MAX_CANDIDATES = 50;
const MAX_SUMMARY_DIAGNOSTICS = 20;

const DIAGNOSTIC_SEVERITY_RANK = Object.freeze({ ERROR: 0, WARNING: 1, INFO: 2 });

// Per-snapshot derived indexes; WeakMap keeps public snapshots unchanged.
const indexCache = new WeakMap();

function indexOf(graph) {
  let index = indexCache.get(graph);
  if (index) return index;
  const nodeById = new Map();
  for (const node of graph.nodes) nodeById.set(node.canonicalId, node);
  const outEdges = new Map();
  const inEdges = new Map();
  for (const edge of graph.edges) {
    if (!outEdges.has(edge.from)) outEdges.set(edge.from, []);
    outEdges.get(edge.from).push(edge);
    if (!inEdges.has(edge.to)) inEdges.set(edge.to, []);
    inEdges.get(edge.to).push(edge);
  }
  const candidatesByCanonicalId = new Map();
  for (const candidate of graph.definitionCandidates) {
    if (candidate.canonicalId === null) continue;
    if (!candidatesByCanonicalId.has(candidate.canonicalId)) {
      candidatesByCanonicalId.set(candidate.canonicalId, []);
    }
    candidatesByCanonicalId.get(candidate.canonicalId).push(candidate);
  }
  const headingsById = new Map();
  for (const heading of graph.markdownHeadingOccurrences) {
    headingsById.set(heading.headingOccurrenceId, heading);
  }
  index = { nodeById, outEdges, inEdges, candidatesByCanonicalId, headingsById };
  indexCache.set(graph, index);
  return index;
}

function countSpecs(graph) {
  const slugs = new Set();
  for (const row of graph.documents) slugs.add(row.specSlug);
  return slugs.size;
}

function specOfPath(path) {
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === ".specs" ? parts[1] : null;
}

function sha256Short(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

// ---- envelope helpers ------------------------------------------------------

function emptyError() {
  return {
    code: "INVALID_REQUEST",
    message: "",
    operation: null,
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
  };
}

function errorEnvelope(graph, request, error) {
  return {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    requestId: request.requestId ?? null,
    operation: typeof request.operation === "string" ? request.operation.slice(0, 64) : null,
    ok: false,
    graph: error.preGraph ? null : graphMeta(graph),
    page: null,
    data: null,
    error: { ...emptyError(), ...error },
    diagnostics: error.preGraph ? [] : relevantSummaries(graph, (d) => d.canonicalId === error.canonicalId),
  };
}

function successEnvelope(graph, requestId, operation, data, page, summaries) {
  return {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    requestId: requestId ?? null,
    operation,
    ok: true,
    graph: graphMeta(graph),
    page: page ?? null,
    data,
    error: null,
    diagnostics: summaries ?? [],
  };
}

function graphMeta(graph) {
  return {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    fingerprint: graph.fingerprint,
    valid: graph.valid,
    specCount: countSpecs(graph),
    documentCount: graph.counts.discoveredDocuments,
    nodeCount: graph.nodes.length,
    edgeOccurrenceCount: graph.edges.length,
    unresolvedReferenceCount: graph.counts.unresolvedReferenceOccurrences,
    markdownHeadingOccurrenceCount: graph.counts.markdownHeadingOccurrences,
    markdownLinkOccurrenceCount: graph.counts.markdownLinkOccurrences,
    diagnosticCount: graph.diagnostics.length,
  };
}

function summaryOf(diagnostic) {
  return {
    diagnosticId: diagnostic.diagnosticId,
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    remediation: diagnostic.remediation,
    source: diagnostic.span
      ? {
          path: typeof diagnostic.span.path === "string" ? diagnostic.span.path : null,
          startLine: diagnostic.span.startLine,
          startColumn: diagnostic.span.startColumn,
          endLine: diagnostic.span.endLine,
          endColumn: diagnostic.span.endColumn,
        }
      : null,
    canonicalId: diagnostic.canonicalId ?? null,
  };
}

function sourceSummary(span) {
  return {
    path: typeof span?.path === "string" ? span.path : null,
    startLine: span.startLine,
    startColumn: span.startColumn,
    endLine: span.endLine,
    endColumn: span.endColumn,
  };
}

function relevantSummaries(graph, selector) {
  const selected = [];
  for (const diagnostic of graph.diagnostics) {
    if (selector(diagnostic)) {
      selected.push(summaryOf(diagnostic));
      if (selected.length >= MAX_SUMMARY_DIAGNOSTICS) break;
    }
  }
  return selected;
}

function nodeSummary(node, excerpt = null) {
  return {
    canonicalId: node.canonicalId,
    specSlug: node.specSlug,
    localId: node.localId,
    kind: node.kind,
    title: node.title,
    source: sourceSummary(node.span),
    contentHash: node.contentHash,
    excerpt: excerpt ?? null,
    incidentInCount: null,
    incidentOutCount: null,
  };
}

// ---- validation ------------------------------------------------------------

function isPlainObject(value) {
  return value !== null && typeof value !== "undefined" && typeof value === "object" && !Array.isArray(value);
}

function boundedSummary(value) {
  let text;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) text = String(value);
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
}

function invalid(operation, parameter, expected, received, message) {
  return {
    code: "INVALID_PARAMETER",
    operation,
    parameter,
    expected,
    receivedType: valueKind(received),
    receivedSummary: boundedSummary(received),
    message: message ?? `invalid ${parameter}: expected ${expected}`,
  };
}

function valueKind(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

class Validator {
  constructor(operation, args, limits) {
    this.operation = operation;
    this.args = args;
    this.limits = limits;
    this.error = null;
  }

  fail(error) {
    if (this.error === null) this.error = error;
  }

  missing(parameter) {
    this.fail({ code: "MISSING_FIELD", parameter });
  }

  unknownField(key) {
    this.fail({ code: "UNKNOWN_FIELD", parameter: key });
  }

  enumArray(field, items, predicate, expected) {
    if (!Object.hasOwn(this.args, field)) {
      this.missing(field);
      return;
    }
    const value = this.args[field];
    if (!Array.isArray(value)) {
      this.fail(invalid(this.operation, field, "array", value));
      return;
    }
    for (const item of value) {
      if (!predicate(item)) {
        this.fail(invalid(this.operation, field, expected, item));
        return;
      }
    }
  }

  boolean(field) {
    requireBoolean(this, field);
  }

  stringOrNull(field) {
    if (!Object.hasOwn(this.args, field)) this.missing(field);
    else if (this.args[field] !== null && typeof this.args[field] !== "string") {
      this.fail(invalid(this.operation, field, "string|null", this.args[field]));
    }
  }

  canonicalId() {
    const value = this.args.canonicalId;
    if (!Object.hasOwn(this.args, "canonicalId")) this.missing("canonicalId");
    else if (typeof value !== "string" || splitCanonicalId(value) === null) {
      this.fail(invalid(this.operation, "canonicalId", "<spec-slug>:<local-id>", value));
    }
  }

  projection() {
    const value = this.args.projection;
    if (!Object.hasOwn(this.args, "projection")) this.missing("projection");
    else if (!NODE_PROJECTIONS.includes(value)) {
      this.fail(invalid(this.operation, "projection", '"summary"|"full"', value));
    }
  }

  direction() {
    const value = this.args.direction;
    if (!Object.hasOwn(this.args, "direction")) this.missing("direction");
    else if (!["in", "out", "both"].includes(value)) {
      this.fail(invalid(this.operation, "direction", '"in"|"out"|"both"', value));
    }
  }

  paging() {
    const { limit, cursor } = this.args;
    if (!Object.hasOwn(this.args, "limit")) this.missing("limit");
    else if (!Number.isInteger(limit)) this.fail(invalid(this.operation, "limit", "integer", limit));
    else if (limit < 1 || limit > this.limits.maxPageLimit) {
      // SCHEMA-8: "limit must be 1 through maxPageLimit" — an out-of-range page
      // size is a request-parameter violation, not a runtime cap.
      this.fail(invalid(this.operation, "limit", `1..${this.limits.maxPageLimit}`, limit));
    }
    if (!Object.hasOwn(this.args, "cursor")) this.missing("cursor");
    else if (cursor !== null && typeof cursor !== "string") {
      this.fail(invalid(this.operation, "cursor", "string|null", cursor));
    }
  }
}

function requireBoolean(validator, field) {
  if (!Object.hasOwn(validator.args, field)) validator.missing(field);
  else if (typeof validator.args[field] !== "boolean") {
    validator.fail(invalid(validator.operation, field, "boolean", validator.args[field]));
  }
}

function validateRequest(graph, limits, request) {
  if (!isPlainObject(request)) {
    return { error: { code: "INVALID_REQUEST", preGraph: true, message: "request must be an object" } };
  }
  if (request.schemaVersion !== KERNEL_SCHEMA_VERSION) {
    return {
      error: {
        code: "UNSUPPORTED_SCHEMA_VERSION",
        preGraph: true,
        operation: request.operation ?? null,
        parameter: "schemaVersion",
        expected: KERNEL_SCHEMA_VERSION,
        receivedSummary: boundedSummary(request.schemaVersion),
        message: "unsupported or missing schemaVersion",
      },
    };
  }
  const requestId = request.requestId ?? null;
  if (requestId !== null && typeof requestId !== "string") {
    return { error: { code: "INVALID_REQUEST", preGraph: true, parameter: "requestId", expected: "string|null" } };
  }
  if (typeof requestId === "string" && [...requestId].length > 128) {
    return {
      error: {
        code: "INVALID_REQUEST",
        preGraph: true,
        parameter: "requestId",
        limitName: "requestIdScalars",
        limitValue: 128,
        observedValue: [...requestId].length,
        message: "requestId exceeds 128 Unicode scalars",
      },
    };
  }
  if (typeof request.operation !== "string" || !QUERY_OPERATIONS.includes(request.operation)) {
    return {
      error: {
        code: "UNKNOWN_OPERATION",
        preGraph: true,
        operation: typeof request.operation === "string" ? request.operation.slice(0, 64) : null,
        message: "unknown query operation",
      },
    };
  }
  if (!isPlainObject(request.args)) {
    return { error: { code: "MISSING_FIELD", operation: request.operation, parameter: "args", expected: "object" } };
  }
  const allowed = OPERATION_ARG_FIELDS[request.operation];
  const v = new Validator(request.operation, request.args, limits);
  for (const key of Object.keys(request.args)) {
    if (!allowed.includes(key)) v.unknownField(key);
  }

  switch (request.operation) {
    case "inventory":
      v.enumArray("specSlugs", request.args.specSlugs, isValidSpecSlug, "<spec-slug>");
      v.boolean("includeDocuments");
      v.paging();
      break;
    case "getNode":
      v.canonicalId();
      v.projection();
      v.boolean("includeIncidentCounts");
      break;
    case "findNodes": {
      v.enumArray("specSlugs", request.args.specSlugs, isValidSpecSlug, "<spec-slug>");
      v.enumArray("kinds", request.args.kinds, (item) => NODE_KINDS.includes(item), "NodeKind");
      v.enumArray(
        "canonicalIds",
        request.args.canonicalIds,
        (item) => typeof item === "string" && splitCanonicalId(item) !== null,
        "<spec-slug>:<local-id>",
      );
      v.stringOrNull("text");
      if (
        !v.error &&
        typeof request.args.text === "string" &&
        [...request.args.text].length > limits.maxSearchScalars
      ) {
        v.fail({
          code: "LIMIT_EXCEEDED",
          parameter: "text",
          limitName: "maxSearchScalars",
          limitValue: limits.maxSearchScalars,
          observedValue: [...request.args.text].length,
          message: "search text exceeds maxSearchScalars",
        });
      }
      v.projection();
      v.paging();
      break;
    }
    case "getEdges":
      v.canonicalId();
      v.direction();
      v.enumArray("types", request.args.types, (item) => EDGE_TYPES.includes(item), "EdgeType");
      v.boolean("aggregate");
      v.paging();
      break;
    case "trace": {
      v.canonicalId();
      v.direction();
      v.enumArray("types", request.args.types, (item) => EDGE_TYPES.includes(item), "EdgeType");
      for (const [field, max] of [
        ["maxDepth", limits.maxTraceDepth],
        ["maxVisited", limits.maxTraceVisited],
      ]) {
        const value = request.args[field];
        if (!Object.hasOwn(request.args, field)) v.missing(field);
        else if (!Number.isInteger(value)) v.fail(invalid("trace", field, "integer", value));
        else if (value < 1 || value > max) {
          v.fail({
            code: "LIMIT_EXCEEDED",
            parameter: field,
            limitName: field === "maxDepth" ? "maxTraceDepth" : "maxTraceVisited",
            limitValue: max,
            observedValue: value,
            message: `${field} must be 1..${max}`,
          });
        }
      }
      v.projection();
      v.paging();
      break;
    }
    case "diagnostics":
      v.enumArray("severities", request.args.severities, (item) => DIAGNOSTIC_SEVERITIES.includes(item), "DiagnosticSeverity");
      v.enumArray("codes", request.args.codes, (item) => DIAGNOSTIC_CODES.includes(item), "DiagnosticCode");
      v.enumArray("specSlugs", request.args.specSlugs, isValidSpecSlug, "<spec-slug>");
      v.enumArray("paths", request.args.paths, (item) => typeof item === "string", "string");
      v.paging();
      break;
    case "overview":
      v.enumArray("specSlugs", request.args.specSlugs, isValidSpecSlug, "<spec-slug>");
      break;
    case "validation":
      v.enumArray("severities", request.args.severities, (item) => DIAGNOSTIC_SEVERITIES.includes(item), "DiagnosticSeverity");
      v.enumArray("codes", request.args.codes, (item) => DIAGNOSTIC_CODES.includes(item), "DiagnosticCode");
      v.enumArray("specSlugs", request.args.specSlugs, isValidSpecSlug, "<spec-slug>");
      v.enumArray("paths", request.args.paths, (item) => typeof item === "string", "string");
      v.paging();
      break;
    case "markdownInventory":
      validateMarkdownInventory(v, request.args, limits);
      break;
    default:
      break;
  }

  if (v.error !== null) {
    return { error: { operation: request.operation, ...v.error } };
  }
  return { args: request.args };
}

function validateMarkdownInventory(v, args, limits) {
  v.enumArray("specSlugs", args.specSlugs, isValidSpecSlug, "<spec-slug>");
  if (!Object.hasOwn(args, "mode")) v.missing("mode");
  else if (!["all", "focus"].includes(args.mode)) v.fail(invalid("markdownInventory", "mode", '"all"|"focus"', args.mode));
  v.stringOrNull("focusPath");
  v.stringOrNull("focusAnchor");
  v.direction();
  v.enumArray("outcomes", args.outcomes, (item) => LINK_OUTCOMES.includes(item), "link outcome");
  v.boolean("includeHeadings");
  v.boolean("includeLinks");
  v.paging();
  if (v.error !== null) return;
  if (args.includeHeadings === false && args.includeLinks === false) {
    v.fail({
      code: "INVALID_PARAMETER",
      parameter: "includeHeadings/includeLinks",
      message: "at least one include flag must be true",
    });
    return;
  }
  if (args.mode === "all") {
    if (args.focusPath !== null || args.focusAnchor !== null || args.direction !== "both") {
      v.fail({
        code: "INVALID_PARAMETER",
        parameter: "mode",
        message: 'mode="all" requires null focus fields and direction="both"',
      });
    }
    return;
  }
  if (args.focusPath === null || args.focusAnchor === null) {
    v.fail({
      code: "INVALID_PARAMETER",
      parameter: "focusPath",
      message: 'mode="focus" requires a non-null focusPath and focusAnchor',
    });
    return;
  }
  const normalized = normalizeMarkdownPath(args.focusPath);
  if (normalized === null || !normalized.startsWith(".specs/")) {
    v.fail(
      invalid(
        "markdownInventory",
        "focusPath",
        "normalized repository-relative Markdown document path",
        args.focusPath,
      ),
    );
    return;
  }
  args.focusPath = normalized;
}

function normalizeMarkdownPath(path) {
  if (typeof path !== "string" || path.length === 0) return null;
  const nfc = path.normalize("NFC");
  if (/^[A-Za-z]:[\\/]/u.test(nfc) || nfc.startsWith("/")) return null;
  const replaced = nfc.split("\\").join("/");
  if (/\/\/+/u.test(replaced)) return null;
  for (const segment of replaced.split("/")) {
    if (segment === "" || segment === "." || segment === "..") return null;
  }
  return replaced;
}

// ---- pagination ------------------------------------------------------------

function filterDigest(args) {
  // Binding covers normalized filters only; limit and cursor are not part of
  // the identity of a cursor chain.
  const { cursor, limit, ...filters } = args;
  void cursor;
  void limit;
  return sha256Short(canonicalJson(filters));
}

function compareKeys(a, b) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  return ja < jb ? -1 : ja > jb ? 1 : 0;
}

// Generic stable pagination over a fully sorted list. Returns
// { slice, nextCursor, totalMatched, truncated, cursorError }.
function paginate(sortedItems, keyFn, args, limits, binding, responseBudgetBytes) {
  let start = 0;
  if (args.cursor !== null) {
    const decoded = decodeCursor(args.cursor, limits.maxCursorBytes);
    if (!decoded.ok) return { cursorError: decoded.code };
    const payload = decoded.payload;
    if (
      payload.fp !== binding.fingerprint ||
      payload.op !== binding.operation ||
      payload.fd !== binding.digest ||
      !Array.isArray(payload.k)
    ) {
      return { cursorError: "STALE_CURSOR" };
    }
    const lastKeyJson = JSON.stringify(payload.k);
    while (start < sortedItems.length && JSON.stringify(keyFn(sortedItems[start])) <= lastKeyJson) {
      start += 1;
    }
  }
  // Response-size budget: cut the page at an item boundary when needed.
  let end = start;
  let used = 0;
  const oversizedSingleItem = sortedItems.length > start && estimateItemSize(sortedItems[start]) > responseBudgetBytes;
  while (end < sortedItems.length && end - start < args.limit) {
    used += estimateItemSize(sortedItems[end]);
    if (used > responseBudgetBytes) break;
    end += 1;
  }
  const slice = sortedItems.slice(start, end);
  const hasMore = end < sortedItems.length;
  const lastKey = slice.length > 0 ? keyFn(slice[slice.length - 1]) : null;
  const nextCursor = hasMore && lastKey !== null ? encodeCursor({ fp: binding.fingerprint, op: binding.operation, fd: binding.digest, k: lastKey }) : null;
  return {
    slice,
    totalMatched: sortedItems.length,
    truncated: hasMore || used > responseBudgetBytes,
    nextCursor,
    oversizedSingleItem,
  };
}

function estimateItemSize(item) {
  try {
    return JSON.stringify(item).length;
  } catch {
    return 4096;
  }
}

function makePage(args, pagination, dataBytes) {
  return {
    limit: args.limit ?? 0,
    returned: pagination.slice?.length ?? 0,
    totalMatched: pagination.totalMatched ?? 0,
    cursor: args.cursor ?? null,
    nextCursor: pagination.nextCursor ?? null,
    truncated: Boolean(pagination.truncated),
    responseBytes: dataBytes,
  };
}

// ---- operations ------------------------------------------------------------

export function executeQuery(graph, request, limitsOverride) {
  const limits = graph.limits ?? limitsOverride;
  if (!limits) throw new Error("query service requires graph.limits or explicit limits");

  const validation = validateRequest(graph, limits, request);
  if (validation.error) return errorEnvelope(graph, request, validation.error);
  const args = validation.args;
  const operation = request.operation;

  // Cursor decode errors are reported before identity checks.
  if ("cursor" in args && args.cursor !== null) {
    const probe = probeCursor(args.cursor, limits);
    if (probe !== null) return errorEnvelope(graph, request, probe);
  }

  switch (operation) {
    case "inventory":
      return runInventory(graph, request, args, limits);
    case "getNode":
      return runGetNode(graph, request, args, limits);
    case "findNodes":
      return runFindNodes(graph, request, args, limits);
    case "getEdges":
      return runGetEdges(graph, request, args, limits);
    case "trace":
      return runTrace(graph, request, args, limits);
    case "diagnostics":
      return runDiagnostics(graph, request, args, limits);
    case "overview":
      return runOverview(graph, request, args, limits);
    case "markdownInventory":
      return runMarkdownInventory(graph, request, args, limits);
    case "validation":
      return runValidation(graph, request, args, limits);
    default:
      return errorEnvelope(graph, request, { code: "UNKNOWN_OPERATION", preGraph: true });
  }
}

function probeCursor(cursor, limits) {
  const decoded = decodeCursor(cursor, limits.maxCursorBytes);
  if (!decoded.ok) return { code: decoded.code, parameter: "cursor", message: decoded.code };
  return null;
}

function selectedSpecs(graph, slugFilter) {
  const all = new Set();
  for (const row of graph.documents) all.add(row.specSlug);
  const selected = [...all].filter((slug) => slugFilter.length === 0 || slugFilter.includes(slug));
  selected.sort();
  return selected;
}

function runInventory(graph, request, args, limits) {
  const idx = indexOf(graph);
  const specs = [];
  const selected = selectedSpecs(graph, args.specSlugs);
  for (const slug of selected) {
    const documents = graph.documents.filter((row) => row.specSlug === slug);
    const acceptedKinds = new Set(documents.filter((row) => row.accepted).map((row) => row.documentKind));
    const nodes = graph.nodes.filter((node) => node.specSlug === slug);
    const edges = graph.edges.filter((edge) => edge.from.startsWith(`${slug}:`));
    const unresolvedRefs = graph.referenceOccurrences.filter(
      (ref) => ref.outcome === "UNRESOLVED" && ref.sourceCanonicalId?.startsWith(`${slug}:`),
    );
    const diags = graph.diagnostics.filter((diagnostic) => diagnostic.specSlug === slug);
    specs.push({
      specSlug: slug,
      valid: !diags.some((diagnostic) => diagnostic.severity === "ERROR"),
      documentCount: documents.length,
      missingCanonicalDocuments: missingCanonicalKinds(slug, acceptedKinds),
      nodeCount: nodes.length,
      edgeOccurrenceCount: edges.length,
      unresolvedReferenceCount: unresolvedRefs.length,
      errorCount: diags.filter((diagnostic) => diagnostic.severity === "ERROR").length,
      warningCount: diags.filter((diagnostic) => diagnostic.severity === "WARNING").length,
      infoCount: diags.filter((diagnostic) => diagnostic.severity === "INFO").length,
      documents: args.includeDocuments
        ? documents.map((row) => ({
            path: row.path,
            documentKind: row.documentKind,
            sha256: row.sha256,
            byteLength: row.byteLength,
            accepted: row.accepted,
          }))
        : [],
    });
  }
  void idx;

  const totals = {
    specCount: specs.length,
    validSpecCount: specs.filter((spec) => spec.valid).length,
    documentCount: sum(specs.map((spec) => spec.documentCount)),
    nodeCount: sum(specs.map((spec) => spec.nodeCount)),
    edgeOccurrenceCount: sum(specs.map((spec) => spec.edgeOccurrenceCount)),
    unresolvedReferenceCount: sum(specs.map((spec) => spec.unresolvedReferenceCount)),
    errorCount: sum(specs.map((spec) => spec.errorCount)),
    warningCount: sum(specs.map((spec) => spec.warningCount)),
    infoCount: sum(specs.map((spec) => spec.infoCount)),
  };

  const binding = { fingerprint: graph.fingerprint, operation: "inventory", digest: filterDigest({ s: args.specSlugs, i: args.includeDocuments }) };
  const pagination = paginate(specs, (spec) => [spec.specSlug], args, limits, binding, limits.maxResponseBytes - 4096);
  if (pagination.cursorError) return errorEnvelope(graph, request, { code: pagination.cursorError, parameter: "cursor", message: pagination.cursorError });
  if (pagination.oversizedSingleItem) {
    return errorEnvelope(graph, request, { code: "RESPONSE_TOO_LARGE", message: "single inventory entry exceeds the response budget" });
  }
  const data = { kind: "inventory", specs: pagination.slice, totals };
  const dataBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  return successEnvelope(graph, request.requestId, "inventory", data, makePage(args, pagination, dataBytes));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function expectedFilename(kind, slug) {
  if (kind === "FEATURE") return `${slug}.feature`;
  if (kind === "SCHEMA") return `${slug}_SCHEMA.md`;
  return FIXED_DOCUMENT_FILES[kind] ?? null;
}

function missingCanonicalKinds(slug, acceptedKinds) {
  const missing = [];
  for (const kind of DOCUMENT_KINDS) {
    const filename = expectedFilename(kind, slug);
    if (filename !== null && !acceptedKinds.has(kind)) missing.push(kind);
  }
  return missing;
}

function runGetNode(graph, request, args, limits) {
  const idx = indexOf(graph);
  const candidates = idx.candidatesByCanonicalId.get(args.canonicalId);
  if (candidates !== undefined && candidates.length >= 2) {
    return errorEnvelope(graph, request, {
      code: "AMBIGUOUS_ID",
      canonicalId: args.canonicalId,
      message: `canonical ID ${args.canonicalId} has ${candidates.length} definition candidates`,
      candidates: candidates.slice(0, MAX_CANDIDATES).map(candidateSummary),
      retryable: false,
    });
  }
  const node = idx.nodeById.get(args.canonicalId);
  if (!node) {
    return errorEnvelope(graph, request, { code: "NOT_FOUND", canonicalId: args.canonicalId, message: `no node ${args.canonicalId}` });
  }
  const incoming = idx.inEdges.get(args.canonicalId) ?? [];
  const outgoing = idx.outEdges.get(args.canonicalId) ?? [];
  let payload;
  if (args.projection === "full") {
    payload = { ...node };
  } else {
    payload = nodeSummary(node);
    delete payload.incidentInCount;
    delete payload.incidentOutCount;
  }
  const incomingCount = args.includeIncidentCounts ? incoming.length : null;
  const outgoingCount = args.includeIncidentCounts ? outgoing.length : null;
  const data = { kind: "node", node: payload, incomingCount, outgoingCount };
  const summaries = relevantSummaries(graph, (diagnostic) => diagnostic.canonicalId === args.canonicalId);
  return successEnvelope(graph, request.requestId, "getNode", data, null, summaries);
}

function candidateSummary(candidate) {
  return {
    occurrenceId: candidate.occurrenceId,
    canonicalId: candidate.canonicalId ?? null,
    kind: candidate.nodeKind ?? null,
    title: candidate.title,
    source: sourceSummary(candidate.span),
    diagnosticIds: candidate.diagnosticIds ?? [],
  };
}

function edgeSummary(edge, aggregate) {
  return {
    edgeId: aggregate ? null : edge.edgeId,
    from: edge.from,
    to: edge.to,
    type: edge.type,
    source: aggregate ? null : sourceSummary(edge.span),
    occurrenceCount: 1,
  };
}

function incidentEdges(idx, canonicalId, direction, typeSet) {
  // Empty filter array means "all edge types".
  const allowed = typeSet.size === 0 ? null : (type) => typeSet.has(type);
  const result = [];
  if (direction !== "in") {
    for (const edge of idx.outEdges.get(canonicalId) ?? []) {
      if (allowed === null || allowed(edge.type)) result.push(edge);
    }
  }
  if (direction !== "out") {
    for (const edge of idx.inEdges.get(canonicalId) ?? []) {
      if (allowed === null || allowed(edge.type)) result.push(edge);
    }
  }
  return sortEdges(result);
}

function sortEdges(edges) {
  return edges.slice().sort(
    (a, b) =>
      compareStrings(a.from, b.from) ||
      compareStrings(a.to, b.to) ||
      compareStrings(a.type, b.type) ||
      compareStrings(a.span.path, b.span.path) ||
      a.span.startOffset - b.span.startOffset ||
      compareStrings(a.edgeId, b.edgeId),
  );
}

function compareStrings(a, b) {
  return a === b ? 0 : a < b ? -1 : 1;
}

function runGetEdges(graph, request, args, limits) {
  const idx = indexOf(graph);
  if (!idx.nodeById.has(args.canonicalId)) {
    return errorEnvelope(graph, request, { code: "NOT_FOUND", canonicalId: args.canonicalId, message: `no node ${args.canonicalId}` });
  }
  const direction = args.direction;
  const typeSet = new Set(args.types);
  let rows = incidentEdges(idx, args.canonicalId, direction, typeSet).map((edge) => ({ edge }));
  if (args.aggregate) {
    const groups = new Map();
    for (const { edge } of rows) {
      const key = canonicalJson([edge.from, edge.to, edge.type]);
      const group = groups.get(key) ?? { from: edge.from, to: edge.to, type: edge.type, count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
    rows = [...groups.values()].sort(
      (a, b) => compareStrings(a.from, b.from) || compareStrings(a.to, b.to) || compareStrings(a.type, b.type),
    );
  }

  const binding = { fingerprint: graph.fingerprint, operation: "getEdges", digest: filterDigest(args) };
  const keyFn = args.aggregate
    ? (row) => [row.from, row.to, row.type]
    : (row) => [row.from, row.to, row.type, row.source.path, row.source.startOffset, row.edgeId];
  const projected = args.aggregate
    ? rows.map((group) => ({
        edgeId: null,
        from: group.from,
        to: group.to,
        type: group.type,
        source: null,
        occurrenceCount: group.count,
      }))
    : rows.map((row) => edgeSummary(row.edge, false));
  return finishEdgeQuery(graph, request, args, limits, binding, projected, keyFn);
}

function finishEdgeQuery(graph, request, args, limits, binding, projected, keyFn) {
  const pagination = paginate(projected, keyFn, args, limits, binding, limits.maxResponseBytes - 2048);
  if (pagination.cursorError) {
    return errorEnvelope(graph, request, { code: pagination.cursorError, parameter: "cursor", message: pagination.cursorError });
  }
  const data = { kind: "edges", edges: pagination.slice };
  const dataBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  const summaries = relevantSummaries(graph, (diagnostic) => diagnostic.canonicalId === args.canonicalId);
  return successEnvelope(graph, request.requestId, "getEdges", data, makePage(args, pagination, dataBytes), summaries);
}

function runFindNodes(graph, request, args, limits) {
  const slugFilter = new Set(args.specSlugs);
  const kindFilter = new Set(args.kinds);
  const idFilter = new Set(args.canonicalIds);
  const needle = typeof args.text === "string" ? args.text.toLowerCase() : null;

  const matches = [];
  for (const node of graph.nodes) {
    if (slugFilter.size > 0 && !slugFilter.has(node.specSlug)) continue;
    if (kindFilter.size > 0 && !kindFilter.has(node.kind)) continue;
    if (idFilter.size > 0 && !idFilter.has(node.canonicalId)) continue;
    let excerpt = null;
    if (needle !== null) {
      const haystack = `${node.title}\n${node.localId}\n${node.body}`.toLowerCase();
      const at = haystack.indexOf(needle);
      if (at < 0) continue;
      excerpt = buildExcerpt(haystack, at, needle.length);
    }
    matches.push(excerpt === null ? node : { ...node, _excerpt: excerpt });
  }
  matches.sort((a, b) => compareStrings(a.canonicalId, b.canonicalId));

  const binding = { fingerprint: graph.fingerprint, operation: "findNodes", digest: filterDigest(args) };
  const pagination = paginate(matches, (node) => [node.canonicalId], args, limits, binding, limits.maxResponseBytes - 2048);
  if (pagination.cursorError) {
    return errorEnvelope(graph, request, { code: pagination.cursorError, parameter: "cursor", message: pagination.cursorError });
  }
  const projected = pagination.slice.map((node) =>
    args.projection === "full"
      ? stripExcerptMarker(node)
      : nodeSummary(stripExcerptMarker(node), node._excerpt ?? null),
  );
  const data = { kind: "nodes", nodes: projected };
  const dataBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  return successEnvelope(graph, request.requestId, "findNodes", data, makePage(args, pagination, dataBytes));
}

function stripExcerptMarker(node) {
  if (node._excerpt === undefined) return node;
  const copy = { ...node };
  delete copy._excerpt;
  return copy;
}

function buildExcerpt(haystack, at, length) {
  const windowStart = Math.max(0, at - 60);
  const windowEnd = Math.min(haystack.length, at + length + 60);
  let excerpt = haystack.slice(windowStart, windowEnd).replace(/\s+/gu, " ").trim();
  if ([...excerpt].length > 240) excerpt = [...excerpt].slice(0, 240).join("");
  return excerpt;
}

function runTrace(graph, request, args, limits) {
  const idx = indexOf(graph);
  const startId = args.canonicalId;
  if (!idx.nodeById.has(startId)) {
    return errorEnvelope(graph, request, { code: "NOT_FOUND", canonicalId: startId, message: `no node ${startId}` });
  }
  const maxDepth = Math.min(args.maxDepth, limits.maxTraceDepth);
  const maxVisited = Math.min(args.maxVisited, limits.maxTraceVisited);
  const typeSet = new Set(args.types);

  const visited = new Set([startId]);
  const levels = [[startId]];
  const traversalEdges = [];
  const cycleEdges = [];
  const frontier = [];
  let queue = [startId];
  let depth = 0;
  while (queue.length > 0 && depth < maxDepth && visited.size < maxVisited) {
    const nextLevel = [];
    for (const current of queue) {
      if (visited.size >= maxVisited && current !== startId) {
        frontier.push(current);
        continue;
      }
      const incident = incidentEdges(idx, current, args.direction, typeSet);
      for (const edge of incident) {
        const other = edge.from === current ? edge.to : edge.from;
        if (visited.has(other)) {
          if (other !== startId || edge.from !== other) cycleEdges.push(edge.edgeId);
          continue;
        }
        visited.add(other);
        nextLevel.push(other);
        traversalEdges.push(edge);
      }
    }
    if (nextLevel.length > 0) levels.push(nextLevel.sort(compareStrings));
    queue = nextLevel;
    depth += 1;
  }
  for (const remaining of queue) frontier.push(remaining);
  queue = [];

  const orderedNodes = levels.flat();
  const visitedCount = visited.size;
  const maxDepthReached = levels.length - 1;
  const traversalEdgeIds = new Set(traversalEdges.map((edge) => edge.edgeId));
  const edgesSorted = sortEdges(traversalEdges);

  // Pagination over BFS-ordered nodes; edges follow their origin node's window.
  const binding = { fingerprint: graph.fingerprint, operation: "trace", digest: filterDigest(args) };
  const pagination = paginate(orderedNodes, (id) => [id], args, limits, binding, limits.maxResponseBytes - 8192);
  if (pagination.cursorError) {
    return errorEnvelope(graph, request, { code: pagination.cursorError, parameter: "cursor", message: pagination.cursorError });
  }
  if (pagination.oversizedSingleItem) {
    return errorEnvelope(graph, request, { code: "RESPONSE_TOO_LARGE", message: "trace node exceeds the response budget" });
  }
  const windowIds = new Set(pagination.slice);
  const windowEdges = edgesSorted
    .filter((edge) => windowIds.has(edge.from) || windowIds.has(edge.to))
    .map((edge) => edgeSummary(edge, false));
  const nodesProjected = pagination.slice.map((id) => {
    const node = idx.nodeById.get(id);
    return args.projection === "full" ? { ...node } : nodeSummary(node);
  });

  const data = {
    kind: "trace",
    start: startId,
    nodes: nodesProjected,
    edges: windowEdges,
    frontier: [...new Set(frontier)].sort(compareStrings).filter((id) => idx.nodeById.has(id)),
    maxDepthReached,
    visitedCount,
    cycleEdges: [...new Set(cycleEdges)].sort(compareStrings),
  };
  const dataBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  const summaries = relevantSummaries(graph, (diagnostic) => diagnostic.canonicalId === startId);
  return successEnvelope(graph, request.requestId, "trace", data, makePage(args, pagination, dataBytes), summaries);
}

function runValidation(graph, request, args, limits) {
  const knownSlugs = new Set();
  for (const doc of graph.documents) knownSlugs.add(doc.specSlug);

  const rawSlugs = args.specSlugs;
  if (Array.isArray(rawSlugs) && rawSlugs.length > 0) {
    for (const slug of rawSlugs) {
      if (!isValidSpecSlug(slug)) {
        return errorEnvelope(graph, request, {
          code: "INVALID_PARAMETER",
          parameter: "specSlugs",
          message: `invalid spec slug syntax: ${slug}`,
        });
      }
      if (!knownSlugs.has(slug)) {
        return errorEnvelope(graph, request, {
          code: "NOT_FOUND",
          specSlug: slug,
          message: `specification not found: ${slug}`,
        });
      }
    }
  }

  const scope = Array.isArray(rawSlugs) && rawSlugs.length > 0
    ? { mode: "specifications", specSlugs: [...new Set(rawSlugs)].sort() }
    : { mode: "corpus", specSlugs: [] };

  const severityFilter = new Set(args.severities);
  const codeFilter = new Set(args.codes);
  const pathFilter = new Set(args.paths);

  let errors = 0;
  let warnings = 0;
  let info = 0;
  let total = 0;
  const matchedItems = [];

  for (const diagnostic of graph.diagnostics) {
    if (scope.mode === "specifications") {
      if (diagnostic.specSlug === null || !scope.specSlugs.includes(diagnostic.specSlug)) {
        continue;
      }
    }
    total += 1;
    if (diagnostic.severity === "ERROR") errors += 1;
    else if (diagnostic.severity === "WARNING") warnings += 1;
    else if (diagnostic.severity === "INFO") info += 1;

    if (severityFilter.size > 0 && !severityFilter.has(diagnostic.severity)) continue;
    if (codeFilter.size > 0 && !codeFilter.has(diagnostic.code)) continue;
    if (pathFilter.size > 0 && !(diagnostic.span !== null && pathFilter.has(diagnostic.span.path))) continue;

    matchedItems.push(diagnostic);
  }

  const valid = errors === 0;
  const verdict = valid ? "VALID" : "INVALID";

  const binding = { fingerprint: graph.fingerprint, operation: "validation", digest: filterDigest(args) };
  const pagination = paginate(
    matchedItems,
    (diagnostic) => [
      DIAGNOSTIC_SEVERITY_RANK[diagnostic.severity],
      diagnostic.code,
      diagnostic.span?.path ?? null,
      diagnostic.span?.path ? (diagnostic.span?.startOffset ?? null) : null,
      diagnostic.diagnosticId,
    ],
    args,
    limits,
    binding,
    limits.maxResponseBytes - 2048,
  );
  if (pagination.cursorError) {
    return errorEnvelope(graph, request, { code: pagination.cursorError, parameter: "cursor", message: pagination.cursorError });
  }
  if (pagination.oversizedSingleItem) {
    return errorEnvelope(graph, request, { code: "RESPONSE_TOO_LARGE", message: "single diagnostic exceeds the response budget" });
  }

  const data = {
    kind: "validation",
    scope,
    valid,
    verdict,
    counts: {
      errors,
      warnings,
      info,
      total,
      matched: matchedItems.length,
    },
    items: pagination.slice,
    snapshot: {
      fingerprint: graph.fingerprint,
      schemaVersion: graph.schemaVersion,
    },
  };
  const dataBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  return successEnvelope(graph, request.requestId, "validation", data, makePage(args, pagination, dataBytes));
}

function runDiagnostics(graph, request, args, limits) {
  const severityFilter = new Set(args.severities);
  const codeFilter = new Set(args.codes);
  const slugFilter = new Set(args.specSlugs);
  const pathFilter = new Set(args.paths);
  const items = graph.diagnostics.filter((diagnostic) => {
    if (severityFilter.size > 0 && !severityFilter.has(diagnostic.severity)) return false;
    if (codeFilter.size > 0 && !codeFilter.has(diagnostic.code)) return false;
    if (slugFilter.size > 0 && !slugFilter.has(diagnostic.specSlug ?? "")) return false;
    if (pathFilter.size > 0 && !(diagnostic.span !== null && pathFilter.has(diagnostic.span.path))) return false;
    return true;
  });

  const binding = { fingerprint: graph.fingerprint, operation: "diagnostics", digest: filterDigest(args) };
  const pagination = paginate(items, (diagnostic) => [
    DIAGNOSTIC_SEVERITY_RANK[diagnostic.severity],
    diagnostic.code,
    diagnostic.span?.path ?? null,
    diagnostic.span?.path ? (diagnostic.span?.startOffset ?? null) : null,
    diagnostic.diagnosticId,
  ], args, limits, binding, limits.maxResponseBytes - 2048);
  if (pagination.cursorError) {
    return errorEnvelope(graph, request, { code: pagination.cursorError, parameter: "cursor", message: pagination.cursorError });
  }
  if (pagination.oversizedSingleItem) {
    return errorEnvelope(graph, request, { code: "RESPONSE_TOO_LARGE", message: "single diagnostic exceeds the response budget" });
  }
  const data = { kind: "diagnostics", items: pagination.slice };
  const dataBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  return successEnvelope(graph, request.requestId, "diagnostics", data, makePage(args, pagination, dataBytes));
}

function declarationOrder(values, closed) {
  return values.sort((a, b) => closed.indexOf(a.key) - closed.indexOf(b.key)).map((entry) => entry.payload);
}

function runOverview(graph, request, args, limits) {
  void limits;
  const selected = new Set(selectedSpecs(graph, args.specSlugs));
  const codeCounts = new Map();
  const kindCounts = new Map();
  const edgeTypeCounts = new Map();
  for (const diagnostic of graph.diagnostics) {
    if (diagnostic.specSlug !== null && !selected.has(diagnostic.specSlug)) continue;
    const key = `${diagnostic.code}|${diagnostic.severity}`;
    codeCounts.set(key, (codeCounts.get(key) ?? 0) + 1);
  }
  for (const node of graph.nodes) {
    if (!selected.has(node.specSlug)) continue;
    kindCounts.set(node.kind, (kindCounts.get(node.kind) ?? 0) + 1);
  }
  for (const edge of graph.edges) {
    const slug = splitCanonicalId(edge.from)?.specSlug ?? null;
    if (slug !== null && !selected.has(slug)) continue;
    edgeTypeCounts.set(edge.type, (edgeTypeCounts.get(edge.type) ?? 0) + 1);
  }
  const data = {
    kind: "overview",
    counts: graph.counts,
    limits: graph.limits,
    diagnosticCodes: declarationOrder(
      [...codeCounts.entries()].map(([key, count]) => {
        const [code, severity] = key.split("|");
        return { key: `${severity}:${code}`, payload: { code, severity, count } };
      }),
      DIAGNOSTIC_SEVERITIES.flatMap((severity) => DIAGNOSTIC_CODES.map((code) => `${severity}:${code}`)),
    ),
    nodeKinds: declarationOrder(
      [...kindCounts.entries()].map(([kind, count]) => ({ key: kind, payload: { kind, count } })),
      [...NODE_KINDS],
    ),
    edgeTypes: declarationOrder(
      [...edgeTypeCounts.entries()].map(([type, count]) => ({ key: type, payload: { type, count } })),
      [...EDGE_TYPES],
    ),
  };
  return successEnvelope(graph, request.requestId, "overview", data, null);
}

function runMarkdownInventory(graph, request, args, limits) {
  const slugFilter = new Set(args.specSlugs);
  const outcomeFilter = new Set(args.outcomes);
  const pathInScope = (candidatePath) =>
    slugFilter.size === 0 ||
    (typeof candidatePath === "string" && slugOfPath(candidatePath) !== null && slugFilter.has(slugOfPath(candidatePath)));

  let headingRecords = graph.markdownHeadingOccurrences.filter((heading) => pathInScope(heading.path));
  let linkRecords = graph.markdownLinkOccurrences.filter((link) => pathInScope(link.path));

  let focusHeading = null;
  let focus = null;
  if (args.mode === "focus") {
    focusHeading = headingRecords.find((heading) => heading.path === args.focusPath && heading.canonicalAnchor === args.focusAnchor);
    if (!focusHeading) {
      return errorEnvelope(graph, request, {
        code: "HEADING_NOT_FOUND",
        path: args.focusPath,
        anchor: args.focusAnchor,
        message: `no heading with canonical anchor "${args.focusAnchor}" in ${args.focusPath}`,
      });
    }
    focus = {
      path: focusHeading.path,
      canonicalAnchor: focusHeading.canonicalAnchor,
      headingOccurrenceId: focusHeading.headingOccurrenceId,
    };
    headingRecords = [focusHeading];
    const inbound = (link) => link.targetHeadingOccurrenceId === focusHeading.headingOccurrenceId;
    const outbound = (link) =>
      link.path === focusHeading.path &&
      link.useSpan.startOffset >= focusHeading.sectionSpan.startOffset &&
      link.useSpan.startOffset < focusHeading.sectionSpan.endOffset;
    linkRecords = linkRecords.filter((link) => {
      if (args.direction === "in") return inbound(link);
      if (args.direction === "out") return outbound(link);
      return inbound(link) || outbound(link);
    });
  }
  if (outcomeFilter.size > 0) linkRecords = linkRecords.filter((link) => outcomeFilter.has(link.outcome));

  const relationOf = (link) => {
    if (args.mode !== "focus") return "UNSCOPED";
    const inbound = link.targetHeadingOccurrenceId === focusHeading.headingOccurrenceId;
    const outbound =
      link.path === focusHeading.path &&
      link.useSpan.startOffset >= focusHeading.sectionSpan.startOffset &&
      link.useSpan.startOffset < focusHeading.sectionSpan.endOffset;
    return inbound && outbound ? "BOTH" : inbound ? "INBOUND" : "OUTBOUND";
  };

  const items = [];
  if (args.includeHeadings) {
    for (const heading of headingRecords) {
      items.push({
        sortPath: heading.path,
        sortOffset: heading.span.startOffset,
        kindRank: 0,
        id: heading.headingOccurrenceId,
        payload: { kind: "heading", heading: headingSummary(heading) },
      });
    }
  }
  if (args.includeLinks) {
    for (const link of linkRecords) {
      items.push({
        sortPath: link.path,
        sortOffset: link.useSpan.startOffset,
        kindRank: 1,
        id: link.linkOccurrenceId,
        payload: { kind: "link", relation: relationOf(link), link: linkSummary(link) },
      });
    }
  }
  items.sort(
    (a, b) =>
      compareStrings(a.sortPath, b.sortPath) ||
      a.sortOffset - b.sortOffset ||
      a.kindRank - b.kindRank ||
      compareStrings(a.id, b.id),
  );

  const matchedRewriteSites = new Set();
  let matchedHeadings = 0;
  let matchedLinks = 0;
  for (const item of items) {
    if (item.kindRank === 0) matchedHeadings += 1;
    else {
      matchedLinks += 1;
      matchedRewriteSites.add(item.payload.link.rewriteKey);
    }
  }
  const totals = {
    allHeadings: graph.counts.markdownHeadingOccurrences,
    allLinks: graph.counts.markdownLinkOccurrences,
    allInternalHeadingLinks: graph.counts.markdownInternalHeadingLinks,
    allInternalDocumentLinks: graph.counts.markdownInternalDocumentLinks,
    allExternalLinks: graph.counts.markdownExternalLinks,
    allUnresolvedLinks: graph.counts.markdownUnresolvedLinks,
    allRewriteSites: graph.counts.markdownRewriteSites,
    matchedHeadings,
    matchedLinks,
    matchedRewriteSites: matchedRewriteSites.size,
  };

  const binding = { fingerprint: graph.fingerprint, operation: "markdownInventory", digest: filterDigest(args) };
  const pagination = paginate(
    items,
    (item) => [item.sortPath, item.sortOffset, item.kindRank, item.id],
    args,
    limits,
    binding,
    limits.maxResponseBytes - 2048,
  );
  if (pagination.cursorError) {
    return errorEnvelope(graph, request, { code: pagination.cursorError, parameter: "cursor", message: pagination.cursorError });
  }
  if (pagination.oversizedSingleItem) {
    return errorEnvelope(graph, request, { code: "RESPONSE_TOO_LARGE", message: "inventory item exceeds the response budget" });
  }
  const data = {
    kind: "markdownInventory",
    anchorAlgorithmVersion: graph.anchorAlgorithmVersion,
    focus,
    items: pagination.slice.map((item) => item.payload),
    totals,
  };
  const dataBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  const summaries = relevantSummaries(
    graph,
    (diagnostic) =>
      (diagnostic.code === "BROKEN_MARKDOWN_LINK" || diagnostic.code === "MALFORMED_MARKDOWN_LINK") &&
      diagnostic.span !== null &&
      pathInScope(diagnostic.span.path),
  );
  return successEnvelope(graph, request.requestId, "markdownInventory", data, makePage(args, pagination, dataBytes), summaries);
}

function slugOfPath(value) {
  if (typeof value !== "string") return null;
  const parts = value.split("/");
  return parts.length >= 2 && parts[0] === ".specs" ? parts[1] : null;
}

function headingSummary(heading) {
  return {
    headingOccurrenceId: heading.headingOccurrenceId,
    path: heading.path,
    level: heading.level,
    syntax: heading.syntax,
    plainText: heading.plainText,
    anchorAlgorithmVersion: heading.anchorAlgorithmVersion,
    baseAnchor: heading.baseAnchor,
    duplicateOrdinal: heading.duplicateOrdinal,
    canonicalAnchor: heading.canonicalAnchor,
    source: sourceSummary(heading.span),
    section: sourceSummary(heading.sectionSpan),
  };
}

function linkSummary(link) {
  return {
    linkOccurrenceId: link.linkOccurrenceId,
    path: link.path,
    syntax: link.syntax,
    labelText: link.labelText,
    rawDestination: link.rawDestination,
    normalizedDestination: normalizedDestinationOf(link),
    useSource: sourceSummary(link.useSpan),
    destinationSource: sourceSummary(link.destinationSpan),
    rewriteKey: link.rewriteKey,
    sourceHeadingOccurrenceId: link.sourceHeadingOccurrenceId ?? null,
    outcome: link.outcome,
    targetPath: link.targetPath ?? null,
    targetAnchor: link.targetAnchor ?? null,
    targetHeadingOccurrenceId: link.targetHeadingOccurrenceId ?? null,
    externalScheme: link.externalScheme ?? null,
    unresolvedReason: link.unresolvedReason ?? null,
    diagnosticIds: [],
  };
}

// Deterministic comparison representation used for resolution; recomputed
// without mutating the stored raw destination.
function normalizedDestinationOf(link) {
  if (link.outcome === "EXTERNAL") return link.rawDestination.toLowerCase().replace(/^https?:\/\//u, (match) => match);
  if (link.targetPath !== null && link.targetAnchor !== null) return `${link.targetPath}#${link.targetAnchor}`;
  if (link.targetPath !== null) return link.targetPath;
  return link.rawDestination;
}
