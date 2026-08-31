# Acceptance Criteria

These criteria specify NEXT behavior. Their scenarios are not execution evidence.

## AC-1.1: Pure evaluator has no side effects

**EARS:** WHEN the evaluator receives a current snapshot, run envelopes, and limits THEN it SHALL return the same output for the same input without filesystem, clock, environment, network, process, OMP, or MCP access.

**Requirement:** [FR-1](FR.md#fr-1-pure-evaluation-boundary)

**Scenario:** `@feature1`, `@id:SCEN-spec-evidence-pure-evaluation-boundary`

## AC-2.1: Closed producer artifact set

**EARS:** WHEN trusted capture receives supported, unsupported, malformed, absent, and over-limit producer artifacts THEN it SHALL accept only Cucumber Messages NDJSON 33.0.4 and pytest-bdd cucumber-json 1, preserve and re-hash actual bytes, and return the exact closed error for every other case.

**Requirement:** [FR-2](FR.md#fr-2-supported-execution-artifacts)

**Scenario:** `@feature2`, `@id:SCEN-spec-evidence-supported-artifact-kinds`

## AC-3.1: One run has one capture-owned envelope

**EARS:** WHEN the trusted adapter captures an actual run THEN it SHALL emit one immutable envelope containing capture-owned run identity, scope, artifact bytes/hash, tested implementation identity, and scenario bindings; AND caller-supplied metadata/hash pairs SHALL NOT authenticate evidence.

**Requirement:** [FR-3](FR.md#fr-3-trusted-capture-run-envelope)

**Scenario:** `@feature3`, `@id:SCEN-spec-evidence-trusted-capture-envelope`

## AC-4.1: Only stable identity can join

**EARS:** WHEN producer rows are joined THEN only an exact qualified ID or graph-verified canonical tag SHALL yield `JOINED`; ambiguous and unmatched rows SHALL remain non-authoritative; AND name matches SHALL appear only as diagnostics.

**Requirement:** [FR-4](FR.md#fr-4-scenario-result-join)

**Scenario:** `@feature4`, `@id:SCEN-spec-evidence-stable-scenario-join`

## AC-5.1: Only capture-owned full scope is authoritative

**EARS:** WHEN full and partial runs exist THEN only a run whose trusted capture proves `FULL` scope over its expected scenario set SHALL be eligible for readiness; partial evidence SHALL remain visible but SHALL NOT replace or satisfy full evidence.

**Requirement:** [FR-5](FR.md#fr-5-full-run-scope-authority)

**Scenario:** `@feature5`, `@id:SCEN-spec-evidence-full-run-scope-authority`

## AC-6.1: Current content bindings determine freshness

**EARS:** WHEN scenario content, applicable step binding, and tested implementation identity equal current values THEN evidence SHALL be `FRESH`; any mismatch SHALL be `STALE`; any required missing binding SHALL be `INDETERMINATE`; AND graph fingerprints and timestamps SHALL not affect the verdict.

**Requirement:** [FR-6](FR.md#fr-6-freshness-and-staleness)

**Scenario:** `@feature6`, `@id:SCEN-spec-evidence-freshness-staleness`

## AC-7.1: Every required scenario needs fresh passed full evidence

**EARS:** WHEN task evidence is derived THEN the task SHALL be `VERIFIED` only if every current required scenario has `PASSED`, `FRESH`, `FULL` evidence; otherwise it SHALL be `BLOCKED` with the exact missing, failed, stale, indeterminate, ambiguous, or partial reason.

**Requirement:** [FR-7](FR.md#fr-7-fail-closed-status-truth)

**Scenario:** `@feature7`, `@id:SCEN-spec-evidence-fail-closed-status-truth`

## AC-8.1: Waived tasks remain open

**EARS:** WHEN a task is waived THEN its evidence state SHALL be `WAIVED_OPEN` regardless of matching passed evidence and SHALL NOT count as verified.

**Requirement:** [FR-8](FR.md#fr-8-waiver-honesty)

**Scenario:** `@feature8`, `@id:SCEN-spec-evidence-waiver-honesty`

## AC-9.1: No row or required scenario is silently lost

**EARS:** WHEN evaluation completes THEN every parsed producer row SHALL have one join outcome and every current required scenario SHALL have either one elected satisfying evidence reference or a blocker; display counts SHALL be derived rather than persisted as authority.

**Requirement:** [FR-9](FR.md#fr-9-internal-row-accounting)

**Scenario:** `@feature9`, `@id:SCEN-spec-evidence-internal-row-accounting`

## AC-10.1: No verdict without trusted captured bytes

**EARS:** WHEN result, freshness, readiness, or trace is returned THEN it SHALL resolve to re-hashed producer bytes in one trusted-capture envelope; sidecars, labels, structural parsing, name-only matches, and partial scope SHALL NOT establish green authority.

**Requirement:** [FR-10](FR.md#fr-10-anti-false-green-invariants)

**Scenario:** `@feature10`, `@id:SCEN-spec-evidence-anti-false-green-invariants`

## AC-11.1: Fixtures are real hashed and reviewed

**EARS:** WHEN an executable fixture is admitted THEN it SHALL contain real producer bytes and the required provenance, hash, trimming, and reviewed normalized outcomes; synthetic fixtures SHALL be limited to labeled scale or one-fault derivatives.

**Requirement:** [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)

**Scenario:** `@feature11`, `@id:SCEN-spec-evidence-real-fixture-provenance`

## AC-12.1: Budgets are enforced

**EARS:** WHEN capture, evaluation, or trace paging exceeds a hard count/byte limit THEN it SHALL return a closed limit error without partial failure text; AND latency SHALL be measured outside the pure evaluator.

**Requirement:** [FR-12](FR.md#fr-12-budgets)

**Scenario:** `@feature12`, `@id:SCEN-spec-evidence-budget-enforcement`

## AC-13.1: Release uses ordinary fresh full evidence

**EARS:** WHEN the product gate evaluates this capability THEN every required task SHALL be `VERIFIED` by ordinary scenario evidence bound to the tested candidate; one missing or blocked task SHALL fail the contribution; AND no evidence-specific manifest or second fingerprint SHALL be required.

**Requirement:** [FR-13](FR.md#fr-13-release-eligibility-contribution)

**Scenario:** `@feature13`, `@id:SCEN-spec-evidence-release-contribution`

## AC-14.1: Result returns evidence and trace uses its reference

**EARS:** WHEN `get_test_result` resolves a scenario THEN it SHALL return one `ScenarioEvidence` or null; WHEN `get_scenario_trace` receives that evidence reference THEN it SHALL return only the corresponding bounded trace page and failure; AND no duplicate evidence identity SHALL appear.

**Requirement:** [FR-14](FR.md#fr-14-mcp-projection-of-gettestresult-and-getscenariotrace)

**Scenario:** `@feature14`, `@id:SCEN-spec-evidence-mcp-projection-of-run-results`
