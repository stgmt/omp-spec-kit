# Use Cases

## UC-1: Build one deterministic graph

**Actors:** Host adapter, pure core

**Preconditions:** The caller supplies a contained, bounded canonical source snapshot.

**Main flow:**
1. Validate source metadata and limits.
2. Normalize bytes, paths, and parser inputs.
3. Emit definition and reference occurrences before indexes.
4. Qualify identities, conserve duplicates, resolve typed edges, and collect diagnostics.
5. Compute the graph fingerprint and return the immutable graph.

**Postconditions:** Equivalent normalized inputs produce equivalent graph bytes and no writes occur.

**Related:** [FR-1](FR.md#fr-1-pure-occurrence-first-core), [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids), [FR-3](FR.md#fr-3-typed-graph-conservation), [FR-7](FR.md#fr-7-deterministic-diagnostics-and-fingerprint)

## UC-2: Query through four primitives

**Actors:** OMP/MCP compatibility adapter, query caller

**Preconditions:** An immutable graph and effective limits exist.

**Main flow:**
1. Select inventory, findNodes, traverse, or diagnostics.
2. Validate filters, cursor, cancellation, and limits.
3. Apply stable sorting and return one cursor/error envelope.
4. Continue until next cursor is null or a typed error closes the request.

**Postconditions:** Query state and repository bytes are unchanged.

**Related:** [FR-4](FR.md#fr-4-four-bounded-core-primitives), [FR-6](FR.md#fr-6-historical-eight-name-compatibility)

## UC-3: Reject an unsafe source snapshot

**Actors:** Host adapter, repository owner

**Preconditions:** A path escapes the explicit root, is link-like, non-regular, or exceeds a hard budget.

**Main flow:**
1. Inspect path segments before opening bytes.
2. Refuse the source with a bounded sanitized error.
3. Return no external bytes and write nothing.

**Related:** [FR-5](FR.md#fr-5-contained-inputs-and-budgets)

## UC-4: Review real evidence

**Actors:** Fixture reviewer, product release layer

**Preconditions:** The target-owned manifest, source hashes, oracle counts, artifact measurements, and historical receipts are available.

**Main flow:**
1. Verify bytes and provenance.
2. Reconcile occurrence and diagnostic counts.
3. Record package, memory, latency, cancellation, and response observations.
4. Keep structural graph validity separate from product-layer release evaluation.

**Postconditions:** Evidence claims are bounded to the captured bytes and receipt references.

**Related:** [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets)
