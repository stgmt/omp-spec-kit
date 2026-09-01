#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toolContractsForStage } from "../src/adapters/tool-contracts.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stage = process.env.OMP_SPEC_KIT_STAGE;
if (stage !== "v0.4.0") throw new Error("dogfood requires OMP_SPEC_KIT_STAGE=v0.4.0");
const contracts = toolContractsForStage(stage);
const serverPath = path.join(repositoryRoot, "src", "mcp", "server.js");

function valueForField(entry, index) {
  if (entry.kind === "string") {
    if (entry.name === "canonicalId") return "plugin-distribution:FR-1";
    if (entry.name === "spec" || entry.name === "specSlug") return "plugin-distribution";
    if (entry.name === "path") return "FR.md";
    if (entry.name === "anchor") return "plugin-distribution:FR-1";
    if (entry.name === "scenarioId") return "SCEN-mri-active-project-root";
    if (entry.name === "requestId") return `dogfood-${index}`;
    if (entry.name === "proposalId") return "dogfood-proposal";
    if (entry.name === "proposalSha256") return "0".repeat(64);
    if (entry.name === "repositoryRootFingerprint") return "0".repeat(64);
    if (entry.name === "reason") return "dogfood runtime probe";
    if (entry.name === "requirement") return "FR-1";
    if (entry.name === "entity") return "TASK-1";
    if (entry.name === "heading") return "Functional Requirements";
    if (entry.name === "oldText") return "missing text";
    if (entry.name === "newText") return "replacement text";
    if (entry.name === "text" || entry.name === "body" || entry.name === "criterion" || entry.name === "title" || entry.name === "summary") return "dogfood";
    if (entry.name === "newDoc") return "FR.md";
    return "plugin-distribution";
  }
  if (entry.kind === "boolean") return entry.name === "includeHeadings" || entry.name === "includeLinks";
  if (entry.kind === "integer") return entry.name === "maxDepth" ? 1 : 10;
  if (entry.kind === "nullableString") return null;
  if (entry.kind === "enum") return entry.name === "direction" ? "both" : entry.values[0];
  if (entry.kind === "enumArray") return entry.name === "statuses" ? ["todo"] : [];
  if (entry.kind === "stringArray") return entry.name === "tags" ? ["@feature1"] : [];
  if (entry.kind === "json") {
    if (entry.name === "operations") return [];
    if (entry.name === "expectedDocuments") return [];
    if (entry.name === "requirements") return [];
    return {};
  }
  throw new Error(`dogfood: unsupported field kind ${entry.kind}`);
}

function argumentsFor(contract, index) {
  const args = { schemaVersion: "spec-kernel@1", requestId: `dogfood-${index}` };
  for (const field of contract.fields) args[field.name] = valueForField(field, index);
  if (contract.tool === "read_spec_doc") {
    args.spec = "product";
    args.doc = "FR.md";
    args.section = null;
    args.offset = 1;
    args.limit = 10;
    args.readForEdit = false;
  }
  return args;
}

function callMessages() {
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ];
  contracts.forEach((contract, index) => {
    messages.push({ jsonrpc: "2.0", id: index + 3, method: "tools/call", params: { name: contract.tool, arguments: argumentsFor(contract, index) } });
  });
  return messages;
}

const child = spawnSync(process.execPath, [serverPath], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    OMP_SPEC_KIT_ROOT: repositoryRoot,
    OMP_SPEC_KIT_STAGE: stage,
    ...(stage.toLowerCase().startsWith("authoring") || ["v0.6.0", "v0.7.0", "plan-gate"].includes(stage.toLowerCase()) ? { OMP_SPEC_KIT_INTERNAL_DOGFOOD: "1" } : {}),
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
  stage,
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
