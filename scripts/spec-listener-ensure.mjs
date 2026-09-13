#!/usr/bin/env node
/**
 * Ensure the spec-graph writeback listener is running.
 *
 * Probes http://127.0.0.1:<port>/health?nonce=N; the answer counts as alive
 * only when it carries the HMAC health proof under the writeback token, so a
 * foreign process squatting the port cannot suppress the real listener. When
 * the probe fails the listener is spawned detached (logs to
 * ~/.omp/logs/spec-listener.log). Intended to be invoked by the agent before
 * relying on writeback, e.g. from a repository rule or an OMP hook.
 *
 * The listener requires a writeback token on every bind: on Docker Desktop a
 * loopback bind is still reachable from any container via
 * host.docker.internal. SPEC_WRITEBACK_TOKEN wins when set; otherwise a
 * persistent token is generated once at ~/.omp/spec-writeback-token and
 * reused across respawns. Paste that value into LISTENER_TOKEN inside the
 * tracker-side spec-writeback rule; without it events get 401 and the
 * periodic sweep remains the convergence path.
 *
 * Usage:
 *   node scripts/spec-listener-ensure.mjs [--port 8787] [--check]
 *     --check   probe only; exit 0 when the listener answers, 1 otherwise
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appendFileSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SYNC_SCRIPT = path.join(ROOT, "scripts", "spec-graph-sync.mjs");
const PROBE_TIMEOUT_MS = 2_000;
const STARTUP_WAIT_MS = 4_000;

function parseArgs(argv) {
  const args = { port: 8787, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port") args.port = Number(argv[++i]);
    else if (argv[i] === "--check") args.check = true;
  }
  return args;
}

/**
 * The probe must prove the answering process is THIS listener, not any process
 * that happens to return 200 on the port: a foreign squatter would otherwise
 * suppress the real listener and collect token-bearing /writeback posts. The
 * listener answers /health?nonce=N with proof = HMAC-SHA256(writebackToken,
 * "spec-graph-sync/health:" + N); without the shared secret the proof cannot
 * be forged, and the token itself never crosses the wire.
 */
async function probe(port, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const nonce = randomBytes(12).toString("hex");
    const response = await fetch(`http://127.0.0.1:${port}/health?nonce=${nonce}`, { signal: controller.signal });
    if (!response.ok) return false;
    const body = await response.json().catch(() => null);
    if (!body || body.ok !== true || body.service !== "spec-graph-sync") return false;
    if (typeof body.proof !== "string" || !/^[0-9a-f]{64}$/.test(body.proof)) return false;
    const expected = createHmac("sha256", token).update("spec-graph-sync/health:" + nonce, "utf8").digest();
    const actual = Buffer.from(body.proof, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const TOKEN_PATH = path.join(homedir(), ".omp", "spec-writeback-token");

/**
 * Returns the listener token: SPEC_WRITEBACK_TOKEN when set, else a stable
 * random token persisted under ~/.omp so respawns keep authenticating.
 */
function ensureWritebackToken() {
  const fromEnv = process.env.SPEC_WRITEBACK_TOKEN;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  try {
    const existing = readFileSync(TOKEN_PATH, "utf8").trim();
    if (existing.length >= 32) return existing;
  } catch {}
  const generated = randomBytes(24).toString("hex");
  mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  writeFileSync(TOKEN_PATH, generated + "\n", { mode: 0o600 });
  return generated;
}

function spawnListener(port, writebackToken) {
  const logDir = path.join(homedir(), ".omp", "logs");
  mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, "spec-listener.log");
  const fd = openSync(logPath, "a");
  appendFileSync(fd, `\n[${new Date().toISOString()}] ensure: spawning listener on :${port}\n`);
  const child = spawn(process.execPath, [SYNC_SCRIPT, "--serve", "--port", String(port)], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", fd, fd],
    env: { ...process.env, SPEC_WRITEBACK_TOKEN: writebackToken },
    windowsHide: true,
  });
  child.unref();
  return { pid: child.pid, logPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // The token is resolved before probing so the health proof can be verified;
  // a process that answers /health without the shared secret is a squatter,
  // not the listener.
  const writebackToken = ensureWritebackToken();
  if (await probe(args.port, writebackToken)) {
    console.log(JSON.stringify({ op: "ensure", status: "alive", port: args.port }));
    return;
  }
  if (args.check) {
    console.log(JSON.stringify({ op: "ensure", status: "down", port: args.port }));
    process.exitCode = 1;
    return;
  }
  if (!process.env.YOUTRACK_TOKEN && !process.env.YOUTRACK_PASSWORD) {
    console.error("spec-listener-ensure: YOUTRACK_TOKEN or YOUTRACK_PASSWORD is required to serve");
    process.exitCode = 2;
    return;
  }
  const { pid, logPath } = spawnListener(args.port, writebackToken);
  console.log(JSON.stringify({ op: "ensure", tokenFile: TOKEN_PATH, note: "LISTENER_TOKEN in spec-writeback.js must match this token" }));
  const deadline = Date.now() + STARTUP_WAIT_MS;
  while (Date.now() < deadline) {
    if (await probe(args.port, writebackToken)) {
      console.log(JSON.stringify({ op: "ensure", status: "spawned", pid, port: args.port, logPath }));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.error(JSON.stringify({ op: "ensure", status: "spawn-failed", pid, port: args.port, logPath }));
  process.exitCode = 3;
}

main().catch((error) => {
  console.error("spec-listener-ensure: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
