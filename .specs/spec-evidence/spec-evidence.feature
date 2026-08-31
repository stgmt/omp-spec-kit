@spec-evidence @next
Feature: Trusted execution evidence
  A trusted capture adapter records one actual run and a pure evaluator decides
  whether current scenarios and tasks have usable evidence. These scenarios are
  specification text, not execution evidence.

  @feature1 @AC-1.1 @id:SCEN-spec-evidence-pure-evaluation-boundary
  Scenario: Pure evaluator has no side effects
    Given identical current bindings trusted run envelopes and limits
    When evaluation is repeated
    Then the output is identical without filesystem clock environment network process OMP or MCP access

  @feature2 @AC-2.1 @id:SCEN-spec-evidence-supported-artifact-kinds
  Scenario: Only supported real producer artifacts are captured
    Given supported unsupported malformed absent and over-limit producer artifacts
    When trusted capture admits them
    Then only Cucumber Messages NDJSON 33.0.4 and pytest-bdd cucumber-json 1 are admitted
    And actual admitted bytes are retained and re-hashed while every refusal has a closed reason

  @feature3 @AC-3.1 @id:SCEN-spec-evidence-trusted-capture-envelope
  Scenario: One actual run produces one trusted envelope
    Given the trusted adapter observes an actual runner invocation and tested implementation
    When it captures the run
    Then one envelope owns run identity scope artifact bytes and hash implementation identity and scenario bindings
    And a caller-supplied metadata and hash pair cannot authenticate evidence

  @feature4 @AC-4.1 @id:SCEN-spec-evidence-stable-scenario-join
  Scenario: Stable identity is required for a join
    Given producer rows match current scenarios by qualified ID verified tag ambiguous tag name only or nothing
    When join runs
    Then only exact ID and uniquely verified tag rows are JOINED
    And every other row is AMBIGUOUS or UNMATCHED with name candidates diagnostic only

  @feature5 @AC-5.1 @id:SCEN-spec-evidence-full-run-scope-authority
  Scenario: Partial runs never replace full-run authority
    Given the trusted adapter captured one unfiltered full run and one narrowed partial run
    When readiness is evaluated
    Then only the full run may satisfy readiness
    And the partial run remains queryable without replacing full evidence

  @feature6 @AC-6.1 @id:SCEN-spec-evidence-freshness-staleness
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

  @feature7 @AC-7.1 @id:SCEN-spec-evidence-fail-closed-status-truth
  Scenario: Every required scenario needs fresh passed full evidence
    Given a task requires three current scenarios
    And only two have fresh passed full-scope evidence
    When task evidence is derived
    Then the task is BLOCKED with the missing scenario named
    And it becomes VERIFIED only after all three satisfy the rule

  @feature8 @AC-8.1 @id:SCEN-spec-evidence-waiver-honesty
  Scenario: Waived tasks remain open
    Given a waived task has fresh passed full-scope evidence
    When task evidence is derived
    Then its state is WAIVED_OPEN and it is not verified

  @feature9 @AC-9.1 @id:SCEN-spec-evidence-internal-row-accounting
  Scenario: Every row and required scenario is accounted for
    Given joined unmatched ambiguous and malformed producer rows and current required scenarios
    When evaluation completes
    Then every parsed row has one outcome
    And every required scenario has one elected evidence reference or one blocker
    And display counts are derived from those records

  @feature10 @AC-10.1 @id:SCEN-spec-evidence-anti-false-green-invariants
  Scenario: No green claim exists without trusted captured bytes
    Given a result claim has only a sidecar label self-declared hash name match or partial run
    When anti-false-green rules run
    Then readiness is refused with the exact reason
    And no result or trace is fabricated

  @feature11 @AC-11.1 @id:SCEN-spec-evidence-real-fixture-provenance
  Scenario: Executable fixtures preserve real producer provenance
    Given captured fixtures from at least two identified real producers
    When fixture admission runs
    Then each fixture records capture method producer version source date hash bytes license trimming and reviewed outcomes
    And synthetic data is labeled and limited to scale or one-fault derivatives

  @feature12 @AC-12.1 @id:SCEN-spec-evidence-budget-enforcement
  Scenario: Hard limits fail closed
    Given capture evaluation or trace output exceeds a configured hard limit
    When the operation runs
    Then it returns a closed limit error without partial failure text
    And latency measurement remains outside the evaluator

  @feature13 @AC-13.1 @id:SCEN-spec-evidence-release-contribution
  Scenario: Product release consumes ordinary task evidence
    Given one required task is BLOCKED and the others are VERIFIED for the tested candidate
    When the product gate consumes ordinary task and scenario evidence
    Then the evidence contribution fails with the blocked task named
    And no evidence-specific manifest or second fingerprint is created

  @feature14 @AC-14.1 @id:SCEN-spec-evidence-mcp-projection-of-run-results
  Scenario: Result and trace share one evidence reference
    Given one elected ScenarioEvidence has a trace
    When get_test_result resolves the scenario and get_scenario_trace receives its evidence reference
    Then the result returns that ScenarioEvidence
    And the trace returns only bounded steps and failure for the same evidence reference
    And neither tool changes the historical eight-tool v0.3.2 first slice
