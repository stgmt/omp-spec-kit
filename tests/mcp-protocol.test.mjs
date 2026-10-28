import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

// Spawns the real source entry point (src/mcp/server.js), so no build is
// needed. The working directory is always a throwaway temp project.
const SERVER_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "mcp", "server.js");
const REQUEST_TIMEOUT_MS = 15000;
const LATEST = "2025-11-25";

function startServer({ cwd, packageRoot }) {
  const env = { ...process.env };
  delete env.OMP_SPEC_KIT_ROOT;
  delete env.OMP_SPEC_KIT_PACKAGE_ROOT;
  if (packageRoot !== undefined) env.OMP_SPEC_KIT_PACKAGE_ROOT = packageRoot;
  const child = spawn(process.execPath, [SERVER_PATH], { cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
    child.once("error", (error) => resolve({ error }));
  });
  let stderrText = "";
  child.stderr.on("data", (chunk) => {
    stderrText += chunk.toString("utf8");
  });

  const pending = new Map();
  const reader = createInterface({ input: child.stdout });
  reader.on("line", (line) => {
    if (line.trim().length === 0) return;
    const frame = JSON.parse(line);
    const entry = pending.get(frame.id);
    if (entry === undefined) return;
    pending.delete(frame.id);
    clearTimeout(entry.timer);
    entry.resolve(frame);
  });

  let nextId = 0;
  function request(method, params) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out; server stderr:\n${stderrText}`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, timer });
      const frame = params === undefined ? { jsonrpc: "2.0", id, method } : { jsonrpc: "2.0", id, method, params };
      child.stdin.write(`${JSON.stringify(frame)}\n`);
    });
  }

  async function close() {
    reader.close();
    child.stdin.end();
    const settled = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve(null), 5000))]);
    if (settled === null) {
      child.kill("SIGKILL");
      await exited;
    }
  }

  return { child, request, close, stderr: () => stderrText };
}

const CLIENT_INFO = { name: "mcp-protocol-test", version: "1" };

function initialize(server, protocolVersion) {
  const params = { capabilities: {}, clientInfo: CLIENT_INFO };
  if (protocolVersion !== undefined) params.protocolVersion = protocolVersion;
  return server.request("initialize", params);
}

describe("MCP protocol negotiation", () => {
  let projectDir;
  let server;

  before(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-protocol-"));
    server = startServer({ cwd: projectDir });
  });

  after(async () => {
    await server.close();
    await rm(projectDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test("echoes a supported 2025-11-25 request", async () => {
    const response = await initialize(server, "2025-11-25");
    assert.equal(response.result.protocolVersion, "2025-11-25");
    assert.equal(response.result.serverInfo.name, "omp-spec-kit");
    assert.deepEqual(response.result.capabilities, { tools: {} });
    assert.equal(typeof response.result.instructions, "string");
  });

  test("echoes a supported 2025-06-18 request", async () => {
    const response = await initialize(server, "2025-06-18");
    assert.equal(response.result.protocolVersion, "2025-06-18");
  });

  test("echoes a supported 2025-03-26 request", async () => {
    const response = await initialize(server, "2025-03-26");
    assert.equal(response.result.protocolVersion, "2025-03-26");
  });

  test("answers an unsupported 1999-01-01 request with 2025-11-25", async () => {
    const response = await initialize(server, "1999-01-01");
    assert.equal(response.result.protocolVersion, LATEST);
  });

  test("answers a request without protocolVersion with the latest supported 2025-11-25", async () => {
    const response = await initialize(server, undefined);
    assert.equal(response.result.protocolVersion, LATEST);
  });

  test("answers a non-string protocolVersion and absent params with 2025-11-25", async () => {
    const numeric = await server.request("initialize", { protocolVersion: 20251125, capabilities: {}, clientInfo: CLIENT_INFO });
    assert.equal(numeric.result.protocolVersion, LATEST);
    const bare = await server.request("initialize");
    assert.equal(bare.result.protocolVersion, LATEST);
  });

  test("rejects server/discover immediately so clients fall back to initialize", async () => {
    const response = await server.request("server/discover", {});
    assert.equal(response.error.code, -32601);
    assert.equal(response.result, undefined);
  });

  test("tools/list returns the ten tools", async () => {
    const response = await server.request("tools/list", {});
    const names = response.result.tools.map((tool) => tool.name);
    assert.equal(names.length, 10);
    assert.equal(new Set(names).size, 10);
    assert.ok(names.includes("spec_catalog"));
    assert.ok(names.includes("spec_patch"));
  });
});

describe("PACKAGE_ROOT_REFUSED keeps the process alive", () => {
  let projectDir;
  let server;

  before(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-package-root-"));
    // A corpus the server would happily serve if the refusal did not apply.
    await mkdir(path.join(projectDir, ".specs", "decoy"), { recursive: true });
    await writeFile(path.join(projectDir, ".specs", "decoy", "README.md"), "# Decoy\n");
    server = startServer({ cwd: projectDir, packageRoot: projectDir });
  });

  after(async () => {
    await server.close();
    await rm(projectDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test("initialize, ping and tools/list still answer", async () => {
    const initialized = await initialize(server, "2025-11-25");
    assert.equal(initialized.result.protocolVersion, "2025-11-25");
    assert.equal(initialized.result.serverInfo.name, "omp-spec-kit");
    const pong = await server.request("ping", {});
    assert.deepEqual(pong.result, {});
    const listed = await server.request("tools/list", {});
    assert.equal(listed.result.tools.length, 10);
  });

  test("tools/call returns a PACKAGE_ROOT_REFUSED error and serves no corpus", async () => {
    const response = await server.request("tools/call", {
      name: "spec_catalog",
      arguments: { view: "overview", specSlugs: ["decoy"] },
    });
    assert.equal(response.result, undefined);
    assert.match(response.error?.message ?? "", /PACKAGE_ROOT_REFUSED/u);
    assert.doesNotMatch(JSON.stringify(response), /decoy/u);
  });

  test("the process has not exited and initialize still answers after the refusal", async () => {
    assert.equal(server.child.exitCode, null, `server exited early; stderr:\n${server.stderr()}`);
    assert.equal(server.child.signalCode, null);
    const response = await initialize(server, "2025-06-18");
    assert.equal(response.result.protocolVersion, "2025-06-18");
  });
});

describe("without OMP_SPEC_KIT_PACKAGE_ROOT the same directory is served", () => {
  let projectDir;
  let server;

  before(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-served-"));
    await mkdir(path.join(projectDir, ".specs", "decoy"), { recursive: true });
    await writeFile(path.join(projectDir, ".specs", "decoy", "README.md"), "# Decoy\n");
    server = startServer({ cwd: projectDir });
  });

  after(async () => {
    await server.close();
    await rm(projectDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test("tools/call returns a tool result, not a refusal", async () => {
    await initialize(server, "2025-11-25");
    const response = await server.request("tools/call", {
      name: "spec_catalog",
      arguments: { view: "overview", specSlugs: ["decoy"] },
    });
    assert.equal(response.error, undefined, JSON.stringify(response));
    assert.equal(typeof response.result?.structuredContent, "object");
    assert.doesNotMatch(JSON.stringify(response), /PACKAGE_ROOT_REFUSED/u);
  });
});
