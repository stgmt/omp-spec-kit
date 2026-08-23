// Block-level GLFM-subset scanner: headings (ATX/Setext), fenced and indented
// code, link reference definitions, pipe tables, and structured fields.
// Operates on one normalized document text and reports exact positions.

const ATX_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/u;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/u;
// GLFM Setext underlines are one or more `=`/`-`; thematic breaks stay 3+.
const SETEXT_RE = /^ {0,3}(={1,}|-{1,})[ \t]*$/u;
const THEMATIC_BREAK_RE = /^ {0,3}((?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/u;
const REF_DEF_RE = /^ {0,3}\[([^[\]]+)\]:[ \t]*(.*?)[ \t]*$/u;

function leadingIndent(lineText) {
  let count = 0;
  for (const ch of lineText) {
    if (ch === " ") count += 1;
    else if (ch === "\t") count += 4;
    else break;
  }
  return count;
}

export function splitLinesKeepEnds(text) {
  const lines = [];
  if (text.length === 0) {
    lines.push({ text: "", start: 0, endExcludingNewline: 0 });
    return lines;
  }
  let offset = 0;
  for (const part of text.split("\n")) {
    lines.push({ text: part, start: offset, endExcludingNewline: offset + part.length });
    offset += part.length + 1;
  }
  return lines;
}

export function scanBlocks(text) {
  const lines = splitLinesKeepEnds(text);
  const headings = [];
  const referenceDefinitions = new Map();
  const fieldLines = [];
  const scanSegments = [];
  const codeLineFlags = new Array(lines.length).fill(false);

  let fenceMarker = null;
  let fenceCloseMin = 0;
  let previousLineWasFenceClose = false;
  let inIndentedCode = false;
  let previousBlank = true;
  let lastParagraphIndex = -1;

  const FIELD_RE =
    /^ {0,3}(?:\*\*)?\s*(Refs|Related|Covers|Implements|Depends On)\s*(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*?)[ \t]*$/u;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineText = line.text;
    const indent = leadingIndent(lineText);

    // Fenced code blocks.
    if (fenceMarker !== null) {
      codeLineFlags[i] = true;
      const close = FENCE_RE.exec(lineText);
      if (close && close[1][0] === fenceMarker && close[1].length >= fenceCloseMin && close[2].trim() === "") {
        fenceMarker = null;
        previousLineWasFenceClose = true;
      }
      previousBlank = false;
      continue;
    }

    if (!inIndentedCode && indent < 4) {
      const open = FENCE_RE.exec(lineText);
      if (open) {
        fenceMarker = open[1][0];
        fenceCloseMin = open[1].length;
        codeLineFlags[i] = true;
        previousBlank = false;
        lastParagraphIndex = -1;
        continue;
      }
    }

    // Indented code blocks (begin after blank/start, end at deindent).
    if (inIndentedCode) {
      if (lineText.trim() === "" || indent >= 4) {
        codeLineFlags[i] = true;
        previousBlank = false;
        continue;
      }
      inIndentedCode = false;
    } else if (
      indent >= 4 &&
      (previousBlank || previousLineWasFenceClose) &&
      lineText.trim() !== ""
    ) {
      // P3: an indented line directly after a closing fence opens indented code.
      codeLineFlags[i] = true;
      inIndentedCode = true;
      lastParagraphIndex = -1;
      previousLineWasFenceClose = false;
      continue;
    }

    previousLineWasFenceClose = false;

    // Setext underline converts the preceding paragraph line into a heading.
    const setext = SETEXT_RE.exec(lineText);
    if (setext && !previousBlank && lastParagraphIndex === i - 1 && !THEMATIC_BREAK_RE.test(lineText)) {
      const para = lines[lastParagraphIndex];
      const level = setext[1][0] === "=" ? 1 : 2;
      headings.push(makeHeading(text, para.text.trim(), level, "SETEXT", para));
      scanSegments.pop();
      lastParagraphIndex = -1;
      previousBlank = false;
      continue;
    }

    // ATX headings.
    if (indent < 4) {
      const atx = ATX_RE.exec(lineText);
      if (atx) {
        let rawText = atx[2] ?? "";
        // Optional closing sequence of same-character hashes preceded by space.
        const closing = /[ \t]+#+[ \t]*$/u.exec(rawText);
        if (closing) rawText = rawText.slice(0, closing.index);
        headings.push(makeHeading(text, rawText, atx[1].length, "ATX", line));
        lastParagraphIndex = -1;
        previousBlank = false;
        continue;
      }
    }

    // Thematic breaks are ordinary block content, never paragraph material.
    if (indent < 4 && THEMATIC_BREAK_RE.test(lineText)) {
      lastParagraphIndex = -1;
      previousBlank = false;
      continue;
    }

    // Link reference definitions (block-start position only).
    if (previousBlank && indent < 4) {
      const refDef = REF_DEF_RE.exec(lineText);
      if (refDef && refDef[2].trim() !== "") {
        recordReferenceDefinition(text, line, refDef, referenceDefinitions);
        lastParagraphIndex = -1;
        previousBlank = false;
        continue;
      }
    }

    // Structured reference fields.
    const field = FIELD_RE.exec(lineText);
    if (field && indent < 4) {
      const valueStart = line.start + field.index + field[0].length - field[2].length;
      fieldLines.push({
        name: field[1],
        valueText: field[2],
        valueStart,
        line: i + 1,
      });
      scanSegments.push({ text: field[2], base: valueStart, line: i + 1 });
      lastParagraphIndex = -1;
      previousBlank = false;
      continue;
    }

    if (lineText.trim() === "") {
      previousBlank = true;
      lastParagraphIndex = -1;
      continue;
    }

    scanSegments.push({ text: lineText, base: line.start, line: i + 1 });
    lastParagraphIndex = i;
    previousBlank = false;
  }

  return { lines, headings, referenceDefinitions, fieldLines, scanSegments, codeLineFlags };
}

function makeHeading(docText, rawText, level, syntax, lineInfo) {
  const trimmedLead = lineInfo.text.length - lineInfo.text.trimStart().length;
  const labelStartInLine = syntax === "ATX" ? labelStartForAtx(lineInfo.text, rawText) : trimmedLead;
  void docText;
  return {
    level,
    syntax,
    rawText,
    line: null, // filled by caller (1-based)
    column: labelStartInLine + 1,
    segStart: lineInfo.start + labelStartInLine,
    segEnd: lineInfo.start + labelStartInLine + rawText.length,
    blockLineStart: lineInfo.start,
  };
}

function labelStartForAtx(lineText, rawText) {
  const hashes = /^ {0,3}#{1,6}[ \t]?/u.exec(lineText);
  if (!hashes) return lineText.indexOf(rawText) >= 0 ? lineText.indexOf(rawText) : 0;
  const start = hashes[0].length;
  const found = lineText.indexOf(rawText, start);
  return found >= 0 ? found : start;
}

function recordReferenceDefinition(text, line, match, target) {
  const rest = match[2];
  let rawDestination = "";
  let destStartInRest = 0;
  let destEndInRest = 0;
  if (rest.startsWith("<")) {
    const close = rest.indexOf(">");
    if (close > 1) {
      rawDestination = rest.slice(1, close);
      destStartInRest = 1;
      destEndInRest = close;
    }
  } else {
    const spaceOrEnd = /\s/u.exec(rest);
    const end = spaceOrEnd ? spaceOrEnd.index : rest.length;
    rawDestination = rest.slice(0, end);
    destStartInRest = 0;
    destEndInRest = end;
  }
  if (destEndInRest <= destStartInRest) {
    rawDestination = "";
    destStartInRest = 0;
    destEndInRest = 0;
  }
  const absoluteStart = line.start + match.index + match[0].length - rest.length + destStartInRest;
  const absoluteEnd = absoluteStart + (destEndInRest - destStartInRest);
  const key = normalizeLabel(match[1]);
  if (!target.has(key)) {
    target.set(key, {
      rawDestination,
      destinationSpan: { charStart: absoluteStart, charEnd: absoluteEnd },
      line: null,
    });
    void text;
  }
}

export function normalizeLabel(label) {
  return label.replace(/\s+/gu, " ").trim().toLowerCase();
}
