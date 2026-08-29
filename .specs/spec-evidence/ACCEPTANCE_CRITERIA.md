# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1: Pure evaluator has no side effects

**EARS:** WHEN the evaluator consumes a kernel graph and immutable artifact bytes THEN it SHALL produce evaluation output without filesystem, clock, environment, network, process, OMP, or MCP access; AND all I/O SHALL exist only in adapters external to the evaluator.

**Requirement:** [FR-1](FR.md#fr-1-pure-evaluation-boundary)

**Scenario:** `@feature1`, `@id:SCEN-spec-evidence-pure-evaluation-boundary`

## AC-2.1: Closed versioned artifact kind set

**EARS:** WHEN the three exact supported kind/version pairs and unknown/unsupported pairs are supplied THEN only `cucumber-messages-ndjson@33.0.4`, `pytest-bdd-cucumber-json@1`, and `scenario-result-overlay@1` SHALL be admitted; unsupported identity yields `NOT_INGESTED/UNSUPPORTED_ARTIFACT_IDENTITY`, while malformed admitted bytes yield `MALFORMED_ARTIFACT`.

**Requirement:** [FR-2](FR.md#fr-2-supported-execution-artifacts)

**Scenario:** `@feature2`, `@id:SCEN-spec-evidence-supported-artifact-kinds`

## AC-3.1: Ingestion state is closed and conserved

**EARS:** WHEN PRESENT valid/malformed/unsupported/missing-results, ABSENT, or caller-SKIPPED input is evaluated THEN exactly one discriminated output state/reason from the schema SHALL result; callers SHALL NOT assert parse-derived missing-results; and INGESTED counts SHALL satisfy parsed = matched + unmatched + ambiguous + malformed.

**Requirement:** [FR-3](FR.md#fr-3-artifact-level-ingestion-state)

**Scenario:** `@feature3`, `@id:SCEN-spec-evidence-artifact-ingestion-state`

## AC-4.1: Every result is joined or counted unmatched

**EARS:** WHEN valid producer rows are evaluated THEN each SHALL have exactly one JOINED, UNMATCHED, or AMBIGUOUS_JOIN record using the priority order and bounded candidates; result/join collections and census memberships SHALL conserve exactly, with no silent drop or arbitrary election.

**Requirement:** [FR-4](FR.md#fr-4-scenario-result-join)

**Scenario:** `@feature4`, `@id:SCEN-spec-evidence-scenario-result-join`

## AC-5.1: Canonical and overlay are retained separately

**EARS:** WHEN both canonical full-run results and overlay results exist for the same scenario THEN the evaluation output SHALL expose both with explicit labeling; AND overlay results SHALL NOT replace canonical results; AND freshness verdicts SHALL apply independently to each.

**Requirement:** [FR-5](FR.md#fr-5-canonical-vs-overlay-separation)

**Scenario:** `@feature5`, `@id:SCEN-spec-evidence-canonical-overlay-separation`

## AC-6.1: Stale results never satisfy readiness

**EARS:** WHEN evidence hash bindings equal the current graph, scenario, step-binding set and implementation artifact THEN freshness SHALL be FRESH; WHEN any binding differs THEN it SHALL be STALE with exact reasons; WHEN any required binding is absent THEN it SHALL be INDETERMINATE; AND only FRESH canonical PASSED evidence may satisfy readiness.

**Requirement:** [FR-6](FR.md#fr-6-freshness-and-staleness)

**Scenario:** `@feature6`, `@id:SCEN-spec-evidence-freshness-staleness`

## AC-7.1: DONE/verified requires fresh green evidence

**EARS:** WHEN status is derived THEN `done-verified` SHALL require one FRESH PASSED CANONICAL row per required scenario plus evidence hashes; overlay-only/stale/skipped/failed/unknown/ambiguous/absent rows fail; all-not-any applies; waived status remains `open-waived`.

**Requirement:** [FR-7](FR.md#fr-7-fail-closed-status-truth)

**Scenario:** `@feature7`, `@id:SCEN-spec-evidence-fail-closed-status-truth`

## AC-8.1: Waived tasks remain open and unsatisfied

**EARS:** WHEN a task is marked as waived in the kernel graph THEN its status SHALL remain open-waived regardless of any matching green evidence; AND coverage census SHALL retain waived tasks in authored totals but exclude them from satisfied counts; AND the waiver state SHALL be explicitly named and distinguishable from all other states.

**Requirement:** [FR-8](FR.md#fr-8-waiver-honesty)

**Scenario:** `@feature8`, `@id:SCEN-spec-evidence-waiver-honesty`

## AC-9.1: Census conservation equations hold

**EARS:** WHEN census is produced THEN authored and producer equations, ambiguous rows, per-artifact/global sums, collection lengths, unique IDs and join-outcome partitions SHALL all match `spec-evidence_SCHEMA.md`; waivedTaskCount remains separate; any violation invalidates the census.

**Requirement:** [FR-9](FR.md#fr-9-coverage-census-with-conservation-equations)

**Scenario:** `@feature9`, `@id:SCEN-spec-evidence-coverage-census-conservation`

## AC-10.1: No verdict without evidence bytes

**EARS:** WHEN a status/result/trace verdict is produced THEN it SHALL reference parsed producer bytes and current bindings from a rehashed canonical sidecar bound to that artifact ID/hash; no green or fresh result may originate from flags, structural parsing, overlay-only data or missing evidence; invariant violations SHALL name the exact breached binding.

**Requirement:** [FR-10](FR.md#fr-10-anti-false-green-invariants)

**Scenario:** `@feature10`, `@id:SCEN-spec-evidence-anti-false-green-invariants`

## AC-11.1: Fixtures are real hashed and reconciled

**EARS:** WHEN an executable evaluation fixture is admitted THEN it SHALL originate from actual producer bytes with recorded fixture ID, capture method, producer/version, source path, capture date, SHA-256, byte count, license disposition, permitted trimming, and reviewed ground truth including expected ingestion/join/freshness/census outcomes; AND synthetic fixtures SHALL be labeled synthetic; AND multi-language NDJSON fixtures SHALL cover at least two distinct producers.

**Requirement:** [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)

**Scenario:** `@feature11`, `@id:SCEN-spec-evidence-real-fixture-provenance`

## AC-12.1: Budgets are measured and enforced

**EARS:** WHEN evaluation runs THEN input count/bytes parsed-record diagnostic-byte census-byte and response-byte limits SHALL be enforced by `EvidenceLimitsV2`; exceeded hard limits SHALL return `LIMIT_EXCEEDED`; explicit totals/cursors SHALL accompany any permitted truncation; AND latency SHALL be measured by the caller without giving the pure evaluator clock access.

**Requirement:** [FR-12](FR.md#fr-12-budgets)

**Scenario:** `@feature12`, `@id:SCEN-spec-evidence-budget-enforcement`

## AC-13.1: Release contribution fails closed

**EARS:** WHEN `spec-evidence-mcp@1` eligibility is evaluated THEN exactly one current PASS hash-valid candidate/graph-bound record SHALL exist for CHK-FR1-01 through CHK-FR14-01; missing extra duplicate failed stale mismatched unbound or structural-only records SHALL fail with deterministic blockers; AND the result SHALL contribute to, never replace, `product:FR-6`.

**Requirement:** [FR-13](FR.md#fr-13-release-eligibility-contribution)

**Scenario:** `@feature13`, `@id:SCEN-spec-evidence-release-contribution`

## AC-14.1: MCP projection of get_test_result and get_scenario_trace

**EARS:** WHEN `get_test_result` or `get_scenario_trace` is called THEN the read-only MCP projection SHALL return the exact schema fields for selected layer, status, run/source, trace, failed step/error, freshness bindings, sidecar/evidence hashes and the deterministic fingerprint; missing evidence SHALL return explicit null result/trace; ambiguous candidates and trace pages SHALL expose consumable cursor/limit fields; the pure evaluator SHALL not call MCP; and neither tool belongs to historical kernel-v0.3.

**Requirement:** [FR-14](FR.md#fr-14-mcp-projection-of-gettestresult-and-getscenariotrace)

**Scenario:** `@feature14`, `@id:SCEN-spec-evidence-mcp-projection-of-run-results`
