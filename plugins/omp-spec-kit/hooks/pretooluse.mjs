import { writeSync } from "node:fs";
import { toClassifierEvent } from "./normalize.mjs";

// Claude Code PreToolUse hook: exit 0 with no output allows the call, exit 2
// with the reason on stderr blocks it. Nothing is ever written to stdout, and
// every failure path blocks (fail closed).
const MAX_STDIN_BYTES = 1024 * 1024;
const CLASSIFIER_URL = new URL("../dist/enforcement/classifier.js", import.meta.url).href;

// A closed fd 2 makes the stream emit an asynchronous error event; without a
// listener Node kills the process with exit 1 instead of the deny exit code.
process.stderr.on("error", () => {});

function writeStderr(text) {
  try {
    writeSync(2, text);
    return;
  } catch {
    // fd 2 may be closed by the host; fall through to the stream object.
  }
  try {
    process.stderr.write(text);
  } catch {
    // Both sinks are closed: the exit code is the only remaining signal.
  }
}

function block(reason) {
  writeStderr(`${reason}\n`);
  process.exitCode = 2;
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
  const hookInput = JSON.parse(text);
  const { event, root } = toClassifierEvent(hookInput);
  const { classifyToolCall } = await import(CLASSIFIER_URL);
  const decision = classifyToolCall(event, { root });
  if (decision?.action === "block") {
    block(typeof decision.reason === "string" && decision.reason !== "" ? decision.reason : `SPEC_HOOK_BLOCKED: ${decision.code ?? "blocked"}`);
    return;
  }
  if (decision?.action !== "allow" && decision?.action !== "continue") {
    throw new Error("classifier returned no decision");
  }
}

try {
  await main();
} catch (error) {
  block(`SPEC_HOOK_FAILED: ${error instanceof Error ? error.message : String(error)}`);
}
