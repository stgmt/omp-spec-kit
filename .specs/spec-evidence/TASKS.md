# Tasks

All tasks are future implementation work. Status `Planned` means not started and does not imply runtime evidence.

## TASK-1: Define evaluation input/output types and schema

**Status:** Planned

**Estimate:** 3 days

**Owner:** Kernel maintainer

**Depends On:** none

**Requirements:** FR-1 through FR-14 schema surfaces, with detailed implementation ownership split across TASK-2 through TASK-11.
**Checks:** CHK-FR1-01, CHK-FR2-01, CHK-FR3-01, CHK-FR4-01, CHK-FR5-01, CHK-FR6-01, CHK-FR7-01, CHK-FR9-01, CHK-FR12-01, CHK-FR13-01, CHK-FR14-01

**Done When:**
- `spec-evidence@2` input/output, artifact union, result/trace, hash freshness, split census, diagnostic, MCP and release-record types are closed.
- Every enum and union has constructible positive/negative variants.
- Conservation and candidate/graph binding rules are explicit schema invariants.

## TASK-2: Implement artifact ingestion adapters

**Status:** Planned

**Estimate:** 5 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1

**Requirements:** [FR-2](FR.md#fr-2-supported-execution-artifacts), [FR-3](FR.md#fr-3-artifact-level-ingestion-state), [FR-5](FR.md#fr-5-canonical-vs-overlay-separation), [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)
**Checks:** CHK-FR2-01, CHK-FR3-01, CHK-FR5-01, CHK-FR11-01

**Done When:**
- Cucumber Messages NDJSON parser produces INGESTED with parsed/matched/unmatched/malformed counts on valid input.
- pytest-bdd cucumber-json parser produces INGESTED with the same count shape.
- Scenario-result overlay parser produces INGESTED with overlay metadata.
- Unrecognized kinds produce `NOT_INGESTED/UNSUPPORTED_ARTIFACT_IDENTITY`.
- Absent artifacts produce `ABSENT/ARTIFACT_ABSENT`.
- Parseable containers with no scenario results produce `NOT_INGESTED/MISSING_SCENARIO_RESULTS`.
- Every producer binding comes from a hash-bound canonical sidecar whose artifact ID/hash match the admitted bytes; caller-supplied out-of-band binding rows are impossible.
- All parsers are pure functions of artifact bytes and limits.

## TASK-3: Implement scenario result join

**Status:** Planned

**Estimate:** 4 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1, TASK-2

**Requirements:** [FR-4](FR.md#fr-4-scenario-result-join)
**Checks:** CHK-FR4-01

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
**Checks:** CHK-FR6-01, CHK-FR10-01

**Done When:**
- Equal graph/scenario/step/implementation hashes yield FRESH.
- One unequal binding yields STALE with the changed dimension.
- One missing binding yields INDETERMINATE.
- Timestamps are display-only and the evaluator reads no clock.
- Only FRESH PASSED canonical rows can satisfy readiness.

## TASK-5: Implement fail-closed status derivation and waiver honesty

**Status:** Planned

**Estimate:** 4 days

**Owner:** Evidence maintainer

**Depends On:** TASK-3, TASK-4

**Requirements:** [FR-7](FR.md#fr-7-fail-closed-status-truth), [FR-8](FR.md#fr-8-waiver-honesty)
**Checks:** CHK-FR7-01, CHK-FR8-01, CHK-FR10-01

**Done When:**
- `done-verified` requires fresh PASSED canonical evidence for every required scenario.
- One green among open siblings does not verify.
- `done-unverified` is the exact state for stale/ambiguous/incomplete green evidence.
- Waived tasks remain open-waived regardless of evidence.
- Waived tasks are excluded from satisfied counts but retained in authored totals.
- Status derivation uses only evidence bytes, never flags alone.

## TASK-6: Capture real multi-language fixtures and ground truth

**Status:** Planned

**Estimate:** 5 days

**Owner:** Fixture reviewer

**Depends On:** TASK-2

**Requirements:** [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)
**Checks:** CHK-FR11-01

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
**Checks:** CHK-FR9-01

**Done When:**
- Census reports unique authored/joined scenarios separately from producer rows.
- Authored, producer and parse conservation equations are checked independently.
- Canonical plus overlay rows increment producer counts but not joinedScenarioCount twice.
- WaivedTaskCount remains separate from scenario equations.
- Every violation returns exact expected/actual counts and invalidates the census.

## TASK-8: Implement anti-false-green invariant checks

**Status:** Planned

**Estimate:** 2 days

**Owner:** Evidence maintainer

**Depends On:** TASK-4, TASK-5

**Requirements:** [FR-10](FR.md#fr-10-anti-false-green-invariants)
**Checks:** CHK-FR10-01

**Done When:**
- Every `done-verified` claim references at least one evidence byte hash.
- No result is marked green without a corresponding parsed artifact record and rehashed artifact-bound canonical binding sidecar.
- Overlay-only evidence does not satisfy canonical readiness.
- Invariant breaches produce diagnostics naming the specific invariant.

## TASK-9: Implement release-eligibility contribution evaluator

**Status:** Planned

**Estimate:** 3 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1 through TASK-8

**Requirements:** [FR-13](FR.md#fr-13-release-eligibility-contribution)
**Checks:** CHK-FR13-01

**Done When:**
- Evaluator consumes `SpecEvidenceReleaseManifestV2`.
- Mandatory records cover exactly CHK-FR1-01 through CHK-FR14-01.
- Every PASS record has non-empty hash-valid candidate/graph-bound evidence.
- Missing/extra/duplicate/failed/stale/mismatched/unbound records fail deterministically.
- Structural text and unexecuted Gherkin satisfy no record.
- Canonical `evidenceFingerprint` bytes are recomputed exactly and the result repeats candidate/profile/graph identity.
- Output contributes to but never replaces product:FR-6.

## TASK-10: Budget measurement and enforcement

**Status:** Planned

**Estimate:** 3 days

**Owner:** Evidence maintainer

**Depends On:** TASK-2 through TASK-8

**Requirements:** [FR-12](FR.md#fr-12-budgets)
**Checks:** CHK-FR12-01

**Done When:**
- Input count/byte, parsed-row, diagnostic-byte, census-byte and response-byte limits are enforced.
- Exceeded hard limits return LIMIT_EXCEEDED; pageable overflow returns totals/cursor.
- Evaluator reads no clock; the caller records runtime/OS/CPU, graph fingerprint, warm-up, samples and percentiles.

## TASK-11: Project evidence result and trace tools through MCP

**Status:** Planned

**Estimate:** 3 days

**Owner:** Evidence + MCP maintainer

**Depends On:** TASK-1 through TASK-10

**Requirements:** [FR-14](FR.md#fr-14-mcp-projection-of-gettestresult-and-getscenariotrace), [FR-5](FR.md#fr-5-canonical-vs-overlay-separation), [FR-6](FR.md#fr-6-freshness-and-staleness)
**Checks:** CHK-FR14-01, CHK-FR5-01, CHK-FR6-01

**Done When:**
- `get_test_result` and `get_scenario_trace` implement the exact request/result/error schemas.
- Selected layer, status, run/source, trace, failed step/error, freshness, binding-sidecar hash, evidence hashes and deterministic fingerprint are preserved.
- Missing evidence returns explicit null result/trace; ambiguous IDs and trace pages return bounded candidates/steps with consumable fingerprint-bound cursors.
- The evaluator imports no MCP code and the historical v0.3 registry remains unchanged.
- `spec-evidence-mcp@1` release profile requires CHK-FR1-01 through CHK-FR14-01.
