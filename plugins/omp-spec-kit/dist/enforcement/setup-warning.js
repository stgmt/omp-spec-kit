/**
 * Shared "installed but not bound to this project" diagnostic.
 *
 * Two independent states are reported separately, because they are not the
 * same question:
 *
 *  - `endpointConfigured`: the registry MCP endpoint exists for this host
 *    (endpoint/token environment pair, or a project `.mcp.json` entry).
 *  - `projectBound`: this workspace names a project in its repo-local record
 *    `<root>/.omp-spec-kit/project.json`.
 *
 * A configured endpoint with no resolved project record still warns: the agent
 * would otherwise call with no project and receive `PROJECT_REQUIRED`.
 * A local `.specs` corpus is NOT a configuration signal: hosted projects carry
 * no local corpus by design.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PROJECT_BINDING_SCHEMA, projectBindingPath, readProjectBinding } from "./project-binding.js";

const REGISTRY_SERVER_NAME = /(?:^|[-_.])(?:omp[-_]?spec[-_]?kit|spec[-_]?registry)(?:$|[-_.])/iu;

export function hasLocalCorpus(root) {
  const specs = path.join(root, ".specs");
  if (!existsSync(specs)) return false;
  try {
    return readdirSync(specs).length > 0;
  } catch {
    return false;
  }
}

export function hasProjectMcpConfig(root) {
  const file = path.join(root, ".mcp.json");
  if (!existsSync(file)) return false;
  try {
    const content = JSON.parse(readFileSync(file, "utf8"));
    const servers = content?.mcpServers;
    if (servers === null || typeof servers !== "object") return false;
    for (const [name, server] of Object.entries(servers)) {
      if (!REGISTRY_SERVER_NAME.test(name)) continue;
      if (server?.type === "http" && typeof server?.url === "string" && server.url.length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * @param {object} input
 * @param {string|(() => string)} [input.root] workspace under inspection
 * @param {object} [input.env]
 * @param {boolean|null} [input.configured] host-specific endpoint verdict
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
  const workspace = typeof root === "function" ? root() : root;
  const url = env?.[endpointVar];
  const token = env?.[tokenVar];
  const envConfigured = typeof url === "string" && url.length > 0 && typeof token === "string" && token.length > 0;
  const endpointConfigured =
    configured === true || (configured === null && (envConfigured || hasProjectMcpConfig(workspace)));
  const binding = readProjectBinding(workspace);

  if (endpointConfigured && binding !== null) return "";

  const missing = [];
  if (!endpointConfigured) {
    if (configured === null) {
      if (typeof url !== "string" || url.length === 0) missing.push(`${endpointVar} is not set`);
      if (typeof token !== "string" || token.length === 0) missing.push(`${tokenVar} is not set`);
      if (typeof url === "string" && url.length > 0 && typeof token === "string" && token.length > 0) {
        missing.push("no registry MCP entry in this project's .mcp.json");
      }
    } else {
      missing.push("the registry MCP endpoint/token is not configured for this host");
    }
  }
  if (binding === null) {
    missing.push(`no project selection record at ${projectBindingPath(workspace)}`);
  }

  return [
    "SPEC_SETUP_REQUIRED: the omp-spec-kit plugin is installed but this workspace is not bound to a project.",
    `Missing: ${missing.join("; ")}.`,
    `Next: write {"schema":"${PROJECT_BINDING_SCHEMA}","project":"owner/project"} to ${projectBindingPath(workspace)} — or run the installer with --project owner/project — then bind the repository with`,
    'spec_repo {"action":"bind","project":"owner/project","repoUrl":"<git-url>","token":"<fine-grained-pat-with-contents-rw>"}.',
    "Each MCP call then reads that record for the session's own workspace; no restart is needed to change projects.",
  ].join("\n");
}

/**
 * OMP extension registration: one bounded message on `session_start`.
 * Never throws into the host, never blocks a turn.
 */
export function registerSetupWarning(pi, options = {}) {
  if (typeof pi?.on !== "function") return false;
  pi.on("session_start", (_event, ctx) => {
    try {
      const root =
        typeof ctx?.cwd === "string" && ctx.cwd !== ""
          ? ctx.cwd
          : typeof options.root === "function"
            ? options.root()
            : (options.root ?? process.cwd());
      const warning = setupWarning({ ...options, root });
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
