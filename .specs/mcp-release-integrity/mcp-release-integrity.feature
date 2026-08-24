@mcp-release-integrity
Feature: MRI001_Correct_MCP_root_and_release_identity
  The v0.3.1 corrective patch preserves the read-only MCP surface while
  ensuring installed users receive their active project data and releases
  ship only evidence-bound candidate bytes.

  Background:
    Given an isolated v0.3.1 package and manifest-verified corpus exist

  @FR-1 @AC-1 @id:SCEN-MRI-001
  Scenario: Installed launcher uses the active project root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the installed package launcher serves project-a without an override
    Then the MCP overview contains only project-a specifications
    And a relative or unresolved root override cannot select package-decoy

  @FR-2 @AC-2 @id:SCEN-MRI-002
  Scenario: Invalid JSON-RPC requests have one terminal response
    Given an installed MCP server is running
    When the client sends JSON-RPC 1.0 with id 7 and then a valid request
    Then the first response is -32600 for id 7
    And the valid request returns one canonical envelope with no extra stdout frames

  @FR-3 @AC-3 @id:SCEN-MRI-003
  Scenario: Every packaged MCP tool equals its direct service result
    Given a copied package has no source checkout or ambient dependencies
    When every SCHEMA-11 tool is called with its valid arguments
    Then each structured result equals the direct service envelope
    And the served corpus is byte-for-byte unchanged

  @FR-4 @AC-4 @id:SCEN-MRI-004
  Scenario: Candidate eligibility requires all bound lifecycle evidence
    Given a v0.3.1 candidate and complete evidence record
    When the release evaluator checks the candidate
    Then the candidate is eligible only when every identity and lifecycle record agrees

  @FR-5 @AC-5 @id:SCEN-MRI-005
  Scenario: Publication rejects a different artifact
    Given an eligible candidate artifact
    When the publish verification sees a different archive or existing release asset
    Then publication is refused before release mutation

  @FR-6 @AC-6 @id:SCEN-MRI-006
  Scenario: Public communication requires candidate proof
    Given an eligible candidate and a v0.3.0 advisory
    When release notes are rendered
    Then the notes name only the candidate version and verified evidence

  @FR-1 @AC-1 @id:SCEN-MRI-007
  Scenario: Candidate archive preserves the executable launcher
    Given a v0.3.1 candidate and complete evidence record
    When the candidate archive is extracted into a clean project
    Then the extracted launcher is executable and serves the active project
