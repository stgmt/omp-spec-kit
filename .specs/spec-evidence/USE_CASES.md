# Use Cases

## UC-1: Evaluate fresh green evidence for a task

**Primary actor:** Release evaluator or query consumer.

**Precondition:** A spec-kernel graph and Cucumber Messages NDJSON artifact bytes are supplied as immutable inputs.

**Flow:**
1. The evaluator ingests the artifact, producing `INGESTED` state with parsed/matched/unmatched/malformed counts.
2. Scenario results are joined to canonical scenarios by qualified scenario ID, tag, or name fallback.
3. Freshness is computed: the result timestamp is compared against the scenario and step-definition source timestamps.
4. The task's status is derived: fresh green evidence yields DONE/verified; stale green yields DONE-but-unverified; absent or red yields not-DONE.

**Postcondition:** The evaluation output contains ingestion state, join outcomes, freshness verdicts, and task status truth with conservation equations satisfied.

**Related:** [FR-1](FR.md#fr-1-pure-evaluation-boundary), [FR-4](FR.md#fr-4-scenario-result-join), [FR-6](FR.md#fr-6-freshness-and-staleness), [FR-7](FR.md#fr-7-fail-closed-status-truth), `@feature1`, `@feature4`, `@feature6`, `@feature7`

## UC-2: Detect stale evidence that cannot satisfy readiness

**Primary actor:** Release evaluator.

**Precondition:** A once-passing result exists whose timestamp predates the scenario or step-definition sources it claims.

**Flow:**
1. The evaluator compares result timestamp against source timestamps from the kernel graph.
2. Staleness is recorded as pass-through metadata on the result; the result is never stripped.
3. The stale result does not satisfy DONE/verified status; the task remains DONE-but-unverified or not-DONE.

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
1. The evaluator counts authored scenarios from the kernel graph.
2. It counts joined, unmatched, and malformed results from artifact ingestion.
3. Conservation equations verify: authored = joined + unmatched-author-side; ingested-results = joined + unmatched-producer-side + malformed.
4. The census is emitted with all counts and equation satisfaction flags.

**Postcondition:** Every result is accounted for; no silent drops or fabrications.

**Related:** [FR-9](FR.md#fr-9-coverage-census-with-conservation-equations), `@feature9`

## UC-5: Ingest artifacts with fail-closed state

**Primary actor:** Artifact ingester.

**Precondition:** An execution artifact is supplied (present, absent, or malformed).

**Flow:**
1. The ingester attempts to parse the artifact bytes according to the declared kind and version.
2. Success produces `INGESTED` with counts; absence produces `NOT_INGESTED` with reason `ARTIFACT_ABSENT`; parse failure produces `NOT_INGESTED` with reason `MALFORMED_ARTIFACT`; missing scenario results within a parseable artifact produces `SKIPPED` with reason `MISSING_SCENARIO_RESULTS`.
3. Artifact-level state is distinct from individual scenario results.

**Postcondition:** Every artifact has exactly one ingestion state with a closed reason.

**Related:** [FR-3](FR.md#fr-3-artifact-level-ingestion-state), `@feature3`

## UC-6: Contribute to release eligibility

**Primary actor:** Future release-stage evaluator.

**Precondition:** This spec's evaluation output exists for a candidate release.

**Flow:**
1. The release evaluator consumes this spec's mandatory-check evidence records.
2. Each record is validated for hash binding, non-emptiness, and PASS status.
3. Missing, failed, or mismatched records cause the conjunction to fail closed.

**Postcondition:** This spec's contribution either passes as a complete conjunction member or blocks release with deterministic reasons.

**Related:** [FR-13](FR.md#fr-13-release-eligibility-contribution), `@feature13`
