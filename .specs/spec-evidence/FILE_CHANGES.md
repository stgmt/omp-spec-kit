# File Changes

All paths are repository-relative and NEXT. Root `src/` is source; plugin `dist/` is generated. No runtime delivery is claimed.

| Path | Action | Reason |
|---|---|---|
| `src/evidence/evaluate.js` | create | Pure evaluation entry (FR-1, FR-9) |
| `src/evidence/capture.js` | create | Trusted run capture, containment, scope, hashes (FR-2, FR-3, FR-5, FR-10) |
| `src/evidence/ingest/cucumber-messages.js` | create | Real Cucumber Messages parser (FR-2) |
| `src/evidence/ingest/pytest-bdd.js` | create | Real pytest-bdd parser (FR-2) |
| `src/evidence/join.js` | create | Stable ID/tag join and name diagnostics (FR-4) |
| `src/evidence/freshness.js` | create | Scenario/step/implementation freshness (FR-6) |
| `src/evidence/readiness.js` | create | Required-scenario and waiver evidence states (FR-7, FR-8) |
| `src/evidence/mcp-projection.js` | create | ScenarioEvidence and EvidenceRef trace projection (FR-14) |
| `scripts/build-plugin.mjs` | edit | Add evidence sources to the closed build mapping when implemented (FR-1) |
| `tests/fixtures/spec-evidence/` | create | Real producer captures and labeled derivatives (FR-11) |

Removed from the plan: overlay parser, binding sidecar, census module, custom invariant/release evaluators, evidence release receipt document, and standalone trace identity.

## Impact

Implementation adds one read-only evidence capability after the SHIPPED v0.3.2 baseline. It does not modify historical receipts or the existing eight-tool first slice. Product readiness consumes ordinary task/scenario evidence rather than a new evidence-specific release protocol.
