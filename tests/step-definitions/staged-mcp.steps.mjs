import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Given, Then, When, After } from "@cucumber/cucumber";
import { classifyToolCall } from "../../src/enforcement/classifier.js";
import { createTempRepo, loadFrozenRealCorpus, writeCorpus } from "../helpers/kernel-world.mjs";
import { runV05ToolE2E, prepareV05ToolE2EFixtures } from "../helpers/v05-tool-e2e.mjs";
import { runExtensionProbe, spawnMcpServer } from "../helpers/mcp-world.mjs";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SERVER_PATH = path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "dist", "mcp", "server.js");

const READ_COMPLETE_CALLS = Object.freeze([
  ["find_by_tags", { tags: ["@feature1"] }],
  ["list_tasks", { spec: "product", statuses: ["planned", "todo", "ready", "in-progress", "blocked"], limit: 20 }],
  ["list_phase_tasks", { spec: "product", phase: "missing-phase", limit: 20 }],
  ["find_orphans", {}],
  ["validate_anchor", { anchor: "plugin-distribution:FR-1" }],
  ["list_specs", {}],
  ["validate_requirement_metadata", { metadata: {} }],
  ["policy_query_requirements", {}],
  ["get_archival_proof", { spec: "product" }],
  ["validate_spec", { spec: "product" }],
  ["get_spec_status", { spec: "product", view: "summary" }],
  ["mcp_preflight", {}],
  ["list_spec_docs", { spec: "product" }],
  ["read_spec_doc", { spec: "product", doc: "FR.md", offset: 1, limit: 20 }],
  ["read_attachment", { spec: "product", path: "FR.md" }],
]);

async function startWorld() {
  const root = await createTempRepo();
  const frozen = await loadFrozenRealCorpus(REPOSITORY_ROOT);
  await writeCorpus(root, frozen.files);
  await prepareV05ToolE2EFixtures(root);
  const outsideRoot = path.join(path.dirname(root), path.basename(root) + "-outside");
  await mkdir(outsideRoot, { recursive: true });
  await writeFile(path.join(outsideRoot, "secret.md"), "outside secret", "utf8");
  await writeFile(path.join(outsideRoot, "secret.bin"), Buffer.from("outside-bytes", "utf8"));
  await mkdir(path.join(root, ".omp-spec-kit", "evidence"), { recursive: true });
  await symlink(outsideRoot, path.join(root, ".omp-spec-kit", "evidence", "outside-link"), "junction");
  return { root, outsideRoot, server: spawnMcpServer({ serverPath: SERVER_PATH, root, cwd: root, env: { OMP_SPEC_KIT_STAGE: "read-complete" } }) };
}

Given("a real staged MCP corpus and packaged server", async function () {
  this.stagedMcp = await startWorld();
});

When("the read-complete registry and every staged handler are called", async function () {
  const initialized = await this.stagedMcp.server.request("initialize", { protocolVersion: "2025-03-26" });
  assert.equal(initialized.result.serverInfo.name, "omp-spec-kit");
  const listed = await this.stagedMcp.server.request("tools/list");
  this.stagedMcp.listedNames = listed.result.tools.map((tool) => tool.name);
  this.stagedMcp.results = [];
  for (const [name, arguments_] of READ_COMPLETE_CALLS) {
    const response = await this.stagedMcp.server.request("tools/call", { name, arguments: { schemaVersion: "spec-kernel@1", requestId: `bdd-${name}`, ...arguments_ } });
    this.stagedMcp.results.push({ name, response });
  }
});

Then("the read-complete registry has exactly 23 names and every call has a bounded envelope", function () {
  assert.equal(this.stagedMcp.listedNames.length, 23);
  assert.equal(new Set(this.stagedMcp.listedNames).size, 23);
  for (const name of ["spec_inventory", "spec_get_node", "spec_find_nodes", "spec_get_edges", "spec_trace", "spec_diagnostics", "spec_overview", "spec_markdown_inventory"]) assert.ok(this.stagedMcp.listedNames.includes(name), `${name} must remain registered`);
  assert.equal(this.stagedMcp.results.length, READ_COMPLETE_CALLS.length);
  for (const { name, response } of this.stagedMcp.results) {
    assert.ok(response.result, `${name} must return a JSON-RPC result`);
    assert.equal(response.result.content.length, 1, `${name} must return one summary content item`);
    assert.ok(response.result.structuredContent, `${name} must return structured content`);
    assert.equal(typeof response.result.structuredContent.ok, "boolean", `${name} must expose an explicit result status`);
  }
});

When("an authoring proposal is created and explicitly approved", async function () {
  this.stagedMcp.serverEnv = { OMP_SPEC_KIT_STAGE: "authoring" };
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({ serverPath: SERVER_PATH, root: this.stagedMcp.root, cwd: this.stagedMcp.root, env: { OMP_SPEC_KIT_STAGE: "authoring", OMP_SPEC_KIT_INTERNAL_DOGFOOD: "1" } });
  const overview = await this.stagedMcp.server.request("tools/call", { name: "spec_overview", arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-overview", specSlugs: [] } });
  const fingerprint = overview.result.structuredContent.graph.fingerprint;
  const proposalResponse = await this.stagedMcp.server.request("tools/call", {
    name: "propose_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-proposal",
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
  const append = await this.stagedMcp.server.request("tools/call", {
    name: "append_to_section",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-append",
      spec: "product",
      doc: "README.md",
      heading: "Current product status",
      text: "BDD append marker",
      reason: "verify section append preserves the document",
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
    name: "spec_overview",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-rename-overview", specSlugs: [] },
  });
  const renameProposalResponse = await this.stagedMcp.server.request("tools/call", {
    name: "propose_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-rename",
      repositoryRootFingerprint: refreshedOverview.result.structuredContent.graph.fingerprint,
      spec: "product",
      reason: "verify heading rename preserves the document",
      operations: [{ kind: "rename_heading", document: "README.md", heading: "Current product status", newHeading: "Current product status renamed" }],
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
  const allowed = classifyToolCall({ toolName: "mcp__omp_spec_kit_apply_spec_change", input: { path: ".specs/plugin-distribution/FR.md", approval: "approve" } });
  const rawBlocked = classifyToolCall({ toolName: "apply_spec_change", input: { path: ".specs/plugin-distribution/FR.md", approval: "approve" } });
  assert.equal(allowed.action, "allow");
  assert.equal(rawBlocked.action, "block");
  assert.equal(rawBlocked.code, "UNREGISTERED_AUTHORING_CALL");
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
    env: { OMP_SPEC_KIT_STAGE: "authoring", OMP_SPEC_KIT_INTERNAL_DOGFOOD: "1" },
  });
  const linked = await this.stagedMcp.server.request("tools/call", {
    name: "create_spec",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-linked-create", spec: "evil", reason: "reject linked path", title: "Escape" },
  });
  const existing = await this.stagedMcp.server.request("tools/call", {
    name: "create_spec",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-existing-create", spec: "product", reason: "reject overwrite", title: "Overwrite" },
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
    env: { OMP_SPEC_KIT_STAGE: "read-complete" },
  });
  const alias = await this.stagedMcp.server.request("tools/call", {
    name: "spec_inventory",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-alias", spec_slugs: [], include_documents: false, limit: 1, cursor: null },
  });
  const unknown = await this.stagedMcp.server.request("tools/call", {
    name: "list_specs",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-unknown", unexpected: true },
  });
  const invalidShape = await this.stagedMcp.server.request("tools/call", {
    name: "list_specs",
    arguments: [],
  });
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: { OMP_SPEC_KIT_STAGE: "v0.3.2" },
  });
  const hidden = await this.stagedMcp.server.request("tools/list");
  this.stagedMcp.inputResults = {
    alias: alias.result.structuredContent,
    unknown: unknown.result.structuredContent,
    invalidShape: invalidShape.result.structuredContent,
    hiddenNames: hidden.result.tools.map((tool) => tool.name),
  };
});

Then("aliases work, unknown fields fail, and unaccepted authoring stays hidden", function () {
  assert.equal(this.stagedMcp.inputResults.alias.ok, true, JSON.stringify(this.stagedMcp.inputResults.alias));
  assert.equal(this.stagedMcp.inputResults.alias.data.kind, "inventory");
  assert.equal(this.stagedMcp.inputResults.unknown.ok, false, JSON.stringify(this.stagedMcp.inputResults.unknown));
  assert.equal(this.stagedMcp.inputResults.unknown.error.code, "UNKNOWN_FIELD");
  assert.equal(this.stagedMcp.inputResults.invalidShape.ok, false, JSON.stringify(this.stagedMcp.inputResults.invalidShape));
  assert.equal(this.stagedMcp.inputResults.invalidShape.error.code, "INVALID_REQUEST");
  assert.equal(this.stagedMcp.inputResults.invalidShape.error.receivedType, "array");
  assert.deepStrictEqual([...this.stagedMcp.inputResults.hiddenNames].sort(), [
    "spec_diagnostics",
    "spec_find_nodes",
    "spec_get_edges",
    "spec_get_node",
    "spec_inventory",
    "spec_markdown_inventory",
    "spec_overview",
    "spec_trace",
  ]);
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
    env: { OMP_SPEC_KIT_STAGE: "v0.5.0" },
  });
  const result = await this.stagedMcp.server.request("tools/call", {
    name: "get_test_result",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-incomplete-evidence", scenarioId: "product:SCEN-specification-only-init" },
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
    env: { OMP_SPEC_KIT_STAGE: "authoring", OMP_SPEC_KIT_INTERNAL_DOGFOOD: "1" },
  });
  const created = await this.stagedMcp.server.request("tools/call", {
    name: "create_spec",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-archive-create", spec: "archive-bdd", reason: "create archive fixture", title: "Archive BDD" },
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
    name: "archive_spec",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-archive-propose", spec: "archive-bdd", reason: "archive exact fixture" },
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
    env: { OMP_SPEC_KIT_STAGE: "v0.6.0" },
  });
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: { OMP_SPEC_KIT_STAGE: "v0.6.0" },
  });
  const listed = await this.stagedMcp.server.request("tools/list");
  this.stagedMcp.mcpTools = listed.result.tools;
});

Then("applied authoring tools require write approval and proposals remain read-only", function () {
  assert.equal(this.stagedMcp.extensionProbe.tools.length, 0, "extension must register 0 direct tools in MCP-only architecture");
  assert.ok(this.stagedMcp.extensionProbe.registeredEvents?.includes("tool_call"), "extension must register tool_call hook");
  const tools = new Map(this.stagedMcp.mcpTools.map((tool) => [tool.name, tool]));
  assert.equal(tools.size, 49, "MCP server must expose 49 tools");
  assert.equal(tools.get("apply_proposed_patch")?.annotations?.readOnlyHint, false);
  assert.equal(tools.get("apply_spec_change")?.annotations?.readOnlyHint, false);
  assert.equal(tools.get("apply_spec_transaction")?.annotations?.readOnlyHint, false);
  assert.equal(tools.get("apply_spec_repairs")?.annotations?.readOnlyHint, false);
  assert.equal(tools.get("propose_patch")?.annotations?.readOnlyHint, true);
  assert.equal(tools.get("create_spec")?.annotations?.readOnlyHint, true);
});

async function runToolE2EPhase(world, phase) {
  await world.server.close();
  world.server = spawnMcpServer({ serverPath: SERVER_PATH, root: world.root, cwd: world.root, env: { OMP_SPEC_KIT_STAGE: "v0.5.0" } });
  const initialized = await world.server.request("initialize", { protocolVersion: "2025-03-26" });
  assert.equal(initialized.result.serverInfo.name, "omp-spec-kit");
  return runV05ToolE2E({
    listTools: () => world.server.request("tools/list"),
    callTool: (name, arguments_) => world.server.request("tools/call", { name, arguments: arguments_ }),
    projectRoot: world.root,
    repositoryRoot: REPOSITORY_ROOT,
    surface: { phase, outsideRoot: world.outsideRoot, restart: async () => {
      await world.server.close();
      world.server = spawnMcpServer({ serverPath: SERVER_PATH, root: world.root, cwd: world.root, env: { OMP_SPEC_KIT_STAGE: "v0.5.0" } });
      await world.server.request("initialize", { protocolVersion: "2025-03-26" });
    } },
  });
}

When("the v0.5 tool inventory matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "inventory");
});
Then("the v0.5 inventory contains the exact 27-tool surface", function () {
  assert.deepEqual(this.toolE2E, ["spec_inventory", "spec_get_node", "spec_find_nodes", "spec_get_edges", "spec_trace", "spec_diagnostics", "spec_overview", "spec_markdown_inventory", "propose_patch", "apply_proposed_patch", "find_by_tags", "list_tasks", "list_phase_tasks", "find_orphans", "validate_anchor", "list_specs", "validate_requirement_metadata", "policy_query_requirements", "get_archival_proof", "validate_spec", "get_spec_status", "mcp_preflight", "list_spec_docs", "read_spec_doc", "read_attachment", "get_test_result", "get_scenario_trace"]);
});

When("the v0.5 semantic success matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "success");
});
Then("every v0.5 tool returns its semantic success contract", function () {
  assert.equal(this.toolE2E, undefined);
});

When("the v0.5 invalid and containment matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "invalid");
  await runToolE2EPhase(this.stagedMcp, "boundary");
});
Then("every v0.5 tool rejects closed-schema and boundary violations", function () {
  assert.equal(this.toolE2E, undefined);
});

When("the v0.5 mutation and freshness matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "mutation");
});
Then("every v0.5 evidence and corpus mutation is detected", function () {
  assert.equal(this.toolE2E, undefined);
});

When("the v0.5 read-only matrix is exercised", { timeout: 30000 }, async function () {
  this.toolE2E = await runToolE2EPhase(this.stagedMcp, "success");
});
Then("every v0.5 read-only call preserves the project byte snapshot", function () {
  assert.equal(this.toolE2E, undefined);
});

After({ tags: "@staged-mcp" }, async function () {
  if (this.stagedMcp?.server) await this.stagedMcp.server.close();
  if (this.stagedMcp?.root) await rm(this.stagedMcp.root, { recursive: true, force: true });
  if (this.stagedMcp?.outsideRoot) await rm(this.stagedMcp.outsideRoot, { recursive: true, force: true });
});
When("the v0.5 additive registry, evidence states, and safe authoring are exercised", async function () {
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: { OMP_SPEC_KIT_STAGE: "v0.5.0" },
  });
  const initialized = await this.stagedMcp.server.request("initialize", { protocolVersion: "2025-03-26" });
  assert.equal(initialized.result.serverInfo.name, "omp-spec-kit");
  const listed = await this.stagedMcp.server.request("tools/list");
  this.stagedMcp.v05Names = listed.result.tools.map((tool) => tool.name);
  const overview = await this.stagedMcp.server.request("tools/call", {
    name: "spec_overview",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-overview", specSlugs: [] },
  });
  const nodeResponse = await this.stagedMcp.server.request("tools/call", {
    name: "spec_get_node",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-node", canonicalId: "product:SCEN-specification-only-init", projection: "summary", includeIncidentCounts: false },
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
  const evidenceRequest = (name, requestId) => this.stagedMcp.server.request("tools/call", {
    name,
    arguments: { schemaVersion: "spec-kernel@1", requestId, scenarioId: "product:SCEN-specification-only-init" },
  });
  const passing = await evidenceRequest("get_test_result", "v05-passing");
  const trace = await evidenceRequest("get_scenario_trace", "v05-trace");
  const failedFixture = await readFile(path.join(REPOSITORY_ROOT, "tests", "fixtures", "evidence", "v05-failed.ndjson"), "utf8");
  await writeFile(path.join(evidenceDir, "last-test-run.ndjson"), failedFixture);
  const failed = await evidenceRequest("get_test_result", "v05-failed");
  const incompleteFixture = await readFile(path.join(REPOSITORY_ROOT, "tests", "fixtures", "evidence", "v05-incomplete.ndjson"), "utf8");
  await writeFile(path.join(evidenceDir, "last-test-run.ndjson"), incompleteFixture);
  const incomplete = await evidenceRequest("get_test_result", "v05-incomplete");
  const unknownScenario = await this.stagedMcp.server.request("tools/call", {
    name: "get_test_result",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-unknown-scenario", scenarioId: "product:SCEN-unknown" },
  });
  const invalid = await this.stagedMcp.server.request("tools/call", {
    name: "get_test_result",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-invalid" },
  });
  await writeFile(path.join(evidenceDir, "last-test-run.ndjson"), fixture
    .replace("__GRAPH_FINGERPRINT__", binding.graphFingerprint)
    .replace("__SCENARIO_CONTENT_HASH__", binding.scenarioContentHash));
  const scenarioPath = path.join(this.stagedMcp.root, ".specs", "product", "product.feature");
  const originalScenario = await readFile(scenarioPath, "utf8");
  const beforeMutation = await evidenceRequest("get_test_result", "v05-before-mutation");
  await writeFile(scenarioPath, originalScenario.replace("Scenario: Specification-only init reports no installable plugin", "Scenario: Specification-only init reports no installable plugin changed"));
  await this.stagedMcp.server.close();
  this.stagedMcp.server = spawnMcpServer({ serverPath: SERVER_PATH, root: this.stagedMcp.root, cwd: this.stagedMcp.root, env: { OMP_SPEC_KIT_STAGE: "v0.5.0" } });
  const afterMutation = await evidenceRequest("get_test_result", "v05-after-mutation");
  const changedOverview = await this.stagedMcp.server.request("tools/call", {
    name: "spec_overview",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "v05-changed-overview", specSlugs: [] },
  });
  const proposalResponse = await this.stagedMcp.server.request("tools/call", {
    name: "propose_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "v05-proposal",
      repositoryRootFingerprint: changedOverview.result.structuredContent.graph.fingerprint,
      spec: "product",
      reason: "verify v0.5 safe authoring",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "v0.5 authoring marker" }],
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

Then("v0.5 exposes 27 bounded tools, preserves authoring, and refuses stale evidence", async function () {
  const expectedNames = [
    "spec_inventory", "spec_get_node", "spec_find_nodes", "spec_get_edges", "spec_trace", "spec_diagnostics", "spec_overview", "spec_markdown_inventory",
    "propose_patch", "apply_proposed_patch", "find_by_tags", "list_tasks", "list_phase_tasks", "find_orphans", "validate_anchor", "list_specs",
    "validate_requirement_metadata", "policy_query_requirements", "get_archival_proof", "validate_spec", "get_spec_status", "mcp_preflight",
    "list_spec_docs", "read_spec_doc", "read_attachment", "get_test_result", "get_scenario_trace",
  ];
  assert.deepEqual(this.stagedMcp.v05Names, expectedNames);
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
  assert.equal((content.match(/v0.5 authoring marker/g) ?? []).length, 1);
});
