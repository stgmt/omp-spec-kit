import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Given, Then, When, After } from "@cucumber/cucumber";
import { classifyToolCall } from "../../src/enforcement/classifier.js";
import { annotationsFor, MCP_SERVER_INSTRUCTIONS, TOOL_CONTRACTS } from "../../src/adapters/tool-contracts.js";
import { createTempRepo, loadFrozenRealCorpus, writeCorpus } from "../helpers/kernel-world.mjs";
import { runEvidenceE2E, prepareEvidenceFixtures } from "../helpers/evidence-e2e.mjs";
import { runToolE2E, ALL_TOOL_NAMES, prepareToolE2EFixtures } from "../helpers/tool-e2e.mjs";
import { runExtensionProbe, spawnMcpServer } from "../helpers/mcp-world.mjs";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SERVER_PATH = path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "dist", "mcp", "server.js");

const READ_COMPLETE_CALLS = Object.freeze([
  ["mcp_preflight", {}],
  ["spec_catalog", { view: "specs" }],
  ["spec_catalog", { view: "types" }],
  ["spec_catalog", { view: "overview" }],
  ["spec_catalog", { view: "inventory", limit: 20 }],
  ["spec_catalog", { view: "status", spec: "product", statusView: "summary" }],
  ["spec_entities", { mode: "find", kinds: ["FUNCTIONAL_REQUIREMENT"] }],
  ["spec_entities", { mode: "get", canonicalId: "product:FR-1" }],
  ["spec_graph", { view: "edges", canonicalId: "product:FR-1" }],
  ["spec_graph", { view: "trace", canonicalId: "product:FR-1" }],
  ["spec_documents", { action: "list", spec: "product" }],
  ["spec_documents", { action: "read", spec: "product", doc: "FR.md", offset: 1, limit: 20 }],
  ["spec_documents", { action: "attachment", spec: "product", path: "FR.md" }],
  ["spec_inspect", { check: "orphans" }],
  ["spec_inspect", { check: "diagnostics", limit: 20 }],
  ["spec_tasks", { spec: "product", limit: 20 }],
  ["spec_evidence", { view: "result", scenarioId: "product:SCEN-specification-only-init" }],
  ["spec_markdown", { specSlugs: ["product"] }],
]);

async function startWorld() {
  const root = await createTempRepo();
  const frozen = await loadFrozenRealCorpus(REPOSITORY_ROOT);
  await writeCorpus(root, frozen.files);
  await prepareEvidenceFixtures(root);
  const outsideRoot = path.join(path.dirname(root), path.basename(root) + "-outside");
  await mkdir(outsideRoot, { recursive: true });
  await writeFile(path.join(outsideRoot, "secret.md"), "outside secret", "utf8");
  await writeFile(path.join(outsideRoot, "secret.bin"), Buffer.from("outside-bytes", "utf8"));
  await mkdir(path.join(root, ".omp-spec-kit", "evidence"), { recursive: true });
  await symlink(outsideRoot, path.join(root, ".omp-spec-kit", "evidence", "outside-link"), "junction");
  return { root, outsideRoot, server: spawnMcpServer({ serverPath: SERVER_PATH, root, cwd: root, env: {} }) };
}

Given("a real staged MCP corpus and packaged server", async function () {
  this.stagedMcp = await startWorld();
});

When("the registry and every handler are called", async function () {
  const initialized = await this.stagedMcp.server.request("initialize", { protocolVersion: "2025-03-26" });
  assert.equal(initialized.result.serverInfo.name, "omp-spec-kit");
  assert.equal(initialized.result.instructions, MCP_SERVER_INSTRUCTIONS);
  const listed = await this.stagedMcp.server.request("tools/list");
  this.stagedMcp.listedNames = listed.result.tools.map((tool) => tool.name);
  for (const tool of listed.result.tools) {
    const contract = TOOL_CONTRACTS.find((candidate) => candidate.tool === tool.name);
    assert.ok(contract, tool.name);
    assert.equal(tool.title, contract.label, tool.name);
    assert.equal(tool.description.split(/\r?\n/u, 1)[0].trim().length <= 200, true, tool.name);
    assert.deepEqual(tool.annotations, annotationsFor(contract), tool.name);
  }
  this.stagedMcp.results = [];
  for (const [name, arguments_] of READ_COMPLETE_CALLS) {
    const response = await this.stagedMcp.server.request("tools/call", { name, arguments: { schemaVersion: "spec-kernel@1", requestId: `bdd-${name}`, ...arguments_ } });
    this.stagedMcp.results.push({ name, response });
  }
});

Then("the registry has exactly 11 names and every call has a bounded envelope", function () {
  assert.equal(this.stagedMcp.listedNames.length, 11);
  assert.equal(new Set(this.stagedMcp.listedNames).size, 11);
  for (const name of ALL_TOOL_NAMES) assert.ok(this.stagedMcp.listedNames.includes(name), `${name} must remain registered`);
  assert.equal(this.stagedMcp.results.length, READ_COMPLETE_CALLS.length);
  for (const { name, response } of this.stagedMcp.results) {
    assert.ok(response.result, `${name} must return a JSON-RPC result`);
    assert.equal(response.result.content.length, 1, `${name} must return one summary content item`);
    assert.ok(response.result.structuredContent, `${name} must return structured content`);
    assert.equal(typeof response.result.structuredContent.ok, "boolean", `${name} must expose an explicit result status`);
  }
});

When("an authoring proposal is created and explicitly approved", async function () {
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({ serverPath: SERVER_PATH, root: this.stagedMcp.root, cwd: this.stagedMcp.root, env: {} });
  const overview = await this.stagedMcp.server.request("tools/call", { name: "spec_catalog", arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-overview", view: "overview", specSlugs: [] } });
  const fingerprint = overview.result.structuredContent.graph.fingerprint;
  const proposalResponse = await this.stagedMcp.server.request("tools/call", {
    name: "spec_propose_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-proposal",
      intent: "patch",
      repositoryRootFingerprint: fingerprint,
      spec: "product",
      reason: "verify proposal before apply",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "BDD authoring marker" }],
    },
  });
  const proposal = proposalResponse.result.structuredContent;
  assert.equal(proposal.ok, true, JSON.stringify(proposal));
  const expectedDocuments = proposal.data.operations.map((operation) => ({ path: operation.path, beforeSha256: operation.beforeSha256 }));
  const applied = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-apply",
      proposalId: proposal.data.proposalId,
      proposalSha256: proposal.data.proposalHash,
      expectedDocuments,
      reason: "approve exact proposal",
      approval: "approve",
    },
  });
  this.stagedMcp.apply = applied.result.structuredContent;
  const appendOverview = await this.stagedMcp.server.request("tools/call", { name: "spec_catalog", arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-append-overview", view: "overview", specSlugs: [] } });
  const appendFingerprint = appendOverview.result.structuredContent.graph.fingerprint;
  const append = await this.stagedMcp.server.request("tools/call", {
    name: "spec_propose_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-append",
      intent: "patch",
      repositoryRootFingerprint: appendFingerprint,
      spec: "product",
      reason: "verify section append preserves the document",
      operations: [{ kind: "insert_after_heading", document: "README.md", heading: "Current product status", text: "\nBDD append marker\n" }],
    },
  });
  const appendProposal = append.result.structuredContent;
  assert.equal(appendProposal.ok, true, JSON.stringify(appendProposal));
  const appendExpectedDocuments = appendProposal.data.operations.map((operation) => ({ path: operation.path, beforeSha256: operation.beforeSha256 }));
  const appendApplied = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-append-apply",
      proposalId: appendProposal.data.proposalId,
      proposalSha256: appendProposal.data.proposalHash,
      expectedDocuments: appendExpectedDocuments,
      reason: "approve section append",
      approval: "approve",
    },
  });
  this.stagedMcp.append = { proposal: appendProposal, applied: appendApplied.result.structuredContent };
  const refreshedOverview = await this.stagedMcp.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-rename-overview", view: "overview", specSlugs: [] },
  });
  const renameProposalResponse = await this.stagedMcp.server.request("tools/call", {
    name: "spec_propose_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-rename",
      intent: "patch",
      repositoryRootFingerprint: refreshedOverview.result.structuredContent.graph.fingerprint,
      spec: "product",
      reason: "verify heading rename preserves the document",
      operations: [{ kind: "replace_in_section", document: "README.md", heading: "Current product status", oldText: "Current product status", newText: "Current product status renamed" }],
    },
  });
  const renameProposal = renameProposalResponse.result.structuredContent;
  assert.equal(renameProposal.ok, true, JSON.stringify(renameProposal));
  const renameExpectedDocuments = renameProposal.data.operations.map((operation) => ({ path: operation.path, beforeSha256: operation.beforeSha256 }));
  const renameApplied = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-rename-apply",
      proposalId: renameProposal.data.proposalId,
      proposalSha256: renameProposal.data.proposalHash,
      expectedDocuments: renameExpectedDocuments,
      reason: "approve heading rename",
      approval: "approve",
    },
  });
  this.stagedMcp.rename = { proposal: renameProposal, applied: renameApplied.result.structuredContent };
});

Then("the approved proposal changes the temporary document, section edits preserve it, and direct spec writes are refused", async function () {
  assert.equal(this.stagedMcp.apply.ok, true, JSON.stringify(this.stagedMcp.apply));
  const content = await readFile(path.join(this.stagedMcp.root, ".specs", "product", "README.md"), "utf8");
  assert.ok(content.includes("BDD authoring marker"), "approved proposal must change the real temporary document");
  assert.equal(this.stagedMcp.append.applied.ok, true, JSON.stringify(this.stagedMcp.append.applied));
  assert.equal((content.match(/^# Product specification$/gmu) ?? []).length, 1, "section append must not duplicate the document");
  assert.equal((content.match(/BDD append marker/g) ?? []).length, 1, "section append must add exactly one marker");
  assert.equal(this.stagedMcp.rename.applied.ok, true, JSON.stringify(this.stagedMcp.rename.applied));
  assert.equal((content.match(/^## Current product status renamed$/gmu) ?? []).length, 1, "heading rename must preserve one document");
  assert.equal((content.match(/^## Current product status$/gmu) ?? []).length, 0, "heading rename must replace the old heading");
  const blocked = classifyToolCall({ toolName: "write", input: { path: ".specs/plugin-distribution/README.md", content: "bypass" } });
  assert.equal(blocked.action, "block");
  assert.equal(blocked.mismatchField, null);
  const allowed = classifyToolCall({ toolName: "mcp__omp_spec_kit_apply_proposed_patch", input: { approval: "approve" } });
  const allowedProposal = classifyToolCall({ toolName: "mcp__omp_spec_kit_spec_propose_patch", input: { reason: "probe" } });
  const removedMinted = classifyToolCall({ toolName: "mcp__omp_spec_kit_apply_spec_change", input: { approval: "approve" } });
  const removedShort = classifyToolCall({ toolName: "apply_spec_change", input: { approval: "approve" } });
  assert.equal(allowed.action, "allow");
  assert.equal(allowed.code, "AUTHORING_TOOL_ALLOWED");
  assert.equal(allowedProposal.action, "allow");
  assert.equal(allowedProposal.code, "AUTHORING_TOOL_ALLOWED");
  assert.notEqual(removedMinted.action, "allow");
  assert.notEqual(removedShort.action, "allow");
});

When("authoring safety guards are exercised", async function () {
  await this.stagedMcp.server.close();
  const outside = await mkdtemp(path.join(tmpdir(), "omp-staged-outside-"));
  this.stagedMcp.outside = outside;
  await symlink(outside, path.join(this.stagedMcp.root, ".specs", "evil"), "junction");
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: {},
  });
  const linked = await this.stagedMcp.server.request("tools/call", {
    name: "spec_propose_patch",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-linked-create", intent: "createSpec", spec: "evil", reason: "reject linked path", title: "Escape" },
  });
  const existing = await this.stagedMcp.server.request("tools/call", {
    name: "spec_propose_patch",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-existing-create", intent: "createSpec", spec: "product", reason: "reject overwrite", title: "Overwrite" },
  });
  this.stagedMcp.safety = { linked: linked.result.structuredContent, existing: existing.result.structuredContent };
});

Then("linked and existing specification mutations are refused without external writes", async function () {
  assert.equal(this.stagedMcp.safety.linked.ok, false, JSON.stringify(this.stagedMcp.safety.linked));
  assert.equal(this.stagedMcp.safety.linked.error.code, "PATH_FORBIDDEN");
  assert.equal(this.stagedMcp.safety.existing.ok, false, JSON.stringify(this.stagedMcp.safety.existing));
  assert.equal(this.stagedMcp.safety.existing.error.code, "CONFLICT");
  assert.deepStrictEqual(await readdir(this.stagedMcp.outside), []);
});

When("the read server receives alias and unknown-field calls", async function () {
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: {},
  });
  const alias = await this.stagedMcp.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-alias", view: "inventory", spec_slugs: [], include_documents: false, limit: 1, cursor: null },
  });
  const unknown = await this.stagedMcp.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-unknown", view: "specs", unexpected: true },
  });
  const invalidShape = await this.stagedMcp.server.request("tools/call", {
    name: "spec_catalog",
    arguments: [],
  });
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: { OMP_SPEC_KIT_TEST_STAGE: "future" },
  });
  const hidden = await this.stagedMcp.server.request("tools/list");
  this.stagedMcp.inputResults = {
    alias: alias.result.structuredContent,
    unknown: unknown.result.structuredContent,
    invalidShape: invalidShape.result.structuredContent,
    hiddenNames: hidden.result.tools.map((tool) => tool.name),
  };
});

Then("aliases work, unknown fields fail, and removed tools stay unknown", function () {
  assert.equal(this.stagedMcp.inputResults.alias.ok, true, JSON.stringify(this.stagedMcp.inputResults.alias));
  assert.equal(this.stagedMcp.inputResults.alias.data.kind, "inventory");
  assert.equal(this.stagedMcp.inputResults.unknown.ok, false, JSON.stringify(this.stagedMcp.inputResults.unknown));
  assert.equal(this.stagedMcp.inputResults.unknown.error.code, "UNKNOWN_FIELD");
  assert.equal(this.stagedMcp.inputResults.invalidShape.ok, false, JSON.stringify(this.stagedMcp.inputResults.invalidShape));
  assert.equal(this.stagedMcp.inputResults.invalidShape.error.code, "INVALID_REQUEST");
  assert.equal(this.stagedMcp.inputResults.invalidShape.error.receivedType, "array");
  assert.equal(this.stagedMcp.inputResults.hiddenNames.includes("spec_propose_patch"), true, "spec_propose_patch must be registered");
  assert.equal(this.stagedMcp.inputResults.hiddenNames.includes("apply_proposed_patch"), true, "apply_proposed_patch must be registered");
  for (const removed of ["propose_patch", "create_spec", "list_specs", "spec_inventory", "apply_spec_change", "apply_spec_transaction", "apply_spec_repairs", "append_to_section", "insert_after_heading", "insert_at_eof", "replace_in_section", "propose_spec_change", "propose_spec_repairs", "list_phase_tasks", "propose_requirement_contract"]) {
    assert.equal(this.stagedMcp.inputResults.hiddenNames.includes(removed), false, removed + " must be gone");
  }
});

When("an incomplete evidence stream is queried", async function () {
  await this.stagedMcp.server.close();
  await mkdir(path.join(this.stagedMcp.root, ".omp-spec-kit", "evidence"), { recursive: true });
  const frames = [
    { pickle: { id: "bdd-pickle", tags: [{ name: "@id:SCEN-specification-only-init" }] } },
    { testCase: { id: "bdd-case", pickleId: "bdd-pickle", testSteps: [{ id: "bdd-step" }] } },
    { testCaseStarted: { id: "bdd-start", testCaseId: "bdd-case" } },
    { testCaseFinished: { testCaseStartedId: "bdd-start" } },
  ];
  await writeFile(path.join(this.stagedMcp.root, ".omp-spec-kit", "evidence", "last-test-run.ndjson"), frames.map((frame) => JSON.stringify(frame)).join("\n") + "\n");
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: {},
  });
  const result = await this.stagedMcp.server.request("tools/call", {
    name: "spec_evidence",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-incomplete-evidence", view: "result", scenarioId: "product:SCEN-specification-only-init" },
  });
  this.stagedMcp.evidenceResult = result.result.structuredContent;
});

Then("the evidence result is unknown and stale", function () {
  assert.equal(this.stagedMcp.evidenceResult.ok, true, JSON.stringify(this.stagedMcp.evidenceResult));
  assert.equal(this.stagedMcp.evidenceResult.data.result, "UNKNOWN");
  assert.equal(this.stagedMcp.evidenceResult.data.stale, true);
  assert.equal(this.stagedMcp.evidenceResult.data.traceStatus, "missing");
});

When("a new specification is created and archived through the proposal door", async function () {
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: {},
  });
  const created = await this.stagedMcp.server.request("tools/call", {
    name: "spec_propose_patch",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-archive-create", intent: "createSpec", spec: "archive-bdd", reason: "create archive fixture", title: "Archive BDD" },
  });
  const createdProposal = created.result.structuredContent;
  const createdExpectedDocuments = createdProposal.data.operations.map((operation) => ({ path: operation.path, beforeSha256: operation.beforeSha256 }));
  const createdApply = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-archive-create-apply",
      proposalId: createdProposal.data.proposalId,
      proposalSha256: createdProposal.data.proposalHash,
      expectedDocuments: createdExpectedDocuments,
      reason: "approve archive fixture",
      approval: "approve",
    },
  });
  const archive = await this.stagedMcp.server.request("tools/call", {
    name: "spec_propose_patch",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-archive-propose", intent: "archiveSpec", spec: "archive-bdd", reason: "archive exact fixture" },
  });
  const archiveProposal = archive.result.structuredContent;
  const archivedApply = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-archive-apply",
      proposalId: archiveProposal.data.proposalId,
      proposalSha256: archiveProposal.data.proposalHash,
      expectedDocuments: archiveProposal.data.operations.map((op) => ({ path: op.path, beforeSha256: op.beforeSha256 })),
      reason: "approve archive move",
      approval: "approve",
    },
  });
  this.stagedMcp.archive = { created: createdProposal, createdApply: createdApply.result.structuredContent, archive: archiveProposal, archivedApply: archivedApply.result.structuredContent };
});

Then("the archive move is committed and the original directory is absent", async function () {
  assert.equal(this.stagedMcp.archive.created.ok, true, JSON.stringify(this.stagedMcp.archive.created));
  assert.equal(this.stagedMcp.archive.createdApply.ok, true, JSON.stringify(this.stagedMcp.archive.createdApply));
  assert.equal(this.stagedMcp.archive.archive.ok, true, JSON.stringify(this.stagedMcp.archive.archive));
  assert.equal(this.stagedMcp.archive.archivedApply.ok, true, JSON.stringify(this.stagedMcp.archive.archivedApply));
  assert.deepStrictEqual(this.stagedMcp.archive.archivedApply.data.receipt.archive, {
    spec: "archive-bdd",
    destination: ".specs/archive/archive-bdd",
    fileCount: this.stagedMcp.archive.archive.data.archive.fileCount,
    sourceDigest: this.stagedMcp.archive.archive.data.archive.sourceDigest,
  });
  await assert.rejects(
    readdir(path.join(this.stagedMcp.root, ".specs", "archive-bdd")),
    (error) => error?.code === "ENOENT",
  );
  const archivedEntries = await readdir(path.join(this.stagedMcp.root, ".specs", "archive", "archive-bdd"));
  assert.equal(archivedEntries.includes("README.md"), true);
  assert.equal(archivedEntries.includes("archive-bdd.feature"), true);
});

When("the staged OMP extension registry is inspected", async function () {
  this.stagedMcp.extensionProbe = await runExtensionProbe({
    extensionPath: path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "dist", "extension.js"),
    cwd: this.stagedMcp.root,
    env: {},
  });
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: {},
  });
  const listed = await this.stagedMcp.server.request("tools/list");
  this.stagedMcp.mcpTools = listed.result.tools;
});

Then("applied authoring tools require write approval and proposals remain read-only", function () {
  assert.equal(this.stagedMcp.extensionProbe.tools.length, 0, "extension must register 0 direct tools in MCP-only architecture");
  assert.ok(this.stagedMcp.extensionProbe.registeredEvents?.includes("tool_call"), "extension must register tool_call hook");
  const tools = new Map(this.stagedMcp.mcpTools.map((tool) => [tool.name, tool]));
  assert.equal(tools.size, 11, "MCP server must expose the single 11-tool surface");
  assert.equal(tools.get("apply_proposed_patch")?.annotations?.readOnlyHint, false);
  assert.equal(tools.get("spec_propose_patch")?.annotations?.readOnlyHint, true);
  assert.equal(tools.get("spec_catalog")?.annotations?.readOnlyHint, true);
});

async function runToolE2EPhase(world, phase) {
  await world.server.close();
  world.server = spawnMcpServer({ serverPath: SERVER_PATH, root: world.root, cwd: world.root, env: {} });
  const initialized = await world.server.request("initialize", { protocolVersion: "2025-03-26" });
  assert.equal(initialized.result.serverInfo.name, "omp-spec-kit");
  return runEvidenceE2E({
    listTools: () => world.server.request("tools/list"),
    callTool: (name, arguments_) => world.server.request("tools/call", { name, arguments: arguments_ }),
    projectRoot: world.root,
    repositoryRoot: REPOSITORY_ROOT,
    surface: { phase, outsideRoot: world.outsideRoot, restart: async () => {
      await world.server.close();
      world.server = spawnMcpServer({ serverPath: SERVER_PATH, root: world.root, cwd: world.root, env: {} });
      await world.server.request("initialize", { protocolVersion: "2025-03-26" });
    } },
  });
}

When("the tool inventory matrix is exercised", { timeout: 30000 }, async function () {
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({ serverPath: SERVER_PATH, root: this.stagedMcp.root, cwd: this.stagedMcp.root, env: {} });
  await this.stagedMcp.server.request("initialize", { protocolVersion: "2025-03-26" });
  await runToolE2E({
    initialize: () => this.stagedMcp.server.request("initialize", { protocolVersion: "2025-03-26" }),
    listTools: () => this.stagedMcp.server.request("tools/list"),
    callTool: (name, arguments_) => this.stagedMcp.server.request("tools/call", { name, arguments: arguments_ }),
    projectRoot: this.stagedMcp.root,
    repositoryRoot: REPOSITORY_ROOT,
    phase: "inventory",
  });
  const listed = await this.stagedMcp.server.request("tools/list");
  this.toolE2E = listed.result.tools.map((tool) => tool.name);
});
Then("the inventory contains the exact 11-tool surface", function () {
  assert.deepEqual(this.toolE2E, [...ALL_TOOL_NAMES]);
});

When("the semantic success matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "success");
});
Then("every tool returns its semantic success contract", function () {
  assert.equal(this.toolE2E, undefined);
});

When("the invalid and containment matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "invalid");
  await runToolE2EPhase(this.stagedMcp, "boundary");
});
Then("every tool rejects closed-schema and boundary violations", function () {
  assert.equal(this.toolE2E, undefined);
});

When("the mutation and freshness matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "mutation");
});
Then("every evidence and corpus mutation is detected", function () {
  assert.equal(this.toolE2E, undefined);
});

When("the read-only matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "success");
});
Then("every read-only call preserves the project byte snapshot", function () {
  assert.equal(this.toolE2E, undefined);
});

When("MCP envelope recovery cases are exercised", { timeout: 30000 }, async function () {
  const request = (name, arguments_) => this.stagedMcp.server.request("tools/call", { name, arguments: { schemaVersion: "spec-kernel@1", ...arguments_ } });
  const firstPage = await request("spec_entities", { requestId: "bdd-recovery-first", mode: "find", kinds: [], canonicalIds: [], text: null, projection: "summary", limit: 1, cursor: null });
  const firstValue = firstPage.result.structuredContent;
  const cursor = firstValue.page?.nextCursor;
  assert.ok(cursor, JSON.stringify(firstValue));
  const stale = await request("spec_entities", { requestId: "bdd-recovery-stale", mode: "find", kinds: ["FUNCTIONAL_REQUIREMENT"], canonicalIds: [], text: null, projection: "summary", limit: 1, cursor });

  const overview = await request("spec_catalog", { requestId: "bdd-recovery-conflict-overview", view: "overview", specSlugs: [] });
  const fingerprint = overview.result.structuredContent.graph.fingerprint;
  const proposalResponse = await request("spec_propose_patch", {
    requestId: "bdd-recovery-conflict-proposal",
    intent: "patch",
    repositoryRootFingerprint: fingerprint,
    spec: "product",
    reason: "exercise conflict recovery",
    operations: [{ kind: "insert_at_eof", document: "README.md", text: "conflict recovery marker" }],
  });
  const proposal = proposalResponse.result.structuredContent.data;
  const target = path.join(this.stagedMcp.root, "." + "specs", "product", "README.md");
  const current = await readFile(target, "utf8");
  await writeFile(target, current + "changed before apply\n", "utf8");
  const conflict = await request("apply_proposed_patch", {
    requestId: "bdd-recovery-conflict-apply",
    proposalId: proposal.proposalId,
    proposalSha256: proposal.proposalHash,
    expectedDocuments: proposal.operations.map((operation) => ({ path: operation.path, beforeSha256: operation.beforeSha256 })),
    reason: "exercise conflict recovery",
    approval: "approve",
  });

  const targetBlocked = classifyToolCall({ toolName: "write", input: { path: "" }, cwd: this.stagedMcp.root });
  this.stagedMcp.recovery = { stale, conflict, targetBlocked };
});

Then("stale cursor, conflict, and target indeterminate recoveries are bounded and actionable", function () {
  const { stale, conflict, targetBlocked } = this.stagedMcp.recovery;
  assert.equal(stale.result.isError, true);
  assert.equal(stale.result.structuredContent.error.code, "STALE_CURSOR");
  assert.ok(stale.result.structuredContent.error.message.endsWith("Recovery: retry the same list operation without cursor to obtain a fresh page, then continue with the returned nextCursor."), stale.result.structuredContent.error.message);
  assert.deepEqual(JSON.parse(stale.result.content[0].text), stale.result.structuredContent);
  assert.equal(conflict.result.isError, true, JSON.stringify(conflict));
  assert.equal(conflict.result.structuredContent.data.error.code, "CONFLICT");
  assert.ok(conflict.result.structuredContent.data.error.message.endsWith("Recovery: rerun spec_overview, resolve the reported conflict, create and review a fresh proposal, then call apply_proposed_patch with a new requestId."));
  assert.deepEqual(JSON.parse(conflict.result.content[0].text), conflict.result.structuredContent);
  assert.equal(targetBlocked.action, "block");
  assert.equal(targetBlocked.code, "TARGET_INDETERMINATE");
  assert.ok(targetBlocked.reason.includes("Recovery: provide one explicit repository-relative target, or use spec_propose_patch then apply_proposed_patch."));
  assert.ok(Buffer.byteLength(targetBlocked.reason, "utf8") <= 512);
  assert.equal(targetBlocked.reason.includes(path.resolve(this.stagedMcp.root)), false);
});

After({ tags: "@staged-mcp" }, async function () {
  if (this.stagedMcp?.server) await this.stagedMcp.server.close();
  if (this.stagedMcp?.root) await rm(this.stagedMcp.root, { recursive: true, force: true });
  if (this.stagedMcp?.outsideRoot) await rm(this.stagedMcp.outsideRoot, { recursive: true, force: true });
});

When("the additive registry, evidence states, and safe authoring are exercised", async function () {
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: {},
  });
  const initialized = await this.stagedMcp.server.request("initialize", { protocolVersion: "2025-03-26" });
  assert.equal(initialized.result.serverInfo.name, "omp-spec-kit");
  const listed = await this.stagedMcp.server.request("tools/list");
  this.stagedMcp.v05Names = listed.result.tools.map((tool) => tool.name);
  const overview = await this.stagedMcp.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-overview", view: "overview", specSlugs: [] },
  });
  const nodeResponse = await this.stagedMcp.server.request("tools/call", {
    name: "spec_entities",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-node", mode: "get", canonicalId: "product:SCEN-specification-only-init", projection: "summary", includeIncidentCounts: false },
  });
  const binding = {
    graphFingerprint: overview.result.structuredContent.graph.fingerprint,
    scenarioContentHash: nodeResponse.result.structuredContent.data.node.contentHash,
  };
  const evidenceDir = path.join(this.stagedMcp.root, ".omp-spec-kit", "evidence");
  await mkdir(evidenceDir, { recursive: true });
  const fixture = await readFile(path.join(REPOSITORY_ROOT, "tests", "fixtures", "evidence", "v05-passing.ndjson"), "utf8");
  await writeFile(path.join(evidenceDir, "last-test-run.ndjson"), fixture
    .replace("__GRAPH_FINGERPRINT__", binding.graphFingerprint)
    .replace("__SCENARIO_CONTENT_HASH__", binding.scenarioContentHash));
  const evidenceRequest = (view, requestId) => this.stagedMcp.server.request("tools/call", {
    name: "spec_evidence",
    arguments: { schemaVersion: "spec-kernel@1", requestId, view, scenarioId: "product:SCEN-specification-only-init" },
  });
  const passing = await evidenceRequest("result", "v05-passing");
  const trace = await evidenceRequest("trace", "v05-trace");
  const failedFixture = await readFile(path.join(REPOSITORY_ROOT, "tests", "fixtures", "evidence", "v05-failed.ndjson"), "utf8");
  await writeFile(path.join(evidenceDir, "last-test-run.ndjson"), failedFixture);
  const failed = await evidenceRequest("result", "v05-failed");
  const incompleteFixture = await readFile(path.join(REPOSITORY_ROOT, "tests", "fixtures", "evidence", "v05-incomplete.ndjson"), "utf8");
  await writeFile(path.join(evidenceDir, "last-test-run.ndjson"), incompleteFixture);
  const incomplete = await evidenceRequest("result", "v05-incomplete");
  const unknownScenario = await this.stagedMcp.server.request("tools/call", {
    name: "spec_evidence",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-unknown-scenario", view: "result", scenarioId: "product:SCEN-unknown" },
  });
  const invalid = await this.stagedMcp.server.request("tools/call", {
    name: "spec_evidence",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-invalid", view: "result" },
  });
  await writeFile(path.join(evidenceDir, "last-test-run.ndjson"), fixture
    .replace("__GRAPH_FINGERPRINT__", binding.graphFingerprint)
    .replace("__SCENARIO_CONTENT_HASH__", binding.scenarioContentHash));
  const scenarioPath = path.join(this.stagedMcp.root, ".specs", "product", "product.feature");
  const originalScenario = await readFile(scenarioPath, "utf8");
  const beforeMutation = await evidenceRequest("result", "v05-before-mutation");
  await writeFile(scenarioPath, originalScenario.replace("Scenario: Specification-only init reports no installable plugin", "Scenario: Specification-only init reports no installable plugin changed"));
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({ serverPath: SERVER_PATH, root: this.stagedMcp.root, cwd: this.stagedMcp.root, env: {} });
  const afterMutation = await evidenceRequest("result", "v05-after-mutation");
  const changedOverview = await this.stagedMcp.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-changed-overview", view: "overview", specSlugs: [] },
  });
  const proposalResponse = await this.stagedMcp.server.request("tools/call", {
    name: "spec_propose_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "v05-proposal",
      intent: "patch",
      repositoryRootFingerprint: changedOverview.result.structuredContent.graph.fingerprint,
      spec: "product",
      reason: "verify v0.5 safe authoring",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "authoring marker" }],
    },
  });
  const proposal = proposalResponse.result.structuredContent;
  assert.equal(proposal.ok, true, JSON.stringify(proposal));
  const expectedDocuments = proposal.data.operations.map((operation) => ({ path: operation.path, beforeSha256: operation.beforeSha256 }));
  const applyArguments = {
    schemaVersion: "spec-kernel@1",
    requestId: "v05-apply",
    proposalId: proposal.data.proposalId,
    proposalSha256: proposal.data.proposalHash,
    expectedDocuments,
    reason: "approve v0.5 proposal",
    approval: "approve",
  };
  const applied = await this.stagedMcp.server.request("tools/call", { name: "apply_proposed_patch", arguments: applyArguments });
  const replay = await this.stagedMcp.server.request("tools/call", { name: "apply_proposed_patch", arguments: { ...applyArguments, requestId: "v05-replay" } });
  this.stagedMcp.v05 = { passing, trace, failed, incomplete, unknownScenario, invalid, beforeMutation, afterMutation, proposal, applied, replay };
});

Then("the surface exposes 11 bounded tools, preserves authoring, and refuses stale evidence", async function () {
  assert.deepEqual(this.stagedMcp.v05Names, [...ALL_TOOL_NAMES]);
  const result = this.stagedMcp.v05;
  assert.equal(result.passing.result.structuredContent.data.result, "PASSED");
  assert.equal(result.passing.result.structuredContent.data.stale, false);
  assert.equal(result.trace.result.structuredContent.data.trace.status, "bounded");
  assert.equal(result.failed.result.structuredContent.data.result, "FAILED");
  assert.equal(result.incomplete.result.structuredContent.data.result, "UNKNOWN");
  assert.equal(result.unknownScenario.result.structuredContent.ok, false);
  assert.equal(result.unknownScenario.result.structuredContent.error.code, "SCENARIO_NOT_FOUND");
  assert.equal(result.invalid.result.structuredContent.ok, false);
  assert.equal(result.invalid.result.structuredContent.error.code, "INVALID_REQUEST");
  assert.equal(result.beforeMutation.result.structuredContent.data.result, "PASSED");
  assert.equal(result.afterMutation.result.structuredContent.data.result, "UNKNOWN");
  assert.equal(result.afterMutation.result.structuredContent.data.stale, true);
  assert.notEqual(result.beforeMutation.result.structuredContent.data.evidenceBinding.graphFingerprint, result.afterMutation.result.structuredContent.data.evidenceBinding.graphFingerprint);
  assert.equal(result.proposal.ok, true, JSON.stringify(result.proposal));
  assert.equal(result.applied.result.structuredContent.ok, true, JSON.stringify(result.applied));
  assert.equal(result.replay.result.structuredContent.ok, true, JSON.stringify(result.replay));
  assert.equal(result.replay.result.structuredContent.data.outcome, "REFUSED", JSON.stringify(result.replay));
  assert.equal(result.replay.result.structuredContent.data.error.code, "CONFLICT", JSON.stringify(result.replay));
  const content = await readFile(path.join(this.stagedMcp.root, ".specs", "product", "README.md"), "utf8");
  assert.equal((content.match(/authoring marker/g) ?? []).length, 1);
});

const ALL_SUPERSEDED_36_TOOLS = Object.freeze([
  "spec_inventory",
  "spec_get_node",
  "spec_find_nodes",
  "spec_get_edges",
  "spec_trace",
  "spec_diagnostics",
  "spec_overview",
  "spec_markdown_inventory",
  "find_by_tags",
  "list_tasks",
  "find_orphans",
  "validate_anchor",
  "list_specs",
  "validate_requirement_metadata",
  "policy_query_requirements",
  "get_archival_proof",
  "validate_spec",
  "get_spec_status",
  "list_spec_docs",
  "read_spec_doc",
  "read_attachment",
  "get_test_result",
  "get_scenario_trace",
  "propose_patch",
  "amend_requirement",
  "add_acceptance_criterion",
  "add_phase",
  "set_entity_status",
  "set_spec_status",
  "set_requirement_metadata",
  "delete_spec_doc",
  "rename_spec_doc",
  "create_spec",
  "archive_spec",
  "add_backlog_task",
  "register_incident_backlog",
]);

When("all 36 superseded tool names are invoked individually", async function () {
  this.supersededResults = [];
  for (const name of ALL_SUPERSEDED_36_TOOLS) {
    const res = await this.stagedMcp.server.request("tools/call", {
      name,
      arguments: {},
    });
    this.supersededResults.push({ name, res });
  }
});

Then("every superseded tool returns JSON-RPC error -32602 without fallback shims", function () {
  assert.equal(this.supersededResults.length, 36);
  for (const { name, res } of this.supersededResults) {
    assert.ok(res.error, "Tool " + name + " must return JSON-RPC error");
    assert.equal(res.error.code, -32602, "Tool " + name + " error code must be -32602");
    assert.equal(res.error.message, "Unknown tool: " + name, "Tool " + name + " error message must be standard unknown tool");
  }
});

When("all consolidated branches and all 13 proposal intents are exercised", { timeout: 60000 }, async function () {
  const server = this.stagedMcp.server;
  const root = this.stagedMcp.root;

  // Create temporary spec for document/lifecycle proposal checks
  const tempSpecDir = path.join(root, "." + "specs", "temp-e2e-spec");
  await mkdir(tempSpecDir, { recursive: true });
  await writeFile(path.join(tempSpecDir, "README.md"), "# Temp E2E\n", "utf8");
  await writeFile(path.join(tempSpecDir, "TASKS.md"), "# Tasks\n\n## TASK-1: Temp Task\n- **Status:** todo\n", "utf8");
  await writeFile(path.join(tempSpecDir, "temp-e2e-spec.feature"), "Feature: Temp E2E\n", "utf8");

  // Restart server to reload graph with temp-e2e-spec
  await server.close();
  this.stagedMcp.server = spawnMcpServer({ serverPath: SERVER_PATH, root, cwd: root, env: {} });
  const freshServer = this.stagedMcp.server;

  // Overview to get fingerprint
  const catOverview = await freshServer.request("tools/call", {
    name: "spec_catalog",
    arguments: { view: "overview" },
  });
  const fingerprint = catOverview.result.structuredContent.graph.fingerprint;

  const calls = [
    // 1. spec_catalog
    ["spec_catalog", { view: "types" }, "catalog", "types"],
    ["spec_catalog", { view: "specs" }, "catalog", "specs"],
    ["spec_catalog", { view: "inventory", limit: 5 }, "catalog", "inventory"],
    ["spec_catalog", { view: "overview" }, "catalog", "overview"],
    ["spec_catalog", { view: "status", spec: "product", statusView: "summary" }, "catalog", "summary"],

    // 2. spec_entities
    ["spec_entities", { mode: "get", canonicalId: "product:FR-1" }, "entities", "node"],
    ["spec_entities", { mode: "find", kinds: ["FUNCTIONAL_REQUIREMENT"] }, "entities", "nodes"],

    // 3. spec_graph
    ["spec_graph", { view: "edges", canonicalId: "product:FR-1" }, "graph", "edges"],
    ["spec_graph", { view: "trace", canonicalId: "product:FR-1", maxDepth: 2 }, "graph", "trace"],

    // 4. spec_documents
    ["spec_documents", { action: "list", spec: "product" }, "documents", "spec-documents"],
    ["spec_documents", { action: "read", spec: "product", doc: "FR.md", limit: 5 }, "documents", "document"],
    ["spec_documents", { action: "attachment", spec: "product", path: "tool-e2e.bin" }, "documents", "attachment"],

    // 5. spec_inspect
    ["spec_inspect", { check: "scenariosByTags", tags: ["@feature1"] }, "inspect", "scenarios"],
    ["spec_inspect", { check: "orphans" }, "inspect", "orphans"],
    ["spec_inspect", { check: "anchor", anchor: "plugin-distribution:FR-1" }, "inspect", "spec-graph-id"],
    ["spec_inspect", { check: "requirementMetadata", metadata: {} }, "inspect", "requirement-metadata"],
    ["spec_inspect", { check: "requirementsPolicy" }, "inspect", "requirement-policy"],
    ["spec_inspect", { check: "archivalProof", spec: "product" }, "inspect", "archival-proof"],
    ["spec_inspect", { check: "specValidation", spec: "product" }, "inspect", "spec-validation"],
    ["spec_inspect", { check: "diagnostics", limit: 5 }, "inspect", "diagnostics"],

    // 6. spec_tasks
    ["spec_tasks", { spec: "product", limit: 5 }, "tasks", "tasks"],

    // 7. spec_evidence
    ["spec_evidence", { view: "result", scenarioId: "product:SCEN-specification-only-init" }, "evidence", "test-result"],
    ["spec_evidence", { view: "trace", scenarioId: "product:SCEN-specification-only-init" }, "evidence", "scenario-trace"],

    // 8. spec_markdown
    ["spec_markdown", { specSlugs: ["product"] }, "markdown", "markdownInventory"],

    // 9. mcp_preflight
    ["mcp_preflight", {}, "mcpPreflight", "mcp-preflight"],

    // 10. spec_propose_patch - all 13 intents
    ["spec_propose_patch", { intent: "patch", repositoryRootFingerprint: fingerprint, spec: "product", reason: "bdd test", requestId: "bdd-int-patch", operations: [{ kind: "insert_at_eof", document: "README.md", text: "bdd" }] }, "proposePatch", null],
    ["spec_propose_patch", { intent: "amendRequirement", spec: "product", requirement: "FR-1", body: "amend", reason: "amend reason", requestId: "bdd-int-amend" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "addAcceptanceCriterion", spec: "product", requirement: "FR-1", criterion: "crit", reason: "ac reason", requestId: "bdd-int-ac" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "addPhase", spec: "product", title: "New Phase", reason: "phase reason", requestId: "bdd-int-phase" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "setEntityStatus", spec: "product", entity: "TASK-1", status: "in-progress", reason: "status reason", requestId: "bdd-int-status" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "setSpecStatus", spec: "product", status: "active", reason: "spec status reason", requestId: "bdd-int-spec-status" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "setRequirementMetadata", spec: "product", requirement: "FR-1", metadata: { schemaVersion: 1, verificationMethod: "test" }, reason: "meta reason", requestId: "bdd-int-meta" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "deleteSpecDoc", spec: "temp-e2e-spec", doc: "TASKS.md", reason: "delete doc reason", requestId: "bdd-int-del" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "renameSpecDoc", spec: "temp-e2e-spec", doc: "TASKS.md", newDoc: "FIXTURES.md", reason: "rename doc reason", requestId: "bdd-int-ren" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "createSpec", spec: "temp-spec-123", title: "Temp Spec", reason: "create reason", requestId: "bdd-int-create" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "archiveSpec", spec: "temp-e2e-spec", reason: "archive reason", requestId: "bdd-int-archive" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "addBacklogTask", spec: "product", title: "Backlog Task", reason: "backlog reason", requestId: "bdd-int-backlog" }, "proposePatch", null],
    ["spec_propose_patch", { intent: "registerIncidentBacklog", spec: "product", summary: "Incident Task", reason: "incident reason", requestId: "bdd-int-incident" }, "proposePatch", null],
  ];

  this.branchResults = [];
  for (const [tool, args, expectedOp, expectedKind] of calls) {
    const res = await freshServer.request("tools/call", { name: tool, arguments: args });
    this.branchResults.push({ tool, args, expectedOp, expectedKind, res });
  }
});

Then("every branch returns its declared operation, data kind, and valid envelope", function () {
  for (const { tool, args, expectedOp, expectedKind, res } of this.branchResults) {
    const struct = res.result?.structuredContent;
    assert.ok(struct, "Tool " + tool + " must return structuredContent: " + JSON.stringify(res));
    assert.equal(struct.ok, true, "Tool " + tool + " args=" + JSON.stringify(args) + " failed: " + JSON.stringify(struct.error));
    assert.equal(struct.operation, expectedOp, "Tool " + tool + " operation mismatch");
    if (expectedKind) {
      assert.equal(struct.data?.kind, expectedKind, "Tool " + tool + " data.kind mismatch");
    }
    assert.ok(struct.provenance, "Tool " + tool + " must include provenance");
  }
});

When("tool {string} is called with arguments {string}", async function (tool, argsJson) {
  const args = JSON.parse(argsJson);
  this.boundaryResult = await this.stagedMcp.server.request("tools/call", {
    name: tool,
    arguments: args,
  });
});

Then("the call fails with error code {string}", function (expectedCode) {
  const struct = this.boundaryResult?.result?.structuredContent;
  const isErr = this.boundaryResult?.result?.isError;
  const code = struct?.error?.code ?? struct?.data?.error?.code;

  assert.equal(isErr, true, "Response must be an error: " + JSON.stringify(this.boundaryResult));
  assert.equal(code, expectedCode, "Error code mismatch: " + JSON.stringify(struct));
});
