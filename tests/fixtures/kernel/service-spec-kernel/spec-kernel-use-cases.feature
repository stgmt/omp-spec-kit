@spec-kernel @read-only
Feature: Spec kernel use cases

  @case:UC-1 @story:US-1
  Rule: Build a deterministic graph snapshot
    Actor: OMP extension adapter, pure kernel
    Boundary: Packaged spec kernel and its adapters
    Trigger: Build a deterministic graph snapshot
    Precondition: The caller supplies an explicit repository root and a bounded immutable set of normalized source documents.
    Success: The same normalized inputs and limits produce the same serialized graph; no repository bytes or hidden state change.
    Covers: FR-1, FR-3, FR-7, FR-13
    Step: step-1 | The read adapter verifies root containment and rejects linked paths.
    Step: step-2 | The kernel validates document names, spec slugs, encodings, and size limits.
    Step: step-3 | Markdown and Gherkin parsers emit definition/reference occurrences and complete Markdown heading/link occurrences with source spans.
    Step: step-4 | Identity resolution qualifies each local ID with its owning spec slug.
    Step: step-5 | The builder preserves duplicate candidates, resolves unambiguous edges, records unresolved references, checks invariants, and computes a content fingerprint.
    Step: step-6 | The caller receives one immutable graph snapshot and sorted diagnostics.
    Context:
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

      **Related:** FR-1, FR-3, FR-7, FR-13

    @feature3 @AC-3.1 @id:SCEN-qualified-deterministic-snapshot
    Scenario: Qualified identities and snapshots are reproducible
      Given two specs each define local ID FR-1
      And local and explicit qualified cross-spec references connect them
      When equivalent UTF-8 inputs with different arrival orders and line endings are parsed
      Then the canonical nodes remain distinct by spec slug
      And both builds have identical fingerprints and canonical serialization

  @case:UC-2 @story:US-3
  Rule: Inspect duplicate definitions without data loss
    Actor: Specification author, query service
    Boundary: Packaged spec kernel and its adapters
    Trigger: Inspect duplicate definitions without data loss
    Precondition: Two definition headings in one spec produce the same canonical ID.
    Success: Definition and reference conservation equations still balance; neither occurrence overwrites the other.
    Covers: FR-4, FR-6
    Step: step-1 | Both source occurrences enter `definitionCandidates`.
    Step: step-2 | The builder emits `DUPLICATE_DEFINITION` with both spans.
    Step: step-3 | No canonical node is elected for that ID.
    Step: step-4 | References to the ID become unresolved with `AMBIGUOUS_TARGET`.
    Step: step-5 | `getNode` returns `AMBIGUOUS_ID` and bounded candidate summaries.
    Context:
      **Actors:** Specification author, query service

      **Preconditions:** Two definition headings in one spec produce the same canonical ID.

      **Main flow:**
      1. Both source occurrences enter `definitionCandidates`.
      2. The builder emits `DUPLICATE_DEFINITION` with both spans.
      3. No canonical node is elected for that ID.
      4. References to the ID become unresolved with `AMBIGUOUS_TARGET`.
      5. `getNode` returns `AMBIGUOUS_ID` and bounded candidate summaries.

      **Postconditions:** Definition and reference conservation equations still balance; neither occurrence overwrites the other.

      **Related:** FR-4, FR-6

    @feature6 @AC-6.1 @id:SCEN-conservation-and-fail-closed-diagnostics
    Scenario: Conservation and cardinality failures invalidate the graph
      Given document definition domain-reference Markdown-heading and Markdown-link occurrence counts are known
      When the graph invariants are evaluated
      Then all conservation and cardinality equations reconcile
      But when an invariant violation is planted
      Then graph validity is false and no readiness or passing-test claim is returned

  @case:UC-3 @story:US-7
  Rule: Follow an intra-spec and cross-spec trace
    Actor: OMP user, query service
    Boundary: Packaged spec kernel and its adapters
    Trigger: Follow an intra-spec and cross-spec trace
    Precondition: The graph contains valid local edges and an explicit qualified cross-spec reference.
    Success: Follow an intra-spec and cross-spec trace
    Covers: FR-5, FR-8
    Step: step-1 | The user identifies a node by canonical ID.
    Step: step-2 | The service validates depth, limit, cursor, direction, and edge filters.
    Step: step-3 | Breadth-first traversal uses canonical-ID and edge-type lexical ordering.
    Step: step-4 | The result returns visited nodes, traversed edges, frontier truncation, diagnostics, and page metadata.
    Context:
      **Actors:** OMP user, query service

      **Preconditions:** The graph contains valid local edges and an explicit qualified cross-spec reference.

      **Main flow:**
      1. The user identifies a node by canonical ID.
      2. The service validates depth, limit, cursor, direction, and edge filters.
      3. Breadth-first traversal uses canonical-ID and edge-type lexical ordering.
      4. The result returns visited nodes, traversed edges, frontier truncation, diagnostics, and page metadata.

      **Alternatives:** A bare ID in a cross-spec context is never guessed; an ambiguous/missing start node returns a typed query error.

      **Related:** FR-5, FR-8

    @feature5 @AC-5.1 @id:SCEN-edge-resolution-outcomes
    Scenario: Every reference occurrence has exactly one edge outcome
      Given references include valid missing ambiguous malformed forbidden-endpoint and qualified cross-spec targets
      When typed edges are resolved
      Then each reference occurrence is exactly one resolved edge or one typed unresolved reference
      And every resolved edge joins existing endpoint kinds permitted by the schema

  @case:UC-4 @story:US-4
  Rule: Query through the OMP extension
    Actor: OMP user, OMP host adapter
    Boundary: Packaged spec kernel and its adapters
    Trigger: Query through the OMP extension
    Precondition: The single `omp-spec-kit` plugin is installed and the v0.2 extension is active.
    Success: The operation writes no files and registers no mutation surface.
    Covers: FR-8, FR-13
    Step: step-1 | The extension accepts one read operation.
    Step: step-2 | The filesystem adapter reads a contained bounded snapshot.
    Step: step-3 | The extension calls the shared query service.
    Step: step-4 | It returns the canonical result envelope without adding graph semantics.
    Context:
      **Actors:** OMP user, OMP host adapter

      **Preconditions:** The single `omp-spec-kit` plugin is installed and the v0.2 extension is active.

      **Main flow:**
      1. The extension accepts one read operation.
      2. The filesystem adapter reads a contained bounded snapshot.
      3. The extension calls the shared query service.
      4. It returns the canonical result envelope without adding graph semantics.

      **Postconditions:** The operation writes no files and registers no mutation surface.

      **Related:** FR-8, FR-13

  @case:UC-5 @story:US-4
  Rule: Query through MCP in v0.3
    Actor: MCP client, bundled MCP adapter
    Boundary: Packaged spec kernel and its adapters
    Trigger: Query through MCP in v0.3
    Precondition: The v0.3 MCP adapter is enabled from the same child plugin package.
    Success: Query through MCP in v0.3
    Covers: FR-9, FR-13
    Step: step-1 | The adapter validates MCP JSON inputs and maps the tool name to one query operation.
    Step: step-2 | It calls the exact v0.2 query service.
    Step: step-3 | It returns the canonical envelope as structured content.
    Context:
      **Actors:** MCP client, bundled MCP adapter

      **Preconditions:** The v0.3 MCP adapter is enabled from the same child plugin package.

      **Main flow:**
      1. The adapter validates MCP JSON inputs and maps the tool name to one query operation.
      2. It calls the exact v0.2 query service.
      3. It returns the canonical envelope as structured content.

      **Alternatives:** Unknown operations, invalid parameters, stale cursors, and excessive limits return closed typed errors; the adapter never falls back to a writer.

      **Related:** FR-9, FR-13

    @feature9 @AC-9.1 @id:SCEN-mcp-read-projection-only
    Scenario: MCP adapter adds transport but no semantics
      Given the v0.3 MCP adapter and v0.2 service share one graph and request
      When every registered MCP tool is invoked
      Then each structured canonical result equals the direct service result after transport metadata is removed
      And the MCP registry has exactly eight named read tools and zero mutation-like tools

  @case:UC-6 @story:US-2
  Rule: Reject an unsafe repository tree
    Actor: Repository owner, filesystem adapter
    Boundary: Packaged spec kernel and its adapters
    Trigger: Reject an unsafe repository tree
    Precondition: A candidate file is linked, external, non-regular, or causes a configured budget to be exceeded.
    Success: No partial external content is returned and no state is created.
    Covers: FR-7
    Step: step-1 | The adapter performs `lstat`/reparse inspection for every traversed segment before opening content.
    Step: step-2 | It compares canonicalized paths against the explicit real root.
    Step: step-3 | It refuses the snapshot with a bounded diagnostic and reads no target bytes outside the root.
    Context:
      **Actors:** Repository owner, filesystem adapter

      **Preconditions:** A candidate file is linked, external, non-regular, or causes a configured budget to be exceeded.

      **Main flow:**
      1. The adapter performs `lstat`/reparse inspection for every traversed segment before opening content.
      2. It compares canonicalized paths against the explicit real root.
      3. It refuses the snapshot with a bounded diagnostic and reads no target bytes outside the root.

      **Postconditions:** No partial external content is returned and no state is created.

      **Related:** FR-7

  @case:UC-7 @story:US-6
  Rule: Validate a real fixture corpus
    Actor: Test author, fixture reviewer
    Boundary: Packaged spec kernel and its adapters
    Trigger: Validate a real fixture corpus
    Precondition: Captured bytes, source identity, hash, license disposition, and ground-truth counts are recorded.
    Success: Results demonstrate only the target contract exercised by the fixture, not upstream parity or execution status.
    Covers: FR-11
    Step: step-1 | The fixture verifier checks bytes against the manifest hash.
    Step: step-2 | The kernel parses the bytes without source-specific compatibility mode.
    Step: step-3 | Actual definition/reference/heading/link occurrence and outcome counts reconcile with declared ground truth.
    Step: step-4 | Any trimming process is proven to retain producer-valid syntax.
    Context:
      **Actors:** Test author, fixture reviewer

      **Preconditions:** Captured bytes, source identity, hash, license disposition, and ground-truth counts are recorded.

      **Main flow:**
      1. The fixture verifier checks bytes against the manifest hash.
      2. The kernel parses the bytes without source-specific compatibility mode.
      3. Actual definition/reference/heading/link occurrence and outcome counts reconcile with declared ground truth.
      4. Any trimming process is proven to retain producer-valid syntax.

      **Postconditions:** Results demonstrate only the target contract exercised by the fixture, not upstream parity or execution status.

      **Related:** FR-11

  @case:UC-8 @story:US-5
  Rule: Enforce packaging and benchmark budgets
    Actor: Release owner
    Boundary: Packaged spec kernel and its adapters
    Trigger: Enforce packaging and benchmark budgets
    Precondition: A bundled child-plugin artifact and benchmark fixture exist.
    Success: A release is refused on any exceeded budget or undeclared runtime dependency.
    Covers: FR-10, FR-12
    Step: step-1 | External/root dependencies are hidden.
    Step: step-2 | The artifact loads and builds the benchmark graph.
    Step: step-3 | Inventory and trace queries run at their configured maximums.
    Step: step-4 | Cold-build time, query latency, peak memory, artifact size, and result bounds are compared with [NFR.md](NFR.md).
    Context:
      **Actors:** Release owner

      **Preconditions:** A bundled child-plugin artifact and benchmark fixture exist.

      **Main flow:**
      1. External/root dependencies are hidden.
      2. The artifact loads and builds the benchmark graph.
      3. Inventory and trace queries run at their configured maximums.
      4. Cold-build time, query latency, peak memory, artifact size, and result bounds are compared with NFR.md.

      **Postconditions:** A release is refused on any exceeded budget or undeclared runtime dependency.

      **Related:** FR-10, FR-12

    @feature12 @AC-12.1 @id:SCEN-performance-and-size-budgets
    Scenario: Packaged runtime enforces performance size and result budgets
      Given the packaged artifact and pinned benchmark corpus
      When cold builds bounded queries hard-limit variants and cancellation are measured
      Then latency memory bundle response corpus and traversal observations meet every NFR budget
      And any hard excess returns a typed limit error or blocks release without silent data loss

  @case:UC-9 @story:US-4
  Rule: Inventory a heading before safe rename planning
    Actor: Specification author, read-only query service
    Boundary: Packaged spec kernel and its adapters
    Trigger: Inventory a heading before safe rename planning
    Precondition: A valid immutable snapshot contains an ordinary or ID heading, adversarial suffix-shaped heading bases, and internal, external, reference-style, and unresolved link occurrences.
    Success: The caller has a deterministic affected-occurrence inventory but no rename proposal, write authority, or repository mutation.
    Covers: FR-13
    Step: step-1 | The caller first requests the unscoped complete `markdownInventory` cursor chain and verifies graph fingerprint, global conservation totals, and pairwise-unique canonical anchors allocated against the complete previously emitted set.
    Step: step-2 | The caller focuses the same fingerprint on the heading’s exact repository-relative path and canonical anchor.
    Step: step-3 | The service returns the heading occurrence, every inbound link targeting it, and every outbound link in its section, retaining separate semantic uses and shared destination rewrite keys.
    Step: step-4 | The caller reconciles matched totals across the complete cursor chain; vectors such as `Foo`/`Foo`/`Foo-1` retain three unique focusable anchors.
    Context:
      **Actors:** Specification author, read-only query service

      **Preconditions:** A valid immutable snapshot contains an ordinary or ID heading, adversarial suffix-shaped heading bases, and internal, external, reference-style, and unresolved link occurrences.

      **Main flow:**
      1. The caller first requests the unscoped complete `markdownInventory` cursor chain and verifies graph fingerprint, global conservation totals, and pairwise-unique canonical anchors allocated against the complete previously emitted set.
      2. The caller focuses the same fingerprint on the heading’s exact repository-relative path and canonical anchor.
      3. The service returns the heading occurrence, every inbound link targeting it, and every outbound link in its section, retaining separate semantic uses and shared destination rewrite keys.
      4. The caller reconciles matched totals across the complete cursor chain; vectors such as `Foo`/`Foo`/`Foo-1` retain three unique focusable anchors.

      **Alternatives:** A stale cursor, missing focus heading, invalid path/anchor, or exceeded limit returns the closed query error and no partial completeness claim.

      **Postconditions:** The caller has a deterministic affected-occurrence inventory but no rename proposal, write authority, or repository mutation.

      **Related:** FR-13

    @feature13 @AC-13.1 @id:SCEN-complete-markdown-rename-inventory
    Scenario: Complete heading and link inventory makes a rename plan conservative
      Given accepted Markdown contains ID and ordinary ATX and Setext headings including Foo Foo Foo-1 and equivalent adversarial orders
      And its links include inline reference and autolink forms with internal external unresolved and shared-definition destinations
      When headings are allocated in document order against the complete set of previously emitted canonical anchors
      And the complete markdownInventory cursor chain is requested unscoped and focused on one ordinary canonical anchor
      Then Foo Foo Foo-1 emits foo foo-1 foo-1-1 and every emitted canonical anchor is pairwise unique
      And Foo-1 Foo Foo emits foo-1 foo foo-2 and Foo Foo-1 Foo emits foo foo-1 foo-2
      And every heading and semantic link occurrence appears exactly once with versioned anchors exact use and rewrite spans stable rewrite keys and outcomes
      And all inbound links to the focus and all outbound links in its section are identified and the heading and link conservation totals reconcile

  @case:UC-10 @story:US-5
  Rule: Evaluate the aggregate kernel release gate
    Actor: Release owner, independent reviewer
    Boundary: Packaged spec kernel and its adapters
    Trigger: Evaluate the aggregate kernel release gate
    Precondition: One candidate artifact and a `kernel-release-evidence@1` manifest declare a known matching `targetStage`/`evidenceProfile` pair and cite immutable evidence for that schema-owned profile. A v0.3 input also supplies the complete v0.2 input whose accepted artifact is its declared parent.
    Success: The result neither publishes an artifact nor clears remaining repository publication-validation gates or the fail-closed license policy for future or changed imports.
    Covers: FR-1, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14
    Step: step-1 | The evaluator validates the stage/profile pair and candidate release line, then derives the exact closed check set from the schema.
    Step: step-2 | For v0.2 it derives FR-1..FR-8 and FR-10..FR-13, rejects FR-9, and requires no MCP evidence.
    Step: step-3 | For v0.3 it re-evaluates the same-lineage v0.2 input, then derives the complete v0.2 set plus FR-9 and requires fresh MCP-inclusive FR-10/FR-12 records.
    Step: step-4 | It rejects missing, extra, duplicate, cross-stage, or non-`PASS` records and validates evidence hashes and artifact/corpus bindings, including the FR-10 package, FR-11 fixture, and FR-12 budget gates.
    Step: step-5 | It returns a stable eligibility result and ordered blockers.
    Context:
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

      **Related:** FR-14

    @feature14 @AC-14.1 @id:SCEN-kernel-release-gate-is-all-not-any
    Scenario: Kernel release eligibility requires the complete selected stage profile
      Given a v0.2 manifest declares targetStage v0.2 and evidenceProfile kernel-v0.2
      And it has exactly one passing hash-bound record for every mandatory check for FR-1 through FR-8 and FR-10 through FR-13
      And its package fixture and v0.2 budget records agree on the candidate artifact and applicable corpus fingerprint
      When kernel release eligibility is evaluated
      Then v0.2 eligibility is true without FR-9 MCP evidence
      But a v0.2 manifest containing FR-9 evidence or an unknown or mismatched stage profile is ineligible
      And a v0.3 manifest is eligible only with a same-lineage accepted v0.2 input every v0.2-profile check FR-9 adapter parity and read-only registry evidence and MCP-inclusive package and budget evidence
      And removing duplicating failing staling mismatching waiving partializing or making unverifiable any one required record makes that stage ineligible
      And every ineligible result has deterministic blocking details and no publication or readiness side effect
