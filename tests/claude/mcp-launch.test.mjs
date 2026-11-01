import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Launches the server exactly as Claude Code does from plugins/omp-spec-kit/.mcp.json
// (command node, no shell, no launcher script), with the host placeholders substituted.
// It runs the built dist/mcp/server.js, so the plugin must be built first.
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pluginRoot = path.join(repositoryRoot, "plugins", "omp-spec-kit");
const PLUGIN_ROOT_PLACEHOLDER = "${CLAUDE_PLUGIN_ROOT}";
const PROJECT_DIR_PLACEHOLDER = "${CLAUDE_PROJECT_DIR}";
const EXPECTED_TOOL_COUNT = 10;
const STEP_TIMEOUT_MS = 20_000;

let projectDir;
let otherCwd;

before(() => {
  projectDir = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-mcp-project-")));
  mkdirSync(path.join(projectDir, ".specs", "foo"), { recursive: true });
  writeFileSync(path.join(projectDir, ".specs", "foo", "foo.md"), "# Foo\n");
  otherCwd = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-mcp-cwd-")));
});

after(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(otherCwd, { recursive: true, force: true });
});

function readServerConfig() {
  const config = JSON.parse(readFileSync(path.join(pluginRoot, ".mcp.json"), "utf8"));
  return config.mcpServers["omp-spec-kit"];
}

function substitute(value) {
  const pluginRootPosix = pluginRoot.split(path.sep).join("/");
  return value
    .replaceAll(PLUGIN_ROOT_PLACEHOLDER, () => pluginRootPosix)
    .replaceAll(PROJECT_DIR_PLACEHOLDER, () => projectDir);
}

function baseEnvironment() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("OMP_SPEC_KIT_")) env[key] = value;
  }
  return env;
}

// Newline-delimited JSON-RPC session: send three messages, wait for the tools/list reply,
// close stdin, and resolve with everything the server wrote.
function runSession(server) {
  const args = server.args.map(substitute);
  const env = { ...baseEnvironment(), ...Object.fromEntries(Object.entries(server.env ?? {}).map(([key, value]) => [key, substitute(value)])) };
  return new Promise((resolve, reject) => {
    const child = spawn(server.command, args, { cwd: otherCwd, env, shell: false, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let listed = false;
    const timer = setTimeout(() => finish(new Error(`MCP session timed out; stdout=${stdout.slice(0, 500)} stderr=${stderr.slice(0, 500)}`)), STEP_TIMEOUT_MS);

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        child.kill();
        reject(error);
      }
    }

    child.on("error", finish);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!listed && stdout.split("\n").some((line) => line.includes('"id":2'))) {
        listed = true;
        child.stdin.end();
      }
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "omp-spec-kit-launch-test", version: "0.0.0" } },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  });
}

describe(".mcp.json launch shape", () => {
  it("declares a streamable HTTP registry endpoint with placeholders only", () => {
    const server = readServerConfig();
    assert.equal(server.type, "http");
    assert.equal(server.url, "${OMP_SPEC_REGISTRY_URL}");
    assert.deepEqual(server.headers, {
      Authorization: "Bearer ${OMP_SPEC_REGISTRY_TOKEN}",
    });
    assert.equal(server.command, undefined);
    assert.equal(server.env, undefined);
  });
});

describe("bundled MCP server", () => {
  it("answers tools/list with ten tools and keeps stdout JSON-only", async () => {
    const server = {
      command: process.execPath,
      args: [path.join(pluginRoot, "dist", "mcp", "server.js")],
      env: { OMP_SPEC_KIT_ROOT: projectDir },
    };
    const { code, stdout, stderr } = await runSession(server);
    assert.equal(stderr, "");
    assert.equal(code, 0);

    const lines = stdout.split("\n").filter((line) => line.trim() !== "");
    assert.ok(lines.length >= 2, `expected initialize and tools/list replies, got ${lines.length} line(s)`);
    const messages = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        assert.fail(`stdout line is not JSON: ${line.slice(0, 200)}`);
      }
    });
    for (const message of messages) assert.equal(message.jsonrpc, "2.0");

    const initialized = messages.find((message) => message.id === 1);
    assert.equal(initialized?.result?.serverInfo?.name, "omp-spec-kit");
    const listed = messages.find((message) => message.id === 2);
    assert.equal(listed?.error, undefined);
    assert.equal(listed?.result?.tools?.length, EXPECTED_TOOL_COUNT);
    assert.equal(new Set(listed.result.tools.map((tool) => tool.name)).size, EXPECTED_TOOL_COUNT);
  });
});

describe("OMP_SPEC_KIT_ROOT placeholder handling", () => {
  const modulePath = path.join(pluginRoot, "dist", "adapters", "query-service.js");

  it("honors the substituted project directory as the repository root", async () => {
    const { resolveRepositoryContext } = await import(pathToFileURL(modulePath).href);
    const context = resolveRepositoryContext({ OMP_SPEC_KIT_ROOT: projectDir }, otherCwd);
    assert.equal(context.resolvedRoot, projectDir);
    assert.equal(context.rootMode, "explicit-absolute-override");
  });

  it("ignores an unsubstituted placeholder (a host that does not expand it) and falls back to cwd", async () => {
    const { resolveRepositoryContext } = await import(pathToFileURL(modulePath).href);
    const context = resolveRepositoryContext({ OMP_SPEC_KIT_ROOT: PROJECT_DIR_PLACEHOLDER }, projectDir);
    assert.equal(context.resolvedRoot, projectDir);
    assert.equal(context.rootMode, "active-project");
  });
});
