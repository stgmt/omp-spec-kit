import { TOOL_AUTHORITY_ABI } from "../adapters/tool-contracts.js";
const AUTHORING_TOOL_NAMES = new Set([
  "propose_spec_change",
  "apply_spec_change",
  "propose_patch",
  "apply_proposed_patch",
  "apply_spec_transaction",
  "append_to_section",
  "insert_after_heading",
  "insert_at_eof",
  "replace_in_section",
  "amend_requirement",
  "add_acceptance_criterion",
  "add_phase",
  "set_entity_status",
  "set_spec_status",
  "set_requirement_metadata",
  "propose_requirement_contract",
  "propose_spec_repairs",
  "apply_spec_repairs",
  "delete_spec_doc",
  "rename_spec_doc",
  "create_spec",
  "archive_spec",
  "add_backlog_task",
  "register_incident_backlog",
]);

const DIRECT_MUTATION_TOOLS = new Set(["write", "edit", "bash", "apply_patch", "delete", "rename"]);
const PATH_KEYS = new Set(["path", "paths", "file", "files", "document", "documents", "cwd", "command", "text"]);

function textValues(value, key = "") {
  if (typeof value === "string") return PATH_KEYS.has(key) || key === "" ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((entry) => textValues(entry, key));
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([name, entry]) => textValues(entry, name));
  return [];
}

function targetsSpecs(input) {
  return textValues(input).some((value) => /(?:^|[\\/])\.specs(?:[\\/]|$)/u.test(value) || value.includes(".specs/"));
}

const AUTHORITY_PROVIDER_KINDS = new Set(["builtin", "extension", "mcp", "sdk", "unknown"]);

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

export function classifyToolCall(event, options = {}) {
  const toolName = typeof event?.toolName === "string" ? event.toolName : "";
  const input = event?.input ?? {};
  const authorityName = typeof event?.authority?.sourceToolName === "string" ? event.authority.sourceToolName : toolName;
  const authoring = AUTHORING_TOOL_NAMES.has(toolName) || AUTHORING_TOOL_NAMES.has(authorityName);
  const mutation = DIRECT_MUTATION_TOOLS.has(toolName) || authoring || toolName.includes("_spec_") || toolName.includes("spec_");
  const touchesSpecs = targetsSpecs(input) || (authoring && authorityName !== "propose_patch" && authorityName !== "propose_spec_change");
  if (!mutation || !touchesSpecs) return { action: "continue", toolName, touchesSpecs: false, mismatchField: null };
  if (!authoring) {
    return { action: "block", toolName, touchesSpecs: true, mismatchField: "toolName", reason: `direct mutation of .specs is forbidden for ${toolName}` };
  }
  const mismatchField = authorityMismatch(toolName, authorityName, event?.authority);
  if (mismatchField) {
    return { action: "block", toolName, touchesSpecs: true, mismatchField, reason: `specification mutation requires omp-spec-kit authority (${mismatchField} mismatch)` };
  }
  if (options.requireApproval !== false && authorityName.startsWith("apply_") && input.approval !== "approve") {
    return { action: "block", toolName, touchesSpecs: true, mismatchField: "approval", reason: "specification mutation requires explicit approval=approve" };
  }
  return { action: "allow", toolName, touchesSpecs: true, mismatchField: null };
}

export { AUTHORING_TOOL_NAMES, DIRECT_MUTATION_TOOLS };
