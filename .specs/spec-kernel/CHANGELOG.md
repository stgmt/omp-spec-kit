# Changelog

## Unreleased — specification-only

### Added

- Defined the v0.2 pure read-only parsing, qualified-identity, graph, invariant, diagnostic, and bounded query contracts.
- Defined the optional v0.3 MCP projection over the same query service.
- Closed the supported 15-document set, authored/generated ID grammars, node kinds, edge types, endpoint matrix, diagnostic codes, eight query operations, result fields, and error fields.
- Added lossless duplicate candidate handling plus explicit document/definition/reference/Markdown-heading/Markdown-link conservation equations.
- Added explicit-root containment, traversal protection, symlink/junction/reparse rejection, sanitized repository-relative diagnostics, and hard input/query/result limits.
- Added dependency-free-or-fully-bundled distribution requirements and concrete artifact, latency, memory, response, and corpus budgets.
- Added real-fixture provenance/admission requirements and pinned research-only snapshot references with hashes.
- Added collision-safe `glfm-anchor@1` inventory for every ordinary-or-ID ATX/Setext heading and every inline/reference/autolink occurrence, including full-prior-anchor-set base/base-N allocation, adversarial suffix-shaped heading vectors, exact rewrite sites, and focused inbound/outbound `markdownInventory` queries.
- Added closed `targetStage`/`evidenceProfile` release contracts: v0.2 is the all-not-any FR-1..FR-8 plus FR-10..FR-13 profile with no MCP dependency, while v0.3 requires a same-lineage accepted v0.2 input plus FR-9 and fresh MCP-inclusive package/budget evidence. Unknown/mismatched profiles and every one-fault variant fail closed with deterministic blockers.
- Added FR-15 contained step-binding index (`STEP_BINDING`, `BINDS_STEP`, `STEP_UNDEFINED`/`STEP_AMBIGUOUS`) over allowlisted `tests/step-definitions/**/*.js|mjs`. It is **not** a `kernel-v0.2`/`kernel-v0.3` required check; `CHK-FR15-01` (`kernel-step-bindings`) is the unblocker for `spec-lsp` step diagnostics. MCP stays the agent door.
- Added FR-16 generator-port read operations (listSpecs, findByTags, listTasks, …) so the spec-generator MCP door can grow beyond the eight first-slice tools. Not a v0.2/v0.3 required check. Mutations stay out of the v0.3 read registry. Agent-facing API is MCP only.
- Traceability is 16 FR / 16 AC / 16 scenarios; v0.2/v0.3 gates still exclude FR-15 and FR-16.

### Excluded

- Watchers, persistent indexes, SQLite, locks, local state, logs, hooks, advisor, backlog, dashboard, repair, archive, semantic judge, planner, and dev-pomogator runtime paths.
- Proposal, CAS, transaction, status-transition, write, or any other mutation API.
- Claims of upstream compatibility, implementation completion, executed scenarios, or release readiness.

### Provenance

The specification derives decisions from `MIGRATION_MATRIX.md`, `IMPORT_MANIFEST.yaml`, the immutable snapshot at `docs/upstream/dev-pomogator/spec-generator-v4/`, and the repository-owned [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md). It does not import implementation code.
