#!/usr/bin/env node
/**
 * Protect the generator-port destination contract:
 * - exact 46-name conservation between the audited source registry and decision table;
 * - unique canonical numbering 1..46 with non-empty owner/stage;
 * - immutable eight-name v0.3 first slice;
 * - no wording that turns that first slice into the destination ceiling or routes agents through LSP.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DECISION_PATH = path.join(ROOT, "docs", "decisions", "spec-generator-port.md");
const SELF = path.normalize("scripts/check-spec-generator-port-freeze.mjs");

const PINNED_SOURCE_SHA256 = "200cd8cf44bd9b1059ec8942cbf74104e1dab7f7e66a3f8fc44a682821f3c3e8";
const PINNED_SOURCE_NAMES = Object.freeze([
  "get_node",
  "search",
  "find_refs",
  "get_trace",
  "conformance_check",
  "find_by_tags",
  "list_tasks",
  "list_phase_tasks",
  "find_orphans",
  "validate_anchor",
  "list_specs",
  "validate_requirement_metadata",
  "policy_query_requirements",
  "get_archival_proof",
  "validate_spec",
  "get_spec_status",
  "mcp_preflight",
  "list_spec_docs",
  "read_spec_doc",
  "read_attachment",
  "get_test_result",
  "get_scenario_trace",
  "propose_spec_change",
  "apply_spec_change",
  "propose_patch",
  "apply_proposed_patch",
  "apply_spec_transaction",
  "append_to_section",
  "insert_after_heading",
  "insert_at_eof",
  "replace_in_section",
  "amend_requirement",
  "add_acceptance_criterion",
  "add_phase",
  "set_entity_status",
  "set_spec_status",
  "set_requirement_metadata",
  "propose_requirement_contract",
  "propose_spec_repairs",
  "apply_spec_repairs",
  "delete_spec_doc",
  "rename_spec_doc",
  "create_spec",
  "archive_spec",
  "add_backlog_task",
  "register_incident_backlog",
]);

const FIRST_SLICE_NAMES = Object.freeze([
  "spec_inventory",
  "spec_get_node",
  "spec_find_nodes",
  "spec_get_edges",
  "spec_trace",
  "spec_diagnostics",
  "spec_overview",
  "spec_markdown_inventory",
]);

const ALLOWED_STAGES = new Set([
  "v0.3-first-slice",
  "later-kernel-fr16",
  "later-kernel-fr17",
  "later-evidence",
  "later-authoring-v1",
  "later-authoring-v2",
]);

const SKIP_DIR = new Set([
  ".git",
  "node_modules",
  "dist",
  "tests",
  "src",
  "docs/upstream",
  "docs/plans",
  "docs/validation",
]);

const FORBIDDEN = [
  /not the (upstream )?46-tool/i,
  /there is no 46-tool door to prune/i,
  /46-tool door is upstream/i,
  /46-tool table is not this product/i,
  /Agent navigating spec definitions through LSP primitives/i,
  /MCP registry SHALL remain the eight/i,
  /this FR SHALL NOT add a ninth MCP tool/i,
  /MCP remains eight tools/i,
  /(?:read-only )?MCP surface remains exactly eight tools/i,
  /surface remains exactly eight tools/i,
  /rather than copying the upstream mixed registry/i,
];
const ALLOW_NEAR = /first slice|v0\.3 candidate|SCHEMA-11|current v0\.3 proof|historical v0\.3/i;

const scanRoots = [
  "README.md",
  "ROADMAP.md",
  "CHANGELOG.md",
  "plugins/omp-spec-kit/README.md",
  "scripts",
  "docs/decisions",
  ".specs/product",
  ".specs/plugin-distribution",
  ".specs/spec-kernel",
  ".specs/spec-lsp",
  ".specs/spec-evidence",
  ".specs/spec-authoring-workflow",
  ".specs/mcp-release-integrity/README.md",
];

function fail(message) {
  console.error(`spec-generator-port freeze check: ${message}`);
  process.exit(1);
}

function unique(values) {
  return new Set(values).size === values.length;
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function assertSameSet(label, actual, expected) {
  const actualSorted = sorted(actual);
  const expectedSorted = sorted(expected);
  const missing = expectedSorted.filter((name) => !actualSorted.includes(name));
  const extra = actualSorted.filter((name) => !expectedSorted.includes(name));
  if (missing.length || extra.length || actualSorted.length !== expectedSorted.length) {
    fail(`${label} differs (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
  }
}

function sourceRegistryPath() {
  const candidates = [
    process.env.SPEC_GENERATOR_SOURCE_TOOLS,
    process.env.DEV_POMOGATOR_REPO_ROOT
      ? path.join(process.env.DEV_POMOGATOR_REPO_ROOT, "tools", "spec-mcp-server", "tools.ts")
      : null,
    path.resolve(ROOT, "..", "dev-pomogator", "tools", "spec-mcp-server", "tools.ts"),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function parseSourceNames(sourceText) {
  return [...sourceText.matchAll(/\bname:\s*['"]([a-z0-9_]+)['"]/g)].map((match) => match[1]);
}

function parseDecision(decisionText) {
  const censusStart = decisionText.indexOf("## Closed 46-name census");
  const censusEnd = decisionText.indexOf("\nCount: 46", censusStart);
  if (censusStart < 0 || censusEnd < 0) fail("decision lacks the closed census or exact Count: 46 marker");
  const census = decisionText.slice(censusStart, censusEnd);
  const rows = [...census.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm)].map(
    (match) => ({ number: Number(match[1]), name: match[2], owner: match[3].trim(), stage: match[4].trim() }),
  );

  const sliceStart = decisionText.indexOf("## v0.3 first slice");
  const sliceEnd = decisionText.indexOf("## Closed 46-name census", sliceStart);
  if (sliceStart < 0 || sliceEnd < 0) fail("decision lacks the v0.3 first-slice table");
  const firstSlice = [...decisionText.slice(sliceStart, sliceEnd).matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map(
    (match) => match[1],
  );
  return { rows, firstSlice };
}

function validateCensus() {
  const decisionText = fs.readFileSync(DECISION_PATH, "utf8");
  if (!decisionText.includes("Source registry SHA-256:") || !decisionText.includes(`\`${PINNED_SOURCE_SHA256}\``)) {
    fail("decision source-registry SHA-256 marker is missing or stale");
  }
  const { rows, firstSlice } = parseDecision(decisionText);
  if (rows.length !== 46) fail(`decision has ${rows.length} census rows, expected 46`);
  if (!unique(rows.map((row) => row.number))) fail("decision census numbers are duplicated");
  if (!unique(rows.map((row) => row.name))) fail("decision census names are duplicated");
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.number !== index + 1) fail(`decision numbering is not exact 1..46 at row ${index + 1}`);
    if (!row.owner || row.owner === "—") fail(`decision owner is empty for ${row.name}`);
    const stageKey = row.stage.split(/\s+/u)[0];
    if (!ALLOWED_STAGES.has(stageKey)) fail(`decision stage is empty/unknown for ${row.name}: ${row.stage}`);
  }
  assertSameSet("decision/source census", rows.map((row) => row.name), PINNED_SOURCE_NAMES);
  if (firstSlice.length !== FIRST_SLICE_NAMES.length || firstSlice.some((name, index) => name !== FIRST_SLICE_NAMES[index])) {
    fail(`v0.3 first slice differs: ${firstSlice.join(", ")}`);
  }

  const sourcePath = sourceRegistryPath();
  if (sourcePath !== null) {
    const sourceText = fs.readFileSync(sourcePath, "utf8");
    const sourceDigest = createHash("sha256").update(sourceText).digest("hex");
    if (sourceDigest !== PINNED_SOURCE_SHA256) {
      fail(`source tools.ts SHA-256 changed (${sourceDigest}); refresh the audited census and decision together`);
    }
    const sourceNames = parseSourceNames(sourceText);
    if (sourceNames.length !== 46 || !unique(sourceNames)) {
      fail(`source tools.ts has ${sourceNames.length} names or duplicates, expected 46 unique`);
    }
    assertSameSet("live source/decision census", sourceNames, rows.map((row) => row.name));
    return `source-equal (${path.normalize(sourcePath)})`;
  }
  return `source snapshot ${PINNED_SOURCE_SHA256}`;
}

function walk(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return [relativePath];
  const output = [];
  for (const name of fs.readdirSync(absolutePath)) {
    const child = path.join(relativePath, name);
    const normalized = child.replaceAll("\\", "/");
    const childStat = fs.statSync(path.join(ROOT, child));
    if (childStat.isDirectory()) {
      if (SKIP_DIR.has(name) || SKIP_DIR.has(normalized)) continue;
      output.push(...walk(child));
    } else if (/\.(md|feature|mjs|cjs|js)$/i.test(name)) {
      output.push(child);
    }
  }
  return output;
}

function validateWording() {
  const hits = [];
  for (const relativePath of scanRoots.flatMap(walk)) {
    if (path.normalize(relativePath) === SELF) continue;
    const lines = fs.readFileSync(path.join(ROOT, relativePath), "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const window = [lines[index - 1] ?? "", line, lines[index + 1] ?? ""].join("\n");
      for (const forbidden of FORBIDDEN) {
        if (forbidden.test(line) && !ALLOW_NEAR.test(window)) {
          hits.push(`${relativePath}:${index + 1}: ${line.trim()}`);
        }
      }
    }
  }
  if (hits.length) fail(`wording leftovers:\n${hits.join("\n")}`);
}

const sourceStatus = validateCensus();
validateWording();
console.log(`spec-generator-port freeze check: clean; 46/46 ${sourceStatus}; 8/8 first-slice names preserved`);
