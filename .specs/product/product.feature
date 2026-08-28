# Specification text only. These scenarios have not been executed and are not passing evidence.
@product @specification-only
Feature: Honest public lifecycle for omp-spec-kit
  The product begins with specifications and provenance, preserves one identity,
  and advances public claims only when current stage-owned evidence exists.

  @feature1 @FR-1 @AC-1.1 @id:SCEN-specification-only-init
  Scenario: Specification-only init reports no installable plugin
    Given the candidate is in the public-init stage
    And no marketplace catalog, plugin package, release, or runtime evidence exists
    When a reader opens the product status
    Then the state is "SPEC_ONLY"
    And the status says there is no installable plugin
    And no install command is presented as usable

  @feature1 @FR-1 @AC-1.2 @id:SCEN-premature-installable-artifact
  Scenario: Premature installable artifact blocks public init
    Given the candidate is in the public-init stage
    And the candidate contains a marketplace catalog
    When public-init eligibility is evaluated
    Then the result is "BLOCKED"
    And the premature marketplace artifact is identified

  @feature2 @FR-2 @AC-2.1 @id:SCEN-pinned-source-export
  Scenario: Pinned source export is reproducible
    Given the source repository and immutable commit are recorded
    And every inventoried source path has a hash, disposition, import status, and license status
    When the approved export is reconstructed from Git-object bytes
    Then every copied target matches its recorded SHA-256
    And every excluded path remains absent from the snapshot

  @feature2 @FR-2 @AC-2.2 @id:SCEN-mismatched-imported-byte
  Scenario: A mismatched imported byte blocks publication
    Given an imported target differs from its recorded source-object bytes
    When source-freeze eligibility is evaluated
    Then source-freeze eligibility fails
    And the mismatched path is reported
    And publication remains blocked

  @feature3 @FR-3 @AC-3.1 @id:SCEN-unresolved-import-license
  Scenario: Unresolved imported license status blocks publication
    Given a hypothetical future or changed copied item has an unresolved redistribution basis
    When publication eligibility is evaluated
    Then the state is "NOT_READY_FOR_PUBLICATION"
    And the affected imported item is identified
    And the remediation includes authorization or removal or replacement

  @feature3 @FR-3 @AC-3.2 @id:SCEN-root-license-import-separation
  Scenario: New material license cannot relabel an import
    Given the repository has a root MIT license for repository-owned material
    And a hypothetical future or changed imported item has an unresolved upstream license status
    When the imported item's license status is evaluated
    Then the imported status remains unresolved
    And the root license is not used as redistribution evidence for that item

  @feature4 @FR-4 @AC-4.1 @id:SCEN-prohibited-state-path
  Scenario: A prohibited state path blocks the clean export
    Given the candidate public tree contains user-local runtime state
    When the public-tree allowlist is evaluated
    Then public eligibility fails
    And the prohibited path and class are reported

  @feature4 @FR-4 @AC-4.2 @id:SCEN-unresolved-secret-finding
  Scenario: An unresolved secret finding blocks publication
    Given the complete candidate scan contains an unresolved secret finding
    And no complete reviewer exception covers the exact finding and revision
    When remote publication eligibility is evaluated
    Then remote creation and push remain blocked
    And the finding is named as a blocker

  @feature5 @FR-5 @AC-5.1 @id:SCEN-single-product-identity
  Scenario: Future distribution preserves one product identity
    Given an installable distribution candidate exists
    When its product cardinality is evaluated by plugin-distribution:FR-1
    Then the product name is "omp-spec-kit"
    And the installed identity is "omp-spec-kit@omp-spec-kit"
    And exactly one marketplace entry exists
    And exactly one plugin package exists
    And exactly one extension entry exists

  @feature5 @FR-5 @AC-5.2 @id:SCEN-second-control-plane-refusal
  Scenario: A second product control plane is refused
    Given one omp-spec-kit plugin and extension already own the product runtime
    And a later stage introduces a second extension control plane
    When product identity continuity is evaluated
    Then the stage gate fails
    And the competing control plane is identified

  @feature6 @FR-6 @AC-6.1 @id:SCEN-incomplete-aggregate-remains-planned
  Scenario: A stage with missing evidence remains planned
    Given the proposed v0.1.0 stage has evidence for only some mandatory distribution requirements
    And plugin-distribution:FR-13 has not accepted complete mandatory evidence for plugin-distribution:FR-1 through plugin-distribution:FR-12
    When the product stage is evaluated
    Then v0.1.0 remains "PLANNED" or "BLOCKED"
    And the last proven stage remains authoritative
    And plugin-distribution:FR-13 is the next gate

  @feature6 @FR-6 @AC-6.2 @id:SCEN-owning-aggregate-cannot-be-bypassed
  Scenario Outline: A later stage cannot bypass its cumulative aggregate gate set
    Given the <stage> stage is proposed for product revision R, current candidate artifact B, and artifact lineage L
    And <aggregate_state>
    And <artifact_binding>
    When ordered stage gates are evaluated
    Then the <stage> delivered claim is <decision>
    And <reason>

    Examples:
      | stage     | aggregate_state                                                                                         | artifact_binding                                                                                                                                | decision | reason                                                  |
      | v0.2      | every mandatory distribution and targetStage v0.2 aggregate is accepted                               | distribution and v0.2 kernel evidence both use CURRENT_CANDIDATE artifact B and lineage L                                                       | accepted | the complete all-not-any v0.2 gate set is satisfied       |
      | v0.2      | targetStage v0.2 is accepted but plugin-distribution:FR-13 is missing                                  | the v0.2 kernel evidence uses CURRENT_CANDIDATE artifact B and lineage L                                                                         | refused  | plugin-distribution:FR-13 is a cumulative blocker          |
      | v0.3      | distribution plus separate targetStage v0.2 and targetStage v0.3 results are complete and accepted    | distribution and v0.3 use CURRENT_CANDIDATE B; v0.2 uses PREDECESSOR_V0_2 A; v0.3 names parent A; both kernel results use revision R and lineage L | accepted | the distinct-artifact A-to-B parent chain is valid         |
      | v0.3      | the complete cumulative aggregate set is accepted                                                     | v0.2 uses predecessor A but v0.3 names parent C                                                                                                  | refused  | the exact parent artifact SHA-256 does not match           |
      | v0.3      | the complete cumulative aggregate set is accepted                                                     | v0.2 uses predecessor A in lineage X while the current v0.3 candidate uses lineage L                                                             | refused  | predecessor evidence belongs to another lineage            |
      | v0.3      | the complete cumulative aggregate set is otherwise accepted                                           | v0.2 predecessor A is stale or revoked                                                                                                           | refused  | predecessor evidence is not active                         |
      | v0.3      | the complete cumulative aggregate set is accepted                                                     | distribution or targetStage v0.3 evidence binds to predecessor A instead of current candidate B                                                  | refused  | current evidence does not bind to the current candidate    |
      | authoring | distribution, both kernel target stages, and spec-authoring-workflow:FR-13 are complete and accepted | distribution, v0.3, and authoring use CURRENT_CANDIDATE B; linked active v0.2 predecessor A uses revision R and lineage L                        | accepted | every cumulative gate and artifact-binding rule is satisfied |
      | authoring | distribution and spec-authoring-workflow:FR-13 are accepted but either kernel target result is absent | current evidence uses candidate B and lineage L                                                                                                  | refused  | the missing kernel target result is a cumulative blocker   |

  @feature7 @FR-7 @AC-7.1 @id:SCEN-status-fails-closed
  Scenario: Status fails closed when evidence is missing
    Given a non-public-init capability claim lacks one accepted aggregate from its cumulative gate set for the candidate artifact lineage
    When public status is rendered
    Then the capability state is not "DELIVERED"
    And the status includes every missing cumulative aggregate blocker and next gate

  @feature7 @FR-7 @AC-7.2 @id:SCEN-unexecuted-bdd-not-evidence
  Scenario: Unexecuted BDD cannot produce a delivered claim
    Given a Gherkin scenario exists for a product requirement
    And no executed result is tied to the same requirement and revision
    When evidence-derived status is calculated
    Then the scenario is labeled specification text only
    And it contributes no passing or delivered evidence

  @feature8 @FR-8 @AC-8.1 @id:SCEN-roadmap-separates-states
  Scenario: Roadmap separates delivered planned deferred and blocked
    Given the public-init candidate has resolved license evidence, completed validation gates, and later planned stages
    When a manager reads the README and roadmap
    Then current, planned, deferred, and blocked states are visibly distinct
    And the validated non-public state and remaining publication action are stated explicitly
    And excluded harness machinery is not presented as delivered

  @feature8 @FR-8 @AC-8.2 @id:SCEN-canonical-owner-delegation
  Scenario: Product spec delegates internals to canonical owners
    Given the product documents refer to distribution, kernel, LSP, evidence, and authoring behavior
    When their boundary references are inspected
    Then distribution uses canonical plugin-distribution requirement IDs
    And kernel uses canonical spec-kernel requirement IDs
    And LSP uses canonical spec-lsp requirement IDs
    And evidence uses canonical spec-evidence requirement IDs
    And authoring uses canonical spec-authoring-workflow requirement IDs
    And product documents do not redefine their internal contracts

  @feature9 @FR-9 @AC-9.1 @id:SCEN-generator-port-destination
  Scenario: Generator-port destination is MCP with a 46-row census
    Given the canonical census in docs/decisions/spec-generator-port.md exists
    And every census row has an owner spec and a stage
    When a manager reads the roadmap and agent-facing inventory
    Then ROADMAP calls v0.3 the first slice of the generator-port MCP door
    And the agent API is MCP only
    And leftover freeze phrases that deny the 46-tool door fail
