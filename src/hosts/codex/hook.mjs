/**
 * Codex PreToolUse guard for specification access.
 *
 * Codex blocks a tool call on exit code 2 (reason on stderr). The hook must
 * never crash: a crash is treated as "proceed" by the host, so every internal
 * error is converted into a deny.
 *
 * Path policy always runs. MCP authoring is allowed only for
 * `mcp__<registryServer>__spec_*`, and only when config.toml declares the
 * registry as a streamable HTTP server (`url`), not a stdio `command`.
 *
 * Session project: a registry spec call that omits `project` receives this
 * workspace's recorded project (`<cwd>/.omp-spec-kit/project.json`) through
 * `updatedInput` — Codex honors `permissionDecision:"allow" + updatedInput`
 * from `codex-cli 0.141.0` (see `caps.mjs`). On an older build the hook denies
 * with `PROJECT_INJECTION_UNAVAILABLE` instead of letting an unattached call
 * through; a workspace with no record is denied with `PROJECT_REQUIRED`.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRequiredMessage } from "../../enforcement/project-binding.js";
import { codexSupportsUpdatedInput } from "./caps.mjs";
import { toClassifierEvent } from "./normalize.mjs";

const MAX_STDIN_BYTES = 1024 * 1024;

// Codex 0.166 ignores exit code 2 when the hook also writes JSON, and a bare
// non-zero exit fails open. Older Codex (0.144) blocks on exit 2 and did not
// parse the JSON deny shape. Detect the managed CLI package version so both
// hosts get a blocking answer.
function supportsJsonDeny() {
  const root = process.env.CODEX_MANAGED_PACKAGE_ROOT;
  if (typeof root !== "string" || root.length === 0) return false;
  try {
    const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
    const [major, minor] = String(version).split(".").map((part) => Number(part));
    return major > 0 || (major === 0 && minor >= 166);
  } catch {
    return false;
  }
}

function deny(reason) {
  if (supportsJsonDeny()) {
    process.stdout.write(JSON.stringify({
      decision: "block",
      reason,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }) + "\n");
    return;
  }
  try {
    process.stderr.write(`${reason}\n`);
  } catch {
    // fd 2 closed: the exit code still denies the call.
  }
  process.exitCode = 2;
}

/** Allow the call with replacement execution input (Codex >= 0.141.0). */
function allowWithInput(input, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: reason,
      updatedInput: input,
    },
  }) + "\n");
}

// A closed fd 2 emits an asynchronous stream error; without a listener the
// process exits 1 instead of denying with 2.
process.stderr.on("error", () => {});

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
    /**
     * @returns {{block: boolean, reason?: string, input?: Record<string, unknown>}}
     *   `input` is the replacement execution input the hook must emit; when
     *   present the caller needs `updatedInput` support.
     */
    decide(payload) {
      try {
        if (typeof payload?.tool_name !== "string" || payload.tool_name === "") {
          return { block: true, reason: "SPEC_HOOK_FAILED: tool name is missing" };
        }
        const { event, root, registrySpecCall, project, source } = toClassifierEvent(payload, {
          registryServer: serverName ?? "",
        });
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
        if (registrySpecCall !== true) return { block: false };
        if (source === "explicit") return { block: false };
        if (project === null) return { block: true, reason: projectRequiredMessage(root) };
        return { block: false, input: { ...(payload.tool_input ?? {}), project } };
      } catch (error) {
        return { block: true, reason: `SPEC_HOOK_FAILED: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
  };
}

/** Emit the guard decision in the host's contract. */
export function emitDecision(decision, { supportsUpdatedInput = codexSupportsUpdatedInput } = {}) {
  if (decision.block) {
    deny(decision.reason);
    return;
  }
  if (decision.input === undefined) return;
  if (!supportsUpdatedInput()) {
    deny(
      [
        "PROJECT_INJECTION_UNAVAILABLE: this Codex build ignores PreToolUse updatedInput, so the hook cannot attach the workspace project.",
        "Use codex-cli >= 0.141.0, or pass the project explicitly on the call.",
      ].join("\n"),
    );
    return;
  }
  allowWithInput(decision.input, "omp-spec-kit attached this workspace's project");
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
  emitDecision(guard.decide(payload));
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    deny(`SPEC_HOOK_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  });
}
