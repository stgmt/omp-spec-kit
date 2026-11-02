#!/usr/bin/env node
/**
 * One command that reports — and on `--fix`, repairs — the omp-spec-kit
 * install of every agent host on this machine.
 *
 *   node scripts/host-delivery.mjs                 audit only, exit 1 on drift
 *   node scripts/host-delivery.mjs --fix           repair, then audit again
 *   node scripts/host-delivery.mjs --host omp,claude
 *
 * Each host has two independent halves and both are checked, because a host
 * can hold the current version and still fail to reach the registry:
 *
 *   - the installed copy: version it reports versus this repository, plus a
 *     stamp digest so a half-applied upgrade shows up as `edited`;
 *   - the host config: entry present, URL matches, no removed `X-Spec-Project`
 *     header, no literal token where an environment reference belongs.
 *
 * `--project` is only needed for a repair: the audit reads the workspace
 * record `<workspace>/.omp-spec-kit/project.json` and never writes it.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PLUGIN_VERSION } from "../src/adapters/plugin-version.js";
import { isProjectIdentity } from "../src/enforcement/project-binding.js";
import { readCodexServer } from "../src/hosts/codex/hook.mjs";
import { inspectCopy } from "./install-stamp.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOSTS = Object.freeze(["omp", "claude", "codex", "opencode"]);
const ENV_NAME = "OMP_SPEC_REGISTRY_TOKEN";
const URL_ENV_NAME = "OMP_SPEC_REGISTRY_URL";
const URL_ENV_REFERENCE = `\${${URL_ENV_NAME}}`;
const ENV_REFERENCE = `Bearer \${${ENV_NAME}}`;
const OPENCODE_ENV_REFERENCE = `Bearer {env:${ENV_NAME}}`;
const LITERAL_BEARER = /^Bearer\s+[A-Za-z0-9._~+/=-]{16,}$/u;
const ENV_BEARER = /^Bearer\s+(\$\{|\{env:)/u;

function flag(argv, name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
}

export function parseArgs(argv, env = process.env) {
  const requested = flag(argv, "host", HOSTS.join(","))
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  for (const host of requested) {
    if (!HOSTS.includes(host)) throw new Error(`--host must be a comma list of ${HOSTS.join(", ")}; received ${host}`);
  }
  const explicitUrl = flag(argv, "url", null);
  const url = explicitUrl ?? env.OMP_SPEC_REGISTRY_URL ?? null;
  const project = flag(argv, "project", null);
  if (project !== null && !isProjectIdentity(project)) {
    throw new Error(`--project must be an owner/project registry identity, received ${JSON.stringify(project)}`);
  }
  return {
    hosts: requested,
    fix: argv.includes("--fix"),
    url,
    urlSource: explicitUrl !== null ? "--url" : url !== null ? "$" + "OMP_SPEC_REGISTRY_URL" : null,
    project,
    workspace: path.resolve(flag(argv, "workspace", process.cwd())),
  };
}

/** A copy reports its own version even when it carries no stamp. */
function readCopyVersion(root) {
  const file = path.join(root, "dist", "adapters", "plugin-version.js");
  if (!existsSync(file)) return null;
  const match = /PLUGIN_VERSION = "([^"]+)"/u.exec(readFileSync(file, "utf8"));
  return match === null ? null : match[1];
}

function readJson(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Problems shared by every HTTP MCP entry. The registry refuses the removed
 * project header, and a literal bearer token in a file that gets copied or
 * committed is the failure this audit exists to catch.
 */
export function auditEntry(entry, { url = null, envReference = ENV_REFERENCE } = {}) {
  if (entry === null || entry === undefined) return ["no entry"];
  const problems = [];
  if (typeof entry !== "object" || Array.isArray(entry)) return ["entry is not an object"];
  if (typeof entry.command === "string") problems.push("entry launches a command instead of an HTTP endpoint");
  // Hosts may point at the environment instead of a literal; OMP and Claude
  // both expand `${VAR}` at load time, so that form is a valid target.
  if (url !== null && entry.url !== url && entry.url !== URL_ENV_REFERENCE) {
    problems.push(`url is ${JSON.stringify(entry.url ?? null)}, expected ${url}`);
  }
  const headers = entry.headers ?? {};
  if (typeof headers !== "object" || Array.isArray(headers)) {
    problems.push("headers is not an object");
  } else {
    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === "x-spec-project") problems.push("sends the removed X-Spec-Project header");
      if (typeof value !== "string") continue;
      if (LITERAL_BEARER.test(value)) problems.push(`${name} embeds a literal token`);
      else if (/^Bearer\s/u.test(value) && !ENV_BEARER.test(value)) problems.push(`${name} is not an environment reference`);
      else if (/^Bearer\s/u.test(value) && value !== envReference && name.toLowerCase() === "authorization") {
        problems.push(`${name} references ${value.replace(/^Bearer\s/u, "")}, expected ${envReference.replace(/^Bearer\s/u, "")}`);
      }
    }
  }
  return problems;
}

function tomlUnquote(value) {
  const match = /^"([^"]*)"$/u.exec(String(value ?? "").trim());
  return match === null ? null : match[1];
}

/** Codex keeps its entry in TOML, where headers are an inline table. */
export function auditCodexEntry(table, { url = null } = {}) {
  if (table === null) return ["no [mcp_servers] entry"];
  const problems = [];
  if (table.command !== undefined) problems.push("entry launches a command instead of an HTTP endpoint");
  const entryUrl = tomlUnquote(table.url);
  if (url !== null && entryUrl !== url && table.url !== URL_ENV_REFERENCE) {
    problems.push(`url is ${JSON.stringify(entryUrl ?? table.url)}, expected ${url}`);
  }
  const envVar = tomlUnquote(table.bearer_token_env_var);
  if (envVar !== ENV_NAME) problems.push(`bearer_token_env_var is ${JSON.stringify(envVar)}, expected ${ENV_NAME}`);
  const headers = table.http_headers === undefined ? "" : String(table.http_headers);
  if (/x-spec-project/iu.test(headers)) problems.push("sends the removed X-Spec-Project header");
  if (/Bearer\s/iu.test(headers) && !/Bearer\s+(\$\{|\{env:)/u.test(headers)) problems.push("http_headers embeds a literal token");
  return problems;
}

function hostPaths() {
  const ompHome = process.env.PI_CONFIG_DIR ? path.resolve(process.env.PI_CONFIG_DIR) : path.join(homedir(), ".omp");
  return {
    omp: {
      config: path.join(ompHome, "agent", "mcp.json"),
      plugins: path.join(ompHome, "plugins", "node_modules", "omp-spec-kit"),
    },
    claude: {
      workspaceConfig: null,
      homeConfig: path.join(homedir(), ".claude.json"),
    },
    codex: {
      home: path.join(homedir(), ".codex"),
      config: path.join(homedir(), ".codex", "config.toml"),
      copy: path.join(homedir(), ".codex", "spec-kit-guard"),
    },
    opencode: {
      config: path.join(homedir(), ".config", "opencode", "opencode.json"),
      copy: path.join(homedir(), ".config", "opencode", "plugins", "omp-spec-kit"),
    },
  };
}

function cliJson(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout: 120000 });
  if (result.error || result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function auditOmp({ paths, url }) {
  const config = readJson(paths.omp.config);
  const problems = auditEntry(config?.mcpServers?.["omp-spec-kit"], { url });
  const listed = cliJson("omp", ["plugin", "list", "--json"]);
  const entry = (listed?.npm ?? []).find((candidate) => candidate?.name === "omp-spec-kit") ?? null;
  const version = entry?.version ?? null;
  return {
    host: "omp",
    configPath: paths.omp.config,
    problems,
    version,
    versionOk: version === PLUGIN_VERSION,
    note: entry?.path === undefined ? "plugin not installed" : null,
  };
}

function auditClaude({ paths, url }) {
  const listed = cliJson("claude", ["plugin", "list", "--json"]);
  const entry = (Array.isArray(listed) ? listed : []).find((candidate) => candidate?.id === "omp-spec-kit@omp-spec-kit") ?? null;
  const installPath = entry?.installPath ?? null;
  const candidates = [path.join(paths.claude.homeConfig)];
  const problems = [];
  const workspaceConfig = path.join(process.cwd(), ".mcp.json");
  if (existsSync(workspaceConfig)) candidates.push(workspaceConfig);
  let inspected = null;
  for (const file of candidates) {
    const config = readJson(file);
    if (config?.mcpServers?.["omp-spec-kit"] !== undefined) {
      inspected = file;
      problems.push(...auditEntry(config.mcpServers["omp-spec-kit"], { url }).map((problem) => `${path.basename(file)}: ${problem}`));
    }
  }
  // The packaged plugin carries its own entry; it is the one Claude loads
  // when no host-level config overrides it.
  if (inspected === null && installPath !== null) {
    const packaged = readJson(path.join(installPath, ".mcp.json"));
    if (packaged?.mcpServers?.["omp-spec-kit"] !== undefined) {
      inspected = path.join(installPath, ".mcp.json");
      problems.push(
        ...auditEntry(packaged.mcpServers["omp-spec-kit"], { url }).map((problem) => `plugin .mcp.json: ${problem}`),
      );
    }
  }
  return {
    host: "claude",
    configPath: inspected,
    problems,
    version: entry?.version ?? null,
    versionOk: entry?.version === PLUGIN_VERSION,
    note: entry === null ? "plugin not installed" : null,
  };
}

function auditCodex({ paths, url }) {
  const text = existsSync(paths.codex.config) ? readFileSync(paths.codex.config, "utf8") : "";
  const problems = auditCodexEntry(readCodexServer(text, "spec_registry"), { url });
  const copy = inspectCopy(paths.codex.copy, PLUGIN_VERSION);
  if (copy.state !== "current") problems.push(`installed copy is ${copy.state}`);
  return {
    host: "codex",
    configPath: paths.codex.config,
    problems,
    version: copy.version ?? readCopyVersion(paths.codex.copy),
    versionOk: copy.state === "current",
    note: copy.state === "unstamped" ? "copy has no stamp; reinstall to record it" : null,
  };
}

function auditOpenCode({ paths, url }) {
  const config = readJson(paths.opencode.config);
  const problems = auditEntry(config?.mcp?.["spec-registry"], { url, envReference: OPENCODE_ENV_REFERENCE });
  const copy = inspectCopy(paths.opencode.copy, PLUGIN_VERSION);
  if (copy.state !== "current") problems.push(`installed copy is ${copy.state}`);
  return {
    host: "opencode",
    configPath: paths.opencode.config,
    problems,
    version: copy.version ?? readCopyVersion(paths.opencode.copy),
    versionOk: copy.state === "current",
    note: copy.state === "unstamped" ? "copy has no stamp; reinstall to record it" : null,
  };
}

const AUDITS = { omp: auditOmp, claude: auditClaude, codex: auditCodex, opencode: auditOpenCode };

function resolveProject(options) {
  if (options.project !== null) return options.project;
  const record = readJson(path.join(options.workspace, ".omp-spec-kit", "project.json"));
  const project = typeof record?.project === "string" ? record.project : null;
  return project !== null && isProjectIdentity(project) ? project : null;
}

/** Repairs go through the installers, never through hand-written config. */
function repair(host, { url, project, workspace }) {
  const shared = ["--url", url, "--project", project, "--workspace", workspace];
  const plans = {
    omp: ["install-host.mjs", ["--host", "omp", ...shared]],
    claude: ["install-host.mjs", ["--host", "claude", ...shared]],
    codex: ["install-codex-guard.mjs", shared],
    opencode: ["install-opencode-guard.mjs", shared],
  };
  const [script, args] = plans[host];
  const result = spawnSync(process.execPath, [path.join(REPOSITORY_ROOT, "scripts", script), ...args], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 300000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0) return { ok: false, detail: output.split("\n").slice(-2).join(" ").slice(0, 200) };
  return { ok: true, detail: output.split("\n").find((line) => line.includes("installed copy")) ?? "reinstalled" };
}

function repairClaude({ url, workspace }) {
  // Claude owns its plugin copies, so the version is moved by its own CLI;
  // the config half is still written by the installer.
  const commands = [
    ["claude", ["plugin", "marketplace", "update", "omp-spec-kit"]],
    ["claude", ["plugin", "update", "omp-spec-kit@omp-spec-kit"]],
  ];
  for (const [command, args] of commands) {
    spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout: 300000 });
  }
  const config = spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, "scripts", "install-host.mjs"), "--host", "claude", "--url", url, "--workspace", workspace],
    { encoding: "utf8", windowsHide: true, timeout: 300000 },
  );
  const listed = cliJson("claude", ["plugin", "list", "--json"]);
  const entry = (Array.isArray(listed) ? listed : []).find((candidate) => candidate?.id === "omp-spec-kit@omp-spec-kit");
  if (entry?.version !== PLUGIN_VERSION) {
    return { ok: false, detail: `claude still reports ${entry?.version ?? "nothing"}; ${(config.stderr ?? "").trim().slice(0, 120)}` };
  }
  return { ok: true, detail: `claude plugin updated to ${entry.version}` };
}

/** A fresh `initialize` proves the registry accepts the token the hosts send. */
export async function probeRegistry(url, token) {
  if (typeof url !== "string") return { ok: false, detail: "no registry url" };
  if (typeof token !== "string" || token === "") return { ok: false, detail: "no token in the environment" };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "host-delivery", version: PLUGIN_VERSION },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, detail: `HTTP ${response.status}: the registry rejects this token` };
    }
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const text = await response.text();
    return /"jsonrpc"/u.test(text) ? { ok: true, detail: "token accepted" } : { ok: false, detail: "unexpected reply" };
  } catch (error) {
    return { ok: false, detail: `unreachable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * A running host keeps the environment it started with. When that value no
 * longer matches the persisted one, the host will fail until it restarts —
 * which no installer can do, so the audit says it out loud.
 */
function persistedToken(platform = process.platform) {
  if (platform !== "win32") return null;
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${ENV_NAME}','User')`],
    { encoding: "utf8", windowsHide: true, timeout: 30000 },
  );
  const value = (result.stdout ?? "").trim();
  return result.status === 0 && value !== "" ? value : null;
}

export function persistedTokenDiffers(env = process.env, platform = process.platform) {
  const persisted = persistedToken(platform);
  if (persisted === null) return null;
  return persisted === (env[ENV_NAME] ?? "").trim() ? null : "this process holds an older token than the persisted one";
}

/**
 * The token to probe with. A shell started before a token rotation carries
 * the old value, so the persisted one is tried as well instead of reporting
 * the registry as broken when only the caller's environment is stale.
 */
export function resolveTokens(env = process.env, platform = process.platform) {
  const candidates = [];
  const current = (env[ENV_NAME] ?? "").trim();
  if (current !== "") candidates.push({ token: current, source: "$" + ENV_NAME });
  const persisted = persistedToken(platform);
  if (persisted !== null && persisted !== current) candidates.push({ token: persisted, source: "persisted " + ENV_NAME });
  return candidates;
}

async function probeWithFallback(url, candidates) {
  if (candidates.length === 0) return { ok: false, detail: "no token in the environment" };
  let last = null;
  for (const candidate of candidates) {
    const result = await probeRegistry(url, candidate.token);
    if (result.ok) return { ok: true, detail: `token accepted (${candidate.source})` };
    last = result;
  }
  return last;
}

function formatRow(cells, widths) {
  return cells.map((cell, index) => String(cell).padEnd(widths[index])).join("  ").trimEnd();
}

function discoverUrl(paths) {
  const omp = readJson(paths.omp.config)?.mcpServers?.["omp-spec-kit"]?.url;
  if (typeof omp === "string") return { url: omp, source: path.basename(paths.omp.config) };
  const opencode = readJson(paths.opencode.config)?.mcp?.["spec-registry"]?.url;
  if (typeof opencode === "string") return { url: opencode, source: path.basename(paths.opencode.config) };
  if (existsSync(paths.codex.config)) {
    const codex = tomlUnquote(readCodexServer(readFileSync(paths.codex.config, "utf8"), "spec_registry")?.url);
    if (typeof codex === "string") return { url: codex, source: path.basename(paths.codex.config) };
  }
  const claude = readJson(paths.claude.homeConfig)?.mcpServers?.["omp-spec-kit"]?.url;
  if (typeof claude === "string") return { url: claude, source: path.basename(paths.claude.homeConfig) };
  return null;
}

export async function run(argv, env = process.env, out = console.log) {
  const options = parseArgs(argv, env);
  const paths = hostPaths();
  const discovered = options.url === null ? discoverUrl(paths) : null;
  if (options.url === null && discovered === null) {
    throw new Error("--url or OMP_SPEC_REGISTRY_URL is required: no installed host config declares a registry url");
  }
  const url = options.url ?? discovered.url;
  const urlSource = options.urlSource ?? discovered.source;
  const project = options.fix ? resolveProject(options) : null;
  if (options.fix && project === null) {
    throw new Error("--project owner/project (or a workspace record) is required to repair a host");
  }

  const repairs = [];
  for (const host of options.hosts) {
    if (!options.fix) continue;
    const audit = AUDITS[host]({ paths, url });
    if (audit.problems.length === 0 && audit.versionOk) continue;
    const result = host === "claude" ? repairClaude({ url, workspace: options.workspace }) : repair(host, { url, project, workspace: options.workspace });
    repairs.push({ host, ...result });
  }

  const rows = options.hosts.map((host) => AUDITS[host]({ paths, url }));
  const registry = await probeWithFallback(url, resolveTokens(env));
  const tokenDrift = persistedTokenDiffers(env);

  out(`omp-spec-kit@${PLUGIN_VERSION} — host delivery (${options.fix ? "repair" : "audit"})`);
  out(`registry url: ${url} (from ${urlSource})`);
  const widths = [10, 16, 8, 10];
  out(formatRow(["host", "version", "config", "state"], widths));
  let healthy = true;
  for (const row of rows) {
    const version = row.version === null ? "not installed" : `${row.version}${row.versionOk ? "" : ` (repo ${PLUGIN_VERSION})`}`;
    const state = row.problems.length === 0 && row.versionOk ? "ok" : "BROKEN";
    if (state !== "ok") healthy = false;
    out(formatRow([row.host, version, row.configPath === null ? "none" : path.basename(row.configPath), state], widths));
    for (const problem of row.problems) out(`           - ${problem}`);
    if (row.note !== null && row.note !== undefined) out(`           note: ${row.note}`);
  }
  for (const entry of repairs) {
    out(`${entry.ok ? "repaired" : "FAILED  "} ${entry.host}: ${entry.detail}`);
    if (!entry.ok) healthy = false;
  }
  out(`registry: ${registry.ok ? "ok" : "FAILED"} (${registry.detail})`);
  if (!registry.ok) healthy = false;
  if (tokenDrift !== null) {
    out(`environment: ${tokenDrift}`);
    out("restart the hosts that are already running so they pick up the persisted token");
  }
  if (repairs.some((entry) => entry.ok)) out("restart the repaired hosts to load the new copy");
  if (healthy && repairs.length === 0 && tokenDrift === null) out("nothing to do");
  return healthy ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`host-delivery: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 2;
    },
  );
}
