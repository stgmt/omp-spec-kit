import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { canonicalJson } from "../kernel/normalize.js";
import { parseFeature } from "../kernel/parsers/gherkin.js";
import { compile } from "../kernel/vendor/gherkin.js";

const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
export const EVIDENCE_PATH = ".omp-spec-kit/evidence/last-test-run.ndjson";
export const EVIDENCE_SCHEMA = "omp-spec-kit/gherkin-run@1";

export const EVIDENCE_OPERATIONS = Object.freeze(["getTestResult", "getScenarioTrace"]);

function error(code, message, extra = {}) {
  return { ok: false, error: { code, message, retryable: false, ...extra } };
}

function success(data) {
  return { ok: true, data, page: null };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function scenarioLocalId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const separator = trimmed.indexOf(":");
  return separator >= 0 ? trimmed.slice(separator + 1) : trimmed;
}

async function readEvidence(root) {
  try {
    const bytes = await readFile(path.join(root, ...EVIDENCE_PATH.split("/")));
    return bytes.length <= MAX_EVIDENCE_BYTES ? bytes : Buffer.alloc(0);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    return Buffer.alloc(0);
  }
}

function timestampOf(frame) {
  const timestamp = frame?.timestamp;
  if (!isObject(timestamp) || typeof timestamp.seconds !== "number") return null;
  return timestamp.seconds * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
}

function scenarioIdFromTags(tags) {
  if (!Array.isArray(tags)) return null;
  const tag = tags.find((entry) => typeof entry?.name === "string" && entry.name.startsWith("@id:"));
  return tag ? tag.name.slice(4) : null;
}

function parseMessages(bytes) {
  const frames = [];
  for (const line of bytes.toString("utf8").split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const frame = JSON.parse(line);
      if (!isObject(frame)) return [];
      frames.push(frame);
    } catch {
      return [];
    }
  }
  return frames;
}

function emptyResult(result) {
  return { result, stale: true, runId: null, lastRunAt: null, failingStep: null, traceStatus: "missing", source: null, binding: null };
}

export function evidenceUri(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/").replace(/^\.\//u, "") : null;
}

// Resolve both the root and the file to prevent traversal through symlinks.
export async function readContainedEvidenceSource(root, uri) {
  if (typeof uri !== "string" || !uri || uri.includes("\\") || path.posix.isAbsolute(uri) ||
      uri.split("/").some((part) => !part || part === "." || part === "..") || /^[A-Za-z]:/u.test(uri)) return null;
  try {
    const base = await realpath(root);
    const file = await realpath(path.join(base, ...uri.split("/")));
    const relative = path.relative(base, file);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
    const bytes = await readFile(file);
    return bytes.length <= MAX_EVIDENCE_BYTES ? bytes : null;
  } catch {
    return null;
  }
}
function exampleRows(doc) {
  const rows = new Map();
  const children = doc?.feature?.children ?? [];
  for (const item of children.flatMap((child) => child.rule ? child.rule.children : [child])) {
    for (const example of item.scenario?.examples ?? []) {
      const column = example.tableHeader?.cells?.findIndex(({ value }) => value === "example_id") ?? -1;
      if (column >= 0) for (const row of example.tableBody ?? []) rows.set(row.id, row.cells?.[column]?.value);
    }
  }
  return rows;
}

function sourceMatchesScenario(bytes, uri, scenario, expected, reportedDefinition) {
  try {
    const { ast, ids } = parseFeature(bytes.toString("utf8"), uri);
    const children = ast.feature?.children ?? [];
    const definitions = children.flatMap((child) => child.rule ? child.rule.children : [child])
      .map((child) => child.scenario).filter((item) => item?.tags?.some(({ name }) => name === `@id:${scenario.localId}`));
    if (definitions.length !== 1 || definitions[0].tags.filter(({ name }) => name.startsWith("@id:")).length !== 1) return false;
    const exampleValues = (definition) => (definition.examples ?? []).map((example) => ({
      header: example.tableHeader?.cells.map(({ value }) => value) ?? null,
      rows: (example.tableBody ?? []).map((row) => row.cells.map(({ value }) => value)),
    }));
    if (canonicalJson(exampleValues(definitions[0])) !== canonicalJson(exampleValues(reportedDefinition))) return false;
    const rows = exampleRows({ feature: { children: [{ scenario: definitions[0] }] } });
    const actual = new Map();
    for (const pickle of compile(ast, uri, ids).filter((item) => item.astNodeIds[0] === definitions[0].id)) {
      const row = pickle.astNodeIds.length < 2 ? null : rows.get(pickle.astNodeIds[1]);
      const steps = pickle.steps.map(({ text, type, argument }) => ({ text, type, argument: argument ?? null }));
      if (actual.has(row) || !expected.has(row) || expected.get(row) !== sha256(Buffer.from(canonicalJson(steps)))) return false;
      actual.set(row, true);
    }
    return expected.size > 0 && actual.size === expected.size;
  } catch {
    return false;
  }
}
function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const id = key(item);
    const existing = groups.get(id) ?? [];
    existing.push(item);
    groups.set(id, existing);
  }
  return groups;
}

async function resultForScenario(root, frames, graph, scenario) {
  const uri = scenario.span.path;
  const rawCandidates = frames.map((f) => f.pickle).filter((p) => scenarioIdFromTags(p?.tags) === scenario.localId);
  if (!rawCandidates.length) return emptyResult("NOT_RUN");
  const bindings = frames.map(({ ompSpecKitEvidence }) => ompSpecKitEvidence?.binding).filter(Boolean);
  const captured = bindings[0]?.scenarios?.[scenario.canonicalId];
  const executionUri = captured?.executionPath;
  const sources = frames.map((f) => f.source).filter((item) => evidenceUri(item?.uri) === executionUri);
  const sourceHash = graph.documents.find(({ path }) => path === uri)?.sha256;
  const executionBytes = await readContainedEvidenceSource(root, executionUri);
  if (bindings.length !== 1 || bindings[0].schemaVersion !== EVIDENCE_SCHEMA || bindings[0].graphFingerprint !== graph.fingerprint ||
      captured?.path !== uri || captured?.scenarioContentHash !== scenario.contentHash ||
      !sourceHash || captured?.sourceSha256 !== sourceHash || !executionBytes ||
      sha256(executionBytes) !== captured?.executionSourceSha256 || sources.length !== 1 || typeof sources[0].data !== "string" ||
      sha256(Buffer.from(sources[0].data, "utf8")) !== captured.executionSourceSha256) return emptyResult("UNKNOWN");

  const binding = { graphFingerprint: bindings[0].graphFingerprint, ...captured };
  const unknown = { ...emptyResult("UNKNOWN"), binding };
  const docs = frames.map((f) => f.gherkinDocument).filter((item) => evidenceUri(item?.uri) === executionUri);
  if (docs.length !== 1) return unknown;
  const children = docs[0].feature?.children ?? [];
  const definitions = children.flatMap((child) => child.rule ? child.rule.children : [child])
    .map((child) => child.scenario).filter((item) => item?.tags?.some(({ name }) => name === `@id:${scenario.localId}`));
  if (definitions.length !== 1 || definitions[0].tags.filter(({ name }) => name.startsWith("@id:")).length !== 1) return unknown;
  const rows = exampleRows({ feature: { children: [{ scenario: definitions[0] }] } });
  const expected = new Map((scenario.attributes.pickles ?? []).map(({ rowId, sha256 }) => [rowId, sha256]));
  if (!sourceMatchesScenario(executionBytes, executionUri, scenario, expected, definitions[0])) return unknown;
  const pickles = new Map();
  if (rawCandidates.some((p) => evidenceUri(p.uri) !== executionUri)) return unknown;
  for (const p of rawCandidates) {
    if (!Array.isArray(p.astNodeIds) || p.astNodeIds[0] !== definitions[0].id || !Array.isArray(p.steps)) return unknown;
    const row = p.astNodeIds.length < 2 ? null : rows.get(p.astNodeIds[1]);
    const steps = p.steps.map(({ text, type, argument }) => ({ text, type, argument: argument ?? null }));
    if (pickles.has(row) || !expected.has(row) || expected.get(row) !== sha256(Buffer.from(canonicalJson(steps)))) return unknown;
    pickles.set(row, p);
  }
  if (expected.size === 0 || pickles.size !== expected.size) return unknown;
  const testCases = groupBy(frames.map((f) => f.testCase).filter(Boolean), (f) => f.pickleId);
  const starts = groupBy(frames.map((f) => f.testCaseStarted).filter(Boolean), (f) => f.testCaseId);
  const results = groupBy(frames.map((f) => f.testStepFinished).filter(Boolean), (f) => f.testCaseStartedId);
  const completions = groupBy(frames.map((f) => f.testCaseFinished).filter(Boolean), (f) => f.testCaseStartedId);
  const runs = frames.map((f) => f.testRunFinished).filter(Boolean);
  if (runs.length !== 1 || runs[0].testRunStartedId !== bindings[0].testRunStartedId ||
      frames.filter((f) => f.testRunStarted?.id === runs[0].testRunStartedId).length !== 1) return unknown;
  let lastRunAt = null;
  let status = "PASSED";
  let failingStep = null;
  for (const pickle of pickles.values()) {
    const cases = testCases.get(pickle.id) ?? [];
    if (cases.length !== 1 || cases[0].testRunStartedId !== runs[0].testRunStartedId) return unknown;
    const test = cases[0];
    const terminal = (starts.get(test.id) ?? []).filter(({ id }) => {
      const records = completions.get(id);
      return records?.length === 1 && records[0].willBeRetried === false;
    });
    if (terminal.length !== 1) return unknown;
    const attempt = terminal[0];
    const at = timestampOf(attempt);
    if (at !== null) lastRunAt = Math.max(lastRunAt ?? at, at);
    const found = results.get(attempt.id) ?? [];
    const expectedIds = new Set(test.testSteps?.map(({ id }) => id));
    if (!expectedIds.size || found.length !== expectedIds.size ||
        new Set(found.map(({ testStepId }) => testStepId)).size !== expectedIds.size ||
        found.some(({ testStepId }) => !expectedIds.has(testStepId))) return unknown;
    for (const entry of found) {
      const current = entry.testStepResult?.status;
      if (current === "FAILED") {
        status = "FAILED";
        failingStep ??= { stepId: entry.testStepId, message: "Cucumber reported a failed step" };
      } else if (status !== "FAILED" && current === "UNDEFINED") status = "UNDEFINED";
      else if (status === "PASSED" && current !== "PASSED") status = current === "SKIPPED" ? "SKIPPED" : "UNKNOWN";
    }
  }
  if (status === "PASSED" && runs[0].success !== true) return unknown;
  return {
    result: status, stale: status !== "PASSED", runId: runs[0].testRunStartedId, lastRunAt, failingStep,
    traceStatus: "available", source: { scenarioId: scenario.canonicalId, uri }, binding,
  };
}

function findScenario(graph, rawId, spec) {
  const localId = scenarioLocalId(rawId);
  const scope = rawId.includes(":") ? rawId.split(":", 1)[0] : spec;
  const candidates = graph.nodes.filter((node) => node.kind === "SCENARIO" && node.localId === localId &&
    (!scope || node.specSlug === scope) && (!spec || node.specSlug === spec));
  if (candidates.length === 0) return { error: error("SCENARIO_NOT_FOUND", `scenario not found: ${rawId}`, { scenarioId: rawId }) };
  if (candidates.length > 1) return { error: error("AMBIGUOUS_ID", `scenario identifier is ambiguous: ${rawId}`, { candidates: candidates.map((node) => node.canonicalId).sort() }) };
  return { node: candidates[0] };
}

export async function executeEvidenceOperation(root, graph, operation, args = {}) {
  if (!EVIDENCE_OPERATIONS.includes(operation)) return error("UNKNOWN_OPERATION", `unknown evidence operation: ${operation}`);
  if (typeof args.scenarioId !== "string" || args.scenarioId.trim() === "") return error("INVALID_PARAMETER", "scenarioId is required", { parameter: "scenarioId" });
  const resolved = findScenario(graph, args.scenarioId, args.spec ?? undefined);
  if (resolved.error) return resolved.error;
  const bytes = await readEvidence(root);
  const frames = bytes === null ? [] : parseMessages(bytes);
  const evidence = bytes === null ? emptyResult("NOT_RUN")
    : frames.length === 0 ? emptyResult("UNKNOWN") : await resultForScenario(root, frames, graph, resolved.node);
  if (bytes !== null) evidence.source = { ...evidence.source, path: EVIDENCE_PATH, sha256: sha256(bytes) };
  const data = {
    kind: operation === "getScenarioTrace" ? "scenario-trace" : "test-result",
    scenarioId: resolved.node.canonicalId,
    result: evidence.result,
    stale: evidence.stale,
    runId: evidence.runId,
    lastRunAt: evidence.lastRunAt,
    failingStep: evidence.failingStep,
    traceStatus: evidence.traceStatus,
    source: evidence.source,
    evidenceBinding: evidence.binding,
  };
  if (operation === "getScenarioTrace") data.trace = evidence.traceStatus === "available"
    ? { status: "bounded", path: evidence.source?.path ?? null, artifactSha256: evidence.source?.sha256 ?? null, failingStep: evidence.failingStep }
    : null;
  return success(data);
}
