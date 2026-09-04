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

  # Product lifecycle scenarios
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
    Given the public mutation inventory is inspected
    Then its names are exactly spec_propose_patch and apply_proposed_patch
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
    When a manager reads product status
    Then the only buckets are SHIPPED, NEXT, and LATER
    And there is one SHIPPED v0.3.2 row
    And there is one NEXT safe-authoring row
    And later outcomes are plain labels

  # MCP release-integrity scenarios
  @feature19 @FR-19 @AC-19.1 @id:SCEN-mri-active-project-root @release-evidence
  Scenario: Installed launcher uses the active project root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the installed package launcher serves project-a without an override
    Then the MCP overview contains only project-a specifications
    And relative unresolved or package-root overrides cannot select package-decoy
    When an explicit validated absolute override selects project-b
    Then the MCP inventory contains only project-b specifications
    And launcher startup from package cwd is refused before serving

  @feature20 @FR-20 @AC-20.1 @id:SCEN-mri-terminal-json-rpc @release-evidence
  Scenario: Invalid JSON-RPC requests have one terminal response
    Given an installed MCP server is running
    When the client sends JSON-RPC 1.0 with id 7 and then a valid request
    Then the first response is -32600 for id 7
    And the valid request returns one canonical envelope with no extra stdout frames
    When the client sends an unknown method with id 8 and an unknown tool with id 9
    Then the responses are -32601 for id 8 and -32602 for id 9

  @feature20 @FR-20 @AC-20.1 @id:SCEN-mri-malformed-json-recovery
  Scenario: Malformed JSON has one parse error and recovery
    Given an installed MCP server is running
    When the client sends malformed JSON and then a valid request
    Then the first response is -32700 with null id
    And the valid request returns one canonical envelope with no extra stdout frames

  @feature21 @FR-21 @AC-21.1 @id:SCEN-mri-all-tool-parity @release-evidence
  Scenario: Every historical packaged MCP handler executes
    Given a copied package has no source checkout or ambient dependencies
    When every historical eight-tool contract tool is called with its valid arguments
    Then each structured result equals the direct service envelope
    And the served corpus is byte-for-byte unchanged

  @feature22 @FR-22 @AC-22.1 @id:SCEN-mri-public-eligibility-separation @release-evidence
  Scenario: Meta-only producer output cannot become trusted evidence
    Given a v0.3.2 candidate and complete evidence record
    When the candidate message artifact contains only meta
    Then the candidate is refused for nonsemantic Cucumber evidence

  @feature23 @FR-23 @AC-23.1 @id:SCEN-mri-executable-launcher-archive
  Scenario: Candidate archive preserves the executable launcher
    Given a v0.3.2 candidate and complete evidence record
    When the candidate archive is extracted into a clean project
    Then the extracted launcher is executable and serves the active project

  @feature23 @FR-23 @AC-23.1 @id:SCEN-mri-symlinked-evidence-refusal
  Scenario Outline: Linked evidence parents cannot escape containment
    Given a v0.3.2 candidate and complete evidence record
    When the evidence "<directory>" directory has a symlinked parent
    Then the release evaluator reports "EVIDENCE_SYMLINK_COMPONENT" before reading evidence bytes

    Examples:
      | directory |
      | receipts  |
      | messages  |

  @feature23 @FR-23 @AC-23.1 @id:SCEN-mri-artifact-mismatch-refusal @release-evidence
  Scenario: Publication refuses different archive bytes
    Given the bounded current v0.3.2 public release status record
    When the recorded publication identities are reconciled
    Then the bounded record contains one exact published archive identity without a rebuild claim
    Given a candidate artifact without live distribution provenance
    When the publish verification sees a different archive or existing release asset
    Then publication is refused before release mutation

  @feature24 @FR-24 @AC-24.1 @id:SCEN-mri-public-communication-proof @release-evidence
  Scenario: Public communication reflects immutable v0.3.2 evidence
    Given the bounded current v0.3.2 public release status record
    When the recorded publication identities are reconciled
    Then the bounded record proves a trusted public release for the exact candidate
    And current public guidance and captured release notes match v0.3.2 and retain the v0.3.0 advisory

  @feature25 @FR-25 @AC-25.1 @id:SCEN-mri-response-provenance
  Scenario: Every installed MCP result identifies its server and root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the installed package launcher probes every MCP tool for project-a without an override
    Then every installed result identifies the active project root and server
    When the installed package launcher probes every MCP tool with project-b as an explicit override
    Then every installed result identifies project-b as an explicit root and marks the active-project mismatch

  @feature25 @FR-25 @AC-25.1 @id:SCEN-mri-extension-root-consistency
  Scenario: OMP extension inventory and query tools share one root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the OMP extension runs with project-a as cwd and project-b as an explicit root override
    Then its inventory and query results identify the same project-b root and server


  @feature26 @FR-26 @AC-26.1 @id:SCEN-mri-consolidated-11-tools
  Scenario: Consolidated 11-tool surface is discovered and verified
    Given a real packaged MCP server
    When tools are listed
    Then exactly 11 tools are present in contract order
    And 10 tools are annotated read-only and 1 mutating
    And no retired tool names are exposed
