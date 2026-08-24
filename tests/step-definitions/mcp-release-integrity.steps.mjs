import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { createSpecService } from "../../src/adapters/query-service.js";
import {
  MCP_TOOL_NAMES,
  copyPluginPackage,
  loadPinnedCorpusGraph,
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
      return { ...shared, specSlugs: ["product"], includeDocuments: false, limit: 50, cursor: null };
    case "spec_get_node":
      return { ...shared, canonicalId: "product:FR-1", projection: "summary", includeIncidentCounts: false };
    case "spec_find_nodes":
      return { ...shared, specSlugs: ["product"], kinds: [], canonicalIds: [], text: null, projection: "summary", limit: 50, cursor: null };
    case "spec_get_edges":
      return { ...shared, canonicalId: "product:FR-1", direction: "out", types: [], aggregate: false, limit: 50, cursor: null };
    case "spec_trace":
      return { ...shared, canonicalId: "product:FR-1", direction: "out", types: [], maxDepth: 2, maxVisited: 50, projection: "summary", limit: 50, cursor: null };
    case "spec_diagnostics":
      return { ...shared, severities: [], codes: [], specSlugs: ["product"], paths: [], limit: 50, cursor: null };
    case "spec_overview":
      return { ...shared, specSlugs: ["product"] };
    case "spec_markdown_inventory":
      return {
        ...shared,
        specSlugs: ["product"],
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
  state.server = spawnMcpServer({ command: state.launcher, cwd: state.projectA, env });
  state.initialize = await state.server.request("initialize", INITIALIZE_PARAMS);
  assert.equal(state.initialize.result.serverInfo.name, "omp-spec-kit");
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

Given("an isolated v0.3.1 package and manifest-verified corpus exist", async function () {
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
  this.mri = {
    tempRoot,
    projectA,
    projectB,
    packageRoot,
    launcher: path.join(packageRoot, "bin", "omp-spec-kit-mcp"),
    directService: createSpecService(projectA),
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
    name: "spec_overview",
    arguments: toolArguments("spec_overview"),
  });
  this.mri.overviewOracle = await this.mri.directService.runQuery("overview", { specSlugs: ["product"] }, {
    requestId: "mri-spec_overview",
    schemaVersion: "spec-kernel@1",
  });
});

Then("the MCP overview contains only project-a specifications", function () {
  assert.equal(this.mri.overview.result.isError, false);
  assert.deepStrictEqual(this.mri.overview.result.structuredContent, this.mri.overviewOracle);
  assert.equal(this.mri.overview.result.structuredContent.data.counts.acceptedDocuments, this.mri.specsBefore.entries.filter((entry) => entry.type === "file").length);
});

Then("a relative or unresolved root override cannot select package-decoy", async function () {
  await startInstalledServer(this.mri, { OMP_SPEC_KIT_ROOT: "package-decoy" });
  const relative = await this.mri.server.request("tools/call", {
    name: "spec_overview",
    arguments: toolArguments("spec_overview"),
  });
  assert.deepStrictEqual(relative.result.structuredContent, this.mri.overviewOracle);
  await startInstalledServer(this.mri, { OMP_SPEC_KIT_ROOT: "OMP_SPEC_KIT_ROOT" });
  const unresolved = await this.mri.server.request("tools/call", {
    name: "spec_overview",
    arguments: toolArguments("spec_overview"),
  });
  assert.deepStrictEqual(unresolved.result.structuredContent, this.mri.overviewOracle);
});

Given("an installed MCP server is running", async function () {
  await startInstalledServer(this.mri);
});

When("the client sends JSON-RPC 1.0 with id 7 and then a valid request", async function () {
  this.mri.invalidId = 7;
  this.mri.invalidResponse = await this.mri.server.sendFrame({ jsonrpc: "1.0", id: 7, method: "ping" }, 1000);
  this.mri.recoveryResponse = await this.mri.server.request("tools/call", {
    name: "spec_overview",
    arguments: toolArguments("spec_overview"),
  });
});

Then("the first response is -32600 for id 7", function () {
  assert.deepStrictEqual(this.mri.invalidResponse, {
    jsonrpc: "2.0",
    id: 7,
    error: { code: -32600, message: "Invalid Request" },
  });
});

When("the client sends malformed JSON and then a valid request", async function () {
  this.mri.invalidId = null;
  this.mri.invalidResponse = await this.mri.server.sendRaw('{"jsonrpc":', null, 1000);
  this.mri.recoveryResponse = await this.mri.server.request("tools/call", {
    name: "spec_overview",
    arguments: toolArguments("spec_overview"),
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
  for (const tool of MCP_TOOL_NAMES) {
    const args = toolArguments(tool);
    const response = await this.mri.server.request("tools/call", { name: tool, arguments: args });
    const operation = {
      spec_inventory: "inventory",
      spec_get_node: "getNode",
      spec_find_nodes: "findNodes",
      spec_get_edges: "getEdges",
      spec_trace: "trace",
      spec_diagnostics: "diagnostics",
      spec_overview: "overview",
      spec_markdown_inventory: "markdownInventory",
    }[tool];
    const { requestId, schemaVersion, ...queryArgs } = args;
    const expected = await this.mri.directService.runQuery(operation, queryArgs, { requestId, schemaVersion });
    this.mri.toolResults.push({ tool, response, expected });
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
  assert.equal(receipt.provenance.runtime.version, "17.3.7");
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
  assert.equal(receipt.enrollment.result.version, "0.3.1");
  assert.equal(receipt.enrollment.result.path, "<package-copy>");
  assert.equal(receipt.enrollment.result.enabledFeatures, null);
  assert.equal(receipt.enrollment.result.enabled, true);
  assert.deepStrictEqual(receipt.enrollment.result.manifest, {
    extensions: ["./dist/extension.js"],
    version: "0.3.1",
  });
  assert.deepStrictEqual(receipt.enrollment.lockfile.contents.plugins, {
    "omp-spec-kit": { version: "0.3.1", enabledFeatures: null, enabled: true },
  });
  assert.deepStrictEqual(receipt.capability.providers, ["omp-plugins"]);
  assert.deepStrictEqual(receipt.capability.items.map(({ name }) => name), ["omp-spec-kit"]);
  assert.deepStrictEqual(receipt.configLoad.inspection.loadedNames, ["omp-spec-kit"]);
  assert.equal(receipt.configLoad.inspection.targetName, "omp-spec-kit");
  assert.deepStrictEqual(Object.keys(receipt.configLoad.inspection.targetConfigs), ["omp-spec-kit"]);
  assert.deepStrictEqual(Object.keys(receipt.configLoad.inspection.targetSources), ["omp-spec-kit"]);
  assert.equal(receipt.configLoad.inspection.targetSources["omp-spec-kit"].provider, "omp-plugins");
  assert.equal(Object.hasOwn(receipt.configLoad.inspection.targetConfigs["omp-spec-kit"], "cwd"), false);
  assert.match(receipt.configLoad.inspection.targetConfigs["omp-spec-kit"].command, /\/bin\/omp-spec-kit-mcp$/);
  assert.deepStrictEqual(receipt.manager.connectionResult.connectedServers, ["omp-spec-kit"]);
  assert.deepStrictEqual(receipt.manager.connectionResult.errors, {});
  assert.equal(receipt.manager.connectionResult.toolCount, 8);
  const managedQuery = receipt.manager.connectionResult.managedQuery;
  assert.equal(managedQuery.tool.mcpServerName, "omp-spec-kit");
  assert.equal(managedQuery.tool.mcpToolName, "spec_inventory");
  assert.equal(managedQuery.result.isError, false);
  assert.deepStrictEqual(managedQuery.result.details, {
    serverName: "omp-spec-kit",
    mcpToolName: "spec_inventory",
    provider: "omp-plugins",
    providerName: "OMP Extension Packages",
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
  assert.deepStrictEqual(receipt.manager.disconnect.before.serverNames, ["omp-spec-kit"]);
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
