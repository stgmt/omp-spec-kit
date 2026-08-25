@mcp-release-integrity
Feature: MRI001_Correct_MCP_root_and_release_identity
  The v0.3.1 corrective patch preserves the read-only MCP surface while
  ensuring installed users receive their active project data and releases
  ship only evidence-bound candidate bytes.

  Background:
    Given an isolated v0.3.1 package and manifest-verified corpus exist

  @FR-1 @AC-1 @release-evidence @id:SCEN-MRI-001
  Scenario: Installed launcher uses the active project root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the installed package launcher serves project-a without an override
    Then the MCP overview contains only project-a specifications
    And a relative or unresolved root override cannot select package-decoy

  @FR-2 @AC-2 @release-evidence @id:SCEN-MRI-002
  Scenario: Invalid JSON-RPC requests have one terminal response
    Given an installed MCP server is running
    When the client sends JSON-RPC 1.0 with id 7 and then a valid request
    Then the first response is -32600 for id 7
    And the valid request returns one canonical envelope with no extra stdout frames

  @FR-2 @AC-2 @id:SCEN-MRI-009
  Scenario: Malformed JSON has one parse error and recovery
    Given an installed MCP server is running
    When the client sends malformed JSON and then a valid request
    Then the first response is -32700 with null id
    And the valid request returns one canonical envelope with no extra stdout frames

  @FR-3 @AC-3 @release-evidence @id:SCEN-MRI-003
  Scenario: Every packaged MCP tool equals its direct service result
    Given a copied package has no source checkout or ambient dependencies
    When every SCHEMA-11 tool is called with its valid arguments
    Then each structured result equals the direct service envelope
    And the served corpus is byte-for-byte unchanged

  @FR-4 @AC-4 @release-evidence @id:SCEN-MRI-004
  Scenario: MRI eligibility is distinct from public distribution eligibility
    Given a v0.3.1 candidate and complete evidence record
    When the release evaluator checks the candidate
    Then the MRI gate is independently eligible while public release remains blocked without distribution evidence

  @FR-4 @AC-4 @id:SCEN-MRI-010
  Scenario: Meta-only Cucumber evidence cannot release a candidate
    Given a v0.3.1 candidate and complete evidence record
    When the candidate message artifact contains only meta
    Then the candidate is refused for nonsemantic Cucumber evidence

  @FR-4 @AC-4 @id:SCEN-MRI-011
  Scenario Outline: Semantic Cucumber evidence mutations fail closed
    Given the captured real Cucumber message fixture
    When the Cucumber evidence stream is "<fault>"
    Then the semantic Cucumber evidence parser rejects it as "<code>" with "<message>"

    Examples:
      | fault                       | code                         | message                                             |
      | missing-pickle               | MISSING_PICKLE               | has no pickle for SCEN-MRI-001                      |
      | missing-test-case            | MISSING_TEST_CASE            | has no testCase for SCEN-MRI-001                    |
      | missing-test-case-started    | MISSING_TEST_CASE_STARTED    | has no testCaseStarted for SCEN-MRI-001             |
      | missing-test-step-finished   | MISSING_TEST_STEP_FINISHED   | has no testStepFinished for SCEN-MRI-001            |
      | missing-test-case-finished   | MISSING_TEST_CASE_FINISHED   | has no testCaseFinished for SCEN-MRI-001            |
      | failed-final-step            | NON_PASSING_TERMINAL_STEP    | records a non-passing terminal step for SCEN-MRI-001 |
      | retry-only                   | RETRY_ONLY_TERMINAL_PATH     | has no non-retried terminal attempt for SCEN-MRI-001 |
      | duplicate-terminal-frame     | DUPLICATE_TEST_CASE_FINISHED | has duplicate testCaseFinished for {startId}         |
      | duplicate-test-run-finished  | DUPLICATE_TEST_RUN_FINISHED  | has more than one testRunFinished                    |
      | corrupt-line                 | MALFORMED_NDJSON_FRAME       | is not strict NDJSON at line 868                     |
      | meta-only                    | META_ONLY_STREAM             | contains only meta frames                            |

  @FR-5 @AC-5 @release-evidence @id:SCEN-MRI-005
  Scenario: Publication rejects a different artifact
    Given a candidate artifact without live distribution provenance
    When the publish verification sees a different archive or existing release asset
    Then publication is refused before release mutation

  @FR-6 @AC-6 @release-evidence @id:SCEN-MRI-006
  Scenario: Public communication requires candidate proof
    Given a candidate artifact and a v0.3.0 advisory without live distribution provenance
    When release notes are rendered
    Then release notes remain withheld pending live distribution provenance

  @FR-4 @AC-4 @id:SCEN-MRI-015
  Scenario Outline: Public package credential mutations block candidate evidence
    Given the packaged README contains synthetic "<sentinel>"
    When a candidate is assembled and public safety is evaluated
    Then public safety reports "<category>" and public release remains blocked

    Examples:
      | sentinel                                               | category        |
      | Authorization: Bearer synthetic-release-token-0001     | authorization   |
      | credential=synthetic-credential-value-0001             | generic-secret  |
      | MY_API_KEY=synthetic-prefixed-key-0001                 | generic-secret  |
      | SERVICE_SECRET=synthetic-prefixed-secret-0001          | generic-secret  |
      | DEPLOY_ACCESS_TOKEN=synthetic-prefixed-token-0001      | generic-secret  |
      | NEXT_PUBLIC_API_KEY=synthetic-prefixed-public-key-0001 | generic-secret  |
      | Cookie: session=synthetic-cookie-value-0001            | cookie          |
      | -----BEGIN PRIVATE KEY-----                             | pem-private-key |
      | github_pat_synthetic_token_1234567890                   | known-secret    |

  @FR-1 @AC-1 @release-evidence @id:SCEN-MRI-007
  Scenario: Candidate archive preserves the executable launcher
    Given a v0.3.1 candidate and complete evidence record
    When the candidate archive is extracted into a clean project
    Then the extracted launcher is executable and serves the active project

  @FR-4 @AC-4 @id:SCEN-MRI-014
  Scenario: Synthetic distribution claims cannot create public eligibility
    Given a v0.3.1 candidate with complete MRI evidence but no distribution evidence
    When the distribution evidence is "placeholder-claims"
    Then the public release is blocked by "distribution-producer-provenance-untrusted:no-independent-trust-root" while MRI remains independently named

  @FR-4 @AC-4 @id:SCEN-MRI-017
  Scenario: Structurally complete self-attested distribution evidence cannot release a candidate
    Given a v0.3.1 candidate with complete MRI evidence but no distribution evidence
    When the distribution evidence is "structurally-complete-self-attested"
    Then the public release is blocked by "distribution-producer-provenance-untrusted:no-independent-trust-root" while MRI remains independently named

  @FR-4 @AC-4 @id:SCEN-MRI-018
  Scenario: Structurally complete attestation-trusted distribution evidence still fails closed without a verifying signer
    Given a v0.3.1 candidate with complete MRI evidence but no distribution evidence
    When the distribution evidence is "structurally-complete-attestation-trusted"
    Then the public release is blocked by an attestation-unverified reason while MRI remains independently named

  @FR-4 @AC-4 @id:SCEN-MRI-016
  Scenario Outline: Symlinked evidence parents cannot redirect receipt reads
    Given a v0.3.1 candidate and complete evidence record
    When the evidence "<directory>" directory has a symlinked parent
    Then the release evaluator reports "EVIDENCE_SYMLINK_COMPONENT" before reading evidence bytes

    Examples:
      | directory |
      | receipts  |
      | messages  |

  @FR-1 @FR-3 @AC-1 @AC-3 @id:SCEN-MRI-012
  Scenario: Pinned OMP manager text receipt identifies only the active project root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the bounded pinned OMP manager handoff runs from project-a
    Then the bounded receipt proves the isolated target-only manager query and copied build payload

  @FR-1 @FR-3 @AC-1 @AC-3 @id:SCEN-MRI-013
  Scenario: Missing package payload is refused before pinned OMP enrollment
    Given the copied package payload is missing its OMP MCP declaration
    When the bounded pinned OMP manager handoff runs from project-a
    Then the invalid payload receipt fails before OMP enrollment
