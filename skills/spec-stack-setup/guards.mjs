/**
 * Host-guard installation for the local demo stack.
 *
 * A guard install must never fail the stack setup: the stack is already
 * running by phase 9, and a host that points its global agent config at a
 * different registry is a deliberate conflict, not a setup failure. The
 * caller reports a skip with the installer's reason and keeps going.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function firstLine(text, limit = 400) {
  return String(text ?? "").trim().split(/\r?\n/u)[0].slice(0, limit);
}

function runInstaller({ script, token, url, repoRoot, run }) {
  return run(process.execPath, [path.join(repoRoot, script), "--url", url], {
    env: { ...process.env, OMP_SPEC_REGISTRY_TOKEN: token },
    encoding: "utf8",
    timeout: 120_000,
  });
}

function outcome(result, home, label) {
  if (result.status === 0) return { status: "installed", path: home, detail: null };
  return {
    status: "skipped",
    path: home,
    detail: firstLine(result.stderr || result.stdout) ||
      `${label} installer exited with code ${result.status}`,
  };
}

export function installOpenCodeGuard({
  token,
  url,
  repoRoot,
  homeDir = os.homedir(),
  run = spawnSync,
}) {
  const configDir = path.join(homeDir, ".config", "opencode");
  if (!existsSync(configDir)) return { status: "absent", path: null, detail: null };
  const result = runInstaller({
    script: path.join("scripts", "install-opencode-guard.mjs"),
    token,
    url,
    repoRoot,
    run,
  });
  return outcome(result, configDir, "OpenCode");
}

export function installCodexGuard({
  token,
  url,
  repoRoot,
  homeDir = os.homedir(),
  run = spawnSync,
}) {
  const codexHome = path.join(homeDir, ".codex");
  if (!existsSync(codexHome)) return { status: "absent", path: null, detail: null };
  const result = runInstaller({
    script: path.join("scripts", "install-codex-guard.mjs"),
    token,
    url,
    repoRoot,
    run,
  });
  return outcome(result, codexHome, "Codex");
}
