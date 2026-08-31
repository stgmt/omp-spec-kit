# Changelog

## Unreleased

- Replaced the split historical/future design with one occurrence-first graph/query core and four internal primitives: inventory, findNodes, traverse, and diagnostics.
- Preserved the exact released eight-name MCP compatibility adapters as the v0.3.2 first slice: `spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory`.
- Removed kernel ownership of editor anchor/link inventory, capability grammar, JavaScript/Cucumber parsing, operation-specific query catalogs, adapter preflight/version/lock state, release evaluation, and dormant activation machinery.
- Kept occurrence conservation, spec-qualified identity, typed resolved/unresolved edges, deterministic diagnostics, containment, cancellation, package/memory/latency budgets, dependency-absent smoke, v0.3.2 runtime receipts, and real-corpus provenance.

## Evidence boundary

The public v0.3.2 eight-tool runtime remains historical **SHIPPED** evidence. The simplified core contract is **NEXT**; speculative extensions are **LATER** or omitted. Historical decoders, serializers, and immutable fixture replay may read released formats, but they do not define the current core.

## Provenance

Real-corpus provenance remains tied to the existing target-owned manifest, its selected source commit, per-file hashes, independent count oracle, and public v0.3.2 receipt references already recorded in this spec. No released receipt is rewritten into a current implementation claim.
