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
import { ALL_TOOL_NAMES, runToolE2E, prepareToolE2EFixtures } from "../tests/helpers/tool-e2e.mjs";

const execFile = promisify(execFileCallback);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const EXPECTED_TOOLS = Object.freeze([...ALL_TOOL_NAMES].sort());

const { values } = parseArgs({ options: { archive: { type: "string" } }, strict: true });
if (!values.archive) throw new Error("--archive is required");
const expectedTools = EXPECTED_TOOLS;
const archivePath = path.resolve(values.archive);
const tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-release-smoke-"));
const packageRoot = path.join(tempRoot, "package");
const projectRoot = path.join(tempRoot, "project");
await mkdir(packageRoot, { recursive: true });
await mkdir(projectRoot, { recursive: true });
let outsideRoot = null;
{
  const frozen = await loadFrozenRealCorpus(repositoryRoot);
  await writeCorpus(projectRoot, frozen.files);
  await prepareToolE2EFixtures(projectRoot);
  outsideRoot = path.join(path.dirname(projectRoot), path.basename(projectRoot) + "-outside");
  await mkdir(outsideRoot, { recursive: true });
  await mkdir(path.join(projectRoot, ".omp-spec-kit", "evidence"), { recursive: true });
  await writeFile(path.join(outsideRoot, "secret.md"), "outside secret", "utf8");
  await writeFile(path.join(outsideRoot, "secret.bin"), Buffer.from("outside-bytes", "utf8"));
  await symlink(outsideRoot, path.join(projectRoot, ".omp-spec-kit", "evidence", "outside-link"), "junction");
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
delete env.OMP_SPEC_KIT_STAGE;
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
  assert.deepEqual(toolNames, expectedTools, "the launcher must expose the single 38-tool surface");

  {
    const listTools = async () => client.send("tools/list", {});
    const callTool = async (name, arguments_) => {
      const response = await client.send("tools/call", { name, arguments: arguments_ });
      assert.equal(response.error, undefined, JSON.stringify(response));
      return response;
    };
    await runToolE2E({
      listTools,
      callTool,
      projectRoot,
      repositoryRoot,
    });
  }
  assert.equal(client.unsolicited.length, 0, "the launcher must not emit unsolicited stdout frames");
  console.log(JSON.stringify({ result: "passed", packageVersion: packageManifest.version, toolCount: toolNames.length, toolNames }));
} finally {
  if (client) await client.close().catch(() => {});
  if (outsideRoot) await rm(outsideRoot, { recursive: true, force: true });
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 3 });
}
