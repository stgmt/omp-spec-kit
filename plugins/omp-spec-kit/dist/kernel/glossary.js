// Project glossary: one authoritative Markdown table per project.
//
// Pure module. It parses glossary text, serializes it back, and scans prose for
// the forbidden forms a glossary declares. Nothing here reads files, git or the
// registry: the service layer owns the branch, the project path and the write
// path. Keeping the rules here means the preview and the write cannot disagree
// about what a valid glossary is, the same way readiness keeps its rule text in
// one constant.
//
// Spec: `.specs/project-glossary` (FR-1, FR-3, FR-5; SCHEMA).
import { sha256Bytes } from "./normalize.js";
import { scanBlocks } from "./parsers/md-blocks.js";

/** The document cap the document service already enforces for spec documents. */
export const GLOSSARY_MAX_BYTES = 2 * 1024 * 1024;
export const GLOSSARY_HEADING = "# Глоссарий";
export const GLOSSARY_COLUMNS = Object.freeze(["id", "термин", "определение", "запрещённые формы"]);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;

// Every refusal is named here once; the service renders these codes instead of
// writing its own strings.
export const GLOSSARY_ERROR_CODES = Object.freeze({
  TOO_LARGE: "GLOSSARY_TOO_LARGE",
  HEADING_MISSING: "GLOSSARY_HEADING_MISSING",
  TABLE_MISSING: "GLOSSARY_TABLE_MISSING",
  COLUMNS_INVALID: "GLOSSARY_COLUMNS_INVALID",
  UNESCAPED_PIPE: "UNESCAPED_PIPE",
  ID_INVALID: "GLOSSARY_ID_INVALID",
  ID_DUPLICATE: "GLOSSARY_ID_DUPLICATE",
  CELL_EMPTY: "GLOSSARY_CELL_EMPTY",
  TERM_DUPLICATE: "GLOSSARY_TERM_DUPLICATE",
  FORM_DUPLICATE: "GLOSSARY_FORM_DUPLICATE",
  FORM_EQUALS_TERM: "GLOSSARY_FORM_EQUALS_TERM",
  SEPARATOR_IN_FORM: "SEPARATOR_IN_FORM",
});

/**
 * The one normalization both sides use: Unicode NFC, then `toLowerCase()`.
 * Full Unicode case folding is deliberately not applied, so `ß` differs from
 * `ss` and `İ` normalizes to `i` plus a combining dot.
 */
export function normalizeGlossaryText(value) {
  return String(value).normalize("NFC").toLowerCase();
}

function failure(code, message, line, column) {
  return { code, message, line: line ?? null, column: column ?? null };
}

function byteLength(text) {
  return Buffer.byteLength(text, "utf8");
}

function isFenceOrTable(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("|");
}

/** Split one table row on unescaped pipes; returns null when the row is malformed. */
function splitRow(line) {
  const cells = [];
  let current = "";
  let escaped = false;
  let start = 0;
  const trimmedStart = line.length - line.trimStart().length;
  for (let i = trimmedStart; i < line.length; i += 1) {
    const char = line[i];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      current += char;
      continue;
    }
    if (char === "|") {
      cells.push({ text: current, column: start + 1 });
      current = "";
      start = i + 1;
      continue;
    }
    current += char;
  }
  cells.push({ text: current, column: start + 1 });
  // The row edges are pipes, not cells: drop by position, never by emptiness,
  // so a legitimately empty first cell still counts as a cell.
  const trimmed = line.trim();
  if (trimmed.startsWith("|") && cells.length > 0) cells.shift();
  if (/(?<!\\)\|$/u.test(trimmed) && cells.length > 0) cells.pop();
  return cells;
}

function unescapeCell(value) {
  return value.replace(/\\([\\|])/gu, "$1").trim();
}

function isSeparatorRow(line) {
  return /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/u.test(line);
}

/**
 * Parse glossary text.
 * Returns `{ ok, terms, sha256, errors }`; `sha256` is the hash of the exact
 * input bytes, so a caller can compare it with the version it read.
 */
export function parseGlossary(text) {
  const bytes = Buffer.from(text, "utf8");
  const digest = sha256Bytes(bytes);
  if (bytes.length > GLOSSARY_MAX_BYTES) {
    return {
      ok: false,
      terms: [],
      sha256: digest,
      errors: [failure(GLOSSARY_ERROR_CODES.TOO_LARGE, `glossary exceeds ${GLOSSARY_MAX_BYTES} bytes`, null, null)],
    };
  }
  const lines = text.split("\n");
  const errors = [];
  let headingLine = null;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === GLOSSARY_HEADING) {
      headingLine = i;
      break;
    }
  }
  if (headingLine === null) {
    return {
      ok: false,
      terms: [],
      sha256: digest,
      errors: [failure(GLOSSARY_ERROR_CODES.HEADING_MISSING, `glossary has no "${GLOSSARY_HEADING}" heading`, null, null)],
    };
  }
  let headerIndex = null;
  for (let i = headingLine + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "") continue;
    if (isFenceOrTable(lines[i])) {
      headerIndex = i;
      break;
    }
    break;
  }
  if (headerIndex === null) {
    return {
      ok: false,
      terms: [],
      sha256: digest,
      errors: [failure(GLOSSARY_ERROR_CODES.TABLE_MISSING, "glossary has no table after the heading", headingLine + 1, 1)],
    };
  }
  const headerCells = splitRow(lines[headerIndex]);
  const header = headerCells.map((cell) => unescapeCell(cell.text));
  if (header.length !== GLOSSARY_COLUMNS.length || header.some((cell, index) => cell !== GLOSSARY_COLUMNS[index])) {
    errors.push(
      failure(
        GLOSSARY_ERROR_CODES.COLUMNS_INVALID,
        `glossary columns must be "${GLOSSARY_COLUMNS.join(" | ")}"`,
        headerIndex + 1,
        1,
      ),
    );
  }
  const separatorIndex = headerIndex + 1;
  if (separatorIndex >= lines.length || !isSeparatorRow(lines[separatorIndex])) {
    errors.push(
      failure(GLOSSARY_ERROR_CODES.TABLE_MISSING, "glossary table has no separator row", headerIndex + 1, 1),
    );
  }
  const terms = [];
  const byId = new Map();
  const byTerm = new Map();
  const byForm = new Map();
  for (let i = separatorIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") break;
    if (!isFenceOrTable(line)) break;
    const lineNumber = i + 1;
    const cells = splitRow(line);
    if (cells.length !== GLOSSARY_COLUMNS.length) {
      errors.push(
        failure(
          GLOSSARY_ERROR_CODES.UNESCAPED_PIPE,
          `row has ${cells.length} cells, expected ${GLOSSARY_COLUMNS.length}; escape a literal pipe as \\|`,
          lineNumber,
          (cells[GLOSSARY_COLUMNS.length]?.column ?? line.length),
        ),
      );
      continue;
    }
    const [idCell, termCell, definitionCell, formsCell] = cells.map((cell) => unescapeCell(cell.text));
    if (idCell === "" || termCell === "" || definitionCell === "") {
      errors.push(failure(GLOSSARY_ERROR_CODES.CELL_EMPTY, "id, term and definition must not be empty", lineNumber, 1));
      continue;
    }
    if (!ID_PATTERN.test(idCell)) {
      errors.push(
        failure(GLOSSARY_ERROR_CODES.ID_INVALID, `id must match ${ID_PATTERN.source}`, lineNumber, cells[0].column),
      );
    }
    if (byId.has(idCell)) {
      errors.push(failure(GLOSSARY_ERROR_CODES.ID_DUPLICATE, `id "${idCell}" is already declared`, lineNumber, cells[0].column));
    } else {
      byId.set(idCell, lineNumber);
    }
    const normalizedTerm = normalizeGlossaryText(termCell);
    if (byTerm.has(normalizedTerm)) {
      errors.push(
        failure(GLOSSARY_ERROR_CODES.TERM_DUPLICATE, `term "${termCell}" repeats a term already declared`, lineNumber, cells[1].column),
      );
    } else {
      byTerm.set(normalizedTerm, lineNumber);
    }
    const forms = formsCell === "" ? [] : formsCell.split(";").map((form) => form.trim());
    for (const form of forms) {
      if (form === "") {
        errors.push(
          failure(GLOSSARY_ERROR_CODES.SEPARATOR_IN_FORM, "forbidden form list has an empty entry", lineNumber, cells[3].column),
        );
        continue;
      }
      const normalizedForm = normalizeGlossaryText(form);
      if (normalizedForm === normalizedTerm) {
        errors.push(
          failure(
            GLOSSARY_ERROR_CODES.FORM_EQUALS_TERM,
            `forbidden form "${form}" equals the term "${termCell}"`,
            lineNumber,
            cells[3].column,
          ),
        );
        continue;
      }
      if (byForm.has(normalizedForm)) {
        errors.push(
          failure(GLOSSARY_ERROR_CODES.FORM_DUPLICATE, `forbidden form "${form}" is already declared`, lineNumber, cells[3].column),
        );
        continue;
      }
      byForm.set(normalizedForm, lineNumber);
    }
    terms.push({ id: idCell, term: termCell, definition: definitionCell, forbiddenForms: forms, line: lineNumber });
  }
  return { ok: errors.length === 0, terms, sha256: digest, errors };
}

function escapeCell(value) {
  return String(value).replace(/\\/gu, "\\\\").replace(/\|/gu, "\\|");
}

/**
 * Serialize terms back to the canonical document. Order is stable (by id) so a
 * no-op write produces identical bytes and cannot create a new version.
 */
export function serializeGlossary(terms) {
  const rows = [...terms].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const lines = [GLOSSARY_HEADING, ""];
  lines.push(`| ${GLOSSARY_COLUMNS.join(" | ")} |`);
  lines.push(`|${GLOSSARY_COLUMNS.map(() => "---").join("|")}|`);
  for (const term of rows) {
    lines.push(
      `| ${escapeCell(term.id)} | ${escapeCell(term.term)} | ${escapeCell(term.definition)} | ${escapeCell(
        (term.forbiddenForms ?? []).join("; "),
      )} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

const BOUNDARY = /[\p{L}\p{M}\p{N}_]/u;

/**
 * Mask inline code spans and link destinations with spaces, keeping every other
 * character in place so reported columns stay those of the original text.
 */
export function maskNonProse(text) {
  const chars = [...text];
  const masked = [...text];
  const blank = (from, to) => {
    for (let i = from; i < to; i += 1) masked[i] = " ";
  };
  // Inline code spans: a run of backticks closes on the next run of equal length.
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] !== "`") continue;
    let run = 1;
    while (i + run < chars.length && chars[i + run] === "`") run += 1;
    let close = -1;
    for (let j = i + run; j < chars.length; j += 1) {
      if (chars[j] !== "`") continue;
      let other = 1;
      while (j + other < chars.length && chars[j + other] === "`") other += 1;
      if (other === run) {
        close = j;
        break;
      }
      j += other - 1;
    }
    if (close >= 0) {
      blank(i, close + run);
      i = close + run - 1;
    }
  }
  // Link and image destinations: `](`...`)`.
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] !== "]" || chars[i + 1] !== "(") continue;
    let depth = 1;
    let j = i + 2;
    for (; j < chars.length && depth > 0; j += 1) {
      if (chars[j] === "(") depth += 1;
      else if (chars[j] === ")") depth -= 1;
    }
    if (depth === 0) blank(i + 1, j);
  }
  return masked.join("");
}

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Build a normalized copy of one segment with an index map back to the original
 * characters, so a match in the normalized text keeps its original position.
 * Normalization runs per grapheme cluster, not per code point: NFC cannot compose
 * a base letter and a combining mark that were split apart, so per-code-point
 * normalization would miss decomposed prose that the whole-string rule matches.
 */
function normalizeWithMap(text) {
  let normalized = "";
  const map = [];
  for (const { segment, index } of GRAPHEMES.segment(text)) {
    const unit = segment.normalize("NFC").toLowerCase();
    // One map entry per UTF-16 unit, so `indexOf` offsets index the map directly
    // even when a cluster normalizes to a surrogate pair.
    for (let k = 0; k < unit.length; k += 1) {
      normalized += unit[k];
      map.push(index);
    }
  }
  return { normalized, map };
}

/**
 * Find declared forbidden forms in Markdown prose.
 * Code blocks, inline code and link destinations are not prose and are skipped.
 * Returns findings with 1-based line and column in the original text.
 */
export function findForbiddenForms(text, terms) {
  const { scanSegments, lines, codeLineFlags } = scanBlocks(text);
  const findings = [];
  const rules = [];
  for (const term of terms) {
    for (const form of term.forbiddenForms ?? []) {
      const normalized = normalizeGlossaryText(form);
      if (normalized !== "") rules.push({ term, form, normalized });
    }
  }
  if (rules.length === 0) return findings;
  for (const segment of scanSegments) {
    if (codeLineFlags[segment.line - 1] === true) continue;
    const masked = maskNonProse(segment.text);
    const { normalized, map } = normalizeWithMap(masked);
    for (const rule of rules) {
      let from = 0;
      for (;;) {
        const at = normalized.indexOf(rule.normalized, from);
        if (at < 0) break;
        const end = at + rule.normalized.length;
        const before = at > 0 ? normalized[at - 1] : "";
        const after = end < normalized.length ? normalized[end] : "";
        if ((before === "" || !BOUNDARY.test(before)) && (after === "" || !BOUNDARY.test(after))) {
          // `segment.base` is the absolute offset of the segment text: a whole
          // line for prose, the value after the colon for `Covers:`-style
          // fields. The column is counted in code points from the line start.
          const lineStart = lines[segment.line - 1]?.start ?? 0;
          const absolute = segment.base + map[at];
          findings.push({
            code: "GLOSSARY_FORBIDDEN_FORM",
            termId: rule.term.id,
            term: rule.term.term,
            form: rule.form,
            line: segment.line,
            column: [...text.slice(lineStart, absolute)].length + 1,
          });
        }
        from = at + 1;
      }
    }
  }
  return findings;
}
