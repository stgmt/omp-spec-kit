#!/usr/bin/env node
/**
 * Install the OpenCode specification guard.
 *
 * The guard is not part of the published plugin payload yet: this installer
 * copies the built enforcement tree and the OpenCode host adapter into the
 * global OpenCode plugin directory, writes the guard config, and registers the
 * registry as a remote MCP server.
 *
 * Required: --url (http(s)://host/mcp) and a token (--token or
 * OMP_SPEC_REGISTRY_TOKEN / OMP_SPEC_REGISTRY_TOKEN_FILE). There is no
 * fallback: a missing value, a local-server entry, or a conflicting remote
 * entry stops the install.
 */
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function flag(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
}

function fail(message) {
  console.error(`install-opencode-guard: ${message}`);
  process.exit(1);
}

const url = flag("url", process.env.OMP_SPEC_REGISTRY_URL ?? null);
if (typeof url !== "string" || !/^https?:\/\/[^/]+\/mcp$/u.test(url)) {
  fail("--url must be an http(s) endpoint ending in /mcp");
}

function readToken() {
  const direct = flag("token", process.env.OMP_SPEC_REGISTRY_TOKEN ?? null);
  if (typeof direct === "string" && direct.trim() !== "") return direct.trim();
  const file = process.env.OMP_SPEC_REGISTRY_TOKEN_FILE ?? null;
  if (typeof file === "string" && file !== "") {
    const value = readFileSync(file, "utf8").trim();
    if (value !== "") return value;
  }
  fail("provide --token, OMP_SPEC_REGISTRY_TOKEN, or OMP_SPEC_REGISTRY_TOKEN_FILE");
}
const token = readToken();

const serverName = flag("server", "spec-registry");
const project = flag("project", "stgmt/omp-spec-kit");
const configPath = path.resolve(flag("config", path.join(homedir(), ".config", "opencode", "opencode.json")));
const pluginsDir = path.resolve(flag("plugins-dir", path.join(homedir(), ".config", "opencode", "plugins")));
const guardConfigPath = path.resolve(flag("guard-config", path.join(homedir(), ".config", "opencode", "spec-kit-guard.json")));

const pluginRoot = path.join(pluginsDir, "omp-spec-kit");
const distSource = path.join(repositoryRoot, "plugins", "omp-spec-kit", "dist");
const hostSource = path.join(repositoryRoot, "src", "hosts", "opencode", "plugin.mjs");
if (!existsSync(path.join(distSource, "enforcement", "classifier.js"))) fail("build the plugin first: npm run build");
if (!existsSync(hostSource)) fail(`missing host adapter: ${hostSource}`);

rmSync(pluginRoot, { recursive: true, force: true });
mkdirSync(path.join(pluginRoot, "hosts", "opencode"), { recursive: true });
cpSync(distSource, path.join(pluginRoot, "dist"), { recursive: true });
copyFileSync(hostSource, path.join(pluginRoot, "hosts", "opencode", "plugin.mjs"));

const loaderPath = path.join(pluginsDir, "omp-spec-kit-guard.mjs");
writeFileSync(loaderPath, 'export { OmpSpecKitGuard } from "./omp-spec-kit/hosts/opencode/plugin.mjs";\n');
writeFileSync(path.join(pluginRoot, "package.json"), JSON.stringify({ type: "module" }, null, 2) + "\n");

writeFileSync(
  guardConfigPath,
  JSON.stringify({ schema: "omp-spec-kit/opencode-guard@1", registryServer: serverName, registryUrl: url, project }, null, 2) + "\n",
);
try {
  chmodSync(guardConfigPath, 0o600);
} catch {
  // Windows has no POSIX mode bits; the token file location is still user-scoped.
}

const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
config.mcp = config.mcp ?? {};
const existing = config.mcp[serverName];
if (existing !== undefined) {
  if (existing?.type !== "remote") fail(`mcp.${serverName} exists with type ${existing?.type ?? "unknown"}; remove it first`);
  if (existing?.url !== url) fail(`mcp.${serverName} points at ${existing?.url}; the installed stack serves ${url}`);
}
config.mcp[serverName] = {
  type: "remote",
  url,
  enabled: true,
  headers: { Authorization: `Bearer ${token}`, "X-Spec-Project": project },
};
mkdirSync(path.dirname(configPath), { recursive: true });
if (existsSync(configPath)) {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  copyFileSync(configPath, `${configPath}.bak-${stamp}`);
}
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

console.log(`guard installed: ${pluginsDir}`);
console.log(`registry: ${serverName} -> ${url}`);
console.log(`host config: ${configPath}`);
console.log("restart OpenCode so the plugin and MCP server load");
