#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const EXPECTED_11_TOOLS = Object.freeze([
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

export const RETIRED_TOOL_NAMES = Object.freeze([
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

export const LIMITS = Object.freeze({
  toolCount: 11,
  readOnlyCount: 10,
  mutatingCount: 1,
  maxTotalCatalogBytes: 25499, // 60% of baseline 42499
  maxDescriptionChars: 2000,
});

export function computeMetrics(tools) {
  const payload = { tools };
  const rawPayloadJson = JSON.stringify(payload);
  const rawPayloadSha256 = createHash("sha256").update(rawPayloadJson).digest("hex");
  const totalCatalogBytes = Buffer.byteLength(rawPayloadJson, "utf8");
  const schemaBytes = tools.reduce(
    (acc, t) => acc + Buffer.byteLength(JSON.stringify(t.inputSchema ?? {}), "utf8"),
    0,
  );
  const descriptionChars = tools.reduce((acc, t) => acc + (t.description?.length ?? 0), 0);
  const nameChars = tools.reduce((acc, t) => acc + (t.name?.length ?? 0), 0);
  const readOnlyCount = tools.filter((t) => t.annotations?.readOnlyHint === true).length;
  const mutatingCount = tools.filter((t) => t.annotations?.readOnlyHint !== true).length;

  return {
    sha256: rawPayloadSha256,
    toolCount: tools.length,
    readOnlyCount,
    mutatingCount,
    totalCatalogBytes,
    schemaBytes,
    descriptionChars,
    nameChars,
  };
}

export function computeDeltas(baselineMetrics, candidateMetrics) {
  const keys = [
    "toolCount",
    "readOnlyCount",
    "mutatingCount",
    "totalCatalogBytes",
    "schemaBytes",
    "descriptionChars",
    "nameChars",
  ];

  const deltas = {};
  for (const key of keys) {
    const baseVal = baselineMetrics[key] ?? 0;
    const candVal = candidateMetrics[key] ?? 0;
    const absolute = candVal - baseVal;
    const percentage = baseVal !== 0 ? Number(((absolute / baseVal) * 100).toFixed(2)) : 0;
    deltas[key] = {
      baseline: baseVal,
      candidate: candVal,
      absolute,
      percentage,
    };
  }
  return deltas;
}

export function evaluateGates(candidateMetrics, candidateTools) {
  const candidateNames = candidateTools.map((t) => t.name);
  const retiredPresent = RETIRED_TOOL_NAMES.filter((name) => candidateNames.includes(name));
  const missingExpected = EXPECTED_11_TOOLS.filter((name) => !candidateNames.includes(name));
  const unexpected = candidateNames.filter((name) => !EXPECTED_11_TOOLS.includes(name));

  const toolCountIs11 = candidateMetrics.toolCount === LIMITS.toolCount;
  const readOnlyCountIs10 = candidateMetrics.readOnlyCount === LIMITS.readOnlyCount;
  const mutatingCountIs1 = candidateMetrics.mutatingCount === LIMITS.mutatingCount;
  const noRetiredNames = retiredPresent.length === 0;
  const catalogBytesWithinLimit = candidateMetrics.totalCatalogBytes <= LIMITS.maxTotalCatalogBytes;
  const descriptionCharsWithinLimit = candidateMetrics.descriptionChars <= LIMITS.maxDescriptionChars;
  const exactToolsMatch = missingExpected.length === 0 && unexpected.length === 0;

  const passed =
    toolCountIs11 &&
    readOnlyCountIs10 &&
    mutatingCountIs1 &&
    noRetiredNames &&
    catalogBytesWithinLimit &&
    descriptionCharsWithinLimit &&
    exactToolsMatch;

  return {
    passed,
    toolCountIs11,
    readOnlyCountIs10,
    mutatingCountIs1,
    noRetiredNames,
    retiredPresent,
    catalogBytesWithinLimit,
    maxAllowedCatalogBytes: LIMITS.maxTotalCatalogBytes,
    descriptionCharsWithinLimit,
    maxAllowedDescriptionChars: LIMITS.maxDescriptionChars,
    exactToolsMatch,
    missingExpected,
    unexpected,
  };
}

export function queryServerTools(serverPath, root = repositoryRoot) {
  const input = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
  ].join("\n") + "\n";

  const res = spawnSync(process.execPath, [serverPath], {
    cwd: root,
    env: { ...process.env, OMP_SPEC_KIT_ROOT: root },
    input,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Server at ${serverPath} exited ${res.status}: ${res.stderr}`);
  }

  const lines = res.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const listRes = lines.find((l) => l.id === 2);
  if (!listRes?.result?.tools) {
    throw new Error(`tools/list response missing from server output: ${res.stdout}`);
  }
  return listRes.result.tools;
}

async function main() {
  const args = process.argv.slice(2);
  let serverPath = path.resolve(repositoryRoot, "plugins", "omp-spec-kit", "dist", "mcp", "server.js");
  let baselinePath = path.resolve(repositoryRoot, "tests", "fixtures", "tool-surface", "38-tool-baseline.json");
  let outputPath = path.resolve(repositoryRoot, "docs", "validation", "tool-surface-blast-v0.8.0.json");
  let checkOnly = false;
  let useSrc = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--server" && args[i + 1]) {
      serverPath = path.resolve(args[++i]);
    } else if (args[i] === "--baseline" && args[i + 1]) {
      baselinePath = path.resolve(args[++i]);
    } else if (args[i] === "--output" && args[i + 1]) {
      outputPath = path.resolve(args[++i]);
    } else if (args[i] === "--check-only") {
      checkOnly = true;
    } else if (args[i] === "--src") {
      useSrc = true;
      serverPath = path.resolve(repositoryRoot, "src", "mcp", "server.js");
    }
  }

  const baselineRaw = JSON.parse(await readFile(baselinePath, "utf8"));
  const baselineMetrics = baselineRaw.metrics;
  const baselineTools = baselineRaw.tools;

  const candidateTools = queryServerTools(serverPath);
  const candidateMetrics = computeMetrics(candidateTools);
  const deltas = computeDeltas(baselineMetrics, candidateMetrics);
  const gates = evaluateGates(candidateMetrics, candidateTools);

  const report = {
    schema: "omp-spec-kit-tool-surface-blast@1",
    timestamp: new Date().toISOString(),
    serverPath: path.relative(repositoryRoot, serverPath).replace(/\\/g, "/"),
    baseline: {
      sha256: baselineRaw.sha256,
      metrics: baselineMetrics,
    },
    candidate: {
      sha256: candidateMetrics.sha256,
      metrics: candidateMetrics,
    },
    deltas,
    gates,
  };

  if (!checkOnly) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log(`Saved tool blast report to: ${path.relative(repositoryRoot, outputPath)}`);
  }

  console.log("Tool Surface Blast Summary:");
  console.log(`  Candidate Tools: ${candidateMetrics.toolCount} (Expected: ${LIMITS.toolCount})`);
  console.log(`  Read-only Tools: ${candidateMetrics.readOnlyCount} (Expected: ${LIMITS.readOnlyCount})`);
  console.log(`  Mutating Tools:  ${candidateMetrics.mutatingCount} (Expected: ${LIMITS.mutatingCount})`);
  console.log(`  Catalog Bytes:   ${candidateMetrics.totalCatalogBytes} (Max allowed: ${LIMITS.maxTotalCatalogBytes}, Baseline: ${baselineMetrics.totalCatalogBytes})`);
  console.log(`  Schema Bytes:    ${candidateMetrics.schemaBytes} (Baseline: ${baselineMetrics.schemaBytes})`);
  console.log(`  Desc Chars:      ${candidateMetrics.descriptionChars} (Max allowed: ${LIMITS.maxDescriptionChars}, Baseline: ${baselineMetrics.descriptionChars})`);
  console.log(`  Gates Passed:    ${gates.passed}`);

  if (!gates.passed) {
    console.error("FAIL CLOSED: Tool surface blast gates failed:");
    if (!gates.toolCountIs11) console.error(`  - Tool count is ${candidateMetrics.toolCount}, expected ${LIMITS.toolCount}`);
    if (!gates.readOnlyCountIs10) console.error(`  - Read-only count is ${candidateMetrics.readOnlyCount}, expected ${LIMITS.readOnlyCount}`);
    if (!gates.mutatingCountIs1) console.error(`  - Mutating count is ${candidateMetrics.mutatingCount}, expected ${LIMITS.mutatingCount}`);
    if (!gates.noRetiredNames) console.error(`  - Retired tool names present: ${gates.retiredPresent.join(", ")}`);
    if (!gates.catalogBytesWithinLimit) console.error(`  - Catalog bytes ${candidateMetrics.totalCatalogBytes} exceeds limit ${LIMITS.maxTotalCatalogBytes}`);
    if (!gates.descriptionCharsWithinLimit) console.error(`  - Description characters ${candidateMetrics.descriptionChars} exceeds limit ${LIMITS.maxDescriptionChars}`);
    if (!gates.exactToolsMatch) {
      if (gates.missingExpected.length) console.error(`  - Missing expected tools: ${gates.missingExpected.join(", ")}`);
      if (gates.unexpected.length) console.error(`  - Unexpected tools: ${gates.unexpected.join(", ")}`);
    }
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
