# OMP Spec Kit MCP Runtime Census — v0.6.0

- **Date**: 2026-09-02
- **Stage**: `v0.6.0` (49 tools)
- **JSON Source**: `audit-reports/omp-spec-kit-mcp-runtime-census-2026-09-02.json`
- **Architecture**: Single MCP server exposing all 49 tools; OMP extension provides only fail-closed `.specs` access gate.
- **Mutating Operations**: 4 (`apply_spec_change`, `apply_proposed_patch`, `apply_spec_transaction`, `apply_spec_repairs`), all other 45 tools have `readOnlyHint: true`.

---

## Tool Roster & Execution Census

| # | Tool Name | Kind | ReadOnlyHint | Status |
|---|---|---|---|---|
| 1 | `spec_inventory` | Query | `true` | Passed |
| 2 | `spec_get_node` | Query | `true` | Passed |
| 3 | `spec_find_nodes` | Query | `true` | Passed |
| 4 | `spec_get_edges` | Query | `true` | Passed |
| 5 | `spec_trace` | Query | `true` | Passed |
| 6 | `spec_diagnostics` | Query | `true` | Passed |
| 7 | `spec_overview` | Query | `true` | Passed |
| 8 | `spec_markdown_inventory` | Query | `true` | Passed |
| 9 | `find_by_tags` | Query | `true` | Passed |
| 10 | `list_tasks` | Query | `true` | Passed |
| 11 | `list_phase_tasks` | Query | `true` | Passed |
| 12 | `find_orphans` | Query | `true` | Passed |
| 13 | `validate_anchor` | Query | `true` | Passed |
| 14 | `list_specs` | Query | `true` | Passed |
| 15 | `validate_requirement_metadata` | Query | `true` | Passed |
| 16 | `policy_query_requirements` | Query | `true` | Passed |
| 17 | `get_archival_proof` | Query | `true` | Passed |
| 18 | `validate_spec` | Query | `true` | Passed |
| 19 | `get_spec_status` | Query | `true` | Passed |
| 20 | `mcp_preflight` | Query | `true` | Passed |
| 21 | `list_spec_docs` | Query | `true` | Passed |
| 22 | `read_spec_doc` | Query | `true` | Passed |
| 23 | `read_attachment` | Evidence | `true` | Passed |
| 24 | `get_test_result` | Evidence | `true` | Passed |
| 25 | `get_scenario_trace` | Evidence | `true` | Passed |
| 26 | `propose_spec_change` | Authoring (Proposal) | `true` | Passed |
| 27 | `apply_spec_change` | Authoring (Apply) | `false` | Passed |
| 28 | `propose_patch` | Authoring (Proposal) | `true` | Passed |
| 29 | `apply_proposed_patch` | Authoring (Apply) | `false` | Passed |
| 30 | `apply_spec_transaction` | Authoring (Apply) | `false` | Passed |
| 31 | `append_to_section` | Authoring (Proposal) | `true` | Passed |
| 32 | `insert_after_heading` | Authoring (Proposal) | `true` | Passed |
| 33 | `insert_at_eof` | Authoring (Proposal) | `true` | Passed |
| 34 | `replace_in_section` | Authoring (Proposal) | `true` | Passed |
| 35 | `amend_requirement` | Authoring (Proposal) | `true` | Passed |
| 36 | `add_acceptance_criterion` | Authoring (Proposal) | `true` | Passed |
| 37 | `add_phase` | Authoring (Proposal) | `true` | Passed |
| 38 | `set_entity_status` | Authoring (Proposal) | `true` | Passed |
| 39 | `set_spec_status` | Authoring (Proposal) | `true` | Passed |
| 40 | `set_requirement_metadata` | Authoring (Proposal) | `true` | Passed |
| 41 | `propose_requirement_contract` | Authoring (Proposal) | `true` | Passed |
| 42 | `propose_spec_repairs` | Authoring (Proposal) | `true` | Passed |
| 43 | `apply_spec_repairs` | Authoring (Apply) | `false` | Passed |
| 44 | `delete_spec_doc` | Authoring (Proposal) | `true` | Passed |
| 45 | `rename_spec_doc` | Authoring (Proposal) | `true` | Passed |
| 46 | `create_spec` | Authoring (Proposal) | `true` | Passed |
| 47 | `archive_spec` | Authoring (Proposal) | `true` | Passed |
| 48 | `add_backlog_task` | Authoring (Proposal) | `true` | Passed |
| 49 | `register_incident_backlog` | Authoring (Proposal) | `true` | Passed |

---

## Verdict

- Total MCP tools: **49**
- Mutating tools: **4** (all others dry-run/read-only)
- Dogfood execution: **100% passed** (0 errors)
