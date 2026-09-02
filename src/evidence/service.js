import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MAX_EVIDENCE_FILES = 32;
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
  for (const relative of EVIDENCE_NAMES) {
    const absolute = path.join(root, ...relative.split("/"));
    try {
      const bytes = await readFile(absolute);
      if (bytes.length <= MAX_EVIDENCE_BYTES) files.push({ relative, bytes, sha256: sha256(bytes) });
    } catch {
      // Evidence is optional. Missing files become an explicit NOT_RUN result.
    }
    if (files.length >= MAX_EVIDENCE_FILES) break;
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

function parseMessages(bytes) {
  const frames = [];
  for (const line of bytes.toString("utf8").split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const frame = JSON.parse(line);
      if (isObject(frame)) frames.push(frame);
    } catch {
      // A malformed line cannot become evidence; keep other producer frames available.
    }
  }
  return frames;
}

function resultForScenario(frames, localId) {
  const pickles = new Map();
  const testCases = new Map();
  const starts = new Map();
  const stepResults = new Map();
  const finished = new Map();
  let captureBinding = null;
  for (const frame of frames) {
    if (isObject(frame.ompSpecKitEvidence) && isObject(frame.ompSpecKitEvidence.binding)) captureBinding = frame.ompSpecKitEvidence.binding;
    if (isObject(frame.pickle)) {
      const id = scenarioIdFromTags(frame.pickle.tags);
      if (id === localId && typeof frame.pickle.id === "string") pickles.set(frame.pickle.id, frame.pickle);
    }
    if (isObject(frame.testCase) && typeof frame.testCase.id === "string") testCases.set(frame.testCase.id, frame.testCase);
    if (isObject(frame.testCaseStarted) && typeof frame.testCaseStarted.id === "string") starts.set(frame.testCaseStarted.id, frame.testCaseStarted);
    if (isObject(frame.testStepFinished) && typeof frame.testStepFinished.testCaseStartedId === "string") {
      const list = stepResults.get(frame.testStepFinished.testCaseStartedId) ?? [];
      list.push(frame.testStepFinished);
      stepResults.set(frame.testStepFinished.testCaseStartedId, list);
    }
    if (isObject(frame.testCaseFinished) && typeof frame.testCaseFinished.testCaseStartedId === "string") finished.set(frame.testCaseFinished.testCaseStartedId, frame.testCaseFinished);
  }
  const pickleIds = new Set(pickles.keys());
  const matchingCases = [...testCases.values()].filter((testCase) => pickleIds.has(testCase.pickleId));
  const matchingCaseIds = new Set(matchingCases.map((testCase) => testCase.id));
  const matchingStarts = [...starts.values()].filter((start) => matchingCaseIds.has(start.testCaseId));
  if (matchingStarts.length === 0) return { result: "NOT_RUN", stale: true, runId: null, lastRunAt: null, failingStep: null, traceStatus: "missing", source: null, captureBinding };
  const latest = matchingStarts[matchingStarts.length - 1];
  const results = stepResults.get(latest.id) ?? [];
  const finishedRecord = finished.get(latest.id);
  const matchingCase = matchingCases.find((testCase) => testCase.id === latest.testCaseId);
  const expectedStepIds = Array.isArray(matchingCase?.testSteps)
    ? matchingCase.testSteps.map((step) => step?.id).filter((id) => typeof id === "string")
    : [];
  const actualStepIds = results.map((entry) => entry.testStepId).filter((id) => typeof id === "string");
  const expectedStepsComplete =
    expectedStepIds.length > 0 &&
    actualStepIds.length === expectedStepIds.length &&
    new Set(actualStepIds).size === expectedStepIds.length &&
    expectedStepIds.every((id) => actualStepIds.includes(id));
  const complete =
    finishedRecord !== undefined &&
    finishedRecord.willBeRetried !== true &&
    expectedStepsComplete &&
    frames.some((frame) => frame.testRunFinished !== undefined);
  const statuses = results.map((entry) => entry.testStepResult?.status);
  const failed = results.find((entry) => entry.testStepResult?.status === "FAILED");
  const hasUndefined = statuses.includes("UNDEFINED");
  const hasSkipped = statuses.includes("SKIPPED");
  const allPassed = complete && statuses.length > 0 && statuses.every((status) => status === "PASSED");
  const result = failed ? "FAILED" : hasUndefined ? "UNDEFINED" : hasSkipped ? "SKIPPED" : allPassed ? "PASSED" : "UNKNOWN";
  return {
    result,
    stale: result !== "PASSED",
    runId: latest.testCaseStartedId ?? latest.id,
    lastRunAt: timestampOf(latest),
    failingStep: failed ? { stepId: failed.testStepId ?? null, message: failed.testStepResult?.message ?? null } : null,
    traceStatus: results.length > 0 ? "available" : "missing",
    source: { scenarioId: localId, pickleId: matchingCases[matchingCases.length - 1]?.pickleId ?? null },
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

export async function executeEvidenceOperation(root, graph, operation, args = {}) {
  if (!EVIDENCE_OPERATIONS.includes(operation)) return error("UNKNOWN_OPERATION", `unknown evidence operation: ${operation}`);
  if (typeof args.scenarioId !== "string" || args.scenarioId.trim() === "") return error("INVALID_PARAMETER", "scenarioId is required", { parameter: "scenarioId" });
  const resolved = findScenario(graph, args.scenarioId, args.spec ?? undefined);
  if (resolved.error) return resolved.error;
  const files = await evidenceFiles(root);
  const parsedFiles = files.map((file) => ({ ...file, result: resultForScenario(parseMessages(file.bytes), resolved.node.localId) }));
  const withSource = (entry, file) => {
    const captureBinding = entry.result.captureBinding;
    const bindingMismatch = captureBinding && (
      captureBinding.graphFingerprint !== graph.fingerprint ||
      captureBinding.scenarioContentHash !== resolved.node.contentHash
    );
    const result = bindingMismatch ? { ...entry.result, result: "UNKNOWN", stale: true, traceStatus: "missing" } : entry.result;
    const { captureBinding: _captureBinding, ...withoutBinding } = result;
    return { ...withoutBinding, source: { ...(result.source ?? {}), path: file.relative, sha256: file.sha256 } };
  };
  const evidence = parsedFiles.length === 0
    ? { result: "NOT_RUN", stale: true, runId: null, lastRunAt: null, failingStep: null, traceStatus: "missing", source: null }
    : parsedFiles.map((entry) => withSource(entry, entry)).find((item) => item.result !== "NOT_RUN") ?? withSource(parsedFiles[parsedFiles.length - 1], parsedFiles[parsedFiles.length - 1]);
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
    evidenceBinding: { graphFingerprint: graph.fingerprint, scenarioContentHash: resolved.node.contentHash },
  };
  if (operation === "getScenarioTrace") data.trace = evidence.traceStatus === "available"
    ? { status: "bounded", path: evidence.source?.path ?? null, artifactSha256: evidence.source?.sha256 ?? null, failingStep: evidence.failingStep }
    : null;
  return success(data);
}
