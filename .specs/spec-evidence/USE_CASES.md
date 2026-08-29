# Use Cases

## UC-1: Evaluate fresh green evidence for a task

**Primary actor:** Release evaluator or query consumer.

**Precondition:** A spec-kernel graph and Cucumber Messages NDJSON artifact bytes are supplied as immutable inputs.

**Flow:**
1. The evaluator ingests the artifact, producing `INGESTED` state with parsed/matched/unmatched/malformed counts.
2. Scenario results are joined to canonical scenarios by qualified scenario ID, tag, or name fallback.
3. Freshness compares graph, scenario-content, applicable step-binding-set, and applicable implementation-artifact hashes.
4. Fresh PASSED canonical evidence yields `done-verified`; stale/indeterminate green yields `done-unverified`; absent/red yields `not-done`.

**Postcondition:** The evaluation output contains ingestion state, join outcomes, freshness verdicts, and task status truth with conservation equations satisfied.

**Related:** [FR-1](FR.md#fr-1-pure-evaluation-boundary), [FR-4](FR.md#fr-4-scenario-result-join), [FR-6](FR.md#fr-6-freshness-and-staleness), [FR-7](FR.md#fr-7-fail-closed-status-truth), `@feature1`, `@feature4`, `@feature6`, `@feature7`

## UC-2: Detect stale evidence that cannot satisfy readiness

**Primary actor:** Release evaluator.

**Precondition:** A once-passing result carries one hash binding that differs from the current kernel scenario binding.

**Flow:**
1. The evaluator compares the four hash dimensions and applicability bits; timestamps remain display-only.
2. The original result stays observable with `STALE` and an exact `staleBecause` dimension.
3. The stale result does not satisfy `done-verified`; task status is `done-unverified` or `not-done`.

**Postcondition:** Stale evidence is visible in diagnostics and census but never satisfies readiness.

**Related:** [FR-6](FR.md#fr-6-freshness-and-staleness), [FR-7](FR.md#fr-7-fail-closed-status-truth), `@feature6`, `@feature7`

## UC-3: Refuse fake-close of a waived task

**Primary actor:** Evidence evaluator.

**Precondition:** A task is marked as waived in the kernel graph.

**Flow:**
1. The evaluator identifies the waiver flag on the task node.
2. Regardless of any matching green evidence, the task status remains open-waived.
3. The waiver is recorded in the evaluation output as a named state distinct from DONE and not-DONE.

**Postcondition:** Waived tasks are never counted as satisfied; coverage census excludes them from satisfied counts while retaining them in authored totals.

**Related:** [FR-8](FR.md#fr-8-waiver-honesty), `@feature8`

## UC-4: Produce a coverage census with conservation

**Primary actor:** Coverage reporter.

**Flow:**
1. The evaluator counts unique authored scenarios from the kernel graph.
2. It counts unique joined scenarios separately from canonical/overlay producer rows.
3. Authored conservation verifies `authoredScenarioCount = joinedScenarioCount + unmatchedAuthorScenarioCount`.
4. Producer conservation verifies `ingestedProducerResultCount = joinedProducerResultCount + unmatchedProducerResultCount + ambiguousProducerResultCount`; collection lengths/membership and per-artifact parse counts reconcile independently.
5. The census emits waivedTaskCount separately and reports every equation result.

**Postcondition:** Every result is accounted for; no silent drops or fabrications.

**Related:** [FR-9](FR.md#fr-9-coverage-census-with-conservation-equations), `@feature9`

## UC-5: Ingest artifacts with fail-closed state

**Primary actor:** Artifact ingester.

**Precondition:** An artifact input is PRESENT, ABSENT, or explicitly caller-skipped.

**Flow:**
1. PRESENT bytes are re-hashed and their exact kind/version admitted against the closed registry before parsing.
2. Success produces `INGESTED`; unsupported/malformed/missing-results produce the exact `NOT_INGESTED` reason; absent and caller-skipped inputs produce their distinct closed states.
3. Caller input cannot assert parse-derived `MISSING_SCENARIO_RESULTS`, and artifact state remains distinct from scenario result status.

**Postcondition:** Every artifact has one schema-valid discriminated record; no state/reason cross-product is possible.

**Related:** [FR-3](FR.md#fr-3-artifact-level-ingestion-state), `@feature3`

## UC-6: Contribute to release eligibility

**Primary actor:** Future release-stage evaluator.

**Precondition:** This spec's evaluation output exists for a candidate release.

**Flow:**
1. The release evaluator receives the complete check records plus caller-supplied evidence-document bytes.
2. It re-hashes each document and validates exact check/requirement/candidate/graph bindings.
3. Missing, extra, duplicate, failed, stale, mismatched, unverified or unbound records fail with closed blockers.

**Postcondition:** This spec's contribution either passes as a complete conjunction member or blocks release with deterministic reasons.

**Related:** [FR-13](FR.md#fr-13-release-eligibility-contribution), `@feature13`
