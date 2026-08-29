# Fixtures

Fixture admission follows the repository real-producer policy (`spec-kernel:FR-11` house standard). Every executable evaluation fixture must be real, immutable, hashed, and reconciled with reviewed ground truth.

## Categories

| Category | Producer | Purpose | Admission |
|---|---|---|---|
| Valid NDJSON (Cucumber-JS) | Cucumber-JS runner emitting Cucumber Messages NDJSON | Positive ingestion + join + freshness for canonical format | Real; full manifest |
| Valid NDJSON (Reqnroll) | Reqnroll runner emitting Cucumber Messages NDJSON | Multi-language positive ingestion + join | Real; full manifest |
| Valid NDJSON (behave) | behave runner emitting Cucumber Messages NDJSON | Third producer for multi-language coverage | Real; full manifest |
| pytest-bdd cucumber-json | pytest-bdd runner emitting cucumber-json | Legacy format positive ingestion | Real; full manifest |
| Overlay artifact | Real scenario-result overlay emitted by an identified adapter/producer | Canonical vs overlay separation (FR-5) | Real capture; trimming documented |
| Malformed artifact | One corrupted copy of a captured NDJSON frame | NOT_INGESTED/MALFORMED_ARTIFACT | Minimal synthetic negative; provenance points to source capture |
| Absent artifact | No bytes plus explicit ABSENT input record | ABSENT/ARTIFACT_ABSENT | Minimal synthetic negative |
| Empty results container | Captured valid container trimmed to zero result records without breaking format | NOT_INGESTED/MISSING_SCENARIO_RESULTS | Real-derived; trimming documented |
| Stale evidence | Real passing artifact plus canonical binding sidecar whose sidecar record is changed one dimension at a time and re-hashed | STALE reasons; fails readiness | Real-derived one-fault variants |
| Ambiguous join | Real result copied into a fixture with two planted same-priority canonical candidates | AMBIGUOUS_JOIN | Real-derived minimal negative |
| Unmatched results | Real result paired with a corpus that contains no target scenario | UNMATCHED producer count | Real-derived |
| Waived task corpus | Captured target spec corpus plus its real passing evidence | Waiver honesty: remains open-waived | Real target-owned capture |
| Scale fixtures | Generated large NDJSON after semantic fixtures pass | NFR count/byte/latency evidence | Synthetic scale-only |

## Manifest fields

Each fixture record carries: fixture ID, category, capture command or method, producer and version/commit, source path or URL, capture date, SHA-256, byte count, license disposition, permitted trimming note, and ground truth.

Ground truth lists exact kind/version admission, recomputed artifact and sidecar hashes with exact artifactId/artifactSha256 binding, discriminated ingestion record, per-row JOINED/UNMATCHED/AMBIGUOUS outcome, four binding dimensions/applicability, freshness, exact derived status, collection memberships and all conservation counts/equations.

## Provenance boundary

Upstream `dev-pomogator` NDJSON files (e.g., `.test-results.ndjson.tmp.*`) are capture candidates only. Importing any upstream byte into this repository still requires the repository's provenance/SHA-256/license disposition decision per `SECURITY.md` and the import policy; this specification does not waive that gate. Target-owned captures from live test runs are preferred.

## Multi-language requirement

At least two distinct NDJSON producers MUST be represented in the fixture corpus before FR-11 acceptance. The preferred combination is Cucumber-JS + Reqnroll; behave is a valid alternative second producer.
