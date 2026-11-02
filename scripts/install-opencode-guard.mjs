#!/usr/bin/env node
/**
 * Install the OpenCode specification guard.
 *
 *   node scripts/install-opencode-guard.mjs --url <http://host/mcp> --project owner/project
 *     [--token <token>] [--server <name>] [--config <path>] [--plugins-dir <dir>]
 *     [--guard-config <path>] [--workspace <dir>]
 *
 * `--project` is REQUIRED and has no fallback. It is written once to the
 * workspace record `<workspace>/.omp-spec-kit/project.json`; the plugin reads
 * that record per session and attaches it to each registry spec call. The
 * guard config and opencode.json carry no project.
 */
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installSkills } from "../src/hosts/skills.mjs";
import { isProjectIdentity, writeProjectBinding } from "../src/enforcement/project-binding.js";
import { PLUGIN_VERSION } from "../src/adapters/plugin-version.js";
import { writeStamp } from "./install-stamp.mjs";

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

const project = flag("project");
if (typeof project !== "string" || project.trim() === "") {
  fail("--project owner/project is required: the plugin cannot infer a project from the endpoint");
}
if (!isProjectIdentity(project)) {
  fail(`--project must be an owner/project registry identity, received ${JSON.stringify(project)}`);
}
const workspace = path.resolve(flag("workspace", process.cwd()));

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
// The token is a precondition, never a payload: opencode.json is a file that
// gets copied, committed, and shared, so the header keeps the environment
// reference OpenCode substitutes at call time.
readToken();

const serverName = flag("server", "spec-registry");
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
mkdirSync(path.join(pluginRoot, "enforcement"), { recursive: true });
cpSync(distSource, path.join(pluginRoot, "dist"), { recursive: true });
copyFileSync(hostSource, path.join(pluginRoot, "hosts", "opencode", "plugin.mjs"));
copyFileSync(path.join(repositoryRoot, "src", "hosts", "opencode", "setup.mjs"), path.join(pluginRoot, "hosts", "opencode", "setup.mjs"));
copyFileSync(path.join(distSource, "enforcement", "setup-warning.js"), path.join(pluginRoot, "hosts", "opencode", "setup-warning.js"));
copyFileSync(path.join(repositoryRoot, "src", "enforcement", "project-binding.js"), path.join(pluginRoot, "enforcement", "project-binding.js"));

const loaderPath = path.join(pluginsDir, "omp-spec-kit-guard.js");
// OpenCode 1.19.3 scans `.js` plugin files but ignores `.mjs` in the plugin
// directory. The bridge is ESM (Bun auto-detects it) and imports the packaged
// adapter lazily, so both the `.js` and legacy `.mjs` loaders stay valid.
writeFileSync(
  loaderPath,
  'export const OmpSpecKitGuard = async (ctx) => {\n' +
    '  const mod = await import("./omp-spec-kit/hosts/opencode/plugin.mjs");\n' +
    '  return mod.OmpSpecKitGuard(ctx);\n' +
    '};\n',
);
const legacyLoaderPath = path.join(pluginsDir, "omp-spec-kit-guard.mjs");
writeFileSync(legacyLoaderPath, 'export { OmpSpecKitGuard } from "./omp-spec-kit/hosts/opencode/plugin.mjs";\n');
const setupLoaderPath = path.join(pluginsDir, "omp-spec-kit-setup.js");
writeFileSync(
  setupLoaderPath,
  'export const OmpSpecKitSetup = async (ctx) => {\n' +
    '  const mod = await import("./omp-spec-kit/hosts/opencode/setup.mjs");\n' +
    '  return mod.OmpSpecKitSetup(ctx);\n' +
    '};\n',
);
const legacySetupLoaderPath = path.join(pluginsDir, "omp-spec-kit-setup.mjs");
writeFileSync(legacySetupLoaderPath, 'export { OmpSpecKitSetup } from "./omp-spec-kit/hosts/opencode/setup.mjs";\n');
writeFileSync(path.join(pluginRoot, "package.json"), JSON.stringify({ type: "module" }, null, 2) + "\n");
const skills = installSkills({
  sourceRoot: path.join(repositoryRoot, "plugins", "omp-spec-kit", "skills"),
  targetSkillsDir: path.join(homedir(), ".config", "opencode", "skills"),
});

writeFileSync(
  guardConfigPath,
  JSON.stringify({ schema: "omp-spec-kit/opencode-guard@1", registryServer: serverName, registryUrl: url, opencodeConfigPath: configPath }, null, 2) + "\n",
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
  headers: { Authorization: "Bearer {env:OMP_SPEC_REGISTRY_TOKEN}" },
};
mkdirSync(path.dirname(configPath), { recursive: true });
if (existsSync(configPath)) {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  copyFileSync(configPath, `${configPath}.bak-${stamp}`);
}
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

const record = writeProjectBinding(workspace, project.trim());
const stamp = writeStamp(pluginRoot, { version: PLUGIN_VERSION, source: repositoryRoot });

console.log(`guard installed: ${pluginsDir}`);
console.log(`installed copy: omp-spec-kit@${stamp.version} (digest ${stamp.digest.slice(0, 12)})`);
console.log(`skills installed: ${skills.join(", ")}`);
console.log(`registry: ${serverName} -> ${url}`);
console.log(`host config: ${configPath}`);
console.log(`project record: ${record}`);
console.log("OpenCode picks the plugin and MCP server up at the next session start");
