@mcp-release-integrity
Feature: MRI001_Correct_MCP_root_and_release_identity
  The v0.3.2 corrective patch preserves the read-only MCP surface while
  ensuring installed users receive their active project data and releases
  ship only evidence-bound candidate bytes.

  Background:
    Given an isolated v0.3.2 package and manifest-verified corpus exist

  @feature1 @FR-1 @AC-1.1 @release-evidence @id:SCEN-mri-active-project-root
  Scenario: Installed launcher uses the active project root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the installed package launcher serves project-a without an override
    Then the MCP overview contains only project-a specifications
    And relative unresolved or package-root overrides cannot select package-decoy
    When an explicit validated absolute override selects project-b
    Then the MCP inventory contains only project-b specifications
    And launcher startup from package cwd is refused before serving

  @feature2 @FR-2 @AC-2.1 @release-evidence @id:SCEN-mri-terminal-json-rpc
  Scenario: Invalid JSON-RPC requests have one terminal response
    Given an installed MCP server is running
    When the client sends JSON-RPC 1.0 with id 7 and then a valid request
    Then the first response is -32600 for id 7
    And the valid request returns one canonical envelope with no extra stdout frames
    When the client sends an unknown method with id 8 and an unknown tool with id 9
    Then the responses are -32601 for id 8 and -32602 for id 9

  @feature2 @FR-2 @AC-2.1 @release-evidence @id:SCEN-mri-malformed-json-recovery
  Scenario: Malformed JSON has one parse error and recovery
    Given an installed MCP server is running
    When the client sends malformed JSON and then a valid request
    Then the first response is -32700 with null id
    And the valid request returns one canonical envelope with no extra stdout frames
    When the client sends an unknown method with id 8 and an unknown tool with id 9
    Then the responses are -32601 for id 8 and -32602 for id 9

  @feature3 @FR-3 @AC-3.1 @release-evidence @id:SCEN-mri-all-tool-parity
  Scenario: Every packaged MCP tool equals its direct service result
    Given a copied package has no source checkout or ambient dependencies
    When every SCHEMA-11 tool is called with its valid arguments
    Then each structured result equals the direct service envelope
    And the served corpus is byte-for-byte unchanged

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-public-eligibility-separation
  Scenario: MRI eligibility is distinct from public distribution eligibility
    Given a v0.3.2 candidate and complete evidence record
    When the release evaluator checks the candidate
    Then the MRI gate is independently eligible while public release remains blocked without distribution evidence
    Given the bounded current v0.3.2 public release status record
    When the recorded publication identities are reconciled
    Then the bounded record proves a trusted public release for the exact candidate

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-meta-only-evidence-refusal
  Scenario: Meta-only Cucumber evidence cannot release a candidate
    Given a v0.3.2 candidate and complete evidence record
    When the candidate message artifact contains only meta
    Then the candidate is refused for nonsemantic Cucumber evidence

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-semantic-cucumber-mutations
  Scenario Outline: Semantic Cucumber evidence mutations fail closed
    Given the captured real Cucumber message fixture
    When the Cucumber evidence stream is "<fault>"
    Then the semantic Cucumber evidence parser rejects it as "<code>" with "<message>"

    Examples:
      | fault                       | code                         | message                                             |
      | missing-pickle               | MISSING_PICKLE               | has no pickle for SCEN-mri-active-project-root                      |
      | missing-test-case            | MISSING_TEST_CASE            | has no testCase for SCEN-mri-active-project-root                    |
      | missing-test-case-started    | MISSING_TEST_CASE_STARTED    | has no testCaseStarted for SCEN-mri-active-project-root             |
      | missing-test-step-finished   | MISSING_TEST_STEP_FINISHED   | has no testStepFinished for SCEN-mri-active-project-root            |
      | missing-test-case-finished   | MISSING_TEST_CASE_FINISHED   | has no testCaseFinished for SCEN-mri-active-project-root            |
      | missing-outline-expansion    | SCENARIO_MULTIPLICITY_MISMATCH | expected 12 pickles for SCEN-mri-semantic-cucumber-mutations but found 11 |
      | failed-final-step            | NON_PASSING_TERMINAL_STEP    | records a non-passing terminal step for SCEN-mri-active-project-root |
      | retry-only                   | RETRY_ONLY_TERMINAL_PATH     | has no non-retried terminal attempt for SCEN-mri-active-project-root |
      | duplicate-terminal-frame     | DUPLICATE_TEST_CASE_FINISHED | has duplicate testCaseFinished for {startId}         |
      | duplicate-test-run-finished  | DUPLICATE_TEST_RUN_FINISHED  | has more than one testRunFinished                    |
      | corrupt-line                 | MALFORMED_NDJSON_FRAME       | is not strict NDJSON at line {line}                  |
      | meta-only                    | META_ONLY_STREAM             | contains only meta frames                            |

  @feature5 @FR-5 @AC-5.1 @release-evidence @id:SCEN-mri-artifact-mismatch-refusal
  Scenario: Publication reuses one verified artifact and rejects a different artifact
    Given the bounded current v0.3.2 public release status record
    When the recorded publication identities are reconciled
    Then the bounded record contains one exact published archive identity without a rebuild claim
    Given a candidate artifact without live distribution provenance
    When the publish verification sees a different archive or existing release asset
    Then publication is refused before release mutation

  @feature6 @FR-6 @AC-6.1 @release-evidence @id:SCEN-mri-public-communication-proof
  Scenario: Public communication reflects the verified release and fails closed without proof
    Given the bounded current v0.3.2 public release status record
    When the recorded publication identities are reconciled
    Then current public guidance and captured release notes match v0.3.2 and retain the v0.3.0 advisory
    Given a candidate artifact and a v0.3.0 advisory without live distribution provenance
    When release notes are rendered
    Then release notes remain withheld pending live distribution provenance

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-credential-mutation-refusal
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

  @feature1 @FR-1 @AC-1.1 @release-evidence @id:SCEN-mri-executable-launcher-archive
  Scenario: Candidate archive preserves the executable launcher
    Given a v0.3.2 candidate and complete evidence record
    When the candidate archive is extracted into a clean project
    Then the extracted launcher is executable and serves the active project

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-synthetic-distribution-refusal
  Scenario: Synthetic distribution claims cannot create public eligibility
    Given a v0.3.2 candidate with complete MRI evidence but no distribution evidence
    When the distribution evidence is "placeholder-claims"
    Then the public release is blocked by "distribution-producer-provenance-untrusted:no-independent-trust-root" while MRI remains independently named

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-self-attested-distribution-refusal
  Scenario: Structurally complete self-attested distribution evidence cannot release a candidate
    Given a v0.3.2 candidate with complete MRI evidence but no distribution evidence
    When the distribution evidence is "structurally-complete-self-attested"
    Then the public release is blocked by "distribution-producer-provenance-untrusted:no-independent-trust-root" while MRI remains independently named

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-unverified-attestation-refusal
  Scenario: Structurally complete attestation-trusted distribution evidence still fails closed without a verifying signer
    Given a v0.3.2 candidate with complete MRI evidence but no distribution evidence
    When the distribution evidence is "structurally-complete-attestation-trusted"
    Then the public release is blocked by an attestation-unverified reason while MRI remains independently named

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-symlinked-evidence-refusal
  Scenario Outline: Symlinked evidence parents cannot redirect receipt reads
    Given a v0.3.2 candidate and complete evidence record
    When the evidence "<directory>" directory has a symlinked parent
    Then the release evaluator reports "EVIDENCE_SYMLINK_COMPONENT" before reading evidence bytes

    Examples:
      | directory |
      | receipts  |
      | messages  |

  @feature3 @feature1 @FR-1 @FR-3 @AC-1.1 @AC-3.1 @release-evidence @id:SCEN-mri-active-project-manager-receipt
  Scenario: Pinned OMP manager text receipt identifies only the active project root
    Given project-a, project-b, and package-decoy have distinct specifications
    When the bounded pinned OMP manager handoff runs from project-a
    Then the bounded receipt proves the isolated target-only manager query and copied build payload

  @feature3 @feature1 @FR-1 @FR-3 @AC-1.1 @AC-3.1 @release-evidence @id:SCEN-mri-missing-payload-refusal
  Scenario: Missing package payload is refused before pinned OMP enrollment
    Given the copied package payload is missing its OMP MCP declaration
    When the bounded pinned OMP manager handoff runs from project-a
    Then the invalid payload receipt fails before OMP enrollment

  @feature4 @FR-4 @AC-4.1 @release-evidence @id:SCEN-mri-lifecycle-receipt-refusal
  Scenario Outline: Missing or foreign lifecycle receipts fail eligibility
    Given a v0.3.2 candidate and complete evidence record
    When the lifecycle evidence is "<fault>"
    Then MRI eligibility is false with "<code>"

    Examples:
      | fault            | code                      |
      | missing-upgrade  | LIFECYCLE_RECEIPT_MISSING |
      | missing-rollback | LIFECYCLE_RECEIPT_MISSING |
      | foreign-candidate | CANDIDATE_IDENTITY_MISMATCH |
