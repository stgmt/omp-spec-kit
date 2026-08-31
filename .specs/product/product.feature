# Specification text only. Scenarios are not execution evidence without a producer receipt.
@product
Feature: Honest product status for omp-spec-kit
  The public roadmap shows one current release, one next outcome, and plain later outcomes.

  @feature1 @FR-1 @AC-1.1 @id:SCEN-current-release-proof
  Scenario: Current release proof supports the single shipped row
    Given the roadmap contains the v0.3.2 read-only MCP baseline
    And the bounded release proof names version 0.3.2 and identity omp-spec-kit@omp-spec-kit
    When the public status is evaluated
    Then exactly one row is SHIPPED
    And it names the v0.2 graph/query kernel and eight working read-only MCP tools

  @feature2 @FR-2 @AC-2.1 @id:SCEN-one-product-identity
  Scenario: One product identity remains visible
    Given the marketplace, package, and extension are inspected
    When installed identities are counted
    Then exactly one product identity is omp-spec-kit@omp-spec-kit
    And no competing specification writer is present

  @feature3 @FR-3 @AC-3.1 @id:SCEN-missing-proof-is-not-shipped
  Scenario: Missing current proof prevents shipment
    Given a roadmap outcome has no current proof for its released identity
    When public status is evaluated
    Then that outcome is NEXT or LATER
    And it is not SHIPPED

  @feature3 @FR-3 @AC-3.2 @id:SCEN-unexecuted-text-is-not-proof
  Scenario: Unexecuted text does not prove shipment
    Given an outcome has only a specification, task state, or Gherkin scenario
    When public status is evaluated
    Then that outcome is not SHIPPED

  @feature4 @FR-4 @AC-4.1 @id:SCEN-authoring-tools-are-bounded
  Scenario: Public authoring has two mutation tools
    Given the public mutation inventory is inspected
    Then its names are exactly propose_patch and apply_proposed_patch
    And helper operations are internal

  @feature4 @FR-4 @AC-4.2 @id:SCEN-direct-spec-write-is-refused
  Scenario: Non-allowlisted direct spec writes are refused
    Given a write-capable tool_call is not in the exact authoring-name allowlist
    And its canonically resolved target is under .specs
    When the path policy runs
    Then the call is refused with a bounded reason
    And a link or reparse escape fails closed

  @feature5 @FR-5 @AC-5.1 @id:SCEN-roadmap-has-three-buckets
  Scenario: Roadmap uses only three public buckets
    When a manager reads product status
    Then the only buckets are SHIPPED, NEXT, and LATER
    And there is one SHIPPED v0.3.2 row
    And there is one NEXT safe-authoring row
    And later outcomes are plain labels
