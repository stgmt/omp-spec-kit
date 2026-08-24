// Occurrence-first graph build: validate source documents, parse occurrences,
// group definitions with lossless duplicate election, resolve edges, prove
// conservation invariants, and freeze the immutable snapshot.

import { createHash } from "node:crypto";
import {
  DOCUMENT_KINDS,
  FIXED_DOCUMENT_FILES,
  NODE_KINDS,
  EDGE_TYPES,
  KERNEL_SCHEMA_VERSION,
  LINK_OUTCOMES,
} from "../types.js";
import {
  documentLocalId,
  fileLocalId,
  isValidSpecSlug,
  normalizePublicPath,
  sha256Hex,
} from "../identity.js";
import {
  canonicalJson,
  byteLength,
  compareCodePoints,
  normalizeSourceBytes,
  sha256Bytes,
} from "../normalize.js";
import { resolveLimits, canonicalLimitsJson } from "../limits.js";
import { makeDiagnostic, sortDiagnostics } from "../diagnostics.js";
import { localIdKind, splitCanonicalId, makeCanonicalId } from "../identity.js";
import { LOCAL_ID_ROLES } from "../types.js";
import { parseMarkdownDocument, resolveLinkOutcomes } from "../parsers/markdown.js";
import { parseGherkinDocument } from "../parsers/gherkin.js";
import { resolveReference, endpointAllowed } from "./resolve-edges.js";
import { checkInvariants } from "./invariants.js";

const ROLE_TO_NODE_KIND = Object.fromEntries(
  Object.entries(LOCAL_ID_ROLES).map(([role, meta]) => [role, meta.kind]),
);

function hashIdentity(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function stripPrivate(record) {
  const clean = {};
  for (const key of Object.keys(record)) {
    if (!key.startsWith("_")) clean[key] = record[key];
  }
  return clean;
}

// Filename -> DocumentKind for the fixed-name documents; slug-derived names
// are resolved by deriveDocumentKind.
function fixedDocumentKind(filename) {
  for (const kind of Object.keys(FIXED_DOCUMENT_FILES)) {
    if (FIXED_DOCUMENT_FILES[kind] === filename) return kind;
  }
  return null;
}

function canonicalNameMatches(filename, specSlug) {
  if (fixedDocumentKind(filename) !== null) return "exact";
  if (filename === `${specSlug}.feature` || filename === `${specSlug}_SCHEMA.md`) return "exact";
  const lower = filename.toLowerCase();
  for (const fixed of Object.values(FIXED_DOCUMENT_FILES)) {
    if (lower === fixed.toLowerCase() && filename !== fixed) return "case-variant";
  }
  if (filename === `${specSlug}.feature` || filename === `${specSlug}_SCHEMA.md`) return "exact";
  const featureLower = `${specSlug}.feature`.toLowerCase();
  const schemaLower = `${specSlug}_schema.md`.toLowerCase();
  if (lower === featureLower || lower === schemaLower) return "case-variant";
  return "unrelated";
}

function deriveDocumentKind(filename, specSlug) {
  const fixed = fixedDocumentKind(filename);
  if (fixed !== null) return fixed;
  if (filename === `${specSlug}.feature`) return "FEATURE";
  if (filename === `${specSlug}_SCHEMA.md`) return "SCHEMA";
  return null;
}

export function buildKernelGraph({ files, limits: limitsOverride, cancel } = {}) {
  const limits = resolveLimits(limitsOverride);
  const diagnostics = [];
  const checkCancelled = () => {
    if (typeof cancel === "function" && cancel()) {
      const error = new Error("build cancelled by caller");
      error.code = "CANCELLED";
      throw error;
    }
  };

  // ---- Phase 1: entry validation and document records ----
  const entries = [];
  let aggregateBytes = 0;
  let aggregateExceeded = false;
  const rawList = Array.isArray(files) ? files : [];
  for (const file of rawList) {
    const normalizedPath = typeof file?.path === "string" ? normalizePublicPath(file.path) : null;
    if (normalizedPath === null) {
      diagnostics.push(
        makeDiagnostic({
          code: "PATH_ESCAPE",
          message: "source path is not a safe repository-relative public path",
        }),
      );
      continue;
    }
    const bytes = file?.bytes instanceof Uint8Array ? file.bytes : null;
    if (bytes === null) {
      diagnostics.push(
        makeDiagnostic({
          code: "INVALID_UTF8",
          message: "source entry is missing Uint8Array bytes",
          span: emptySpan(normalizedPath),
        }),
      );
      continue;
    }

    // Path shape: .specs/<slug>/<canonical-name>
    const parts = normalizedPath.split("/");
    let specSlug = null;
    let filename = null;
    if (parts.length === 3 && parts[0] === ".specs") {
      if (isValidSpecSlug(parts[1])) specSlug = parts[1];
      filename = parts[2];
    }
    if (specSlug === null || !filename || filename.length === 0) {
      diagnostics.push(
        makeDiagnostic({
          code: parts.length >= 2 && !isValidSpecSlug(parts[1] ?? "") ? "INVALID_SPEC_SLUG" : "PATH_ESCAPE",
          message: `path "${boundPath(normalizedPath)}" is not a .specs/<slug>/<document> location`,
          span: emptySpan(normalizedPath),
          limitName: byteLengthOfPath(normalizedPath) > limits.maxPathBytes ? "maxPathBytes" : null,
          observedValue:
            byteLengthOfPath(normalizedPath) > limits.maxPathBytes ? byteLengthOfPath(normalizedPath) : null,
        }),
      );
      continue;
    }
    if (byteLengthOfPath(normalizedPath) > limits.maxPathBytes) {
      diagnostics.push(
        makeDiagnostic({
          code: "PATH_ESCAPE",
          message: "repository-relative path exceeds the maximum path budget",
          span: emptySpan(normalizedPath),
          limitName: "maxPathBytes",
          limitValue: limits.maxPathBytes,
          observedValue: byteLengthOfPath(normalizedPath),
        }),
      );
      continue;
    }

    const match = canonicalNameMatches(filename, specSlug);
    const documentKind = deriveDocumentKind(filename, specSlug);
    if (match === "unrelated" || documentKind === null) {
      // Not a canonical candidate at all; the kernel ignores it silently.
      continue;
    }
    const acceptedName = match === "exact";

    const rawSha256 = sha256Bytes(bytes);
    const rejectedRow = (code, message, extra = {}) => {
      const diagnostic = makeDiagnostic({
        code,
        message,
        span: emptySpan(normalizedPath),
        specSlug,
        ...extra,
      });
      diagnostics.push(diagnostic);
      return {
        path: normalizedPath,
        specSlug,
        documentKind,
        sha256: rawSha256,
        byteLength: bytes.length,
        accepted: false,
        diagnosticIds: [diagnostic.diagnosticId],
      };
    };

    if (!acceptedName) {
      entries.push({
        row: rejectedRow(
          "UNSUPPORTED_DOCUMENT",
          `"${boundPath(filename)}" is not the exact canonical name for this document kind`,
        ),
        skip: true,
      });
      continue;
    }
    if (bytes.length > limits.maxBytesPerDocument) {
      entries.push({
        row: rejectedRow("FILE_TOO_LARGE", "document exceeds maxBytesPerDocument", {
          limitName: "maxBytesPerDocument",
          limitValue: limits.maxBytesPerDocument,
          observedValue: bytes.length,
        }),
        skip: true,
      });
      continue;
    }
    if (typeof file?.sha256 === "string" && file.sha256.toLowerCase() !== rawSha256) {
      entries.push({ row: rejectedRow("HASH_MISMATCH", "supplied sha256 does not match source bytes"), skip: true });
      continue;
    }
    if (aggregateExceeded || aggregateBytes + bytes.length > limits.maxAggregateBytes) {
      aggregateExceeded = true;
      entries.push({
        row: rejectedRow("CORPUS_LIMIT_EXCEEDED", "aggregate corpus bytes exceed maxAggregateBytes", {
          limitName: "maxAggregateBytes",
          limitValue: limits.maxAggregateBytes,
          observedValue: aggregateBytes + bytes.length,
        }),
        skip: true,
      });
      continue;
    }
    aggregateBytes += bytes.length;

    let text;
    try {
      text = normalizeSourceBytes(bytes);
    } catch (error) {
      entries.push({
        row: rejectedRow(error?.code ?? "INVALID_UTF8", "source bytes are not valid UTF-8"),
        skip: true,
      });
      continue;
    }
    const lineCount = countLines(text);
    if (lineCount > limits.maxLinesPerDocument) {
      entries.push({
        row: rejectedRow("FILE_TOO_LARGE", "document exceeds maxLinesPerDocument", {
          limitName: "maxLinesPerDocument",
          limitValue: limits.maxLinesPerDocument,
          observedValue: lineCount,
        }),
        skip: true,
      });
      continue;
    }

    entries.push({
      row: {
        path: normalizedPath,
        specSlug,
        documentKind,
        sha256: rawSha256,
        byteLength: bytes.length,
        accepted: true,
        diagnosticIds: [],
      },
      skip: false,
      bytes,
      text,
      specSlug,
      filename,
      documentKind,
    });
  }

  entries.sort((a, b) => compareCodePoints(a.row.path, b.row.path));
  const documents = entries.map((entry) => entry.row);
  const usableEntries = entries.filter((entry) => !entry.skip && entry.row.accepted);

  // ---- Phase 2: parsing ----
  const parsedByPath = new Map();
  const globalAnchorIndex = new Map();
  const acceptedPaths = new Set(usableEntries.filter((e) => e.documentKind !== "FEATURE").map((e) => e.row.path));

  usableEntries.forEach((entry, index) => {
    checkCancelled();
    if ((index & 0x3ff) === 0x3ff) checkCancelled();
    if (entry.documentKind === "FEATURE") {
      parsedByPath.set(entry.row.path, { kind: "FEATURE", parsed: parseGherkinDocument({
        path: entry.row.path,
        specSlug: entry.specSlug,
        text: entry.text,
      }) });
      return;
    }
    const parsed = parseMarkdownDocument({ path: entry.row.path, documentKind: entry.documentKind, text: entry.text });
    parsedByPath.set(entry.row.path, { kind: "MARKDOWN", parsed });
    globalAnchorIndex.set(entry.row.path, parsed.anchorIndex);
  });

  const corpus = { paths: acceptedPaths, anchorIndex: globalAnchorIndex };
  for (const [docPath, holder] of parsedByPath) {
    if (holder.kind === "MARKDOWN") resolveLinkOutcomes(holder.parsed.links, docPath, corpus);
  }

  // ---- Phase 3: definition occurrences and duplicate election ----
  const definitionOccurrences = [];
  const headingCount = { total: 0 };
  const linkRecords = [];
  const groups = new Map(); // canonicalId -> {count, candidates[]}
  const nodeCandidates = new Map(); // canonicalId -> elected candidate record

  for (const entry of usableEntries) {
    const docPath = entry.row.path;
    const holder = parsedByPath.get(docPath);
    if (holder.kind === "MARKDOWN") {
      headingCount.total += holder.parsed.headings.length;
      linkRecords.push(...holder.parsed.links);
    }
    assembleDefinitionOccurrences(entry, holder, definitionOccurrences, groups, diagnostics, hashIdentity);
  }

  // Election.
  const processedGroups = new Set();
  for (const definition of definitionOccurrences) {
    if (definition.outcome !== "PENDING") continue;
    const group = groups.get(definition.canonicalId);
    if (group.count >= 2) {
      definition.outcome = "AMBIGUOUS";
      if (processedGroups.has(definition.canonicalId)) continue;
      processedGroups.add(definition.canonicalId);
      const ordered = group.candidates.slice().sort(compareCandidateSpans);
      const primary = ordered[0];
      const diagnostic = makeDiagnostic({
        code: "DUPLICATE_DEFINITION",
        message: `canonical ID ${definition.canonicalId} has ${group.count} definition candidates; none was elected`,
        span: primary.span,
        relatedSpans: ordered.slice(1, 17).map((candidate) => candidate.span),
        specSlug: definition.specSlug,
        localId: definition.localId,
        canonicalId: definition.canonicalId,
      });
      diagnostics.push(diagnostic);
      for (const candidate of group.candidates) {
        candidate.definition.diagnosticIds.push(diagnostic.diagnosticId);
      }
    } else {
      definition.outcome = "UNIQUE";
      nodeCandidates.set(definition.canonicalId, definition);
    }
  }

  // ---- Phase 4: nodes ----
  const nodes = [];
  const nodeById = new Map();
  for (const definition of nodeCandidates.values()) {
    const node = makeNode(definition);
    nodes.push(node);
    nodeById.set(node.canonicalId, node);
  }

  // Generated DOCUMENT nodes.
  let generatedDocumentNodes = 0;
  for (const entry of usableEntries) {
    const localId = documentLocalId(entry.filename);
    const canonicalId = makeCanonicalId(entry.specSlug, localId);
    const node = {
      canonicalId,
      specSlug: entry.specSlug,
      localId,
      kind: "DOCUMENT",
      title: entry.filename,
      body: "",
      span: { ...wholeFileSpan(entry.text), path: entry.row.path },
      documentKind: entry.documentKind,
      attributes: {
        filename: entry.filename,
        byteLength: entry.row.byteLength,
        sourceSha256: entry.row.sha256,
      },
      contentHash: "",
    };
    node.contentHash = hashIdentity(nodeWithoutHash(node));
    nodes.push(node);
    nodeById.set(canonicalId, node);
    generatedDocumentNodes += 1;
  }

  // Generated FILE nodes from FILE_CHANGE candidates (lossless across duplicates).
  let generatedFileNodes = 0;
  const fileNodesBySpec = new Map();
  for (const definition of definitionOccurrences) {
    if (definition.nodeKind !== "FILE_CHANGE") continue;
    for (const pathText of definition.attributes.paths) {
      if (!fileNodesBySpec.has(definition.specSlug)) fileNodesBySpec.set(definition.specSlug, new Map());
      const perSpec = fileNodesBySpec.get(definition.specSlug);
      if (perSpec.has(pathText)) continue;
      const localId = fileLocalId(pathText);
      const canonicalId = makeCanonicalId(definition.specSlug, localId);
      const node = {
        canonicalId,
        specSlug: definition.specSlug,
        localId,
        kind: "FILE",
        title: pathText,
        body: "",
        span: definition.span,
        documentKind: definition.documentKind,
        attributes: { path: pathText, plannedAction: definition.attributes.action },
        contentHash: "",
      };
      node.contentHash = hashIdentity(nodeWithoutHash(node));
      perSpec.set(pathText, node);
      nodes.push(node);
      nodeById.set(canonicalId, node);
      generatedFileNodes += 1;
    }
  }

  // ---- Phase 5: reference collection ----
  const references = [];
  collectReferences(parsedByPath, usableEntries, definitionOccurrences, nodeById, references, hashIdentity);

  // ---- Phase 6: edge resolution ----
  const specSlugsOfLocalId = new Map();
  for (const [canonicalId, group] of groups) {
    const split = splitCanonicalId(canonicalId);
    if (!split) continue;
    const list = specSlugsOfLocalId.get(split.localId) ?? [];
    list.push(split.specSlug);
    specSlugsOfLocalId.set(split.localId, list);
  }
  const resolutionCtx = {
    groups,
    nodeById,
    specSlugsOfLocalId,
    endpointAllowed,
  };
  const resolvedEdges = [];
  const unresolvedReferences = [];
  for (const reference of references) {
    const result = resolveReference(reference, resolutionCtx);
    if (result.outcome === "RESOLVED") {
      reference.outcome = "RESOLVED";
      reference.resolvedEdgeId = result.edge.edgeId;
      resolvedEdges.push(result.edge);
    } else {
      reference.outcome = "UNRESOLVED";
      reference.unresolvedReason = result.reason;
      reference.candidateCanonicalIds = result.candidates;
      const diagnostic = makeDiagnostic({
        code: result.diagnosticCode,
        message: `${result.message} (target "${boundPath(reference.rawTarget)}")`,
        span: reference.span,
        specSlug: reference.specSlug ?? splitCanonicalId(reference.sourceCanonicalId)?.specSlug ?? null,
        canonicalId: reference.candidateCanonicalIds[0] ?? null,
        referenceOccurrenceId: reference.occurrenceId,
        expected: expectedForReason(result.reason),
      });
      diagnostics.push(diagnostic);
      reference.diagnosticIds.push(diagnostic.diagnosticId);
      unresolvedReferences.push(reference);
    }
  }

  // ---- Phase 7: AC parent validation ----
  for (const node of nodes) {
    if (node.kind !== "ACCEPTANCE_CRITERION") continue;
    const parentCanonicalId = makeCanonicalId(node.specSlug, node.attributes.parentLocalId);
    if (!nodeById.has(parentCanonicalId)) {
      const diagnostic = makeDiagnostic({
        code: "INVALID_AC_PARENT",
        message: `acceptance criterion ${node.canonicalId} cites missing parent ${parentCanonicalId}`,
        span: node.span,
        specSlug: node.specSlug,
        localId: node.localId,
        canonicalId: node.canonicalId,
        expected: "existing FR-N parent in the same spec",
        actual: node.attributes.parentLocalId,
      });
      diagnostics.push(diagnostic);
    }
  }

  // Markdown link diagnostics.
  const linkOutcomeCounts = { INTERNAL_HEADING: 0, INTERNAL_DOCUMENT: 0, EXTERNAL: 0, UNRESOLVED: 0 };
  for (const link of linkRecords) {
    linkOutcomeCounts[link.outcome] += 1;
    if (link.unresolvedReason !== null && link.diagnosticCode !== null) {
      diagnostics.push(
        makeDiagnostic({
          code: link.diagnosticCode,
          message: `markdown link destination "${boundPath(link.rawDestination)}" did not resolve (${link.unresolvedReason})`,
          span: link.useSpan,
          specSlug: splitSpecSlugOfPath(link.path),
          referenceOccurrenceId: null,
          expected: "existing target document or canonical anchor",
        }),
      );
    }
  }

  // ---- Phase 8: counts, fingerprint, ordering ----
  const counts = computeCounts({
    documents,
    definitionOccurrences,
    nodes,
    references,
    resolvedEdges,
    unresolvedReferences,
    headings: headingCount.total,
    links: linkRecords,
    linkOutcomeCounts,
    generatedDocumentNodes,
    generatedFileNodes,
    diagnostics,
  });

  const fingerprintInput = [
    KERNEL_SCHEMA_VERSION,
    canonicalLimitsJson(limits),
    ...documents.map((row) => `${row.path}:${row.sha256}`),
  ].join("|");
  const fingerprint = sha256Hex(fingerprintInput);

  const sortedDiagnostics = sortDiagnostics(diagnostics);
  let finalDiagnostics = sortedDiagnostics;
  if (sortedDiagnostics.length > limits.maxDiagnostics) {
    const overflow = makeDiagnostic({
      code: "DIAGNOSTIC_LIMIT_REACHED",
      message: "diagnostic output truncated at maxDiagnostics",
      limitName: "maxDiagnostics",
      limitValue: limits.maxDiagnostics,
      observedValue: sortedDiagnostics.length,
    });
    finalDiagnostics = [...sortedDiagnostics.slice(0, limits.maxDiagnostics - 1), overflow];
  }

  const snapshot = {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    anchorAlgorithmVersion: "glfm-anchor@1",
    fingerprint,
    valid: !finalDiagnostics.some((diagnostic) => diagnostic.severity === "ERROR"),
    limits,
    counts,
    documents: documents.map((row) => row),
    definitionCandidates: definitionOccurrences
      .slice()
      .sort((a, b) =>
        compareNullable(a.canonicalId, b.canonicalId) || compareCandidateSpans(a, b) || (a.occurrenceId < b.occurrenceId ? -1 : 1),
      )
      .map(stripPrivate),
    nodes: nodes.slice().sort((a, b) => (a.canonicalId < b.canonicalId ? -1 : 1)).map((node) => Object.freeze({ ...node })),
    referenceOccurrences: references
      .slice()
      .sort(compareReferenceStable)
      .map(stripPrivate),
    markdownHeadingOccurrences: collectSortedHeadings(parsedByPath).map(stripPrivate),
    markdownLinkOccurrences: linkRecords
      .slice()
      .sort(
        (a, b) =>
          compareCodePoints(a.useSpan.path ?? a.path, b.useSpan.path ?? b.path) ||
          a.useSpan.startOffset - b.useSpan.startOffset ||
          a.linkOccurrenceId.localeCompare(b.linkOccurrenceId),
      )
      .map(stripPrivate),
    edges: resolvedEdges
      .slice()
      .sort(
        (a, b) =>
          compareCodePoints(a.from, b.from) ||
          compareCodePoints(a.to, b.to) ||
          (a.type < b.type ? -1 : 1) ||
          compareCodePoints(a.span.path, b.span.path) ||
          a.span.startOffset - b.span.startOffset ||
          a.edgeId.localeCompare(b.edgeId),
      ),
    diagnostics: Object.freeze(finalDiagnostics),
  };

  // ---- Phase 9: invariants ----
  const invariantViolations = checkInvariants({
    documents: {
      discovered: counts.discoveredDocuments,
      accepted: counts.acceptedDocuments,
      rejected: counts.rejectedDocuments,
    },
    definitionOccurrences: {
      total: counts.definitionOccurrences,
    },
    uniqueAuthoredNodes: counts.uniqueDefinitionNodes,
    ambiguousCount: counts.ambiguousDefinitionOccurrences,
    rejectedCount: counts.rejectedDefinitionOccurrences,
    referenceOccurrences: { total: counts.referenceOccurrences },
    resolvedEdges,
    unresolvedReferences,
    headings: { total: headingCount.total, array: snapshot.markdownHeadingOccurrences },
    links: snapshot.markdownLinkOccurrences,
    nodeById,
    groups,
    endpointAllowed,
  });
  if (invariantViolations.length > 0) {
    const violationDiagnostics = invariantViolations.slice(0, 32).map((message) =>
      makeDiagnostic({ code: "INVARIANT_VIOLATION", message }),
    );
    snapshot.diagnostics = Object.freeze(sortDiagnostics([...snapshot.diagnostics, ...violationDiagnostics]));
    snapshot.valid = false;
  }

  return { graph: snapshot, diagnostics: snapshot.diagnostics };
}

// --- helpers ---------------------------------------------------------------

function boundPath(value) {
  return value.length > 200 ? `${value.slice(0, 200)}...` : value;
}

function emptySpan(path) {
  return { path, startLine: 1, startColumn: 1, endLine: 1, endColumn: 1, startOffset: 0, endOffset: 0 };
}

function byteLengthOfPath(path) {
  let total = 0;
  for (let i = 0; i < path.length; i += 1) {
    const code = path.codePointAt(i);
    if (code > 0xffff) i += 1;
    total += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return total;
}

function countLines(text) {
  let count = 1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") count += 1;
  }
  return count;
}

function compareNullable(a, b) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

function compareCandidateSpans(a, b) {
  const pathA = a.span?.path ?? "";
  const pathB = b.span?.path ?? "";
  if (pathA !== pathB) return compareCodePoints(pathA, pathB);
  return (a.span.startOffset ?? 0) - (b.span.startOffset ?? 0);
}

function compareReferenceStable(a, b) {
  const pathA = a.span.path ?? "";
  const pathB = b.span.path ?? "";
  if (pathA !== pathB) return compareCodePoints(pathA, pathB);
  if (a.span.startOffset !== b.span.startOffset) return a.span.startOffset - b.span.startOffset;
  return a.occurrenceId.localeCompare(b.occurrenceId);
}

function wholeFileSpan(text) {
  // Byte-accurate document span; columns approximate the final scalar count.
  let line = 1;
  let lastLineScalars = 0;
  let currentLineScalars = 0;
  for (const ch of text) {
    if (ch === "\n") {
      line += 1;
      currentLineScalars = 0;
    } else {
      currentLineScalars += 1;
      lastLineScalars = currentLineScalars;
    }
  }
  return {
    startLine: 1,
    startColumn: 1,
    endLine: line,
    endColumn: lastLineScalars + 1,
    startOffset: 0,
    endOffset: byteLength(text),
  };
}

function nodeWithoutHash(node) {
  const copy = {};
  for (const key of Object.keys(node)) {
    if (key !== "contentHash") copy[key] = node[key];
  }
  return copy;
}

function makeNode(definition) {
  const node = {
    canonicalId: definition.canonicalId,
    specSlug: definition.specSlug,
    localId: definition.localId,
    kind: definition.nodeKind,
    title: definition.title,
    body: definition.body,
    span: definition.span,
    documentKind: definition.documentKind,
    attributes: definition.attributes,
    contentHash: "",
  };
  node.contentHash = hashIdentity(nodeWithoutHash(node));
  return node;
}

export function expectedForReason(reason) {
  switch (reason) {
    case "MALFORMED_TARGET":
      return "<local-id> or <spec-slug>:<local-id>";
    case "UNQUALIFIED_CROSS_SPEC":
      return "<spec-slug>:<local-id> for cross-spec targets";
    case "MISSING_TARGET":
      return "an existing definition";
    case "AMBIGUOUS_TARGET":
      return "exactly one definition";
    case "FORBIDDEN_ENDPOINT":
      return "endpoint kinds allowed by the matrix";
    case "REJECTED_SOURCE":
      return "an elected source node";
    default:
      return null;
  }
}

function splitSpecSlugOfPath(path) {
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === ".specs" ? parts[1] : null;
}


// --- occurrence assembly ----------------------------------------------------

function assembleDefinitionOccurrences(entry, holder, definitionOccurrences, groups, diagnostics) {
  const docPath = entry.row.path;
  const specSlug = entry.specSlug;
  const withPath = (span) => ({ ...span, path: docPath });

  if (holder.kind === "MARKDOWN") {
    for (const rejected of holder.parsed.rejectedDefinitions) {
      const diagnostic = makeDiagnostic({
        code: rejected.code,
        message: rejected.message,
        span: withPath(rejected.span),
        specSlug,
        expected: rejected.expected ?? null,
        actual: rejected.actual ?? null,
      });
      diagnostics.push(diagnostic);
      definitionOccurrences.push({
        occurrenceId: hashIdentity({
          path: docPath,
          startOffset: rejected.span.startOffset,
          ordinal: rejected.ordinal,
          kind: "definition",
          rawIdOrTarget: "",
        }),
        specSlug,
        localId: null,
        canonicalId: null,
        nodeKind: null,
        title: "",
        body: "",
        span: withPath(rejected.span),
        attributes: {},
        outcome: "REJECTED",
        diagnosticIds: [diagnostic.diagnosticId],
      });
    }
    for (const definition of holder.parsed.definitions) {
      const localId = definition.localId;
      const canonicalId = `${specSlug}:${localId}`;
      pushCandidate(
        definitionOccurrences,
        groups,
        {
          path: docPath,
          startOffset: definition.span.startOffset,
          ordinal: definition.ordinal,
        },
        {
          occurrenceId: "",
          specSlug,
          localId,
          canonicalId,
          nodeKind: ROLE_TO_NODE_KIND[definition.role] ?? null,
          title: definition.title,
          body: definition.bodyText,
          span: withPath(definition.span),
          attributes: definition.attributes,
          outcome: "PENDING",
          diagnosticIds: [],
          documentKind: entry.documentKind,
        },
        canonicalId,
      );
    }
    return;
  }

  // FEATURE documents.
  for (const scenarioDiagnostic of holder.parsed.diagnostics) {
    diagnostics.push(
      makeDiagnostic({
        ...scenarioDiagnostic,
        span: { ...scenarioDiagnostic.span, path: docPath },
      }),
    );
  }
  for (const scenario of holder.parsed.scenarios) {
    if (scenario.rejected) {
      const diagnostic = makeDiagnostic({
        code: scenario.rejectionCode,
        message:
          scenario.rejectionCode === "DUPLICATE_SCENARIO_ID_TAG"
            ? "scenario carries more than one @id tag"
            : "scenario is missing a valid @id:SCEN-<slug> tag",
        span: withPath(scenario.nameSpan),
        specSlug,
        expected: "exactly one @id:SCEN-<lower-kebab> tag",
      });
      diagnostics.push(diagnostic);
      definitionOccurrences.push({
        occurrenceId: hashIdentity({
          path: docPath,
          startOffset: scenario.nameSpan.startOffset,
          ordinal: definitionOccurrences.length,
          kind: "definition",
          rawIdOrTarget: "",
        }),
        specSlug,
        localId: null,
        canonicalId: null,
        nodeKind: null,
        title: "",
        body: "",
        span: withPath(scenario.nameSpan),
        attributes: {},
        outcome: "REJECTED",
        diagnosticIds: [diagnostic.diagnosticId],
      });
      continue;
    }
    const localId = scenario.localId;
    const canonicalId = `${specSlug}:${localId}`;
    pushCandidate(
      definitionOccurrences,
      groups,
      {
        path: docPath,
        startOffset: scenario.nameSpan.startOffset,
        ordinal: definitionOccurrences.length,
      },
      {
        occurrenceId: "",
        specSlug,
        localId,
        canonicalId,
        nodeKind: "SCENARIO",
        title: scenario.name === "" ? localId : scenario.name,
        body: "",
        span: withPath(scenario.nameSpan),
        attributes: {
          featureName: scenario.featureName,
          scenarioKeyword: scenario.keyword,
          tags: scenario.tags.map((entryTag) => `@${entryTag.tag}`),
          steps: scenario.steps.map((step) => ({ keyword: step.keyword, text: step.text })),
          examples: scenario.examples.map((block) => ({
            headers: block.headers,
            rows: block.rows,
          })),
        },
        outcome: "PENDING",
        diagnosticIds: [],
        documentKind: "FEATURE",
      },
      canonicalId,
    );
  }
}

function pushCandidate(definitionOccurrences, groups, identity, record, canonicalId) {
  record.occurrenceId = hashIdentity(identity);
  definitionOccurrences.push(record);
  const group = groups.get(canonicalId) ?? { count: 0, candidates: [] };
  group.count += 1;
  group.candidates.push({ definition: record, span: record.span });
  groups.set(canonicalId, group);
}

const ID_TOKEN_RE =
  /((?:[a-z0-9]+(?:-[a-z0-9]+)*):)?(?:US|UC|RF|RISK|FR|DEC|TASK|FC)-[1-9][0-9]*|((?:[a-z0-9]+(?:-[a-z0-9]+)*):)?AC-[1-9][0-9]*\.[1-9][0-9]*|((?:[a-z0-9]+(?:-[a-z0-9]+)*):)?NFR-[A-Z][A-Z0-9-]*-[1-9][0-9]*/gu;

export function findReferenceTargetInText(text) {
  for (const match of text.matchAll(ID_TOKEN_RE)) {
    const candidate = match[0];
    if (candidate.includes(":")) {
      if (splitCanonicalId(candidate) !== null) return candidate;
    } else if (localIdKind(candidate) !== null) {
      return candidate;
    }
  }
  return null;
}

function collectReferences(parsedByPath, usableEntries, definitionOccurrences, nodeById, references) {
  for (const entry of usableEntries) {
    const docPath = entry.row.path;
    const holder = parsedByPath.get(docPath);
    const documentCanonicalId = makeCanonicalId(entry.specSlug, documentLocalId(entry.filename));
    const pending = [];

    if (holder.kind === "MARKDOWN") {
      // DECLARES edges to every elected authored definition of this document.
      const uniqueDefs = holder.parsed.definitions
        .map((def) => ({ def, record: findDefinitionRecord(definitionOccurrences, docPath, def.span.startOffset) }))
        .filter((item) => item.record !== null && item.record.outcome !== "REJECTED");
      const electedDefs = new Map();
      for (const item of uniqueDefs) {
        if (!electedDefs.has(item.def.localId)) electedDefs.set(item.def.localId, item);
      }
      for (const item of electedDefs.values()) {
        if (!nodeById.has(item.record.canonicalId)) continue;
        pending.push({
          rank: 0,
          startOffset: item.record.span.startOffset,
          sourceCanonicalId: documentCanonicalId,
          rawTarget: item.record.canonicalId,
          requestedEdgeType: "DECLARES",
          span: item.record.span,
          specSlug: entry.specSlug,
        });
      }
      for (const ref of holder.parsed.fieldReferences) {
        pending.push({ rank: 1, startOffset: ref.span.startOffset, sourceCanonicalId: sourceForOffset(holder, definitionOccurrences, nodeById, docPath, documentCanonicalId, ref.span.startOffset), rawTarget: ref.rawTarget, requestedEdgeType: ref.edgeType, span: ref.span, specSlug: entry.specSlug });
      }
      for (const ref of holder.parsed.tableReferences) {
        pending.push({ rank: 2, startOffset: ref.span.startOffset, sourceCanonicalId: sourceForOffset(holder, definitionOccurrences, nodeById, docPath, documentCanonicalId, ref.span.startOffset), rawTarget: ref.rawTarget, requestedEdgeType: ref.edgeType, span: ref.span, specSlug: entry.specSlug });
      }
      for (const link of holder.parsed.links) {
        const target =
          findReferenceTargetInText(link.labelText) ??
          (typeof link.targetAnchor === "string" ? findReferenceTargetInText(link.targetAnchor) : null);
        if (target === null) continue;
        pending.push({
          rank: 3,
          startOffset: link.useSpan.startOffset,
          sourceCanonicalId: sourceForOffset(holder, definitionOccurrences, nodeById, docPath, documentCanonicalId, link.useSpan.startOffset),
          rawTarget: target,
          requestedEdgeType: "REFS",
          span: link.useSpan,
          specSlug: entry.specSlug,
        });
      }
    } else {
      for (const scenario of holder.parsed.scenarios) {
        const scenarioRecord = findDefinitionRecord(definitionOccurrences, docPath, scenario.nameSpan.startOffset);
        if (scenarioRecord === null) continue;
        const sourceCanonicalId = scenarioRecord.canonicalId ?? documentCanonicalId;
        for (const ref of [...scenario.traceRefs, ...scenario.refs]) {
          pending.push({
            rank: 4,
            startOffset: ref.span.startOffset,
            sourceCanonicalId,
            rawTarget: ref.rawTarget,
            requestedEdgeType: ref.requestedEdgeType,
            span: ref.span,
            specSlug: entry.specSlug,
          });
        }
      }
    }

    pending.sort((a, b) => a.startOffset - b.startOffset || a.rank - b.rank);
    pending.forEach((ref, ordinal) => {
      references.push({
        occurrenceId: hashIdentity({
          path: docPath,
          startOffset: ref.startOffset,
          ordinal,
          kind: "reference",
          rawIdOrTarget: ref.rawTarget,
        }),
        specSlug: ref.specSlug,
        sourceCanonicalId: ref.sourceCanonicalId,
        rawTarget: boundPath(ref.rawTarget),
        requestedEdgeType: ref.requestedEdgeType,
        span: { ...ref.span, path: docPath },
        outcome: "PENDING",
        resolvedEdgeId: null,
        unresolvedReason: null,
        candidateCanonicalIds: [],
        diagnosticIds: [],
        _rank: ref.rank,
      });
    });
  }
}

// Innermost enclosing elected definition at an offset; falls back to the DOC node.
function sourceForOffset(holder, definitionOccurrences, nodeById, docPath, documentCanonicalId, offset) {
  let best = null;
  for (const definition of holder.parsed.definitions) {
    const record = findDefinitionRecord(definitionOccurrences, docPath, definition.span.startOffset);
    if (record === null || record.outcome === "REJECTED") continue;
    if (definition.span.startOffset <= offset && (best === null || definition.span.startOffset >= best.span.startOffset)) {
      best = record;
    }
  }
  if (best !== null && nodeById.has(best.canonicalId)) return best.canonicalId;
  return documentCanonicalId;
}

function findDefinitionRecord(definitionOccurrences, docPath, startOffset) {
  return (
    definitionOccurrences.find(
      (record) =>
        record.span.path === docPath &&
        record.span.startOffset === startOffset &&
        record.localId !== null,
    ) ?? null
  );
}

function collectSortedHeadings(parsedByPath) {
  const headings = [];
  for (const holder of parsedByPath.values()) {
    if (holder.kind === "MARKDOWN") headings.push(...holder.parsed.headings);
  }
  headings.sort(
    (a, b) =>
      compareCodePoints(a.path, b.path) ||
      a.span.startOffset - b.span.startOffset ||
      a.headingOccurrenceId.localeCompare(b.headingOccurrenceId),
  );
  return headings;
}

function computeCounts(input) {
  const {
    documents,
    definitionOccurrences,
    nodes,
    references,
    resolvedEdges,
    unresolvedReferences,
    headings,
    links,
    linkOutcomeCounts,
    generatedDocumentNodes,
    generatedFileNodes,
    diagnostics,
  } = input;
  let uniqueDefinitionNodes = 0;
  for (const node of nodes) {
    if (node.kind !== "DOCUMENT" && node.kind !== "FILE") uniqueDefinitionNodes += 1;
  }
  const ambiguous = definitionOccurrences.filter((record) => record.outcome === "AMBIGUOUS").length;
  const rejected = definitionOccurrences.filter((record) => record.outcome === "REJECTED").length;
  const rewriteKeys = new Set();
  for (const link of links) rewriteKeys.add(link.rewriteKey);
  const severityCounts = { ERROR: 0, WARNING: 0, INFO: 0 };
  for (const diagnostic of diagnostics) severityCounts[diagnostic.severity] += 1;
  return {
    discoveredDocuments: documents.length,
    acceptedDocuments: documents.filter((row) => row.accepted).length,
    rejectedDocuments: documents.filter((row) => !row.accepted).length,
    definitionOccurrences: definitionOccurrences.length,
    uniqueDefinitionNodes,
    ambiguousDefinitionOccurrences: ambiguous,
    rejectedDefinitionOccurrences: rejected,
    referenceOccurrences: references.length,
    resolvedEdgeOccurrences: resolvedEdges.length,
    unresolvedReferenceOccurrences: unresolvedReferences.length,
    markdownHeadingOccurrences: headings,
    markdownLinkOccurrences: links.length,
    markdownInternalHeadingLinks: linkOutcomeCounts.INTERNAL_HEADING,
    markdownInternalDocumentLinks: linkOutcomeCounts.INTERNAL_DOCUMENT,
    markdownExternalLinks: linkOutcomeCounts.EXTERNAL,
    markdownUnresolvedLinks: linkOutcomeCounts.UNRESOLVED,
    markdownRewriteSites: rewriteKeys.size,
    generatedDocumentNodes,
    generatedFileNodes,
    diagnosticsError: severityCounts.ERROR,
    diagnosticsWarning: severityCounts.WARNING,
    diagnosticsInfo: severityCounts.INFO,
  };
}
