# Spec-generator port destination

- **Decision status:** Accepted for specification
- **Implementation status:** `SPEC_ONLY` for growth beyond the v0.3 first slice
- **Decision scope:** what the agent calls, what v0.3 proved, and who owns each upstream MCP name
- **Upstream census:** `dev-pomogator` `tools/spec-mcp-server/tools.ts` `name:` fields (research, not a code import)
- **Source registry SHA-256:** `200cd8cf44bd9b1059ec8942cbf74104e1dab7f7e66a3f8fc44a682821f3c3e8` (`tools/spec-mcp-server/tools.ts` at the audited repair baseline)
- **Ratchet:** `npm run check:spec-port` requires 46 unique source/decision names, numbering 1..46, non-empty owners/stages, and all eight historical v0.3 first-slice names.

## Invariants

1. This product is the OMP port of the `dev-pomogator` spec-generator door.
2. The agent-facing spec API is MCP only. Host `lsp` is not a spec tool. LSP may run so MCP and the editor can consume kernel diagnostics/navigation.
3. The eight SCHEMA-11 names in `src/mcp/server.js` are the **v0.3 first slice**. They are not the destination registry. Growing MCP SHALL NOT delete them.
4. Every row in the 46-name census has an owner spec and a stage. Silent DROP is forbidden. Schema v1 of authoring omitting a name is `later`, not DROP.
5. Forbidden destination claims (unless they explicitly say first slice / v0.3 candidate identity): “not the 46-tool door”, “there is no 46-tool door to prune”, “46-tool door is upstream, not this product”, “agent navigating spec definitions through LSP primitives”, “MCP registry SHALL remain the eight”, “this FR SHALL NOT add a ninth MCP tool”, “MCP remains eight tools” as an eternal invariant.

## v0.3 first slice (keep forever)

These eight MCP names are the current v0.3 proof (`spec-kernel:AC-9.1`, `mcp-release-integrity:FR-3`). They stay registered when later names are added.

| v0.3 MCP name | Kernel op (`spec-kernel:FR-8`) | Closest upstream `tools.ts` name | Note |
|---|---|---|---|
| `spec_inventory` | `inventory` | *(none of the 46)* | First-slice corpus inventory. `list_specs` is a later FR-16 slug list, not this tool. |
| `spec_get_node` | `getNode` | `get_node` | |
| `spec_find_nodes` | `findNodes` | `search` | |
| `spec_get_edges` | `getEdges` | `find_refs` | |
| `spec_trace` | `trace` | `get_trace` | |
| `spec_diagnostics` | `diagnostics` | `conformance_check` | |
| `spec_overview` | `overview` | `get_spec_status` (partial) | Full status/coverage views are later FR-16 `specStatus`. Do not delete `spec_overview`. |
| `spec_markdown_inventory` | `markdownInventory` | *(none of the 46)* | Kernel-only first slice. |

## Closed 46-name census

Stage values: `v0.3-first-slice` (already mapped onto a SCHEMA-11 name), `later-kernel-fr16`, `later-kernel-fr17`, `later-evidence`, `later-authoring-v1`, `later-authoring-v2`.

`later-authoring-v1` = seventeen MCP facades with exact proposal-first mappings. `later-authoring-v2` = seven named mutations not representable in v1 (`set_spec_status`, create/archive/doc CRUD/backlog helpers). Both remain product destination, never DROP.

| # | Upstream name | Owner | Stage | Agent-visible MCP later? | Kernel vs adapter |
|---:|---|---|---|---|---|
| 1 | `get_node` | `spec-kernel` FR-8 / FR-9 | v0.3-first-slice as `spec_get_node` | yes (already) | kernel query |
| 2 | `search` | `spec-kernel` FR-8 / FR-9 | v0.3-first-slice as `spec_find_nodes` | yes (already) | kernel query |
| 3 | `find_refs` | `spec-kernel` FR-8 / FR-9 | v0.3-first-slice as `spec_get_edges` | yes (already) | kernel query |
| 4 | `get_trace` | `spec-kernel` FR-8 / FR-9 | v0.3-first-slice as `spec_trace` | yes (already) | kernel query |
| 5 | `conformance_check` | `spec-kernel` FR-8 / FR-9 | v0.3-first-slice as `spec_diagnostics` | yes (already) | kernel query |
| 6 | `find_by_tags` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 7 | `list_tasks` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 8 | `list_phase_tasks` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 9 | `find_orphans` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 10 | `validate_anchor` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 11 | `list_specs` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 12 | `validate_requirement_metadata` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 13 | `policy_query_requirements` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 14 | `get_archival_proof` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 15 | `validate_spec` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added | kernel query |
| 16 | `get_spec_status` | `spec-kernel` FR-16 | later-kernel-fr16 | yes, added beside `spec_overview` | kernel query |
| 17 | `mcp_preflight` | `spec-kernel` FR-17 | later-kernel-fr17 | yes, added | MCP adapter I/O |
| 18 | `list_spec_docs` | `spec-kernel` FR-17 | later-kernel-fr17 | yes, added | MCP adapter I/O |
| 19 | `read_spec_doc` | `spec-kernel` FR-17 | later-kernel-fr17 | yes, added | MCP adapter I/O |
| 20 | `read_attachment` | `spec-kernel` FR-17 | later-kernel-fr17 | yes, added | MCP adapter I/O |
| 21 | `get_test_result` | `spec-evidence` | later-evidence | yes, after evidence layer | evidence eval, not kernel FR-8 |
| 22 | `get_scenario_trace` | `spec-evidence` | later-evidence | yes, after evidence layer | evidence eval, not kernel FR-8 |
| 23 | `propose_spec_change` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation (dry-run) |
| 24 | `apply_spec_change` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 25 | `propose_patch` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation (dry-run) |
| 26 | `apply_proposed_patch` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 27 | `apply_spec_transaction` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 28 | `append_to_section` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 29 | `insert_after_heading` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 30 | `insert_at_eof` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 31 | `replace_in_section` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 32 | `amend_requirement` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 33 | `add_acceptance_criterion` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 34 | `add_phase` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 35 | `set_entity_status` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 36 | `set_spec_status` | `spec-authoring-workflow` | later-authoring-v2 | yes, later schema | mutation |
| 37 | `set_requirement_metadata` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation helper |
| 38 | `propose_requirement_contract` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation (dry-run) |
| 39 | `propose_spec_repairs` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation (dry-run) |
| 40 | `apply_spec_repairs` | `spec-authoring-workflow` | later-authoring-v1 | yes, after authoring gate | mutation |
| 41 | `delete_spec_doc` | `spec-authoring-workflow` | later-authoring-v2 | yes, later schema | mutation |
| 42 | `rename_spec_doc` | `spec-authoring-workflow` | later-authoring-v2 | yes, later schema | mutation |
| 43 | `create_spec` | `spec-authoring-workflow` | later-authoring-v2 | yes, later schema | mutation |
| 44 | `archive_spec` | `spec-authoring-workflow` | later-authoring-v2 | yes, later schema | mutation |
| 45 | `add_backlog_task` | `spec-authoring-workflow` | later-authoring-v2 | yes, later schema | mutation; not the dropped dev-pomogator backlog dashboard |
| 46 | `register_incident_backlog` | `spec-authoring-workflow` | later-authoring-v2 | yes, later schema | mutation; not the dropped harness backlog |

Count: 46. No silent DROP.

## What is actually DROP

Already in `MIGRATION_MATRIX.md`, not rows of this census: Claude Marksman plugin, Claude hook families, advisor/dashboard/harness backlog UI, other-host adapters. Those are not generator-door MCP tools.

## MCP vs LSP

- Agent inventory: MCP spec tools only.
- Editor: OMP `lsp.diagnosticsOnWrite` may show kernel diagnostics via the LSP adapter.
- MCP MAY call kernel or LSP internally for definition/references/diagnostics. That is not “wrapping LSP as the agent API” and does not defeat editor diagnostics.

## v0.3 candidate identity

`mcp-release-integrity` proving “exactly eight SCHEMA-11 tools” remains valid for that release lineage. It is first-slice evidence, not a promise that later stages cannot add read tools.
