@spec-kernel @read-only
Feature: Spec kernel user stories

  @story:US-1
  Rule: Portable maintainer-facing graph
    Actor: `omp-spec-kit` maintainer
    Goal: a pure graph kernel that consumes explicit bytes and produces deterministic values
    Benefit: OMP and MCP adapters cannot fork product semantics.
    Covers: FR-1, FR-3
    Context:
      **Priority:** Must


      **Why:** The upstream server mixed graph logic with watcher, persistence, hooks, repair, and other harness concerns. The standalone product needs a small, reviewable boundary.

      **Independent Test:** Feed the same normalized source set in different input orders and compare serialized graph snapshots byte-for-byte.

      **Acceptance Scenarios:** `@feature1`, `@feature3`

    @feature1 @AC-1.1 @id:SCEN-pure-read-only-boundary
    Scenario: Pure kernel and public registries remain read-only
      Given immutable source documents and kernel limits are supplied as values
      When every v0.2 kernel and query operation is exercised
      Then no filesystem clock environment network process OMP or MCP access occurs in the pure kernel
      And the v0.2 and v0.3 public operation registries contain no mutation or state-transition operation

  @story:US-2
  Rule: Safe repository reader
    Actor: repository owner
    Goal: inventory and graph queries to stay inside my selected repository and reject links or paths that escape it
    Benefit: a read-only operation cannot inspect unrelated files.
    Covers: FR-7
    Context:
      **Priority:** Must


      **Why:** “Read-only” is insufficient if path traversal, junctions, or unbounded discovery can expose host data.

      **Independent Test:** Exercise normal contained files plus parent traversal, absolute external paths, symlinks, Windows junctions/reparse points, and an over-budget corpus.

      **Acceptance Scenarios:** `@feature7`

    @feature7 @AC-7.1 @id:SCEN-contained-reader-rejects-links
    Scenario: Repository reader refuses linked external and over-budget paths
      Given an explicit repository root has contained canonical files
      And variants include traversal an external absolute path a symbolic link a junction or reparse point and an oversized file
      When the filesystem adapter prepares a source snapshot
      Then every unsafe or over-budget variant is refused before target bytes are read
      And diagnostics contain only sanitized repository-relative information and zero files are written

  @story:US-3
  Rule: Honest specification consumer
    Actor: specification author
    Goal: duplicates, broken references, malformed documents, and ambiguous targets reported without dropping source occurrences
    Benefit: a plausible graph cannot hide input loss.
    Covers: FR-4, FR-5, FR-6
    Context:
      **Priority:** Must


      **Why:** Last-writer-wins maps and silent parser recovery create false readiness.

      **Independent Test:** Parse a captured corpus with planted duplicate and broken reference variants and verify candidate/reference conservation.

      **Acceptance Scenarios:** `@feature4`, `@feature5`, `@feature6`

    @feature4 @AC-4.1 @id:SCEN-lossless-duplicates
    Scenario: Duplicate definitions are preserved without winner selection
      Given one spec contains two valid definitions for the same canonical ID
      And another definition references that ID
      When the graph is built and the ID is queried
      Then both definition candidates are preserved and no canonical node is elected
      And the reference is ambiguous and the query returns AMBIGUOUS_ID with both bounded candidates

  @story:US-4
  Rule: Bounded query user
    Actor: OMP user
    Goal: inventory, node, edge, trace, overview, diagnostics, and complete Markdown heading/link queries with stable pagination and explicit errors
    Benefit: large or malformed repositories and rename planning remain usable without writes.
    Covers: FR-8, FR-9, FR-13
    Context:
      **Priority:** Must


      **Why:** The first graph release must provide useful, predictable reads rather than copying the upstream mixed registry.

      **Independent Test:** Call every operation at boundary limits, enumerate an ordinary heading’s complete inbound/outbound link set, and compare the extension and MCP envelopes after removing transport metadata.

      **Acceptance Scenarios:** `@feature8`, `@feature9`, `@feature13`

    @feature8 @AC-8.1 @id:SCEN-bounded-query-service
    Scenario: Shared query operations are stable and bounded
      Given an immutable valid graph and its fingerprint
      When inventory getNode findNodes getEdges trace diagnostics overview and markdownInventory receive normal boundary excessive and stale-cursor inputs
      Then each call returns the exhaustive canonical envelope or a closed typed error
      And ordering pagination totals truncation and limits are explicit and graph state is unchanged

  @story:US-5
  Rule: Release owner
    Actor: release owner
    Goal: a self-contained installed artifact with measured size/performance budgets and one conjunctive evidence gate
    Benefit: the kernel cannot release with an ambient dependency or any missing mandatory requirement proof.
    Covers: FR-10, FR-12, FR-14
    Context:
      **Priority:** Must


      **Why:** Marketplace installation only proves distribution when the child plugin can load by itself.

      **Independent Test:** Run the built v0.2 child artifact with external dependencies hidden, execute the benchmark corpus and one query, and prove its complete FR-1..FR-8 plus FR-10..FR-13 profile passes without MCP evidence and fails if any required record is removed or FR-9 is added. Then prove v0.3 cannot pass without the same-lineage accepted v0.2 input, FR-9 parity/registry evidence, and fresh MCP-inclusive package/budget records.

      **Acceptance Scenarios:** `@feature10`, `@feature12`, `@feature14`

    @feature10 @AC-10.1 @id:SCEN-self-contained-artifact
    Scenario Outline: Installed package proof is selected by target stage
      Given targetStage <targetStage> and evidenceProfile <evidenceProfile> select CHK-FR10-01
      And the exact candidate artifact is installed outside the source checkout with root and external node_modules unavailable
      When <exercise>
      Then the record has packageSurface <packageSurface> and proves <acceptedProof>
      And a record with the other stage profile package surface release line or artifact binding is rejected

      Examples:
        | example_id | targetStage | evidenceProfile | packageSurface          | exercise                                                        | acceptedProof                                                                 |
        | row-1 | v0.2        | kernel-v0.2     | OMP_EXTENSION_ONLY      | the OMP extension builds a graph and executes one query          | only the dependency-absent extension package with no MCP dependency           |
        | row-2 | v0.3        | kernel-v0.3     | OMP_EXTENSION_AND_MCP   | the OMP extension and MCP server each execute the shared service | both components came from the exact dependency-absent installed v0.3 artifact |

  @story:US-6
  Rule: Fixture reviewer
    Actor: reviewer
    Goal: real fixture bytes tied to a producer/source, immutable hash, license disposition, and declared ground truth
    Benefit: parser tests do not validate invented input shapes.
    Covers: FR-11
    Context:
      **Priority:** Must


      **Why:** The pinned upstream fixture inventory is evidence of prior shapes, but the new repository must recapture target-owned fixtures and must not claim upstream test parity.

      **Independent Test:** Recompute every fixture hash, verify provenance fields, and reconcile expected occurrence counts against the parser result.

      **Acceptance Scenarios:** `@feature11`

    @feature11 @AC-11.1 @id:SCEN-real-fixture-provenance
    Scenario: Real fixture bytes reconcile with declared provenance and ground truth
      Given a target-owned fixture manifest records producer capture hash size license trimming and reviewed counts
      When fixture bytes are verified and parsed
      Then their hash and size match and all occurrence and outcome counts reconcile
      And the result makes no upstream parity or executed-scenario claim

  @story:US-7
  Rule: Spec corpus integrator
    Actor: maintainer of multiple specs
    Goal: local IDs to remain readable while runtime identity is spec-qualified
    Benefit: `FR-1` in two specs never collides and cross-spec references remain explicit.
    Covers: FR-2, FR-3
    Context:
      **Priority:** Should


      **Why:** Composite identity is required for lossless corpus-wide graphs.

      **Independent Test:** Parse two specs that each define `FR-1`, then resolve a local reference and a qualified cross-spec reference.

      **Acceptance Scenarios:** `@feature2`, `@feature3`

    @feature2 @AC-2.1 @id:SCEN-supported-documents-and-ids
    Scenario: Document-role grammar recognizes only canonical FR AC and TASK definitions
      Given the current product plugin-distribution spec-kernel and spec-authoring-workflow FR AC and TASK documents
      And their headings include FR colon-title and em-dash-title forms AC colon-title em-dash-title and bare exact-ID forms and TASK colon-title and em-dash-title forms
      And product acceptance documents contain FR grouping headings while requirement and task matrices repeat IDs as reference prose
      When the source set is parsed by canonical document role before heading shape
      Then every authored FR AC and TASK definition is emitted exactly once from its owning document
      And grouping wrong-document arbitrary and malformed headings do not become definitions
      And shared TASK status preserves planned and todo as distinct values while mapping canonical Completed to done
