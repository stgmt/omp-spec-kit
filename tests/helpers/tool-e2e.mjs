import assert from "node:assert/strict";
import { readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { snapshotTree } from "../support/world.mjs";
import { prepareEvidenceFixtures } from "./evidence-e2e.mjs";
import {
  annotationsFor,
  KERNEL_ENVELOPE_OUTPUT_SCHEMA,
  MCP_SERVER_INSTRUCTIONS,
  MUTATING_TOOL_NAMES,
  TOOL_CONTRACTS,
} from "../../src/adapters/tool-contracts.js";

export const ALL_TOOL_NAMES = Object.freeze(TOOL_CONTRACTS.map((contract) => contract.tool));

function assertEnvelopeSchema(value) {
  assert.deepEqual(Object.keys(value).sort(), [...KERNEL_ENVELOPE_OUTPUT_SCHEMA.required].sort());
  for (const [name, definition] of Object.entries(KERNEL_ENVELOPE_OUTPUT_SCHEMA.properties)) {
    if (definition.type === undefined) continue;
    const valid = Array.isArray(definition.type)
      ? definition.type.includes(value[name] === null ? "null" : typeof value[name])
      : definition.type === "array"
        ? Array.isArray(value[name])
        : typeof value[name] === definition.type;
    assert.equal(valid, true, name + " has the wrong envelope type");
  }
}

export async function prepareToolE2EFixtures(projectRoot) {
  await prepareEvidenceFixtures(projectRoot);
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
  assertEnvelopeSchema(value);
  const text = response.result.content[0].text;
  assert.equal(typeof text, "string");
  assert.deepEqual(JSON.parse(text), value);
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

export async function runToolE2E({
  initialize = null,
  listTools,
  callTool,
  projectRoot,
  repositoryRoot,
  phase = "all",
  restart = null,
}) {
  // Phase 1: Inventory
  if (phase === "all" || phase === "inventory") {
    if (initialize) {
      const initialized = await initialize();
      assert.equal(initialized.result?.instructions, MCP_SERVER_INSTRUCTIONS);
    }
    const listed = await listTools();
    const tools = listed?.result?.tools;
    assert.ok(Array.isArray(tools), JSON.stringify(listed));
    const names = tools.map((tool) => tool.name);
    assert.deepEqual(names, ALL_TOOL_NAMES, "registration order is part of the contract");
    assert.equal(names.length, 11, "single surface exposes exactly 11 tools");

    for (const tool of tools) {
      assert.equal(tool.inputSchema.type, "object", tool.name);
      assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
      assert.ok(tool.inputSchema.properties && typeof tool.inputSchema.properties === "object", tool.name);
      const contract = TOOL_CONTRACTS.find((candidate) => candidate.tool === tool.name);
      assert.ok(contract, tool.name);
      assert.equal(tool.title, contract.label, `title mismatch for ${tool.name}`);
      assert.equal(tool.description.split(/\r?\n/u, 1)[0].trim().length <= 200, true, tool.name);
      assert.deepEqual(tool.annotations, annotationsFor(contract), `annotations mismatch for ${tool.name}`);
    }
  }

  // Phase 2: Query and Read tools
  if (phase === "all" || phase === "queries") {
    // 1. spec_catalog (overview, inventory, types, specs, status)
    const catalogOverview = structured(
      await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "v08-cat-overview", view: "overview" }),
    );
    assert.equal(catalogOverview.ok, true);
    assert.equal(catalogOverview.operation, "catalog");
    assert.equal(catalogOverview.data.kind, "overview");
    assert.ok(catalogOverview.graph?.fingerprint);

    const catalogTypes = structured(
      await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "v08-cat-types", view: "types" }),
    );
    assert.equal(catalogTypes.ok, true);
    assert.equal(catalogTypes.operation, "catalog");
    assert.equal(catalogTypes.data.kind, "types");
    assert.equal(catalogTypes.data.entityKinds.length, 15);
    assert.equal(catalogTypes.data.edgeTypes.length, 7);

    const catalogSpecs = structured(
      await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "v08-cat-specs", view: "specs" }),
    );
    assert.equal(catalogSpecs.ok, true);
    assert.equal(catalogSpecs.operation, "catalog");
    assert.equal(catalogSpecs.data.kind, "specs");

    const catalogInventory = structured(
      await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "v08-cat-inv", view: "inventory", limit: 10 }),
    );
    assert.equal(catalogInventory.ok, true);
    assert.equal(catalogInventory.operation, "catalog");
    assert.equal(catalogInventory.data.kind, "inventory");

    const catalogStatus = structured(
      await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "v08-cat-status", view: "status", statusView: "summary" }),
    );
    assert.equal(catalogStatus.ok, true);
    assert.equal(catalogStatus.operation, "catalog");
    assert.equal(catalogStatus.data.kind, "summary");

    // 2. spec_entities (find and get)
    const entitiesFind = structured(
      await callTool("spec_entities", { schemaVersion: "spec-kernel@1", requestId: "v08-ent-find", mode: "find", kinds: ["FUNCTIONAL_REQUIREMENT"] }),
    );
    assert.equal(entitiesFind.ok, true);
    assert.equal(entitiesFind.operation, "entities");
    assert.equal(entitiesFind.data.kind, "nodes");

    const entitiesGet = structured(
      await callTool("spec_entities", { schemaVersion: "spec-kernel@1", requestId: "v08-ent-get", mode: "get", canonicalId: "e2e-spec:FR-1" }),
    );
    assert.equal(entitiesGet.ok, true);
    assert.equal(entitiesGet.operation, "entities");
    assert.equal(entitiesGet.data.kind, "node");

    // 3. spec_graph (edges and trace)
    const graphEdges = structured(
      await callTool("spec_graph", { schemaVersion: "spec-kernel@1", requestId: "v08-graph-edges", view: "edges", canonicalId: "e2e-spec:FR-1" }),
    );
    assert.equal(graphEdges.ok, true);
    assert.equal(graphEdges.operation, "graph");
    assert.equal(graphEdges.data.kind, "edges");

    const graphTrace = structured(
      await callTool("spec_graph", { schemaVersion: "spec-kernel@1", requestId: "v08-graph-trace", view: "trace", canonicalId: "e2e-spec:FR-1" }),
    );
    assert.equal(graphTrace.ok, true);
    assert.equal(graphTrace.operation, "graph");
    assert.equal(graphTrace.data.kind, "trace");

    // 4. spec_documents (list and read)
    const docList = structured(
      await callTool("spec_documents", { schemaVersion: "spec-kernel@1", requestId: "v08-doc-list", action: "list", spec: "e2e-spec" }),
    );
    assert.equal(docList.ok, true);
    assert.equal(docList.operation, "documents");
    assert.equal(docList.data.kind, "spec-documents");

    const docRead = structured(
      await callTool("spec_documents", { schemaVersion: "spec-kernel@1", requestId: "v08-doc-read", action: "read", spec: "e2e-spec", doc: "FR.md" }),
    );
    assert.equal(docRead.ok, true);
    assert.equal(docRead.operation, "documents");
    assert.equal(docRead.data.kind, "document");

    // 5. spec_inspect (orphans and validation)
    const inspectOrphans = structured(
      await callTool("spec_inspect", { schemaVersion: "spec-kernel@1", requestId: "v08-ins-orphans", check: "orphans" }),
    );
    assert.equal(inspectOrphans.ok, true);
    assert.equal(inspectOrphans.operation, "inspect");
    assert.equal(inspectOrphans.data.kind, "orphans");

    const inspectVal = structured(
      await callTool("spec_inspect", { schemaVersion: "spec-kernel@1", requestId: "v08-ins-val", check: "validation", limit: 10 }),
    );
    assert.equal(inspectVal.ok, true);
    assert.equal(inspectVal.operation, "inspect");
    assert.equal(inspectVal.data.kind, "validation");
    assert.equal(typeof inspectVal.data.valid, "boolean");
    assert.ok(["VALID", "INVALID"].includes(inspectVal.data.verdict));
    assert.ok(inspectVal.data.counts && typeof inspectVal.data.counts.total === "number");
    assert.ok(typeof inspectVal.data.counts.matched === "number");
    assert.ok(Array.isArray(inspectVal.data.items));

    // Refuse old check discriminators and old single spec field
    const inspectOldDiag = structured(
      await callTool("spec_inspect", { schemaVersion: "spec-kernel@1", requestId: "v08-ins-old-diag", check: "diagnostics" }),
    );
    assert.equal(inspectOldDiag.ok, false);
    assert.equal(inspectOldDiag.error.code, "INVALID_REQUEST");

    const inspectOldSpecVal = structured(
      await callTool("spec_inspect", { schemaVersion: "spec-kernel@1", requestId: "v08-ins-old-specval", check: "specValidation", spec: "e2e-spec" }),
    );
    assert.equal(inspectOldSpecVal.ok, false);
    assert.equal(inspectOldSpecVal.error.code, "INVALID_REQUEST");

    const inspectOldSpecField = structured(
      await callTool("spec_inspect", { schemaVersion: "spec-kernel@1", requestId: "v08-ins-old-spec-field", check: "validation", spec: "e2e-spec" }),
    );
    assert.equal(inspectOldSpecField.ok, false);
    assert.equal(inspectOldSpecField.error.code, "INVALID_REQUEST");

    // 6. spec_tasks
    const tasksRes = structured(
      await callTool("spec_tasks", { schemaVersion: "spec-kernel@1", requestId: "v08-tasks", spec: "e2e-spec" }),
    );
    assert.equal(tasksRes.ok, true);
    assert.equal(tasksRes.operation, "tasks");
    assert.equal(tasksRes.data.kind, "tasks");

    // 7. spec_evidence (result and trace)
    const evidenceRes = structured(
      await callTool("spec_evidence", { schemaVersion: "spec-kernel@1", requestId: "v08-ev-res", view: "result", scenarioId: "product:SCEN-specification-only-init" }),
    );
    assert.equal(evidenceRes.ok, true);
    assert.equal(evidenceRes.operation, "evidence");
    assert.equal(evidenceRes.data.kind, "test-result");

    const evidenceTrace = structured(
      await callTool("spec_evidence", { schemaVersion: "spec-kernel@1", requestId: "v08-ev-tr", view: "trace", scenarioId: "product:SCEN-specification-only-init" }),
    );
    assert.equal(evidenceTrace.ok, true);
    assert.equal(evidenceTrace.operation, "evidence");
    assert.equal(evidenceTrace.data.kind, "scenario-trace");

    // 8. spec_markdown
    const mdRes = structured(
      await callTool("spec_markdown", { schemaVersion: "spec-kernel@1", requestId: "v08-md", specSlugs: ["e2e-spec"] }),
    );
    assert.equal(mdRes.ok, true);
    assert.equal(mdRes.operation, "markdown");
    assert.equal(mdRes.data.kind, "markdownInventory");

    // 9. mcp_preflight
    const preflightRes = structured(
      await callTool("mcp_preflight", { schemaVersion: "spec-kernel@1", requestId: "v08-preflight" }),
    );
    assert.equal(preflightRes.ok, true);
    assert.equal(preflightRes.operation, "mcpPreflight");
    assert.equal(preflightRes.data.kind, "mcp-preflight");
  }

  // Phase 3: Proposal tools (all proposal calls must not mutate files on disk)
  if (phase === "all" || phase === "proposals") {
    const beforeState = await snapshotTree(projectRoot);
    const catRes = await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "v08-proposal-cat", view: "overview" });
    const fingerprint = structured(catRes).graph.fingerprint;

    // 1. spec_propose_patch with intent: patch
    const patchRes = await callTool("spec_propose_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v08-prop-patch",
      intent: "patch",
      repositoryRootFingerprint: fingerprint,
      spec: "e2e-spec",
      reason: "v08 e2e patch test",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "\n<!-- v08 e2e test -->\n" }],
    });
    const patchVal = structured(patchRes);
    assert.equal(patchVal.ok, true);
    assert.equal(patchVal.operation, "proposePatch");
    assert.ok(patchVal.data.proposalHash);

    // 2. multi-operation patch
    const multiRes = await callTool("spec_propose_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v08-prop-multi",
      intent: "patch",
      repositoryRootFingerprint: fingerprint,
      spec: "e2e-spec",
      reason: "v08 multi-op test",
      operations: [
        { kind: "insert_after_heading", document: "README.md", heading: "Section One", text: "\nAppended note.\n" },
        { kind: "insert_after_heading", document: "TASKS.md", heading: "TASK-1 — E2E Task", text: "\nInserted note.\n" },
        { kind: "insert_at_eof", document: "ACCEPTANCE_CRITERIA.md", text: "\n<!-- eof -->\n" },
        { kind: "replace_in_section", document: "FR.md", heading: "FR-1 — E2E Requirement", oldText: "Requirement details", newText: "Requirement details consolidated", replaceAll: false },
      ],
    });
    const multiVal = structured(multiRes);
    assert.equal(multiVal.ok, true);

    // 3. amendRequirement
    const amendRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-amend",
        intent: "amendRequirement",
        spec: "e2e-spec",
        requirement: "FR-1",
        body: "\nAdditional requirement text.\n",
        reason: "v08 amend test",
      }),
    );
    assert.equal(amendRes.ok, true);

    // 4. addAcceptanceCriterion
    const addAcRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-add-ac",
        intent: "addAcceptanceCriterion",
        spec: "e2e-spec",
        requirement: "FR-1",
        criterion: "Given verified conditions When tested Then pass",
        reason: "v08 add ac test",
      }),
    );
    assert.equal(addAcRes.ok, true);

    // 5. addPhase
    const addPhaseRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-add-phase",
        intent: "addPhase",
        spec: "e2e-spec",
        title: "Testing Phase",
        reason: "v08 add phase test",
      }),
    );
    assert.equal(addPhaseRes.ok, true);

    // 6. setEntityStatus
    const setEntityRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-set-entity",
        intent: "setEntityStatus",
        spec: "e2e-spec",
        entity: "TASK-1",
        status: "in-progress",
        reason: "v08 entity status test",
      }),
    );
    assert.equal(setEntityRes.ok, true);

    // 7. setSpecStatus
    const setSpecStatusRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-set-spec-status",
        intent: "setSpecStatus",
        spec: "e2e-spec",
        status: "active",
        reason: "v08 spec status test",
      }),
    );
    assert.equal(setSpecStatusRes.ok, true);

    // 8. setRequirementMetadata
    const setReqMetaRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-set-req-meta",
        intent: "setRequirementMetadata",
        spec: "e2e-spec",
        requirement: "FR-1",
        metadata: { schemaVersion: 1, verificationMethod: "test", safetyClass: "minor" },
        reason: "v08 req meta test",
      }),
    );
    assert.equal(setReqMetaRes.ok, true);

    // 9. deleteSpecDoc
    const delDocRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-del-doc",
        intent: "deleteSpecDoc",
        spec: "e2e-spec",
        doc: "e2e-spec_SCHEMA.md",
        reason: "v08 del doc test",
      }),
    );
    assert.equal(delDocRes.ok, true);

    // 10. renameSpecDoc
    const renameDocRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-rename-doc",
        intent: "renameSpecDoc",
        spec: "e2e-spec",
        doc: "TASKS.md",
        newDoc: "FIXTURES.md",
        reason: "v08 rename doc test",
      }),
    );
    assert.equal(renameDocRes.ok, true);

    // 11. createSpec
    const createSpecRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-create-spec",
        intent: "createSpec",
        spec: "new-temporary-spec",
        title: "New Temporary Spec",
        reason: "v08 create spec test",
      }),
    );
    assert.equal(createSpecRes.ok, true);

    // 12. archiveSpec
    const archiveSpecRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-archive-spec",
        intent: "archiveSpec",
        spec: "e2e-spec",
        reason: "v08 archive spec test",
      }),
    );
    assert.equal(archiveSpecRes.ok, true);

    // 13. addBacklogTask
    const addBacklogRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-add-backlog",
        intent: "addBacklogTask",
        spec: "e2e-spec",
        title: "Sample Backlog Item",
        reason: "v08 backlog test",
        requirements: { items: ["FR-1"] },
      }),
    );
    assert.equal(addBacklogRes.ok, true);

    // 14. registerIncidentBacklog
    const regIncidentRes = structured(
      await callTool("spec_propose_patch", {
        schemaVersion: "spec-kernel@1",
        requestId: "v08-prop-reg-incident",
        intent: "registerIncidentBacklog",
        spec: "e2e-spec",
        summary: "Sample Incident",
        reason: "v08 incident test",
        requirements: { items: ["FR-1"] },
      }),
    );
    assert.equal(regIncidentRes.ok, true);

    // Check tree unchanged after all 14 proposal calls
    const afterState = await snapshotTree(projectRoot);
    assert.deepEqual(afterState, beforeState, "all proposal operations must be strictly read-only");
  }

  // Phase 4: Apply operations and Replay Verification
  if (phase === "all" || phase === "apply") {
    const catRes = await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "v08-apply-overview", view: "overview" });
    const fingerprint = structured(catRes).graph.fingerprint;

    // Propose a safe patch on e2e-spec
    const proposalRes = await callTool("spec_propose_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v08-apply-prep",
      intent: "patch",
      repositoryRootFingerprint: fingerprint,
      spec: "e2e-spec",
      reason: "apply proof",
      operations: [{ kind: "insert_at_eof", document: "README.md", text: "\n<!-- applied v08 marker -->\n" }],
    });
    const proposal = structured(proposalRes).data;
    const proposalHash = proposal.proposalHash;
    const expectedDocs = proposal.operations.map((op) => ({ path: op.path, beforeSha256: op.beforeSha256 }));

    // Valid apply via apply_proposed_patch
    const applyRes = await callTool("apply_proposed_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v08-apply-valid",
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
      requestId: "v08-apply-valid",
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
      requestId: "v08-apply-valid",
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
    const catRes = await callTool("spec_catalog", { schemaVersion: "spec-kernel@1", requestId: "v08-secret-cat", view: "overview" });
    const fingerprint = structured(catRes).graph.fingerprint;

    const secretRes = await callTool("spec_propose_patch", {
      schemaVersion: "spec-kernel@1",
      requestId: "v08-secret-proposal",
      intent: "patch",
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

  return { ok: true, toolsCount: 11 };
}
