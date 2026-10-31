import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

// Claude Code SessionStart hook: a bounded setup warning, never a block.
// It runs once per session; failures are swallowed so a broken diagnostic
// cannot break the agent.
const MAX_STDIN_BYTES = 1024 * 1024;

async function readStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_STDIN_BYTES) return "";
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function projectRoot(input) {
  if (typeof input?.cwd === "string" && input.cwd.length > 0) return input.cwd;
  if (typeof process.env.CLAUDE_PROJECT_DIR === "string" && process.env.CLAUDE_PROJECT_DIR.length > 0) {
    return process.env.CLAUDE_PROJECT_DIR;
  }
  return process.cwd();
}

function hasCorpus(root) {
  const specs = path.join(root, ".specs");
  if (!existsSync(specs)) return false;
  try {
    return readdirSync(specs).some((entry) => {
      if (entry.startsWith(".")) return false;
      const dir = path.join(specs, entry);
      return statSync(dir).isDirectory();
    });
  } catch {
    return false;
  }
}

/**
 * Hosted projects carry no local `.specs` by design — their corpus lives on
 * orphan branches behind the registry. A project `.mcp.json`, a user-scope
 * Claude config (`~/.claude.json` / `CLAUDE_CONFIG_DIR`), or a fully populated
 * environment is the configuration signal.
 */
function hasServers(file) {
  if (!existsSync(file)) return false;
  try {
    const servers = JSON.parse(readFileSync(file, "utf8"))?.mcpServers;
    if (!servers || typeof servers !== "object" || Array.isArray(servers)) return false;
    return Object.values(servers).some(
      (server) => typeof server?.url === "string" && server.url.length > 0,
    );
  } catch {
    return false;
  }
}

function hasMcpConfig(root) {
  if (hasServers(path.join(root, ".mcp.json"))) return true;
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  const candidates = [
    configDir === undefined ? null : path.join(configDir, ".claude.json"),
    configDir === undefined ? null : path.join(configDir, "claude.json"),
    path.join(homedir(), ".claude.json"),
  ].filter((file) => typeof file === "string" && file.length > 0);
  return candidates.some((file) => hasServers(file));
}

function warningFor(root) {
  const corpus = hasCorpus(root);
  const url = process.env.OMP_SPEC_REGISTRY_URL;
  const token = process.env.OMP_SPEC_REGISTRY_TOKEN;
  const envConfigured = typeof url === "string" && url.length > 0 && typeof token === "string" && token.length > 0;
  // Configured hosted project: no local corpus is expected, stay silent.
  if (hasMcpConfig(root) || envConfigured) return "";
  const missing = [];
  if (!corpus) missing.push("no .specs corpus in this project");
  if (typeof url !== "string" || url.length === 0) missing.push("OMP_SPEC_REGISTRY_URL is not set");
  if (typeof token !== "string" || token.length === 0) missing.push("OMP_SPEC_REGISTRY_TOKEN is not set");
  if (missing.length === 0) return "";
  return [
    "SPEC_SETUP_REQUIRED: the omp-spec-kit plugin is installed but this project is not fully configured.",
    `Missing: ${missing.join("; ")}.`,
    "Next: create/bind a specification corpus or generate a ready .mcp.json from the YouTrack Spec Service page; then restart the session. Setup help: README.md → YouTrack app.",
  ].join("\n");
}

try {
  const input = await readStdin();
  let parsed = {};
  try {
    parsed = input.trim() === "" ? {} : JSON.parse(input);
  } catch {
    parsed = {};
  }
  const message = warningFor(projectRoot(parsed));
  if (message !== "") process.stdout.write(message + "\n");
} catch {
  // Never block or fail the session for a diagnostic.
}
process.exitCode = 0;
