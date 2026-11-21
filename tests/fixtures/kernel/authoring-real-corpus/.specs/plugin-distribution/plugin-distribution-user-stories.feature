Feature: plugin-distribution user stories

  @story:US-1
  Rule: Install the intended plugin
    Actor: user
    Goal: the omp-spec-kit catalog entry to install from its contained child
    Benefit: unrelated repository packages cannot change what I receive.
    Covers: FR-1, FR-2
    Context:
      **Priority:** Must

      **Why:** Child containment prevents unrelated package bytes from entering the installed product.

      **Independent Test:** Build the tagged candidate and verify catalog selection, child containment, and package-tree identity.

      **Acceptance Scenarios:** @feature1, @feature2

      **Requirements:** FR-1, FR-2

    @feature1 @FR-1 @AC-1.1 @id:SCEN-select-contained-target-plugin
    Scenario: Select the contained target plugin without policing unrelated entries
      Given a catalog contains one entry named omp-spec-kit at ./plugins/omp-spec-kit
      And its declared entrypoints resolve beneath that child
      When the distribution target is selected
      Then the target identity is accepted
      And unrelated catalog entries do not affect the result
      But a duplicate target name or escaping path is rejected

  @story:US-2
  Rule: Invoke installed bytes
    Actor: user
    Goal: a fresh session to invoke the installed candidate without the checkout or ambient dependencies
    Benefit: a green build is not mistaken for a usable release.
    Covers: FR-3, FR-4, FR-5, FR-6
    Context:
      **Priority:** Must

      **Why:** Runtime proof must exercise the shipped bytes rather than a source checkout.

      **Independent Test:** Invoke the installed artifact from a foreign working directory with no source checkout or ambient node_modules.

      **Acceptance Scenarios:** @feature3, @feature4, @feature5, @feature6

      **Requirements:** FR-3, FR-4, FR-5, FR-6

    @feature3 @FR-3 @AC-3.1 @id:SCEN-invoke-installed-candidate
    Scenario: Invoke the installed candidate through the supported host
      Given the exact archive is installed project-scope
      When a fresh supported OMP session sends a canonical read-only request
      Then the response identifies the candidate version
      And the declared surface matches the candidate manifest
      And runtime request semantics are delegated to the kernel contract

    @feature19 @FR-19 @AC-19.1 @id:SCEN-mri-active-project-root @release-evidence
    Scenario: Installed launcher uses the active project root
      Given project-a, project-b, and package-decoy have distinct specifications
      When the installed package launcher serves project-a without an override
      Then the MCP overview contains only project-a specifications
      And relative unresolved or package-root overrides cannot select package-decoy
      When an explicit validated absolute override selects project-b
      Then the MCP inventory contains only project-b specifications
      And launcher startup from package cwd is refused before serving

  @story:US-3
  Rule: Recover safely
    Actor: user
    Goal: uninstall/reinstall plus upgrade/rollback to preserve my project
    Benefit: a bad release is reversible.
    Covers: FR-7, FR-8
    Context:
      **Priority:** Must

      **Why:** Lifecycle recovery must not damage the project or leave stale activation state.

      **Independent Test:** Execute install, fresh-session uninstall, reinstall, upgrade, and rollback and compare project hashes.

      **Acceptance Scenarios:** @feature7, @feature8

      **Requirements:** FR-7, FR-8

    @feature7 @FR-7 @AC-7.1 @id:SCEN-upgrade-from-real-public-release
    Scenario: Upgrade from a real public predecessor
      Given exact public predecessor bytes and a newer candidate
      When the predecessor is installed and then upgraded
      Then a fresh session observes the candidate version
      And catalog child tag commit and archive identities agree

  @story:US-4
  Rule: Trust the published archive
    Actor: release consumer
    Goal: the public archive to be the exact verified build with a GitHub Artifact Attestation
    Benefit: publication cannot substitute new bytes.
    Covers: FR-9, FR-10
    Context:
      **Priority:** Must

      **Why:** Publication is trustworthy only when identity, digest, and attestation remain bound to one candidate.

      **Independent Test:** Reconcile the candidate, archive, publication record, and attestation digests and reject any mismatch.

      **Acceptance Scenarios:** @feature9, @feature10

      **Requirements:** FR-9, FR-10

    @feature9 @FR-9 @AC-9.1 @id:SCEN-block-unsafe-public-artifact
    Scenario: Block an unsafe public artifact
      Given one public-safety check fails
      When release eligibility is evaluated
      Then no public asset is created
      And the protected value is absent from diagnostics

  @story:US-5
  Rule: Understand status
    Actor: maintainer
    Goal: one compact distribution record
    Benefit: I can distinguish SHIPPED release evidence from NEXT design without reading per-requirement receipts.
    Covers: FR-11, FR-12, FR-13
    Context:
      **Priority:** Must

      **Why:** A single status decision prevents stale or partial evidence from becoming a public release claim.

      **Independent Test:** Evaluate the status record with missing, stale, partial, and complete evidence and compare the result with the documented gate.

      **Acceptance Scenarios:** @feature11, @feature12, @feature13

      **Requirements:** FR-11, FR-12, FR-13

    @feature11 @FR-11 @AC-11.1 @id:SCEN-write-compact-distribution-status
    Scenario: Write a compact distribution status
      Given publication and final attestation succeeded
      When the distribution record is written
      Then it contains candidate checks lifecycle asset and attestation identity
      And it contains no product capability decision

  @contract
  Rule: Release and implementation contracts

    @feature14 @FR-14 @AC-14.1 @id:SCEN-product-current-release-proof
    Scenario: Current release proof supports the single shipped row
      Given the roadmap contains the v0.3.2 read-only MCP baseline
      And the bounded release proof names version 0.3.2 and identity omp-spec-kit@omp-spec-kit
      When the public status is evaluated
      Then exactly one row is SHIPPED
      And it names the v0.2 graph/query kernel and eight working read-only MCP tools

    @feature15 @FR-15 @AC-15.1 @id:SCEN-product-one-product-identity
    Scenario: One product identity remains visible
      Given the marketplace, package, and extension are inspected
      When installed identities are counted
      Then exactly one product identity is omp-spec-kit@omp-spec-kit
      And no competing specification writer is present

    @feature16 @FR-16 @AC-16.1 @id:SCEN-product-missing-proof-is-not-shipped
    Scenario: Missing current proof prevents shipment
      Given a roadmap outcome has no current proof for its released identity
      When public status is evaluated
      Then that outcome is NEXT or LATER
      And it is not SHIPPED

    @feature16 @FR-16 @AC-16.2 @id:SCEN-product-unexecuted-text-is-not-proof
    Scenario: Unexecuted text does not prove shipment
      Given an outcome has only a specification, task state, or Gherkin scenario
      When public status is evaluated
      Then that outcome is not SHIPPED

    @feature17 @FR-17 @AC-17.1 @id:SCEN-product-authoring-tools-are-bounded
    Scenario: Public authoring has two mutation tools
      Given an available mutation inventory
      When the public mutation inventory is inspected
      Then its names are exactly spec_patch
      And helper operations are internal

    @feature17 @FR-17 @AC-17.2 @id:SCEN-product-direct-spec-write-is-refused
    Scenario: Non-allowlisted direct spec writes are refused
      Given a write-capable tool_call is not in the exact authoring-name allowlist
      And its canonically resolved target is under .specs
      When the path policy runs
      Then the call is refused with a bounded reason
      And a link or reparse escape fails closed

    @feature18 @FR-18 @AC-18.1 @id:SCEN-product-roadmap-has-three-buckets
    Scenario: Roadmap uses only three public buckets
      Given a product roadmap is available
      When a manager reads product status
      Then the only buckets are SHIPPED, NEXT, and LATER
      And there is one SHIPPED v0.3.2 row
      And there is one NEXT safe-authoring row
      And later outcomes are plain labels
