@spec-kernel @read-only
Feature: One deterministic specification graph core
  The core is pure and occurrence-first. Historical MCP names are thin compatibility adapters.

  @feature1 @AC-1.1 @id:SCEN-pure-occurrence-first-core
  Scenario: Pure occurrence-first core
    Given caller-supplied canonical source documents and limits
    When the core builds a graph
    Then it performs no ambient I/O and preserves source occurrences

  @feature2 @AC-2.1 @id:SCEN-canonical-documents-and-qualified-ids
  Scenario: Canonical documents and qualified IDs
    Given the fifteen canonical document names and two specs with the same local ID
    When role-aware parsing runs
    Then owning-document definitions and spec-qualified identities are distinct
    And duplicate candidates are retained

  @feature3 @AC-3.1 @id:SCEN-typed-graph-conservation
  Scenario: Typed graph conservation
    Given valid, missing, ambiguous, malformed, and forbidden references
    When the graph resolves occurrences
    Then each reference has one typed edge outcome
    And all conservation equations reconcile

  @feature4 @AC-4.1 @id:SCEN-four-bounded-core-primitives
  Scenario: Four bounded core primitives
    Given an immutable graph and a bounded cursor
    When inventory findNodes traverse and diagnostics are called
    Then one deterministic envelope returns stable pages or typed errors

  @feature5 @AC-5.1 @id:SCEN-contained-inputs-and-budgets
  Scenario: Contained inputs and budgets
    Given contained canonical files and unsafe or oversized variants
    When the host adapter prepares sources
    Then unsafe bytes are refused before admission and no writes occur

  @feature6 @AC-6.1 @id:SCEN-historical-eight-name-compatibility
  Scenario: Historical eight-name compatibility
    Given the released v0.3.2 compatibility adapters
    When each preserved MCP name projects a common request
    Then each result matches the shared core after transport metadata is removed

  @feature7 @AC-7.1 @id:SCEN-deterministic-diagnostics-and-fingerprint
  Scenario: Deterministic diagnostics and fingerprint
    Given equivalent normalized source bytes in different orders and line endings
    When the graph is built
    Then canonical bytes diagnostics and fingerprint are identical
    And query availability does not affect the fingerprint

  @feature8 @AC-8.1 @id:SCEN-real-fixtures-and-measurable-budgets
  Scenario: Real fixtures and measurable budgets
    Given the target-owned real-corpus manifest and retained receipt references
    When hashes oracles and package measurements are reviewed
    Then provenance and budgets are visible without a kernel release claim
