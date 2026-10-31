#!/usr/bin/env node
/**
 * One installer entry point for the agent hosts.
 *
 *   node scripts/install-host.mjs --host claude  --url <http://host/mcp> [--project owner/project]
 *   node scripts/install-host.mjs --host codex   --url ... --token ...   (delegates)
 *   node scripts/install-host.mjs --host opencode --url ... --token ...  (delegates)
 *   node scripts/install-host.mjs --host omp     (prints the PluginManager.link step)
 *
 * Claude gets a project `.mcp.json`; Codex and OpenCode keep their dedicated
 * guard installers (hooks plus the remote MCP entry). OMP loads the packaged
 * plugin through its own PluginManager, so the CLI never writes OMP internals.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOSTS = new Set(["claude", "codex", "opencode", "omp"]);

function fail(message) {
  console.error(`install-host: ${message}`);
  process.exit(1);
}

function valueAfter(argv, name) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null;
}

export function parseHostArgs(argv, env = process.env) {
  const host = valueAfter(argv, "host");
  if (!HOSTS.has(host)) throw new Error("--host must be claude, codex, opencode, or omp");
  const url = valueAfter(argv, "url") ?? env.OMP_SPEC_REGISTRY_URL ?? null;
  const token = valueAfter(argv, "token") ?? env.OMP_SPEC_REGISTRY_TOKEN ?? null;
  const project = valueAfter(argv, "project") ?? env.OMP_SPEC_PROJECT ?? "stgmt/omp-spec-kit";
  const config = valueAfter(argv, "config");
  if (host !== "omp" && (typeof url !== "string" || !/^https?:\/\/[^/]+\/mcp$/u.test(url))) {
    throw new Error("--url must be an http(s) endpoint ending in /mcp");
  }
  if (host === "claude" && valueAfter(argv, "token") !== null) {
    throw new Error("--token is not written to Claude config; set OMP_SPEC_REGISTRY_TOKEN in the environment instead");
  }
  return { host, url, token: typeof token === "string" ? token.trim() : token, project, config };
}

export function mergeClaudeMcpConfig({ configPath, url, project }) {
  const target = path.resolve(configPath);
  const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : {};
  const config = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers["omp-spec-kit"] = {
    type: "http",
    url,
    // Never persist the bearer token in a file that teams routinely commit.
    // The packaged plugin uses the same environment expansion.
    headers: {
      Authorization: "Bearer ${OMP_SPEC_REGISTRY_TOKEN}",
      "X-Spec-Project": project,
    },
  };
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    const backup = `${target}.bak`;
    writeFileSync(backup, readFileSync(target), { mode: 0o600 });
    try {
      chmodSync(backup, 0o600);
    } catch {
      // Windows has no POSIX mode bits.
    }
  }
  writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(target, 0o600);
  } catch {
    // Windows has no POSIX mode bits; the file is still user-scoped.
  }
  return config.mcpServers["omp-spec-kit"];
}

function delegate(script, argv) {
  const passthrough = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--host") {
      index += 1;
      continue;
    }
    passthrough.push(argv[index]);
  }
  const result = spawnSync(process.execPath, [path.join(REPOSITORY_ROOT, "scripts", script), ...passthrough], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) fail(result.error.message);
  process.exitCode = result.status ?? 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const parsed = parseHostArgs(argv);
  if (parsed.host === "claude") {
    const target = parsed.config ?? path.join(process.cwd(), ".mcp.json");
    mergeClaudeMcpConfig({ configPath: target, url: parsed.url, project: parsed.project });
    console.log(`Claude MCP config written: ${path.resolve(target)}`);
    console.log("Set OMP_SPEC_REGISTRY_TOKEN in the environment; the config references it and contains no secret.");
    console.log("Restart Claude Code so the project-scoped server loads.");
    return;
  }
  if (parsed.host === "codex") {
    delegate("install-codex-guard.mjs", argv);
    return;
  }
  if (parsed.host === "opencode") {
    delegate("install-opencode-guard.mjs", argv);
    return;
  }
  console.log("OMP installs the packaged plugin through its own PluginManager:");
  console.log(`  new PluginManager(cwd).link("${path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit")}")`);
  console.log("The extension registers the spec access gate and the setup warning; no files are written by this CLI.");
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
