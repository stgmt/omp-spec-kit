import { canonicalDocumentFilename } from "../kernel/types.js";
import { isValidSpecSlug, localIdKind, splitCanonicalId } from "../kernel/identity.js";
import { parseFeature, parseGherkinDocument, scenarioReferences } from "../kernel/parsers/gherkin.js";
import { matchDefinitionHeading, parseMarkdownDocument, resolveDestination } from "../kernel/parsers/markdown.js";
import { scanBlocks } from "../kernel/parsers/md-blocks.js";
import { renderInline } from "../kernel/parsers/md-inline.js";
import { parseFields } from "../kernel/parsers/attributes.js";
import MarkdownIt from "../kernel/vendor/markdown-it.js";
import { compile } from "../kernel/vendor/gherkin.js";
import { canonicalJson, sha256 } from "./transactions.js";

const MAX_MAPPING_ENTRIES = 10000;
const MAX_REPAIR_BYTES = 65536;

function lines(text) {
  return text.split(/\r\n|\n|\r/u);
}

function sourceLines(text) {
  return text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}

// Repairs are an explicit owner decision about exact step lines, never an
// alternate parser or a write to the old document. All other bytes remain as-is.
function prepareRepairs(spec, sources, repairs) {
  if (!Array.isArray(repairs) || repairs.length > 32) throw new Error("repairs must be a bounded array");
  const groups = new Map();
  let budget = 0;
  const allowed = new Set([`${spec}.feature`, canonicalDocumentFilename("USER_STORIES", spec), canonicalDocumentFilename("USE_CASES", spec)]);
  for (const item of repairs) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !allowed.has(item.sourceDocument) ||
        !/^SCEN-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item.scenarioId ?? "") ||
        !Number.isSafeInteger(item.sourceStartLine) || !Number.isSafeInteger(item.sourceEndLine) ||
        item.sourceStartLine < 1 || item.sourceEndLine < item.sourceStartLine ||
        !/^[0-9a-f]{64}$/u.test(item.sourceSha256 ?? "") || !/^[0-9a-f]{64}$/u.test(item.beforeSha256 ?? "") ||
        !/^[0-9a-f]{64}$/u.test(item.afterSha256 ?? "") || typeof item.replacement !== "string" ||
        typeof item.reason !== "string" || !item.reason.trim() || Buffer.byteLength(item.reason, "utf8") > 512) {
      throw new Error("invalid migration repair");
    }
    budget += Buffer.byteLength(item.replacement, "utf8");
    if (budget > MAX_REPAIR_BYTES) throw new Error("migration repairs exceed the byte budget");
    const source = sources.find((candidate) => candidate.document === item.sourceDocument);
    if (!source || source.sha256 !== item.sourceSha256) throw new Error("repair source or snapshot hash does not match");
    const group = groups.get(item.sourceDocument) ?? [];
    group.push({ ...item });
    groups.set(item.sourceDocument, group);
  }
  const prepared = new Map();
  const summary = [];
  const step = /^\s*(?:Given|When|Then|And|But|Or)\s+\S.*$/u;
  for (const [document, edits] of groups) {
    const source = sources.find((candidate) => candidate.document === document);
    const original = sourceLines(source.text);
    const projection = new Map();
    const changed = new Set();
    const output = [];
    edits.sort((a, b) => a.sourceStartLine - b.sourceStartLine || a.sourceEndLine - b.sourceEndLine);
    let previousEnd = 0;
    for (const edit of edits) {
      if (edit.sourceStartLine <= previousEnd || edit.sourceEndLine > original.length) throw new Error("repair ranges overlap or are outside the source");
      previousEnd = edit.sourceEndLine;
      const before = original.slice(edit.sourceStartLine - 1, edit.sourceEndLine).join("");
      const after = edit.replacement;
      if (sha256(Buffer.from(before, "utf8")) !== edit.beforeSha256 || sha256(Buffer.from(after, "utf8")) !== edit.afterSha256) {
        throw new Error("repair before/after hashes do not match exact bytes");
      }
      const originalSteps = sourceLines(before);
      const replacementSteps = sourceLines(after);
      if (!originalSteps.length || !replacementSteps.length ||
          !originalSteps.every((line) => step.test(line.replace(/\r?\n$/u, ""))) ||
          !replacementSteps.every((line) => step.test(line.replace(/\r?\n$/u, ""))) ||
          before.endsWith("\n") !== after.endsWith("\n")) {
        throw new Error("repair may replace only complete scenario step lines and must preserve the boundary newline");
      }
      summary.push({ ...edit, before, after });
    }
    let editIndex = 0;
    for (let line = 1; line <= original.length;) {
      const edit = edits[editIndex];
      if (!edit || edit.sourceStartLine !== line) {
        projection.set(line, { start: output.length + 1, end: output.length + 1 });
        output.push(original[line - 1]);
        line++;
        continue;
      }
      const replacement = sourceLines(edit.replacement);
      const start = output.length + 1;
      output.push(...replacement);
      for (let old = edit.sourceStartLine; old <= edit.sourceEndLine; old++) {
        projection.set(old, { start, end: output.length });
        changed.add(old);
      }
      edit.newStartLine = start;
      edit.newEndLine = output.length;
      line = edit.sourceEndLine + 1;
      editIndex++;
    }
    prepared.set(document, { text: output.join(""), projection, changed, edits });
  }
  return { prepared, summary };
}

function identifiers(text) {
  // Rendering an entire Markdown line drops link destinations and other
  // meaningful characters. Reuse the inline renderer only for a recognised
  // bold field label; keep every other punctuation, currency and URL scalar.
  const visible = lines(text).map((line) => line
    .replace(/^\s*#{1,6}\s+/u, "")
    .replace(/^\s*[-*+]\s+(?=\D)/u, "")
    .replace(/\*\*((?:Actor|Goal|Benefit|Story|Refs|Related|Covers|Requirements|Implements|Depends On|Preconditions|Precondition|Flow|Alternative|Postcondition|Boundary|Trigger|Success):)\*\*/gu,
      (label) => renderInline(label))
    .replace(/^(\s*)Feature\s*:/iu, "$1feature")
    .replace(/(\bContext:\s*)Feature(?=\s)/iu, "$1feature")
    .replace(/(\bContext:\s*)(Actor|Goal|Benefit|Story|Refs|Related|Covers|Requirements|Implements|Depends On|Preconditions|Precondition|Flow|Alternative|Postcondition|Boundary|Trigger|Success)\s*:/iu, (_, lead, label) => `${lead}${label.toLowerCase()}:`)
    .replace(/^(\s*)(Actor|Goal|Benefit|Story|Refs|Related|Covers|Requirements|Implements|Depends On|Preconditions|Precondition|Flow|Alternative|Postcondition|Boundary|Trigger|Success)\s*:/iu, (_, lead, label) => `${lead}${label.toLowerCase()}:`)
    .replace(/@(story|case|id):/giu, (_, label) => `@${label.toLowerCase()}:`))
    .join("\n");
  return visible.normalize("NFC").match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
}

function containsSourceLines(source, target, used = new Set(), tokenOffset = 0) {
  const targetTokens = identifiers(target);
  for (const sourceLine of lines(source)) {
    // A Markdown entity heading is represented by a direct Gherkin tag and a
    // Rule name, with other tags possibly between them. Identity is checked
    // against the corresponding Rule separately below.
    const heading = /^\s*#{1,6}\s+(?:US|UC)-[1-9]\d*(?:\s*[—:]\s*)(.+?)\s*$/u.exec(sourceLine);
    const tokens = identifiers(heading ? heading[1] : sourceLine);
    if (!tokens.length) continue;
    let found = false;
    for (let start = 0; start + tokens.length <= targetTokens.length; start++) {
      if (tokens.some((_, offset) => used.has(tokenOffset + start + offset))) continue;
      if (tokens.every((token, offset) => targetTokens[start + offset] === token)) {
        for (let offset = 0; offset < tokens.length; offset++) used.add(tokenOffset + start + offset);
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

function startLine(node) {
  return Math.min(node.location.line, ...(node.tags ?? []).map((tag) => tag.location.line));
}

function inspectFeature(text, document) {
  const { ast, ids } = parseFeature(text, document);
  if (!ast.feature) throw new Error(`${document} must contain a Feature`);
  const feature = ast.feature;
  const scenarios = new Map();
  const rules = new Map();
  const children = feature.children;
  const markers = [lines(text).length + 1];
  for (const child of children) {
    const node = child.rule ?? child.scenario ?? child.background;
    if (node) markers.push(startLine(node));
    for (const nested of child.rule?.children ?? []) {
      const nestedNode = nested.scenario ?? nested.background;
      if (nestedNode) markers.push(startLine(nestedNode));
    }
  }
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (!child.rule) continue;
    const rule = child.rule;
    const start = startLine(rule);
    const end = index + 1 < children.length ? startLine(children[index + 1].rule ?? children[index + 1].scenario ?? children[index + 1].background) - 1 : lines(text).length;
    const identity = rule.tags.find(({ name }) => /^@case:UC-\d+$/u.test(name)) ??
      rule.tags.find(({ name }) => /^@story:US-\d+$/u.test(name));
    if (identity) {
      const id = identity.name.slice(identity.name.indexOf(":") + 1);
      if (rules.has(id)) throw new Error(`duplicate ${id} in ${document}`);
      const linkedStory = rule.tags.find(({ name }) => /^@story:US-\d+$/u.test(name));
      // Refs has the same authored syntax as on scenarios. Text after Context
      // is prose and must never create implicit graph edges.
      const descriptions = rule.description.split("\n");
      const context = descriptions.findIndex((line) => /^\s*Context\s*:/u.test(line));
      const directRefs = scenarioReferences((context < 0 ? descriptions : descriptions.slice(0, context)).join("\n"));
      rules.set(id, { start, end, storyId: linkedStory?.name.slice(7) ?? null, directRefs });
    }
  }
  const nodes = children.flatMap((child) => child.rule ? child.rule.children : [child]);
  for (let index = 0; index < nodes.length; index++) {
    const scenario = nodes[index].scenario;
    if (!scenario) continue;
    const tags = scenario.tags.filter(({ name }) => name.startsWith("@id:"));
    if (tags.length !== 1 || !/^@id:SCEN-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tags[0]?.name ?? "")) {
      throw new Error(`scenario at ${document}:${scenario.location.line} needs one stable @id:SCEN-*`);
    }
    const id = tags[0].name.slice(4);
    if (scenarios.has(id)) throw new Error(`duplicate ${id} in ${document}`);
    const start = startLine(scenario);
    const entry = {
      id,
      start,
      end: Math.min(...markers.filter((line) => line > start)) - 1,
      name: scenario.name,
      refs: scenarioReferences(scenario.description).sort(),
      tables: scenario.examples.map((example) => ({
        headers: example.tableHeader?.cells.map(({ value }) => value) ?? [],
        rows: example.tableBody.map((row) => row.cells.map(({ value }) => value)),
      })),
      pickles: [],
    };
    scenarios.set(id, entry);
  }
  const byAstId = new Map();
  for (const child of nodes) {
    const node = child.scenario;
    if (node) byAstId.set(node.id, scenarios.get(node.tags.find(({ name }) => name.startsWith("@id:"))?.name.slice(4)));
  }
  for (const pickle of compile(ast, document, ids)) {
    const entry = byAstId.get(pickle.astNodeIds[0]);
    if (!entry) continue;
    entry.pickles.push({
      steps: pickle.steps.map(({ type, text, argument }) => ({ type, text, argument: argument ?? null })),
      tags: pickle.tags.map(({ name }) => name).filter((name) => !/^@(?:story:|case:|contract$|spec-ready$)/u.test(name)).sort(),
    });
  }
  return { scenarios, rules };
}

function inspectMarkdown(text, document, role) {
  const parsed = parseMarkdownDocument({ path: document, documentKind: role === "USER_STORY" ? "USER_STORIES" : "USE_CASES", text });
  const { topLevelHeadings } = markdownEvidenceContext(text);
  const headings = parsed.headings.filter((heading) => topLevelHeadings.has(heading.span.startLine));
  const sections = [];
  for (const heading of headings) {
    const match = matchDefinitionHeading(role, heading.level, heading.rawText.trim());
    if (!match) continue;
    if (match.status !== "definition") throw new Error(`cannot safely migrate ${document}:${heading.span.startLine}: ${match.message}`);
    // The legacy scanner also sees headings inside Markdown containers. Only
    // an AST-proven top-level heading can end this section or define an entity.
    const next = headings.find((candidate) => candidate.span.startOffset > heading.span.startOffset && candidate.level <= heading.level);
    const end = next ? next.span.startLine - 1 : lines(text).length;
    sections.push({ id: match.localId, start: heading.span.startLine, end: Math.max(heading.span.startLine, end) });
  }
  return { sections, fieldReferences: parsed.fieldReferences, links: parsed.links };
}

const evidenceMarkdown = new MarkdownIt({ html: true });
const LIST_PREFIX = /^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+/u;

// `map` reports zero-based source lines with an exclusive end. Only top-level
// paragraphs and one-line, direct list fields provide authoring evidence.
// Blocks nested in quotations, lists, tables, code or HTML remain readable but
// cannot silently become requirements. An inline HTML node excludes its entire
// paragraph: markdown-it supplies a line map for the parent, not the node.
function markdownEvidenceContext(text) {
  const blocks = scanBlocks(text);
  const excluded = new Array(blocks.lines.length).fill(true);
  const topLevelHeadings = new Set();
  const stack = [];
  for (const token of evidenceMarkdown.parse(text, {})) {
    if (token.nesting === -1) {
      stack.pop();
      continue;
    }
    if (token.type === "heading_open" && stack.length === 0 && Array.isArray(token.map)) {
      topLevelHeadings.add(token.map[0] + 1);
    }
    const hasInlineHtml = token.children?.some((child) => child.type === "html_inline");
    if (token.type === "inline" && hasInlineHtml && stack.length === 1 && stack[0].type === "heading_open") {
      topLevelHeadings.delete(stack[0].map[0] + 1);
    }
    if (token.type === "inline" && Array.isArray(token.map) && !hasInlineHtml) {
      const topLevel = stack.length === 1 && stack[0].type === "paragraph_open";
      const directList = stack.length === 3 &&
        ["bullet_list_open", "ordered_list_open"].includes(stack[0].type) &&
        stack[1].type === "list_item_open" && stack[2].type === "paragraph_open" &&
        Array.isArray(stack[1].map) && stack[1].map[1] - stack[1].map[0] === 1 &&
        token.map[1] - token.map[0] === 1 && token.map[0] === stack[1].map[0] &&
        LIST_PREFIX.test(blocks.lines[token.map[0]]?.text ?? "") &&
        parseFields((blocks.lines[token.map[0]]?.text ?? "").replace(LIST_PREFIX, "")).size > 0;
      if (topLevel || directList) {
        for (let index = token.map[0]; index < token.map[1] && index < excluded.length; index++) excluded[index] = false;
      }
    }
    if (token.nesting === 1) stack.push(token);
  }
  return { blocks, excluded, topLevelHeadings };
}

function evidenceSpanAllowed(excluded, span) {
  if (!span || !Number.isSafeInteger(span.startLine) || !Number.isSafeInteger(span.endLine)) return false;
  const end = span.endColumn === 1 && span.endLine > span.startLine ? span.endLine - 1 : span.endLine;
  for (let line = span.startLine; line <= end; line++) if (excluded[line - 1]) return false;
  return true;
}

function explicitCaseStories(text) {
  const result = [];
  const { blocks, excluded } = markdownEvidenceContext(text);
  for (let index = 0; index < blocks.lines.length; index++) {
    if (excluded[index]) continue;
    const line = blocks.lines[index].text.replace(LIST_PREFIX, "");
    const field = /^\s*(?:[-*]\s+)?(?:\*\*)?\s*(?:Story|User Story|Parent Story)\s*(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*?)\s*$/iu.exec(line);
    if (!field) continue;
    const value = field[1].trim();
    const direct = /^(?:`|\*\*)?(US-[1-9]\d*)(?:`|\*\*)?$/u.exec(value);
    const link = /^\[(US-[1-9]\d*)\]\([^\r\n]*\)$/u.exec(value);
    if (direct || link) result.push((direct ?? link)[1]);
    else result.push(null); // an ambiguous explicit field cannot prove a link
  }
  return result;
}

function canonicalRuleFields(rule) {
  const values = new Map();
  const attrs = rule.attributes;
  const scalar = [["Actor", "actor"], ["Goal", "goal"], ["Benefit", "benefit"], ["Independent Test", "independentTest"],
    ["Boundary", "boundary"], ["Trigger", "trigger"], ["Precondition", "precondition"], ["Success", "success"]];
  for (const [name, key] of scalar) if (typeof attrs[key] === "string") values.set(name, attrs[key]);
  for (const [id, value] of Object.entries(attrs.steps ?? {})) values.set(`Step:${id}`, value.join(" | "));
  for (const [id, value] of Object.entries(attrs.outcomes ?? {})) values.set(`${rule.kind === "USE_CASE" ? "Branch" : "Outcome"}:${id}`, value.join(" | "));
  for (const [id, value] of Object.entries(attrs.refs ?? {})) values.set(`ScenarioRef:${id}`, value);
  if (attrs.covers?.length) values.set("Covers", attrs.covers.join(", "));
  return values;
}

// A standalone user-story paragraph is evidence only when it has exactly one
// unambiguous role/goal/benefit split. Quoted, fenced, list and field content
// is handled separately and must not become an implicit requirement.
function standaloneStoryParagraphs(text) {
  const { blocks, excluded } = markdownEvidenceContext(text);
  const matches = [];
  let paragraph = [];
  const flush = () => {
    const content = paragraph.join(" ");
    paragraph = [];
    const separators = [...content.matchAll(/,\s*so(?:\s+that)?\s+|\s+so\s+that\s+/giu)];
    if (separators.length !== 1) return;
    const match = /^As\s+(?:a|an)\s+(.+?),\s*I\s+want\s+(.+?)(?:,\s*so(?:\s+that)?\s+|\s+so\s+that\s+)(.+)$/iu.exec(content);
    if (match) matches.push({ actor: match[1].trim(), goal: match[2].trim(), benefit: match[3].trim() });
  };
  for (let index = 0; index < blocks.lines.length; index++) {
    const line = blocks.lines[index].text;
    const unavailable = excluded[index] || !line.trim() ||
      /^(?: {0,3}>| {0,3}#{1,6}(?:\s|$)| {0,3}(?:[-+*]\s+|\d+[.)]\s+)| {4,}|\t)/u.test(line) ||
      parseFields(line).size > 0;
    if (unavailable) flush();
    else paragraph.push(line.trim());
  }
  flush();
  return matches;
}

// Only remove inline Markdown when the renderer has preserved all meaningful
// punctuation and content. Link destinations and ambiguous operators remain
// literal, so a matching label cannot hide a different URL or amount.
function fieldEvidenceTokens(value) {
  if (/[\[\]<>]/u.test(value) || /\d[*_~]|[*_~]\d/u.test(value)) return identifiers(value);
  const rendered = renderInline(value);
  const withoutDelimiters = (text) => text.replace(/[`*_~\\]/gu, "");
  return identifiers(withoutDelimiters(value) === withoutDelimiters(rendered) ? rendered : value);
}

function markdownRuleFields(text, role) {
  const values = new Map();
  const ambiguous = new Set();
  const add = (name, value) => {
    if (!value) return;
    const found = values.get(name) ?? [];
    found.push(value.trim());
    values.set(name, found);
  };
  const { blocks, excluded } = markdownEvidenceContext(text);
  for (let index = 0; index < blocks.lines.length; index++) {
    const line = blocks.lines[index].text;
    if (excluded[index] || /^(?: {0,3}>| {4,}|\t)/u.test(line)) continue;
    for (const [raw, entry] of parseFields(line.replace(LIST_PREFIX, ""))) {
      const name = raw.toLowerCase();
      const mapped = { actor: "Actor", "primary actor": "Actor", role: "Actor", goal: "Goal", benefit: "Benefit", "independent test": "Independent Test",
        boundary: "Boundary", system: "Boundary", trigger: "Trigger", precondition: "Precondition", preconditions: "Precondition",
        success: "Success", postcondition: "Success", postconditions: "Success", covers: "Covers" }[name];
      if (mapped) add(mapped, entry.value);
      if (role === "USER_STORY" && name === "story") {
        const match = /^As\s+(?:a|an)\s+(.+?),\s*I\s+want\s+(.+?),\s*so\s+that\s+(.+)$/iu.exec(entry.value);
        if (match) { add("Actor", match[1]); add("Goal", match[2]); add("Benefit", match[3]); }
      }
      const keyed = /^(Step|Branch|Outcome|ScenarioRef)$/iu.exec(raw);
      if (keyed) {
        const parts = entry.value.split(" | ");
        const id = parts.shift();
        const canonical = { step: "Step", branch: "Branch", outcome: "Outcome", scenarioref: "ScenarioRef" }[keyed[1].toLowerCase()];
        if (id && parts.length) add(`${canonical}:${id}`, parts.join(" | "));
      }
    }
  }
  if (role === "USER_STORY") {
    const stories = standaloneStoryParagraphs(text);
    if (stories.length === 1) {
      add("Actor", stories[0].actor);
      add("Goal", stories[0].goal);
      add("Benefit", stories[0].benefit);
    } else if (stories.length > 1) {
      for (const name of ["Actor", "Goal", "Benefit"]) ambiguous.add(name);
    }
  }
  return { values, ambiguous };
}

// Resolve only a real source link to a real legacy heading. The target document
// is inspected for migration evidence; it is not inserted into the live graph.
function legacyMarkdownLink(link, sourcePath, files) {
  const paths = new Set(files.map(({ path }) => path));
  const result = resolveDestination(link.rawDestination, sourcePath, { paths, anchorIndex: new Map() });
  const match = /^\.specs\/([^/]+)\/(USER_STORIES|USE_CASES)\.md$/u.exec(result.targetPath ?? "");
  if (!match || !isValidSpecSlug(match[1]) || !link.rawDestination.includes("#")) return null;
  const target = files.find(({ path }) => path === result.targetPath);
  if (!target || !result.targetAnchor) throw new Error(`legacy Markdown link cannot be resolved: ${link.rawDestination}`);
  const role = match[2] === "USER_STORIES" ? "USER_STORY" : "USE_CASE";
  const text = new TextDecoder("utf-8", { fatal: true }).decode(target.bytes);
  const parsed = parseMarkdownDocument({ path: result.targetPath, documentKind: match[2], text });
  const heading = parsed.headings.find((item) => item.canonicalAnchor === result.targetAnchor);
  if (!heading) throw new Error(`legacy Markdown link target heading does not exist: ${link.rawDestination}`);
  if (!markdownEvidenceContext(text).topLevelHeadings.has(heading.span.startLine)) {
    throw new Error(`legacy Markdown link target is not a top-level story or case: ${link.rawDestination}`);
  }
  const identity = matchDefinitionHeading(role, heading.level, heading.rawText.trim());
  if (identity?.status !== "definition") throw new Error(`legacy Markdown link target is not a story or case: ${link.rawDestination}`);
  return `${match[1]}:${identity.localId}`;
}

function compareTables(before, after) {
  if (before.length !== after.length) return false;
  return before.every((table, index) => {
    const result = after[index];
    const idIndex = result.headers.indexOf("example_id");
    if (idIndex < 0) return false;
    const originalHeaders = table.headers.includes("example_id") ? result.headers : result.headers.filter((_, i) => i !== idIndex);
    if (canonicalJson(table.headers) !== canonicalJson(originalHeaders) || table.rows.length !== result.rows.length) return false;
    return table.rows.every((row, rowIndex) => {
      const target = table.headers.includes("example_id") ? result.rows[rowIndex] : result.rows[rowIndex].filter((_, i) => i !== idIndex);
      return canonicalJson(row) === canonicalJson(target);
    });
  });
}

/** Validate preservation of explicit source spans and the scenario AST, without executing scenarios. */
export function validateMigration({ spec, sources, targets, mapping, decisions = [], fieldDecisions = [], repairs = [], repositoryFiles = [] }) {
  if (!Array.isArray(mapping) || mapping.length === 0 || mapping.length > MAX_MAPPING_ENTRIES) {
    return { ok: false, message: "migration mapping must contain bounded source-to-target spans" };
  }
  if (!Array.isArray(decisions) || decisions.length > 1000) return { ok: false, message: "migration decisions must be a bounded array" };
  const decisionByCase = new Map();
  for (const decision of decisions) {
    if (!decision || typeof decision !== "object" || Array.isArray(decision) ||
        !/^UC-[1-9]\d*$/u.test(decision.caseId ?? "") || !/^US-[1-9]\d*$/u.test(decision.storyId ?? "") ||
        typeof decision.reason !== "string" || !decision.reason.trim() || Buffer.byteLength(decision.reason, "utf8") > 512 ||
        decisionByCase.has(decision.caseId)) return { ok: false, message: "invalid or duplicate migration decision" };
    decisionByCase.set(decision.caseId, decision);
  }
  const stories = canonicalDocumentFilename("USER_STORIES", spec);
  const cases = canonicalDocumentFilename("USE_CASES", spec);
  const targetNames = new Set([stories, cases]);
  const sourceMap = new Map(sources.map((source) => [source.document, source]));
  const targetMap = new Map(targets.map((target) => [target.document, target]));
  const covered = new Map(sources.map((source) => [source.document, new Set()]));
  const usedTargetTokens = new Map(targets.map((target) => [target.document, new Set()]));
  const parsedTargets = new Map();
  const targetRuleFields = new Map();
  const sourceRuleFields = new Map();
  const ambiguousSourceFields = new Set();
  const addFieldEvidence = (id, values) => {
    const fields = sourceRuleFields.get(id) ?? new Map();
    for (const [name, candidates] of values) {
      const previous = fields.get(name) ?? [];
      previous.push(...(Array.isArray(candidates) ? candidates : [candidates]));
      fields.set(name, previous);
    }
    sourceRuleFields.set(id, fields);
  };
  const targetScenarios = new Map();
  const sourceSections = new Map();
  const preservedReferences = [];
  const sourceRuleRefs = new Map();
  const recordRuleRef = (id, target) => {
    const refs = sourceRuleRefs.get(id) ?? new Set();
    refs.add(target);
    sourceRuleRefs.set(id, refs);
  };
  let repairedSources;
  try { repairedSources = prepareRepairs(spec, sources, repairs); }
  catch (error) { return { ok: false, message: error.message }; }
  const knownCaseLinks = new Map();
  const recordCaseLinks = (id, links) => {
    const previous = knownCaseLinks.get(id) ?? new Set();
    for (const link of links) previous.add(link);
    knownCaseLinks.set(id, previous);
  };
  try {
    for (const targetName of targetNames) {
      const target = targetMap.get(targetName);
      if (!target) return { ok: false, message: `migration requires ${targetName}` };
      const parsed = inspectFeature(target.text, targetName);
      parsedTargets.set(targetName, parsed);
      const canonical = parseGherkinDocument({ path: targetName, specSlug: spec, text: target.text });
      for (const rule of canonical.rules) targetRuleFields.set(rule.localId, canonicalRuleFields(rule));
      for (const [id, scenario] of parsed.scenarios) {
        if (targetScenarios.has(id)) return { ok: false, message: `scenario ${id} appears in both target files` };
        targetScenarios.set(id, { ...scenario, document: targetName });
      }
    }
    for (const source of sources) {
      const lower = source.document.toLowerCase();
      if (lower === "user_stories.md" || lower === "use_cases.md") {
        const role = lower === "user_stories.md" ? "USER_STORY" : "USE_CASE";
        const targetName = role === "USER_STORY" ? stories : cases;
        const { sections, fieldReferences, links } = inspectMarkdown(source.text, source.document, role);
        const { excluded } = markdownEvidenceContext(source.text);
        for (const section of sections) {
          const targetRule = parsedTargets.get(targetName).rules.get(section.id);
          if (!targetRule) return { ok: false, message: `${source.document} ${section.id} has no matching target Rule` };
          const original = lines(source.text).slice(section.start - 1, section.end).join("\n");
          const fieldEvidence = markdownRuleFields(original, role);
          addFieldEvidence(section.id, fieldEvidence.values);
          for (const name of fieldEvidence.ambiguous) ambiguousSourceFields.add(`${section.id}\u0000${name}`);
          if (role === "USE_CASE") {
            recordCaseLinks(section.id, explicitCaseStories(original));
          }
          for (const ref of fieldReferences.filter((item) => item.span.startLine >= section.start && item.span.startLine <= section.end && evidenceSpanAllowed(excluded, item.span))) {
            const target = ref.rawTarget;
            if (ref.edgeType !== "REFS") continue;
            recordRuleRef(section.id, target);
            const parsedTarget = splitCanonicalId(target);
            if (!parsedTarget || target !== `${parsedTarget.specSlug}:${parsedTarget.localId}` || parsedTarget.specSlug === spec ||
                !["USER_STORY", "USE_CASE", "SCENARIO"].includes(localIdKind(parsedTarget.localId))) continue;
            if (!targetRule.directRefs.includes(target)) {
              return { ok: false, message: `${source.document} ${section.id} must preserve ${target} in the target Rule Refs` };
            }
            preservedReferences.push({
              sourceCanonicalId: `${spec}:${section.id}`,
              target,
              sourceDocument: source.document,
              sourceStartLine: ref.span.startLine,
              sourceEndLine: ref.span.endLine,
            });
          }
          for (const link of links.filter((item) => item.useSpan.startLine >= section.start && item.useSpan.startLine <= section.end && evidenceSpanAllowed(excluded, item.useSpan))) {
            const target = legacyMarkdownLink(link, `.specs/${spec}/${source.document}`, repositoryFiles);
            if (!target || target.startsWith(`${spec}:`)) continue;
            recordRuleRef(section.id, target);
            if (!targetRule.directRefs.includes(target)) {
              return { ok: false, message: `${source.document} ${section.id} must preserve ${target} in the target Rule Refs` };
            }
            preservedReferences.push({
              sourceCanonicalId: `${spec}:${section.id}`, target, sourceDocument: source.document,
              sourceStartLine: link.useSpan.startLine, sourceEndLine: link.useSpan.endLine,
            });
          }
        }
        sourceSections.set(source.document, sections.map((section) => ({ ...section, document: targetName, target: parsedTargets.get(targetName).rules.get(section.id) })));
      } else if (lower.endsWith(".feature")) {
        const repaired = repairedSources.prepared.get(source.document);
        const parsed = inspectFeature(repaired?.text ?? source.text, source.document);
        const canonical = parseGherkinDocument({ path: source.document, specSlug: spec, text: repaired?.text ?? source.text });
        for (const rule of canonical.rules) addFieldEvidence(rule.localId, canonicalRuleFields(rule));
        if (repaired) {
          for (const edit of repaired.edits) {
            const scenario = parsed.scenarios.get(edit.scenarioId);
            if (!scenario || edit.newStartLine < scenario.start || edit.newEndLine > scenario.end) {
              return { ok: false, message: `repair does not belong to scenario ${edit.scenarioId}` };
            }
          }
        }
        for (const [id, rule] of parsed.rules) {
          if (id.startsWith("UC-") && rule.storyId) recordCaseLinks(id, [rule.storyId]);
          for (const target of rule.directRefs) {
            recordRuleRef(id, target);
            const parsedTarget = splitCanonicalId(target);
            if (!parsedTarget || target !== `${parsedTarget.specSlug}:${parsedTarget.localId}` || parsedTarget.specSlug === spec ||
                !["USER_STORY", "USE_CASE", "SCENARIO"].includes(localIdKind(parsedTarget.localId))) continue;
            const original = repaired ? [...repaired.projection.entries()]
              .filter(([, range]) => range.end >= rule.start && range.start <= rule.end).map(([line]) => line) : [];
            preservedReferences.push({ sourceCanonicalId: `${spec}:${id}`, target, sourceDocument: source.document,
              sourceStartLine: repaired && original.length ? Math.min(...original) : rule.start,
              sourceEndLine: repaired && original.length ? Math.max(...original) : rule.end });
          }
        }
        const sections = [];
        for (const [id, before] of parsed.scenarios) {
          const after = targetScenarios.get(id);
          if (!after) return { ok: false, message: `missing migrated scenario ${id}` };
          if (before.name !== after.name || canonicalJson(before.refs) !== canonicalJson(after.refs) ||
              canonicalJson(before.pickles) !== canonicalJson(after.pickles) || !compareTables(before.tables, after.tables)) {
            return { ok: false, message: `migration changes scenario ${id}, its steps, tags, references or Examples; explicit owner review is required` };
          }
          // A preserved pending edge needs evidence from the original scenario,
          // not an incidental occurrence of the same text elsewhere. Both the
          // scenario references and its inherited Gherkin tags were compared
          // above against the migrated scenario without executing it.
          const tags = before.pickles[0]?.tags ?? [];
          for (const target of [...before.refs, ...tags.filter((tag) => tag.startsWith("@") && !tag.startsWith("@id:")).map((tag) => tag.slice(1))]) {
            const parsedTarget = splitCanonicalId(target);
            if (!parsedTarget || target !== `${parsedTarget.specSlug}:${parsedTarget.localId}` || parsedTarget.specSlug === spec ||
                !["USER_STORY", "USE_CASE", "SCENARIO"].includes(localIdKind(parsedTarget.localId))) continue;
            preservedReferences.push({
              sourceCanonicalId: `${spec}:${id}`,
              target,
              sourceDocument: source.document,
              sourceStartLine: before.start,
              sourceEndLine: before.end,
            });
          }
          const originalLines = repaired ? [...repaired.projection.entries()]
            .filter(([, range]) => range.end >= before.start && range.start <= before.end).map(([line]) => line) : [];
          if (repaired && !originalLines.length) return { ok: false, message: `cannot map repaired scenario ${id} to its source` };
          sections.push({ id, start: repaired ? Math.min(...originalLines) : before.start,
            end: repaired ? Math.max(...originalLines) : before.end,
            document: after.document, target: { start: after.start, end: after.end } });
        }
        sourceSections.set(source.document, sections);
      }
    }
  } catch (error) {
    return { ok: false, message: `cannot validate migration sources: ${error.message}` };
  }
  for (const [id, targetRule] of parsedTargets.get(cases).rules) {
    if (!id.startsWith("UC-")) continue;
    const links = knownCaseLinks.get(id) ?? new Set();
    const decision = decisionByCase.get(id);
    if (links.size === 1 && links.has(targetRule.storyId)) {
      if (decision) return { ok: false, message: `unnecessary owner decision for ${id}` };
    } else {
      if (!decision || decision.storyId !== targetRule.storyId) {
        return { ok: false, message: `${id} has no unambiguous source link to ${targetRule.storyId}; explicit owner review is required` };
      }
      decisionByCase.delete(id);
    }
  }
  if (decisionByCase.size) return { ok: false, message: `owner decision names an unknown case: ${decisionByCase.keys().next().value}` };
  for (const [document, parsed] of parsedTargets) {
    for (const [id, rule] of parsed.rules) {
      if (!mapping.some((entry) => entry.targetDocument === document && entry.targetStartLine >= rule.start && entry.targetEndLine <= rule.end)) {
        return { ok: false, message: `target ${id} has no mapped source` };
      }
    }
    for (const [id, scenario] of parsed.scenarios) {
      if (!mapping.some((entry) => entry.targetDocument === document && entry.targetStartLine >= scenario.start && entry.targetEndLine <= scenario.end)) {
        return { ok: false, message: `target scenario ${id} has no mapped source` };
      }
    }
  }
  if (!Array.isArray(fieldDecisions) || fieldDecisions.length > 1000) return { ok: false, message: "fieldDecisions must be a bounded array" };
  const decisionsByField = new Map();
  let fieldDecisionBytes = 0;
  for (const decision of fieldDecisions) {
    if (!decision || typeof decision !== "object" || Array.isArray(decision) ||
        !/^(?:US|UC)-[1-9]\d*$/u.test(decision.entityId ?? "") ||
        !/^(?:Actor|Goal|Benefit|Independent Test|Boundary|Trigger|Precondition|Success|Covers|(?:Step|Branch|Outcome|ScenarioRef):[a-z0-9]+(?:-[a-z0-9]+)*)$/u.test(decision.field ?? "") ||
        typeof decision.value !== "string" || !decision.value || Buffer.byteLength(decision.value, "utf8") > 8192 ||
        typeof decision.reason !== "string" || !decision.reason.trim() ||
        Buffer.byteLength(decision.reason, "utf8") > 512 || typeof decision.sourceDocument !== "string" ||
        !/^[0-9a-f]{64}$/u.test(decision.sourceSha256 ?? "") || !Number.isSafeInteger(decision.sourceStartLine) ||
        !Number.isSafeInteger(decision.sourceEndLine) || decision.sourceStartLine < 1 || decision.sourceEndLine < decision.sourceStartLine) {
      return { ok: false, message: "invalid field decision" };
    }
    fieldDecisionBytes += Buffer.byteLength(decision.value, "utf8");
    if (fieldDecisionBytes > 65536) return { ok: false, message: "field decisions exceed the byte budget" };
    const key = `${decision.entityId}\u0000${decision.field}`;
    if (decisionsByField.has(key)) return { ok: false, message: "duplicate field decision" };
    const targetName = decision.entityId.startsWith("US-") ? stories : cases;
    const targetRule = parsedTargets.get(targetName).rules.get(decision.entityId);
    const source = sourceMap.get(decision.sourceDocument);
    const sourceBacked = targetRule && source && source.sha256 === decision.sourceSha256 && mapping.some((item) =>
      item.sourceDocument === decision.sourceDocument && item.sourceSha256 === decision.sourceSha256 &&
      item.sourceStartLine <= decision.sourceStartLine && item.sourceEndLine >= decision.sourceEndLine &&
      item.targetDocument === targetName && item.targetStartLine >= targetRule.start && item.targetEndLine <= targetRule.end);
    if (!sourceBacked) return { ok: false, message: `field decision ${decision.entityId}/${decision.field} has no mapped source in that Rule` };
    decisionsByField.set(key, decision);
  }
  for (const [id, fields] of targetRuleFields) {
    const evidence = sourceRuleFields.get(id) ?? new Map();
    for (const [name, value] of fields) {
      const key = `${id}\u0000${name}`;
      const candidates = evidence.get(name) ?? [];
      const distinct = new Set(candidates.map((item) => canonicalJson(fieldEvidenceTokens(item))));
      const proven = !ambiguousSourceFields.has(key) && distinct.size === 1 && distinct.has(canonicalJson(fieldEvidenceTokens(value)));
      const decision = decisionsByField.get(key);
      if (!proven) {
        if (!decision || decision.value !== value) return { ok: false, message: `${id} ${name} is not supported by its source field; explicit owner fieldDecision is required` };
        decisionsByField.delete(key);
      } else if (decision) return { ok: false, message: `unnecessary field decision for ${id}/${name}` };
    }
    // A source field such as Independent Test may not be hidden in Context.
    for (const name of evidence.keys()) {
      if (["Actor", "Goal", "Benefit", "Independent Test", "Boundary", "Trigger", "Precondition", "Success"].includes(name) && !fields.has(name)) {
        return { ok: false, message: `${id} is missing its source field ${name}` };
      }
    }
  }
  if (decisionsByField.size) return { ok: false, message: `field decision names an unknown or unchanged field: ${decisionsByField.keys().next().value}` };
  for (const parsed of parsedTargets.values()) {
    for (const [id, rule] of parsed.rules) {
      for (const target of rule.directRefs) {
        if (!(sourceRuleRefs.get(id) ?? new Set()).has(target)) {
          return { ok: false, message: `target ${id} has an unsupported direct reference ${target}` };
        }
      }
    }
  }
  for (const item of mapping) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, message: "invalid migration mapping entry" };
    const source = sourceMap.get(item.sourceDocument);
    const target = targetMap.get(item.targetDocument);
    if (!source || !target || !targetNames.has(item.targetDocument) || item.sourceSha256 !== source.sha256) {
      return { ok: false, message: "migration mapping has an unknown document or mismatched source hash" };
    }
    const sourceLines = lines(source.text);
    const targetLines = lines(target.text);
    const bounds = [item.sourceStartLine, item.sourceEndLine, item.targetStartLine, item.targetEndLine];
    if (!bounds.every(Number.isSafeInteger) || item.sourceStartLine < 1 || item.targetStartLine < 1 ||
        item.sourceEndLine < item.sourceStartLine || item.targetEndLine < item.targetStartLine ||
        item.sourceEndLine > sourceLines.length || item.targetEndLine > targetLines.length) {
      return { ok: false, message: "migration mapping range is outside its source or target" };
    }
    const relevant = (sourceSections.get(source.document) ?? []).filter((section) => item.sourceStartLine <= section.end && item.sourceEndLine >= section.start);
    if (relevant.length > 1 || (relevant.length === 1 && (item.sourceStartLine < relevant[0].start || item.sourceEndLine > relevant[0].end ||
        item.targetDocument !== relevant[0].document || item.targetStartLine < relevant[0].target.start || item.targetEndLine > relevant[0].target.end))) {
      return { ok: false, message: `mapping ${item.sourceDocument}:${item.sourceStartLine}-${item.sourceEndLine} to ${item.targetDocument}:${item.targetStartLine}-${item.targetEndLine} must remain within the corresponding story, case or scenario` };
    }
    const changed = repairedSources.prepared.get(source.document)?.changed;
    const before = sourceLines.slice(item.sourceStartLine - 1, item.sourceEndLine)
      .filter((_, index) => !changed?.has(item.sourceStartLine + index)).join("\n");
    const after = targetLines.slice(item.targetStartLine - 1, item.targetEndLine).filter((line) => !/^\s*#/u.test(line)).join("\n");
    const tokenOffset = identifiers(targetLines.slice(0, item.targetStartLine - 1).filter((line) => !/^\s*#/u.test(line)).join("\n")).length;
    if (!containsSourceLines(before, after, usedTargetTokens.get(item.targetDocument), tokenOffset)) {
      return { ok: false, message: `mapped source content is missing or changed at ${item.sourceDocument}:${item.sourceStartLine}` };
    }
    for (let line = item.sourceStartLine; line <= item.sourceEndLine; line++) covered.get(source.document).add(line);
  }
  for (const source of sources.filter((item) => item.required !== false)) {
    for (const [index, line] of lines(source.text).entries()) {
      if (line.trim() && !covered.get(source.document).has(index + 1)) {
        return { ok: false, message: `source line is missing from migration mapping: ${source.document}:${index + 1}` };
      }
    }
  }
  return { ok: true, sourceCount: sources.length, mappingCount: mapping.length, sourceHash: sha256(canonicalJson(mapping)),
    preservedReferences, repairs: repairedSources.summary };
}
