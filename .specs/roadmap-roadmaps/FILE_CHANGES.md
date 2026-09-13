# File Changes

## Shipped (TASK-1..4)

- `src/kernel/types.js` — ROADMAP in ENTITY_TYPE_DESCRIPTORS and LOCAL_ID_ROLES; CONTAINS edge type and endpoint matrix entry
- `src/kernel/query/service.js` — board projection emits one synthetic `roadmap-*:ROADMAP` aggregate node per roadmap spec plus board-level CONTAINS edges
- `src/adapters/youtrack-projection.js` — ROADMAP cards (type Roadmap) and CONTAINS link mapping
- `tools/spec-graph-app/widgets/spec-board/` — ROADMAP kind filter, chip, and lane
- `.specs/roadmap-roadmaps/` — this specification
- `ROADMAP.md` — product roadmap references the roadmap spec

## Planned (TASK-5..8)

- `src/kernel/types.js` — ROADMAP document kind in the canonical document registry and DOCUMENT_DEFINITION_ROLES
- `.specs/roadmap-roadmaps/ROADMAP.md` — canonical hybrid roadmap document with `roadmap:auto` markers
- `src/kernel/` — pure assembler: scope derivation, item collection, status derivation, deterministic ordering, marker-region merge
- `src/adapters/` or `src/mcp/` — governed roadmap lifecycle operation (create/assemble/reassemble/read) with receipts
- `src/adapters/tool-contracts.js`, manifest, surface budgets — tool surface update
- `src/kernel/query/service.js` — board projection consumes the declared aggregate node instead of synthesizing it
- `tests/` — unit tests for the assembler and merge; live-MCP e2e for the lifecycle operation
