@spec-evidence @evidence-gated
Feature: Evidence and honesty evaluation layer
  The evaluator consumes an immutable spec-kernel graph and immutable
  execution-artifact bytes, then produces ingestion state, scenario-result
  joins, freshness verdicts, fail-closed task status truth, waiver honesty,
  coverage census with conservation equations, and release-eligibility
  contributions. Every scenario specifies required behavior and has no
  executed status here.

  @feature1 @AC-1.1 @id:SCEN-spec-evidence-pure-evaluation-boundary
  Scenario: Pure evaluator has no side effects
    Given a kernel graph and immutable artifact bytes are supplied as inputs
    And limits are supplied
    When the evaluator runs
    Then it produces evaluation output without filesystem clock environment network process OMP or MCP access
    And all I/O exists only in adapters external to the evaluator

  @feature2 @AC-2.1 @id:SCEN-spec-evidence-supported-artifact-kinds
  Scenario: Closed versioned artifact kind set
    Given exact supported pairs cucumber-messages-ndjson at 33.0.4 pytest-bdd-cucumber-json at 1 scenario-result-overlay at 1 and unknown identities
    When admission and ingestion run
    Then only the three exact pairs are accepted
    And unsupported identity yields UNSUPPORTED_ARTIFACT_IDENTITY while malformed admitted bytes yield MALFORMED_ARTIFACT

  @feature3 @AC-3.1 @id:SCEN-spec-evidence-artifact-ingestion-state
  Scenario: Artifact ingestion state is closed and conserved
    Given PRESENT valid malformed unsupported and missing-results artifacts plus ABSENT and caller-SKIPPED inputs
    When the evaluator ingests each artifact
    Then each receives the exact discriminated state and reason from spec-evidence at 2
    And INGESTED parsed count equals matched plus unmatched plus ambiguous plus malformed counts

  @feature4 @AC-4.1 @id:SCEN-spec-evidence-scenario-result-join
  Scenario: Every result is joined or counted unmatched
    Given valid producer results and canonical scenarios where some match by qualified ID some by tag some by name fallback some match multiple candidates and some match none
    When the join phase runs
    Then each result has exactly one JOINED UNMATCHED or AMBIGUOUS_JOIN record with full bounded candidates
    And producer result join collection and census memberships conserve without silent drops

  @feature5 @AC-5.1 @id:SCEN-spec-evidence-canonical-overlay-separation
  Scenario: Canonical and overlay are retained separately
    Given both canonical full-run results and overlay results exist for the same scenario
    When the evaluator processes both
    Then the evaluation output exposes both with explicit labeling
    And overlay results do not replace canonical results
    And freshness verdicts apply independently to each

  @feature6 @AC-6.1 @id:SCEN-spec-evidence-freshness-staleness
  Scenario Outline: Hash bindings determine freshness without clock authority
    Given evidence and current inputs bind graph scenario step-binding and implementation dimensions with "<condition>"
    When freshness comparison runs without clock authority
    Then the result is "<verdict>" and readiness is "<readiness>"

    Examples:
      | condition                        | verdict       | readiness |
      | all applicable hashes equal      | FRESH         | eligible  |
      | one applicable hash differs      | STALE         | refused   |
      | applicable hash is missing       | INDETERMINATE | refused   |
      | both sides mark dimension not applicable | FRESH      | eligible  |

  @feature7 @AC-7.1 @id:SCEN-spec-evidence-fail-closed-status-truth
  Scenario: Done verified requires fresh passed canonical evidence for every scenario
    Given one task has fresh PASSED canonical rows for every required scenario and evidence hashes
    And other tasks have overlay-only stale skipped failed ambiguous or missing rows
    When status derivation runs
    Then only the first task is done-verified
    And every other task has an explicit evidence blocker

  @feature8 @AC-8.1 @id:SCEN-spec-evidence-waiver-honesty
  Scenario: Waived tasks remain open and unsatisfied
    Given a task marked as waived in the kernel graph and matching fresh green evidence exists for its scenarios
    When the evaluator derives status
    Then the task status remains open-waived regardless of the green evidence
    And coverage census retains the waived task in authored totals but excludes it from satisfied counts
    And the waiver state is explicitly named and distinguishable from all other states

  @feature9 @AC-9.1 @id:SCEN-spec-evidence-coverage-census-conservation
  Scenario: Authored and producer conservation equations hold independently
    Given authored scenarios and canonical overlay unmatched ambiguous and malformed producer rows
    When the coverage census is computed
    Then authored scenario conservation holds independently
    And producer joined unmatched and ambiguous counts equal producerResults and joinRecords membership
    And per-artifact and global parsed equations include malformed rows exactly
    And waivedTaskCount does not alter scenario cardinality
    And an equation violation invalidates the census with an exact diagnostic

  @feature10 @AC-10.1 @id:SCEN-spec-evidence-anti-false-green-invariants
  Scenario: No result status or trace exists without evidence bytes and bindings
    Given task result and trace outputs with missing producer bytes hash bindings or parsed rows
    When anti-false-green invariants run
    Then every unsupported status freshness and trace claim is refused with its exact diagnostic
    And overlay-only evidence never satisfies canonical readiness

  @feature11 @AC-11.1 @id:SCEN-spec-evidence-real-fixture-provenance
  Scenario: Fixtures are real hashed and reconciled
    Given executable evaluation fixtures from at least two distinct NDJSON producers
    When fixture admission runs
    Then each fixture has recorded fixture ID capture method producer version source path capture date SHA-256 byte count license disposition permitted trimming and reviewed ground truth
    And synthetic fixtures are labeled synthetic
    And ground truth includes expected ingestion join freshness and census outcomes

  @feature12 @AC-12.1 @id:SCEN-spec-evidence-budget-enforcement
  Scenario: Pure evaluator budgets are enforced and latency is measured externally
    Given artifact count bytes parsed-record diagnostic census and response limits
    When the pure evaluator processes an over-limit input
    Then it returns LIMIT_EXCEEDED or an explicitly paged bounded result
    And it never reads a clock
    And the caller records latency observations separately

  @feature13 @AC-13.1 @id:SCEN-spec-evidence-release-contribution
  Scenario: Evidence MCP release contribution requires all fourteen checks
    Given a spec-evidence-mcp@1 manifest with one candidate graph fingerprint and caller-supplied evidence-document bytes
    When one CHK-FR1-01 through CHK-FR14-01 record or evidence document is missing extra duplicate failed stale mismatched unverifiable or unbound
    Then eligibility is false with a closed deterministic blocker
    And every evidence document is re-hashed while prose and unexecuted Gherkin satisfy nothing
    And the result contributes to but never replaces product FR-6

  @feature14 @AC-14.1 @id:SCEN-spec-evidence-mcp-projection-of-run-results
  Scenario: MCP projects complete result and trace contracts from evaluator output
    Given evaluator output contains canonical and overlay rows run ordinals trace pages freshness bindings and evidence hashes
    And the evaluator itself makes no MCP calls
    When get_test_result and get_scenario_trace are invoked with qualified IDs layers and cursors
    Then deterministic LATEST selection status run source trace failed step error freshness evidence and paging follow the exact schema
    And missing evidence returns success with null while missing/ambiguous IDs and overflow return closed errors
    And neither tool belongs to historical kernel-v0.3 or its eight-tool first slice
