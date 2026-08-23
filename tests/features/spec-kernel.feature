@spec-kernel @integration
Feature: The v0.2 spec kernel core is pure, deterministic, and fail-closed
  As the omp-spec-kit v0.2 read-only kernel contract
  the pure graph builder, query service, and filesystem adapter
  must preserve corpus bytes losslessly, allocate anchors adversarially,
  elect duplicates without loss, emit typed diagnostics, and refuse
  unsafe or unbounded inputs with closed envelopes.

  @id:SCEN-real-corpus-ground-truth @feature3 @feature6 @feature11 @AC-3.1 @AC-6.1 @AC-11.1
  Scenario: The real four-spec corpus builds one deterministic fully conserved graph
    Given the repository's own four-spec corpus pinned by the captured fixture manifest
    When the filesystem reader ingests the corpus and the kernel builds two graphs in competing input orders
    Then every ingested file matches the manifest provenance hashes byte-for-byte
    And the graph counts equal the manifest ground truth exactly
    And every conservation invariant reconciles with zero unresolved qualified references
    And source bytes are preserved losslessly into the graph documents
    And both competing builds serialize to the identical canonical snapshot

  @id:SCEN-adversarial-anchor-allocation @feature13 @AC-13.1
  Scenario: Adversarial duplicate headings allocate the smallest unused anchor against the complete emitted set
    Given a synthetic producer with adversarial duplicate heading sequences "Foo Foo Foo-1" and "Foo-1 Foo Foo"
    When the kernel builds the graph from the producer bytes
    Then the allocated canonical anchors are exactly "foo foo-1 foo-1-1" and "foo-1 foo foo-2"
    And every allocation records the glfm-anchor@1 algorithm and minimal duplicate ordinals

  @id:SCEN-duplicate-election-lossless @feature4 @AC-4.1
  Scenario: Duplicate FR definitions keep both occurrences and refuse the identity without loss
    Given a synthetic producer whose FR.md defines FR-1 twice as "Alpha" then "Beta"
    When the kernel builds the graph from the producer bytes
    Then both duplicate candidates remain preserved in canonical document order
    And no unique node is elected for the duplicated identity
    And one DUPLICATE_DEFINITION diagnostic binds both candidate occurrences
    And getNode rejects the ambiguous identity with bounded stable candidates
    And the qualified reference into the duplicated identity stays UNRESOLVED with reason "AMBIGUOUS_TARGET"

  @id:SCEN-typed-diagnostics-fail-closed @feature5 @feature6 @AC-5.1 @AC-6.1
  Scenario: Broken links and a duplicate identity produce typed stably-sorted diagnostics and an invalid graph
    Given a synthetic producer with two broken markdown links and a duplicated FR identity
    When the kernel builds the graph from the producer bytes
    Then every broken link occurrence carries its exact typed unresolved reason
    And the diagnostic inventory contains exactly the expected typed codes in stable order
    And graph validity is false exactly when an ERROR-severity diagnostic exists

  @id:SCEN-query-envelope-fail-closed @feature8 @AC-8.1
  Scenario Outline: Unknown operations and unknown fields fail closed with typed envelopes
    Given a built synthetic producer graph
    When the query service receives "<request>"
    Then the envelope rejects it fail-closed with error code "<code>"

    Examples:
      | request                              | code              |
      | an unknown operation                 | UNKNOWN_OPERATION |
      | a known operation with unknown field | UNKNOWN_FIELD     |

  @id:SCEN-reader-refuses-junction @feature7 @AC-7.1
  Scenario: A real directory junction below .specs is refused before any content read
    Given a temporary repository whose spec directory contains a real directory junction
    When the filesystem reader inspects the temporary repository
    Then the reader refuses before reading any linked content

  @id:SCEN-large-corpus-bounds @feature8 @feature12 @AC-8.1 @AC-12.1
  Scenario: Pagination over a large synthetic corpus is explicit, truncated visibly, and fingerprint-bound
    Given a large synthetic corpus of four specs with one hundred twenty requirements
    When the query service pages through every requirement three at a time
    Then the cursor chain conserves every matched requirement exactly once
    And an out-of-range page size fails closed without silent truncation
    And a cursor from a foreign graph is rejected as stale
