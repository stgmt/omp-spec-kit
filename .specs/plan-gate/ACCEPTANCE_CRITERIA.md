# Acceptance Criteria

These criteria describe future behavior. Linked scenarios are specifications, not recorded executions.

## AC-1.1: Exact request produces a typed result

**EARS:** WHEN exact plan content and optional source URI, expected SHA-256, and request text are supplied THEN `validateExactPlan` SHALL return only `VALID`, `INVALID`, or `UNAVAILABLE`, the computed content SHA-256, bounded findings, and exact omitted count.

**Requirement:** [FR-1](FR.md#fr-1-exact-manual-validation-contract)

**Scenario:** `@feature1`, `SCEN-exact-plan-request`

## AC-2.1: Integrity and runtime failures are unavailable

**EARS:** IF the expected digest differs, the request exceeds a hard bound, its shape is invalid, or validation cannot finish THEN the result SHALL be `UNAVAILABLE` with one bounded diagnostic and SHALL NOT claim that content is valid or invalid.

**Requirement:** [FR-2](FR.md#fr-2-input-integrity-and-truthful-unavailability)

**Scenario:** `@feature2`, `SCEN-unavailable-is-not-valid`

## AC-3.1: Actionable content is required without a fixed template

**EARS:** WHEN a plan is validated THEN objective, approach, repository-relative files with actions, verification, and assumptions SHALL be non-empty under accepted heading aliases in any order; AND a destructive action SHALL require impact disclosure; AND unrelated headings SHALL be allowed.

**Requirement:** [FR-3](FR.md#fr-3-native-compatible-actionable-content)

**Scenario:** `@feature3`, `SCEN-actionable-plan-content`

## AC-4.1: Request alignment never blocks

**EARS:** WHEN optional request text shares no normalized significant word with the plan objective or approach THEN the validator SHALL emit `REQUEST_ALIGNMENT_WARNING`; AND that warning alone SHALL leave an otherwise acceptable plan `VALID`.

**Requirement:** [FR-4](FR.md#fr-4-optional-request-alignment-is-advisory)

**Scenario:** `@feature4`, `SCEN-request-alignment-warning`

## AC-5.1: Findings are complete, bounded, and stable

**EARS:** WHEN more than 50 findings exist THEN the response SHALL return the first 50 complete rows in deterministic order and exact `omittedCount`; AND repeating the same request SHALL return byte-identical output without retaining validation data.

**Requirement:** [FR-5](FR.md#fr-5-bounded-deterministic-findings)

**Scenario:** `@feature5`, `SCEN-bounded-deterministic-findings`

## AC-6.1: The installed validator has no side effects

**EARS:** WHEN the installed module validates exact bytes outside the source checkout THEN it SHALL run without external `node_modules`, filesystem reads, directory discovery, writes, network, provider, credentials, subprocesses, or persistence; AND `sourceUri` SHALL remain display-only.

**Requirement:** [FR-6](FR.md#fr-6-pure-and-self-contained-execution)

**Scenario:** `@feature6`, `SCEN-installed-validator-is-pure`

## AC-7.1: Real fixtures reconcile with ground truth

**EARS:** WHEN an executable plan fixture is admitted THEN every required provenance field, SHA-256, byte count, and reviewed expected result SHALL reconcile with observed validation; AND a synthetic-only fixture SHALL NOT satisfy the real-fixture obligation.

**Requirement:** [FR-7](FR.md#fr-7-real-fixture-provenance)

**Scenario:** `@feature7`, `SCEN-real-plan-fixtures-reconcile`
