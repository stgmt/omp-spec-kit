import { TOOL_AUTHORITY_ABI } from "../adapters/tool-contracts.js";
import { decidePathPolicy } from "./resolve-targets.js";

const AUTHORING_TOOL_NAMES = new Set(["propose_patch", "apply_proposed_patch", "propose_spec_change", "apply_spec_change", "apply_spec_transaction", "apply_spec_repairs"]);
const DIRECT_MUTATION_TOOLS = new Set(["write", "edit", "bash", "apply_patch", "delete", "rename"]);
const PATH_KEYS = new Set(["path", "paths", "file", "files", "document", "documents", "cwd", "command", "text"]);
const AUTHORITY_PROVIDER_KINDS = new Set(["builtin", "extension", "mcp", "sdk", "unknown"]);

function textValues(value, key = "") {
  if (typeof value === "string") return PATH_KEYS.has(key) || key === "" ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((entry) => textValues(entry, key));
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([name, entry]) => textValues(entry, name));
  return [];
}

function hasLexicalSpecTarget(values) {
  return values.some((value) => /(?:^|[\\/])\.specs(?:[\\/]|$)/u.test(value) || value.includes(".specs/"));
}

function authorityMismatch(registeredName, logicalName, authority) {
  if (!authority) return "authority";
  if (authority.abi !== TOOL_AUTHORITY_ABI) return "abi";
  if (!AUTHORITY_PROVIDER_KINDS.has(authority.providerKind)) return "providerKind";
  if (authority.providerKind !== "mcp") return "providerKind";
  if (typeof authority.sourcePath !== "string" || authority.sourcePath.trim() === "") return "sourcePath";
  if (authority.registeredName !== registeredName) return "registeredName";
  if (authority.serverId !== "omp-spec-kit" && authority.serverId !== "omp-spec-kit:omp-spec-kit") return "serverId";
  if (authority.sourceToolName !== logicalName) return "sourceToolName";
  if (!/^[0-9a-f]{64}$/u.test(authority.inputSchemaSha256)) return "inputSchemaSha256";
  if (!/^[0-9a-f]{64}$/u.test(authority.registrySnapshotSha256)) return "registrySnapshotSha256";
  return null;
}

function boundedReason(code, relativePath = null) {
  const target = typeof relativePath === "string" && relativePath !== "" && !/^[a-z]:[\\/]/iu.test(relativePath) && !relativePath.startsWith("/")
    ? ` target=${relativePath}`
    : "";
  const reason = `${code}:${target} use propose_patch then apply_proposed_patch`;
  return Buffer.byteLength(reason, "utf8") <= 512 ? reason : `${reason.slice(0, 500)}…`;
}

function blocked(toolName, code, resolutions = [], mismatchField = null) {
  const relativePath = resolutions.find((item) => typeof item.relativePath === "string")?.relativePath ?? null;
  return {
    action: "block",
    code,
    toolName,
    touchesSpecs: code !== "TARGET_INDETERMINATE" || resolutions.length > 0,
    mismatchField: mismatchField ?? (code === "UNREGISTERED_AUTHORING_CALL" ? "authority" : null),
    reason: boundedReason(code, relativePath),
  };
}

export function classifyToolCall(event, options = {}) {
  const toolName = typeof event?.toolName === "string" ? event.toolName : "";
  const input = event?.input ?? {};
  const authorityName = typeof event?.authority?.sourceToolName === "string" ? event.authority.sourceToolName : toolName;
  const authoring = AUTHORING_TOOL_NAMES.has(toolName) || AUTHORING_TOOL_NAMES.has(authorityName);
  const directMutation = DIRECT_MUTATION_TOOLS.has(toolName) || toolName.includes("_spec_") || toolName.includes("spec_");
  const targets = textValues(input);

  if (authoring) {
    const mismatchField = authorityMismatch(toolName, authorityName, event?.authority);
    if (mismatchField) return blocked(toolName, "UNREGISTERED_AUTHORING_CALL", [], mismatchField);
    if (options.requireApproval !== false && authorityName === "apply_proposed_patch" && input.approval !== "approve") {
      return blocked(toolName, "APPROVAL_REQUIRED");
    }
    return { action: "allow", code: "AUTHORING_TOOL_ALLOWED", toolName, touchesSpecs: true, mismatchField: null };
  }

  if (!directMutation && targets.length === 0) return { action: "continue", toolName, touchesSpecs: false, mismatchField: null };
  const policy = decidePathPolicy(options.root ?? event?.cwd ?? process.cwd(), targets);
  if (policy.decision === "ALLOW") {
    return directMutation
      ? { action: "continue", code: "NON_SPEC_ALLOWED", toolName, touchesSpecs: false, mismatchField: null }
      : { action: "continue", toolName, touchesSpecs: false, mismatchField: null };
  }
  return blocked(toolName, policy.code, policy.resolutions);
}

export { AUTHORING_TOOL_NAMES, DIRECT_MUTATION_TOOLS };
