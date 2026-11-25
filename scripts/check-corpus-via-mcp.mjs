#!/usr/bin/env node
/**
 * Live corpus check through the spec registry (consumer view).
 *
 * The canonical corpus is not present on this code branch (it lives on the
 * orphan `spec-<slug>` branches) and no consumer gets git access to those
 * branches — the service is the only writer and the only reader path. This gate therefore asks the service what it serves and
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

import {
  STORAGE_RULE_DOC,
  STORAGE_RULE_SPEC,
  findUnmarkedStorageMentions,
  hasCanonicalStorageRule,
} from "./lib/storage-rule.mjs";

const EXPECTED_SPECS = Object.freeze([
  "agent-ux-elicitation-guard",
  "blast-radius-auto-generation",
  "plugin-distribution",
  "project-glossary",
  "roadmap-3-4-0",
  "roadmap-living-spec-corpus",
  "roadmap-roadmaps",
  "spec-decision-drift",
  "spec-local-corpus-mode",
  "spec-mcp-access-gate",
  "spec-mcp-operations",
  "spec-patch-bundle",
  "spec-project-registration",
  "spec-readiness-gate",
  "spec-registry-service",
  "spec-verify-runner",
  "task-comments-structured",
  "teams-task-sync",
  "youtrack-spec-delivery",
  "youtrack-visualization",
]);
const EXPECTED_DOCUMENT_COUNT = 296;

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
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    fail(`registry unreachable at ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
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

// The storage rule is checked through the same MCP surface an agent reads.
// It is one rule in one place; every spec is scanned, not just the one that
// owns the rule, because the rule is corpus-wide.
const ruleDoc = await call(bearer, "spec_documents", {
  action: "read",
  spec: STORAGE_RULE_SPEC,
  doc: STORAGE_RULE_DOC,
});
if (!hasCanonicalStorageRule(ruleDoc.data?.content)) {
  fail(`${STORAGE_RULE_SPEC}/${STORAGE_RULE_DOC} no longer carries the canonical storage rule`);
}

const documents = [];
for (const spec of served) {
  const list = await call(bearer, "spec_documents", { action: "list", spec });
  for (const doc of list.data?.docs ?? []) {
    const body = await call(bearer, "spec_documents", { action: "read", spec, doc });
    documents.push({ spec, doc, content: body.data?.content ?? "" });
  }
}
const unmarked = findUnmarkedStorageMentions(documents);
if (unmarked.length > 0) {
  const first = unmarked[0];
  fail(`${first.spec}/${first.doc}:${first.line} names the retired shared specs repo without an explicit historical marker (${unmarked.length} total)`);
}

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
