// English Gherkin parsing for `<spec-slug>.feature` documents.
// Produces Scenario definition candidates with typed attributes and trace
// reference projections (@featureN -> FR-N, @AC-N.M -> AC-N.M, structured
// `Refs:` description lines). Pure; line-oriented with exact spans.

import { Positions } from "./markdown.js";
import { isValidSpecSlug } from "../identity.js";

const SCEN_ID_RE = /^SCEN-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const STEP_RE = /^(Given|When|Then|And|But|\*)[ \t]+(.*)$/u;
const TAG_LINE_RE = /^[ ]*((?:@[^\s@][^\s]*[ \t]*)+)$/u;
const EXAMPLES_RE = /^[ ]*Examples(?:[ ]*:.*)?$/u;
const DOCSTRING_RE = /^[ ]{0,3}("""|```)/u;

// Common non-English Gherkin keywords that mark an unsupported dialect.
const FOREIGN_KEYWORDS = [
  "Funktion",
  "Funktionalität",
  "Eigenschaft",
  "Funcionalidade",
  "Característica",
  "Escenario",
  "Scénario",
  "Fonctionnalité",
  "Funzionalità",
  "Сценарий",
  "Функция",
  "Функционал",
];

function bound(value, max) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function spanForLine(positions, text, zeroBasedLine) {
  const lineStartChar = positionOfLineStart(text, zeroBasedLine);
  const start = positions.positionOf(lineStartChar);
  const nl = text.indexOf("\n", lineStartChar);
  const end = positions.positionOf(nl < 0 ? text.length : nl);
  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
    startOffset: start.startOffset,
    endOffset: end.startOffset,
  };
}

function positionOfLineStart(text, zeroBasedLine) {
  let index = 0;
  for (let i = 0; i < zeroBasedLine; i += 1) {
    const nl = text.indexOf("\n", index);
    if (nl < 0) return index;
    index = nl + 1;
  }
  return index;
}

export function parseGherkinDocument({ path, specSlug, text }) {
  void path;
  if (!isValidSpecSlug(specSlug)) {
    return { positions: new Positions(text), diagnostics: [], scenarios: [] };
  }
  const positions = new Positions(text);
  const lines = text.split("\n");
  const diagnostics = [];
  const scenarios = [];
  let dialectReported = false;
  let malformedReported = 0;

  let featureName = "";
  let featureTags = [];
  let pendingTags = [];
  let current = null;
  let inExamples = false;
  let examplesCurrent = null;
  let docstringMarker = null;

  const flushScenario = () => {
    if (!current) return;
    finalizeScenario(current, specSlug, featureName, positions, text);
    scenarios.push(current);
    current = null;
    inExamples = false;
    examplesCurrent = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Foreign-dialect detection on keyword-shaped lines (once per document).
    if (!dialectReported && !trimmed.startsWith("#")) {
      for (const keyword of FOREIGN_KEYWORDS) {
        if (trimmed.startsWith(keyword)) {
          dialectReported = true;
          diagnostics.push({
            code: "UNSUPPORTED_GHERKIN_DIALECT",
            message: `non-English Gherkin keyword "${bound(keyword, 32)}" is not supported`,
            span: spanForLine(positions, text, i),
          });
          break;
        }
      }
      if (dialectReported) continue;
    }

    if (docstringMarker !== null) {
      if (trimmed.startsWith(docstringMarker)) docstringMarker = null;
      continue;
    }
    const docstring = DOCSTRING_RE.exec(rawLine);
    if (docstring && !trimmed.startsWith("#")) {
      docstringMarker = docstring[1];
      continue;
    }

    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("|")) continue;

    if (!current) {
      const tagLine = TAG_LINE_RE.exec(rawLine);
      if (tagLine) {
        for (const tag of tagLine[1].split(/[ \t]+/)) {
          if (tag.startsWith("@")) pendingTags.push({ tag: tag.slice(1), line: i + 1 });
        }
        continue;
      }
    }

    const featureMatch = /^[ ]*Feature:[ \t]*(.*)$/u.exec(rawLine);
    if (featureMatch) {
      featureName = featureMatch[1].trim();
      // Gherkin semantics: feature-level tags are inherited by every scenario.
      featureTags = pendingTags;
      pendingTags = [];
      continue;
    }

    if (/^[ ]*(Background|Rule):/u.test(rawLine)) {
      flushScenario();
      pendingTags = [];
      continue;
    }

    const outlineMatch = /^[ ]*Scenario Outline:[ \t]*(.*)$/u.exec(rawLine);
    const plainScenarioMatch =
      outlineMatch === null ? /^[ ]*Scenario:[ \t]*(.*)$/u.exec(rawLine) : null;

    if (outlineMatch || plainScenarioMatch) {
      flushScenario();
      current = {
        name: bound((outlineMatch ?? plainScenarioMatch)[1].trim(), 512),
        keyword: outlineMatch ? "Scenario Outline" : "Scenario",
        nameSpan: spanForLine(positions, text, i),
        tags: [...featureTags, ...pendingTags],
        steps: [],
        examples: [],
        refs: [],
        descriptionLines: [],
      };
      pendingTags = [];
      inExamples = false;
      continue;
    }

    if (current === null) continue;

    if (EXAMPLES_RE.test(rawLine)) {
      inExamples = true;
      examplesCurrent = null;
      continue;
    }

    if (!inExamples) {
      const step = STEP_RE.exec(trimmed);
      if (step) {
        current.steps.push({ keyword: step[1], text: bound(step[2].trim(), 1024) });
        continue;
      }
    } else if (trimmed.startsWith("|")) {
      const cells = splitTableRow(trimmed);
      if (!examplesCurrent) {
        examplesCurrent = { headers: cells.map((cell) => cell.text), rows: [] };
        current.examples.push(examplesCurrent);
      } else if (examplesCurrent.rows.length < 10000) {
        examplesCurrent.rows.push(cells.map((cell) => cell.text));
      }
      continue;
    }

    // Scenario description prose; structured `Refs:` lines create references.
    const refsField = /^(?:\*\*)?\s*Refs\s*(?:\*\*)?\s*:[ \t]*(.*)$/u.exec(trimmed);
    if (refsField) {
      for (const token of refsField[1].split(/[\s,]+/u)) {
        if (token !== "") {
          current.refs.push({
            rawTarget: token,
            requestedEdgeType: "REFS",
            span: spanForLine(positions, text, i),
          });
        }
      }
      continue;
    }
    if (/^@/.test(trimmed)) {
      // Mid-scenario tag lines attach to the next scenario.
      for (const tag of trimmed.split(/[ \t]+/)) {
        if (tag.startsWith("@")) pendingTags.push({ tag: tag.slice(1), line: i + 1 });
      }
      continue;
    }
    if (!inExamples && malformedReported < 20 && /^[A-Za-zÀ-ÿ]+[ \t]*:/u.test(trimmed)) {
      malformedReported += 1;
      diagnostics.push({
        code: "MALFORMED_GHERKIN",
        message: `unrecognized Gherkin block "${bound(trimmed, 96)}"`,
        span: spanForLine(positions, text, i),
      });
    }
    current.descriptionLines.push(trimmed);
  }
  flushScenario();

  return { positions, diagnostics, scenarios };
}

const QUALIFIED_TAG_RE =
  /^([a-z0-9]+(?:-[a-z0-9]+)*):([A-Za-z][A-Za-z0-9.-]*)$/u;

function finalizeScenario(scenario, specSlug, featureName, positions, text) {
  scenario.specSlug = specSlug;
  scenario.featureName = featureName;
  const idTags = scenario.tags.filter((entry) => entry.tag.startsWith("id:"));
  if (idTags.length === 0) {
    scenario.rejected = true;
    scenario.rejectionCode = "MISSING_SCENARIO_ID";
    scenario.localId = null;
  } else if (idTags.length > 1) {
    scenario.rejected = true;
    scenario.rejectionCode = "DUPLICATE_SCENARIO_ID_TAG";
    scenario.localId = null;
  } else {
    const candidate = idTags[0].tag.slice("id:".length);
    if (!SCEN_ID_RE.test(candidate)) {
      scenario.rejected = true;
      scenario.rejectionCode = "MISSING_SCENARIO_ID";
      scenario.localId = null;
    } else {
      scenario.rejected = false;
      scenario.localId = candidate;
    }
  }

  // Tag-derived trace references with full spans.
  scenario.traceRefs = [];
  for (const entry of scenario.tags) {
    if (entry.tag.startsWith("id:")) continue;
    const featureRef = /^feature([1-9][0-9]*)$/u.exec(entry.tag);
    if (featureRef) {
      scenario.traceRefs.push({
        rawTarget: `FR-${featureRef[1]}`,
        requestedEdgeType: "TESTED_BY",
        span: spanForLine(positions, text, entry.line - 1),
      });
      continue;
    }
    if (acTagRef(entry.tag)) {
      scenario.traceRefs.push({
        rawTarget: entry.tag,
        requestedEdgeType: "TESTED_BY",
        span: spanForLine(positions, text, entry.line - 1),
      });
      continue;
    }
    const qualified = QUALIFIED_TAG_RE.exec(entry.tag);
    if (qualified && localIdShaped(qualified[2])) {
      scenario.traceRefs.push({
        rawTarget: entry.tag,
        requestedEdgeType: "REFS",
        span: spanForLine(positions, text, entry.line - 1),
      });
    }
  }
}

import { localIdKind } from "../identity.js";

function acTagRef(tag) {
  return /^AC-[1-9][0-9]*\.[1-9][0-9]*$/u.test(tag);
}

function localIdShaped(localPart) {
  return (
    localIdKind(localPart) !== null ||
    localPart.startsWith("DOC:") ||
    localPart.startsWith("FILE:")
  );
}
