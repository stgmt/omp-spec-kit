#!/usr/bin/env node
/**
 * Real-server JSON-RPC E2E for the whole hosted tool surface.
 *
 * Every tool is called through `POST /mcp` with a valid payload; read-only
 * tools must return `ok: true`, the patch tool runs as a dry-run preview, and
 * the claim/branch tools clean up after themselves. No kernel import, no direct
 * service call: this is the same path a remote agent uses.
 *
 * CLI configuration:
 *   OMP_SPEC_REGISTRY_URL          endpoint (default http://127.0.0.1:8642/mcp)
 *   OMP_SPEC_REGISTRY_TOKEN        bearer token
 *   OMP_SPEC_REGISTRY_TOKEN_FILE   file holding the token
 *   OMP_SPEC_PROJECT               project scope for preflight (optional)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function fail(message) {
  throw new Error(message);
}

export async function runToolE2e({ url, token, project = "stgmt/omp-spec-kit" }) {
  if (typeof url !== "string" || url.length === 0) fail("tool-e2e needs an endpoint URL");
  if (typeof token !== "string" || token.length === 0) fail("tool-e2e needs a bearer token");
  let nextId = 0;

  async function rpc(method, params) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method, params }),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await response.text();
    if (!response.ok) fail(`${method} -> HTTP ${response.status}: ${text.slice(0, 300)}`);
    let payload = text;
    if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
      const line = text.split("\n").find((entry) => entry.startsWith("data:"));
      payload = line ? line.slice(5).trim() : text;
    }
    const frame = JSON.parse(payload);
    if (frame.error) fail(`${method} JSON-RPC error: ${JSON.stringify(frame.error).slice(0, 300)}`);
    return frame.result;
  }

  async function call(name, args) {
    const result = await rpc("tools/call", { name, arguments: args });
    if (!result?.structuredContent) fail(`${name} returned no structured envelope`);
    return result.structuredContent;
  }

  function expectOk(name, envelope, { allowOutcome = null } = {}) {
    if (allowOutcome !== null) {
      if (envelope.data?.outcome !== allowOutcome) fail(`${name} expected ${allowOutcome}, got ${envelope.data?.outcome ?? envelope.error?.code}: ${envelope.error?.message ?? ""}`);
      return;
    }
    if (envelope.ok !== true) fail(`${name} refused: ${envelope.error?.code ?? "unknown"} ${envelope.error?.message ?? ""}`);
  }

  const listed = await rpc("tools/list", {});
  const tools = listed.tools.map((tool) => tool.name);
  const required = [
    "mcp_preflight", "spec_catalog", "spec_entities", "spec_graph", "spec_documents",
    "spec_inspect", "spec_tasks", "spec_evidence", "spec_markdown", "spec_patch",
    "spec_registry", "spec_drift", "spec_claim", "spec_release", "spec_branch",
  ];
  const missing = required.filter((tool) => !tools.includes(tool));
  if (missing.length > 0) fail(`tools/list is missing: ${missing.join(", ")}`);

  const catalog = await call("spec_catalog", { view: "specs" });
  expectOk("spec_catalog", catalog);
  const slug = catalog.data?.specs?.[0];
  if (typeof slug !== "string") fail("catalog returned no specs");

  const checks = [];
  checks.push(["mcp_preflight", await call("mcp_preflight", { project })]);
  checks.push(["spec_catalog", catalog]);
  checks.push(["spec_entities", await call("spec_entities", { mode: "find", specSlugs: [slug], kinds: ["FUNCTIONAL_REQUIREMENT"], limit: 1 })]);
  checks.push(["spec_graph", await call("spec_graph", { view: "board", specSlugs: [slug] })]);
  checks.push(["spec_documents", await call("spec_documents", { action: "read", spec: slug, doc: "README.md" })]);
  checks.push(["spec_inspect", await call("spec_inspect", { check: "validation" })]);
  checks.push(["spec_tasks", await call("spec_tasks", { spec: slug })]);
  checks.push(["spec_markdown", await call("spec_markdown", { specSlugs: [slug] })]);
  checks.push(["spec_registry", await call("spec_registry", {})]);
  checks.push(["spec_drift", await call("spec_drift", {})]);

  const scenarios = await call("spec_entities", { mode: "find", specSlugs: [slug], kinds: ["SCENARIO"], limit: 1 });
  expectOk("spec_entities (scenario)", scenarios);
  const scenarioId = scenarios.data?.nodes?.[0]?.canonicalId ?? scenarios.data?.entities?.[0]?.canonicalId ?? scenarios.data?.items?.[0]?.canonicalId ?? null;
  let evidenceMode = "scenario";
  if (scenarioId !== null) {
    checks.push(["spec_evidence", await call("spec_evidence", { view: "trace", scenarioId, spec: slug })]);
  } else {
    // The hosted corpus may carry no executable scenarios. The tool path is
    // still real: a missing scenario must produce a typed refusal, never an
    // internal error.
    const missingScenario = await call("spec_evidence", { view: "trace", scenarioId: `${slug}:SCENARIO-MISSING`, spec: slug });
    if (missingScenario.ok !== false || typeof missingScenario.error?.code !== "string") {
      fail(`spec_evidence returned neither a scenario nor a typed refusal: ${JSON.stringify(missingScenario).slice(0, 300)}`);
    }
    evidenceMode = `typed-error:${missingScenario.error.code}`;
  }

  const readme = await call("spec_documents", { action: "read", spec: slug, doc: "README.md" });
  expectOk("spec_documents (patch source)", readme);
  const patch = await call("spec_patch", {
    intent: "patch",
    spec: slug,
    dryRun: true,
    reason: "tool-e2e preview",
    requestId: `tool-e2e-patch-${Date.now()}`,
    operations: [{ kind: "replace_document", document: "README.md", content: `${readme.data.content}\n<!-- tool-e2e -->\n` }],
  });
  expectOk("spec_patch", patch, { allowOutcome: "PREVIEW" });

  checks.push(["spec_claim", await call("spec_claim", { spec: slug, ttlMinutes: 2, requestId: `tool-e2e-claim-${Date.now()}` })]);
  checks.push(["spec_release", await call("spec_release", { spec: slug, requestId: `tool-e2e-release-${Date.now()}` })]);

  const topic = `tool-e2e-${Date.now()}`;
  const created = await call("spec_branch", { action: "create", spec: slug, topic, requestId: `tool-e2e-branch-create-${Date.now()}` });
  expectOk("spec_branch create", created);
  const deleted = await call("spec_branch", { action: "delete", spec: slug, topic, requestId: `tool-e2e-branch-delete-${Date.now()}` });
  expectOk("spec_branch delete", deleted);

  for (const [name, envelope] of checks) expectOk(name, envelope);

  return {
    schema: "omp-spec-kit-tool-e2e@1",
    endpoint: url,
    tools: tools.length,
    checked: [...checks.map(([name]) => name), "spec_patch", "spec_branch"],
    complete: scenarioId !== null,
    evidence: evidenceMode,
    specs: catalog.data.specs.length,
    status: scenarioId === null ? "passed-with-typed-evidence" : "passed",
  };
}

async function main() {
  const url = process.env.OMP_SPEC_REGISTRY_URL ?? "http://127.0.0.1:8642/mcp";
  const project = process.env.OMP_SPEC_PROJECT ?? "stgmt/omp-spec-kit";
  let bearer = process.env.OMP_SPEC_REGISTRY_TOKEN;
  if (typeof bearer !== "string" || bearer.trim() === "") {
    const fromFile = process.env.OMP_SPEC_REGISTRY_TOKEN_FILE;
    if (typeof fromFile === "string" && fromFile.trim() !== "") {
      bearer = (await readFile(fromFile.trim(), "utf8")).trim();
    }
  }
  if (typeof bearer !== "string" || bearer.trim() === "") {
    fail("set OMP_SPEC_REGISTRY_TOKEN or OMP_SPEC_REGISTRY_TOKEN_FILE");
  }
  const result = await runToolE2e({ url, token: bearer.trim(), project });
  console.log(JSON.stringify(result, null, 2));
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`tool-e2e: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
