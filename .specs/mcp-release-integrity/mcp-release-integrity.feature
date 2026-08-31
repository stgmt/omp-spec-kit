@mcp-release-integrity
Feature: MRI001 verifies installed behavior and immutable release bytes
  MRI verifies the installed v0.3.2 boundary and keeps future candidate
  evidence tied to real unfiltered execution and exact archive bytes.

  Background:
    Given an isolated v0.3.2 package and manifest-verified corpus exist

  @feature1 @FR-1 @AC-1.1 @id:SCEN-mri-active-project-root @release-evidence
  Scenario: Installed launcher uses the active project root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the installed package launcher serves project-a without an override
    Then the MCP overview contains only project-a specifications
    And relative unresolved or package-root overrides cannot select package-decoy
    When an explicit validated absolute override selects project-b
    Then the MCP inventory contains only project-b specifications
    And launcher startup from package cwd is refused before serving

  @feature2 @FR-2 @AC-2.1 @id:SCEN-mri-terminal-json-rpc @release-evidence
  Scenario: Invalid JSON-RPC requests have one terminal response
    Given an installed MCP server is running
    When the client sends JSON-RPC 1.0 with id 7 and then a valid request
    Then the first response is -32600 for id 7
    And the valid request returns one canonical envelope with no extra stdout frames
    When the client sends an unknown method with id 8 and an unknown tool with id 9
    Then the responses are -32601 for id 8 and -32602 for id 9

  @feature2 @FR-2 @AC-2.1 @id:SCEN-mri-malformed-json-recovery
  Scenario: Malformed JSON has one parse error and recovery
    Given an installed MCP server is running
    When the client sends malformed JSON and then a valid request
    Then the first response is -32700 with null id
    And the valid request returns one canonical envelope with no extra stdout frames

  @feature3 @FR-3 @AC-3.1 @id:SCEN-mri-all-tool-parity @release-evidence
  Scenario: Every historical packaged MCP handler executes
    Given a copied package has no source checkout or ambient dependencies
    When every SCHEMA-11 tool is called with its valid arguments
    Then each structured result equals the direct service envelope
    And the served corpus is byte-for-byte unchanged

  @feature4 @FR-4 @AC-4.1 @id:SCEN-mri-public-eligibility-separation @release-evidence
  Scenario: Meta-only producer output cannot become trusted evidence
    Given a v0.3.2 candidate and complete evidence record
    When the candidate message artifact contains only meta
    Then the candidate is refused for nonsemantic Cucumber evidence

  @feature5 @FR-5 @AC-5.1 @id:SCEN-mri-executable-launcher-archive
  Scenario: Candidate archive preserves the executable launcher
    Given a v0.3.2 candidate and complete evidence record
    When the candidate archive is extracted into a clean project
    Then the extracted launcher is executable and serves the active project

  @feature5 @FR-5 @AC-5.1 @id:SCEN-mri-symlinked-evidence-refusal
  Scenario Outline: Linked evidence parents cannot escape containment
    Given a v0.3.2 candidate and complete evidence record
    When the evidence "<directory>" directory has a symlinked parent
    Then the release evaluator reports "EVIDENCE_SYMLINK_COMPONENT" before reading evidence bytes

    Examples:
      | directory |
      | receipts  |
      | messages  |

  @feature5 @FR-5 @AC-5.1 @id:SCEN-mri-artifact-mismatch-refusal @release-evidence
  Scenario: Publication refuses different archive bytes
    Given the bounded current v0.3.2 public release status record
    When the recorded publication identities are reconciled
    Then the bounded record contains one exact published archive identity without a rebuild claim
    Given a candidate artifact without live distribution provenance
    When the publish verification sees a different archive or existing release asset
    Then publication is refused before release mutation

  @feature6 @FR-6 @AC-6.1 @id:SCEN-mri-public-communication-proof @release-evidence
  Scenario: Public communication reflects immutable v0.3.2 evidence
    Given the bounded current v0.3.2 public release status record
    When the recorded publication identities are reconciled
    Then the bounded record proves a trusted public release for the exact candidate
    And current public guidance and captured release notes match v0.3.2 and retain the v0.3.0 advisory

  @feature7 @FR-7 @AC-7.1 @id:SCEN-mri-response-provenance
  Scenario: Every installed MCP result identifies its server and root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the installed package launcher probes every MCP tool for project-a without an override
    Then every installed result identifies the active project root and server
    When the installed package launcher probes every MCP tool with project-b as an explicit override
    Then every installed result identifies project-b as an explicit root and marks the active-project mismatch

  @feature7 @FR-7 @AC-7.1 @id:SCEN-mri-extension-root-consistency
  Scenario: OMP extension inventory and query tools share one root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the OMP extension runs with project-a as cwd and project-b as an explicit root override
    Then its inventory and query results identify the same project-b root and server
