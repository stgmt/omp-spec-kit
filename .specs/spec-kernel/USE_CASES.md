# Use Cases

## UC-1: Build a deterministic graph snapshot

**Actors:** OMP extension adapter, pure kernel

**Preconditions:** The caller supplies an explicit repository root and a bounded immutable set of normalized source documents.

**Main flow:**
1. The read adapter verifies root containment and rejects linked paths.
2. The kernel validates document names, spec slugs, encodings, and size limits.
3. Markdown and Gherkin parsers emit definition/reference occurrences and complete Markdown heading/link occurrences with source spans.
4. Identity resolution qualifies each local ID with its owning spec slug.
5. The builder preserves duplicate candidates, resolves unambiguous edges, records unresolved references, checks invariants, and computes a content fingerprint.
6. The caller receives one immutable graph snapshot and sorted diagnostics.

**Postconditions:** The same normalized inputs and limits produce the same serialized graph; no repository bytes or hidden state change.

**Alternatives:** Invalid input yields diagnostics and a partial, explicitly invalid snapshot when conservation remains possible; a containment or budget violation refuses the read before parsing external/over-budget bytes.

**Related:** [FR-1](FR.md#fr-1-pure-read-only-kernel-and-adapter-boundary), [FR-3](FR.md#fr-3-canonical-identity-and-deterministic-parsing), [FR-7](FR.md#fr-7-bounded-repository-containment), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

## UC-2: Inspect duplicate definitions without data loss

**Actors:** Specification author, query service

**Preconditions:** Two definition headings in one spec produce the same canonical ID.

**Main flow:**
1. Both source occurrences enter `definitionCandidates`.
2. The builder emits `DUPLICATE_DEFINITION` with both spans.
3. No canonical node is elected for that ID.
4. References to the ID become unresolved with `AMBIGUOUS_TARGET`.
5. `getNode` returns `AMBIGUOUS_ID` and bounded candidate summaries.

**Postconditions:** Definition and reference conservation equations still balance; neither occurrence overwrites the other.

**Related:** [FR-4](FR.md#fr-4-lossless-duplicate-handling), [FR-6](FR.md#fr-6-invariants-and-diagnostics)

## UC-3: Follow an intra-spec and cross-spec trace

**Actors:** OMP user, query service

**Preconditions:** The graph contains valid local edges and an explicit qualified cross-spec reference.

**Main flow:**
1. The user identifies a node by canonical ID.
2. The service validates depth, limit, cursor, direction, and edge filters.
3. Breadth-first traversal uses canonical-ID and edge-type lexical ordering.
4. The result returns visited nodes, traversed edges, frontier truncation, diagnostics, and page metadata.

**Alternatives:** A bare ID in a cross-spec context is never guessed; an ambiguous/missing start node returns a typed query error.

**Related:** [FR-5](FR.md#fr-5-typed-edge-resolution), [FR-8](FR.md#fr-8-bounded-read-only-query-service)

## UC-4: Query through the OMP extension

**Actors:** OMP user, OMP host adapter

**Preconditions:** The single `omp-spec-kit` plugin is installed and the v0.2 extension is active.

**Main flow:**
1. The extension accepts one read operation.
2. The filesystem adapter reads a contained bounded snapshot.
3. The extension calls the shared query service.
4. It returns the canonical result envelope without adding graph semantics.

**Postconditions:** The operation writes no files and registers no mutation surface.

**Related:** [FR-8](FR.md#fr-8-bounded-read-only-query-service), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

## UC-5: Query through MCP in v0.3

**Actors:** MCP client, bundled MCP adapter

**Preconditions:** The v0.3 MCP adapter is enabled from the same child plugin package.

**Main flow:**
1. The adapter validates MCP JSON inputs and maps the tool name to one query operation.
2. It calls the exact v0.2 query service.
3. It returns the canonical envelope as structured content.

**Alternatives:** Unknown operations, invalid parameters, stale cursors, and excessive limits return closed typed errors; the adapter never falls back to a writer.

**Related:** [FR-9](FR.md#fr-9-read-only-mcp-projection-in-v03), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

## UC-6: Reject an unsafe repository tree

**Actors:** Repository owner, filesystem adapter

**Preconditions:** A candidate file is linked, external, non-regular, or causes a configured budget to be exceeded.

**Main flow:**
1. The adapter performs `lstat`/reparse inspection for every traversed segment before opening content.
2. It compares canonicalized paths against the explicit real root.
3. It refuses the snapshot with a bounded diagnostic and reads no target bytes outside the root.

**Postconditions:** No partial external content is returned and no state is created.

**Related:** [FR-7](FR.md#fr-7-bounded-repository-containment)

## UC-7: Validate a real fixture corpus

**Actors:** Test author, fixture reviewer

**Preconditions:** Captured bytes, source identity, hash, license disposition, and ground-truth counts are recorded.

**Main flow:**
1. The fixture verifier checks bytes against the manifest hash.
2. The kernel parses the bytes without source-specific compatibility mode.
3. Actual definition/reference/heading/link occurrence and outcome counts reconcile with declared ground truth.
4. Any trimming process is proven to retain producer-valid syntax.

**Postconditions:** Results demonstrate only the target contract exercised by the fixture, not upstream parity or execution status.

**Related:** [FR-11](FR.md#fr-11-real-fixtures-and-provenance)

## UC-8: Enforce packaging and benchmark budgets

**Actors:** Release owner

**Preconditions:** A bundled child-plugin artifact and benchmark fixture exist.

**Main flow:**
1. External/root dependencies are hidden.
2. The artifact loads and builds the benchmark graph.
3. Inventory and trace queries run at their configured maximums.
4. Cold-build time, query latency, peak memory, artifact size, and result bounds are compared with [NFR.md](NFR.md).

**Postconditions:** A release is refused on any exceeded budget or undeclared runtime dependency.

**Related:** [FR-10](FR.md#fr-10-self-contained-runtime-distribution), [FR-12](FR.md#fr-12-performance-size-and-result-budgets)

## UC-9: Inventory a heading before safe rename planning

**Actors:** Specification author, read-only query service

**Preconditions:** A valid immutable snapshot contains an ordinary or ID heading, adversarial suffix-shaped heading bases, and internal, external, reference-style, and unresolved link occurrences.

**Main flow:**
1. The caller first requests the unscoped complete `markdownInventory` cursor chain and verifies graph fingerprint, global conservation totals, and pairwise-unique canonical anchors allocated against the complete previously emitted set.
2. The caller focuses the same fingerprint on the heading’s exact repository-relative path and canonical anchor.
3. The service returns the heading occurrence, every inbound link targeting it, and every outbound link in its section, retaining separate semantic uses and shared destination rewrite keys.
4. The caller reconciles matched totals across the complete cursor chain; vectors such as `Foo`/`Foo`/`Foo-1` retain three unique focusable anchors.

**Alternatives:** A stale cursor, missing focus heading, invalid path/anchor, or exceeded limit returns the closed query error and no partial completeness claim.

**Postconditions:** The caller has a deterministic affected-occurrence inventory but no rename proposal, write authority, or repository mutation.

**Related:** [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

## UC-10: Evaluate the aggregate kernel release gate

**Actors:** Release owner, independent reviewer

**Preconditions:** One candidate artifact and a `kernel-release-evidence@1` manifest declare a known matching `targetStage`/`evidenceProfile` pair and cite immutable evidence for that schema-owned profile. A v0.3 input also supplies the complete v0.2 input whose accepted artifact is its declared parent.

**Main flow:**
1. The evaluator validates the stage/profile pair and candidate release line, then derives the exact closed check set from the schema.
2. For v0.2 it derives FR-1..FR-8 and FR-10..FR-13, rejects FR-9, and requires no MCP evidence.
3. For v0.3 it re-evaluates the same-lineage v0.2 input, then derives the complete v0.2 set plus FR-9 and requires fresh MCP-inclusive FR-10/FR-12 records.
4. It rejects missing, extra, duplicate, cross-stage, or non-`PASS` records and validates evidence hashes and artifact/corpus bindings, including the FR-10 package, FR-11 fixture, and FR-12 budget gates.
5. It returns a stable eligibility result and ordered blockers.

**Alternatives:** An unknown/mismatched stage or profile, wrong release line, absent/invalid lineage, missing MCP obligation at v0.3, or any removed/weakened profile record makes `eligible=false`; no majority, waiver, partial result, graph-valid flag, or historical result substitutes for it.

**Postconditions:** The result neither publishes an artifact nor clears remaining repository publication-validation gates or the fail-closed license policy for future or changed imports.

**Related:** [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)
