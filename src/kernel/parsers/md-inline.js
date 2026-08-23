// GLFM inline processing: rendered plain text, anchor derivation, and semantic
// link-use scanning with exact source positions. Deterministic subset of the
// GLFM inline grammar sufficient for specification prose; operates on one
// logical text segment with an absolute position resolver.

const NAMED_ENTITIES = new Map(
  Object.entries({
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
    copy: "\u00a9",
    reg: "\u00ae",
    hellip: "\u2026",
    mdash: "\u2014",
    ndash: "\u2013",
    lsquo: "\u2018",
    rsquo: "\u2019",
    ldquo: "\u201c",
    rdquo: "\u201d",
  }),
);

export function decodeCharacterReferences(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "&") {
      const semi = text.indexOf(";", i + 1);
      if (semi > i && semi - i <= 32) {
        const body = text.slice(i + 1, semi);
        const numeric =
          /^#([0-9]+)$/u.exec(body) ?? (/^#[xX]([0-9a-fA-F]+)$/u.exec(body) ? null : null);
        if (numeric) {
          const value = Number.parseInt(numeric[1], 10);
          if (value > 0 && value <= 0x10ffff) {
            out += String.fromCodePoint(value === 0 ? 0xfffd : value);
            i = semi + 1;
            continue;
          }
        } else if (/^#[xX][0-9a-fA-F]+$/u.test(body)) {
          const value = Number.parseInt(body.slice(2), 16);
          if (value > 0 && value <= 0x10ffff) {
            out += String.fromCodePoint(value);
            i = semi + 1;
            continue;
          }
        } else if (NAMED_ENTITIES.has(body)) {
          out += NAMED_ENTITIES.get(body);
          i = semi + 1;
          continue;
        }
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

function matchBacktickRun(text, start) {
  let end = start;
  while (end < text.length && text[end] === "`") end += 1;
  return end;
}

// Parse a bracketed label starting at `start` (text[start] === "[").
// Returns { contentEnd, inner } where contentEnd is the index of "]".
function matchBracketLabel(text, start) {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return { contentEnd: i, inner: text.slice(start + 1, i) };
    }
    i += 1;
  }
  return null;
}

function skipSpaces(text, i) {
  while (i < text.length && (text[i] === " " || text[i] === "\t")) i += 1;
  return i;
}

// Parse `(dest "title")` after a link label. Returns destination bounds.
function matchInlineDestination(text, start) {
  if (text[start] !== "(") return null;
  let depth = 0;
  let i = start;
  let destStart = -1;
  let destEnd = -1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      i += 2;
      continue;
    }
    if (ch === " ") {
      // Whitespace ends the destination; a quoted title may follow.
      if (destStart >= 0 && destEnd < 0) destEnd = i;
      if (text[i + 1] === '"' || text[i + 1] === "'" || text[i + 1] === "(") {
        // Title: skip to matching close.
        const quote = text[i + 1];
        let j = i + 2;
        while (j < text.length && !(text[j] === quote && text[j - 1] !== "\\")) j += 1;
        while (j < text.length && text[j] !== ")") j += 1;
        if (j < text.length && depth === 0) return { destStart, destEnd, closeIndex: j };
      }
    } else if (ch === "(") {
      depth += 1;
      if (destStart < 0) destStart = i + 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        // P2b: `()` is a valid empty destination resolving to the source doc.
        if (destEnd < 0) destEnd = i;
        if (destStart < 0 || destStart > destEnd) destStart = destEnd;
        return { destStart, destEnd, closeIndex: i };
      }
      if (depth < 0) return null;
    } else if (destStart < 0) {
      destStart = i;
    }
    i += 1;
  }
  return null;
}

const AUTOLINK_RE = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*)>/u;
const AUTOLINK_EMAIL_RE = /^<([A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/u;

function renderLabelOnly(text) {
  return renderInline(text);
}

// Rendered plain text of a GLFM inline segment: markup removed, character
// references decoded, other scalars preserved.
export function renderInline(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length && /[!-/:-@[-`{-~]/u.test(text[i + 1])) {
      out += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === "`") {
      const runEnd = matchBacktickRun(text, i);
      const close = text.indexOf(text.slice(i, runEnd), runEnd);
      if (close >= 0) {
        let content = text.slice(runEnd, close);
        if (content.startsWith(" ") && content.endsWith(" ") && content.length >= 2) {
          content = content.slice(1, -1);
        }
        out += content;
        i = close + (runEnd - i);
        continue;
      }
      out += text.slice(i, runEnd);
      i = runEnd;
      continue;
    }
    if (ch === "<") {
      const rest = text.slice(i);
      const auto = AUTOLINK_RE.exec(rest) ?? AUTOLINK_EMAIL_RE.exec(rest);
      if (auto) {
        out += decodeCharacterReferences(auto[1]);
        i += auto[0].length;
        continue;
      }
      const comment = /^<!--[\s\S]*?-->/.exec(rest);
      if (comment) {
        i += comment[0].length;
        continue;
      }
      const tag = /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?>/.exec(rest);
      if (tag) {
        i += tag[0].length;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if ((ch === "!" && text[i + 1] === "[") || ch === "[") {
      const isImage = ch === "!";
      const bracket = isImage ? i + 1 : i;
      const label = matchBracketLabel(text, bracket);
      if (label) {
        let handled = false;
        const after = label.contentEnd + 1;
        if (text[after] === "(") {
          const dest = matchInlineDestination(text, after);
          if (dest && dest.destStart >= 0) {
            out += renderLabelOnly(label.inner);
            i = dest.closeIndex + 1;
            handled = true;
          }
        } else if (text[after] === "[") {
          const ref = matchBracketLabel(text, after);
          if (ref) {
            out += renderLabelOnly(label.inner);
            i = ref.contentEnd + 1;
            handled = true;
          }
        } else if (!isImage) {
          // Shortcut reference or plain text; decided by caller context. Here
          // render as label only when followed by non-reference syntax.
          out += renderLabelOnly(label.inner);
          i = after;
          handled = true;
        }
        if (handled) continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "*" || ch === "_" || ch === "~") {
      // P1: strip emphasis delimiters only when a matching closer exists;
      // unmatched runs (intraword underscores such as snake_case_name) stay
      // literal so glfm-anchor@1 preserves `_` and `-`.
      let runLength = 0;
      while (i + runLength < text.length && text[i + runLength] === ch) runLength += 1;
      const delimiter = ch === "~" ? "~~" : ch === "_" ? "_" : "*";
      const afterOpen = i + delimiter.length;
      let closeIndex = text.indexOf(delimiter, afterOpen + 1);
      // Intraword underscores never emphasize in GLFM: `snake_case_name`
      // keeps its underscores.
      if (
        ch === "_" &&
        closeIndex > afterOpen &&
        ((i > 0 && /[A-Za-z0-9]/u.test(text[i - 1])) ||
          (closeIndex + delimiter.length < text.length &&
            /[A-Za-z0-9]/u.test(text[closeIndex + delimiter.length])))
      ) {
        closeIndex = -1;
      }
      if (closeIndex > afterOpen) {
        out += renderInline(text.slice(afterOpen, closeIndex));
        i = closeIndex + delimiter.length;
        continue;
      }
      if (ch === "_") out += "_".repeat(runLength);
      i += runLength;
      continue;
    }
    if (ch === "&") {
      const decoded = decodeCharacterReferences(text.slice(i, Math.min(text.length, i + 34)));
      if (decoded.length > 0 && decoded !== text.slice(i, i + 1)) {
        const semi = text.indexOf(";", i);
        if (semi > i && semi <= i + 33) {
          out += decoded;
          i = semi + 1;
          continue;
        }
      }
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const PUNCT_SYMBOL_RE = /[\p{P}\p{S}]/u;
const WHITESPACE_RE = /\s/u;

// glfm-anchor@1 base-anchor derivation from rendered heading text.
export function deriveBaseAnchor(plainText) {
  let out = "";
  for (const ch of plainText.normalize("NFC")) {
    if (WHITESPACE_RE.test(ch)) out += "-";
    else if (ch === "_" || ch === "-") out += ch;
    else if (PUNCT_SYMBOL_RE.test(ch)) {
      // removed
    } else out += ch;
  }
  // Unicode default lowercase, locale-independent.
  return out.toLowerCase();
}

// Allocate the smallest unused candidate against the complete previously
// emitted anchor set; mutates the provided set.
export function allocateCanonicalAnchor(baseAnchor, usedAnchors) {
  if (!usedAnchors.has(baseAnchor)) {
    usedAnchors.add(baseAnchor);
    return { canonicalAnchor: baseAnchor, duplicateOrdinal: 0 };
  }
  let n = 1;
  for (;;) {
    const candidate = `${baseAnchor}-${n}`;
    if (!usedAnchors.has(candidate)) {
      usedAnchors.add(candidate);
      return { canonicalAnchor: candidate, duplicateOrdinal: n };
    }
    n += 1;
  }
}

// Scan one text segment for semantic link uses. `resolve(position)` maps a
// segment-relative char index to { line, column, startOffset }. Reference
// definitions present in the enclosing document are supplied by the caller.
// Returns occurrences with segment-relative spans resolved to absolute data.
export function scanLinks(text, resolve, referenceDefinitions) {
  const results = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "`") {
      const runEnd = matchBacktickRun(text, i);
      const close = text.indexOf(text.slice(i, runEnd), runEnd);
      i = close >= 0 ? close + (runEnd - i) : runEnd;
      continue;
    }
    if (ch === "<") {
      const rest = text.slice(i);
      const auto = AUTOLINK_RE.exec(rest) ?? AUTOLINK_EMAIL_RE.exec(rest);
      if (auto) {
        const inner = auto[1];
        const isEmail = !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(inner);
        results.push(
          finishLink({
            syntax: "AUTOLINK",
            labelText: "",
            rawDestination: isEmail ? `mailto:${inner}` : inner,
            useStart: i,
            useEnd: i + auto[0].length,
            destStart: i + 1,
            destEnd: i + 1 + inner.length,
            resolve,
          }),
        );
        i += auto[0].length;
        continue;
      }
      const commentOrTag = /^(<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?>)/.exec(rest);
      if (commentOrTag) {
        i += commentOrTag[0].length;
        continue;
      }
      i += 1;
      continue;
    }
    if ((ch === "!" && text[i + 1] === "[") || ch === "[") {
      const isImage = ch === "!";
      const bracket = isImage ? i + 1 : i;
      const label = matchBracketLabel(text, bracket);
      if (!label) {
        i += 1;
        continue;
      }
      const after = label.contentEnd + 1;
      if (text[after] === "(") {
        const dest = matchInlineDestination(text, after);
        if (dest && dest.destStart >= 0 && dest.destEnd >= dest.destStart) {
          if (!isImage) {
            const rawDest = text.slice(dest.destStart, dest.destEnd);
            results.push(
              finishLink({
                syntax: "INLINE",
                labelText: renderInline(label.inner),
                rawDestination: rawDest.trim() === "" ? "" : rawDest,
                useStart: i,
                useEnd: dest.closeIndex + 1,
                destStart: dest.destStart,
                destEnd: dest.destEnd,
                resolve,
              }),
            );
          }
          i = dest.closeIndex + 1;
          continue;
        }
        if (isImage || dest) {
          i = dest ? dest.closeIndex + 1 : after;
          continue;
        }
        i += 1;
        continue;
      }
      if (isImage) {
        i = after;
        continue;
      }
      // Reference-style forms.
      let referenceLabel = null;
      let syntax = null;
      let endIndex = after;
      if (text[after] === "[") {
        const ref = matchBracketLabel(text, after);
        if (ref) {
          const innerRef = ref.inner.trim();
          if (innerRef === "") {
            syntax = "COLLAPSED_REFERENCE";
            referenceLabel = label.inner;
          } else {
            syntax = "FULL_REFERENCE";
            referenceLabel = innerRef;
          }
          endIndex = ref.contentEnd + 1;
        }
      } else {
        syntax = "SHORTCUT_REFERENCE";
        referenceLabel = label.inner;
        endIndex = after;
      }
      if (syntax === null) {
        i += 1;
        continue;
      }
      const definition = lookupReferenceDefinition(referenceDefinitions, referenceLabel);
      if (!definition) {
        i = Math.max(endIndex, i + 1);
        continue;
      }
      const startResolved = resolve(i);
      results.push({
        syntax,
        labelText: renderInline(label.inner),
        rawDestination: definition.rawDestination,
        useSpan: spanBetween(resolve, i, endIndex),
        destinationSpan: definition.destinationSpan,
        rewriteKey: definition.rewriteKey,
        startLine: startResolved.line,
        startColumn: startResolved.column,
        startOffset: startResolved.startOffset,
      });
      i = endIndex;
      continue;
    }
    i += 1;
  }
  return results;
}

function lookupReferenceDefinition(definitions, label) {
  const key = normalizeLinkLabel(label);
  return definitions?.get(key) ?? null;
}

export function normalizeLinkLabel(label) {
  return label.replace(/\s+/gu, " ").trim().toLowerCase();
}

function finishLink({ syntax, labelText, rawDestination, useStart, useEnd, destStart, destEnd, resolve }) {
  const startResolved = resolve(useStart);
  return {
    syntax,
    labelText,
    rawDestination,
    useSpan: spanBetween(resolve, useStart, useEnd),
    destinationSpan: spanBetween(resolve, destStart, destEnd),
    rewriteKey: null, // filled by caller from destinationSpan
    startLine: startResolved.line,
    startColumn: startResolved.column,
    startOffset: startResolved.startOffset,
  };
}

function spanBetween(resolve, startIndex, endIndex) {
  // The resolver maps an in-segment char index to { line, column, startOffset }
  // and handles index === segment length as the one-past-the-end position.
  const a = resolve(startIndex);
  const b = resolve(Math.max(startIndex, endIndex));
  return {
    startLine: a.line,
    startColumn: a.column,
    endLine: b.line,
    endColumn: b.column,
    startOffset: a.startOffset,
    endOffset: b.startOffset,
  };
}
