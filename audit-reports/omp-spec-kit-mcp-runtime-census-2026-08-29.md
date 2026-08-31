# omp-spec-kit MCP runtime census — 2026-08-29

## Decision

The repository-built v0.3.2 MCP server exposes exactly eight read-only tools. Every registered tool returned a bounded, structured result from the current eight-specification corpus. The report is the runtime baseline for the shipped compatibility profile; future release stages are additive.

## Runtime results

| Tool | Result | Structured result bytes |
|---|---|---:|
| `spec_inventory` | PASS | 2868 |
| `spec_get_node` | PASS | 1139 |
| `spec_find_nodes` | PASS | 5603 |
| `spec_get_edges` | PASS | 1967 |
| `spec_trace` | PASS | 4133 |
| `spec_diagnostics` | PASS | 7839 |
| `spec_overview` | PASS | 2612 |
| `spec_markdown_inventory` | PASS | 17476 |

The machine-readable rows are in [`omp-spec-kit-mcp-runtime-census-2026-08-29.json`](omp-spec-kit-mcp-runtime-census-2026-08-29.json). The dogfood process obtains the registry from `tools/list`, invokes every actual handler, and fails on missing, unexpected, or empty responses.

## Destination stages

The eight shipped names remain registered in every later stage:

- v0.4.0 read complete: 23 tools, including contained document reads, task/status views, anchor and metadata reads, policy and archival views.
- v0.5.0 evidence/navigation: 25 tools, adding hash-bound scenario results and traces.
- v0.6.0 safe authoring: 49 tools in the complete destination census, with proposal-first transactional mutations.
- v0.7.0 automatic plan gate: exact selected-plan validation in OMP before approval; no new graph or directory-guessing fallback.

The closed 46-name operation census and ownership map remain in [`docs/decisions/spec-generator-port.md`](../docs/decisions/spec-generator-port.md). Names not active in v0.3.2 are planned stages, not silently dropped operations.

## Installation baseline

The live workstation runs OMP 18.0.10. The project marketplace points to `stgmt/omp-spec-kit`, the project-scoped v0.3.2 cache is present, and a fresh OMP session returned a non-empty `spec_inventory` result. The current compatibility profile and discovery receipt are recorded in [`docs/omp-v18.0.10-contract.md`](../docs/omp-v18.0.10-contract.md) and [`docs/validation/omp-discovery-v18.0.10.md`](../docs/validation/omp-discovery-v18.0.10.md).

`omp update --check` reports 18.0.11 as available. The package remains pinned to the approved immutable 18.0.10 profile until a separate compatibility receipt accepts a newer release.
