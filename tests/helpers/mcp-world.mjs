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
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import {
  KERNEL_SCHEMA_VERSION,
  buildKernelGraph,
  loadFrozenRealCorpus,
  loadRealCorpusManifest,
  query,
  readRepositorySpecs,
  sha256Hex,
  writeCorpus,
} from "./kernel-world.mjs";

export {
  KERNEL_SCHEMA_VERSION,
  buildKernelGraph,
  loadFrozenRealCorpus,
  loadRealCorpusManifest,
  query,
  readRepositorySpecs,
  sha256Hex,
  writeCorpus,
};

export const PLUGIN_VERSION = "0.4.1";
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
  ["ok", "schemaVersion", "requestId", "operation", "graph", "page", "data", "error", "diagnostics", "provenance"].sort(),
);

function sameBytes(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/**
 * Loads the immutable fixture bytes through the filesystem reader, builds one
 * in-process kernel parity oracle, and returns those same frozen files for the
 * byte-exact spawned-server replica. Mutable repository .specs files never
 * participate in this comparison.
 */
export async function loadPinnedCorpusGraph(repositoryRoot) {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus-manifest.json"), "utf8"));
  if (manifest.schema !== "omp-spec-kit-authoring-real-corpus@1" || manifest.documentCount !== 45) {
    throw new Error("current authoring corpus manifest must contain 45 documents");
  }
  const fixtureRoot = path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus");
  const read = await readRepositorySpecs({ root: fixtureRoot });
  if (read.error) throw new Error("current corpus reader failed: " + read.error.code);
  if (read.files.length !== manifest.documents.length) {
    throw new Error("current corpus reader offered " + read.files.length + ", expected " + manifest.documents.length + " files");
  }
  const byPath = new Map(manifest.documents.map((file) => [file.path, file]));
  for (const file of read.files) {
    const pinned = byPath.get(file.path);
    if (pinned === undefined) throw new Error("current corpus reader returned an unknown file: " + file.path);
    if (sha256Hex(file.bytes) !== pinned.sha256 || file.bytes.byteLength !== pinned.bytes) throw new Error("current corpus reader byte drifted: " + file.path);
  }
  const built = buildKernelGraph({ files: read.files });
  if (built.graph.valid !== true) throw new Error("current corpus must build a valid graph before MCP parity comparison");
  return { manifest, graph: built.graph, files: read.files, fixtureRoot };
}

/**
 * Minimal newline-delimited JSON-RPC client bound to one spawned server
 * process. Requests are correlated by id; a stuck request rejects with the
 * server's collected stderr instead of hanging the suite.
 */
export function spawnMcpServer({ command = process.execPath, args, serverPath, root, cwd, env = {} }) {
  const childEnv = { ...process.env, ...env };
  if (root === undefined) delete childEnv.OMP_SPEC_KIT_ROOT;
  else childEnv.OMP_SPEC_KIT_ROOT = root;
  const child = spawn(command, args ?? (serverPath ? [serverPath] : []), {
    cwd,
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  const pending = new Map();
  const frames = [];
  const nonProtocolLines = [];
  let nextId = 0;
  let stderrText = "";

  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
    child.once("error", (error) => resolve({ error }));
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
      nonProtocolLines.push(line);
      return;
    }
    if (message?.jsonrpc !== "2.0") {
      nonProtocolLines.push(line);
      return;
    }
    frames.push(message);
    const entry = pending.get(message.id);
    if (entry !== undefined) {
      pending.delete(message.id);
      clearTimeout(entry.timer);
      entry.resolve(message);
    }
  });

  function sendFrame(frame, timeoutMs = 30000) {
    const id = frame?.id;
    if (id === undefined) throw new Error("sendFrame requires an id");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request id ${JSON.stringify(id)} timed out after ${timeoutMs}ms; server stderr:\n${stderrText}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify(frame)}\n`, (error) => {
        if (error !== undefined && error !== null) {
          clearTimeout(timer);
          pending.delete(id);
          reject(new Error(stderrText.trim() || error.message));
        }
      });
    });
  }

  function sendRaw(line, id, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`raw MCP frame for id ${JSON.stringify(id)} timed out after ${timeoutMs}ms; server stderr:\n${stderrText}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${line}\n`, (error) => {
        if (error !== undefined && error !== null) {
          clearTimeout(timer);
          pending.delete(id);
          reject(new Error(stderrText.trim() || error.message));
        }
      });
    });
  }

  function request(method, params, timeoutMs = 30000) {
    return sendFrame({ jsonrpc: "2.0", id: ++nextId, method, params }, timeoutMs);
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

  return { child, request, notify, sendFrame, sendRaw, close, frames, nonProtocolLines };
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
        unknown: () => schemaNode("unknown"),
      },
      setLabel: (label) => registration.labels.push(label),
      registerTool: (tool) => registration.tools.push(tool),
    },
  };
}

const extensionPath = process.argv[2];
if (!extensionPath) {
  throw new Error("usage: extension-registry-probe <extension-path> [queries-json]");
}
const queries = process.argv[3] ? JSON.parse(process.argv[3]) : [];
const extensionModule = await import(pathToFileURL(extensionPath).href);
const { pi, registration } = makeHost();
extensionModule.default(pi);
const queryResults = [];
for (const query of queries) {
  if (!query || typeof query.name !== "string") throw new Error("query probe entries require a tool name");
  const tool = registration.tools.find((candidate) => candidate.name === query.name);
  if (tool === undefined) throw new Error("query probe tool not registered: " + query.name);
  const result = await tool.execute(
    "probe-" + query.name,
    query.params ?? {},
    undefined,
    undefined,
    { cwd: query.cwd },
  );
  queryResults.push({ name: query.name, result });
}
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
  queryResults,
}) + "\\n");
`;

/**
 * Spawns a FRESH node process that imports the built extension and registers
 * it against a mock pi host, returning the parsed registration receipt. The
 * generated probe file lives in its own temp directory that is removed
 * unconditionally, success or failure.
 */
export async function runExtensionProbe({ extensionPath, cwd, env = {}, queries = [] }) {
  const probeDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-ext-probe-"));
  let receipt;
  try {
    const probePath = path.join(probeDir, "extension-registry-probe.mjs");
    await writeFile(probePath, PROBE_SCRIPT);
    const childEnv = { ...process.env, ...env };
    if (!Object.prototype.hasOwnProperty.call(env, "OMP_SPEC_KIT_ROOT")) {
      delete childEnv.OMP_SPEC_KIT_ROOT;
    }
    receipt = spawnSync(process.execPath, [probePath, String(extensionPath), JSON.stringify(queries)], {
      cwd,
      env: childEnv,
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

export async function copyPluginPackage(repositoryRoot, destination) {
  await cp(path.join(repositoryRoot, "plugins", "omp-spec-kit"), destination, {
    recursive: true,
    dereference: false,
    errorOnExist: true,
    force: false,
  });
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
    provenanceOverrideRoot: null,
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
      if (this.provenanceOverrideRoot !== null) {
        await rm(this.provenanceOverrideRoot, { recursive: true, force: true, maxRetries: 3 });
        this.provenanceOverrideRoot = null;
      }
    },
  };
}
