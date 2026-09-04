import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { snapshotTree } from "../support/world.mjs";

export const V05_NEW_TOOL_NAMES = Object.freeze([
  "mcp_preflight",
  "spec_catalog",
  "spec_entities",
  "spec_graph",
  "spec_documents",
  "spec_inspect",
  "spec_tasks",
  "spec_evidence",
  "spec_markdown",
  "spec_propose_patch",
  "apply_proposed_patch",
]);

const OPERATIONS = Object.freeze({
  mcp_preflight: "mcpPreflight",
  spec_catalog: "catalog",
  spec_entities: "entities",
  spec_graph: "graph",
  spec_documents: "documents",
  spec_inspect: "inspect",
  spec_tasks: "tasks",
  spec_evidence: "evidence",
  spec_markdown: "markdown",
  spec_propose_patch: "proposePatch",
  apply_proposed_patch: "applyProposedPatch",
});

const EVIDENCE_DIR = ".omp-spec-kit/evidence";
const SCENARIO_ID = "product:SCEN-specification-only-init";

function structured(response) {
  assert.ok(response?.result, JSON.stringify(response));
  assert.equal(response.result.content?.length, 1, JSON.stringify(response));
  const value = response.result.structuredContent;
  assert.ok(value && typeof value === "object", JSON.stringify(response));
  const text = response.result.content[0].text;
  assert.equal(typeof text, "string");
  if (text.trimStart().startsWith("{")) assert.deepEqual(JSON.parse(text), value);
  else assert.ok(text.startsWith(value.operation), text);
  return value;
}

function assertNoLeaks(value, projectRoot, repositoryRoot) {
  const serialized = JSON.stringify(value);
  const absoluteProject = path.resolve(projectRoot).replaceAll("\\", "/");
  const absoluteRepository = path.resolve(repositoryRoot).replaceAll("\\", "/");
  assert.equal(serialized.includes(absoluteProject), false, "result must not expose the project path");
  assert.equal(serialized.includes(absoluteRepository), false, "result must not expose the repository path");
  assert.equal(serialized.includes("apiKey"), false, "result must not expose secret fields");
  assert.equal(serialized.includes("token"), false, "result must not expose token fields");
}

function assertRelativePaths(value) {
  const serialized = JSON.stringify(value);
  for (const match of serialized.matchAll(/"path":"([^"]+)"/gu)) {
    assert.equal(path.isAbsolute(match[1]), false, `path must be relative: ${match[1]}`);
  }
}

function assertEnvelope(value, name, requestId, projectRoot, repositoryRoot) {
  assert.equal(value.schemaVersion, "spec-kernel@1", name);
  assert.equal(value.requestId, requestId, name);
  assert.equal(value.operation, OPERATIONS[name], name);
  assert.equal(typeof value.ok, "boolean", name);
  assert.ok(Array.isArray(value.diagnostics), name);
  assertNoLeaks(value, projectRoot, repositoryRoot);
  assertRelativePaths(value);
}

function errorCode(value, expected) {
  assert.equal(value.ok, false, JSON.stringify(value));
  assert.equal(value.error?.code, expected, JSON.stringify(value));
}

function phaseOf(surface) {
  return typeof surface === "object" && surface !== null ? surface.phase ?? "all" : "all";
}

function restartOf(surface) {
  return typeof surface === "object" && surface !== null && typeof surface.restart === "function" ? surface.restart : null;
}

async function callRow({ callTool, name, args, projectRoot, repositoryRoot, requestId, allowEvidenceMutation = false }) {
  const before = await snapshotTree(projectRoot);
  const response = await callTool(name, { schemaVersion: "spec-kernel@1", requestId, ...args });
  const value = structured(response);
  assertEnvelope(value, name, requestId, projectRoot, repositoryRoot);
  const after = await snapshotTree(projectRoot);
  if (!allowEvidenceMutation) assert.deepEqual(after, before, `${name} must not mutate the temporary project`);
  return value;
}

async function callInvalid({ callTool, name, args, expected, projectRoot, repositoryRoot, requestId }) {
  const value = await callRow({ callTool, name, args, projectRoot, repositoryRoot, requestId });
  errorCode(value, expected);
  return value;
}

async function writeEvidence({ projectRoot, repositoryRoot, fixtureName, graphFingerprint, scenarioContentHash }) {
  const source = await readFile(path.join(repositoryRoot, "tests", "fixtures", "evidence", fixtureName), "utf8");
  const evidenceRoot = path.join(projectRoot, EVIDENCE_DIR);
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "last-test-run.ndjson"),
    source.replaceAll("__GRAPH_FINGERPRINT__", graphFingerprint).replaceAll("__SCENARIO_CONTENT_HASH__", scenarioContentHash),
    "utf8",
  );
}

async function runSuccessMatrix({ callTool, projectRoot, repositoryRoot }) {
  const V08_CONSOLIDATED_CASES = Object.freeze([
    ["spec_inspect", { check: "scenariosByTags", tags: ["@feature1"] }, (data) => {
      assert.equal(data.kind, "scenarios");
      assert.ok(data.count > 0);
      for (const scenario of data.scenarios) assert.ok(scenario.tags.includes("@feature1"));
    }],
    ["spec_tasks", { spec: "product", limit: 20 }, (data) => {
      assert.equal(data.kind, "tasks");
      for (const task of data.tasks) assert.equal(task.specSlug, "product");
    }],
    ["spec_inspect", { check: "orphans" }, (data) => {
      assert.equal(data.kind, "orphans");
      const ids = data.findings.map((finding) => finding.canonicalId);
      assert.deepEqual(ids, [...ids].sort());
      for (const finding of data.findings) assert.ok(["UNCOVERED_FR", "ORPHAN_TASK", "SCENARIO_TAG_ORPHAN"].includes(finding.code));
    }],
    ["spec_inspect", { check: "anchor", anchor: "plugin-distribution:FR-1" }, (data) => {
      assert.equal(data.kind, "spec-graph-id");
      assert.equal(data.registered, true);
      assert.equal(data.location.canonicalId, "plugin-distribution:FR-1");
    }],
    ["spec_catalog", { view: "specs" }, (data) => {
      assert.equal(data.kind, "specs");
      assert.deepEqual(data.specs, [...new Set(data.specs)].sort());
      assert.ok(data.specs.includes("product"));
    }],
    ["spec_inspect", { check: "requirementMetadata", metadata: {} }, (data) => {
      assert.equal(data.kind, "requirement-metadata");
      assert.equal(data.valid, true);
      assert.deepEqual(data.issues, []);
      assert.deepEqual(data.metadata, {});
    }],
    ["spec_inspect", { check: "requirementsPolicy" }, (data) => {
      assert.equal(data.kind, "requirement-policy");
      for (const result of data.results) assert.ok(["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT"].includes(result.kind));
    }],
    ["spec_inspect", { check: "archivalProof", spec: "product" }, (data) => {
      assert.equal(data.kind, "archival-proof");
      assert.ok(["ARCHIVE", "KEEP_FALSE_POSITIVE"].includes(data.verdict));
      assert.equal(data.count, data.liveInboundReferences.length);
    }],
    ["spec_inspect", { check: "validation", specSlugs: ["product"] }, (data) => {
      assert.equal(data.kind, "validation");
      assert.equal(data.scope.mode, "specifications");
      assert.deepEqual(data.scope.specSlugs, ["product"]);
      assert.equal(typeof data.valid, "boolean");
      assert.ok(["VALID", "INVALID"].includes(data.verdict));
      assert.equal(typeof data.counts?.total, "number");
      assert.equal(typeof data.counts?.matched, "number");
      assert.ok(Array.isArray(data.items));
    }],
    ["spec_catalog", { view: "status", spec: "product", statusView: "summary" }, (data) => {
      assert.equal(data.kind, "summary");
      assert.equal(data.specs.length, 1);
      assert.equal(data.specs[0].spec, "product");
    }],
    ["mcp_preflight", {}, (data) => {
      assert.equal(data.kind, "mcp-preflight");
      assert.equal(data.lockMode, "owner");
      assert.equal(data.writeMode, "proposal-first");
      assert.equal(data.mutationReady, true);
      assert.equal(data.worktree.matchesResolvedRoot, true);
    }],
    ["spec_documents", { action: "list", spec: "product" }, (data) => {
      assert.equal(data.kind, "spec-documents");
      assert.deepEqual(data.docs, [...data.docs].sort());
      assert.ok(data.docs.includes("FR.md"));
      assert.ok(data.attachments.includes("tool-e2e.bin"));
    }],
    ["spec_documents", { action: "read", spec: "product", doc: "FR.md", offset: 1, limit: 5 }, (data) => {
      assert.equal(data.kind, "document");
      assert.equal(data.startLine, 1);
      assert.equal(data.lines, 5);
      assert.equal(data.truncated, true);
      assert.ok(data.content.includes("# Functional requirements"));
    }],
    ["spec_documents", { action: "attachment", spec: "product", path: "tool-e2e.bin" }, (data) => {
      assert.equal(data.kind, "attachment");
      assert.equal(data.bytes, 15);
      assert.equal(Buffer.from(data.base64, "base64").toString("utf8"), "tool-e2e-bytes\n");
    }],
    ["spec_evidence", { view: "result", scenarioId: SCENARIO_ID }, (data) => {
      assert.equal(data.kind, "test-result");
      assert.equal(data.scenarioId, SCENARIO_ID);
      assert.ok(["NOT_RUN", "PASSED", "FAILED", "UNKNOWN"].includes(data.result));
      assert.equal(typeof data.stale, "boolean");
    }],
    ["spec_evidence", { view: "trace", scenarioId: SCENARIO_ID }, (data) => {
      assert.equal(data.kind, "scenario-trace");
      assert.equal(data.scenarioId, SCENARIO_ID);
      assert.ok(["NOT_RUN", "PASSED", "FAILED", "UNKNOWN"].includes(data.result));
      assert.equal(typeof data.stale, "boolean");
    }],
  ]);
  for (const [name, args, check] of V08_CONSOLIDATED_CASES) {
    const value = await callRow({ callTool, name, args, projectRoot, repositoryRoot, requestId: `tool-e2e-success-${name}` });
    check(value.data);
    if (value.page !== null) assert.ok(value.page.returned <= value.page.limit);
  }
}

async function runInvalidMatrix({ callTool, projectRoot, repositoryRoot }) {
  const cases = [
    ["spec_inspect", { check: "scenariosByTags", tags: [] }, "INVALID_PARAMETER"],
    ["spec_tasks", { spec: "product", limit: 201 }, "LIMIT_EXCEEDED"],
    ["spec_tasks", { spec: "product", limit: 0 }, "INVALID_REQUEST"],
    ["spec_inspect", { check: "orphans", unexpected: true }, "UNKNOWN_FIELD"],
    ["spec_inspect", { check: "anchor", anchor: "" }, "INVALID_PARAMETER"],
    ["spec_catalog", { view: "specs", unexpected: true }, "UNKNOWN_FIELD"],
    ["spec_inspect", { check: "requirementsPolicy", verificationMethod: "bad" }, "INVALID_REQUEST"],
    ["spec_inspect", { check: "archivalProof", spec: "bad!" }, "INVALID_PARAMETER"],
    ["spec_inspect", { check: "validation", specSlugs: ["bad!"] }, "INVALID_PARAMETER"],
    ["spec_inspect", { check: "validation", specSlugs: ["unknown-missing"] }, "NOT_FOUND"],
    ["spec_inspect", { check: "specValidation", spec: "product" }, "INVALID_REQUEST"],
    ["spec_inspect", { check: "diagnostics" }, "INVALID_REQUEST"],
    ["spec_inspect", { check: "validation", spec: "product" }, "INVALID_REQUEST"],
    ["spec_catalog", { view: "status", spec: "product", statusView: "bad" }, "INVALID_REQUEST"],
    ["mcp_preflight", { unexpected: true }, "UNKNOWN_FIELD"],
    ["spec_documents", { action: "list", spec: "missing" }, "NOT_FOUND"],
    ["spec_documents", { action: "read", spec: "product", doc: "../FR.md", offset: 1, limit: 1 }, "PATH_FORBIDDEN"],
    ["spec_documents", { action: "attachment", spec: "product", path: "../FR.md" }, "PATH_FORBIDDEN"],
    ["spec_evidence", { view: "result" }, "INVALID_REQUEST"],
    ["spec_evidence", { view: "trace" }, "INVALID_REQUEST"],
    ["spec_evidence", { view: "result", scenarioId: "product:SCEN-unknown" }, "SCENARIO_NOT_FOUND"],
    ["spec_evidence", { view: "trace", scenarioId: "product:SCEN-unknown" }, "SCENARIO_NOT_FOUND"],
  ];
  for (const [name, args, expected] of cases) {
    await callInvalid({ callTool, name, args, expected, projectRoot, repositoryRoot, requestId: "tool-e2e-invalid-" + name });
  }
  const metadataValue = await callRow({
    callTool,
    name: "spec_inspect",
    args: { check: "requirementMetadata", metadata: { verificationMethod: "bad" } },
    projectRoot,
    repositoryRoot,
    requestId: "tool-e2e-invalid-requirementMetadata",
  });
  assert.equal(metadataValue.ok, true);
  assert.equal(metadataValue.data.valid, false);
  assert.ok(metadataValue.data.issues.some((issue) => issue.field === "verificationMethod"));
  const aliases = await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "tool-e2e-invalid-array", view: "specs", spec_slugs: [] });
  const aliasValue = structured(aliases);
  assert.equal(aliasValue.ok, false);
  assert.equal(aliasValue.error.code, "INVALID_REQUEST");
}

async function runBoundaryMatrix({ callTool, projectRoot, repositoryRoot, outsideRoot }) {
  const page = await callRow({ callTool, name: "spec_tasks", args: { spec: "product", limit: 1 }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-page" });
  assert.equal(page.page.limit, 1);
  assert.equal(page.page.returned, 1);
  if (page.page.nextCursor !== null) {
    const cursorValue = await callRow({ callTool, name: "spec_tasks", args: { spec: "product", limit: 1, cursor: page.page.nextCursor }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-cursor" });
    assert.ok(cursorValue.page.returned <= 1);
  }

  const tagAlias = await callRow({ callTool, name: "spec_inspect", args: { check: "scenariosByTags", tags: ["feature1"] }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-tag-alias" });
  assert.equal(tagAlias.data.count, (await callRow({ callTool, name: "spec_inspect", args: { check: "scenariosByTags", tags: ["@feature1"] }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-tag-canonical" })).data.count);
  const filteredTasks = await callRow({ callTool, name: "spec_tasks", args: { spec: "product", statuses: ["planned"], limit: 20 }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-task-filter" });
  for (const task of filteredTasks.data.tasks) assert.equal(task.status, "planned");
  const missingMethod = await callRow({ callTool, name: "spec_inspect", args: { check: "requirementsPolicy", verificationMethodMissing: true }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-policy-filter" });
  for (const result of missingMethod.data.results) assert.equal(result.metadata, null);
  const markdownAnchor = await callRow({ callTool, name: "spec_inspect", args: { check: "anchor", anchor: ".specs/product/FR.md#fr-1--specification-first-public-init" }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-markdown-anchor" });
  assert.equal(markdownAnchor.data.registered, true);
  for (const view of ["status", "summary", "counts", "coverage"]) {
    const status = await callRow({ callTool, name: "spec_catalog", args: { view: "status", spec: "product", statusView: view }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-status-" + view });
    assert.equal(status.data.specs.length, 1);
    assert.equal(status.data.specs[0].spec, "product");
  }
  const largeAttachment = path.join(projectRoot, ".specs", "product", "tool-e2e-large.bin");
  await writeFile(largeAttachment, Buffer.alloc(8 * 1024 * 1024 + 1, 7));
  await callInvalid({ callTool, name: "spec_documents", args: { action: "attachment", spec: "product", path: "tool-e2e-large.bin" }, expected: "LIMIT_EXCEEDED", projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-large-attachment" });
  await rm(largeAttachment, { force: true });
  const section = await callRow({ callTool, name: "spec_documents", args: { action: "read", spec: "product", doc: "FR.md", section: "FR-1 — Specification-first public init", offset: 1, limit: 20 }, projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-section" });
  assert.ok(section.data.content.includes("FR-1"));
  await callInvalid({ callTool, name: "spec_documents", args: { action: "read", spec: "product", doc: "FR.md", offset: 0, limit: 1 }, expected: "INVALID_REQUEST", projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-offset" });
  await callInvalid({ callTool, name: "spec_documents", args: { action: "read", spec: "product", doc: "missing.md" }, expected: "DOC_NOT_FOUND", projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-missing-doc" });
  await callInvalid({ callTool, name: "spec_documents", args: { action: "attachment", spec: "product", path: "FR.md" }, expected: "ATTACHMENT_NOT_FOUND", projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-text-attachment" });
  if (outsideRoot) {
    await callInvalid({ callTool, name: "spec_documents", args: { action: "read", spec: "product", doc: "../../.omp-spec-kit/evidence/outside-link/secret.md" }, expected: "PATH_FORBIDDEN", projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-symlink-doc" });
    await callInvalid({ callTool, name: "spec_documents", args: { action: "attachment", spec: "product", path: "../../.omp-spec-kit/evidence/outside-link/secret.bin" }, expected: "PATH_FORBIDDEN", projectRoot, repositoryRoot, requestId: "tool-e2e-boundary-symlink-attachment" });
  }
}

async function runMutationMatrix({ callTool, projectRoot, repositoryRoot, surface }) {
  const restart = restartOf(surface);
  assert.ok(restart !== null, "tool-E2E mutation proof requires a restart-capable adapter");
  const taskPath = path.join(projectRoot, ".specs", "product", "TASKS.md");
  const originalTasks = await readFile(taskPath, "utf8");
  const cursorSeed = await callRow({ callTool, name: "spec_tasks", args: { spec: "product", limit: 1 }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-cursor-seed" });
  assert.ok(cursorSeed.page.nextCursor, "fixture must provide a next cursor");
  await writeFile(taskPath, originalTasks + "\n\nTool E2E cursor mutation.\n", "utf8");
  await restart();
  const staleCursor = await callRow({ callTool, name: "spec_tasks", args: { spec: "product", limit: 1, cursor: cursorSeed.page.nextCursor }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-stale-cursor" });
  assert.equal(staleCursor.ok, false);
  assert.equal(staleCursor.error.code, "STALE_CURSOR");
  await writeFile(taskPath, originalTasks, "utf8");
  await restart();
  const overview = await callRow({ callTool, name: "spec_catalog", args: { view: "overview", specSlugs: [] }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-overview" });
  const node = await callRow({ callTool, name: "spec_entities", args: { mode: "get", canonicalId: SCENARIO_ID, projection: "summary", includeIncidentCounts: false }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-node" });
  const graphFingerprint = overview.graph.fingerprint;
  const scenarioContentHash = node.data.node.contentHash;
  const evidencePath = path.join(projectRoot, EVIDENCE_DIR, "last-test-run.ndjson");
  await rm(evidencePath, { force: true });
  const notRun = await callRow({ callTool, name: "spec_evidence", args: { view: "result", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-not-run" });
  assert.equal(notRun.data.result, "NOT_RUN");
  assert.equal(notRun.data.stale, true);
  const notRunTrace = await callRow({ callTool, name: "spec_evidence", args: { view: "trace", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-not-run-trace" });
  assert.equal(notRunTrace.data.result, "NOT_RUN");
  assert.equal(notRunTrace.data.trace, null);
  await writeEvidence({ projectRoot, repositoryRoot, fixtureName: "v05-passing.ndjson", graphFingerprint, scenarioContentHash });
  const passing = await callRow({ callTool, name: "spec_evidence", args: { view: "result", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-passing" });
  assert.equal(passing.data.result, "PASSED");
  assert.equal(passing.data.stale, false);
  const trace = await callRow({ callTool, name: "spec_evidence", args: { view: "trace", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-trace" });
  assert.equal(trace.data.result, "PASSED");

  await writeEvidence({ projectRoot, repositoryRoot, fixtureName: "v05-failed.ndjson", graphFingerprint, scenarioContentHash });
  const failed = await callRow({ callTool, name: "spec_evidence", args: { view: "result", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-failed" });
  assert.equal(failed.data.result, "FAILED");
  assert.equal(failed.data.stale, true);
  const failedTrace = await callRow({ callTool, name: "spec_evidence", args: { view: "trace", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-failed-trace" });
  assert.equal(failedTrace.data.result, "FAILED");
  assert.ok(failedTrace.data.trace && failedTrace.data.trace.status);
  await writeEvidence({ projectRoot, repositoryRoot, fixtureName: "v05-incomplete.ndjson", graphFingerprint, scenarioContentHash });
  const incomplete = await callRow({ callTool, name: "spec_evidence", args: { view: "result", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-incomplete" });
  assert.equal(incomplete.data.result, "UNKNOWN");
  assert.equal(incomplete.data.stale, true);
  const incompleteTrace = await callRow({ callTool, name: "spec_evidence", args: { view: "trace", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-incomplete-trace" });
  assert.equal(incompleteTrace.data.result, "UNKNOWN");
  assert.ok(incompleteTrace.data.trace === null || !incompleteTrace.data.trace.status);
  const scenarioPath = path.join(projectRoot, ".specs", "product", "FR.md");
  const originalScenario = await readFile(scenarioPath, "utf8");
  await writeEvidence({ projectRoot, repositoryRoot, fixtureName: "v05-passing.ndjson", graphFingerprint, scenarioContentHash });
  await writeFile(scenarioPath, originalScenario + "\n\nTool E2E corpus mutation.\n", "utf8");
  await restart();
  const changed = await callRow({ callTool, name: "spec_evidence", args: { view: "result", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-scenario" });
  assert.equal(changed.data.result, "UNKNOWN", JSON.stringify(changed.data));
  assert.equal(changed.data.stale, true);
  await writeFile(scenarioPath, originalScenario, "utf8");
  await restart();

  const featurePath = path.join(projectRoot, ".specs", "product", "product.feature");
  const originalFeature = await readFile(featurePath, "utf8");
  await writeEvidence({ projectRoot, repositoryRoot, fixtureName: "v05-passing.ndjson", graphFingerprint, scenarioContentHash });
  await writeFile(featurePath, originalFeature.replace("Scenario: Specification-only init reports no installable plugin", "Scenario: Specification-only init reports no installable plugin changed"), "utf8");
  await restart();
  const scenarioMutation = await callRow({ callTool, name: "spec_evidence", args: { view: "result", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-scenario" });
  assert.equal(scenarioMutation.data.result, "UNKNOWN", JSON.stringify(scenarioMutation.data));
  assert.equal(scenarioMutation.data.stale, true);
  await writeFile(featurePath, originalFeature, "utf8");
  await restart();

  await writeFile(evidencePath, "malformed evidence\n", "utf8");
  const malformed = await callRow({ callTool, name: "spec_evidence", args: { view: "trace", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-malformed" });
  assert.equal(malformed.data.result, "UNKNOWN");
  const malformedResult = await callRow({ callTool, name: "spec_evidence", args: { view: "result", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-malformed-result" });
  assert.equal(malformedResult.data.result, "UNKNOWN");
  const largeEvidence = Buffer.alloc(16 * 1024 * 1024 + 1, 1);
  await writeFile(evidencePath, largeEvidence);
  const oversizedResult = await callRow({ callTool, name: "spec_evidence", args: { view: "result", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-large-result" });
  assert.equal(oversizedResult.data.result, "NOT_RUN");
  const oversizedTrace = await callRow({ callTool, name: "spec_evidence", args: { view: "trace", scenarioId: SCENARIO_ID }, projectRoot, repositoryRoot, requestId: "tool-e2e-mutation-large-trace" });
  assert.equal(oversizedTrace.data.result, "NOT_RUN");
  await rm(evidencePath, { force: true });
}

export async function prepareEvidenceFixtures(projectRoot) {
  const productRoot = path.join(projectRoot, ".specs", "product");
  await writeFile(path.join(productRoot, "tool-e2e.bin"), Buffer.from("tool-e2e-bytes\n", "utf8"));
  await writeFile(path.join(productRoot, "TASKS.md"), `${await readFile(path.join(productRoot, "TASKS.md"), "utf8")}\n## TASK-99 — Tool E2E fixture\n\n- **Status:** Planned\n- **Phase:** tool-e2e\n`, "utf8");
}

export async function runEvidenceE2E({ listTools, callTool, projectRoot, repositoryRoot, surface = "built" }) {
  const phase = phaseOf(surface);
  const outsideRoot = typeof surface === "object" && surface !== null ? surface.outsideRoot : null;
  if (phase === "inventory") throw new Error("inventory moved to tool-e2e matrix");
  if (phase === "success") return runSuccessMatrix({ callTool, projectRoot, repositoryRoot });
  if (phase === "invalid") return runInvalidMatrix({ callTool, projectRoot, repositoryRoot });
  if (phase === "boundary") return runBoundaryMatrix({ callTool, projectRoot, repositoryRoot, outsideRoot });
  if (phase === "mutation") return runMutationMatrix({ callTool, projectRoot, repositoryRoot, surface });
  await runSuccessMatrix({ callTool, projectRoot, repositoryRoot });
  await runInvalidMatrix({ callTool, projectRoot, repositoryRoot });
  await runBoundaryMatrix({ callTool, projectRoot, repositoryRoot, outsideRoot });
  await runMutationMatrix({ callTool, projectRoot, repositoryRoot, surface });
  return { toolCount: 11 };
}
