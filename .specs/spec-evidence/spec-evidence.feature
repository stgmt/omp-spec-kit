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
    Given artifacts of kind Cucumber Messages NDJSON pytest-bdd cucumber-json scenario-result overlay and an unrecognized kind are supplied
    When the evaluator ingests each artifact
    Then the three recognized kinds are accepted with their declared schema versions
    And the unrecognized kind produces NOT_INGESTED with reason MALFORMED_ARTIFACT

  @feature3 @AC-3.1 @id:SCEN-spec-evidence-artifact-ingestion-state
  Scenario: Artifact ingestion state is closed and conserved
    Given artifacts that are present-and-parseable present-but-malformed absent parseable-with-no-scenario-results and caller-skipped
    When the evaluator ingests each artifact
    Then each receives exactly one state from INGESTED NOT_INGESTED with ARTIFACT_ABSENT or MALFORMED_ARTIFACT or SKIPPED with MISSING_SCENARIO_RESULTS or INGESTION_SKIPPED
    And an INGESTED artifact reports parsed matched unmatched and malformed counts satisfying parsed equals matched plus unmatched plus malformed

  @feature4 @AC-4.1 @id:SCEN-spec-evidence-scenario-result-join
  Scenario: Every result is joined or counted unmatched
    Given valid producer results and canonical scenarios where some match by qualified ID some by tag some by name fallback some match multiple candidates and some match none
    When the join phase runs
    Then each result is either joined by ID joined by tag joined by name fallback counted as AMBIGUOUS_JOIN or counted as UNMATCHED
    And no valid result is silently dropped

  @feature5 @AC-5.1 @id:SCEN-spec-evidence-canonical-overlay-separation
  Scenario: Canonical and overlay are retained separately
    Given both canonical full-run results and overlay results exist for the same scenario
    When the evaluator processes both
    Then the evaluation output exposes both with explicit labeling
    And overlay results do not replace canonical results
    And freshness verdicts apply independently to each

  @feature6 @AC-6.1 @id:SCEN-spec-evidence-freshness-staleness
  Scenario: Stale results never satisfy readiness
    Given a once-passing result older than the scenario sources it claims and a result with absent timestamps
    When freshness comparison runs
    Then the stale result is marked STALE with pass-through metadata retained and does not satisfy DONE verified status
    And the absent-timestamp result is marked INDETERMINATE and also fails to satisfy readiness

  @feature7 @AC-7.1 @id:SCEN-spec-evidence-fail-closed-status-truth
  Scenario: DONE verified requires fresh green evidence for all required scenarios
    Given tasks where one has fresh green evidence for every required scenario one has one green among open siblings and one has stale green evidence
    When status derivation runs
    Then only the first task is DONE verified
    And the second task is not DONE verified because rollups are all-not-any
    And the third task is DONE-but-unverified as a named state distinct from DONE verified and not-DONE

  @feature8 @AC-8.1 @id:SCEN-spec-evidence-waiver-honesty
  Scenario: Waived tasks remain open and unsatisfied
    Given a task marked as waived in the kernel graph and matching fresh green evidence exists for its scenarios
    When the evaluator derives status
    Then the task status remains open-waived regardless of the green evidence
    And coverage census retains the waived task in authored totals but excludes it from satisfied counts
    And the waiver state is explicitly named and distinguishable from all other states

  @feature9 @AC-9.1 @id:SCEN-spec-evidence-coverage-census-conservation
  Scenario: Census conservation equations hold
    Given a kernel graph with authored scenarios and artifacts with joined unmatched and malformed results
    When the coverage census is computed
    Then authored scenarios equals joined plus unmatched-author-side plus waived-excluded
    And ingested valid results equals joined plus unmatched-producer-side
    And parsed records equals matched plus unmatched plus malformed
    And planting an equation violation produces a diagnostic and sets census validity to false

  @feature10 @AC-10.1 @id:SCEN-spec-evidence-anti-false-green-invariants
  Scenario: No verdict without evidence bytes
    Given evaluation outputs where a DONE verified claim lacks an evidence hash reference a result is marked green without a parsed record and overlay-only evidence claims canonical readiness
    When invariant checks run
    Then each breach produces a diagnostic naming the specific invariant violated
    And no false-green verdict survives the invariant checks

  @feature11 @AC-11.1 @id:SCEN-spec-evidence-real-fixture-provenance
  Scenario: Fixtures are real hashed and reconciled
    Given executable evaluation fixtures from at least two distinct NDJSON producers
    When fixture admission runs
    Then each fixture has recorded fixture ID capture method producer version source path capture date SHA-256 byte count license disposition permitted trimming and reviewed ground truth
    And synthetic fixtures are labeled synthetic
    And ground truth includes expected ingestion join freshness and census outcomes

  @feature12 @AC-12.1 @id:SCEN-spec-evidence-budget-enforcement
  Scenario: Budgets are measured and enforced
    Given evaluation runs against the reference corpus with latency size count and cap measurements
    When budget enforcement runs
    Then all budgets conform to NFR specifications
    And exceeded hard limits return LIMIT_EXCEEDED or refuse evaluation
    And measurements report runtime OS CPU corpus fingerprint warm-up sample count percentiles artifact hash and raw observations

  @feature13 @AC-13.1 @id:SCEN-spec-evidence-release-contribution
  Scenario: Release contribution fails closed
    Given release eligibility evaluation for this spec contribution with mandatory checks mapped to FR-1 through FR-12
    When one check record is missing failed stale or mismatched
    Then the conjunction fails closed with deterministic blockers naming the deficient check
    And structural specification text and unexecuted Gherkin do not satisfy evidence
    And eligibility does not loosen the product FR-6 cumulative gate
