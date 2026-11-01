/**
 * Codex SessionStart adapter: emit the shared setup warning once per session.
 *
 * Codex runs the command with a JSON payload on stdin, like the PreToolUse
 * hook. The diagnostic is best-effort: output on stdout is advisory, and every
 * failure exits 0 so a broken check cannot break the session.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setupWarning } from "./setup-warning.js";
import { registryTransportIsRemote } from "./hook.mjs";

const MAX_STDIN_BYTES = 1024 * 1024;

export function codexConfigured({ home = homedir() } = {}) {
  const codexHome = path.join(home, ".codex");
  try {
    const guard = JSON.parse(readFileSync(path.join(codexHome, "spec-kit-guard.json"), "utf8"));
    const serverName = guard?.registryServer;
    if (typeof serverName !== "string" || serverName.length === 0) return false;
    return registryTransportIsRemote({ codexHome, serverName });
  } catch {
    return false;
  }
}

export function warningForPayload(payload = {}, { home, env = process.env } = {}) {
  const root = typeof payload?.cwd === "string" && payload.cwd.length > 0 ? payload.cwd : process.cwd();
  return setupWarning({ root, env, configured: codexConfigured({ home }) });
}

async function readStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_STDIN_BYTES) return "";
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

async function main() {
  const text = await readStdin();
  let payload = {};
  try {
    payload = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    payload = {};
  }
  const warning = warningForPayload(payload);
  if (warning !== "") process.stdout.write(`${warning}\n`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch(() => {}).finally(() => {
    process.exitCode = 0;
  });
}
