Feature: Publish the omp-spec-kit plugin from verified installed bytes
  The distribution contract selects one contained target, builds it once,
  proves the installed lifecycle, and publishes the same digest with one final attestation.

  @feature1 @FR-1 @AC-1.1 @id:SCEN-select-contained-target-plugin
  Scenario: Select the contained target plugin without policing unrelated entries
    Given a catalog contains one entry named omp-spec-kit at ./plugins/omp-spec-kit
    And its declared entrypoints resolve beneath that child
    When the distribution target is selected
    Then the target identity is accepted
    And unrelated catalog entries do not affect the result
    But a duplicate target name or escaping path is rejected

  @feature2 @FR-2 @AC-2.1 @id:SCEN-build-deterministic-child-payload
  Scenario: Build deterministic child bytes
    Given the immutable tag commit and a clean output directory
    When the candidate is built twice
    Then the package-tree digests match
    And the archive digests match
    And unexpected or linked payload files are rejected

  @feature3 @FR-3 @AC-3.1 @id:SCEN-invoke-installed-candidate
  Scenario: Invoke the installed candidate through the supported host
    Given the exact archive is installed project-scope
    When a fresh supported OMP session sends a canonical read-only request
    Then the response identifies the candidate version
    And the declared surface matches the candidate manifest
    And runtime request semantics are delegated to the kernel contract

  @feature4 @FR-4 @AC-4.1 @id:SCEN-require-fresh-session-activation
  Scenario: Reload does not replace fresh activation proof
    Given discovery install and reload have completed
    When the pre-install session remains active
    Then activation is not proven
    When that session ends and a fresh session invokes the candidate
    Then activation is proven

  @feature5 @FR-5 @AC-5.1 @id:SCEN-run-without-ambient-dependencies
  Scenario: Run without ambient dependencies
    Given the installed payload is isolated from the checkout and external node_modules
    When the extension and MCP launcher are started
    Then the canonical invocation succeeds
    And no undeclared runtime dependency is used

  @feature6 @FR-6 @AC-6.1 @id:SCEN-contain-installed-invocation
  Scenario: Contain the installed invocation
    Given the active project differs from the package directory
    When the installed candidate is invoked
    Then it resolves the active project
    And project hashes remain unchanged
    And no credential network model or background access occurs

  @feature7 @FR-7 @AC-7.1 @id:SCEN-upgrade-from-real-public-release
  Scenario: Upgrade from a real public predecessor
    Given exact public predecessor bytes and a newer candidate
    When the predecessor is installed and then upgraded
    Then a fresh session observes the candidate version
    And catalog child tag commit and archive identities agree

  @feature8 @FR-8 @AC-8.1 @id:SCEN-recover-with-exact-artifacts
  Scenario: Recover with uninstall reinstall and rollback
    Given the candidate is installed
    When it is uninstalled reinstalled and rolled back with exact artifacts
    Then fresh sessions observe absence candidate and predecessor in order
    And non-OMP-managed project hashes remain unchanged

  @feature9 @FR-9 @AC-9.1 @id:SCEN-block-unsafe-public-artifact
  Scenario: Block an unsafe public artifact
    Given one public-safety check fails
    When release eligibility is evaluated
    Then no public asset is created
    And the protected value is absent from diagnostics

  @feature10 @FR-10 @AC-10.1 @id:SCEN-publish-same-digest-with-final-attestation
  Scenario: Publish the same digest with one final attestation
    Given every named check passed for a qualifying tag
    When the release is published
    Then the public archive digest equals the verified build digest
    And one final GitHub Artifact Attestation names that archive digest
    And no rebuild or different replacement asset is allowed

  @feature11 @FR-11 @AC-11.1 @id:SCEN-write-compact-distribution-status
  Scenario: Write a compact distribution status
    Given publication and final attestation succeeded
    When the distribution record is written
    Then it contains candidate checks lifecycle asset and attestation identity
    And it contains no product capability decision

  @feature12 @FR-12 @AC-12.1 @id:SCEN-block-on-named-check-failure
  Scenario: Block on a named check failure
    Given one of target build install invoke dependencyAbsent lifecycle or publicSafety failed
    When the release decision is made
    Then publication stops
    And CI diagnostics name the failed check
    And no extra receipt envelope is required

  @feature13 @FR-13 @AC-13.1 @id:SCEN-use-one-practical-release-path
  Scenario: Use one practical release path
    Given a next candidate is ready for evaluation
    When distribution processes the candidate
    Then it validates the target and builds once
    And it runs installed lifecycle and public-safety checks
    And it publishes the same digest and attests the public archive
    And it does not emit distribution-release-eligibility at 2
