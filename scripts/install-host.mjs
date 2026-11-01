#!/usr/bin/env node
/**
 * One installer entry point for the agent hosts.
 *
 *   node scripts/install-host.mjs --host claude  --url <http://host/mcp> --project owner/project [--workspace <dir>]
 *   node scripts/install-host.mjs --host codex   --url ... --project owner/project (delegates)
 *   node scripts/install-host.mjs --host opencode --url ... --project owner/project (delegates)
 *   node scripts/install-host.mjs --host omp     --url ... --project owner/project [--config <mcp.json>]
 *
 * `--project` is REQUIRED and has no fallback: the workspace record it writes
 * is the only thing that tells a session which project it belongs to. It is an
 * `owner/project` registry identity, never a filesystem path; auth stays in the
 * environment (`OMP_SPEC_REGISTRY_TOKEN`) exactly as before.
 *
 * The record lives at `<workspace>/.omp-spec-kit/project.json` and every host
 * reads it at call time, so switching a session's workspace switches its
 * project without restarting the MCP server.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProjectIdentity, writeProjectBinding } from "../src/enforcement/project-binding.js";

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
  const project = valueAfter(argv, "project");
  if (typeof project !== "string" || project.trim() === "") {
    throw new Error("--project owner/project is required: a session cannot infer its project from the endpoint");
  }
  if (!isProjectIdentity(project)) {
    throw new Error(`--project must be an owner/project registry identity, received ${JSON.stringify(project)}`);
  }
  const config = valueAfter(argv, "config");
  const workspace = path.resolve(valueAfter(argv, "workspace") ?? process.cwd());
  if (typeof url !== "string" || !/^https?:\/\/[^/]+\/mcp$/u.test(url)) {
    throw new Error("--url must be an http(s) endpoint ending in /mcp");
  }
  if (host === "claude" && valueAfter(argv, "token") !== null) {
    throw new Error("--token is not written to Claude config; set OMP_SPEC_REGISTRY_TOKEN in the environment instead");
  }
  return { host, url, token: typeof token === "string" ? token.trim() : token, project: project.trim(), config, workspace };
}

export function mergeClaudeMcpConfig({ configPath, url }) {
  const target = path.resolve(configPath);
  const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : {};
  const config = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers["omp-spec-kit"] = {
    type: "http",
    url,
    // Never persist the bearer token in a file that teams routinely commit.
    // The packaged plugin uses the same environment expansion. The project is
    // resolved per call from `.omp-spec-kit/project.json`, never from a header.
    headers: {
      Authorization: "Bearer ${OMP_SPEC_REGISTRY_TOKEN}",
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

export function mergeOmpMcpConfig({ configPath, url }) {
  const target = path.resolve(configPath);
  const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : {};
  const config = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  if (config.$schema === undefined) {
    config.$schema = "https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/src/config/mcp-schema.json";
  }
  config.mcpServers = config.mcpServers ?? {};
  // OMP-native config is the only place OMP expands `${VAR}`: a portable
  // plugin's `.mcp.json` keeps header values literal (OMP docs, "Portable
  // Agent Plugins"), so the plugin's own entry can never authenticate.
  config.mcpServers["omp-spec-kit"] = {
    type: "http",
    url,
    // No secret in the file: the token stays in the environment and the
    // removed `X-Spec-Project` header is never written back.
    headers: { Authorization: "Bearer ${OMP_SPEC_REGISTRY_TOKEN}" },
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
  const record = writeProjectBinding(parsed.workspace, parsed.project);
  if (parsed.host === "claude") {
    const target = parsed.config ?? path.join(parsed.workspace, ".mcp.json");
    mergeClaudeMcpConfig({ configPath: target, url: parsed.url });
    console.log(`Claude MCP config written: ${path.resolve(target)}`);
    console.log("Set OMP_SPEC_REGISTRY_TOKEN in the environment; the config references it and contains no secret.");
    console.log(`Project record written: ${record}`);
    return;
  }
  if (parsed.host === "codex") {
    delegate("install-codex-guard.mjs", argv);
    console.log(`Project record written: ${record}`);
    return;
  }
  if (parsed.host === "opencode") {
    delegate("install-opencode-guard.mjs", argv);
    console.log(`Project record written: ${record}`);
    return;
  }
  if (parsed.host === "omp") {
    const target = parsed.config ?? path.join(
      process.env.PI_CONFIG_DIR ? path.resolve(process.env.PI_CONFIG_DIR) : path.join(homedir(), ".omp"),
      "agent",
      "mcp.json",
    );
    mergeOmpMcpConfig({ configPath: target, url: parsed.url ?? process.env.OMP_SPEC_REGISTRY_URL });
    console.log(`OMP MCP config written: ${path.resolve(target)}`);
    console.log("Set OMP_SPEC_REGISTRY_TOKEN in the environment; the config references it and contains no secret.");
    console.log(`Project record written: ${record}`);
    console.log("The packaged plugin still needs linking through OMP's PluginManager for the spec access gate.");
    return;
  }
  console.log("unknown host");
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
