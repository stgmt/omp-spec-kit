// Canonical Markdown parsing: role-aware definition recognition, complete
// heading/anchor inventory, semantic link occurrences, and typed attribute
// extraction. Pure; operates on normalized text only.

import { createHash } from "node:crypto";
import {
  ANCHOR_ALGORITHM_VERSION,
  DOCUMENT_DEFINITION_ROLES,
  ROLE_HEADING_PRODUCTION,
  REFERENCE_FIELD_EDGE_TYPES,
} from "../types.js";
import { localIdKind, extractReferenceTarget } from "../identity.js";
import { byteLength } from "../normalize.js";
import { allocateCanonicalAnchor, deriveBaseAnchor, renderInline, scanLinks } from "./md-inline.js";
import { scanBlocks } from "./md-blocks.js";
import { extractAttributes } from "./attributes.js";

const EM_DASH = "\u2014";

// Maps char offsets inside one document to 1-based scalar columns, 1-based
// lines, and UTF-8 byte offsets.
export class Positions {
  constructor(text) {
    this.text = text;
    this.lineStarts = [0];
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === "\n") this.lineStarts.push(i + 1);
    }
    this.prefixBytes = [0];
    let total = 0;
    for (let index = 0; index < this.lineStarts.length; index += 1) {
      const start = this.lineStarts[index];
      const end = index + 1 < this.lineStarts.length ? this.lineStarts[index + 1] : text.length;
      total += byteLength(text.slice(start, end));
      this.prefixBytes.push(total);
    }
  }

  positionOf(charIndex) {
    const clamped = Math.max(0, Math.min(charIndex, this.text.length));
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.lineStarts[mid] <= clamped) low = mid;
      else high = mid - 1;
    }
    const within = this.text.slice(this.lineStarts[low], clamped);
    let scalars = 0;
    for (let i = 0; i < within.length; i += 1) {
      scalars += 1;
      if (within.codePointAt(i) > 0xffff) i += 1;
    }
    return {
      line: low + 1,
      column: scalars + 1,
      startOffset: this.prefixBytes[low] + byteLength(within),
    };
  }

  spanBetween(startChar, endChar) {
    const a = this.positionOf(startChar);
    const b = this.positionOf(Math.max(startChar, endChar));
    return {
      startLine: a.line,
      startColumn: a.column,
      endLine: b.line,
      endColumn: b.column,
      startOffset: a.startOffset,
      endOffset: b.startOffset,
    };
  }

  byteLength() {
    return this.prefixBytes[this.prefixBytes.length - 1];
  }

  charIndexForOffset(byteOffset) {
    for (let index = 0; index < this.lineStarts.length; index += 1) {
      const lineEndByte =
        index + 1 < this.lineStarts.length ? this.prefixBytes[index + 1] : this.prefixBytes[index];
      if (byteOffset <= lineEndByte) {
        const withinBytes = byteOffset - this.prefixBytes[index];
        const start = this.lineStarts[index];
        const end = index + 1 < this.lineStarts.length ? this.lineStarts[index + 1] : this.text.length;
        const lineText = this.text.slice(start, end);
        let consumed = 0;
        for (let i = 0; i < lineText.length; i += 1) {
          if (consumed >= withinBytes) return start + i;
          consumed += byteLength(lineText[i]);
        }
        return end;
      }
    }
    return this.text.length;
  }
}

function sha256HexOf(value) {
  return createHash("sha256").update(value).digest("hex");
}

function lineEnd(text, fromChar) {
  const nl = text.indexOf("\n", fromChar);
  return nl < 0 ? text.length : nl;
}

export function canonicalJsonOf(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonOf).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonOf(value[key])}`).join(",")}}`;
}

function bound(value, max) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function rolePrefixPattern(role) {
  switch (role) {
    case "USER_STORY":
      return "US-[1-9][0-9]*";
    case "USE_CASE":
      return "UC-[1-9][0-9]*";
    case "RESEARCH_FINDING":
      return "RF-[1-9][0-9]*";
    case "RISK":
      return "RISK-[1-9][0-9]*";
    case "FUNCTIONAL_REQUIREMENT":
      return "FR-[1-9][0-9]*";
    case "NON_FUNCTIONAL_REQUIREMENT":
      return "NFR-[A-Z][A-Z0-9-]*-[1-9][0-9]*";
    case "ACCEPTANCE_CRITERION":
      return "AC-[1-9][0-9]*\\.[1-9][0-9]*";
    case "DECISION":
      return "DEC-[1-9][0-9]*";
    case "TASK":
      return "TASK-[1-9][0-9]*";
    case "FILE_CHANGE":
      return "FC-[1-9][0-9]*";
    case "FIXTURE":
      return "FIXTURE-[1-9][0-9]*";
    case "SCHEMA_ENTITY":
      return "SCHEMA-[1-9][0-9]*";
    default:
      return "(?=x)y";
  }
}

function roleStem(role) {
  switch (role) {
    case "USER_STORY":
      return "US-";
    case "USE_CASE":
      return "UC-";
    case "NON_FUNCTIONAL_REQUIREMENT":
      return "NFR-";
    default:
      return `${role}-`;
  }
}

// Match one authored heading against a role production.
// Returns null (not a candidate at all), or
// { status: "definition", localId, title } or
// { status: "rejected", code, message, expected, actual }.
export function matchDefinitionHeading(role, level, headingText) {
  const production = ROLE_HEADING_PRODUCTION[role];
  if (!production || !production.levels.includes(level)) return null;

  const pattern = rolePrefixPattern(role);
  const colon = new RegExp(`^(${pattern}):[ ](.+)$`, "u").exec(headingText);
  const emdash =
    colon === null ? new RegExp(`^(${pattern}) ${EM_DASH} (.+)$`, "u").exec(headingText) : null;
  const bare =
    colon === null && emdash === null && production.separators.includes("bare")
      ? new RegExp(`^(${pattern})$`, "u").exec(headingText.trim())
      : null;

  const matched = colon ?? emdash ?? bare;
  if (matched) {
    const rawId = matched[1];
    const rawTitle = bare !== null ? rawId : matched[2].trim();
    if (!localIdKind(rawId)) {
      return {
        status: "rejected",
        code: "INVALID_LOCAL_ID",
        message: `heading ID "${bound(rawId, 64)}" does not match the ${role} grammar`,
        expected: `${role} local ID`,
        actual: bound(rawId, 64),
      };
    }
    if (rawTitle === "") {
      return {
        status: "rejected",
        code: "MALFORMED_HEADING",
        message: "definition heading requires a non-empty title",
        expected: "non-empty title",
        actual: "",
      };
    }
    return { status: "definition", localId: rawId, title: rawTitle };
  }

  // Malformed candidate detection: level-appropriate heading that begins with
  // the role stem but matches no accepted production. When the ID itself is
  // ID-shaped but fails the strict grammar, report INVALID_LOCAL_ID instead.
  if (headingText.startsWith(roleStem(role))) {
    const idAttempt = new RegExp(`^(\\S+?)(?::[ ]| ${EM_DASH} |$)`, "u").exec(headingText);
    const idPart = idAttempt ? idAttempt[1] : "";
    if (idPart !== "" && /^[A-Za-z][A-Za-z0-9.-]*$/u.test(idPart)) {
      return {
        status: "rejected",
        code: "INVALID_LOCAL_ID",
        message: `heading ID "${bound(idPart, 64)}" does not match the ${role} grammar`,
        expected: `${role} local ID`,
        actual: bound(idPart, 64),
      };
    }
    return {
      status: "rejected",
      code: "MALFORMED_HEADING",
      message: `heading resembles a ${role} definition but uses an unsupported separator or suffix`,
      expected: `${role}: title | ${role} ${EM_DASH} title`,
      actual: bound(headingText, 128),
    };
  }
  return null;
}

const TITLE_SCALAR_LIMIT = 512;

function boundedTitle(title) {
  let out = "";
  let scalarCount = 0;
  for (const ch of title) {
    scalarCount += 1;
    out += ch;
    if (scalarCount >= TITLE_SCALAR_LIMIT) break;
  }
  return out;
}

function trimTrailingBlankLines(text) {
  return text.replace(/(?:\n[ \t]*)+$/u, "");
}

// Parse one canonical Markdown document into its occurrence inventories.
// Link outcomes are NOT resolved here; call resolveLinkOutcomes after the
// corpus-wide anchor index exists. Returned records carry private
// `_`-prefixed sort helpers that the graph builder strips before publishing.
export function parseMarkdownDocument({ path, documentKind, text }) {
  const positions = new Positions(text);
  const blocks = scanBlocks(text);

  // ---- Headings ----
  const usedAnchors = new Set();
  const headings = [];
  for (const headingBlock of blocks.headings) {
    const plainText = renderInline(headingBlock.rawText).normalize("NFC");
    const baseAnchor = deriveBaseAnchor(plainText);
    const { canonicalAnchor, duplicateOrdinal } = allocateCanonicalAnchor(baseAnchor, usedAnchors);
    const startChar = headingBlock.segStart;
    const lineEndChar = lineEnd(text, startChar);
    const span = positions.spanBetween(startChar, lineEndChar);
    headings.push({
      headingOccurrenceId: sha256HexOf(
        canonicalJsonOf({
          kind: "markdown-heading",
          path,
          startOffset: span.startOffset,
          level: headingBlock.level,
          rawText: headingBlock.rawText,
        }),
      ),
      path,
      level: headingBlock.level,
      syntax: headingBlock.syntax,
      rawText: headingBlock.rawText,
      plainText,
      anchorAlgorithmVersion: ANCHOR_ALGORITHM_VERSION,
      baseAnchor,
      duplicateOrdinal,
      canonicalAnchor,
      span,
      sectionSpan: null, // filled below
      _startOffset: span.startOffset,
      _blockLineStart: headingBlock.blockLineStart,
    });
  }

  // Section spans: heading start through the byte before the next heading of
  // equal/higher level, or document end.
  const docByteLength = positions.byteLength();
  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];
    let sectionEndOffset = docByteLength;
    for (let j = i + 1; j < headings.length; j += 1) {
      if (headings[j].level <= heading.level) {
        sectionEndOffset = headings[j]._startOffset;
        break;
      }
    }
    const endPosition = positions.positionOf(positions.charIndexForOffset(sectionEndOffset));
    heading.sectionSpan = {
      startLine: heading.span.startLine,
      startColumn: heading.span.startColumn,
      endLine: endPosition.line,
      endColumn: endPosition.column,
      startOffset: heading.span.startOffset,
      endOffset: sectionEndOffset,
    };
  }

  const anchorIndex = new Map();
  for (const heading of headings) {
    anchorIndex.set(heading.canonicalAnchor, heading.headingOccurrenceId);
  }

  // ---- Semantic links (outcomes deferred) ----
  const referenceDefinitions = new Map();
  for (const [label, definition] of blocks.referenceDefinitions) {
    const destinationSpan = positions.spanBetween(
      definition.destinationSpan.charStart,
      definition.destinationSpan.charEnd,
    );
    referenceDefinitions.set(label, {
      rawDestination: definition.rawDestination,
      destinationSpan,
      rewriteKey: sha256HexOf(
        canonicalJsonOf({
          path,
          startOffset: destinationSpan.startOffset,
          endOffset: destinationSpan.endOffset,
        }),
      ),
    });
  }

  const segments = blocks.scanSegments.map((segment) => ({
    text: segment.text,
    resolve: (index) => positions.positionOf(segment.base + index),
  }));
  for (const headingBlock of blocks.headings) {
    segments.push({
      text: headingBlock.rawText,
      resolve: (index) => positions.positionOf(headingBlock.segStart + index),
    });
  }

  const links = [];
  for (const segment of segments) {
    for (const use of scanLinks(segment.text, segment.resolve, referenceDefinitions)) {
      links.push(finalizeLink(use, path));
    }
  }
  links.sort((a, b) =>
    a.useSpan.startOffset !== b.useSpan.startOffset
      ? a.useSpan.startOffset - b.useSpan.startOffset
      : a.linkOccurrenceId.localeCompare(b.linkOccurrenceId),
  );
  links.forEach((link, ordinal) => {
    link.linkOccurrenceId = sha256HexOf(
      canonicalJsonOf({
        kind: "markdown-link",
        path,
        startOffset: link.useSpan.startOffset,
        ordinal,
        rawIdOrTarget: link.rawDestination,
      }),
    );
  });
  links.sort((a, b) =>
    a.useSpan.startOffset !== b.useSpan.startOffset
      ? a.useSpan.startOffset - b.useSpan.startOffset
      : a.linkOccurrenceId.localeCompare(b.linkOccurrenceId),
  );
  // Inline destinations carry their own span; derive the rewrite key here.
  for (const link of links) {
    if (link.rewriteKey === null && link.destinationSpan) {
      link.rewriteKey = sha256HexOf(
        canonicalJsonOf({
          path,
          startOffset: link.destinationSpan.startOffset,
          endOffset: link.destinationSpan.endOffset,
        }),
      );
    }
  }

  for (const link of links) {
    link.sourceHeadingOccurrenceId = findEnclosingHeading(headings, link.useSpan.startOffset);
  }

  // ---- Table-column reference projections and FILE_CHANGE paths ----
  const tableReferences = [];
  const tablePaths = [];
  for (const table of extractPipeTables(text)) {
    table.header.forEach((headerCell, columnIndex) => {
      const headerText = headerCell.text.trim();
      const edgeType = REFERENCE_FIELD_EDGE_TYPES[headerText];
      const isPathColumn = /^(planned )?paths?$/iu.test(headerText);
      if (!edgeType && !isPathColumn) return;
      for (const row of table.rows) {
        const cell = row[columnIndex];
        if (!cell) continue;
        const cellText = cell.text.trim();
        if (cellText === "" || /^none$/iu.test(cellText)) continue;
        if (isPathColumn) {
          for (const token of tokenizeTargets(cellText)) {
            tablePaths.push({ pathText: token.text.replace(/[`'"]/gu, ""), span: cellSpan(cell, positions) });
          }
        } else {
          for (const token of tokenizeTargets(cellText)) {
            const target = referenceTargetFromToken(token.text);
            if (target === null) continue;
            tableReferences.push({
              edgeType,
              rawTarget: target.target,
              span: positions.spanBetween(
                cell.charStart + token.start + target.index,
                cell.charStart + token.start + target.index + target.target.length,
              ),
            });
          }
        }
      }
    });
  }

  // ---- Definitions (role-aware, document-order ordinals per candidate) ----
  const definitions = [];
  const rejectedDefinitions = [];
  const diagnostics = [];
  const roles = DOCUMENT_DEFINITION_ROLES[documentKind] ?? [];
  let ordinal = 0;
  for (const headingBlock of blocks.headings) {
    for (const role of roles) {
      const match = matchDefinitionHeading(role, headingBlock.level, headingBlock.rawText.trim());
      if (!match) continue;
      const startChar = headingBlock.segStart;
      const lineEndChar = lineEnd(text, startChar);
      const span = positions.spanBetween(startChar, lineEndChar);
      if (match.status === "rejected") {
        rejectedDefinitions.push({ role, ordinal, span, ...match });
        ordinal += 1;
        continue;
      }
      let bodyEndChar = text.length;
      for (const other of blocks.headings) {
        if (other.segStart > headingBlock.segStart && other.level <= headingBlock.level) {
          bodyEndChar = Math.min(bodyEndChar, other.blockLineStart);
          break;
        }
      }
      const bodyText = trimTrailingBlankLines(
        text.slice(Math.min(lineEndChar + 1, bodyEndChar), bodyEndChar),
      );
      definitions.push({
        role,
        ordinal,
        localId: match.localId,
        title: boundedTitle(match.title),
        span,
        bodyText,
        attributes: extractAttributes(
          documentKind,
          role,
          match.localId,
          match.title,
          bodyText,
          role === "FILE_CHANGE" ? tablePaths : [],
        ),
      });
      ordinal += 1;
    }
  }

  // ---- Structured-field reference projections ----
  const fieldReferences = [];
  for (const field of blocks.fieldLines) {
    const edgeType = REFERENCE_FIELD_EDGE_TYPES[field.name];
    if (!edgeType) continue;
    // P2d: token indexes are value-relative; rebase onto the line via the
    // absolute value start recorded by the block scanner.
    const base = field.valueStart;
    for (const token of tokenizeTargets(field.valueText)) {
      const target = referenceTargetFromToken(token.text);
      if (target === null) continue;
      fieldReferences.push({
        edgeType,
        rawTarget: target.target,
        span: positions.spanBetween(
          base + token.start + target.index,
          base + token.start + target.index + target.target.length,
        ),
      });
    }
  }

  return {
    positions,
    headings,
    links,
    definitions,
    rejectedDefinitions,
    fieldReferences,
    tableReferences,
    tablePaths,
    diagnostics,
    anchorIndex,
    byteLength: docByteLength,
  };
}

// Resolve every parsed link against the corpus-wide path/anchor index.
// corpus = { paths:Set<string>, anchorIndex: Map<path, Map<anchor, id>> }
export function resolveLinkOutcomes(links, sourcePath, corpus) {
  for (const link of links) {
    const resolution = resolveDestination(link.rawDestination, sourcePath, corpus);
    link.outcome = resolution.outcome;
    link.targetPath = resolution.targetPath ?? null;
    link.targetAnchor = resolution.targetAnchor ?? null;
    link.targetHeadingOccurrenceId = resolution.targetHeadingOccurrenceId ?? null;
    link.externalScheme = resolution.externalScheme ?? null;
    link.unresolvedReason = resolution.unresolvedReason ?? null;
    link.diagnosticCode = resolution.diagnosticCode ?? null;
  }
}

function cellSpan(cell, positions) {
  const a = positions.positionOf(cell.charStart);
  const b = positions.positionOf(cell.charEnd);
  return {
    startLine: a.line,
    startColumn: a.column,
    endLine: b.line,
    endColumn: b.column,
    startOffset: a.startOffset,
    endOffset: b.startOffset,
  };
}

function finalizeLink(use, path) {
  return {
    path,
    syntax: use.syntax,
    labelText: use.labelText,
    rawDestination: use.rawDestination,
    destinationSpan: use.destinationSpan,
    useSpan: use.useSpan,
    rewriteKey: use.rewriteKey ?? null,
    sourceHeadingOccurrenceId: null,
    outcome: "",
    targetPath: null,
    targetAnchor: null,
    targetHeadingOccurrenceId: null,
    externalScheme: null,
    unresolvedReason: null,
    diagnosticCode: null,
    linkOccurrenceId: "", // assigned after stable ordering above
  };
}

// Internal path resolution: source-directory-relative, NFC '/' form, dot-segment
// removal without root escape, percent-decoding for comparison only.
export function resolveDestination(rawDestination, sourcePath, corpus) {
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(rawDestination);
  if (scheme) {
    return { outcome: "EXTERNAL", externalScheme: scheme[1].toLowerCase() };
  }
  if (/[\u0000\n]/u.test(rawDestination)) {
    return {
      outcome: "UNRESOLVED",
      unresolvedReason: "MALFORMED_DESTINATION",
      diagnosticCode: "MALFORMED_MARKDOWN_LINK",
    };
  }
  const hash = rawDestination.indexOf("#");
  const decodedPath = percentDecode(hash < 0 ? rawDestination : rawDestination.slice(0, hash));
  const decodedFragment = hash < 0 ? null : percentDecode(rawDestination.slice(hash + 1));

  // P2c: an empty path (with or without a fragment) targets the source
  // document itself; a fragment resolves against its own headings.
  if (decodedPath !== "") {
    if (decodedPath.startsWith("/") || /^[A-Za-z]:/u.test(decodedPath)) {
      return {
        outcome: "UNRESOLVED",
        unresolvedReason: "TARGET_OUTSIDE_CORPUS",
        diagnosticCode: "BROKEN_MARKDOWN_LINK",
      };
    }

    const sourceDirectory = sourcePath.includes("/")
      ? sourcePath.slice(0, sourcePath.lastIndexOf("/"))
      : "";
    // Resolution is relative to the source document's directory; escaping
    // above the corpus root is rejected.
    const segments = sourceDirectory
      .split("/")
      .filter((part) => part !== "")
      .map((part) => part.normalize("NFC"));
    for (const segment of decodedPath.split("/")) {
      if (segment === "" || segment === ".") continue;
      if (segment === "..") {
        if (segments.length === 0) {
          return {
            outcome: "UNRESOLVED",
            unresolvedReason: "TARGET_OUTSIDE_CORPUS",
            diagnosticCode: "BROKEN_MARKDOWN_LINK",
          };
        }
        segments.pop();
        continue;
      }
      segments.push(segment.normalize("NFC"));
    }
    var normalizedTarget = segments.join("/");
    if (!corpus.paths.has(normalizedTarget)) {
      return {
        outcome: "UNRESOLVED",
        unresolvedReason: "TARGET_DOCUMENT_MISSING",
        targetPath: normalizedTarget,
        diagnosticCode: "BROKEN_MARKDOWN_LINK",
      };
    }
    if (decodedFragment === null) {
      return { outcome: "INTERNAL_DOCUMENT", targetPath: normalizedTarget };
    }
  } else {
    var normalizedTarget = sourcePath;
    if (decodedFragment === null) {
      // Truly empty destination resolves to the source document itself.
      return { outcome: "INTERNAL_DOCUMENT", targetPath: sourcePath };
    }
  }

  // Shared tail: resolve the fragment against the target document's anchors.
  const headingId2 = corpus.anchorIndex?.get(normalizedTarget)?.get(decodedFragment);
  if (headingId2 === undefined) {
    return {
      outcome: "UNRESOLVED",
      unresolvedReason: "TARGET_ANCHOR_MISSING",
      targetPath: normalizedTarget,
      targetAnchor: decodedFragment,
      diagnosticCode: "BROKEN_MARKDOWN_LINK",
    };
  }
  return {
    outcome: "INTERNAL_HEADING",
    targetPath: normalizedTarget,
    targetAnchor: decodedFragment,
    targetHeadingOccurrenceId: headingId2,
  };
}

export function percentDecode(text) {
  if (!text.includes("%")) return text;
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function findEnclosingHeading(headings, startOffset) {
  let best = null;
  for (const heading of headings) {
    if (
      heading.span.startOffset <= startOffset &&
      startOffset < heading.sectionSpan.endOffset &&
      (best === null || heading.span.startOffset >= best.span.startOffset)
    ) {
      best = heading;
    }
  }
  return best === null ? null : best.headingOccurrenceId;
}

// Split structured targets on commas and whitespace; keeps exact spans.
export function tokenizeTargets(valueText) {
  const tokens = [];
  for (const match of valueText.matchAll(/[^\s,]+/gu)) {
    tokens.push({ text: match[0], start: match.index });
  }
  return tokens;
}

// Extract pipe tables from a document text. Cells keep absolute char bounds.
export function extractPipeTables(text) {
  const tables = [];
  const lines = text.split("\n");
  const lineOffsets = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }
  const DELIMITER_RE = /^[ ]{0,3}\|?(?:[ ]*:?-{3,}:?[ ]*\|)+[ ]*:?-{3,}:?[ ]*\|?[ ]*$/u;
  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (!lines[i].includes("|") || !DELIMITER_RE.test(lines[i + 1])) continue;
    const headerCells = splitPipeCells(lines[i], lineOffsets[i]);
    if (headerCells.length === 0) continue;
    const rows = [];
    let j = i + 2;
    while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") {
      rows.push(splitPipeCells(lines[j], lineOffsets[j]));
      j += 1;
    }
    tables.push({ header: headerCells, rows, startLine: i + 1 });
    i = j - 1;
  }
  return tables;
}

function splitPipeCells(lineText, lineOffset) {
  const cells = [];
  let cellStart = 0;
  let escaped = false;
  const pushCell = (endIndex) => {
    const raw = lineText.slice(cellStart, endIndex);
    cells.push({
      text: raw.trim(),
      charStart: lineOffset + cellStart + (raw.length - raw.trimStart().length),
      charEnd: lineOffset + cellStart + raw.trimEnd().length,
    });
  };
  for (let i = 0; i < lineText.length; i += 1) {
    const ch = lineText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "|") {
      pushCell(i);
      cellStart = i + 1;
    }
  }
  pushCell(lineText.length);
  if (cells.length > 1 && cells[0].text === "") cells.shift();
  if (cells.length > 1 && cells[cells.length - 1].text === "") cells.pop();
  return cells;
}

// Resolve one whitespace/comma token to a reference target: exact grammar,
// an ID embedded in markdown syntax, or null for prose words such as "none".
function referenceTargetFromToken(text) {
  if (/^none$/iu.test(text)) return null;
  return extractReferenceTarget(text);
}
