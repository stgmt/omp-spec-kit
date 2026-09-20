// Shared English Gherkin syntax recognition used by the kernel and authoring gates.

const GHERKIN_SCENARIO_HEADER_RE = /^[ \t]*(Scenario Outline|Scenario Template|Example|Scenario):[ \t]*(.*)$/u;
const GHERKIN_TAG_LINE_RE = /^[ \t]*((?:@[^\s@][^\s]*[ \t]*)+)$/u;
const GHERKIN_EXAMPLES_RE = /^[ \t]*Examples[ \t]*(?::.*)?$/u;
const GHERKIN_DOCSTRING_RE = /^[ \t]*("""|\x60{3})/u;

export {
  GHERKIN_DOCSTRING_RE,
  GHERKIN_EXAMPLES_RE,
  GHERKIN_SCENARIO_HEADER_RE,
  GHERKIN_TAG_LINE_RE,
};

export function getGherkinDocstringMarker(line) {
  const match = GHERKIN_DOCSTRING_RE.exec(line);
  if (match === null || line.trimStart().startsWith("#")) return null;
  return match[1];
}

export function hasGherkinScenarioHeader(text) {
  let docstringMarker = null;
  for (const line of text.split("\n")) {
    if (docstringMarker !== null) {
      if (line.trimStart().startsWith(docstringMarker)) docstringMarker = null;
      continue;
    }
    const marker = getGherkinDocstringMarker(line);
    if (marker !== null) {
      docstringMarker = marker;
      continue;
    }
    if (GHERKIN_SCENARIO_HEADER_RE.test(line)) return true;
  }
  return false;
}
