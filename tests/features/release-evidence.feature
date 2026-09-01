@mcp-release-integrity
Feature: Verify the v0.4.1 release evidence boundary
  These scenarios are the executable projection of the release-integrity
  scenarios in the authoring corpus. They run against the real packaged server
  and emit the canonical scenario ids consumed by the evidence composer.

  Background:
    Given an isolated v0.3.2 package and manifest-verified corpus exist
  @release-evidence @id:SCEN-mri-active-project-root
  Scenario: Installed launcher uses the active project root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the installed package launcher serves project-a without an override
    Then the MCP overview contains only project-a specifications
    And relative unresolved or package-root overrides cannot select package-decoy
    When an explicit validated absolute override selects project-b
    Then the MCP inventory contains only project-b specifications
    And launcher startup from package cwd is refused before serving

  @release-evidence @id:SCEN-mri-terminal-json-rpc
  Scenario: Invalid JSON-RPC requests have one terminal response
    Given an installed MCP server is running
    When the client sends JSON-RPC 1.0 with id 7 and then a valid request
    Then the first response is -32600 for id 7
    And the valid request returns one canonical envelope with no extra stdout frames
    When the client sends an unknown method with id 8 and an unknown tool with id 9
    Then the responses are -32601 for id 8 and -32602 for id 9

  @id:SCEN-mri-malformed-json-recovery
  Scenario: Malformed JSON has one parse error and recovery
    Given an installed MCP server is running
    When the client sends malformed JSON and then a valid request
    Then the first response is -32700 with null id
    And the valid request returns one canonical envelope with no extra stdout frames

  @release-evidence @id:SCEN-mri-all-tool-parity
  Scenario: Every historical packaged MCP handler executes
    Given a copied package has no source checkout or ambient dependencies
    When every SCHEMA-11 tool is called with its valid arguments
    Then each structured result equals the direct service envelope
    And the served corpus is byte-for-byte unchanged

  @release-evidence @id:SCEN-mri-public-eligibility-separation
  Scenario: Meta-only producer output cannot become trusted evidence
    Given a v0.4.1 candidate and complete evidence record
    When the current candidate message artifact contains only meta
    Then the current candidate is refused for nonsemantic Cucumber evidence

  @release-evidence @id:SCEN-mri-artifact-mismatch-refusal
  Scenario: Publication refuses different archive bytes
    Given the bounded v0.3.2 predecessor release status record
    When the predecessor publication identities are reconciled
    Then the predecessor record contains one exact published archive identity
    Given a v0.4.1 candidate without live distribution provenance
    When current publish verification sees a different archive identity
    Then current publication is refused before release mutation

  @release-evidence @id:SCEN-mri-public-communication-proof
  Scenario: Public communication reflects immutable v0.3.2 evidence
    Given the bounded v0.3.2 predecessor release status record
    When the predecessor publication identities are reconciled
    Then the predecessor record proves a trusted public release for its exact candidate
    And predecessor public guidance retains the v0.3.0 advisory
