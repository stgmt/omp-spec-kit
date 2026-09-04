import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { createSpecService } from "../../src/adapters/query-service.js";
import {
  MCP_TOOL_NAMES,
  QUERY_ENVELOPE_KEYS,
  copyPluginPackage,
  loadPinnedCorpusGraph,
  runExtensionProbe,
  spawnMcpServer,
  writeCorpus,
} from "../helpers/mcp-world.mjs";
import { snapshotTree } from "../support/world.mjs";
import { runPinnedManagerProbe } from "../helpers/omp-discovery-world.mjs";

const INITIALIZE_PARAMS = Object.freeze({
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "mri-bdd", version: "1" },
});

function toolArguments(tool) {
  const shared = { schemaVersion: "spec-kernel@1", requestId: `mri-${tool}` };
  switch (tool) {
    case "spec_inventory":
      return { ...shared, specSlugs: ["plugin-distribution"], includeDocuments: false, limit: 50, cursor: null };
    case "spec_get_node":
      return { ...shared, canonicalId: "plugin-distribution:FR-1", projection: "summary", includeIncidentCounts: false };
    case "spec_find_nodes":
      return { ...shared, specSlugs: ["plugin-distribution"], kinds: [], canonicalIds: [], text: null, projection: "summary", limit: 50, cursor: null };
    case "spec_get_edges":
      return { ...shared, canonicalId: "plugin-distribution:FR-1", direction: "out", types: [], aggregate: false, limit: 50, cursor: null };
    case "spec_trace":
      return { ...shared, canonicalId: "plugin-distribution:FR-1", direction: "out", types: [], maxDepth: 2, maxVisited: 50, projection: "summary", limit: 50, cursor: null };
    case "spec_diagnostics":
      return { ...shared, severities: [], codes: [], specSlugs: ["plugin-distribution"], paths: [], limit: 50, cursor: null };
    case "spec_overview":
      return { ...shared, specSlugs: ["plugin-distribution"] };
    case "spec_markdown_inventory":
      return {
        ...shared,
        specSlugs: ["plugin-distribution"],
        mode: "all",
        focusPath: null,
        focusAnchor: null,
        direction: "both",
        outcomes: [],
        includeHeadings: true,
        includeLinks: true,
        limit: 50,
        cursor: null,
      };
    default:
      throw new Error(`no valid argument fixture for ${tool}`);
  }
}

async function startInstalledServer(state, env = {}) {
  if (state.server !== null) await state.server.close();
  const windows = process.platform === "win32";
  state.server = spawnMcpServer({
    command: windows ? process.execPath : state.launcher,
    args: windows ? [path.join(state.packageRoot, "dist", "mcp", "server.js")] : undefined,
    cwd: state.projectA,
    env: { OMP_SPEC_KIT_PACKAGE_ROOT: state.packageRoot, ...env },
    root: env.OMP_SPEC_KIT_ROOT,
  });
  state.initialize = await state.server.request("initialize", INITIALIZE_PARAMS);
  assert.equal(state.initialize.result.serverInfo.name, "omp-spec-kit");
}

async function collectInstalledResults(state) {
  assert.equal(MCP_TOOL_NAMES.length, 8, "MRI provenance must cover the historical eight-tool surface");
  const results = [];
  for (const tool of MCP_TOOL_NAMES) {
    results.push({
      tool,
      response: await state.server.request("tools/call", {
        name: tool,
        arguments: toolArguments(tool),
      }),
    });
  }
  return results;
}

Before({ tags: "@mcp-release-integrity" }, function () {
  this.mri = { server: null, tempRoot: null };
});

After({ tags: "@mcp-release-integrity" }, async function () {
  if (this.mri?.server !== null && this.mri?.server !== undefined) await this.mri.server.close();
  if (this.mri?.tempRoot !== null && this.mri?.tempRoot !== undefined) {
    await rm(this.mri.tempRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

Given("an isolated v0.3.2 package and manifest-verified corpus exist", async function () {
  const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
  const pinned = await loadPinnedCorpusGraph(repositoryRoot);
  const tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-mri-"));
  const projectA = path.join(tempRoot, "project-a");
  const projectB = path.join(tempRoot, "project-b");
  const packageRoot = path.join(tempRoot, "package-decoy");
  await writeCorpus(projectA, pinned.files);
  await mkdir(path.join(projectB, ".specs", "project-b"), { recursive: true });
  await writeFile(path.join(projectB, ".specs", "project-b", "README.md"), "# Project B\n");
  await copyPluginPackage(repositoryRoot, packageRoot);
  await mkdir(path.join(packageRoot, ".specs", "package-decoy"), { recursive: true });
  await writeFile(path.join(packageRoot, ".specs", "package-decoy", "README.md"), "# Package Decoy\n");
  const packageAlias = path.join(tempRoot, "package-decoy-alias");
  await symlink(packageRoot, packageAlias, "dir");
  this.mri = {
    tempRoot,
    projectA,
    projectB,
    packageRoot,
    packageAlias,
    launcher: path.join(packageRoot, "bin", "omp-spec-kit-mcp"),
    directService: createSpecService(projectA),
    directServiceB: createSpecService(projectB, {
      activeProjectRoot: projectA,
      rootMode: "explicit-absolute-override",
    }),
    specsBefore: await snapshotTree(path.join(projectA, ".specs")),
    server: null,
  };
});

Given("project-a, project-b, and package-decoy have distinct specifications", function () {
  assert.notEqual(this.mri.projectA, this.mri.projectB);
  assert.notEqual(this.mri.projectA, this.mri.packageRoot);
});

When("the installed package launcher serves project-a without an override", async function () {
  await startInstalledServer(this.mri);
  this.mri.overview = await this.mri.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "mri-spec_overview", view: "overview", specSlugs: ["plugin-distribution"] },
  });
  this.mri.overviewOracle = await this.mri.directService.runQuery("catalog", { view: "overview", specSlugs: ["plugin-distribution"] }, {
    requestId: "mri-spec_overview",
    schemaVersion: "spec-kernel@1",
  });
});

Then("the MCP overview contains only project-a specifications", function () {
  assert.equal(this.mri.overview.result.isError, false);
  assert.deepStrictEqual(this.mri.overview.result.structuredContent, this.mri.overviewOracle);
  assert.equal(this.mri.overview.result.structuredContent.data.counts.acceptedDocuments, this.mri.specsBefore.entries.filter((entry) => entry.type === "file").length);
});

Then("relative unresolved or package-root overrides cannot select package-decoy", async function () {
  await startInstalledServer(this.mri, { OMP_SPEC_KIT_ROOT: "package-decoy" });
  const relative = await this.mri.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "mri-spec_overview", view: "overview", specSlugs: ["plugin-distribution"] },
  });
  assert.deepStrictEqual(relative.result.structuredContent, this.mri.overviewOracle);
  await startInstalledServer(this.mri, { OMP_SPEC_KIT_ROOT: "OMP_SPEC_KIT_ROOT" });
  const unresolved = await this.mri.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "mri-spec_overview", view: "overview", specSlugs: ["plugin-distribution"] },
  });
  assert.deepStrictEqual(unresolved.result.structuredContent, this.mri.overviewOracle);
  await startInstalledServer(this.mri, { OMP_SPEC_KIT_ROOT: this.mri.packageRoot });
  const packageOverride = await this.mri.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "mri-spec_overview", view: "overview", specSlugs: ["plugin-distribution"] },
  });
  assert.deepStrictEqual(packageOverride.result.structuredContent, this.mri.overviewOracle);
  await startInstalledServer(this.mri, { OMP_SPEC_KIT_ROOT: this.mri.packageAlias });
  const packageAliasOverride = await this.mri.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "mri-spec_overview", view: "overview", specSlugs: ["plugin-distribution"] },
  });
  assert.deepStrictEqual(packageAliasOverride.result.structuredContent, this.mri.overviewOracle);
});

When("an explicit validated absolute override selects project-b", async function () {
  await startInstalledServer(this.mri, { OMP_SPEC_KIT_ROOT: this.mri.projectB });
  this.mri.projectBInventory = await this.mri.server.request("tools/call", {
    name: "spec_catalog",
    arguments: {
      schemaVersion: "spec-kernel@1",
      requestId: "mri-project-b-inventory",
      view: "inventory",
      specSlugs: ["project-b"],
      includeDocuments: true,
      limit: 50,
      cursor: null,
    },
  });
  this.mri.projectBInventoryOracle = await this.mri.directServiceB.runQuery(
    "catalog",
    { view: "inventory", specSlugs: ["project-b"], includeDocuments: true, limit: 50, cursor: null },
    { requestId: "mri-project-b-inventory", schemaVersion: "spec-kernel@1" },
  );
});

Then("the MCP inventory contains only project-b specifications", function () {
  assert.equal(this.mri.projectBInventory.result.isError, false);
  assert.deepStrictEqual(this.mri.projectBInventory.result.structuredContent, this.mri.projectBInventoryOracle);
  assert.deepStrictEqual(
    this.mri.projectBInventory.result.structuredContent.data.specs.map((item) => item.specSlug),
    ["project-b"],
  );
});

Then("launcher startup from package cwd is refused before serving", async function () {
  const server = spawnMcpServer({
    command: process.platform === "win32" ? process.execPath : this.mri.launcher,
    args: process.platform === "win32" ? [path.join(this.mri.packageRoot, "dist", "mcp", "server.js")] : undefined,
    cwd: this.mri.packageRoot,
    env: { OMP_SPEC_KIT_PACKAGE_ROOT: this.mri.packageRoot },
  });
  await assert.rejects(
    server.request("initialize", INITIALIZE_PARAMS, 1000),
    /PACKAGE_ROOT_REFUSED/u,
  );
  await server.close();
});

Given("an installed MCP server is running", async function () {
  await startInstalledServer(this.mri);
});

When("the client sends JSON-RPC 1.0 with id 7 and then a valid request", async function () {
  this.mri.invalidId = 7;
  this.mri.invalidResponse = await this.mri.server.sendFrame({ jsonrpc: "1.0", id: 7, method: "ping" }, 1000);
  this.mri.recoveryResponse = await this.mri.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "mri-recovery", view: "overview", specSlugs: ["plugin-distribution"] },
  });
});

Then("the first response is -32600 for id 7", function () {
  assert.deepStrictEqual(this.mri.invalidResponse, {
    jsonrpc: "2.0",
    id: 7,
    error: { code: -32600, message: "Invalid Request" },
  });
});

When("the client sends an unknown method with id 8 and an unknown tool with id 9", async function () {
  this.mri.unknownMethodResponse = await this.mri.server.sendFrame(
    { jsonrpc: "2.0", id: 8, method: "unknown/method", params: {} },
    1000,
  );
  this.mri.unknownToolResponse = await this.mri.server.sendFrame(
    { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "missing-tool", arguments: {} } },
    1000,
  );
});

Then("the responses are -32601 for id 8 and -32602 for id 9", function () {
  assert.deepStrictEqual(this.mri.unknownMethodResponse, {
    jsonrpc: "2.0",
    id: 8,
    error: { code: -32601, message: "Method not found: unknown/method" },
  });
  assert.deepStrictEqual(this.mri.unknownToolResponse, {
    jsonrpc: "2.0",
    id: 9,
    error: { code: -32602, message: "Unknown tool: missing-tool" },
  });
});

When("the client sends malformed JSON and then a valid request", async function () {
  this.mri.invalidId = null;
  this.mri.invalidResponse = await this.mri.server.sendRaw('{"jsonrpc":', null, 1000);
  this.mri.recoveryResponse = await this.mri.server.request("tools/call", {
    name: "spec_catalog",
    arguments: { schemaVersion: "spec-kernel@1", requestId: "mri-recovery", view: "overview", specSlugs: ["plugin-distribution"] },
  });
});

Then("the first response is -32700 with null id", function () {
  assert.deepStrictEqual(this.mri.invalidResponse, {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "Parse error" },
  });
});

Then("the valid request returns one canonical envelope with no extra stdout frames", function () {
  assert.equal(this.mri.recoveryResponse.result.isError, false);
  assert.equal(this.mri.server.nonProtocolLines.length, 0, "server stdout must contain only JSON-RPC frames");
  assert.equal(
    this.mri.server.frames.filter((frame) => frame.id === this.mri.invalidId).length,
    1,
    "invalid request has one response",
  );
  assert.equal(this.mri.server.frames.filter((frame) => frame.id === this.mri.recoveryResponse.id).length, 1, "valid request has one response");
});

Given("a copied package has no source checkout or ambient dependencies", function () {
  assert.equal(this.mri.packageRoot.startsWith(this.mri.tempRoot), true);
  assert.equal(this.mri.packageRoot.includes(`${path.sep}node_modules${path.sep}`), false);
});

When("every SCHEMA-11 tool is called with its valid arguments", async function () {
  await startInstalledServer(this.mri);
  this.mri.toolResults = [];

  const MAPPING = {
    spec_inventory: { tool: "spec_catalog", args: (a) => ({ ...a, view: "inventory" }), op: "catalog" },
    spec_get_node: { tool: "spec_entities", args: (a) => ({ ...a, mode: "get" }), op: "entities" },
    spec_find_nodes: { tool: "spec_entities", args: (a) => ({ ...a, mode: "find" }), op: "entities" },
    spec_get_edges: { tool: "spec_graph", args: (a) => ({ ...a, view: "edges" }), op: "graph" },
    spec_trace: { tool: "spec_graph", args: (a) => ({ ...a, view: "trace" }), op: "graph" },
    spec_diagnostics: { tool: "spec_inspect", args: (a) => ({ ...a, check: "diagnostics" }), op: "inspect" },
    spec_overview: { tool: "spec_catalog", args: (a) => ({ ...a, view: "overview" }), op: "catalog" },
    spec_markdown_inventory: { tool: "spec_markdown", args: (a) => a, op: "markdown" },
  };

  for (const historicalTool of MCP_TOOL_NAMES) {
    const mapped = MAPPING[historicalTool];
    const rawArgs = toolArguments(historicalTool);
    const callArgs = mapped.args(rawArgs);
    const response = await this.mri.server.request("tools/call", { name: mapped.tool, arguments: callArgs });
    const { requestId, schemaVersion, ...queryArgs } = callArgs;
    const expected = await this.mri.directService.runQuery(mapped.op, queryArgs, { requestId, schemaVersion });
    this.mri.toolResults.push({ tool: historicalTool, response, expected });
  }
});

Then("each structured result equals the direct service envelope", function () {
  assert.equal(this.mri.toolResults.length, MCP_TOOL_NAMES.length);
  for (const result of this.mri.toolResults) {
    assert.deepStrictEqual(result.response.result.structuredContent, result.expected, result.tool);
  }
});

Then("the served corpus is byte-for-byte unchanged", async function () {
  assert.deepStrictEqual(await snapshotTree(path.join(this.mri.projectA, ".specs")), this.mri.specsBefore);
});

Given("the copied package payload is missing its OMP MCP declaration", async function () {
  await rm(path.join(this.mri.packageRoot, ".mcp.json"));
});

When("the bounded pinned OMP manager handoff runs from project-a", async function () {
  const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
  const runtimeHost = path.join(repositoryRoot, "tests", "fixtures", "omp-discovery-runtime");
  const home = path.join(this.mri.tempRoot, "omp-home");
  const agentRoot = path.join(this.mri.tempRoot, "omp-agent");
  await Promise.all([mkdir(home, { recursive: true }), mkdir(agentRoot, { recursive: true })]);
  const inventoryArgs = {
    specSlugs: [],
    includeDocuments: false,
    limit: 50,
    cursor: null,
  };
  const inventoryRequest = {
    requestId: "omp-manager-handoff-probe",
    schemaVersion: "spec-kernel@1",
  };
  this.mri.managerInventoryOracle = await this.mri.directService.runQuery("inventory", inventoryArgs, inventoryRequest);
  this.mri.managerDecoyInventoryOracle = await createSpecService(this.mri.packageRoot).runQuery(
    "inventory",
    inventoryArgs,
    inventoryRequest,
  );
  this.mri.managerProbe = await runPinnedManagerProbe({
    runtimeHost,
    cwd: this.mri.projectA,
    packageRoot: this.mri.packageRoot,
    verifiedPackageRoot: path.join(repositoryRoot, "plugins", "omp-spec-kit"),
    home,
    agentRoot,
  });
});

Then("the bounded receipt proves the isolated target-only manager query and copied build payload", function () {
  const { exitCode, stderr, expectedDistManifestSha256, expectedLauncherSha256, receipt } = this.mri.managerProbe;
  assert.equal(exitCode, 0, `${stderr}\n${JSON.stringify(receipt, null, 2)}`);
  assert.equal(stderr, "");
  assert.equal(receipt.schema, "omp-manager-handoff-probe@2");
  assert.equal(receipt.result, "completed");
  assert.deepStrictEqual(receipt.phaseMode.mode, "bounded");
  assert.equal(receipt.phaseMode.timeoutMs, 30000);
  assert.equal(receipt.phaseMode.terminalPhase, null);
  assert.deepStrictEqual(
    Object.fromEntries(Object.entries(receipt.phaseMode.checkpoints).map(([name, checkpoint]) => [name, checkpoint.status])),
    {
      payload: "completed",
      imports: "completed",
      enrollment: "completed",
      "capability-config-load": "completed",
      "manager-construction": "completed",
      "target-only-connection": "completed",
      "managed-query": "completed",
      disconnect: "completed",
      receipt: "completed",
    },
  );
  assert.deepStrictEqual(receipt.provenance.runtime.name, "@oh-my-pi/pi-coding-agent");
  assert.equal(receipt.provenance.runtime.version, "18.0.10");
  assert.equal(receipt.provenance.package.verification.distManifest.sha256, expectedDistManifestSha256);
  assert.equal(receipt.provenance.package.verification.distManifest.expectedSha256, expectedDistManifestSha256);
  assert.equal(receipt.provenance.package.verification.launcher.sha256, expectedLauncherSha256);
  assert.equal(receipt.provenance.package.verification.launcher.expectedSha256, expectedLauncherSha256);
  assert.equal(
    receipt.provenance.package.verification.distManifest.fileCount,
    receipt.provenance.package.verification.distManifest.files.length,
  );
  assert.equal(receipt.provenance.package.verification.distManifest.fileCount > 0, true);
  assert.deepStrictEqual(
    receipt.provenance.package.payload.map(({ relative }) => relative).sort(),
    ["bin/omp-spec-kit-mcp", "dist/extension.js", "dist/mcp/server.js"],
  );
  assert.equal(receipt.enrollment.method, "new PluginManager(cwd).link(packageRoot)");
  assert.equal(receipt.enrollment.result.name, "omp-spec-kit");
  assert.equal(receipt.enrollment.result.version, "0.3.2");
  assert.equal(receipt.enrollment.result.path, "<package-copy>");
  assert.equal(receipt.enrollment.result.enabledFeatures, null);
  assert.equal(receipt.enrollment.result.enabled, true);
  assert.deepStrictEqual(receipt.enrollment.result.manifest, {
    extensions: ["./dist/extension.js"],
    version: "0.3.2",
  });
  assert.deepStrictEqual(receipt.enrollment.lockfile.contents.plugins, {
    "omp-spec-kit": { version: "0.3.2", enabledFeatures: null, enabled: true },
  });
  assert.deepStrictEqual(receipt.capability.providers, ["claude-plugins"]);
  assert.deepStrictEqual(receipt.capability.items.map(({ name }) => name), ["omp-spec-kit:omp-spec-kit"]);
  assert.deepStrictEqual(receipt.configLoad.inspection.loadedNames, ["omp-spec-kit:omp-spec-kit"]);
  assert.equal(receipt.configLoad.inspection.targetName, "omp-spec-kit:omp-spec-kit");
  assert.deepStrictEqual(Object.keys(receipt.configLoad.inspection.targetConfigs), ["omp-spec-kit:omp-spec-kit"]);
  assert.deepStrictEqual(Object.keys(receipt.configLoad.inspection.targetSources), ["omp-spec-kit:omp-spec-kit"]);
  assert.equal(receipt.configLoad.inspection.targetSources["omp-spec-kit:omp-spec-kit"].provider, "claude-plugins");
  assert.equal(Object.hasOwn(receipt.configLoad.inspection.targetConfigs["omp-spec-kit:omp-spec-kit"], "cwd"), false);
  assert.match(receipt.configLoad.inspection.targetConfigs["omp-spec-kit:omp-spec-kit"].command, /\/bin\/omp-spec-kit-mcp$/);
  assert.deepStrictEqual(receipt.manager.connectionResult.connectedServers, ["omp-spec-kit:omp-spec-kit"]);
  assert.deepStrictEqual(receipt.manager.connectionResult.errors, {});
  assert.equal(receipt.manager.connectionResult.toolCount, 8);
  const managedQuery = receipt.manager.connectionResult.managedQuery;
  assert.equal(managedQuery.tool.mcpServerName, "omp-spec-kit:omp-spec-kit");
  assert.equal(managedQuery.tool.mcpToolName, "spec_inventory");
  assert.equal(managedQuery.result.isError, false);
  assert.deepStrictEqual(managedQuery.result.details, {
    serverName: "omp-spec-kit:omp-spec-kit",
    mcpToolName: "spec_inventory",
    provider: "claude-plugins",
    providerName: "Claude Code Marketplace",
  });
  const projectACounts = {
    returnedCount: this.mri.managerInventoryOracle.page.returned,
    observedCount: this.mri.managerInventoryOracle.page.totalMatched,
  };
  const packageDecoyCounts = {
    returnedCount: this.mri.managerDecoyInventoryOracle.page.returned,
    observedCount: this.mri.managerDecoyInventoryOracle.page.totalMatched,
  };
  assert.notDeepStrictEqual(
    projectACounts,
    packageDecoyCounts,
    "project-a and package-decoy fixtures must retain distinct inventory cardinalities",
  );
  assert.deepStrictEqual(managedQuery.result.content, {
    text: `inventory ok, returned=${projectACounts.returnedCount}/${projectACounts.observedCount}`,
    ...projectACounts,
  });
  assert.deepStrictEqual(receipt.manager.disconnect.before.serverNames, ["omp-spec-kit:omp-spec-kit"]);
  assert.deepStrictEqual(receipt.manager.disconnect.after, { serverNames: [], servers: {} });
  assert.deepStrictEqual(receipt.manager.stateAfterDisconnect, { serverNames: [], servers: {} });
});

Then("the invalid payload receipt fails before OMP enrollment", function () {
  const { exitCode, stderr, receipt } = this.mri.managerProbe;
  assert.equal(exitCode, 1, stderr);
  assert.equal(stderr, "");
  assert.equal(receipt.schema, "omp-manager-handoff-probe@2");
  assert.equal(receipt.result, "incomplete");
  assert.equal(receipt.phaseMode.terminalPhase, "payload");
  assert.equal(receipt.phaseMode.checkpoints.payload.status, "failed");
  assert.equal(receipt.phaseMode.checkpoints.enrollment.status, "skipped");
  assert.equal(receipt.phaseMode.checkpoints["capability-config-load"].status, "skipped");
  assert.equal(receipt.phaseMode.checkpoints["manager-construction"].status, "skipped");
  assert.equal(receipt.phaseMode.checkpoints["target-only-connection"].status, "skipped");
  assert.equal(receipt.phaseMode.checkpoints["managed-query"].status, "skipped");
  assert.equal(receipt.enrollment, undefined);
  assert.equal(receipt.capability, undefined);
  assert.equal(receipt.configLoad, undefined);
  assert.equal(receipt.manager, undefined);
});

When("the installed package launcher probes every MCP tool for project-a without an override", async function () {
  await startInstalledServer(this.mri);
  this.mri.provenanceActiveResults = await collectInstalledResults(this.mri);
});

Then("every installed result identifies the active project root and server", function () {
  const results = this.mri.provenanceActiveResults;
  assert.ok(Array.isArray(results), "the active-project probe must return a result collection");
  assert.equal(results.length, MCP_TOOL_NAMES.length);
  const resolvedRootIds = new Set();
  const activeRootIds = new Set();
  for (const { tool, response } of results) {
    assert.equal(response.error, undefined, `${tool} must return a tools/call result`);
    assert.equal(response.result.isError, false, `${tool} must succeed from project-a`);
    const envelope = response.result.structuredContent;
    assert.deepStrictEqual(Object.keys(envelope).sort(), [...QUERY_ENVELOPE_KEYS]);
    assert.equal(envelope.provenance.serverName, "omp-spec-kit");
    assert.equal(envelope.provenance.rootMode, "active-project");
    assert.equal(envelope.provenance.matchesActiveProject, true);
    assert.equal(envelope.provenance.resolvedRootId, envelope.provenance.activeProjectRootId);
    assert.match(envelope.provenance.resolvedRootId, /^[0-9a-f]{64}$/);
    assert.equal(JSON.stringify(response.result).includes(this.mri.projectA), false, `${tool} must not disclose project-a path`);
    resolvedRootIds.add(envelope.provenance.resolvedRootId);
    activeRootIds.add(envelope.provenance.activeProjectRootId);
  }
  assert.equal(resolvedRootIds.size, 1, "all active-project results must share one resolved root identity");
  assert.equal(activeRootIds.size, 1, "all active-project results must share one active root identity");
});

When("the installed package launcher probes every MCP tool with project-b as an explicit override", async function () {
  await startInstalledServer(this.mri, { OMP_SPEC_KIT_ROOT: this.mri.projectB });
  this.mri.provenanceOverrideResults = await collectInstalledResults(this.mri);
});

Then("every installed result identifies project-b as an explicit root and marks the active-project mismatch", function () {
  const results = this.mri.provenanceOverrideResults;
  assert.ok(Array.isArray(results), "the explicit-override probe must return a result collection");
  assert.equal(results.length, MCP_TOOL_NAMES.length);
  const resolvedRootIds = new Set();
  const activeRootIds = new Set();
  for (const { tool, response } of results) {
    assert.equal(response.error, undefined, `${tool} must return a tools/call result`);
    assert.equal(typeof response.result.isError, "boolean", `${tool} must declare its result status`);
    const envelope = response.result.structuredContent;
    assert.deepStrictEqual(Object.keys(envelope).sort(), [...QUERY_ENVELOPE_KEYS]);
    assert.equal(envelope.ok, !response.result.isError, `${tool} envelope status must match transport status`);
    assert.equal(envelope.provenance.serverName, "omp-spec-kit");
    assert.equal(envelope.provenance.rootMode, "explicit-absolute-override");
    assert.equal(envelope.provenance.matchesActiveProject, false);
    assert.notEqual(envelope.provenance.resolvedRootId, envelope.provenance.activeProjectRootId);
    assert.match(envelope.provenance.resolvedRootId, /^[0-9a-f]{64}$/);
    assert.match(envelope.provenance.activeProjectRootId, /^[0-9a-f]{64}$/);
    assert.match(response.result.content[0].text, /active-project-mismatch/);
    assert.equal(JSON.stringify(response.result).includes(this.mri.projectA), false, `${tool} must not disclose cwd path`);
    assert.equal(JSON.stringify(response.result).includes(this.mri.projectB), false, `${tool} must not disclose override path`);
    resolvedRootIds.add(envelope.provenance.resolvedRootId);
    activeRootIds.add(envelope.provenance.activeProjectRootId);
  }
  assert.equal(resolvedRootIds.size, 1, "all explicit-override results must share project-b identity");
  assert.equal(activeRootIds.size, 1, "all explicit-override results must share project-a identity");
});

When("the OMP extension runs with project-a as cwd and project-b as an explicit root override", async function () {
  this.mri.extensionProbe = await runExtensionProbe({
    extensionPath: path.join(this.mri.packageRoot, "dist", "extension.js"),
    cwd: this.mri.projectA,
    env: { OMP_SPEC_KIT_ROOT: this.mri.projectB },
  });
});

Then("its inventory and query results identify the same project-b root and server", function () {
  assert.equal(this.mri.extensionProbe.tools.length, 0, "extension must register 0 direct tools in MCP-only architecture");
  assert.ok(this.mri.extensionProbe.registeredEvents?.includes("tool_call"), "extension must register fail-closed tool_call hook");
  assert.equal(this.mri.extensionProbe.labels[0], "OMP Spec Kit");
});
