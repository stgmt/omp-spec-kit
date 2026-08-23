# Fixtures

Fixture admission follows the repository real-producer policy (`spec-kernel:FR-11` house standard). Every executable evaluation fixture must be real, immutable, hashed, and reconciled with reviewed ground truth.

## Categories

| Category | Producer | Purpose | Admission |
|---|---|---|---|
| Valid NDJSON (Cucumber-JS) | Cucumber-JS runner emitting Cucumber Messages NDJSON | Positive ingestion + join + freshness for canonical format | Real; full manifest |
| Valid NDJSON (Reqnroll) | Reqnroll runner emitting Cucumber Messages NDJSON | Multi-language positive ingestion + join | Real; full manifest |
| Valid NDJSON (behave) | behave runner emitting Cucumber Messages NDJSON | Third producer for multi-language coverage | Real; full manifest |
| pytest-bdd cucumber-json | pytest-bdd runner emitting cucumber-json | Legacy format positive ingestion | Real; full manifest |
| Overlay artifact | Hand-crafted scenario-result overlay | Canonical vs overlay separation (FR-5) | Real-derived with documented origin |
| Malformed artifact | Corrupted NDJSON bytes | NOT_INGESTED/MALFORMED_ARTIFACT path | Synthetic (labeled) |
| Absent artifact | No file supplied | NOT_INGESTED/ARTIFACT_ABSENT path | Synthetic (labeled) |
| Empty results container | Valid NDJSON with zero scenario results | SKIPPED/MISSING_SCENARIO_RESULTS path | Synthetic (labeled) |
| Stale evidence | Real NDJSON with timestamps predating kernel sources | Freshness STALE verdict; fails readiness | Real-derived with timestamp manipulation documented |
| Ambiguous join | NDJSON with results matching multiple canonical scenarios | AMBIGUOUS_JOIN outcome | Real-derived |
| Unmatched results | NDJSON with results matching no canonical scenario | UNMATCHED count in census | Real-derived |
| Waived task corpus | Kernel graph with waived tasks + matching green evidence | Waiver honesty: remains open-waived | Real-derived from spec corpus |
| Scale fixtures | Generated large NDJSON for budget/latency measurements | NFR evidence | Synthetic (labeled) |

## Manifest fields

Each fixture record carries: fixture ID, category, capture command or method, producer and version/commit, source path or URL, capture date, SHA-256, byte count, license disposition, permitted trimming note, and ground truth.

Ground truth for evaluation fixtures lists expected ingestion state, join outcomes (per result), freshness verdicts, task status derivations, and census counts so every conservation equation can be reconciled. Admission reconciliation compares observed evaluation output element-for-element against ground truth.

## Provenance boundary

Upstream `dev-pomogator` NDJSON files (e.g., `.test-results.ndjson.tmp.*`) are capture candidates only. Importing any upstream byte into this repository still requires the repository's provenance/SHA-256/license disposition decision per `SECURITY.md` and the import policy; this specification does not waive that gate. Target-owned captures from live test runs are preferred.

## Multi-language requirement

At least two distinct NDJSON producers MUST be represented in the fixture corpus before FR-11 acceptance. The preferred combination is Cucumber-JS + Reqnroll; behave is a valid alternative second producer.
