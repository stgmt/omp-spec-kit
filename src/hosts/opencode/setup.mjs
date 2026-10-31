/**
 * OpenCode setup reporter: inject the shared "not configured" warning into the
 * first user message of a session.
 *
 * OpenCode's `event` hook is observe-only, so the agent-visible channel is
 * `chat.message`: the warning is appended as a text part of the incoming
 * message. The guard itself stays fail-closed and separate; this plugin only
 * reports, it never authorizes a tool call.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { setupWarning } from "./setup-warning.js";

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function opencodeConfigured({ home = homedir(), configPath = null } = {}) {
  const configRoot = path.join(home, ".config", "opencode");
  const guard = readJson(path.join(configRoot, "spec-kit-guard.json"));
  const serverName = guard?.registryServer;
  if (typeof serverName !== "string" || serverName.length === 0) return false;
  const candidates = [configPath, guard?.opencodeConfigPath, path.join(configRoot, "opencode.json")]
    .filter((value) => typeof value === "string" && value.length > 0);
  for (const candidate of candidates) {
    const server = readJson(candidate)?.mcp?.[serverName];
    if (server !== undefined) {
      return server?.type === "remote" && typeof server?.url === "string" && server.url.length > 0;
    }
  }
  return false;
}

export const OmpSpecKitSetup = async ({ directory, home = homedir() }) => {
  let pending = setupWarning({
    root: directory ?? process.cwd(),
    env: process.env,
    configured: opencodeConfigured({ home }),
  });
  return {
    event: async ({ event } = {}) => {
      if (event?.type === "session.created") {
        pending = setupWarning({
          root: directory ?? process.cwd(),
          env: process.env,
          configured: opencodeConfigured({ home }),
        });
      }
    },
    "chat.message": async (input, output) => {
      if (pending === "" || pending === null) return;
      if (!Array.isArray(output?.parts)) return;
      output.parts.push({ type: "text", text: pending });
      pending = null;
    },
  };
};
