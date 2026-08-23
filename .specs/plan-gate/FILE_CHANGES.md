# File Changes

All paths are repository-relative. Status is planned; no file exists yet for this specification. This table is the planned surface for implementation stages and mirrors the DESIGN layout. Sources live at the repository root (`src/gate/`) as plain JavaScript with JSDoc types per the house build convention (`docs/omp-v17.3.7-contract.md`, `scripts/build-plugin.mjs`); the child payload `plugins/omp-spec-kit/` receives only generated `dist/` output plus `package.json`, `README.md`, `LICENSE`, the guidance skill and command. The build script's closed source/output allowlist gains the gate stage only at its implementation stage.

| Path | Action | Reason |
|---|---|---|
| `src/gate/match.js` | create | Pure propose-write match predicate (FR-1) |
| `src/gate/resolve.js` | create | Session-local plan resolution with containment (FR-1) |
| `src/gate/cache.js` | create | Session-local prompt cache adapter (FR-6) |
| `src/gate/validator/index.js` | create | Pure phased validator entry (FR-4) |
| `src/gate/validator/structure.js` | create | Phase 1 structure checks (FR-4) |
| `src/gate/validator/duplicate.js` | create | Phase 0 duplicate scan (FR-5) |
| `src/gate/validator/grounding.js` | create | Phases 2/2.5 extracted requirements and relevance (FR-6, FR-8) |
| `src/gate/validator/crossref.js` | create | Phase 3 file-change cross-reference (FR-7) |
| `src/gate/validator/specref.js` | create | Spec-reference enforcement (FR-9) |
| `src/gate/deny.js` | create | Bounded deny rendering (FR-10) |
| `src/gate/inject.js` | create | Context-event injection (FR-3) |
| `src/gate/diagnostics.js` | create | Bounded diagnostic ring (FR-2) |
| `src/gate/resources/plan-template.md` | create | Bundled template with hash inventory (FR-10, FR-11) |
| `src/gate/resources/section-model.json` | create | Bundled skeleton/subsection/action model (FR-4, FR-11) |
| `src/gate/adapter.js` | create | OMP event subscriptions and fault barrier (FR-1, FR-2) |
| `src/gate/release.js` | create | Release conjunction evaluator (FR-13) |
| `scripts/build-plugin.mjs` | edit | At the gate implementation stage only: extend the closed source/output allowlist with the gate stage files; no change in v0.1/v0.2/v0.3 (FR-11) |
| `.specs/plan-gate/fixtures/` | create | Real fixture corpus with manifest (FR-12) |
| `docs/validation/plan-gate-probes.md` | create | TASK-1 probe receipts bound to runtime pin (FR-1) |
| `docs/validation/plan-gate-release.md` | create | Release conjunction evidence receipts (FR-13) |

## Impact analysis

No destructive actions are planned. The gate stage touches the single child package and repository documentation only. The read-only v0.1.0 artifact, the v0.2/v0.3 kernel surfaces, and existing specs are not modified by this specification; the gate subscribes to OMP events independently and its release is stage-separated per DESIGN DEC-6.
