#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TOOL_CONTRACTS } from "../src/adapters/tool-contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const decisionPath = path.join(root, "docs", "decisions", "spec-generator-port.md");
const firstSlice = new Set(["spec_inventory", "spec_get_node", "spec_find_nodes", "spec_get_edges", "spec_trace", "spec_diagnostics", "spec_overview", "spec_markdown_inventory"]);

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
if (![...firstSlice].every((name) => text.includes(`| \`${name}\` |`))) fail("a historical first-slice name is missing");
if (TOOL_CONTRACTS.length !== 38) fail(`single surface drifted from 38 tools, found ${TOOL_CONTRACTS.length}`);
const contracted = new Set(TOOL_CONTRACTS.map((contract) => contract.tool));
const missing = rows.filter((row) => row.stage === "single surface" && !contracted.has(row.name) && !["get_node", "search", "find_refs", "get_trace", "conformance_check"].includes(row.name));
if (missing.length > 0) fail(`census rows missing from contracts: ${missing.map((row) => row.name).join(",")}`);
console.log("verified spec port: tools=38");
