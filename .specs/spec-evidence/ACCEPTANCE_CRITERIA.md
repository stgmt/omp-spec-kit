# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1: Pure evaluator has no side effects

**EARS:** WHEN the evaluator consumes a kernel graph and immutable artifact bytes THEN it SHALL produce evaluation output without filesystem, clock, environment, network, process, OMP, or MCP access; AND all I/O SHALL exist only in adapters external to the evaluator.

**Requirement:** [FR-1](FR.md#fr-1-pure-evaluation-boundary)

**Scenario:** `@feature1`, `@id:SCEN-spec-evidence-pure-evaluation-boundary`

## AC-2.1: Closed versioned artifact kind set

**EARS:** WHEN artifacts of kind Cucumber Messages NDJSON, pytest-bdd cucumber-json, scenario-result overlay, and an unrecognized kind are supplied THEN the evaluator SHALL accept exactly the three recognized kinds with their declared schema versions AND produce `NOT_INGESTED` with reason `MALFORMED_ARTIFACT` for the unrecognized kind.

**Requirement:** [FR-2](FR.md#fr-2-supported-execution-artifacts)

**Scenario:** `@feature2`, `@id:SCEN-spec-evidence-supported-artifact-kinds`

## AC-3.1: Ingestion state is closed and conserved

**EARS:** WHEN an artifact is present and parseable, present but malformed, absent, parseable with no scenario results, or caller-skipped THEN it SHALL receive exactly one state from `INGESTED`, `NOT_INGESTED` (with `ARTIFACT_ABSENT` or `MALFORMED_ARTIFACT`), or `SKIPPED` (with `MISSING_SCENARIO_RESULTS` or `INGESTION_SKIPPED`); AND an `INGESTED` artifact SHALL report parsed/matched/unmatched/malformed counts satisfying parsed = matched + unmatched + malformed.

**Requirement:** [FR-3](FR.md#fr-3-artifact-level-ingestion-state)

**Scenario:** `@feature3`, `@id:SCEN-spec-evidence-artifact-ingestion-state`

## AC-4.1: Every result is joined or counted unmatched

**EARS:** WHEN valid producer results are evaluated against canonical scenarios THEN each result SHALL be either joined by qualified ID, joined by tag, joined by name fallback, or counted as unmatched (including ambiguous joins); AND no valid result SHALL be silently dropped.

**Requirement:** [FR-4](FR.md#fr-4-scenario-result-join)

**Scenario:** `@feature4`, `@id:SCEN-spec-evidence-scenario-result-join`

## AC-5.1: Canonical and overlay are retained separately

**EARS:** WHEN both canonical full-run results and overlay results exist for the same scenario THEN the evaluation output SHALL expose both with explicit labeling; AND overlay results SHALL NOT replace canonical results; AND freshness verdicts SHALL apply independently to each.

**Requirement:** [FR-5](FR.md#fr-5-canonical-vs-overlay-separation)

**Scenario:** `@feature5`, `@id:SCEN-spec-evidence-canonical-overlay-separation`

## AC-6.1: Stale results never satisfy readiness

**EARS:** WHEN a once-passing result is older than the scenario or step-definition sources it claims THEN staleness SHALL be recorded as pass-through metadata on the result; AND the stale result SHALL NOT satisfy DONE/verified status; AND absent timestamps on either side SHALL produce an indeterminate freshness verdict that also fails to satisfy readiness.

**Requirement:** [FR-6](FR.md#fr-6-freshness-and-staleness)

**Scenario:** `@feature6`, `@id:SCEN-spec-evidence-freshness-staleness`

## AC-7.1: DONE/verified requires fresh green evidence

**EARS:** WHEN a task's status is derived THEN DONE/verified SHALL require fresh green evidence joined to every required scenario for that task; AND rollups SHALL use all-not-any semantics where one green among open siblings verifies nothing; AND DONE-but-unverified SHALL be a named state distinct from DONE/verified and not-DONE.

**Requirement:** [FR-7](FR.md#fr-7-fail-closed-status-truth)

**Scenario:** `@feature7`, `@id:SCEN-spec-evidence-fail-closed-status-truth`

## AC-8.1: Waived tasks remain open and unsatisfied

**EARS:** WHEN a task is marked as waived in the kernel graph THEN its status SHALL remain open-waived regardless of any matching green evidence; AND coverage census SHALL retain waived tasks in authored totals but exclude them from satisfied counts; AND the waiver state SHALL be explicitly named and distinguishable from all other states.

**Requirement:** [FR-8](FR.md#fr-8-waiver-honesty)

**Scenario:** `@feature8`, `@id:SCEN-spec-evidence-waiver-honesty`

## AC-9.1: Census conservation equations hold

**EARS:** WHEN a coverage census is produced THEN authored scenarios = joined + unmatched-author-side + waived-excluded; AND ingested valid results = joined + unmatched-producer-side; AND parsed records = matched + unmatched + malformed; AND equation violations SHALL produce a diagnostic and set census validity to false.

**Requirement:** [FR-9](FR.md#fr-9-coverage-census-with-conservation-equations)

**Scenario:** `@feature9`, `@id:SCEN-spec-evidence-coverage-census-conservation`

## AC-10.1: No verdict without evidence bytes

**EARS:** WHEN a status verdict is produced THEN it SHALL reference at least one evidence byte hash; AND no result SHALL be marked green without a corresponding parsed artifact record; AND freshness checks SHALL NOT be bypassable by configuration; AND overlay-only evidence SHALL NOT satisfy canonical readiness; AND invariant violations SHALL produce diagnostics naming the specific invariant breached.

**Requirement:** [FR-10](FR.md#fr-10-anti-false-green-invariants)

**Scenario:** `@feature10`, `@id:SCEN-spec-evidence-anti-false-green-invariants`

## AC-11.1: Fixtures are real hashed and reconciled

**EARS:** WHEN an executable evaluation fixture is admitted THEN it SHALL originate from actual producer bytes with recorded fixture ID, capture method, producer/version, source path, capture date, SHA-256, byte count, license disposition, permitted trimming, and reviewed ground truth including expected ingestion/join/freshness/census outcomes; AND synthetic fixtures SHALL be labeled synthetic; AND multi-language NDJSON fixtures SHALL cover at least two distinct producers.

**Requirement:** [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)

**Scenario:** `@feature11`, `@id:SCEN-spec-evidence-real-fixture-provenance`

## AC-12.1: Budgets are measured and enforced

**EARS:** WHEN evaluation runs against the reference corpus THEN latency, artifact size, artifact count, census size, and diagnostic caps SHALL conform to the budgets in NFR.md; AND exceeded hard limits SHALL return `LIMIT_EXCEEDED` or refuse evaluation; AND measurements SHALL report runtime/OS/CPU, corpus fingerprint, warm-up, sample count, percentiles, artifact hash, and raw observations.

**Requirement:** [FR-12](FR.md#fr-12-budgets)

**Scenario:** `@feature12`, `@id:SCEN-spec-evidence-budget-enforcement`

## AC-13.1: Release contribution fails closed

**EARS:** WHEN release eligibility is evaluated for this spec's contribution THEN exactly one passing non-empty hash-valid artifact-bound record SHALL exist for every mandatory check mapped to FR-1 through FR-12; AND missing extra duplicate failed stale mismatched or unbound records SHALL fail closed with deterministic blockers; AND structural specification text and unexecuted Gherkin SHALL NOT satisfy evidence; AND eligibility SHALL NOT loosen the product:FR-6 cumulative gate.

**Requirement:** [FR-13](FR.md#fr-13-release-eligibility-contribution)

**Scenario:** `@feature13`, `@id:SCEN-spec-evidence-release-contribution`

## AC-14.1: MCP projection of get_test_result and get_scenario_trace

**EARS:** WHEN this evidence layer exists THEN MCP SHALL expose the two read-only tools `get_test_result` and `get_scenario_trace` as projections of evaluator output; AND the evaluator SHALL NOT call MCP internally (FR-1); AND these tools SHALL NOT be a v0.2 or v0.3 kernel required check and SHALL NOT appear on the v0.3 first-slice read registry; AND `spec-kernel:FR-6` SHALL remain forbidden from pass/fail claims; AND `spec-lsp` hover SHALL NOT invent run results, provenance, or freshness before this FR.

**Requirement:** [FR-14](FR.md#fr-14-mcp-projection-of-get_test_result-and-get_scenario_trace)

**Scenario:** `@feature14`, `@id:SCEN-spec-evidence-mcp-projection-of-run-results`
