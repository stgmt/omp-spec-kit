import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EXTENSION_LABEL,
  EXTENSION_SCHEMA_VERSION,
  MCP_TOOL_NAMES,
  PLUGIN_VERSION,
  QUERY_ENVELOPE_KEYS,
  createMcpState,
  loadPinnedCorpusGraph,
  writeCorpus,
  runExtensionProbe,
  spawnMcpServer,
} from "../helpers/mcp-world.mjs";
import { KERNEL_SCHEMA_VERSION, query } from "../helpers/kernel-world.mjs";
import { snapshotTree } from "../support/world.mjs";

const SERVER_SEGMENTS = Object.freeze(["plugins", "omp-spec-kit", "dist", "mcp", "server.js"]);
const EXTENSION_SEGMENTS = Object.freeze(["plugins", "omp-spec-kit", "dist", "extension.js"]);
const INITIALIZE_PARAMS = Object.freeze({
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "bdd-mcp-client", version: "0.0.0" },
});
const GET_NODE_ARGS = Object.freeze({
  canonicalId: "plugin-distribution:FR-1",
  projection: "full",
  includeIncidentCounts: true,
});
const TRACE_ARGS = Object.freeze({
  canonicalId: "plugin-distribution:FR-1",
  direction: "out",
  types: [],
  maxDepth: 8,
  maxVisited: 100,
  projection: "summary",
  limit: 50,
  cursor: null,
});

const PROVENANCE_CALLS = Object.freeze([
  ["spec_inventory", { specSlugs: [], includeDocuments: false, limit: 10, cursor: null }],
  ["spec_get_node", { canonicalId: "plugin-distribution:FR-1", projection: "summary", includeIncidentCounts: true }],
  ["spec_find_nodes", {
    specSlugs: [],
    kinds: [],
    canonicalIds: [],
    text: null,
    projection: "summary",
    limit: 10,
    cursor: null,
  }],
  ["spec_get_edges", {
    canonicalId: "plugin-distribution:FR-1",
    direction: "out",
    types: [],
    aggregate: false,
    limit: 10,
    cursor: null,
  }],
  ["spec_trace", { ...TRACE_ARGS, limit: 10 }],
  ["spec_diagnostics", {
    severities: [],
    codes: [],
    specSlugs: [],
    paths: [],
    limit: 10,
    cursor: null,
  }],
  ["spec_overview", { specSlugs: [] }],
  ["spec_markdown_inventory", {
    specSlugs: [],
    mode: "all",
    focusPath: null,
    focusAnchor: null,
    direction: "both",
    outcomes: [],
    includeHeadings: true,
    includeLinks: true,
    limit: 10,
    cursor: null,
  }],
]);

const SORTED_TOOL_NAMES = Object.freeze([...MCP_TOOL_NAMES].sort());

Before({ tags: "@spec-mcp" }, function () {
  this.mcp = createMcpState();
  this.mcp.repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
});

After({ tags: "@spec-mcp" }, async function () {
  // Unconditional: the spawned server is closed (SIGKILL fallback) and the
  // temporary repository removed even when a scenario step already failed.
  await this.mcp.cleanup();
});

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

Given("the repository's real corpus pinned by the fixture manifest with an identical in-process kernel graph", async function () {
  const { manifest, graph, files } = await loadPinnedCorpusGraph(this.mcp.repositoryRoot);
  this.mcp.manifest = manifest;
  this.mcp.graph = graph;
  this.mcp.files = files;
});

// ---------------------------------------------------------------------------
// Scenario: MCP parity
// ---------------------------------------------------------------------------

// The server is rooted at a BYTE-EXACT replica of only the manifest-pinned
// documents: owner-added untracked spec directories on disk (outside the
// captured fixture) must not change the served graph fingerprint, and the
// parity oracle must compare against the identical corpus.
Given("a spawned stdio MCP server rooted at a byte-exact replica of the pinned corpus", async function () {
  this.mcp.specsBefore = await snapshotTree(path.join(this.mcp.repositoryRoot, ".specs"));
  this.mcp.tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-mcp-replica-"));
  await writeCorpus(this.mcp.tempRoot, this.mcp.files);
  const replicaSnapshot = await snapshotTree(this.mcp.tempRoot);
  assert.equal(
    replicaSnapshot.entries.filter((entry) => entry.type === "file").length,
    this.mcp.files.length,
    "the pinned replica must contain exactly the pinned documents",
  );
  this.mcp.server = spawnMcpServer({
    serverPath: path.join(this.mcp.repositoryRoot, ...SERVER_SEGMENTS),
    root: this.mcp.tempRoot,
    cwd: this.mcp.tempRoot,
  });
});

When("the client initializes the session and requests the tool list", async function () {
  const initializeMessage = await this.mcp.server.request("initialize", INITIALIZE_PARAMS);
  // Notification: the server must never answer it; the following request with
  // a fresh id implicitly proves the stream stayed correlated.
  this.mcp.server.notify("notifications/initialized");
  const toolListMessage = await this.mcp.server.request("tools/list", {});
  this.mcp.initializeResult = initializeMessage.result;
  this.mcp.toolList = toolListMessage.result;
});

Then("initialize answers with exactly the omp-spec-kit identity", function () {
  assert.deepStrictEqual(this.mcp.initializeResult, {
    protocolVersion: INITIALIZE_PARAMS.protocolVersion,
    capabilities: { tools: {} },
    serverInfo: { name: "omp-spec-kit", version: KERNEL_SCHEMA_VERSION },
  });
});

Then("the tool list is exactly the eight SCHEMA-11 read-only tools", function () {
  const tools = this.mcp.toolList.tools;
  assert.equal(tools.length, MCP_TOOL_NAMES.length, `expected ${MCP_TOOL_NAMES.length} tools`);
  assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length, "tool names must be unique");
  assert.deepStrictEqual(tools.map((tool) => tool.name).sort(), SORTED_TOOL_NAMES);
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must declare readOnlyHint`);
    assert.equal(typeof tool.description, "string");
    assert.ok(tool.description.length > 0, `${tool.name} must describe itself`);
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} args must be closed`);
  }
});

When('the client calls "spec_get_node" on "plugin-distribution:FR-1"', async function () {
  this.mcp.lastArgs = GET_NODE_ARGS;
  this.mcp.lastToolCall = await this.mcp.server.request("tools/call", {
    name: "spec_get_node",
    arguments: { ...GET_NODE_ARGS, requestId: "bdd-mcp-get-node" },
  });
});

When('the client calls "spec_trace" from "plugin-distribution:FR-1" direction "out"', async function () {
  this.mcp.lastArgs = TRACE_ARGS;
  this.mcp.lastToolCall = await this.mcp.server.request("tools/call", {
    name: "spec_trace",
    arguments: { ...TRACE_ARGS, requestId: "bdd-mcp-trace-out" },
  });
});

Then("the answer carries one canonical QueryEnvelope whose data deep-equals the direct kernel {string} answer", function (operation) {
  const message = this.mcp.lastToolCall;
  assert.equal(message.error, undefined, `tools/call ${operation} must not be a JSON-RPC error`);
  const result = message.result;
  assert.equal(result.isError, false);
  // Exactly one QueryEnvelope as structured content beside one text summary.
  assert.deepEqual(Object.keys(result.structuredContent).sort(), [...QUERY_ENVELOPE_KEYS]);
  const envelope = result.structuredContent;
  assert.equal(envelope.schemaVersion, KERNEL_SCHEMA_VERSION);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.operation, operation);
  assert.equal(envelope.error, null);
  assert.ok(Array.isArray(envelope.diagnostics));
  assert.equal(envelope.graph.fingerprint, this.mcp.graph.fingerprint, "the served graph must be the pinned corpus graph");
  // Parity oracle: the same operation against the in-process kernel graph
  // built from the SAME pinned files must produce byte-identical data.
  const expected = query(this.mcp.graph, operation, this.mcp.lastArgs);
  assert.deepEqual(envelope.data, expected.data);
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
});

Then("the repository's pinned .specs tree is byte-for-byte unchanged", async function () {
  assert.deepStrictEqual(
    await snapshotTree(path.join(this.mcp.repositoryRoot, ".specs")),
    this.mcp.specsBefore,
    "the read-only server must never mutate the real .specs tree",
  );
});

// ---------------------------------------------------------------------------
// Scenario: extension registry cardinality
// ---------------------------------------------------------------------------

Given("the built OMP extension entrypoint path", function () {
  this.mcp.extensionPath = path.join(this.mcp.repositoryRoot, ...EXTENSION_SEGMENTS);
});

When("a fresh probe process registers the extension through a mock pi host from a foreign working directory", async function () {
  this.mcp.tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-mcp-probe-cwd-"));
  this.mcp.probe = await runExtensionProbe({
    extensionPath: this.mcp.extensionPath,
    cwd: this.mcp.tempRoot,
  });
});

Then("exactly eight tools were registered under the SCHEMA-11 names", function () {
  const probe = this.mcp.probe;
  assert.notEqual(
    path.resolve(probe.processCwd),
    path.resolve(this.mcp.repositoryRoot),
    "the probe must have run from a foreign working directory",
  );
  assert.deepStrictEqual(probe.exports, {
    pluginVersion: PLUGIN_VERSION,
    schemaVersion: EXTENSION_SCHEMA_VERSION,
    defaultType: "function",
  });
  assert.deepStrictEqual(probe.labels, [EXTENSION_LABEL]);
  assert.equal(probe.tools.length, MCP_TOOL_NAMES.length, "the registry holds exactly eight tools");
  assert.equal(new Set(probe.tools.map((tool) => tool.name)).size, probe.tools.length, "registered names are unique");
  assert.deepStrictEqual(probe.tools.map((tool) => tool.name).sort(), SORTED_TOOL_NAMES);
});

Then("every registered tool is strict, executable, and approved for reading", function () {
  for (const tool of this.mcp.probe.tools) {
    assert.equal(tool.approval, "read", `${tool.name} must be approval:"read"`);
    assert.equal(tool.strict, true, `${tool.name} must be strict`);
    assert.equal(tool.executeType, "function", `${tool.name} must be executable`);
    assert.equal(typeof tool.label, "string");
    assert.equal(tool.parameters.kind, "object");
    assert.equal(tool.parameters.strict, true, `${tool.name} parameters must reject unknown fields`);
    assert.ok(Object.keys(tool.parameters.shape).length >= 1, `${tool.name} must declare its closed arg shape`);
  }
});

// ---------------------------------------------------------------------------
// Scenario Outline: fail-closed refusals
// ---------------------------------------------------------------------------

When("the client sends the {string} request", async function (testCase) {
  const server = this.mcp.server;
  switch (testCase) {
    case "unknown-tool":
      this.mcp.failure = await server.request("tools/call", {
        name: "spec_delete_corpus",
        arguments: {},
      });
      break;
    case "bad-schema-version":
      this.mcp.failure = await server.request("tools/call", {
        name: "spec_overview",
        arguments: { specSlugs: [], schemaVersion: "9", requestId: "bdd-bad-schema-version" },
      });
      break;
    case "unknown-field":
      this.mcp.failure = await server.request("tools/call", {
        name: "spec_get_node",
        arguments: { ...GET_NODE_ARGS, bogusField: true },
      });
      break;
    default:
      throw new Error(`unknown fail-closed case "${testCase}"`);
  }
});

Then("the refusal is exactly {string}", function (expected) {
  switch (expected) {
    case "JSON-RPC error -32602": {
      const message = this.mcp.failure;
      assert.ok(message.error !== undefined, "an unknown tool must be refused as a JSON-RPC error");
      assert.equal(message.result, undefined);
      assert.equal(message.error.code, -32602);
      assert.match(message.error.message, /spec_delete_corpus/);
      break;
    }
    case "envelope error UNSUPPORTED_SCHEMA_VERSION": {
      const result = this.mcp.failure.result;
      assert.equal(this.mcp.failure.error, undefined);
      assert.equal(result.isError, true);
      const envelope = result.structuredContent;
      assert.equal(envelope.ok, false);
      assert.equal(envelope.data, null);
      assert.equal(envelope.error.code, "UNSUPPORTED_SCHEMA_VERSION");
      assert.equal(envelope.error.parameter, "schemaVersion");
      break;
    }
    case "envelope error UNKNOWN_FIELD": {
      const result = this.mcp.failure.result;
      assert.equal(this.mcp.failure.error, undefined);
      assert.equal(result.isError, true);
      const envelope = result.structuredContent;
      assert.equal(envelope.ok, false);
      assert.equal(envelope.data, null);
      assert.equal(envelope.error.code, "UNKNOWN_FIELD");
      assert.equal(envelope.error.parameter, "bogusField");
      break;
    }
    default:
      throw new Error(`unknown refusal expectation "${expected}"`);
  }
});

// ---------------------------------------------------------------------------
// Scenario: dependency-absent bare corpus
// ---------------------------------------------------------------------------

Given("a temporary repository holding only a copied product specification and no node_modules ancestry", async function () {
  this.mcp.tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-mcp-bare-"));
  await cp(
    path.join(this.mcp.repositoryRoot, ".specs", "product"),
    path.join(this.mcp.tempRoot, ".specs", "product"),

    { recursive: true },
  );
  this.mcp.bareSnapshot = await snapshotTree(this.mcp.tempRoot);
  const strayNodeModules = this.mcp.bareSnapshot.entries.filter(
    (entry) => entry.path === "node_modules" || entry.path.includes("node_modules"),
  );
  assert.deepStrictEqual(strayNodeModules, [], "the bare corpus fixture must contain no node_modules ancestry");
});

When("a spawned stdio MCP server rooted there initializes and reads the overview", async function () {
  this.mcp.server = spawnMcpServer({
    serverPath: path.join(this.mcp.repositoryRoot, ...SERVER_SEGMENTS),
    root: this.mcp.tempRoot,
    cwd: this.mcp.tempRoot,
  });
  this.mcp.initializeResult = (await this.mcp.server.request("initialize", INITIALIZE_PARAMS)).result;
  this.mcp.overviewResponse = await this.mcp.server.request("tools/call", {
    name: "spec_overview",
    arguments: { specSlugs: ["product"], requestId: "bdd-dependency-absent-overview" },
  });
});

Then("the overview succeeds over exactly the copied product documents", function () {
  assert.deepStrictEqual(this.mcp.initializeResult.serverInfo, {
    name: "omp-spec-kit",
    version: KERNEL_SCHEMA_VERSION,
  });
  const message = this.mcp.overviewResponse;
  assert.equal(message.error, undefined, "spec_overview must not be refused on the bare corpus");
  const result = message.result;
  assert.equal(result.isError, false);
  const envelope = result.structuredContent;
  assert.equal(envelope.ok, true);
  assert.equal(envelope.operation, "overview");
  assert.equal(envelope.requestId, "bdd-dependency-absent-overview");
  assert.equal(envelope.data.kind, "overview");
  // Ground truth derived from the fixture itself: every copied file is one
  // accepted document of the single-spec corpus.
  const copiedFileCount = this.mcp.bareSnapshot.entries.filter((entry) => entry.type === "file").length;
  assert.ok(copiedFileCount > 0, "the bare corpus fixture must contain documents");
  assert.equal(envelope.data.counts.acceptedDocuments, copiedFileCount);
  assert.equal(envelope.data.counts.rejectedDocuments, 0);
  const frCount = envelope.data.nodeKinds.find((entry) => entry.kind === "FUNCTIONAL_REQUIREMENT");
  assert.ok(frCount !== undefined && frCount.count > 0, "the product spec copy must expose functional requirements");
});
// ---------------------------------------------------------------------------
// Scenario: response provenance
// ---------------------------------------------------------------------------

Given("two byte-exact temporary project replicas for provenance checks", async function () {
  this.mcp.tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-mcp-provenance-active-"));
  this.mcp.provenanceOverrideRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-mcp-provenance-override-"));
  await writeCorpus(this.mcp.tempRoot, this.mcp.files);
  await writeCorpus(this.mcp.provenanceOverrideRoot, this.mcp.files);
  const activeSnapshot = await snapshotTree(this.mcp.tempRoot);
  const overrideSnapshot = await snapshotTree(this.mcp.provenanceOverrideRoot);
  assert.deepStrictEqual(
    activeSnapshot,
    overrideSnapshot,
    "provenance replicas must have identical corpus bytes before root selection is tested",
  );
});

When("the real MCP server probes every tool with project-b as an explicit override while cwd is project-a", async function () {
  this.mcp.server = spawnMcpServer({
    serverPath: path.join(this.mcp.repositoryRoot, ...SERVER_SEGMENTS),
    root: this.mcp.provenanceOverrideRoot,
    cwd: this.mcp.tempRoot,
  });
  assert.equal(PROVENANCE_CALLS.length, MCP_TOOL_NAMES.length, "provenance must exercise the complete tool set");
  this.mcp.provenanceResponses = [];
  for (const [name, args] of PROVENANCE_CALLS) {
    const response = await this.mcp.server.request("tools/call", {
      name,
      arguments: { ...args, requestId: `bdd-provenance-${name}` },
    });
    this.mcp.provenanceResponses.push({ name, response });
  }
});

Then("every result identifies one project-b root, the omp-spec-kit server, and an active-project mismatch", function () {
  const responses = this.mcp.provenanceResponses;
  assert.ok(Array.isArray(responses), "provenance calls must produce a response collection");
  assert.equal(responses.length, PROVENANCE_CALLS.length, "every registered tool must return one response");
  const rootIds = new Set();
  const activeRootIds = new Set();
  for (const { name, response } of responses) {
    assert.equal(response.error, undefined, `${name} must return a tools/call result`);
    const result = response.result;
    assert.equal(result.isError, false, `${name} must succeed on the byte-exact replica`);
    const envelope = result.structuredContent;
    assert.deepStrictEqual(Object.keys(envelope).sort(), [...QUERY_ENVELOPE_KEYS]);
    assert.equal(envelope.ok, true, `${name} envelope must be successful`);
    assert.deepStrictEqual(Object.keys(envelope.provenance).sort(), [
      "activeProjectRootId",
      "matchesActiveProject",
      "resolvedRootId",
      "rootMode",
      "serverName",
    ]);
    assert.equal(envelope.provenance.serverName, "omp-spec-kit");
    assert.equal(envelope.provenance.rootMode, "explicit-absolute-override");
    assert.equal(envelope.provenance.matchesActiveProject, false);
    assert.match(envelope.provenance.resolvedRootId, /^[0-9a-f]{64}$/);
    assert.match(envelope.provenance.activeProjectRootId, /^[0-9a-f]{64}$/);
    assert.notEqual(
      envelope.provenance.resolvedRootId,
      envelope.provenance.activeProjectRootId,
      `${name} must distinguish project-b from cwd project-a`,
    );
    assert.match(result.content[0].text, /active-project-mismatch/);
    rootIds.add(envelope.provenance.resolvedRootId);
    activeRootIds.add(envelope.provenance.activeProjectRootId);
  }
  assert.equal(rootIds.size, 1, "all MCP tools must use one project-b root identity");
  assert.equal(activeRootIds.size, 1, "all MCP tools must use one project-a root identity");
});

When("the real OMP extension probes inventory and overview with project-b as an explicit override while cwd is project-a", async function () {
  this.mcp.extensionProbe = await runExtensionProbe({
    extensionPath: path.join(this.mcp.repositoryRoot, ...EXTENSION_SEGMENTS),
    cwd: this.mcp.tempRoot,
    env: { OMP_SPEC_KIT_ROOT: this.mcp.provenanceOverrideRoot },
    queries: [
      {
        name: "spec_inventory",
        params: { maxSpecs: 50, maxDiagnostics: 25, includeDocumentCounts: true },
        cwd: this.mcp.tempRoot,
      },
      {
        name: "spec_overview",
        params: { specSlugs: [] },
        cwd: this.mcp.tempRoot,
      },
    ],
  });
});

Then("both extension results identify project-b and the active-project mismatch", function () {
  const results = this.mcp.extensionProbe.queryResults;
  assert.ok(Array.isArray(results), "the extension probe must return query results");
  assert.deepStrictEqual(results.map((entry) => entry.name), ["spec_inventory", "spec_overview"]);
  const provenances = results.map((entry) => entry.result.details.provenance);
  assert.equal(provenances.length, 2);
  for (const [index, provenance] of provenances.entries()) {
    assert.deepStrictEqual(Object.keys(provenance).sort(), [
      "activeProjectRootId",
      "matchesActiveProject",
      "resolvedRootId",
      "rootMode",
      "serverName",
    ], `extension result ${index} must expose the complete provenance shape`);
    assert.equal(provenance.serverName, "omp-spec-kit");
    assert.equal(provenance.rootMode, "explicit-absolute-override");
    assert.equal(provenance.matchesActiveProject, false);
    assert.match(provenance.resolvedRootId, /^[0-9a-f]{64}$/);
    assert.match(provenance.activeProjectRootId, /^[0-9a-f]{64}$/);
    assert.notEqual(provenance.resolvedRootId, provenance.activeProjectRootId);
    assert.equal(JSON.stringify(results[index].result).includes(this.mcp.tempRoot), false);
    assert.equal(JSON.stringify(results[index].result).includes(this.mcp.provenanceOverrideRoot), false);
  }
  assert.equal(provenances[0].resolvedRootId, provenances[1].resolvedRootId);
  assert.equal(provenances[0].activeProjectRootId, provenances[1].activeProjectRootId);
  assert.match(results[0].result.content[0].text, /active-project-mismatch/);
  assert.match(results[1].result.content[0].text, /active-project-mismatch/);
});
