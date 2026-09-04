#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { annotationsFor, MUTATING_TOOL_NAMES, TOOL_CONTRACTS } from "../src/adapters/tool-contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const decisionPath = path.join(root, "docs", "decisions", "spec-generator-port.md");

function fail(message) {
  throw new Error(`spec-port: ${message}`);
}

const text = await readFile(decisionPath, "utf8");
const rows = [];
for (const line of text.split(/\r?\n/u)) {
  const match = line.match(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/u);
  if (match) rows.push({ number: Number(match[1]), name: match[2], owner: match[3].trim(), stage: match[4].trim() });
}
if (rows.length !== 35) fail(`expected 35 census rows, found ${rows.length}`);
for (const [index, row] of rows.entries()) {
  if (row.number !== index + 1) fail(`row numbering is not contiguous at ${row.number}`);
  if (!row.owner) fail(`row ${row.number} has empty owner`);
}
if (new Set(rows.map((row) => row.name)).size !== rows.length) fail("destination names are not unique");

if (TOOL_CONTRACTS.length !== 10) fail(`single surface drifted from 10 tools, found ${TOOL_CONTRACTS.length}`);
const annotationKeys = ["destructiveHint", "idempotentHint", "openWorldHint", "readOnlyHint"];
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const mutatingAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

for (const contract of TOOL_CONTRACTS) {
  if (typeof contract.label !== "string" || contract.label.trim() === "") fail(contract.tool + " has empty label");
  const firstDescriptionLine = String(contract.description).split(/\r?\n/u, 1)[0].trim();
  if (firstDescriptionLine.length === 0) fail(contract.tool + " has empty first description line");
  if (firstDescriptionLine.length > 200) fail(contract.tool + " first description line exceeds 200 characters");
  const annotations = annotationsFor(contract);
  if (JSON.stringify(Object.keys(annotations).sort()) !== JSON.stringify(annotationKeys)) {
    fail(contract.tool + " annotations must contain exactly four standard hints");
  }
  for (const key of annotationKeys) {
    if (typeof annotations[key] !== "boolean") fail(contract.tool + " annotation " + key + " must be boolean");
  }
  const expected = MUTATING_TOOL_NAMES.has(contract.tool) ? mutatingAnnotations : readAnnotations;
  if (JSON.stringify(annotations) !== JSON.stringify(expected)) {
    fail(contract.tool + " annotations do not match the semantic matrix");
  }
}

const UPSTREAM_TO_CONSOLIDATED = Object.freeze({
  get_node: "spec_entities",
  search: "spec_entities",
  find_refs: "spec_graph",
  get_trace: "spec_graph",
  conformance_check: "spec_inspect",
  find_by_tags: "spec_inspect",
  list_tasks: "spec_tasks",
  find_orphans: "spec_inspect",
  validate_anchor: "spec_inspect",
  list_specs: "spec_catalog",
  validate_requirement_metadata: "spec_inspect",
  policy_query_requirements: "spec_inspect",
  get_archival_proof: "spec_inspect",
  validate_spec: "spec_inspect",
  get_spec_status: "spec_catalog",
  mcp_preflight: "mcp_preflight",
  list_spec_docs: "spec_documents",
  read_spec_doc: "spec_documents",
  read_attachment: "spec_documents",
  get_test_result: "spec_evidence",
  get_scenario_trace: "spec_evidence",
  propose_patch: "spec_patch",
  apply_proposed_patch: "spec_patch",
  amend_requirement: "spec_patch",
  add_acceptance_criterion: "spec_patch",
  add_phase: "spec_patch",
  set_entity_status: "spec_patch",
  set_spec_status: "spec_patch",
  set_requirement_metadata: "spec_patch",
  delete_spec_doc: "spec_patch",
  rename_spec_doc: "spec_patch",
  create_spec: "spec_patch",
  archive_spec: "spec_patch",
  add_backlog_task: "spec_patch",
  register_incident_backlog: "spec_patch",
});

const contractedTools = new Set(TOOL_CONTRACTS.map((c) => c.tool));
for (const row of rows) {
  const targetTool = UPSTREAM_TO_CONSOLIDATED[row.name];
  if (!targetTool || !contractedTools.has(targetTool)) {
    fail(`census row ${row.name} has no valid consolidated tool in contracts`);
  }
}

console.log("verified spec port: tools=10");
