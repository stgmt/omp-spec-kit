import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Given, Then, When, After } from "@cucumber/cucumber";
import { classifyToolCall } from "../../src/enforcement/classifier.js";
import { createTempRepo, loadFrozenRealCorpus, writeCorpus } from "../helpers/kernel-world.mjs";
import { runExtensionProbe, spawnMcpServer } from "../helpers/mcp-world.mjs";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SERVER_PATH = path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "dist", "mcp", "server.js");

const READ_STAGE_CALLS = Object.freeze([
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
  return { root, server: spawnMcpServer({ serverPath: SERVER_PATH, root, cwd: root, env: { OMP_SPEC_KIT_STAGE: "read-complete" } }) };
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
  for (const [name, arguments_] of READ_STAGE_CALLS) {
    const response = await this.stagedMcp.server.request("tools/call", { name, arguments: { schemaVersion: "spec-kernel@1", requestId: `bdd-${name}`, ...arguments_ } });
    this.stagedMcp.results.push({ name, response });
  }
});

Then("the read-complete registry has exactly 23 names and every call has a bounded envelope", function () {
  assert.equal(this.stagedMcp.listedNames.length, 23);
  assert.equal(new Set(this.stagedMcp.listedNames).size, 23);
  for (const name of ["spec_inventory", "spec_get_node", "spec_find_nodes", "spec_get_edges", "spec_trace", "spec_diagnostics", "spec_overview", "spec_markdown_inventory"]) assert.ok(this.stagedMcp.listedNames.includes(name), `${name} must remain registered`);
  assert.equal(this.stagedMcp.results.length, READ_STAGE_CALLS.length);
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
  const expectedDocuments = proposal.data.proposal.documents.map((document) => ({ document: document.document, sha256: document.beforeSha256 }));
  const applied = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-apply",
      proposalId: proposal.data.proposal.proposalId,
      proposalSha256: proposal.data.proposal.proposalSha256,
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
  const appendExpectedDocuments = appendProposal.data.proposal.documents.map((document) => ({ document: document.document, sha256: document.beforeSha256 }));
  const appendApplied = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-append-apply",
      proposalId: appendProposal.data.proposal.proposalId,
      proposalSha256: appendProposal.data.proposal.proposalSha256,
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
  const renameExpectedDocuments = renameProposal.data.proposal.documents.map((document) => ({ document: document.document, sha256: document.beforeSha256 }));
  const renameApplied = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-rename-apply",
      proposalId: renameProposal.data.proposal.proposalId,
      proposalSha256: renameProposal.data.proposal.proposalSha256,
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
  assert.equal(blocked.mismatchField, "toolName");
  const authority = {
    abi: "tool-call-authority-abi@1",
    providerKind: "mcp",
    registeredName: "apply_spec_change",
    serverId: "omp-spec-kit:omp-spec-kit",
    sourceToolName: "apply_spec_change",
    inputSchemaSha256: "0".repeat(64),
    registrySnapshotSha256: "1".repeat(64),
    sourcePath: "<mcp:omp-spec-kit:omp-spec-kit>",
  };
  const allowed = classifyToolCall({ toolName: "apply_spec_change", input: { path: ".specs/plugin-distribution/FR.md", approval: "approve" }, authority });
  const spoofed = classifyToolCall({ toolName: "apply_spec_change", input: { path: ".specs/plugin-distribution/FR.md", approval: "approve" }, authority: { ...authority, abi: "spoofed" } });
  assert.equal(allowed.action, "allow");
  assert.equal(spoofed.action, "block");
  assert.equal(spoofed.mismatchField, "abi");
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
    env: { OMP_SPEC_KIT_STAGE: "authoring" },
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
  await mkdir(path.join(this.stagedMcp.root, ".dev-pomogator"), { recursive: true });
  const frames = [
    { pickle: { id: "bdd-pickle", tags: [{ name: "@id:SCEN-specification-only-init" }] } },
    { testCase: { id: "bdd-case", pickleId: "bdd-pickle", testSteps: [{ id: "bdd-step" }] } },
    { testCaseStarted: { id: "bdd-start", testCaseId: "bdd-case" } },
    { testCaseFinished: { testCaseStartedId: "bdd-start" } },
  ];
  await writeFile(path.join(this.stagedMcp.root, ".dev-pomogator", ".last-test-run.ndjson"), `${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`);
  this.stagedMcp.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.stagedMcp.root,
    cwd: this.stagedMcp.root,
    env: { OMP_SPEC_KIT_STAGE: "evidence" },
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
  const createdExpectedDocuments = createdProposal.data.proposal.documents.map((document) => ({ document: document.document, sha256: document.beforeSha256 }));
  const createdApply = await this.stagedMcp.server.request("tools/call", {
    name: "apply_proposed_patch",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "bdd-archive-create-apply",
      proposalId: createdProposal.data.proposal.proposalId,
      proposalSha256: createdProposal.data.proposal.proposalSha256,
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
      proposalId: archiveProposal.data.proposal.proposalId,
      proposalSha256: archiveProposal.data.proposal.proposalSha256,
      expectedDocuments: [],
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
  assert.deepStrictEqual(this.stagedMcp.archive.archivedApply.data.receipt.archivedSpec, {
    from: ".specs/archive-bdd",
    to: ".specs/archive/archive-bdd",
    digest: this.stagedMcp.archive.archive.data.proposal.archive.sourceDigest,
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
  const overview = await this.stagedMcp.server.request("tools/call", {
    name: "spec_overview",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "bdd-omp-overview", specSlugs: [] },
  });
  const fingerprint = overview.result.structuredContent.graph.fingerprint;
  this.stagedMcp.extensionProbe = await runExtensionProbe({
    extensionPath: path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "dist", "extension.js"),
    cwd: this.stagedMcp.root,
    env: { OMP_SPEC_KIT_STAGE: "authoring", OMP_SPEC_KIT_INTERNAL_DOGFOOD: "1" },
    queries: [{
      name: "propose_patch",
      params: {
        schemaVersion: "spec-kernel@1",
        requestId: "omp-probe-request-id",
        repositoryRootFingerprint: fingerprint,
        spec: "product",
        reason: "verify OMP request identity",
        operations: [{ kind: "insert_at_eof", document: "README.md", text: "OMP proposal probe" }],
      },
    }],
  });
});
Then("applied authoring tools require write approval and proposals remain read-only", function () {
  const tools = new Map(this.stagedMcp.extensionProbe.tools.map((tool) => [tool.name, tool]));
  assert.equal(tools.size, 49);
  assert.equal(tools.get("apply_proposed_patch")?.approval, "write");
  assert.equal(tools.get("apply_spec_change")?.approval, "write");
  assert.equal(tools.get("propose_patch")?.approval, "read");
  assert.equal(tools.get("create_spec")?.approval, "read");
  const proposal = this.stagedMcp.extensionProbe.queryResults[0].result.details;
  assert.equal(proposal.ok, true, JSON.stringify(proposal));
  assert.equal(proposal.requestId, "omp-probe-request-id");
});

After({ tags: "@staged-mcp" }, async function () {
  if (this.stagedMcp?.server) await this.stagedMcp.server.close();
  if (this.stagedMcp?.root) await rm(this.stagedMcp.root, { recursive: true, force: true });
});
