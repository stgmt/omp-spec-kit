// Shared world helpers for the v0.3 MCP adapter / extension registry BDD
// coverage (tests/features/spec-mcp.feature). Reuses the kernel contract
// helpers from kernel-world.mjs so the MCP parity assertions compare the
// spawned-server envelopes against the SAME pinned corpus loader pattern.
//
// Process discipline: MCP behavior is exercised by spawning the REAL
// `dist/mcp/server.js` as a newline-JSON-RPC subprocess; registry cardinality
// is exercised by spawning a fresh probe process that imports the REAL
// `dist/extension.js` through a mock pi host. Nothing from dist/ is ever
// imported in-process here.

import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import {
  KERNEL_SCHEMA_VERSION,
  buildKernelGraph,
  loadRealCorpusManifest,
  query,
  readRepositorySpecs,
  writeCorpus,
} from "./kernel-world.mjs";

export { KERNEL_SCHEMA_VERSION, buildKernelGraph, loadRealCorpusManifest, query, readRepositorySpecs, writeCorpus };

export const PLUGIN_VERSION = "0.3.0";
export const EXTENSION_SCHEMA_VERSION = "1";
export const EXTENSION_LABEL = "OMP Spec Kit";

// SCHEMA-11: exactly these eight read-only tools exist on the MCP surface.
export const MCP_TOOL_NAMES = Object.freeze([
  "spec_inventory",
  "spec_get_node",
  "spec_find_nodes",
  "spec_get_edges",
  "spec_trace",
  "spec_diagnostics",
  "spec_overview",
  "spec_markdown_inventory",
]);

// Canonical QueryEnvelope key set (sorted); every answer must carry exactly these.
export const QUERY_ENVELOPE_KEYS = Object.freeze(
  ["ok", "schemaVersion", "requestId", "operation", "graph", "page", "data", "error", "diagnostics"].sort(),
);

/**
 * Loads the fixture-manifest-pinned real corpus through the filesystem reader
 * (same pattern as the v0.2 kernel suite), builds ONE in-process kernel graph
 * used as the parity oracle for spawned-server answers, and returns the pinned
 * files so a byte-exact replica corpus can be planted for the server process.
 */
export async function loadPinnedCorpusGraph(repositoryRoot) {
  const manifest = await loadRealCorpusManifest(repositoryRoot);
  const read = await readRepositorySpecs({ root: repositoryRoot });
  const manifestPaths = new Set(manifest.documents.map((entry) => entry.path));
  const files = read.files.filter((file) => manifestPaths.has(file.path));
  if (files.length !== manifest.documents.length) {
    throw new Error(
      `pinned corpus drifted: manifest pins ${manifest.documents.length} documents, disk offered ${files.length}`,
    );
  }
  const built = buildKernelGraph({ files });
  if (built.graph.valid !== true) {
    throw new Error("pinned corpus must build a valid graph before MCP parity comparison");
  }
  return { manifest, graph: built.graph, files };
}

/**
 * Minimal newline-delimited JSON-RPC client bound to one spawned server
 * process. Requests are correlated by id; a stuck request rejects with the
 * server's collected stderr instead of hanging the suite.
 */
export function spawnMcpServer({ serverPath, root, cwd }) {
  const child = spawn(process.execPath, [serverPath], {
    cwd,
    env: { ...process.env, OMP_SPEC_KIT_ROOT: root },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  const pending = new Map();
  let nextId = 0;
  let stderrText = "";

  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  child.stderr.on("data", (chunk) => {
    stderrText += chunk.toString("utf8");
  });

  const reader = createInterface({ input: child.stdout });
  reader.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      return;
    }
    const entry = pending.get(message.id);
    if (entry !== undefined) {
      pending.delete(message.id);
      clearTimeout(entry.timer);
      entry.resolve(message);
    }
  });

  function request(method, params, timeoutMs = 30000) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after ${timeoutMs}ms; server stderr:\n${stderrText}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`, (error) => {
        if (error !== undefined && error !== null) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        }
      });
    });
  }

  function notify(method, params) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async function close() {
    reader.close();
    if (child.stdin.writable) child.stdin.end();
    const settledOrTimeout = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve(null), 5000))]);
    if (settledOrTimeout === null) {
      try {
        child.kill("SIGKILL");
      } catch {
        // already gone
      }
      await exited;
    }
    return { stderr: stderrText };
  }

  return { child, request, notify, close };
}

// Generated probe source. Runs as its own node process: imports the built
// extension, registers it against a mock pi host whose zod surface records a
// structural snapshot, and prints one JSON receipt. Never executed in-process.
const PROBE_SCRIPT = `\
import { pathToFileURL } from "node:url";

function schemaNode(kind, properties = {}) {
  const state = { kind, ...properties };
  return {
    state,
    optional() { state.optional = true; return this; },
    int() { state.int = true; return this; },
    min(value) { state.min = value; return this; },
    max(value) { state.max = value; return this; },
    strict() { state.strict = true; return this; },
  };
}

function schemaSnapshot(schema) {
  const snapshot = { ...schema.state };
  if (snapshot.shape) {
    snapshot.shape = Object.fromEntries(
      Object.entries(snapshot.shape).map(([name, child]) => [name, schemaSnapshot(child)]),
    );
  }
  if (snapshot.members) {
    snapshot.members = snapshot.members.map((member) => schemaSnapshot(member));
  }
  if (snapshot.items) {
    snapshot.items = schemaSnapshot(snapshot.items);
  }
  return snapshot;
}

function makeHost() {
  const registration = { labels: [], tools: [] };
  return {
    registration,
    pi: {
      zod: {
        literal: (value) => schemaNode("literal", { value }),
        number: () => schemaNode("number"),
        boolean: () => schemaNode("boolean"),
        string: () => schemaNode("string"),
        null: () => schemaNode("null"),
        union: (nodes) => schemaNode("union", { members: nodes.map(schemaSnapshot) }),
        enum: (values) => schemaNode("enum", { values }),
        array: (items) => schemaNode("array", { items: schemaSnapshot(items) }),
        object: (shape) => schemaNode("object", { shape }),
      },
      setLabel: (label) => registration.labels.push(label),
      registerTool: (tool) => registration.tools.push(tool),
    },
  };
}

const extensionPath = process.argv[2];
if (!extensionPath) {
  throw new Error("usage: extension-registry-probe <extension-path>");
}
const extensionModule = await import(pathToFileURL(extensionPath).href);
const { pi, registration } = makeHost();
extensionModule.default(pi);
process.stdout.write(JSON.stringify({
  processCwd: process.cwd(),
  exports: {
    pluginVersion: extensionModule.PLUGIN_VERSION,
    schemaVersion: extensionModule.SCHEMA_VERSION,
    defaultType: typeof extensionModule.default,
  },
  labels: registration.labels,
  tools: registration.tools.map((tool) => ({
    name: tool.name,
    label: tool.label,
    approval: tool.approval,
    strict: tool.strict,
    executeType: typeof tool.execute,
    parameters: schemaSnapshot(tool.parameters),
  })),
}) + "\\n");
`;

/**
 * Spawns a FRESH node process that imports the built extension and registers
 * it against a mock pi host, returning the parsed registration receipt. The
 * generated probe file lives in its own temp directory that is removed
 * unconditionally, success or failure.
 */
export async function runExtensionProbe({ extensionPath, cwd }) {
  const probeDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-ext-probe-"));
  let receipt;
  try {
    const probePath = path.join(probeDir, "extension-registry-probe.mjs");
    await writeFile(probePath, PROBE_SCRIPT);
    receipt = spawnSync(process.execPath, [probePath, String(extensionPath)], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout: 60000,
    });
  } finally {
    await rm(probeDir, { recursive: true, force: true, maxRetries: 3 });
  }
  if (receipt.error) throw receipt.error;
  if (receipt.signal !== null) throw new Error(`extension probe was terminated by ${receipt.signal}`);
  if (receipt.status !== 0) {
    throw new Error(`extension probe exited ${receipt.status}: ${receipt.stderr}`);
  }
  if (receipt.stderr !== "") throw new Error(`extension probe wrote stderr: ${receipt.stderr}`);
  return JSON.parse(receipt.stdout);
}

export function createMcpState() {
  return {
    repositoryRoot: null,
    manifest: null,
    graph: null,
    server: null,
    probe: null,
    extensionPath: null,
    initializeResult: null,
    toolList: null,
    lastToolCall: null,
    lastArgs: null,
    failure: null,
    overviewResponse: null,
    specsBefore: null,
    bareSnapshot: null,
    tempRoot: null,
    async cleanup() {
      if (this.server !== null) {
        const server = this.server;
        this.server = null;
        await server.close();
      }
      if (this.tempRoot !== null) {
        await rm(this.tempRoot, { recursive: true, force: true, maxRetries: 3 });
        this.tempRoot = null;
      }
    },
  };
}
