// Central registry of removed tools and their replacements.
//
// Single source of truth for tool-surface evolution: the MCP server's
// unknown-tool errors derive from here. Never duplicate this mapping
// in server code, docs, or tests — point at it instead.

export const RETIRED_TOOLS = Object.freeze({
  apply_spec_change: { use: "apply_proposed_patch", detail: "identical arguments" },
  apply_spec_transaction: { use: "apply_proposed_patch", detail: "multi-document proposals apply in one call" },
  apply_spec_repairs: { use: "apply_proposed_patch", detail: "identical arguments" },
  append_to_section: { use: "propose_patch", detail: 'operations: [{ kind: "append_to_section", document, heading, text }]' },
  insert_after_heading: { use: "propose_patch", detail: 'operations: [{ kind: "insert_after_heading", document, heading, text }]' },
  insert_at_eof: { use: "propose_patch", detail: 'operations: [{ kind: "insert_at_eof", document, text }]' },
  replace_in_section: { use: "propose_patch", detail: 'operations: [{ kind: "replace_in_section", document, heading, oldText, newText }]' },
  propose_spec_change: { use: "propose_patch", detail: "operations: [{ kind, document, ...change }] (replace_document needs content)" },
  propose_spec_repairs: { use: "propose_patch", detail: "operations set to the repairs array" },
  propose_requirement_contract: { use: "set_requirement_metadata", detail: "metadata set to the contract object" },
  list_phase_tasks: { use: "list_tasks", detail: "with the phase filter" },
});

export function retiredToolHint(name) {
  const entry = RETIRED_TOOLS[name];
  if (entry === undefined) return null;
  return `Unknown tool: ${name} (removed in v0.8.0; use ${entry.use} instead — ${entry.detail})`;
}
