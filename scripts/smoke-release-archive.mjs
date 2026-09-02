import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { loadFrozenRealCorpus, writeCorpus } from "../tests/helpers/kernel-world.mjs";
import { prepareV05ToolE2EFixtures, runV05ToolE2E } from "../tests/helpers/v05-tool-e2e.mjs";
import { V06_ALL_TOOL_NAMES, runV06ToolE2E, prepareV06ToolE2EFixtures } from "../tests/helpers/v06-tool-e2e.mjs";

const execFile = promisify(execFileCallback);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const SAFE_AUTHORING_TOOLS = Object.freeze([
  "apply_proposed_patch", "propose_patch", "spec_diagnostics", "spec_find_nodes", "spec_get_edges", "spec_get_node", "spec_inventory", "spec_markdown_inventory", "spec_overview", "spec_trace",
]);
const V05_TOOLS = Object.freeze([
  "apply_proposed_patch", "find_by_tags", "find_orphans", "get_archival_proof", "get_scenario_trace", "get_spec_status", "get_test_result", "list_phase_tasks", "list_spec_docs", "list_specs", "list_tasks", "mcp_preflight", "policy_query_requirements", "propose_patch", "read_attachment", "read_spec_doc", "spec_diagnostics", "spec_find_nodes", "spec_get_edges", "spec_get_node", "spec_inventory", "spec_markdown_inventory", "spec_overview", "spec_trace", "validate_anchor", "validate_requirement_metadata", "validate_spec",
]);
const V06_TOOLS = Object.freeze([...V06_ALL_TOOL_NAMES].sort());

const { values } = parseArgs({ options: { archive: { type: "string" }, stage: { type: "string" } }, strict: true });
if (!values.archive) throw new Error("--archive is required");
const expectedTools = values.stage === "safe-authoring" ? SAFE_AUTHORING_TOOLS : values.stage === "v0.5.0" ? V05_TOOLS : V06_TOOLS;
const archivePath = path.resolve(values.archive);
const tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-release-smoke-"));
const packageRoot = path.join(tempRoot, "package");
const projectRoot = path.join(tempRoot, "project");
await mkdir(packageRoot, { recursive: true });
await mkdir(projectRoot, { recursive: true });
let outsideRoot = null;
if (values.stage === undefined) {
  const frozen = await loadFrozenRealCorpus(repositoryRoot);
  await writeCorpus(projectRoot, frozen.files);
  await prepareV06ToolE2EFixtures(projectRoot);
  outsideRoot = path.join(path.dirname(projectRoot), path.basename(projectRoot) + "-outside");
  await mkdir(outsideRoot, { recursive: true });
  await mkdir(path.join(projectRoot, ".omp-spec-kit", "evidence"), { recursive: true });
  await writeFile(path.join(outsideRoot, "secret.md"), "outside secret", "utf8");
  await writeFile(path.join(outsideRoot, "secret.bin"), Buffer.from("outside-bytes", "utf8"));
  await symlink(outsideRoot, path.join(projectRoot, ".omp-spec-kit", "evidence", "outside-link"), "junction");
} else {
  await mkdir(path.join(projectRoot, ".specs", "smoke"), { recursive: true });
  await writeFile(path.join(projectRoot, ".specs", "smoke", "README.md"), "# Release smoke\n", "utf8");
}

function createArchiveClient(command, cwd, env) {
  const child = spawn(command, [], { cwd, env, stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32", windowsHide: true });
  const stderr = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const pending = [];
  const unsolicited = [];
  let nextId = 0;
  const lineReader = createInterface({ input: child.stdout });
  lineReader.on("line", (line) => {
    let frame;
    try { frame = JSON.parse(line); } catch { unsolicited.push(line); return; }
    const waiter = pending.shift();
    if (waiter) waiter.resolve(frame);
    else unsolicited.push(frame);
  });
  function send(method, params) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`MCP response timeout; stderr=${stderr.join("")}`)), 30000);
      pending.push({ resolve: (frame) => { clearTimeout(timeout); resolve(frame); }, reject });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }
  async function close() {
    lineReader.close();
    if (child.stdin.writable) child.stdin.end();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  return { child, send, close, unsolicited };
}

let client;
const launcher = path.join(packageRoot, "bin", "omp-spec-kit-mcp");
const command = process.platform === "win32" ? path.join(packageRoot, "bin", "omp-spec-kit-mcp.cmd") : launcher;
const env = { ...process.env };
if (values.stage) env.OMP_SPEC_KIT_STAGE = values.stage;
else delete env.OMP_SPEC_KIT_STAGE;
delete env.OMP_SPEC_KIT_PACKAGE_ROOT;
delete env.OMP_SPEC_KIT_ROOT;

try {
  await execFile("tar", ["-xf", archivePath, "-C", packageRoot]);
  const packageManifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  const start = () => createArchiveClient(command, projectRoot, env);
  client = start();
  const initialize = await client.send("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "release-archive-smoke", version: "1" } });
  assert.equal(initialize.error, undefined, JSON.stringify(initialize));
  const listed = await client.send("tools/list", {});
  const toolNames = listed.result.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, expectedTools, "the launcher must expose the selected stage surface");

  if (values.stage === undefined) {
    const listTools = async () => client.send("tools/list", {});
    const callTool = async (name, arguments_) => {
      const response = await client.send("tools/call", { name, arguments: arguments_ });
      assert.equal(response.error, undefined, JSON.stringify(response));
      return response;
    };
    await runV06ToolE2E({
      listTools,
      callTool,
      projectRoot,
      repositoryRoot,
    });
  } else {
    const overview = await client.send("tools/call", { name: "spec_overview", arguments: { schemaVersion: "spec-kernel@1", requestId: "release-smoke-overview", specSlugs: [] } });
    assert.equal(overview.error, undefined, JSON.stringify(overview));
    assert.equal(overview.result.isError, false, JSON.stringify(overview));
    const fingerprint = overview.result.structuredContent.graph.fingerprint;
    assert.deepEqual(JSON.parse(overview.result.content[0].text), overview.result.structuredContent);
    assert.equal(typeof fingerprint, "string");
    const proposal = await client.send("tools/call", {
      name: "propose_patch",
      arguments: {
        schemaVersion: "spec-kernel@1", requestId: "release-smoke-proposal", repositoryRootFingerprint: fingerprint,
        spec: "smoke", reason: "release archive smoke", operations: [{ kind: "insert_at_eof", document: "README.md", text: "archive launcher proof" }],
      },
    });
    assert.equal(proposal.error, undefined, JSON.stringify(proposal));
    assert.equal(proposal.result.isError, false, JSON.stringify(proposal));
    assert.equal(proposal.result.structuredContent.ok, true, JSON.stringify(proposal));
    assert.deepEqual(JSON.parse(proposal.result.content[0].text), proposal.result.structuredContent);
  }
  assert.equal(client.unsolicited.length, 0, "the launcher must not emit unsolicited stdout frames");
  console.log(JSON.stringify({ result: "passed", packageVersion: packageManifest.version, stage: values.stage ?? "default", toolCount: toolNames.length, toolNames }));
} finally {
  if (client) await client.close().catch(() => {});
  if (outsideRoot) await rm(outsideRoot, { recursive: true, force: true });
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 3 });
}
