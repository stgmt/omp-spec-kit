import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = path.resolve(E2E_DIR, "..", "..");
export const PROJECT = "spec-auth-e2e";
export const COMPOSE_FILE = path.join(E2E_DIR, "compose.yml");

export const YT_URL = "http://127.0.0.1:8081";
export const SERVICE_URL = "http://127.0.0.1:8643";
const DEFAULT_CONFIG = path.join(E2E_DIR, "artifacts", "projects.json");

export function compose(args, { env = {}, allowFailure = false } = {}) {
  const result = spawnSync("docker", ["compose", "-p", PROJECT, "-f", COMPOSE_FILE, ...args], {
    cwd: REPO_ROOT,
    env: { SPEC_AUTH_E2E_CONFIG: DEFAULT_CONFIG, ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`docker compose ${args.join(" ")} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function composeEnv({ configPath }) {
  return { SPEC_AUTH_E2E_CONFIG: configPath };
}

export async function waitFor(url, { timeoutMs = 180_000, intervalMs = 2_000, accept = (response) => response.ok, label = url } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (accept(response)) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`timed out waiting for ${label}: ${lastError}`);
}

export function containerLogs(service, { tail = 200 } = {}) {
  const { stdout } = compose(["logs", "--no-color", "--tail", String(tail), service], { allowFailure: true });
  return stdout;
}
