/**
 * Map one Codex PreToolUse payload to the shared classifier event.
 *
 * Codex reports `Bash` for shell calls, `apply_patch` for file edits (with the
 * patch text in `tool_input.command`), and `mcp__<server>__<tool>` for MCP
 * tools. The registry server is configured as `spec_registry`, so only
 * `mcp__spec_registry__spec_patch` is minted into the authorized family; any
 * other spelling becomes a short name and is refused by the classifier.
 */
const PATCH_PATHS = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/gmu;

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "") ?? null;
}

export function toClassifierEvent(payload, { registryServer = "spec_registry" } = {}) {
  const toolName = typeof payload?.tool_name === "string" ? payload.tool_name : "";
  const input = payload?.tool_input ?? {};
  const cwd = typeof payload?.cwd === "string" && payload.cwd !== "" ? payload.cwd : process.cwd();

  if (toolName === "Bash") {
    return { event: { toolName: "bash", input: { command: firstString(input.command) ?? "" } }, root: cwd };
  }
  if (toolName === "apply_patch" || toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") {
    const text = firstString(input.command, input.patch, input.patchText);
    if (text !== null) {
      const paths = [...text.matchAll(PATCH_PATHS)].map((match) => match[1].trim());
      return { event: { toolName: "edit", input: paths.length > 0 ? { paths } : { command: text } }, root: cwd };
    }
    const target = firstString(input.file_path, input.filePath, input.path);
    return { event: { toolName: "edit", input: target === null ? {} : { path: target } }, root: cwd };
  }

  if (toolName.startsWith("mcp__")) {
    const [, server, ...rest] = toolName.split("__");
    const logical = rest.join("__");
    if (server === registryServer && logical.startsWith("spec_")) {
      return { event: { toolName: `mcp__omp_spec_kit_${logical}`, input }, root: cwd };
    }
    return { event: { toolName: logical === "" ? toolName : logical, input }, root: cwd };
  }

  return { event: { toolName, input }, root: cwd };
}
