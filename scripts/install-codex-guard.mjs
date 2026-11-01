#!/usr/bin/env node
/**
 * Install the Codex PreToolUse guard and the HTTP registry entry.
 *
 *   node scripts/install-codex-guard.mjs --url <http://host/mcp> --project owner/project
 *     [--token <token>] [--server <name>] [--codex-home <dir>] [--workspace <dir>]
 *
 * `--project` is REQUIRED and has no fallback. It is written once to the
 * workspace record `<workspace>/.omp-spec-kit/project.json`; the PreToolUse
 * hook reads that record at call time and attaches it with `updatedInput`.
 * Neither the guard config nor config.toml stores a project.
 */
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { installSkills } from "../src/hosts/skills.mjs";
import { isProjectIdentity, writeProjectBinding } from "../src/enforcement/project-binding.js";
import { readCodexServer } from "../src/hosts/codex/hook.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function flag(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
}

function fail(message) {
  console.error(`install-codex-guard: ${message}`);
  process.exit(1);
}

const url = flag("url", process.env.OMP_SPEC_REGISTRY_URL ?? null);
if (typeof url !== "string" || !/^https?:\/\/[^/]+\/mcp$/u.test(url)) {
  fail("--url must be an http(s) endpoint ending in /mcp");
}

const project = flag("project");
if (typeof project !== "string" || project.trim() === "") {
  fail("--project owner/project is required: the hook cannot infer a project from the endpoint");
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

const token = readToken();
const serverName = flag("server", "spec_registry");
const codexHome = path.resolve(flag("codex-home", path.join(homedir(), ".codex")));
const installRoot = path.join(codexHome, "spec-kit-guard");
const distSource = path.join(repositoryRoot, "plugins", "omp-spec-kit", "dist");
const hostsSource = path.join(repositoryRoot, "src", "hosts", "codex");
if (!existsSync(path.join(distSource, "enforcement", "classifier.js"))) fail("build the plugin first: npm run build");
if (!existsSync(path.join(hostsSource, "hook.mjs"))) fail(`missing Codex adapter: ${hostsSource}`);

rmSync(installRoot, { recursive: true, force: true });
mkdirSync(path.join(installRoot, "hosts", "codex"), { recursive: true });
mkdirSync(path.join(installRoot, "enforcement"), { recursive: true });
cpSync(distSource, path.join(installRoot, "dist"), { recursive: true });
for (const name of ["hook.mjs", "normalize.mjs", "sessionstart.mjs", "caps.mjs"]) {
  copyFileSync(path.join(hostsSource, name), path.join(installRoot, "hosts", "codex", name));
}
copyFileSync(path.join(distSource, "enforcement", "setup-warning.js"), path.join(installRoot, "hosts", "codex", "setup-warning.js"));
copyFileSync(path.join(repositoryRoot, "src", "enforcement", "project-binding.js"), path.join(installRoot, "enforcement", "project-binding.js"));
writeFileSync(path.join(installRoot, "package.json"), JSON.stringify({ type: "module" }, null, 2) + "\n");
const skills = installSkills({
  sourceRoot: path.join(repositoryRoot, "plugins", "omp-spec-kit", "skills"),
  targetSkillsDir: path.join(codexHome, "skills"),
});

const hookPath = path.join(installRoot, "hosts", "codex", "hook.mjs");
const guardPath = path.join(codexHome, "spec-kit-guard.json");
writeFileSync(
  guardPath,
  JSON.stringify({ schema: "omp-spec-kit/codex-guard@1", registryServer: serverName, registryUrl: url }, null, 2) + "\n",
);

const hooksPath = path.join(codexHome, "hooks.json");
const hooks = existsSync(hooksPath) ? JSON.parse(readFileSync(hooksPath, "utf8")) : { hooks: {} };
hooks.hooks = hooks.hooks ?? {};
const groups = Array.isArray(hooks.hooks.PreToolUse) ? hooks.hooks.PreToolUse : [];
const kept = groups.filter(
  (group) => !(group?.hooks ?? []).some((hook) => typeof hook?.command === "string" && hook.command.includes("spec-kit-guard")),
);
kept.push({
  matcher: "Bash|apply_patch|Edit|Write|MultiEdit|mcp__.*",
  hooks: [{ type: "command", command: `node "${hookPath}"`, timeout: 10 }],
});
hooks.hooks.PreToolUse = kept;
const sessionGroups = Array.isArray(hooks.hooks.SessionStart) ? hooks.hooks.SessionStart : [];
hooks.hooks.SessionStart = sessionGroups.filter(
  (group) => !(group?.hooks ?? []).some((hook) => typeof hook?.command === "string" && hook.command.includes("spec-kit-guard")),
);
hooks.hooks.SessionStart.push({
  hooks: [{ type: "command", command: `node "${path.join(installRoot, "hosts", "codex", "sessionstart.mjs")}"`, timeout: 10 }],
});
if (existsSync(hooksPath)) copyFileSync(hooksPath, `${hooksPath}.bak-${new Date().toISOString().replaceAll(":", "-")}`);
mkdirSync(codexHome, { recursive: true });
writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");

const configPath = path.join(codexHome, "config.toml");
const configText = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
const existing = readCodexServer(configText, serverName);
if (existing !== null) {
  if (existing.command !== undefined) fail(`mcp_servers.${serverName} is a stdio server; remove it first`);
  if (existing.url !== `"${url}"`) fail(`mcp_servers.${serverName} points at ${existing.url}; the installed stack serves ${url}`);
} else {
  const block = [
    "",
    `[mcp_servers.${serverName}]`,
    `url = "${url}"`,
    'bearer_token_env_var = "OMP_SPEC_REGISTRY_TOKEN"',
    "startup_timeout_sec = 10",
    "tool_timeout_sec = 120",
    "",
  ].join("\n");
  if (configText !== "" && !configText.endsWith("\n")) configText + "\n";
  mkdirSync(codexHome, { recursive: true });
  if (existsSync(configPath)) copyFileSync(configPath, `${configPath}.bak-${new Date().toISOString().replaceAll(":", "-")}`);
  writeFileSync(configPath, configText + block);
}

const envName = "OMP_SPEC_REGISTRY_TOKEN";
if (process.platform === "win32") {
  const set = spawnSync("setx", [envName, token], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
  if (set.status !== 0) fail(`setx ${envName} failed: ${(set.stderr ?? "").trim().slice(0, 200)}`);
} else {
  const profile = path.join(homedir(), ".profile");
  const current = existsSync(profile) ? readFileSync(profile, "utf8") : "";
  if (!current.includes(`export ${envName}=`)) {
    writeFileSync(profile, `${current}${current.endsWith("\n") || current === "" ? "" : "\n"}export ${envName}=${JSON.stringify(token)}\n`);
    try {
      chmodSync(profile, 0o600);
    } catch {
      // best effort on filesystems without POSIX modes
    }
  }
}

const record = writeProjectBinding(workspace, project.trim());

console.log(`guard installed: ${installRoot}`);
console.log(`skills installed: ${skills.join(", ")}`);
console.log(`hooks.json: ${hooksPath}`);
console.log(`config.toml: [mcp_servers.${serverName}] -> ${url}`);
console.log(`environment: ${envName} set for new processes`);
console.log(`project record: ${record}`);
console.log("run /hooks in Codex once to review and trust the new hook");
