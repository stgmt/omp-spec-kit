/**
 * Codex PreToolUse guard for specification access.
 *
 * Codex blocks a tool call on exit code 2 (reason on stderr). The hook must
 * never crash: a crash is treated as "proceed" by the host, so every internal
 * error is converted into a deny.
 *
 * Path policy always runs. MCP authoring is allowed only for
 * `mcp__<registryServer>__spec_patch`, and only when config.toml declares the
 * registry as a streamable HTTP server (`url`), not a stdio `command`.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { toClassifierEvent } from "./normalize.mjs";

const MAX_STDIN_BYTES = 1024 * 1024;

function readJsonSafe(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Minimal reader for one `[mcp_servers.<name>]` table in config.toml. */
export function readCodexServer(configToml, serverName) {
  const lines = String(configToml).split(/\r?\n/u);
  const header = `[mcp_servers.${serverName}]`;
  const start = lines.findIndex((line) => line.trim() === header);
  if (start < 0) return null;
  const table = {};
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) break;
    const match = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/u.exec(trimmed);
    if (match) table[match[1]] = match[2];
  }
  return table;
}

export function registryTransportIsRemote({ codexHome, serverName }) {
  try {
    const toml = readFileSync(path.join(codexHome, "config.toml"), "utf8");
    const table = readCodexServer(toml, serverName);
    if (table === null) return false;
    if (table.command !== undefined) return false;
    return typeof table.url === "string" && /^"https?:\/\//u.test(table.url);
  } catch {
    return false;
  }
}

export function createCodexGuard({ home = homedir(), classifier, config = null }) {
  if (typeof classifier !== "function") throw new Error("SPEC_HOOK_FAILED: classifier is required");
  const guard = config ?? readJsonSafe(path.join(home, ".codex", "spec-kit-guard.json"));
  const serverName = typeof guard?.registryServer === "string" && guard.registryServer !== "" ? guard.registryServer : null;
  const remote = serverName !== null && registryTransportIsRemote({ codexHome: path.join(home, ".codex"), serverName });

  return {
    decide(payload) {
      try {
        if (typeof payload?.tool_name !== "string" || payload.tool_name === "") {
          return { block: true, reason: "SPEC_HOOK_FAILED: tool name is missing" };
        }
        const { event, root } = toClassifierEvent(payload, { registryServer: serverName ?? "" });
        const mcpCall = typeof payload?.tool_name === "string" && payload.tool_name.startsWith("mcp__");
        if (mcpCall && !remote) {
          return { block: true, reason: `REGISTRY_TRANSPORT_INVALID: mcp_servers.${serverName ?? "<unset>"} must be a streamable HTTP server` };
        }
        const decision = classifier(event, { root, allTools: null });
        if (decision?.action === "block") {
          return { block: true, reason: typeof decision.reason === "string" ? decision.reason : `SPEC_HOOK_BLOCKED: ${decision.code}` };
        }
        if (mcpCall && decision?.action !== "allow") {
          return { block: true, reason: "SPEC_HOOK_FAILED: MCP call was not authorized" };
        }
        return { block: false };
      } catch (error) {
        return { block: true, reason: `SPEC_HOOK_FAILED: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
  };
}

async function readStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_STDIN_BYTES) throw new RangeError(`stdin exceeds ${MAX_STDIN_BYTES} bytes`);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

async function main() {
  const text = await readStdin();
  if (text.trim() === "") throw new Error("empty hook input");
  const payload = JSON.parse(text);
  const { classifyToolCall } = await import(new URL("../../dist/enforcement/classifier.js", import.meta.url).href);
  const guard = createCodexGuard({ classifier: classifyToolCall });
  const decision = guard.decide(payload);
  if (decision.block) {
    process.stderr.write(`${decision.reason}\n`);
    process.exitCode = 2;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`SPEC_HOOK_FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
}
