import assert from "node:assert/strict";
import { readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { snapshotTree } from "../support/world.mjs";
import { prepareV05ToolE2EFixtures } from "./v05-tool-e2e.mjs";
import { MUTATING_TOOL_NAMES, AUTHORING_TOOL_CONTRACTS } from "../../src/adapters/tool-contracts.js";

export const V06_ALL_TOOL_NAMES = Object.freeze(AUTHORING_TOOL_CONTRACTS.map((contract) => contract.tool));

export async function prepareV06ToolE2EFixtures(projectRoot) {
  await prepareV05ToolE2EFixtures(projectRoot);
  const testSpecDir = path.join(projectRoot, ".specs", "e2e-spec");
  await mkdir(testSpecDir, { recursive: true });
  await writeFile(
    path.join(testSpecDir, "README.md"),
    "# E2E Spec\n\n## Public states\n- Status: DRAFT\n\n## Section One\nContent 1\n\n## Section Two\nContent 2\n",
    "utf8",
  );
  await writeFile(
    path.join(testSpecDir, "TASKS.md"),
    "# Tasks\n\n## TASK-1 — E2E Task\n- **Status:** todo\n",
    "utf8",
  );
  await writeFile(
    path.join(testSpecDir, "FR.md"),
    "# Requirements\n\n## FR-1 — E2E Requirement\nRequirement details\n",
    "utf8",
  );
  await writeFile(path.join(testSpecDir, "ACCEPTANCE_CRITERIA.md"), "# Acceptance Criteria\n", "utf8");
  await writeFile(path.join(testSpecDir, "e2e-spec.feature"), "Feature: E2E\n", "utf8");
  await writeFile(path.join(testSpecDir, "e2e-spec_SCHEMA.md"), "# Schema\n", "utf8");
}

function structured(response) {
  assert.ok(response?.result, JSON.stringify(response));
  assert.equal(response.result.content?.length, 1, JSON.stringify(response));
  const value = response.result.structuredContent;
  assert.ok(value && typeof value === "object", JSON.stringify(response));
  const text = response.result.content[0].text;
  assert.equal(typeof text, "string");
  if (text.trimStart().startsWith("{")) {
    assert.deepEqual(JSON.parse(text), value);
  } else {
    assert.ok(text.startsWith(value.operation) || text.startsWith("spec_inventory") || text.startsWith("inventory"), text);
  }
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

export async function runV06ToolE2E({ listTools, callTool, projectRoot, repositoryRoot, phase = "all", restart = null }) {
  // Phase 1: Inventory
  if (phase === "all" || phase === "inventory") {
    const listed = await listTools();
    const tools = listed?.result?.tools;
    assert.ok(Array.isArray(tools), JSON.stringify(listed));
    const names = tools.map((tool) => tool.name);
    assert.deepEqual(names, V06_ALL_TOOL_NAMES, "v0.6 registration order is part of the contract");
    assert.equal(names.length, 49, "v0.6 exposes exactly 49 tools");

    for (const tool of tools) {
      assert.equal(tool.inputSchema.type, "object", tool.name);
      assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
      assert.ok(tool.inputSchema.properties && typeof tool.inputSchema.properties === "object", tool.name);
      const isMutating = MUTATING_TOOL_NAMES.has(tool.name);
      assert.equal(tool.annotations?.readOnlyHint, !isMutating, `readOnlyHint mismatch for ${tool.name}`);
    }
  }

  // Phase 2: Query and Read tools
  if (phase === "all" || phase === "queries") {
    const overviewRes = await callTool("spec_overview", { schemaVersion: "spec-kernel@1", requestId: "v06-overview", specSlugs: [] });
    const overview = structured(overviewRes);
    assert.equal(overview.ok, true);
    assert.ok(overview.graph?.fingerprint);

    const invRes = await callTool("spec_inventory", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-inventory",
      specSlugs: [],
      includeDocuments: false,
      limit: 50,
      cursor: null,
    });
    const inv = structured(invRes);
    assert.equal(inv.ok, true);
  }

  // Phase 3: Proposal tools (all 20 proposal tools must not mutate files on disk)
  if (phase === "all" || phase === "proposals") {
    const beforeState = await snapshotTree(projectRoot);
    const overviewRes = await callTool("spec_overview", { schemaVersion: "spec-kernel@1", requestId: "v06-proposal-overview", specSlugs: [] });
    const fingerprint = structured(overviewRes).graph.fingerprint;

    // 1. propose_patch
    const patchRes = await callTool("propose_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-propose-patch",
      repositoryRootFingerprint: fingerprint,
      spec: "e2e-spec",
      reason: "v06 e2e test",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "\n<!-- v06 e2e test -->\n" }],
    });
    const patchVal = structured(patchRes);
    assert.equal(patchVal.ok, true);
    assert.ok(patchVal.data.proposalHash);

    // 2. propose_spec_change
    const changeRes = await callTool("propose_spec_change", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-propose-change",
      spec: "e2e-spec",
      doc: "README.md",
      reason: "v06 e2e change",
      change: { kind: "insert_at_eof", text: "\n<!-- change test -->\n" },
    });
    const changeVal = structured(changeRes);
    assert.equal(changeVal.ok, true);

    // 3. append_to_section
    const appendRes = await callTool("append_to_section", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-append-section",
      spec: "e2e-spec",
      doc: "README.md",
      heading: "Section One",
      text: "\nAppended note.\n",
      reason: "v06 append test",
    });
    const appendVal = structured(appendRes);
    assert.equal(appendVal.ok, true);

    // 4. insert_after_heading
    const insertHRes = await callTool("insert_after_heading", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-insert-heading",
      spec: "e2e-spec",
      doc: "README.md",
      heading: "Section One",
      text: "\nInserted note.\n",
      reason: "v06 insert heading test",
    });
    const insertHVal = structured(insertHRes);
    assert.equal(insertHVal.ok, true);

    // 5. insert_at_eof
    const insertEofRes = await callTool("insert_at_eof", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-insert-eof",
      spec: "e2e-spec",
      doc: "README.md",
      text: "\n<!-- eof -->\n",
      reason: "v06 eof test",
    });
    const insertEofVal = structured(insertEofRes);
    assert.equal(insertEofVal.ok, true);

    // 6. replace_in_section
    const replaceRes = await callTool("replace_in_section", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-replace-section",
      spec: "e2e-spec",
      doc: "README.md",
      heading: "Section One",
      oldText: "Content 1",
      newText: "Content 1",
      replaceAll: false,
      reason: "v06 replace test",
    });
    const replaceVal = structured(replaceRes);
    assert.equal(replaceVal.ok, true);

    // 7. amend_requirement
    const amendRes = await callTool("amend_requirement", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-amend-req",
      spec: "e2e-spec",
      requirement: "FR-1",
      body: "\nAdditional requirement text.\n",
      reason: "v06 amend test",
    });
    const amendVal = structured(amendRes);
    assert.equal(amendVal.ok, true);

    // 8. add_acceptance_criterion
    const addAcRes = await callTool("add_acceptance_criterion", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-add-ac",
      spec: "e2e-spec",
      requirement: "FR-1",
      criterion: "Given verified conditions When tested Then pass",
      reason: "v06 add ac test",
    });
    const addAcVal = structured(addAcRes);
    assert.equal(addAcVal.ok, true);

    // 9. add_phase
    const addPhaseRes = await callTool("add_phase", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-add-phase",
      spec: "e2e-spec",
      title: "Testing Phase",
      reason: "v06 add phase test",
    });
    const addPhaseVal = structured(addPhaseRes);
    assert.equal(addPhaseVal.ok, true);

    // 10. set_entity_status
    const setEntityRes = await callTool("set_entity_status", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-set-entity",
      spec: "e2e-spec",
      entity: "TASK-1",
      status: "in-progress",
      reason: "v06 entity status test",
    });
    const setEntityVal = structured(setEntityRes);
    assert.equal(setEntityVal.ok, true);

    // 11. set_spec_status
    const setSpecStatusRes = await callTool("set_spec_status", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-set-spec-status",
      spec: "e2e-spec",
      status: "active",
      reason: "v06 spec status test",
    });
    const setSpecStatusVal = structured(setSpecStatusRes);
    assert.equal(setSpecStatusVal.ok, true);

    // 12. set_requirement_metadata
    const setReqMetaRes = await callTool("set_requirement_metadata", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-set-req-meta",
      spec: "e2e-spec",
      requirement: "FR-1",
      metadata: { schemaVersion: 1, verificationMethod: "test", safetyClass: "minor" },
      reason: "v06 req meta test",
    });
    const setReqMetaVal = structured(setReqMetaRes);
    assert.equal(setReqMetaVal.ok, true);

    // 13. propose_requirement_contract
    const propContractRes = await callTool("propose_requirement_contract", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-prop-contract",
      spec: "e2e-spec",
      requirement: "FR-1",
      contract: { schemaVersion: 1, contract: { version: 1, kind: "behavior" } },
      reason: "v06 req contract test",
    });
    const propContractVal = structured(propContractRes);
    assert.equal(propContractVal.ok, true);

    // 14. propose_spec_repairs
    const propRepairsRes = await callTool("propose_spec_repairs", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-prop-repairs",
      spec: "e2e-spec",
      reason: "v06 repairs test",
      repairs: [{ kind: "insert_at_eof", document: "README.md", text: "\n<!-- repaired -->\n" }],
    });
    const propRepairsVal = structured(propRepairsRes);
    assert.equal(propRepairsVal.ok, true);

    // 15. delete_spec_doc
    const delDocRes = await callTool("delete_spec_doc", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-del-doc",
      spec: "e2e-spec",
      doc: "e2e-spec_SCHEMA.md",
      reason: "v06 del doc test",
    });
    const delDocVal = structured(delDocRes);
    assert.equal(delDocVal.ok, true);

    // 16. rename_spec_doc
    const renameDocRes = await callTool("rename_spec_doc", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-rename-doc",
      spec: "e2e-spec",
      doc: "TASKS.md",
      newDoc: "FIXTURES.md",
      reason: "v06 rename doc test",
    });
    const renameDocVal = structured(renameDocRes);
    assert.equal(renameDocVal.ok, true);

    // 17. create_spec
    const createSpecRes = await callTool("create_spec", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-create-spec",
      spec: "new-temporary-spec",
      title: "New Temporary Spec",
      reason: "v06 create spec test",
    });
    const createSpecVal = structured(createSpecRes);
    assert.equal(createSpecVal.ok, true);

    // 18. archive_spec
    const archiveSpecRes = await callTool("archive_spec", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-archive-spec",
      spec: "e2e-spec",
      reason: "v06 archive spec test",
    });
    const archiveSpecVal = structured(archiveSpecRes);
    assert.equal(archiveSpecVal.ok, true);
    assert.ok(archiveSpecVal.data.archive);

    // 19. add_backlog_task
    const addBacklogRes = await callTool("add_backlog_task", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-add-backlog",
      spec: "e2e-spec",
      title: "Sample Backlog Item",
      reason: "v06 backlog test",
      requirements: ["FR-1"],
    });
    const addBacklogVal = structured(addBacklogRes);
    assert.equal(addBacklogVal.ok, true);

    // 20. register_incident_backlog
    const regIncidentRes = await callTool("register_incident_backlog", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-reg-incident",
      spec: "e2e-spec",
      summary: "Sample Incident",
      reason: "v06 incident test",
      requirements: ["FR-1"],
    });
    const regIncidentVal = structured(regIncidentRes);
    assert.equal(regIncidentVal.ok, true);

    // Check tree unchanged after all 20 proposal calls
    const afterState = await snapshotTree(projectRoot);
    assert.deepEqual(afterState, beforeState, "all 20 proposal operations must be strictly read-only");
  }

  // Phase 4: Apply operations and Replay Verification
  if (phase === "all" || phase === "apply") {
    const overviewRes = await callTool("spec_overview", { schemaVersion: "spec-kernel@1", requestId: "v06-apply-overview", specSlugs: [] });
    const fingerprint = structured(overviewRes).graph.fingerprint;

    // Propose a safe patch on e2e-spec
    const proposalRes = await callTool("propose_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-apply-prep",
      repositoryRootFingerprint: fingerprint,
      spec: "e2e-spec",
      reason: "apply proof",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "\n<!-- applied v06 marker -->\n" }],
    });
    const proposal = structured(proposalRes).data;
    const proposalHash = proposal.proposalHash;
    const expectedDocs = proposal.operations.map((op) => ({ path: op.path, beforeSha256: op.beforeSha256 }));

    // Valid apply via apply_proposed_patch
    const applyRes = await callTool("apply_proposed_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-apply-valid",
      proposalId: proposal.proposalId,
      proposalSha256: proposalHash,
      expectedDocuments: expectedDocs,
      reason: "valid apply",
      approval: "approve",
    });
    const applyVal = structured(applyRes);
    assert.equal(applyVal.ok, true);
    assert.equal(applyVal.data.outcome, "APPLIED");
    assert.equal(applyVal.data.receipt.reason, "approved proposal applied");

    // Exact replay must return identical receipt
    const replayRes = await callTool("apply_proposed_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-apply-valid",
      proposalId: proposal.proposalId,
      proposalSha256: proposalHash,
      expectedDocuments: expectedDocs,
      reason: "valid apply",
      approval: "approve",
    });
    const replayVal = structured(replayRes);
    assert.deepEqual(replayVal.data, applyVal.data, "exact replay must return identical receipt");

    // Conflicting replay must return CONFLICT
    const conflictRes = await callTool("apply_proposed_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-apply-valid",
      proposalId: proposal.proposalId,
      proposalSha256: proposalHash,
      expectedDocuments: expectedDocs,
      reason: "different reason",
      approval: "approve",
    });
    const conflictVal = structured(conflictRes);
    assert.equal(conflictVal.data?.outcome, "REFUSED");
    assert.equal(conflictVal.data?.error?.code, "CONFLICT");
  }

  // Phase 5: Secret rejection test
  if (phase === "all" || phase === "secrets") {
    const overviewRes = await callTool("spec_overview", { schemaVersion: "spec-kernel@1", requestId: "v06-secret-overview", specSlugs: [] });
    const fingerprint = structured(overviewRes).graph.fingerprint;

    const secretRes = await callTool("propose_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v06-secret-proposal",
      repositoryRootFingerprint: fingerprint,
      spec: "e2e-spec",
      reason: "secret leak attempt",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "\nghp_1234567890abcdef1234567890abcdef\n" }],
    });
    const secretVal = structured(secretRes);
    assert.equal(secretVal.ok, false);
    assert.equal(secretVal.error?.code, "VALIDATION_FAILED");
    assert.ok(secretVal.error?.message?.includes("secret-like content"));
  }

  return { ok: true, toolsCount: 49 };
}
