#!/usr/bin/env node
/**
 * Live corpus check through the spec registry (consumer view).
 *
 * The canonical corpus is not present in this repository and no consumer gets
 * git access to the specs repository — the service is the only writer and the
 * only reader path. This gate therefore asks the service what it serves and
 * asserts the invariants a consumer depends on: the expected specification set,
 * the expected document count, a valid graph, and zero error diagnostics.
 *
 * Configuration:
 *   OMP_SPEC_REGISTRY_URL          endpoint (default http://127.0.0.1:8642/mcp)
 *   OMP_SPEC_REGISTRY_TOKEN        bearer token (a verified YouTrack token)
 *   OMP_SPEC_REGISTRY_TOKEN_FILE   file holding the token (used when the
 *                                  environment variable is absent)
 */
import { readFile } from "node:fs/promises";

const EXPECTED_SPECS = Object.freeze([
  "agent-ux-elicitation-guard",
  "plugin-distribution",
  "roadmap-roadmaps",
  "spec-mcp-access-gate",
  "spec-mcp-operations",
  "spec-registry-service",
  "youtrack-visualization",
]);
const EXPECTED_DOCUMENT_COUNT = 106;

const url = process.env.OMP_SPEC_REGISTRY_URL ?? "http://127.0.0.1:8642/mcp";

function fail(message) {
  console.error(`corpus check (registry): ${message}`);
  process.exit(1);
}

async function token() {
  const fromEnv = process.env.OMP_SPEC_REGISTRY_TOKEN;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return fromEnv.trim();
  const fromFile = process.env.OMP_SPEC_REGISTRY_TOKEN_FILE;
  if (typeof fromFile === "string" && fromFile.trim().length > 0) {
    return (await readFile(fromFile.trim(), "utf8")).trim();
  }
  fail("set OMP_SPEC_REGISTRY_TOKEN or OMP_SPEC_REGISTRY_TOKEN_FILE to a verified YouTrack token");
}

async function call(bearer, name, args) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  if (!response.ok) fail(`${name} -> HTTP ${response.status}: ${text.slice(0, 200)}`);
  let payload = text;
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const line = text.split("\n").find((entry) => entry.startsWith("data:"));
    payload = line ? line.slice(5).trim() : text;
  }
  const envelope = JSON.parse(payload)?.result?.structuredContent;
  if (!envelope) fail(`${name} returned no structured envelope`);
  if (envelope.ok !== true) fail(`${name} refused: ${envelope.error?.code ?? "unknown"} ${envelope.error?.message ?? ""}`);
  return envelope;
}

const bearer = await token();

const catalog = await call(bearer, "spec_catalog", { view: "specs" });
const served = [...(catalog.data?.specs ?? [])].sort((a, b) => a.localeCompare(b));
if (JSON.stringify(served) !== JSON.stringify([...EXPECTED_SPECS].sort((a, b) => a.localeCompare(b)))) {
  fail(`spec set differs (actual: ${served.join(", ") || "<empty>"})`);
}
if (catalog.graph?.valid !== true) fail("the served graph is not valid");

const overview = await call(bearer, "spec_catalog", { view: "overview" });
const counts = overview.data?.counts ?? {};
if (counts.discoveredDocuments !== EXPECTED_DOCUMENT_COUNT) {
  fail(`discovered documents is ${counts.discoveredDocuments}, expected ${EXPECTED_DOCUMENT_COUNT}`);
}
if (counts.acceptedDocuments !== EXPECTED_DOCUMENT_COUNT) {
  fail(`accepted documents is ${counts.acceptedDocuments}, expected ${EXPECTED_DOCUMENT_COUNT}`);
}
if (counts.diagnosticsError !== 0) fail(`the served corpus reports ${counts.diagnosticsError} error diagnostic(s)`);

console.log(
  JSON.stringify(
    {
      schema: "omp-spec-kit-registry-corpus-check@1",
      endpoint: url,
      status: "passed",
      specs: served.length,
      documents: counts.discoveredDocuments,
      graphFingerprint: catalog.graph?.fingerprint ?? null,
      warnings: counts.diagnosticsWarning ?? 0,
    },
    null,
    2,
  ),
);
