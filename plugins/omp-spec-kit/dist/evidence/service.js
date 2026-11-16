import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
const EVIDENCE_NAMES = Object.freeze([
  ".omp-spec-kit/evidence/last-test-run.ndjson",
  ".omp-spec-kit/evidence/bdd-results/run.ndjson",
  "tests/fixtures/release-candidate/cucumber-messages.ndjson",
]);

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

async function evidenceFiles(root) {
  const files = [];
  const physicalRoot = await realpath(root);
  for (const relative of EVIDENCE_NAMES) {
    try {
      const absolute = await realpath(path.join(root, ...relative.split("/")));
      const contained = path.relative(physicalRoot, absolute);
      if (path.isAbsolute(contained) || contained === ".." || contained.startsWith(`..${path.sep}`)) continue;
      if ((await stat(absolute)).size > MAX_EVIDENCE_BYTES) continue;
      const bytes = await readFile(absolute);
      if (bytes.length <= MAX_EVIDENCE_BYTES) files.push({ relative, bytes, sha256: sha256(bytes) });
    } catch {
      // Missing evidence is NOT_RUN, never evidence of a passing execution.
    }
  }
  return files;
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

// One parser/index for public evidence and the readiness projection. Damaged
// captures may still explain a failure, but can never prove the execution rung.
function indexMessages(bytes) {
  const capture = {
    frames: [], valid: true, captureBinding: null,
    pickles: new Map(), testCases: new Map(), starts: new Map(),
    stepResults: new Map(), finished: new Map(), sources: new Map(),
  };
  const put = (map, key, value) => {
    if (map.has(key)) capture.valid = false;
    map.set(key, value);
  };
  for (const line of bytes.toString("utf8").split(/\r?\n/u)) {
    if (!line.trim()) continue;
    let frame;
    try { frame = JSON.parse(line); } catch { capture.valid = false; continue; }
    if (!isObject(frame)) { capture.valid = false; continue; }
    capture.frames.push(frame);
    if (isObject(frame.ompSpecKitEvidence) && isObject(frame.ompSpecKitEvidence.binding)) {
      if (capture.captureBinding !== null) capture.valid = false;
      capture.captureBinding = frame.ompSpecKitEvidence.binding;
    }
    for (const [field, map] of [["pickle", capture.pickles], ["testCase", capture.testCases], ["testCaseStarted", capture.starts]]) {
      if (isObject(frame[field]) && typeof frame[field].id === "string") put(map, frame[field].id, frame[field]);
    }
    if (isObject(frame.source) && typeof frame.source.uri === "string") put(capture.sources, frame.source.uri, frame.source);
    if (isObject(frame.testStepFinished) && typeof frame.testStepFinished.testCaseStartedId === "string") {
      const step = frame.testStepFinished;
      const list = capture.stepResults.get(step.testCaseStartedId) ?? [];
      list.push(step);
      capture.stepResults.set(step.testCaseStartedId, list);
    }
    if (isObject(frame.testCaseFinished) && typeof frame.testCaseFinished.testCaseStartedId === "string") {
      put(capture.finished, frame.testCaseFinished.testCaseStartedId, frame.testCaseFinished);
    }
  }
  return capture;
}

function attemptComplete(capture, start) {
  const testCase = capture.testCases.get(start.testCaseId);
  const expected = Array.isArray(testCase?.testSteps) ? testCase.testSteps.map((step) => step?.id) : [];
  const actual = (capture.stepResults.get(start.id) ?? []).map((step) => step.testStepId);
  const finished = capture.finished.get(start.id);
  return finished !== undefined && finished.willBeRetried !== true &&
    expected.length > 0 && expected.every((id) => typeof id === "string") &&
    new Set(expected).size === expected.length && actual.length === expected.length &&
    new Set(actual).size === expected.length && expected.every((id) => actual.includes(id)) &&
    capture.frames.some((frame) => frame.testRunFinished !== undefined);
}

function resultForScenario(capture, localId) {
  if (capture.frames.length === 0) return { result: "UNKNOWN", stale: true, runId: null, lastRunAt: null, failingStep: null, traceStatus: "missing", source: null, captureBinding: capture.captureBinding };
  const pickles = [...capture.pickles.values()].filter((pickle) => scenarioIdFromTags(pickle.tags) === localId);
  const pickleIds = new Set(pickles.map((pickle) => pickle.id));
  const matchingCases = [...capture.testCases.values()].filter((testCase) => pickleIds.has(testCase.pickleId));
  const matchingCaseIds = new Set(matchingCases.map((testCase) => testCase.id));
  const matchingStarts = [...capture.starts.values()].filter((start) => matchingCaseIds.has(start.testCaseId));
  const captureBinding = capture.captureBinding;
  if (matchingStarts.length === 0) return { result: "NOT_RUN", stale: true, runId: null, lastRunAt: null, failingStep: null, traceStatus: "missing", source: null, captureBinding };
  const latest = matchingStarts[matchingStarts.length - 1];
  const results = capture.stepResults.get(latest.id) ?? [];
  const statuses = results.map((entry) => entry.testStepResult?.status);
  const failed = results.find((entry) => entry.testStepResult?.status === "FAILED");
  const allPassed = attemptComplete(capture, latest) && statuses.length > 0 && statuses.every((status) => status === "PASSED");
  const result = failed ? "FAILED" : statuses.includes("UNDEFINED") ? "UNDEFINED" : statuses.includes("SKIPPED") ? "SKIPPED" : allPassed ? "PASSED" : "UNKNOWN";
  return {
    result, stale: result !== "PASSED", runId: latest.testCaseStartedId ?? latest.id,
    lastRunAt: timestampOf(latest),
    failingStep: failed ? { stepId: failed.testStepId ?? null, message: failed.testStepResult?.message ?? null } : null,
    traceStatus: results.length > 0 ? "available" : "missing",
    source: { scenarioId: localId, pickleId: capture.testCases.get(latest.testCaseId)?.pickleId ?? null },
    captureBinding,
  };
}

function findScenario(graph, rawId, spec) {
  const localId = scenarioLocalId(rawId);
  const candidates = graph.nodes.filter((node) => node.kind === "SCENARIO" && node.localId === localId && (!spec || node.specSlug === spec));
  if (candidates.length === 0) return { error: error("SCENARIO_NOT_FOUND", `scenario not found: ${rawId}`, { scenarioId: rawId }) };
  if (candidates.length > 1) return { error: error("AMBIGUOUS_ID", `scenario identifier is ambiguous: ${rawId}`, { candidates: candidates.map((node) => node.canonicalId).sort() }) };
  return { node: candidates[0] };
}

async function evidenceSnapshot(root) {
  return (await evidenceFiles(root)).map((file) => ({ ...file, capture: indexMessages(file.bytes) }));
}

function selectEvidence(files, graph, node) {
  const entries = files.map((file) => {
    const parsed = resultForScenario(file.capture, node.localId);
    const binding = parsed.captureBinding;
    const mismatch = binding && (binding.graphFingerprint !== graph.fingerprint || binding.scenarioContentHash !== node.contentHash);
    const { captureBinding: _, ...result } = parsed;
    return {
      file,
      result: {
        ...result,
        ...(mismatch ? { result: "UNKNOWN", stale: true, traceStatus: "missing" } : {}),
        source: { ...(result.source ?? {}), path: file.relative, sha256: file.sha256 },
      },
    };
  });
  // A failed/unknown current run must not fall through to an older passing fixture.
  return entries.find((entry) => entry.result.result !== "NOT_RUN") ?? entries.at(-1) ?? null;
}

function provesExecution(capture, graph, node) {
  if (!capture.valid) return false;
  const starts = capture.frames.filter((frame) => frame.testRunStarted !== undefined);
  const finishes = capture.frames.filter((frame) => frame.testRunFinished !== undefined);
  if (starts.length !== 1 || finishes.length !== 1 || finishes[0].testRunFinished.success !== true) return false;
  const runId = starts[0].testRunStarted.id;
  if (typeof runId !== "string" || finishes[0].testRunFinished.testRunStartedId !== runId) return false;
  const begin = capture.frames.indexOf(starts[0]);
  const end = capture.frames.indexOf(finishes[0]);
  if (begin >= end) return false;
  const pickles = [...capture.pickles.values()].filter((pickle) => scenarioIdFromTags(pickle.tags) === node.localId);
  const outline = (node.attributes?.examples?.length ?? 0) > 0 || /outline|template/iu.test(node.attributes?.scenarioKeyword ?? "");
  const expectedPickles = outline ? (node.attributes?.examples ?? []).reduce((sum, block) => sum + block.rows.length, 0) : 1;
  if (expectedPickles === 0 || pickles.length !== expectedPickles) return false;
  const expansionIds = new Set();
  for (const pickle of pickles) {
    const source = capture.sources.get(pickle.uri);
    if (typeof source?.data !== "string") return false;
    const sourceHash = sha256(Buffer.from(source.data, "utf8"));
    const documents = graph.nodes.filter((candidate) => candidate.kind === "DOCUMENT" && candidate.documentKind === "FEATURE" && candidate.attributes?.sourceSha256 === sourceHash);
    // Byte-identical source may be relocated, but must identify exactly one
    // corpus feature. A same-named scenario in another source is not evidence.
    if (documents.length !== 1 || documents[0].span.path !== node.span.path) return false;
    const expansionId = JSON.stringify(pickle.astNodeIds);
    if (!Array.isArray(pickle.astNodeIds) || pickle.astNodeIds.length === 0 || expansionIds.has(expansionId)) return false;
    expansionIds.add(expansionId);
    const cases = [...capture.testCases.values()].filter((testCase) => testCase.pickleId === pickle.id);
    if (cases.length !== 1 || cases[0].testRunStartedId !== runId || !Array.isArray(pickle.steps) || pickle.steps.length === 0) return false;
    const linkedSteps = (cases[0].testSteps ?? []).filter((step) => typeof step.pickleStepId === "string").map((step) => step.pickleStepId);
    if (linkedSteps.length !== pickle.steps.length || new Set(linkedSteps).size !== pickle.steps.length || !pickle.steps.every((step) => linkedSteps.includes(step.id))) return false;
    const attempts = [...capture.starts.values()].filter((start) => start.testCaseId === cases[0].id);
    const latest = attempts.at(-1);
    if (!latest || !attemptComplete(capture, latest)) return false;
    if (attempts.some((attempt) => typeof attempt.attempt !== "number" || attempt.attempt > latest.attempt)) return false;
    const results = capture.stepResults.get(latest.id) ?? [];
    if (!results.every((step) => step.testStepResult?.status === "PASSED")) return false;
    const startIndex = capture.frames.findIndex((frame) => frame.testCaseStarted === latest);
    const finishIndex = capture.frames.findIndex((frame) => frame.testCaseFinished === capture.finished.get(latest.id));
    if (!(begin < startIndex && startIndex < finishIndex && finishIndex < end)) return false;
    if (results.some((step) => {
      const index = capture.frames.findIndex((frame) => frame.testStepFinished === step);
      return index <= startIndex || index >= finishIndex;
    })) return false;
  }
  return true;
}

// Derived, read-only overlay: never changes authored nodes or document identity.
// Re-read evidence on every readiness call so an evidence-only update is visible.
export async function withReadinessEvidence(root, graph, spec) {
  const files = await evidenceSnapshot(root);
  const executionEvidence = {};
  for (const node of graph.nodes) {
    if (node.kind !== "SCENARIO" || (spec && node.specSlug !== spec)) continue;
    const selected = selectEvidence(files, graph, node);
    if (selected?.result.result !== "PASSED" || !provesExecution(selected.file.capture, graph, node)) continue;
    executionEvidence[node.canonicalId] = Object.freeze({
      result: "PASSED", graphFingerprint: graph.fingerprint, scenarioContentHash: node.contentHash,
      source: selected.result.source,
    });
  }
  return { ...graph, executionEvidence: Object.freeze(executionEvidence) };
}

export async function executeEvidenceOperation(root, graph, operation, args = {}) {
  if (!EVIDENCE_OPERATIONS.includes(operation)) return error("UNKNOWN_OPERATION", `unknown evidence operation: ${operation}`);
  if (typeof args.scenarioId !== "string" || args.scenarioId.trim() === "") return error("INVALID_PARAMETER", "scenarioId is required", { parameter: "scenarioId" });
  const resolved = findScenario(graph, args.scenarioId, args.spec ?? undefined);
  if (resolved.error) return resolved.error;
  const selected = selectEvidence(await evidenceSnapshot(root), graph, resolved.node);
  const evidence = selected?.result ?? { result: "NOT_RUN", stale: true, runId: null, lastRunAt: null, failingStep: null, traceStatus: "missing", source: null };
  const data = {
    kind: operation === "getScenarioTrace" ? "scenario-trace" : "test-result",
    scenarioId: resolved.node.canonicalId,
    result: evidence.result, stale: evidence.stale, runId: evidence.runId, lastRunAt: evidence.lastRunAt,
    failingStep: evidence.failingStep, traceStatus: evidence.traceStatus, source: evidence.source,
    evidenceBinding: { graphFingerprint: graph.fingerprint, scenarioContentHash: resolved.node.contentHash },
  };
  if (operation === "getScenarioTrace") data.trace = evidence.traceStatus === "available"
    ? { status: "bounded", path: evidence.source?.path ?? null, artifactSha256: evidence.source?.sha256 ?? null, failingStep: evidence.failingStep }
    : null;
  return success(data);
}
