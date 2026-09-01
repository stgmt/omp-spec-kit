import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

const execFile = promisify(execFileCallback);
const EXPECTED_TOOLS = Object.freeze([
  "apply_proposed_patch",
  "propose_patch",
  "spec_diagnostics",
  "spec_find_nodes",
  "spec_get_edges",
  "spec_get_node",
  "spec_inventory",
  "spec_markdown_inventory",
  "spec_overview",
  "spec_trace",
]);

const { values } = parseArgs({
  options: { archive: { type: "string" }, stage: { type: "string" } },
  strict: true,
});
if (!values.archive) throw new Error("--archive is required");

const archivePath = path.resolve(values.archive);
const tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-release-smoke-"));
const packageRoot = path.join(tempRoot, "package");
const projectRoot = path.join(tempRoot, "project");
await Promise.all([
  mkdir(packageRoot, { recursive: true }),
  mkdir(path.join(projectRoot, ".specs", "smoke"), { recursive: true }),
]);
await writeFile(path.join(projectRoot, ".specs", "smoke", "README.md"), "# Release smoke\n", "utf8");

let child;
try {
  await execFile("tar", ["-xf", archivePath, "-C", packageRoot]);
  const packageManifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  const launcher = path.join(packageRoot, "bin", "omp-spec-kit-mcp");
  const windows = process.platform === "win32";
  const command = windows ? path.join(packageRoot, "bin", "omp-spec-kit-mcp.cmd") : launcher;
  const args = [];
  const env = { ...process.env };
  if (values.stage) env.OMP_SPEC_KIT_STAGE = values.stage;
  else delete env.OMP_SPEC_KIT_STAGE;
  delete env.OMP_SPEC_KIT_PACKAGE_ROOT;
  delete env.OMP_SPEC_KIT_ROOT;
  child = spawn(command, args, {
    cwd: projectRoot,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: windows,
  });

  const stderr = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const frames = [];
  const pending = [];
  const lineReader = createInterface({ input: child.stdout });
  lineReader.on("line", (line) => {
    try {
      const frame = JSON.parse(line);
      const resolve = pending.shift();
      if (resolve) resolve(frame);
      else frames.push(frame);
    } catch (error) {
      const reject = pending.shift();
      if (reject) reject(new Error(`invalid stdout frame: ${line}`, { cause: error }));
    }
  });

  function nextFrame() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`MCP response timeout; stderr=${stderr.join("")}`)), 5000);
      pending.push((frame) => {
        clearTimeout(timeout);
        resolve(frame);
      });
    });
  }
  function send(frame) {
    child.stdin.write(`${JSON.stringify(frame)}\n`);
    return nextFrame();
  }

  const initialize = await send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "release-archive-smoke", version: "1" },
    },
  });
  assert.equal(initialize.error, undefined, JSON.stringify(initialize));
  const listed = await send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const toolNames = listed.result.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, EXPECTED_TOOLS, "the shipped launcher must expose the v0.4.x ten-tool surface");

  const overview = await send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "spec_overview",
      arguments: { schemaVersion: "spec-kernel@1", requestId: "release-smoke-overview", specSlugs: [] },
    },
  });
  assert.equal(overview.error, undefined, JSON.stringify(overview));
  assert.equal(overview.result.isError, false, JSON.stringify(overview));
  const fingerprint = overview.result.structuredContent.graph.fingerprint;
  assert.deepStrictEqual(JSON.parse(overview.result.content[0].text), overview.result.structuredContent);
  assert.equal(typeof fingerprint, "string");
  const proposal = await send({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "propose_patch",
      arguments: {
        schemaVersion: "spec-kernel@1",
        requestId: "release-smoke-proposal",
        repositoryRootFingerprint: fingerprint,
        spec: "smoke",
        reason: "release archive smoke",
        operations: [{ kind: "insert_at_eof", document: "README.md", text: "archive launcher proof" }],
      },
    },
  });
  assert.equal(proposal.error, undefined, JSON.stringify(proposal));
  assert.equal(proposal.result.isError, false, JSON.stringify(proposal));
  assert.equal(proposal.result.structuredContent.ok, true, JSON.stringify(proposal));
  assert.deepStrictEqual(JSON.parse(proposal.result.content[0].text), proposal.result.structuredContent);
  assert.equal(frames.length, 0, "the launcher must not emit unsolicited stdout frames");
  console.log(JSON.stringify({ result: "passed", packageVersion: packageManifest.version, stage: values.stage ?? "default", toolCount: toolNames.length, toolNames }));
} finally {
  if (child && !child.killed) child.kill();
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 3 });
}
