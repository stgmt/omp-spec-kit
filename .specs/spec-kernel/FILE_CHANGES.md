# File Changes

Root source remains authoritative; the child plugin is built from it. Rows marked **NEXT** are implementation targets and do not claim delivery. This map names only root-source, built, test, and fixture paths.

## FC-1: Core graph and parser

**Requirements:** [FR-1](FR.md#fr-1-pure-occurrence-first-core), [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids), [FR-3](FR.md#fr-3-typed-graph-conservation)

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/types.js` | edit | **NEXT** core source and occurrence types |
| `src/kernel/normalize.js` | edit | **NEXT** source normalization and fingerprint inputs |
| `src/kernel/parsers/` | edit | **NEXT** role-aware occurrence parsers |
| `src/kernel/graph/` | edit | **NEXT** identity, typed edges, conservation |
| `src/kernel/diagnostics.js` | edit | **NEXT** deterministic structural diagnostics |
| `src/kernel/index.js` | edit | **NEXT** one core entry point |

## FC-2: Four primitives and adapters

**Requirements:** [FR-4](FR.md#fr-4-four-bounded-core-primitives), [FR-5](FR.md#fr-5-contained-inputs-and-budgets), [FR-6](FR.md#fr-6-historical-eight-name-compatibility)

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/query/` | edit | **NEXT** inventory/findNodes/traverse/diagnostics and shared envelope |
| `src/kernel/adapters/fs.js` | edit | **NEXT** contained canonical source reader |
| `src/adapters/query-service.js` | edit | **SHIPPED** compatibility composition; adapt to one core |
| `src/adapters/omp/register-spec-tools.js` | edit | **SHIPPED** OMP compatibility projection |
| `src/mcp/server.js` | edit | **SHIPPED** eight-name MCP compatibility projection |
| `scripts/build-plugin.mjs` | edit | **SHIPPED** root-to-child packaging |

## FC-3: Fixtures and behavioral evidence

**Requirements:** [FR-6](FR.md#fr-6-historical-eight-name-compatibility), [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets)

| Path | Action | State / responsibility |
|---|---|---|
| `tests/fixtures/kernel/real-corpus/` | edit | **SHIPPED** target-owned real corpus |
| `tests/fixtures/kernel/real-corpus-manifest.json` | edit | **SHIPPED** provenance, hashes, oracle counts |
| `tests/fixtures/kernel/v0.3.0/` | edit | **SHIPPED** prior-package fixture |
| `tests/features/spec-kernel.feature` | edit | **NEXT** core behavior scenarios |
| `tests/features/spec-mcp.feature` | edit | **SHIPPED** compatibility behavior scenarios |
| `tests/helpers/kernel-world.mjs` | edit | **NEXT** core fixture harness |
| `tests/helpers/mcp-world.mjs` | edit | **SHIPPED** MCP compatibility harness |
| `docs/validation/release-status-v0.3.2.json` | edit | **SHIPPED** historical public receipt identity |

## Non-goals

No second runtime, parser fork, editor-anchor authority, capability grammar, JavaScript/Cucumber matcher, public release evaluator, persistence, watcher, mutation surface, or sibling/global file ownership is introduced.
