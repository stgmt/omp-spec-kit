# Spec-generator port destination

- Decision status: accepted destination map.
- Single surface since v0.8.0: 38 tools, no release profiles. Historical profile rows below are retired.
- Agent-facing spec API: MCP. OMP LSP remains editor/MCP-internal transport.
- Source census: `dev-pomogator/tools/spec-mcp-server/tools.ts` at the audited repair baseline.
- Source registry SHA-256: `200cd8cf44bd9b1059ec8942cbf74104e1dab7f7e66a3f8fc44a682821f3c3e8`.

## Invariants

1. The eight v0.3.2 MCP names remain registered in every later profile.
2. Every destination row has an owner. A not-yet-shipped row is deferred, never silently dropped.
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

## Closed 35-name destination census

Single surface since v0.8.0: every row below is served; historical stage values are retired.

| # | Upstream name | Owner | Stage | Surface |
|---:|---|---|---|---|
| 1 | `get_node` | spec-mcp-operations / Read | single surface  | kernel query |
| 2 | `search` | spec-mcp-operations / Read | single surface  | kernel query |
| 3 | `find_refs` | spec-mcp-operations / Read | single surface  | kernel query |
| 4 | `get_trace` | spec-mcp-operations / Read | single surface  | kernel query |
| 5 | `conformance_check` | spec-mcp-operations / Read | single surface  | kernel query |
| 6 | `find_by_tags` | spec-mcp-operations / Read | single surface  | kernel query |
| 7 | `list_tasks` | spec-mcp-operations / Read | single surface  | kernel query |
| 8 | `find_orphans` | spec-mcp-operations / Read | single surface  | kernel query |
| 9 | `validate_anchor` | spec-mcp-operations / Read | single surface  | kernel query |
| 10 | `list_specs` | spec-mcp-operations / Read | single surface  | kernel query |
| 11 | `validate_requirement_metadata` | spec-mcp-operations / Read | single surface  | kernel query |
| 12 | `policy_query_requirements` | spec-mcp-operations / Read | single surface  | kernel query |
| 13 | `get_archival_proof` | spec-mcp-operations / Read | single surface  | kernel query |
| 14 | `validate_spec` | spec-mcp-operations / Read | single surface  | kernel query |
| 15 | `get_spec_status` | spec-mcp-operations / Read | single surface  | query/status projection |
| 16 | `mcp_preflight` | spec-mcp-operations / Read | single surface  | MCP adapter |
| 17 | `list_spec_docs` | spec-mcp-operations / Read | single surface  | contained document read |
| 18 | `read_spec_doc` | spec-mcp-operations / Read | single surface  | contained document read |
| 19 | `read_attachment` | spec-mcp-operations / Read | single surface  | contained binary read |
| 20 | `get_test_result` | spec-mcp-operations / Read | single surface  | evidence read |
| 21 | `get_scenario_trace` | spec-mcp-operations / Read | single surface  | evidence read |
| 22 | `propose_patch` | spec-mcp-operations / Write | single surface  | proposal |
| 23 | `apply_proposed_patch` | spec-mcp-operations / Write | single surface  | apply |
| 24 | `amend_requirement` | spec-mcp-operations / Write | single surface  | mutation facade |
| 25 | `add_acceptance_criterion` | spec-mcp-operations / Write | single surface  | mutation facade |
| 26 | `add_phase` | spec-mcp-operations / Write | single surface  | mutation facade |
| 27 | `set_entity_status` | spec-mcp-operations / Write | single surface  | lifecycle facade |
| 28 | `set_spec_status` | spec-mcp-operations / Write | single surface  | lifecycle facade |
| 29 | `set_requirement_metadata` | spec-mcp-operations / Write | single surface  | proposal helper |
| 30 | `delete_spec_doc` | spec-mcp-operations / Write | single surface  | document lifecycle |
| 31 | `rename_spec_doc` | spec-mcp-operations / Write | single surface  | document lifecycle |
| 32 | `create_spec` | spec-mcp-operations / Write | single surface  | document lifecycle |
| 33 | `archive_spec` | spec-mcp-operations / Write | single surface  | document lifecycle |
| 34 | `add_backlog_task` | spec-mcp-operations / Write | single surface  | task facade |
| 35 | `register_incident_backlog` | spec-mcp-operations / Write | single surface  | task facade |

Count: 46. No silent DROP.

## MCP versus LSP

- Agents discover and call spec operations through MCP.
- OMP LSP may expose editor diagnostics and internal navigation; it is not the public spec registry.
- MCP may reuse the kernel and LSP internally without changing that boundary.

## Current and historical identity

The v0.3.2 release contract proves exactly eight current tools. Historical v17 receipts remain immutable evidence of the earlier runtime. Future profiles must carry separate versioned OMP and installed-package receipts.
