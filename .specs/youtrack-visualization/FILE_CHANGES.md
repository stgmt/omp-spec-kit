# File Changes

## Current defect

No tracker projection existed before this feature: `scripts/spec-graph-sync.mjs` is introduced here as a new composition root written against ports from the start, and the widgets previously had no committed board snapshot to consume. There is no legacy baseline to remove.

## Target files

| File or area | Change |
|---|---|
| scripts/spec-graph-sync.mjs | new composition root wiring the adapter application service to MCP/REST ports |
| src/adapters/ | add ports, pure card/link translators, parity comparison, snapshot commit protocol, and REST/MCP adapters |
| src/kernel/query/service.js | add strict spec_graph board projection branch |
| src/adapters/query-service.js | expose the board discriminator without duplicating kernel semantics |
| src/adapters/tool-contracts.js | document the board branch while retaining ten tools and one mutator |
| tools/spec-graph-app/widgets/spec-panel/index.html | consume committed snapshot and preserve task writeback UX |
| tools/spec-graph-app/widgets/spec-board/index.html | implement V1 Flow, V2 Cluster, and V3 Lineage over one snapshot |
| tools/spec-graph-app/spec-writeback.js | validate TASK transitions and call spec_patch only |
| tests or contract fixtures | cover DTO, translator, parity, commit, failure, writeback, and browser contracts |

No second board graph store, legacy alias, compatibility tool, or tracker-link topology reader is planned. Existing source files are changed in place where possible.

## Removal proof

Before declaring cutover complete, source references to readRepositorySpecs/buildKernelGraph in the sync composition root, duplicate link maps, stale board writers, and UI graph reconstruction are verified absent. The proof also includes a fresh-process MCP board read, adapter dry run, and browser acceptance scenarios.
