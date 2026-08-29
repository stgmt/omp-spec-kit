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
    And historical distribution-release-eligibility at 1 owned by plugin-distribution:FR-13 has not accepted the complete FR-1 through FR-12 matrix
    When the product stage is evaluated
    Then v0.1.0 remains "PLANNED" or "BLOCKED"
    And the last proven stage remains authoritative
    And the versioned plugin-distribution:FR-13 profile is the next gate

  @feature6 @FR-6 @AC-6.2 @id:SCEN-owning-aggregate-cannot-be-bypassed
  Scenario Outline: A baseline or capability cannot bypass its exact aggregate set
    Given the delivered v0.3.2 baseline and proposed <capability> state
    And <aggregate_state>
    When baseline and capability gates are evaluated
    Then the <capability> delivered claim is <decision>
    And <reason>

    Examples:
      | capability          | aggregate_state                                                                 | decision | reason                                              |
      | V0_2_BASELINE       | candidate distribution and targetStage v0.2 kernel aggregates are accepted      | accepted | the exact historical baseline gate is satisfied     |
      | V0_3_BASELINE       | candidate distribution current-v0.3 and linked active v0.2 predecessor accepted | accepted | the exact baseline and parent chain are satisfied   |
      | GENERATOR_READS     | either CHK-FR16-01 or CHK-FR17-01 is missing                                     | refused  | exact generator profiles are incomplete             |
      | LSP_ADAPTER         | v0.3 baseline and complete spec-lsp FR-12 profile are accepted                   | accepted | the exact LSP map is satisfied                      |
      | EVIDENCE_MCP        | evidence aggregate omits spec-evidence FR-14                                     | refused  | defining MCP projection aggregate is missing        |
      | CAPABILITY_GRAPH    | v0.3 baseline and spec-capability FR-9 are accepted                              | accepted | exact capability graph map is satisfied             |
      | AUTHORING_MCP       | evidence and authoring pass but spec-enforcement FR-11 is missing                | refused  | joint authoring-enforcement tuple is incomplete     |
      | AUTHORING_MCP       | evidence authoring and enforcement joint tuple is accepted                       | accepted | joint mutation boundary is satisfied                |
      | SPEC_ENFORCEMENT    | joint tuple passes but spec-enforcement CHK-FR1-01 host authority is absent      | refused  | state remains DEFERRED_HOST_ABI                         |
      | SPEC_ENFORCEMENT    | evidence authoring enforcement and authenticated tool-call host ABI are accepted | accepted | joint enforcement boundary and host authority are satisfied             |
      | AUTOMATIC_PLAN_GATE | plan-gate FR-13 passes but CHK-HOST-ABI-01 is absent                              | refused  | state remains DEFERRED_HOST_ABI                     |

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
    Given public v0.3.2 baseline and exactly seven capability rows with schema-valid states blockers and next gates
    When a manager reads README ROADMAP and the bounded status record
    Then delivered baseline SPECIFIED DEFERRED and DEFERRED_HOST_ABI states are visibly distinct
    And every capability names exact owner and aggregate tuple
    And excluded harness machinery is not presented as delivered

  @feature8 @FR-8 @AC-8.2 @id:SCEN-canonical-owner-delegation
  Scenario: Product spec delegates internals to canonical owners
    Given product documents refer to distribution kernel LSP evidence capability authoring enforcement and plan-gate behavior
    When qualified boundary references are inspected
    Then each sibling uses its canonical FR and release check identities
    And the seven aggregate maps equal product_SCHEMA and release-status rows
    And product documents do not redefine sibling internals

  @feature9 @FR-9 @AC-9.1 @id:SCEN-generator-port-destination
  Scenario: Generator-port destination is MCP with a 46-row census
    Given the canonical census in docs/decisions/spec-generator-port.md exists
    And every census row has an owner spec and a stage
    When a manager reads the roadmap and agent-facing inventory
    Then ROADMAP calls v0.3 the first slice of the generator-port MCP door
    And the agent API is MCP only
    And leftover freeze phrases that deny the 46-tool door fail
