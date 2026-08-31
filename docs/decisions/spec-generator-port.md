# Spec-generator port destination

- Decision status: accepted destination map.
- Current release profile: v0.3.2, eight read-only MCP tools.
- Planned release profiles: v0.4.0 read-complete, v0.5.0 evidence/navigation, v0.6.0 safe authoring.
- Agent-facing spec API: MCP. OMP LSP remains editor/MCP-internal transport.
- Source census: `dev-pomogator/tools/spec-mcp-server/tools.ts` at the audited repair baseline.
- Source registry SHA-256: `200cd8cf44bd9b1059ec8942cbf74104e1dab7f7e66a3f8fc44a682821f3c3e8`.

## Invariants

1. The eight v0.3.2 MCP names remain registered in every later profile.
2. Every destination row has an owner and a release stage. A not-yet-shipped row is deferred, never silently dropped.
3. LSP navigation is not a replacement for the agent-facing MCP API.
4. Mutations are proposal-first and require the accepted authority/enforcement profile.
5. The census counts destination operations, not the number exposed by the current release.

## v0.3.2 shipped first slice

| MCP name | Kernel operation | Destination relation |
|---|---|---|
| `spec_inventory` | `inventory` | first-slice corpus inventory |
| `spec_get_node` | `getNode` | destination `get_node` adapter |
| `spec_find_nodes` | `findNodes` | destination `search` adapter |
| `spec_get_edges` | `getEdges` | destination `find_refs` adapter |
| `spec_trace` | `trace` | destination `get_trace` adapter |
| `spec_diagnostics` | `diagnostics` | destination `conformance_check` adapter |
| `spec_overview` | `overview` | partial `get_spec_status` view |
| `spec_markdown_inventory` | `markdownInventory` | kernel markdown inventory |

These eight names are compatibility aliases, not an eternal registry-size limit.

## Closed 46-name destination census

Stage values are `v0.3.2`, `v0.4.0-read-complete`, `v0.5.0-evidence`, `v0.6.0-authoring-v1`, and `v0.6.0-authoring-v2`.

| # | Upstream name | Owner | Stage | Surface |
|---:|---|---|---|---|
| 1 | `get_node` | spec-kernel | v0.3.2 alias `spec_get_node` | kernel query |
| 2 | `search` | spec-kernel | v0.3.2 alias `spec_find_nodes` | kernel query |
| 3 | `find_refs` | spec-kernel | v0.3.2 alias `spec_get_edges` | kernel query |
| 4 | `get_trace` | spec-kernel | v0.3.2 alias `spec_trace` | kernel query |
| 5 | `conformance_check` | spec-kernel | v0.3.2 alias `spec_diagnostics` | kernel query |
| 6 | `find_by_tags` | spec-kernel | v0.4.0-read-complete | kernel query |
| 7 | `list_tasks` | spec-kernel | v0.4.0-read-complete | kernel query |
| 8 | `list_phase_tasks` | spec-kernel | v0.4.0-read-complete | kernel query |
| 9 | `find_orphans` | spec-kernel | v0.4.0-read-complete | kernel query |
| 10 | `validate_anchor` | spec-kernel | v0.4.0-read-complete | kernel query |
| 11 | `list_specs` | spec-kernel | v0.4.0-read-complete | kernel query |
| 12 | `validate_requirement_metadata` | spec-kernel | v0.4.0-read-complete | kernel query |
| 13 | `policy_query_requirements` | spec-kernel | v0.4.0-read-complete | kernel query |
| 14 | `get_archival_proof` | spec-kernel | v0.4.0-read-complete | kernel query |
| 15 | `validate_spec` | spec-kernel | v0.4.0-read-complete | kernel query |
| 16 | `get_spec_status` | spec-kernel | v0.4.0-read-complete | query/status projection |
| 17 | `mcp_preflight` | spec-kernel | v0.4.0-read-complete | MCP adapter |
| 18 | `list_spec_docs` | spec-kernel | v0.4.0-read-complete | contained document read |
| 19 | `read_spec_doc` | spec-kernel | v0.4.0-read-complete | contained document read |
| 20 | `read_attachment` | spec-kernel | v0.4.0-read-complete | contained binary read |
| 21 | `get_test_result` | spec-evidence | v0.5.0-evidence | evidence read |
| 22 | `get_scenario_trace` | spec-evidence | v0.5.0-evidence | evidence read |
| 23 | `propose_spec_change` | spec-authoring-workflow | v0.6.0-authoring-v1 | proposal |
| 24 | `apply_spec_change` | spec-authoring-workflow | v0.6.0-authoring-v1 | apply |
| 25 | `propose_patch` | spec-authoring-workflow | v0.6.0-authoring-v1 | proposal |
| 26 | `apply_proposed_patch` | spec-authoring-workflow | v0.6.0-authoring-v1 | apply |
| 27 | `apply_spec_transaction` | spec-authoring-workflow | v0.6.0-authoring-v1 | apply |
| 28 | `append_to_section` | spec-authoring-workflow | v0.6.0-authoring-v1 | mutation facade |
| 29 | `insert_after_heading` | spec-authoring-workflow | v0.6.0-authoring-v1 | mutation facade |
| 30 | `insert_at_eof` | spec-authoring-workflow | v0.6.0-authoring-v1 | mutation facade |
| 31 | `replace_in_section` | spec-authoring-workflow | v0.6.0-authoring-v1 | mutation facade |
| 32 | `amend_requirement` | spec-authoring-workflow | v0.6.0-authoring-v1 | mutation facade |
| 33 | `add_acceptance_criterion` | spec-authoring-workflow | v0.6.0-authoring-v1 | mutation facade |
| 34 | `add_phase` | spec-authoring-workflow | v0.6.0-authoring-v1 | mutation facade |
| 35 | `set_entity_status` | spec-authoring-workflow | v0.6.0-authoring-v1 | lifecycle facade |
| 36 | `set_spec_status` | spec-authoring-workflow | v0.6.0-authoring-v2 | lifecycle facade |
| 37 | `set_requirement_metadata` | spec-authoring-workflow | v0.6.0-authoring-v1 | proposal helper |
| 38 | `propose_requirement_contract` | spec-authoring-workflow | v0.6.0-authoring-v1 | proposal |
| 39 | `propose_spec_repairs` | spec-authoring-workflow | v0.6.0-authoring-v1 | proposal |
| 40 | `apply_spec_repairs` | spec-authoring-workflow | v0.6.0-authoring-v1 | apply |
| 41 | `delete_spec_doc` | spec-authoring-workflow | v0.6.0-authoring-v2 | document lifecycle |
| 42 | `rename_spec_doc` | spec-authoring-workflow | v0.6.0-authoring-v2 | document lifecycle |
| 43 | `create_spec` | spec-authoring-workflow | v0.6.0-authoring-v2 | document lifecycle |
| 44 | `archive_spec` | spec-authoring-workflow | v0.6.0-authoring-v2 | document lifecycle |
| 45 | `add_backlog_task` | spec-authoring-workflow | v0.6.0-authoring-v2 | task facade |
| 46 | `register_incident_backlog` | spec-authoring-workflow | v0.6.0-authoring-v2 | task facade |

Count: 46. No silent DROP.

## MCP versus LSP

- Agents discover and call spec operations through MCP.
- OMP LSP may expose editor diagnostics and internal navigation; it is not the public spec registry.
- MCP may reuse the kernel and LSP internally without changing that boundary.

## Current and historical identity

The v0.3.2 release contract proves exactly eight current tools. Historical v17 receipts remain immutable evidence of the earlier runtime. Future profiles must carry separate versioned OMP and installed-package receipts.
