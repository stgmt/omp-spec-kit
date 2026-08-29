# omp-spec-kit MCP runtime census — 2026-08-29

## Decision

The repository-built v0.3.2 MCP server has eight registered read-only tools. All eight returned real data from the real ten-specification corpus. No current tool is dead or silently empty.

The user's project installation is not at that state: `omp plugin list` reports project plugin `omp-spec-kit@omp-spec-kit` version 0.2.0, its recorded cache path is absent, and `omp plugin marketplace list` reports no configured marketplace. Therefore the working repository payload is healthy, but a fresh OMP session cannot rely on the project install to expose the v0.3.2 MCP server until the marketplace/install state is repaired.

## Runtime results

| Tool | Result | Real returned data |
|---|---|---:|
| `spec_inventory` | PASS | 10 / 10 specifications |
| `spec_get_node` | PASS | one full `product:FR-1` node |
| `spec_find_nodes` | PASS | 89 / 89 product nodes |
| `spec_get_edges` | PASS | 6 / 6 incident edges |
| `spec_trace` | PASS | 46 / 46 visited nodes |
| `spec_diagnostics` | PASS | first 100 / 194 diagnostics; cursor present |
| `spec_overview` | PASS | corpus counts and histograms |
| `spec_markdown_inventory` | PASS | first 100 / 223 items; cursor present |

Machine-readable inputs and results: `audit-reports/omp-spec-kit-mcp-runtime-census-2026-08-29.json`.

## Destination surface

`docs/decisions/spec-generator-port.md` preserves all 46 upstream generator-door names. Five are already represented by the v0.3 tools. The repository additionally keeps three v0.3-native tools that are not upstream names. Completing the stated destination therefore adds 41 names and yields 49 agent-facing MCP tools unless the product decision is changed explicitly.

Planned additions by product outcome:

| Outcome | Additional names | Registry after stage |
|---|---:|---:|
| Current v0.3.2 read-only slice | — | 8 |
| Complete kernel and document reads | 15 | 23 |
| Evidence result and trace reads | 2 | 25 |
| Proposal-first authoring and document lifecycle | 24 | 49 |

LSP, write enforcement, and automatic plan approval are host/editor capabilities, not extra MCP names in the closed 46-name census.

## Proof commands

- `omp --version` → `omp/18.0.3`.
- `omp update --check` → `18.0.10` available.
- `omp plugin list` → project `omp-spec-kit@omp-spec-kit (0.2.0)`.
- `omp plugin marketplace list` → no marketplaces configured.
- Direct JSON-RPC `initialize`, `tools/list`, and one `tools/call` per registered tool against `plugins/omp-spec-kit/dist/mcp/server.js` → eight tools, eight successful data-bearing responses, zero JSON-RPC errors.
