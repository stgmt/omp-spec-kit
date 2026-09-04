#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  annotationsFor,
  KERNEL_ENVELOPE_OUTPUT_SCHEMA,
  MCP_SERVER_INSTRUCTIONS,
  TOOL_CONTRACTS,
} from "../src/adapters/tool-contracts.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contracts = TOOL_CONTRACTS;
const serverPath = path.join(repositoryRoot, "src", "mcp", "server.js");

function argumentsFor(contract, index) {
  const reqId = `dogfood-${index}`;
  switch (contract.tool) {
    case "mcp_preflight":
      return {};
    case "spec_catalog":
      return { view: "specs" };
    case "spec_entities":
      return { mode: "find", kinds: ["FUNCTIONAL_REQUIREMENT"] };
    case "spec_graph":
      return { view: "edges", canonicalId: "plugin-distribution:FR-1" };
    case "spec_documents":
      return { action: "list", spec: "plugin-distribution" };
    case "spec_inspect":
      return { check: "orphans" };
    case "spec_tasks":
      return { spec: "plugin-distribution" };
    case "spec_evidence":
      return { view: "result", scenarioId: "SCEN-mri-active-project-root" };
    case "spec_markdown":
      return { specSlugs: ["plugin-distribution"] };
    case "spec_patch":
      return {
        intent: "amendRequirement",
        spec: "plugin-distribution",
        requirement: "FR-1",
        body: "dogfood probe note",
        reason: "dogfood probe reason",
        requestId: reqId,
        dryRun: true,
      };
    default:
      return {};
  }
}

function callMessages() {
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ];
  contracts.forEach((contract, index) => {
    messages.push({
      jsonrpc: "2.0",
      id: index + 3,
      method: "tools/call",
      params: { name: contract.tool, arguments: argumentsFor(contract, index) },
    });
  });
  return messages;
}

const child = spawnSync(process.execPath, [serverPath], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    OMP_SPEC_KIT_ROOT: repositoryRoot,
  },
  input: `${callMessages().map((message) => JSON.stringify(message)).join("\n")}\n`,
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 32 * 1024 * 1024,
});

if (child.error) throw child.error;
if (child.status !== 0) throw new Error(`dogfood: server exited ${child.status}: ${child.stderr}`);

const responses = child.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
const listResponse = responses.find((response) => response.id === 2);
const initialized = responses.find((response) => response.id === 1);

if (initialized?.result?.instructions !== MCP_SERVER_INSTRUCTIONS) {
  throw new Error("dogfood: initialize instructions mismatch");
}

const listedTools = listResponse?.result?.tools ?? [];
if (JSON.stringify(listedTools[0]?.outputSchema) !== JSON.stringify(KERNEL_ENVELOPE_OUTPUT_SCHEMA)) {
  throw new Error("dogfood: output schema mismatch");
}

for (const contract of contracts) {
  const tool = listedTools.find((candidate) => candidate.name === contract.tool);
  if (!tool) throw new Error("dogfood: missing tool " + contract.tool);
  if (tool.title !== contract.label) throw new Error("dogfood: title mismatch for " + contract.tool);
  if (tool.description.split(/\r?\n/u, 1)[0].trim().length > 200) {
    throw new Error("dogfood: description cap exceeded for " + contract.tool);
  }
  if (JSON.stringify(tool.annotations) !== JSON.stringify(annotationsFor(contract))) {
    throw new Error("dogfood: annotations mismatch for " + contract.tool);
  }
}

const names = listResponse?.result?.tools?.map((tool) => tool.name) ?? [];
const expectedNames = contracts.map((contract) => contract.tool);
if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
  throw new Error(`dogfood: registry mismatch; expected ${expectedNames.join(",")}, got ${names.join(",")}`);
}

const rows = contracts.map((contract, index) => {
  const response = responses.find((candidate) => candidate.id === index + 3);
  const result = response?.result;
  const structured = result?.structuredContent;
  const hasBoundedResult = structured !== undefined && structured !== null;
  if (JSON.stringify(JSON.parse(result?.content?.[0]?.text ?? "null")) !== JSON.stringify(structured)) {
    throw new Error("dogfood: text mirror mismatch for " + contract.tool);
  }
  const errorCode = structured?.error?.code ?? null;
  if (!result || !Array.isArray(result.content) || result.content.length !== 1 || !hasBoundedResult) {
    throw new Error(`dogfood: ${contract.tool} returned no bounded result: ${JSON.stringify(response)}`);
  }
  return {
    name: contract.tool,
    ok: structured.ok === true,
    isError: result.isError === true,
    errorCode,
    contentBytes: Buffer.byteLength(result.content[0].text ?? "", "utf8"),
    structuredBytes: Buffer.byteLength(JSON.stringify(structured), "utf8"),
  };
});

const report = {
  schema: "omp-spec-kit-mcp-runtime-census@1",
  stage: "single-surface",
  root: repositoryRoot,
  registryCount: names.length,
  rows,
  status: "passed",
};

const output = process.env.OMP_SPEC_KIT_DOGFOOD_OUTPUT;
if (output) {
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(report));
