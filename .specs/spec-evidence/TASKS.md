# Tasks

All tasks are future implementation work. Status `Planned` means not started and does not imply runtime evidence.

## TASK-1: Define evaluation input/output types and schema

**Status:** Planned

**Estimate:** 3 days

**Owner:** Kernel maintainer

**Depends On:** none

**Requirements:** [FR-1](FR.md#fr-1-pure-evaluation-boundary), [FR-3](FR.md#fr-3-artifact-level-ingestion-state), [FR-9](FR.md#fr-9-coverage-census-with-conservation-equations)

**Done When:**
- `spec-evidence@1` types (evaluation input, evaluation output, ingestion state, join outcome, freshness verdict, task status, census, diagnostic, release evidence manifest) are represented in `spec-evidence_SCHEMA.md` without widening.
- Every enum (ingestion state, artifact kind, join outcome, freshness verdict, task status, diagnostic code) is closed and documented.
- Conservation equations are expressed as schema-level constraints or documented invariants.

## TASK-2: Implement artifact ingestion adapters

**Status:** Planned

**Estimate:** 5 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1

**Requirements:** [FR-2](FR.md#fr-2-supported-execution-artifacts), [FR-3](FR.md#fr-3-artifact-level-ingestion-state), [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)

**Done When:**
- Cucumber Messages NDJSON parser produces INGESTED with parsed/matched/unmatched/malformed counts on valid input.
- pytest-bdd cucumber-json parser produces INGESTED with the same count shape.
- Scenario-result overlay parser produces INGESTED with overlay metadata.
- Unrecognized kinds produce NOT_INGESTED/MALFORMED_ARTIFACT.
- Absent artifacts produce NOT_INGESTED/ARTIFACT_ABSENT.
- Parseable containers with no scenario results produce SKIPPED/MISSING_SCENARIO_RESULTS.
- All parsers are pure functions of artifact bytes and limits.

## TASK-3: Implement scenario result join

**Status:** Planned

**Estimate:** 4 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1, TASK-2

**Requirements:** [FR-4](FR.md#fr-4-scenario-result-join)

**Done When:**
- Join by qualified scenario ID succeeds on exact match.
- Join by tag succeeds when producer tags match canonical identifiers.
- Name fallback succeeds when feature paths differ from canonical mirrors.
- Ambiguous matches at the same priority produce AMBIGUOUS_JOIN.
- No-match produces UNMATCHED.
- Conservation holds: every valid result has exactly one join outcome.
- Join is deterministic across repeated runs.

## TASK-4: Implement freshness/staleness comparison

**Status:** Planned

**Estimate:** 3 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1, TASK-3

**Requirements:** [FR-6](FR.md#fr-6-freshness-and-staleness), [FR-10](FR.md#fr-10-anti-false-green-invariants)

**Done When:**
- Freshness comparison uses result timestamps and kernel source timestamps.
- Stale results are marked STALE with pass-through metadata retained.
- Absent timestamps produce INDETERMINATE.
- STALE and INDETERMINATE results do not satisfy DONE/verified.
- Freshness checks cannot be bypassed by configuration.

## TASK-5: Implement fail-closed status derivation and waiver honesty

**Status:** Planned

**Estimate:** 4 days

**Owner:** Evidence maintainer

**Depends On:** TASK-3, TASK-4

**Requirements:** [FR-7](FR.md#fr-7-fail-closed-status-truth), [FR-8](FR.md#fr-8-waiver-honesty)

**Done When:**
- DONE/verified requires fresh green evidence for every required scenario (all-not-any).
- One green among open siblings does not verify.
- DONE-but-unverified is a named state for stale/ambiguous/incomplete evidence.
- Waived tasks remain open-waived regardless of evidence.
- Waived tasks are excluded from satisfied counts but retained in authored totals.
- Status derivation uses only evidence bytes, never flags alone.

## TASK-6: Capture real multi-language fixtures and ground truth

**Status:** Planned

**Estimate:** 5 days

**Owner:** Fixture reviewer

**Depends On:** TASK-2

**Requirements:** [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)

**Done When:**
- At least two distinct NDJSON producers captured (e.g., Cucumber-JS and Reqnroll or behave).
- Each fixture has full provenance: ID, capture method, producer/version, source path, date, SHA-256, byte count, license disposition, permitted trimming, reviewed ground truth.
- Ground truth includes expected ingestion state, join outcomes, freshness verdicts, and census counts.
- Synthetic fixtures (if any) are labeled synthetic.
- Fixture manifest reconciles with admission policy.

## TASK-7: Implement coverage census and conservation checks

**Status:** Planned

**Estimate:** 3 days

**Owner:** Evidence maintainer

**Depends On:** TASK-3, TASK-5

**Requirements:** [FR-9](FR.md#fr-9-coverage-census-with-conservation-equations)

**Done When:**
- Census computes authored/joined/unmatched-author/unmatched-producer/malformed/waived counts.
- All three conservation equations are checked.
- Equation violations produce diagnostics naming the failed equation and observed vs expected counts.
- Census validity flag is false when any equation fails.
- Census is deterministic from the same inputs.

## TASK-8: Implement anti-false-green invariant checks

**Status:** Planned

**Estimate:** 2 days

**Owner:** Evidence maintainer

**Depends On:** TASK-4, TASK-5

**Requirements:** [FR-10](FR.md#fr-10-anti-false-green-invariants)

**Done When:**
- Every DONE/verified claim references at least one evidence byte hash.
- No result is marked green without a corresponding parsed artifact record.
- Overlay-only evidence does not satisfy canonical readiness.
- Invariant breaches produce diagnostics naming the specific invariant.

## TASK-9: Implement release-eligibility contribution evaluator

**Status:** Planned

**Estimate:** 3 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1 through TASK-8

**Requirements:** [FR-13](FR.md#fr-13-release-eligibility-contribution)

**Done When:**
- Evaluator produces `spec-evidence-release@1` evidence records.
- Mandatory checks cover FR-1 through FR-12.
- Missing/extra/duplicate/failed/stale/mismatched records fail closed.
- Structural specification text and unexecuted Gherkin do not satisfy evidence.
- Output does not loosen product:FR-6 cumulative gate.

## TASK-10: Budget measurement and enforcement

**Status:** Planned

**Estimate:** 3 days

**Owner:** Evidence maintainer

**Depends On:** TASK-2 through TASK-8

**Requirements:** [FR-12](FR.md#fr-12-budgets)

**Done When:**
- Evaluation latency, artifact size, artifact count, census size, and diagnostic caps are measured on the reference corpus.
- Exceeded hard limits return LIMIT_EXCEEDED or refuse evaluation.
- Measurements report runtime/OS/CPU, corpus fingerprint, warm-up, sample count, percentiles, artifact hash, and raw observations.
- Results are recorded as evidence for CHK-FR12-01.
