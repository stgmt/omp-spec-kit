# File Changes

All paths are repository-relative. Status is planned; no file exists yet for this specification. This table is the planned surface for implementation stages and mirrors the DESIGN layout. Sources live at the repository root (`src/evidence/`) as plain JavaScript with JSDoc types per the house build convention; the child payload receives only generated `dist/` output. The build script's closed source/output allowlist gains the evidence stage only at its implementation stage.

| Path | Action | Reason |
|---|---|---|
| `src/evidence/evaluate.js` | create | Pure evaluator entry (FR-1) |
| `src/evidence/ingest/index.js` | create | Artifact ingestion dispatcher (FR-2, FR-3) |
| `src/evidence/ingest/cucumber-messages.js` | create | Cucumber Messages NDJSON parser (FR-2) |
| `src/evidence/ingest/pytest-bdd.js` | create | pytest-bdd cucumber-json parser (FR-2) |
| `src/evidence/ingest/overlay.js` | create | Scenario-result overlay parser (FR-2, FR-5) |
| `src/evidence/join.js` | create | Scenario result join by ID/tag/name (FR-4) |
| `src/evidence/freshness.js` | create | Freshness/staleness comparison (FR-6) |
| `src/evidence/status.js` | create | Fail-closed task status derivation (FR-7) |
| `src/evidence/waiver.js` | create | Waiver honesty enforcement (FR-8) |
| `src/evidence/census.js` | create | Coverage census with conservation (FR-9) |
| `src/evidence/invariants.js` | create | Anti-false-green invariant checks (FR-10) |
| `src/evidence/release.js` | create | Release-eligibility contribution evaluator (FR-13) |
| `src/evidence/adapter.js` | create | I/O adapter for artifact retrieval (FR-1) |
| `scripts/build-plugin.mjs` | edit | At the evidence implementation stage only: extend the closed source/output allowlist with the evidence stage files; no change in v0.1/v0.2/v0.3 (FR-1) |
| `.specs/spec-evidence/fixtures/` | create | Real fixture corpus with manifest (FR-11) |
| `docs/validation/spec-evidence-release.md` | create | Release conjunction evidence receipts (FR-13) |

## Impact analysis

No destructive actions are planned. The evidence stage touches the single child package and repository documentation only. The read-only v0.1.0 artifact, the v0.2/v0.3 kernel surfaces, and existing specs are not modified by this specification; the evidence evaluator consumes the kernel graph as an immutable input and its release is stage-separated per DESIGN DEC-1.
