@spec-mcp-operations @read-write @next
Feature: MCP read and write operations
  One MCP operations contract exposes the shipped read baseline and the future proposal-first write path.

# One deterministic specification graph core
# The core is pure and occurrence-first. Historical MCP names are thin compatibility adapters.

  @feature1 @AC-1.1 @id:SCEN-mcp-read-core-pure-occurrence-first-core
  Scenario: Pure occurrence-first core
    Given caller-supplied canonical source documents and limits
    When the core builds a graph
    Then it performs no ambient I/O and preserves source occurrences

  @feature2 @AC-2.1 @id:SCEN-mcp-read-core-canonical-documents-and-qualified-ids
  Scenario: Canonical documents and qualified IDs
    Given the fifteen canonical document names and two specs with the same local ID
    When role-aware parsing runs
    Then owning-document definitions and spec-qualified identities are distinct
    And duplicate candidates are retained

  @feature3 @AC-3.1 @id:SCEN-mcp-read-core-typed-graph-conservation
  Scenario: Typed graph conservation
    Given valid, missing, ambiguous, malformed, and forbidden references
    When the graph resolves occurrences
    Then each reference has one typed edge outcome
    And all conservation equations reconcile

  @feature4 @AC-4.1 @id:SCEN-mcp-read-core-four-bounded-core-primitives
  Scenario: Four bounded core primitives
    Given an immutable graph and a bounded cursor
    When inventory findNodes traverse and diagnostics are called
    Then one deterministic envelope returns stable pages or typed errors

  @feature5 @AC-5.1 @id:SCEN-mcp-read-core-contained-inputs-and-budgets
  Scenario: Contained inputs and budgets
    Given contained canonical files and unsafe or oversized variants
    When the host adapter prepares sources
    Then unsafe bytes are refused before admission and no writes occur

  @feature6 @AC-6.1 @id:SCEN-mcp-read-core-historical-eight-name-compatibility
  Scenario: Historical eight-name compatibility
    Given the released v0.3.2 compatibility adapters
    When each preserved MCP name projects a common request
    Then each result matches the shared core after transport metadata is removed

  @feature7 @AC-7.1 @id:SCEN-mcp-read-core-deterministic-diagnostics-and-fingerprint
  Scenario: Deterministic diagnostics and fingerprint
    Given equivalent normalized source bytes in different orders and line endings
    When the graph is built
    Then canonical bytes diagnostics and fingerprint are identical
    And query availability does not affect the fingerprint

  @feature8 @AC-8.1 @id:SCEN-mcp-read-core-real-fixtures-and-measurable-budgets
  Scenario: Real fixtures and measurable budgets
    Given the target-owned real-corpus manifest and retained receipt references
    When hashes oracles and package measurements are reviewed
    Then provenance and budgets are visible without a kernel release claim

# Trusted execution evidence
# A trusted capture adapter records one actual run and a pure evaluator decides
# whether current scenarios and tasks have usable evidence. These scenarios are
# specification text, not execution evidence.

  @feature9 @AC-9.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-pure-evaluation-boundary
  Scenario: Pure evaluator has no side effects
    Given identical current bindings trusted run envelopes and limits
    When evaluation is repeated
    Then the output is identical without filesystem clock environment network process OMP or MCP access

  @feature10 @AC-10.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-supported-artifact-kinds
  Scenario: Only supported real producer artifacts are captured
    Given supported unsupported malformed absent and over-limit producer artifacts
    When trusted capture admits them
    Then only Cucumber Messages NDJSON 33.0.4 and pytest-bdd cucumber-json 1 are admitted
    And actual admitted bytes are retained and re-hashed while every refusal has a closed reason

  @feature11 @AC-11.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-trusted-capture-envelope
  Scenario: One actual run produces one trusted envelope
    Given the trusted adapter observes an actual runner invocation and tested implementation
    When it captures the run
    Then one envelope owns run identity scope artifact bytes and hash implementation identity and scenario bindings
    And a caller-supplied metadata and hash pair cannot authenticate evidence

  @feature12 @AC-12.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-stable-scenario-join
  Scenario: Stable identity is required for a join
    Given producer rows match current scenarios by qualified ID verified tag ambiguous tag name only or nothing
    When join runs
    Then only exact ID and uniquely verified tag rows are JOINED
    And every other row is AMBIGUOUS or UNMATCHED with name candidates diagnostic only

  @feature13 @AC-13.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-full-run-scope-authority
  Scenario: Partial runs never replace full-run authority
    Given the trusted adapter captured one unfiltered full run and one narrowed partial run
    When readiness is evaluated
    Then only the full run may satisfy readiness
    And the partial run remains queryable without replacing full evidence

  @feature14 @AC-14.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-freshness-staleness
  Scenario Outline: Current content bindings determine freshness
    Given captured and current scenario step and implementation bindings have "<condition>"
    When freshness is evaluated without graph or clock authority
    Then evidence is "<state>"

    Examples:
      | condition                         | state         |
      | all applicable values equal       | FRESH         |
      | one applicable value differs      | STALE         |
      | one required value is missing     | INDETERMINATE |
      | step binding is not applicable in both | FRESH     |

  @feature15 @AC-15.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-fail-closed-status-truth
  Scenario: Every required scenario needs fresh passed full evidence
    Given a task requires three current scenarios
    And only two have fresh passed full-scope evidence
    When task evidence is derived
    Then the task is BLOCKED with the missing scenario named
    And it becomes VERIFIED only after all three satisfy the rule

  @feature16 @AC-16.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-waiver-honesty
  Scenario: Waived tasks remain open
    Given a waived task has fresh passed full-scope evidence
    When task evidence is derived
    Then its state is WAIVED_OPEN and it is not verified

  @feature17 @AC-17.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-internal-row-accounting
  Scenario: Every row and required scenario is accounted for
    Given joined unmatched ambiguous and malformed producer rows and current required scenarios
    When evaluation completes
    Then every parsed row has one outcome
    And every required scenario has one elected evidence reference or one blocker
    And display counts are derived from those records

  @feature18 @AC-18.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-anti-false-green-invariants
  Scenario: No green claim exists without trusted captured bytes
    Given a result claim has only a sidecar label self-declared hash name match or partial run
    When anti-false-green rules run
    Then readiness is refused with the exact reason
    And no result or trace is fabricated

  @feature19 @AC-19.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-real-fixture-provenance
  Scenario: Executable fixtures preserve real producer provenance
    Given captured fixtures from at least two identified real producers
    When fixture admission runs
    Then each fixture records capture method producer version source date hash bytes license trimming and reviewed outcomes
    And synthetic data is labeled and limited to scale or one-fault derivatives

  @feature20 @AC-20.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-budget-enforcement
  Scenario: Hard limits fail closed
    Given capture evaluation or trace output exceeds a configured hard limit
    When the operation runs
    Then it returns a closed limit error without partial failure text
    And latency measurement remains outside the evaluator

  @feature21 @AC-21.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-release-contribution
  Scenario: Product release consumes ordinary task evidence
    Given one required task is BLOCKED and the others are VERIFIED for the tested candidate
    When the product gate consumes ordinary task and scenario evidence
    Then the evidence contribution fails with the blocked task named
    And no evidence-specific manifest or second fingerprint is created

  @feature22 @AC-22.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-mcp-projection-of-run-results
  Scenario: Result and trace share one evidence reference
    Given one elected ScenarioEvidence has a trace
    When get_test_result resolves the scenario and get_scenario_trace receives its evidence reference
    Then the result returns that ScenarioEvidence
    And the trace returns only bounded steps and failure for the same evidence reference
    And neither tool changes the historical eight-tool v0.3.2 first slice

# Proposal-first specification authoring
# The future authoring capability exposes two MCP mutation tools.
# These scenarios are specification text and are not claimed as executed evidence.

  @id:SCEN-mcp-write-authoring-two-tool-inventory @feature23 @AC-23.1
  Scenario: Authoring inventory contains only two public mutation tools
    Given the installed omp-spec-kit MCP server
    When its public mutation inventory is listed
    Then the mutation names are exactly propose_patch and apply_proposed_patch
    And internal helper compilers are not registered

  @id:SCEN-mcp-write-authoring-path-policy-denies-raw-writer @feature23 @AC-23.2
  Scenario: Non-authoring raw writer is denied for canonical spec targets
    Given a mutating tool call that is not in the exact authoring allowlist
    And its resolved target is below canonical .specs
    When the current-host tool_call policy evaluates it
    Then execution is denied before the write

  @id:SCEN-mcp-write-authoring-proposal-deterministic-no-write @feature24 @AC-24.1
  Scenario: Equal proposals are deterministic and read-only
    Given identical canonical spec bytes and one-spec operations
    When propose_patch runs twice
    Then normalized operations findings diffs hashes and proposal identity are equal
    And every repository document hash is unchanged

  @id:SCEN-mcp-write-authoring-invalid-preview-refused @feature24 @AC-24.2
  Scenario: Incomplete or invalid preview cannot be applied
    Given operations that mix specs duplicate a target or exceed a bound
    When propose_patch validates the request
    Then it returns INVALID_REQUEST or VALIDATION_FAILED
    And no repository or durable review state is created

  @id:SCEN-mcp-write-authoring-containment-refuses-escape @feature25 @AC-25.1
  Scenario: Escaping and linked targets are refused before mutation
    Given real traversal device symlink junction reparse and switched-component fixtures
    When either authoring tool resolves containment
    Then PATH_FORBIDDEN is returned with bounded relative diagnostics
    And target bytes are unchanged

  @id:SCEN-mcp-write-authoring-result-validation-refuses-drift @feature25 @AC-25.2
  Scenario: Broken form trace or anchor refuses the result
    Given an in-memory result with one planted form trace anchor or validator failure
    When the complete kernel validator set runs
    Then ordered VALIDATION_FAILED findings identify the defect
    And no repository byte changes

  @id:SCEN-mcp-write-authoring-apply-exact-proposal @feature26 @AC-26.1
  Scenario: Apply commits only the exact current proposal
    Given a complete proposal whose expected hashes and validation still match
    When apply_proposed_patch runs under the spec lock
    Then committed bytes equal every proposal after-hash
    And replay of the same request does not create another commit

  @id:SCEN-mcp-write-authoring-concurrent-apply-conflict @feature26 @AC-26.2 @concurrency
  Scenario: A stale concurrent apply cannot overwrite the winner
    Given two proposals share the same expected hashes
    When their applies race and one commits first
    Then the other returns CONFLICT after its under-lock CAS
    And the winner remains byte-identical

  @id:SCEN-mcp-write-authoring-fault-preserves-generation @feature27 @AC-27.1 @rollback
  Scenario: Writer faults expose only a complete generation
    Given the real generation writer and coordinated reader
    When each staging sync swap and cleanup boundary faults in turn
    Then every observation is the fully hashed old or new generation
    And the final tree reconciles to one complete generation

  @id:SCEN-mcp-write-authoring-unrecoverable-needs-manual-restore @feature27 @AC-27.2 @rollback
  Scenario: Unrecoverable storage fails closed to manual restore
    Given neither retained old nor new generation is complete and hash-valid
    When internal rollback assesses the state
    Then apply returns RECOVERY_REQUIRED and performs no further authoring write
    And the next action names bounded VCS or backup restoration for the spec

  @id:SCEN-mcp-write-authoring-byte-eol-conservation @feature28 @AC-28.1
  Scenario: Anchor edit preserves unrelated bytes and EOLs
    Given a captured mixed-content spec with known byte and EOL hashes
    When an anchor-addressed proposal is applied
    Then untouched spans encoding EOL style and final newline equal the preimage
    And changed documents equal the proposal after-hashes

  @id:SCEN-mcp-write-authoring-receipt-redaction @feature28 @AC-28.2
  Scenario: Outcomes are compact and redacted
    Given fixture content containing planted document text credentials and absolute paths
    When proposal and apply success and refusal outcomes are serialized
    Then only the compact schema fields hashes relative paths and bounded findings remain
    And planted sensitive values stack traces and retained bytes are absent

  @id:SCEN-mcp-write-authoring-real-fixture-provenance @feature29 @AC-29.1
  Scenario: Real fixture evidence reconciles with producers
    Given captured kernel platform race and fault producer outputs
    When fixture provenance and ground truth are verified
    Then producer version invocation platform source hash and trimming are present
    And producer summaries reconcile with independent hashes

  @id:SCEN-mcp-write-authoring-protected-check-omissions-fail @feature29 @AC-29.2
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