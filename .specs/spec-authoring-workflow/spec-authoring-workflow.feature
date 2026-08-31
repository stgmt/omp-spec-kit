@spec-authoring-workflow @next @specification-only
Feature: Proposal-first specification authoring
  The future authoring capability exposes two MCP mutation tools.
  These scenarios are specification text and are not claimed as executed evidence.

  @id:SCEN-authoring-two-tool-inventory @feature1 @AC-1.1
  Scenario: Authoring inventory contains only two public mutation tools
    Given the installed omp-spec-kit MCP server
    When its public mutation inventory is listed
    Then the mutation names are exactly propose_patch and apply_proposed_patch
    And internal helper compilers are not registered

  @id:SCEN-authoring-path-policy-denies-raw-writer @feature1 @AC-1.2
  Scenario: Non-authoring raw writer is denied for canonical spec targets
    Given a mutating tool call that is not in the exact authoring allowlist
    And its resolved target is below canonical .specs
    When the current-host tool_call policy evaluates it
    Then execution is denied before the write

  @id:SCEN-authoring-proposal-deterministic-no-write @feature2 @AC-2.1
  Scenario: Equal proposals are deterministic and read-only
    Given identical canonical spec bytes and one-spec operations
    When propose_patch runs twice
    Then normalized operations findings diffs hashes and proposal identity are equal
    And every repository document hash is unchanged

  @id:SCEN-authoring-invalid-preview-refused @feature2 @AC-2.2
  Scenario: Incomplete or invalid preview cannot be applied
    Given operations that mix specs duplicate a target or exceed a bound
    When propose_patch validates the request
    Then it returns INVALID_REQUEST or VALIDATION_FAILED
    And no repository or durable review state is created

  @id:SCEN-authoring-containment-refuses-escape @feature3 @AC-3.1
  Scenario: Escaping and linked targets are refused before mutation
    Given real traversal device symlink junction reparse and switched-component fixtures
    When either authoring tool resolves containment
    Then PATH_FORBIDDEN is returned with bounded relative diagnostics
    And target bytes are unchanged

  @id:SCEN-authoring-result-validation-refuses-drift @feature3 @AC-3.2
  Scenario: Broken form trace or anchor refuses the result
    Given an in-memory result with one planted form trace anchor or validator failure
    When the complete kernel validator set runs
    Then ordered VALIDATION_FAILED findings identify the defect
    And no repository byte changes

  @id:SCEN-authoring-apply-exact-proposal @feature4 @AC-4.1
  Scenario: Apply commits only the exact current proposal
    Given a complete proposal whose expected hashes and validation still match
    When apply_proposed_patch runs under the spec lock
    Then committed bytes equal every proposal after-hash
    And replay of the same request does not create another commit

  @id:SCEN-authoring-concurrent-apply-conflict @feature4 @AC-4.2 @concurrency
  Scenario: A stale concurrent apply cannot overwrite the winner
    Given two proposals share the same expected hashes
    When their applies race and one commits first
    Then the other returns CONFLICT after its under-lock CAS
    And the winner remains byte-identical

  @id:SCEN-authoring-fault-preserves-generation @feature5 @AC-5.1 @rollback
  Scenario: Writer faults expose only a complete generation
    Given the real generation writer and coordinated reader
    When each staging sync swap and cleanup boundary faults in turn
    Then every observation is the fully hashed old or new generation
    And the final tree reconciles to one complete generation

  @id:SCEN-authoring-unrecoverable-needs-manual-restore @feature5 @AC-5.2 @rollback
  Scenario: Unrecoverable storage fails closed to manual restore
    Given neither retained old nor new generation is complete and hash-valid
    When internal rollback assesses the state
    Then apply returns RECOVERY_REQUIRED and performs no further authoring write
    And the next action names bounded VCS or backup restoration for the spec

  @id:SCEN-authoring-byte-eol-conservation @feature6 @AC-6.1
  Scenario: Anchor edit preserves unrelated bytes and EOLs
    Given a captured mixed-content spec with known byte and EOL hashes
    When an anchor-addressed proposal is applied
    Then untouched spans encoding EOL style and final newline equal the preimage
    And changed documents equal the proposal after-hashes

  @id:SCEN-authoring-receipt-redaction @feature6 @AC-6.2
  Scenario: Outcomes are compact and redacted
    Given fixture content containing planted document text credentials and absolute paths
    When proposal and apply success and refusal outcomes are serialized
    Then only the compact schema fields hashes relative paths and bounded findings remain
    And planted sensitive values stack traces and retained bytes are absent

  @id:SCEN-authoring-real-fixture-provenance @feature7 @AC-7.1
  Scenario: Real fixture evidence reconciles with producers
    Given captured kernel platform race and fault producer outputs
    When fixture provenance and ground truth are verified
    Then producer version invocation platform source hash and trimming are present
    And producer summaries reconcile with independent hashes

  @id:SCEN-authoring-protected-check-omissions-fail @feature7 @AC-7.2
  Scenario Outline: Each critical omission is caught behaviorally
    Given the <guard> is disabled in an isolated implementation
    When the concrete authoring scenario for that guard runs
    Then the scenario fails before release evidence is accepted
    And runtime API availability and response schema remain unchanged

    Examples:
      | guard |
      | containment |
      | CAS |
      | resulting-spec validation |
      | anchor rewrite closure |
      | atomic rollback |
      | receipt redaction |
