#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTHORING_TOOL_CONTRACTS, EVIDENCE_TOOL_CONTRACTS, READ_COMPLETE_TOOL_CONTRACTS, SAFE_AUTHORING_TOOL_CONTRACTS, TOOL_CONTRACTS, V05_TOOL_CONTRACTS } from "../src/adapters/tool-contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const decisionPath = path.join(root, "docs", "decisions", "spec-generator-port.md");
const firstSlice = new Set(["spec_inventory", "spec_get_node", "spec_find_nodes", "spec_get_edges", "spec_trace", "spec_diagnostics", "spec_overview", "spec_markdown_inventory"]);
const expectedStages = new Map([
  ["v0.3.2", 5],
  ["v0.4.0-read-complete", 15],
  ["v0.5.0-evidence", 2],
  ["v0.6.0-authoring-v1", 17],
  ["v0.6.0-authoring-v2", 7],
]);

function fail(message) {
  throw new Error(`spec-port: ${message}`);
}

const text = await readFile(decisionPath, "utf8");
const rows = [];
for (const line of text.split(/\r?\n/u)) {
  const match = line.match(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/u);
  if (match) rows.push({ number: Number(match[1]), name: match[2], owner: match[3].trim(), stage: match[4].trim() });
}
if (rows.length !== 46) fail(`expected 46 census rows, found ${rows.length}`);
for (const [index, row] of rows.entries()) {
  if (row.number !== index + 1) fail(`row numbering is not contiguous at ${row.number}`);
  if (!row.owner || !row.stage) fail(`row ${row.number} has empty owner or stage`);
}
if (new Set(rows.map((row) => row.name)).size !== rows.length) fail("destination names are not unique");
if (!rows.slice(0, 5).every((row) => row.stage.startsWith("v0.3.2"))) fail("the five historical aliases must stay in the shipped stage");
const stageCounts = new Map();
for (const row of rows) {
  const stage = row.stage.startsWith("v0.3.2") ? "v0.3.2" : row.stage;
  stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
}
for (const [stage, count] of expectedStages) if (stageCounts.get(stage) !== count) fail(`${stage} has ${stageCounts.get(stage) ?? 0} rows, expected ${count}`);
if (![...firstSlice].every((name) => text.includes(`| \`${name}\` |`))) fail("a historical first-slice name is missing");
if (TOOL_CONTRACTS.length !== 8 || SAFE_AUTHORING_TOOL_CONTRACTS.length !== 10 || READ_COMPLETE_TOOL_CONTRACTS.length !== 23 || V05_TOOL_CONTRACTS.length !== 27 || EVIDENCE_TOOL_CONTRACTS.length !== 25 || AUTHORING_TOOL_CONTRACTS.length !== 49) fail("stage contract counts drifted from 8/10/23/27/25/49");
console.log("verified spec port: census=46; contracts=8/10/23/27/25/49");
