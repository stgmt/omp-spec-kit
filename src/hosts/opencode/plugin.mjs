/**
 * OpenCode host adapter for the specification access gate.
 *
 * OpenCode has no tool list at hook time, so authority is proven by the minted
 * tool name: the registry server name comes from the installer-written guard
 * config and only `<registryServer>_spec_patch` is accepted. Every other
 * spec_patch spelling - the bare short name or a tool from another MCP server,
 * including the retired local stdio server - is blocked.
 *
 * The classifier is a required dependency: the installed host loads it from
 * the packaged dist tree, and tests pass the source module. There is no
 * fallback path.
 *
 * Fail-closed: malformed arguments, an unreadable config, an unknown tool that
 * carries a path-like argument, or any adapter error blocks the call.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const GUARD_CONFIG_NAME = "spec-kit-guard.json";
const DEFAULT_MCP_FAMILY = "mcp__omp_spec_kit_";

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function loadGuardConfig({ home = homedir(), override = null } = {}) {
  if (override !== null) return override;
  return readJson(path.join(home, ".config", "opencode", GUARD_CONFIG_NAME));
}

function registryTransportIsRemote(serverName, config, home) {
  const candidates = [config?.opencodeConfigPath, path.join(home, ".config", "opencode", "opencode.json")].filter(
    (value) => typeof value === "string" && value.length > 0,
  );
  for (const candidate of candidates) {
    try {
      const server = readJson(candidate)?.mcp?.[serverName];
      if (server === undefined) continue;
      return server?.type === "remote" && typeof server?.url === "string" && server.url.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "") ?? null;
}

function targetsFromArgs(tool, args) {
  if (tool === "bash" || tool === "shell") return { command: firstString(args?.command, args?.cmd) };
  if (tool === "patch") {
    const text = firstString(args?.patchText, args?.patch, args?.text);
    if (text === null) return { indeterminate: true };
    const paths = [...text.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gmu)].map((match) => match[1].trim());
    if (paths.length > 0) return { paths };
    return text.includes(".specs") ? { command: text } : {};
  }
  const target = firstString(args?.filePath, args?.path, args?.file, args?.document);
  if (target !== null) return { path: target };
  if (Array.isArray(args?.paths)) return { paths: args.paths };
  return null;
}

function toClassifierEvent(tool, args, registryServer) {
  const suffix = "_spec_";
  const isRegistryTool = tool.startsWith(`${registryServer}_`);
  const logical = isRegistryTool ? tool.slice(registryServer.length + 1) : null;

  if (logical !== null && logical.startsWith("spec_")) {
    return { event: { toolName: `${DEFAULT_MCP_FAMILY}${logical}`, input: args ?? {} }, mode: "mcp" };
  }
  const marker = tool.lastIndexOf(suffix);
  if (marker >= 0) {
    // Any other MCP server that exposes the same operation is refused by its
    // short name, so the decision code names the real problem.
    return { event: { toolName: tool.slice(marker + 1), input: args ?? {} }, mode: "mcp" };
  }
  if (tool.startsWith("spec_")) {
    return { event: { toolName: tool, input: args ?? {} }, mode: "mcp" };
  }

  const targets = targetsFromArgs(tool, args);
  if (targets === null) return { event: { toolName: tool, input: {} }, mode: "direct" };
  if (targets.indeterminate) return { event: { toolName: tool, input: { path: null } }, mode: "direct" };
  return { event: { toolName: tool, input: targets }, mode: "direct" };
}

export function createGuard({ directory, config, classifier, loadConfig = loadGuardConfig }) {
  if (typeof classifier !== "function") throw new Error("SPEC_HOOK_FAILED: classifier is required");
  const guardConfig = config ?? loadConfig();
  const registryServer = guardConfig?.registryServer;
  if (typeof registryServer !== "string" || registryServer.length === 0) {
    throw new Error("SPEC_HOOK_FAILED: spec-kit-guard.json has no registryServer");
  }
  if (!registryTransportIsRemote(registryServer, guardConfig, homedir())) {
    throw new Error("SPEC_HOOK_FAILED: the registry MCP server must be configured as type remote");
  }
  const root = path.resolve(directory ?? process.cwd());

  return {
    "tool.execute.before": async (input, output) => {
      try {
        const tool = typeof input?.tool === "string" ? input.tool : "";
        if (tool === "") throw new Error("tool name is missing");
        const { event, mode } = toClassifierEvent(tool, output?.args ?? {}, registryServer);
        const decision = classifier(event, { root, allTools: null });
        if (decision?.action === "block") {
          throw new Error(typeof decision.reason === "string" ? decision.reason : `SPEC_HOOK_BLOCKED: ${decision.code}`);
        }
        if (mode === "mcp" && decision?.action !== "allow") {
          throw new Error("SPEC_HOOK_FAILED: MCP call was not authorized");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message.startsWith("SPEC_HOOK_") ? message : `SPEC_HOOK_FAILED: ${message}`);
      }
    },
  };
}

/** OpenCode entry point: loads the packaged classifier, then creates the guard. */
export const OmpSpecKitGuard = async ({ directory }) => {
  const { classifyToolCall } = await import(new URL("../../dist/enforcement/classifier.js", import.meta.url).href);
  return createGuard({ directory, classifier: classifyToolCall });
};
