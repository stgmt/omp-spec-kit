/**
 * Shared "installed but not configured" diagnostic.
 *
 * A project is configured when a registry MCP entry exists (project `.mcp.json`
 * or a host-specific config), or when the endpoint/token environment pair is
 * populated. A local `.specs` corpus is NOT a configuration signal: hosted
 * projects carry no local corpus by design.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const MAX_DIR_ENTRIES = 4096;
const REGISTRY_SERVER_NAME = /(?:^|[-_.])(?:omp[-_]?spec[-_]?kit|spec[-_]?registry)(?:$|[-_.])/iu;

export function hasLocalCorpus(root) {
  const specs = path.join(root, ".specs");
  if (!existsSync(specs)) return false;
  try {
    return readdirSync(specs).slice(0, MAX_DIR_ENTRIES).some((entry) => {
      if (entry.startsWith(".")) return false;
      try {
        return statSync(path.join(specs, entry)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function hasProjectMcpConfig(root) {
  const file = path.join(root, ".mcp.json");
  if (!existsSync(file)) return false;
  try {
    const servers = JSON.parse(readFileSync(file, "utf8"))?.mcpServers;
    if (!servers || typeof servers !== "object" || Array.isArray(servers)) return false;
    return Object.entries(servers).some(
      ([name, server]) => REGISTRY_SERVER_NAME.test(name) && typeof server?.url === "string" && server.url.length > 0,
    );
  } catch {
    return false;
  }
}

/**
 * @param {object} input
 * @param {string} [input.root] project root
 * @param {NodeJS.ProcessEnv} [input.env]
 * @param {boolean|null} [input.configured] host-specific verdict; null = infer
 * @param {string} [input.endpointVar]
 * @param {string} [input.tokenVar]
 */
export function setupWarning({
  root = process.cwd(),
  env = process.env,
  configured = null,
  endpointVar = "OMP_SPEC_REGISTRY_URL",
  tokenVar = "OMP_SPEC_REGISTRY_TOKEN",
} = {}) {
  const url = env?.[endpointVar];
  const token = env?.[tokenVar];
  const envConfigured = typeof url === "string" && url.length > 0 && typeof token === "string" && token.length > 0;
  const inferred = hasProjectMcpConfig(root) || envConfigured;
  if (configured === true || (configured === null && inferred)) return "";
  const missing = [];
  if (!hasLocalCorpus(root)) missing.push("no .specs corpus in this project");
  if (configured === null) {
    if (typeof url !== "string" || url.length === 0) missing.push(`${endpointVar} is not set`);
    if (typeof token !== "string" || token.length === 0) missing.push(`${tokenVar} is not set`);
  } else {
    missing.push("the registry MCP endpoint/token is not configured for this host");
  }
  if (missing.length === 0) return "";
  return [
    "SPEC_SETUP_REQUIRED: the omp-spec-kit plugin is installed but this project is not fully configured.",
    `Missing: ${missing.join("; ")}.`,
    "Next: bind the project to its repository and generate a ready .mcp.json from the YouTrack Spec Service page; then restart the session. Setup help: README.md → YouTrack app.",
  ].join("\n");
}

/**
 * OMP extension registration: one bounded message on `session_start`.
 * Never throws into the host, never blocks a turn.
 */
export function registerSetupWarning(pi, options = {}) {
  if (typeof pi?.on !== "function") return false;
  pi.on("session_start", () => {
    try {
      const warning = setupWarning(options);
      if (warning !== "" && typeof pi.sendMessage === "function") {
        pi.sendMessage(
          { customType: "spec-setup", content: warning, display: true },
          { deliverAs: "nextTurn" },
        );
      }
    } catch {
      // Diagnostics must never break a session.
    }
  });
  return true;
}
