# Research

## Scope

This concise record uses the existing migration decisions, pinned upstream snapshot, real-corpus manifest, and v0.3.2 public receipts as evidence. They inform the target but do not become implementation authority or compatibility claims.

## RF-1: Mixed historical machinery

**Finding:** Historical generator designs combine graph semantics with watchers, persistence, mutation, and broad transport concerns.

**Decision:** Keep one pure occurrence-first graph core. Host layers handle source reading and transport; editor navigation and product release evidence remain outside the kernel.

## RF-2: Qualified identity and conservation

**Finding:** Bare local IDs collide across a multi-spec corpus, and map-first parsing hides duplicates.

**Decision:** Form `<spec-slug>:<local-id>` identities and retain definition/reference occurrences before indexes. Ambiguous identities have no elected node.

## RF-3: Four primitives are sufficient

**Finding:** Inventory, typed lookup, bounded traversal, and deterministic diagnostics cover the graph/query boundary without an operation-specific catalog.

**Decision:** Expose exactly those four internal primitives through one cursor envelope. Historical MCP names remain adapters only.

## RF-4: Containment is a correctness boundary

**Finding:** A read-only graph can still disclose unrelated files or exhaust host resources without explicit root and hard limits.

**Decision:** Admit only caller-contained canonical documents, reject links and traversal, enforce cancellation and budgets, and return sanitized errors.

## RF-5: Historical evidence has a boundary

**Finding:** The v0.3.2 runtime receipt and target-owned real corpus prove released bytes and provenance, not the rewritten core.

**Decision:** Keep those receipts and hashes immutable; label the current core NEXT and never convert structural validity into release eligibility.

## Open implementation choices

1. Select or bundle a parser implementation that emits the exact occurrence types without widening the schema.
2. Keep producer-supplied normalized step-binding records optional; do not parse JavaScript or reproduce a runner matcher.
3. Extend the core only through a new reviewed contract, never through a second runtime or silent compatibility heuristic.
