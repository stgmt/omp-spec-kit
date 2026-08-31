# Functional Requirements

All identities use `spec-evidence:<local-id>`. This is a NEXT contract: it does not claim runtime delivery. The evaluator consumes the kernel graph but never adds execution truth to the kernel.

## FR-1: Pure evaluation boundary

The evaluator SHALL be a pure function of a current kernel snapshot, trusted-capture run envelopes, and limits. Filesystem access, runner execution, containment, and capture belong to adapters; the evaluator SHALL NOT observe the clock, environment, process, network, OMP, or MCP.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-evaluator-has-no-side-effects)

**Scenario:** `@feature1` / `SCEN-spec-evidence-pure-evaluation-boundary`

## FR-2: Supported execution artifacts

Trusted capture SHALL accept only `cucumber-messages-ndjson@33.0.4` and `pytest-bdd-cucumber-json@1`. It SHALL retain the actual producer bytes, recompute their SHA-256, and return a typed unsupported, malformed, absent, or limit error instead of guessing. There is no overlay or sidecar artifact kind.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-closed-producer-artifact-set)

**Scenario:** `@feature2` / `SCEN-spec-evidence-supported-artifact-kinds`

## FR-3: Trusted-capture run envelope

One trusted local capture adapter SHALL construct one immutable run envelope from an actual runner invocation. The envelope owns producer/run identity, captured scope, exact artifact bytes and hash, tested implementation identity, and capture-time scenario/step bindings. Caller-supplied hashes SHALL NOT authenticate caller-supplied metadata; adversarial attestation is a separate future concern.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-one-run-has-one-capture-owned-envelope)

**Scenario:** `@feature3` / `SCEN-spec-evidence-trusted-capture-envelope`

## FR-4: Scenario result join

Every parsed producer result SHALL receive exactly one `JOINED`, `UNMATCHED`, or `AMBIGUOUS` outcome. Authority is an exact qualified scenario ID or a canonical scenario tag verified against the current graph. A name match MAY be reported as a diagnostic candidate but SHALL NOT produce evidence, freshness, or readiness.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-only-stable-identity-can-join)

**Scenario:** `@feature4` / `SCEN-spec-evidence-stable-scenario-join`

## FR-5: Full-run scope authority

The trusted capture adapter SHALL derive `FULL` or `PARTIAL` from the actual invocation and captured selection. `FULL` SHALL name the expected scenario set and prove that no narrowing selector was used. Partial runs remain queryable but SHALL NOT satisfy task or release readiness and SHALL NOT replace a full-run result.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-only-capture-owned-full-scope-is-authoritative)

**Scenario:** `@feature5` / `SCEN-spec-evidence-full-run-scope-authority`

## FR-6: Freshness and staleness

Freshness SHALL compare only the joined scenario content hash, the applicable step-binding hash, and the tested implementation identity captured by the run against current values. Any mismatch is `STALE`; any required missing binding is `INDETERMINATE`; all applicable values equal is `FRESH`. A whole-graph fingerprint and timestamps SHALL NOT participate in per-result freshness.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-current-content-bindings-determine-freshness)

**Scenario:** `@feature6` / `SCEN-spec-evidence-freshness-staleness`

## FR-7: Fail-closed status truth

Task evidence SHALL be `VERIFIED` only when every currently required scenario has a `PASSED`, `FRESH`, `FULL`-scope `ScenarioEvidence`. Missing, failed, skipped, unknown, stale, indeterminate, ambiguous, unmatched, or partial evidence SHALL produce a concrete blocker. Roll-up is all-not-any.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-every-required-scenario-needs-fresh-passed-full-evidence)

**Scenario:** `@feature7` / `SCEN-spec-evidence-fail-closed-status-truth`

## FR-8: Waiver honesty

A waived task SHALL remain `WAIVED_OPEN` and SHALL NOT count as verified regardless of evidence. Non-waived task evidence states are exactly `VERIFIED` or `BLOCKED`.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-waived-tasks-remain-open)

**Scenario:** `@feature8` / `SCEN-spec-evidence-waiver-honesty`

## FR-9: Internal row accounting

The evaluator SHALL preserve every parsed producer row and assign one join outcome. It SHALL preserve every currently required scenario as either satisfied by one elected evidence reference or blocked by a reason. Counts MAY be derived for display; duplicated public census counters, stored equations, and `equationsValid` state SHALL NOT exist.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-no-row-or-required-scenario-is-silently-lost)

**Scenario:** `@feature9` / `SCEN-spec-evidence-internal-row-accounting`

## FR-10: Anti-false-green invariants

No status, freshness, or trace claim SHALL exist without a parsed producer row from a trusted-capture envelope whose artifact bytes re-hash correctly. Capture-time bindings SHALL come from the trusted adapter, not an independently supplied sidecar. Structural parsing, labels, self-declared hashes, name-only matches, and partial runs SHALL never establish readiness.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-no-verdict-without-trusted-captured-bytes)

**Scenario:** `@feature10` / `SCEN-spec-evidence-anti-false-green-invariants`

## FR-11: Real fixtures per spec-kernel discipline

Every executable parser/capture fixture SHALL originate from actual bytes emitted by an identified producer and record fixture ID, capture command or method, producer/version, source, capture date, SHA-256, byte count, license disposition, permitted trimming, and reviewed expected normalized evidence. Synthetic data is allowed only for scale or a minimal one-fault derivative and SHALL be labeled.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fixtures-are-real-hashed-and-reviewed)

**Scenario:** `@feature11` / `SCEN-spec-evidence-real-fixture-provenance`

## FR-12: Budgets

The capture adapter and evaluator SHALL enforce artifact count/byte, parsed-row, diagnostic, response, and trace-page limits from `EvidenceLimitsV2`. Hard overflow returns a closed error. Latency is measured externally because the evaluator has no clock.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-budgets-are-enforced)

**Scenario:** `@feature12` / `SCEN-spec-evidence-budget-enforcement`

## FR-13: Release-eligibility contribution

The product release gate MAY consume ordinary `TaskEvidence` and `ScenarioEvidence` for the tested candidate. It SHALL require every required task to be `VERIFIED` and SHALL retain their evidence references. There is no evidence-specific 14-record manifest, second evidence fingerprint, or custom release evaluator; this contribution never replaces the product gate.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-uses-ordinary-fresh-full-evidence)

**Scenario:** `@feature13` / `SCEN-spec-evidence-release-contribution`

## FR-14: MCP projection of get_test_result and get_scenario_trace

`get_test_result` SHALL return one `ScenarioEvidence` selected by qualified scenario ID, or `null` when no evidence exists. `get_scenario_trace` SHALL accept that evidence reference and return only its bounded trace page and failure detail. Result and trace SHALL NOT define duplicate run, freshness, artifact, trace, or fingerprint identities. These later read-only tools do not alter the eight-tool v0.3.2 first slice.

**Acceptance:** [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-result-returns-evidence-and-trace-uses-its-reference)

**Scenario:** `@feature14` / `SCEN-spec-evidence-mcp-projection-of-run-results`
