import { AstBuilder, compile, GherkinClassicTokenMatcher, IdGenerator, Parser } from "../vendor/gherkin.js";
import { canonicalJson, sha256Bytes } from "../normalize.js";
import { criterionParent, isValidSpecSlug, localIdKind } from "../identity.js";
import { canonicalDocumentKind } from "../types.js";
import { Positions } from "./markdown.js";

const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const scenarioIdPattern = /^SCEN-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const scenarioRefPattern = /^(SCEN-[a-z0-9]+(?:-[a-z0-9]+)*)(?:#([a-z0-9]+(?:-[a-z0-9]+)*))?$/u;
const ruleTag = /^@(?:story:|case:|contract$)/u;

export function parseFeature(text, path = "") {
  const ids = IdGenerator.incrementing();
  const ast = new Parser(new AstBuilder(ids), new GherkinClassicTokenMatcher()).parse(text);
  ast.uri = path;
  return { ast, ids };
}

export function missingScenarioSteps(scenario) {
  const types = new Set(scenario.steps.map((step) => step.keywordType));
  return [["Context", "Given"], ["Action", "When"], ["Outcome", "Then"]]
    .filter(([type]) => !types.has(type)).map(([, name]) => name);
}

function sourceLocations(text) {
  const positions = new Positions(text);
  const offsets = [0];
  for (let index = text.indexOf("\n"); index >= 0; index = text.indexOf("\n", index + 1)) {
    offsets.push(index + 1);
  }
  const offset = (line) => offsets[line - 1] ?? text.length;
  function span(line, endLine = line) {
    const start = positions.positionOf(offset(line));
    const end = positions.positionOf(offset(endLine + 1));
    return {
      startLine: start.line, startColumn: start.column, startOffset: start.startOffset,
      endLine: end.line, endColumn: end.column, endOffset: end.startOffset,
    };
  }
  return { positions, offset, span, lines: text.split(/\r?\n/u) };
}

function lastLine(node, lines) {
  if (!node) return 0;
  let last = (node.location?.line ?? 0) + (node.description ? node.description.split("\n").length : 0);
  if (node.delimiter) {
    for (let index = last; index < lines.length; index += 1) {
      if (lines[index].trimStart().startsWith(node.delimiter)) return index + 1;
    }
  }
  for (const field of ["steps", "examples", "tableBody", "rows"]) {
    for (const child of node[field] ?? []) last = Math.max(last, lastLine(child, lines));
  }
  for (const field of ["docString", "dataTable", "tableHeader", "background", "scenario"]) {
    if (node[field]) last = Math.max(last, lastLine(node[field], lines));
  }
  for (const child of node.children ?? []) {
    last = Math.max(last, lastLine(child.background ?? child.scenario, lines));
  }
  return last;
}

function sourceRange(node, source) {
  const start = Math.min(node.location.line, ...(node.tags ?? []).map((tag) => tag.location.line));
  return source.span(start, lastLine(node, source.lines));
}

const storyFields = { Actor: "actor", Goal: "goal", Benefit: "benefit", "Independent Test": "independentTest" };
const caseFields = {
  Actor: "actor", Boundary: "boundary", Trigger: "trigger", Precondition: "precondition", Success: "success",
};

function parseRuleDescription(rule, isCase, issue) {
  const expected = isCase ? caseFields : storyFields;
  const fields = {};
  const outcomes = {};
  const steps = {};
  const refs = {};
  let directRefs = null;
  let covers = null;
  const malformed = (message) => issue(rule.location.line, message);
  for (const line of rule.description.split("\n").map((line) => line.trim()).filter(Boolean)) {
    const separator = line.indexOf(":");
    const name = line.slice(0, separator);
    const value = line.slice(separator + 1).trim();
    if (separator >= 0 && name === "Context") break;
    if (separator >= 0 && name === "Refs") {
      const targets = value.split(/[\s,]+/u).filter(Boolean);
      if (directRefs !== null || targets.length === 0 || new Set(targets).size !== targets.length) {
        malformed(`Rule ${rule.name} requires one nonempty Refs list without duplicates`);
      } else directRefs = targets;
      continue;
    }
    if (separator >= 0 && name === "Covers") {
      const targets = value.split(",").map((target) => target.trim());
      if (covers !== null || new Set(targets).size !== targets.length ||
          targets.some((target) => !["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT"].includes(localIdKind(target)))) {
        malformed(`Rule ${rule.name} requires a list of local FR/NFR identifiers in Covers`);
      } else covers = targets;
      continue;
    }
    if (separator >= 0 && Object.hasOwn(expected, name)) {
      const key = expected[name];
      if (!value || Object.hasOwn(fields, key)) malformed(`Rule ${rule.name} requires exactly one nonempty ${name} field`);
      else fields[key] = value;
      continue;
    }
    const parts = value.split(" | ");
    const [id, ...values] = parts;
    const declaration = name === "ScenarioRef" ? [refs, 1]
      : isCase && name === "Step" ? [steps, 1]
      : isCase && name === "Branch" ? [outcomes, 4]
      : !isCase && name === "Outcome" ? [outcomes, 1]
      : null;
    if (separator < 0 || !declaration || !keyPattern.test(id) ||
        values.length !== declaration[1] || values.some((part) => part.trim() !== part || part === "" || part.includes(" | ")) ||
        Object.hasOwn(declaration[0], id) || id === "constructor") {
      malformed(`invalid or duplicate structured field on Rule ${rule.name}: ${line.slice(0, 120)}`);
      continue;
    }
    declaration[0][id] = name === "ScenarioRef" ? values[0] : values;
  }
  for (const [name, key] of Object.entries(expected)) {
    if (name === "Independent Test") continue;
    if (!Object.hasOwn(fields, key)) malformed(`Rule ${rule.name} is missing ${name}`);
  }
  for (const [id, ref] of Object.entries(refs)) {
    if (!Object.hasOwn(outcomes, id) || !scenarioRefPattern.test(ref)) malformed(`Rule ${rule.name} has an invalid ScenarioRef for ${id}`);
  }
  if (isCase && Object.keys(steps).length === 0) malformed(`Rule ${rule.name} needs a Step`);
  if (isCase) for (const [id, [decision, , , exit]] of Object.entries(outcomes)) {
    if (!Object.hasOwn(steps, decision) || (exit !== "end" && !Object.hasOwn(steps, exit))) {
      malformed(`Branch ${id} of ${rule.name} names an undefined step`);
    }
  }
  return { ...fields, outcomes, steps, refs, directRefs: directRefs ?? [], covers: covers ?? [] };
}

function referenceTags(tags, locations) {
  const result = [];
  const traceKinds = new Set(["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT", "ACCEPTANCE_CRITERION"]);
  for (const { name, location } of tags) {
    if (name.startsWith("@id:")) continue;
    const feature = /^@feature([1-9][0-9]*)$/u.exec(name);
    const qualifiedTrace = /^@ref:([a-z0-9]+(?:-[a-z0-9]+)*):([A-Za-z][A-Za-z0-9.-]*)$/u.exec(name);
    const tag = name.slice(1);
    const qualified = /^([a-z0-9]+(?:-[a-z0-9]+)*):([A-Za-z][A-Za-z0-9.-]*)$/u.exec(tag);
    if (qualifiedTrace && isValidSpecSlug(qualifiedTrace[1]) && traceKinds.has(localIdKind(qualifiedTrace[2]))) {
      result.push({
        rawTarget: `${qualifiedTrace[1]}:${qualifiedTrace[2]}`,
        requestedEdgeType: "TESTED_BY",
        span: locations.span(location.line),
      });
    } else if (feature || criterionParent(tag) !== null) {
      result.push({ rawTarget: feature ? `FR-${feature[1]}` : tag, requestedEdgeType: "TESTED_BY", span: locations.span(location.line) });
    } else if (!ruleTag.test(name) && qualified && localIdKind(qualified[2]) !== null) {
      result.push({ rawTarget: tag, requestedEdgeType: "REFS", span: locations.span(location.line) });
    }
  }
  return result;
}

export function parseGherkinDocument({ path, specSlug, text }) {
  const source = sourceLocations(text);
  const diagnostics = [];
  const result = { positions: source.positions, diagnostics, scenarios: [], rules: [] };
  const issue = (line, message, code = "MALFORMED_GHERKIN") => {
    if (diagnostics.length < 30) diagnostics.push({ code, message: message.slice(0, 512), specSlug, span: source.span(line ?? 1) });
  };
  let parsed;
  try {
    parsed = parseFeature(text, path);
  } catch (error) {
    for (const item of error.errors ?? [error]) issue(item.location?.line, item.message);
    return result;
  }
  const feature = parsed.ast.feature;
  if (!feature) {
    issue(1, "expected one Feature");
    return result;
  }
  if (feature.language !== "en") {
    issue(feature.location.line, "use English Gherkin keywords", "UNSUPPORTED_GHERKIN_DIALECT");
    return result;
  }
  const enforce = canonicalDocumentKind(path.split("/").at(-1), specSlug);
  const rows = new Map();
  const scenariosByAstId = new Map();
  let compilationSteps = 0;
  let compilationBytes = 0;
  const declaredTags = (node) => node.tags ?? [];
  const misplaced = (tags) => tags.find(({ name }) => ruleTag.test(name) || name.startsWith("@id:") || name === "@spec-ready");
  const invalidFeatureTag = misplaced(feature.tags);
  if (invalidFeatureTag) issue(invalidFeatureTag.location.line, `${invalidFeatureTag.name} cannot be declared on Feature`);
  const featureBackground = feature.children.find((child) => child.background)?.background;
  for (const child of feature.children) {
    if (child.background) continue;
    if (!child.rule) {
      issue(child.scenario.location.line, "scenarios belong to a story, use case or contract Rule");
      continue;
    }
    const { rule } = child;
    const stories = rule.tags.filter(({ name }) => name.startsWith("@story:"));
    const cases = rule.tags.filter(({ name }) => name.startsWith("@case:"));
    const contracts = rule.tags.filter(({ name }) => name === "@contract");
    const story = stories[0]?.name.slice(7) ?? null;
    const useCase = cases[0]?.name.slice(6) ?? null;
    const isCase = enforce === "USE_CASES";
    const isContract = !isCase && contracts.length === 1 && stories.length === 0 && cases.length === 0;
    const validStory = stories.length === 1 && /^US-[1-9]\d*$/u.test(story);
    const valid = isContract || (validStory && contracts.length === 0 &&
      (isCase ? cases.length === 1 && /^UC-[1-9]\d*$/u.test(useCase) : cases.length === 0));
    if (!valid || rule.tags.some(({ name }) => name === "@spec-ready" || name.startsWith("@id:"))) {
      issue(rule.location.line, isCase ? "use case Rule requires direct @case:UC-N and @story:US-N tags" : "story Rule requires @story:US-N or @contract");
      continue;
    }
    const localId = isCase ? useCase : story;
    const fields = isContract ? null : parseRuleDescription(rule, isCase, issue);
    const ownScenarios = rule.children.filter((item) => item.scenario).map((item) => item.scenario);
    if (!isCase && ownScenarios.length === 0) issue(rule.location.line, "story or contract Rule needs its own scenario");
    if (fields) result.rules.push({
      localId, kind: isCase ? "USE_CASE" : "USER_STORY", name: rule.name, body: rule.description,
      span: sourceRange(rule, source), attributes: { ...fields, storyId: story },
    });
    const background = rule.children.find((item) => item.background)?.background;
    for (const scenario of ownScenarios) {
      const line = scenario.location.line;
      const idTags = scenario.tags.filter(({ name }) => name.startsWith("@id:"));
      const scenarioId = idTags[0]?.name.slice(4);
      if (idTags.length !== 1 || !scenarioIdPattern.test(scenarioId ?? "")) {
        issue(line, "declare exactly one @id:SCEN-<slug> on the scenario", idTags.length > 1 ? "DUPLICATE_SCENARIO_ID_TAG" : "MISSING_SCENARIO_ID");
        continue;
      }
      if (scenario.tags.some(({ name }) => ruleTag.test(name))) issue(line, "story, case and contract tags belong to Rule");
      const missing = missingScenarioSteps(scenario);
      if (missing.length) issue(line, `${scenarioId} needs explicit ${missing.join("/")}`);
      const tags = [...feature.tags, ...rule.tags, ...scenario.tags];
      const traceRefs = referenceTags(tags, source);
      const ready = scenario.tags.some(({ name }) => name === "@spec-ready");
      if ((ready || isContract) && !traceRefs.some(({ requestedEdgeType }) => requestedEdgeType === "TESTED_BY")) {
        issue(line, `${scenarioId} requires an FR or AC trace tag`);
      }
      const examples = [];
      const exampleIds = new Set();
      let substitutions = 0;
      for (const example of scenario.examples) {
        const tag = misplaced(declaredTags(example));
        if (tag) issue(tag.location.line, `${tag.name} cannot be declared on Examples`);
        const headers = example.tableHeader?.cells.map(({ value }) => value) ?? [];
        const idIndex = headers.indexOf("example_id");
        if (idIndex < 0 || headers.lastIndexOf("example_id") !== idIndex || !example.tableBody.length) {
          issue(example.location.line, `${scenarioId} needs an Examples table with an example_id column and rows`);
        }
        const table = [];
        for (const row of example.tableBody) {
          const values = row.cells.map(({ value }) => value);
          substitutions += values.reduce((bytes, value) => bytes + Buffer.byteLength(value), 0);
          const id = values[idIndex] ?? "";
          if (!keyPattern.test(id) || exampleIds.has(id)) issue(row.location.line, `invalid or duplicate example_id for ${scenarioId}`);
          exampleIds.add(id);
          rows.set(row.id, id);
          table.push(values);
        }
        examples.push({ headers, rows: table });
      }
      if (["Scenario Outline", "Scenario Template"].includes(scenario.keyword) && exampleIds.size === 0) {
        issue(line, `${scenarioId} needs Examples`);
      }
      const refs = scenarioReferences(scenario.description).map((rawTarget) => ({
        rawTarget, requestedEdgeType: "REFS", span: source.span(line),
      }));
      const entry = {
        localId: scenarioId, name: scenario.name, keyword: scenario.keyword, featureName: feature.name,
        nameSpan: sourceRange(scenario, source), steps: scenario.steps.map(({ keyword, text }) => ({ keyword: keyword.trim(), text })),
        tags: tags.map((tag) => ({ tag: tag.name.slice(1), line: tag.location.line })),
        traceRefs, refs, storyId: story, caseId: useCase, contract: isContract, ready, examples, pickles: [],
      };
      compilationSteps += Math.max(1, exampleIds.size) *
        (scenario.steps.length + (featureBackground?.steps.length ?? 0) + (background?.steps.length ?? 0));
      const staticSteps = [...(featureBackground?.steps ?? []), ...(background?.steps ?? []), ...scenario.steps]
        .map(({ text, docString, dataTable }) => [text, docString?.content, dataTable?.rows.map((row) => row.cells.map(({ value }) => value))]);
      const stepText = JSON.stringify(staticSteps);
      const placeholders = (stepText.match(/<[^<>]+>/gu) ?? []).length;
      compilationBytes += Buffer.byteLength(stepText) * Math.max(1, exampleIds.size) + placeholders * substitutions;
      scenariosByAstId.set(scenario.id, entry);
      result.scenarios.push(entry);
    }
  }
  if (compilationSteps > 100_000 || compilationBytes > 16 * 1024 * 1024) {
    issue(feature.location.line, "expanded Gherkin examples exceed the step or byte budget");
  }
  if (diagnostics.length) return result;
  for (const pickle of compile(parsed.ast, path, parsed.ids)) {
    const scenario = scenariosByAstId.get(pickle.astNodeIds[0]);
    if (!scenario) continue;
    const rowId = rows.get(pickle.astNodeIds[1]) ?? null;
    const steps = pickle.steps.map(({ text, type, argument }) => ({ text, type, argument: argument ?? null }));
    const sha256 = sha256Bytes(Buffer.from(canonicalJson(steps), "utf8"));
    scenario.pickles.push({ rowId, sha256 });
  }
  return result;
}

export function scenarioReferences(description = "") {
  const references = [];
  for (const match of description.matchAll(/^\s*Refs:[ \t]*([^\n]+)/gmu)) {
    references.push(...match[1].trim().split(/[\s,]+/u));
  }
  return references;
}

export function gherkinPairFindings(stories, cases) {
  const documents = [stories, cases].filter(Boolean);
  const scenarios = documents.flatMap((doc) => doc.scenarios);
  const knownStories = new Set((stories?.rules ?? []).map(({ localId }) => localId));
  const findings = [];
  const definitions = new Set();
  for (const doc of documents) {
    const entries = [...doc.rules.map((rule) => ({ localId: rule.localId, span: rule.span })),
      ...doc.scenarios.map((scenario) => ({ localId: scenario.localId, span: scenario.nameSpan }))];
    for (const { localId, span } of entries) {
      if (definitions.has(localId)) findings.push({ code: "MALFORMED_GHERKIN", span, document: doc, message: `duplicate Gherkin ID ${localId} in the specification` });
      definitions.add(localId);
    }
  }
  for (const doc of documents) for (const rule of doc.rules) {
    const { storyId, refs } = rule.attributes;
    const fail = (message) => findings.push({ code: "MALFORMED_GHERKIN", span: rule.span, message, rule: rule.localId, document: doc });
    if (rule.kind === "USE_CASE" && !knownStories.has(storyId)) fail(`${rule.localId} must reference an existing story in this specification: ${storyId}`);
    for (const ref of Object.values(refs)) {
      const match = scenarioRefPattern.exec(ref);
      if (!match) continue;
      const [, scenarioId, rowId] = match;
      const candidates = scenarios.filter((entry) => entry.localId === scenarioId);
      const candidate = candidates[0];
      if (candidates.length !== 1 || candidate.storyId !== storyId ||
          (rule.kind === "USE_CASE" && candidate.caseId !== null && candidate.caseId !== rule.localId) ||
          !candidate.pickles.some((pickle) => pickle.rowId === (rowId ?? null))) {
        fail(`${rule.localId} has an unresolved or out-of-scope ScenarioRef: ${ref}`);
      }
    }
  }
  return findings;
}
