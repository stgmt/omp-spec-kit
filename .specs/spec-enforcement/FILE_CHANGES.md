# File Changes

All paths are repository-relative. Status is planned; no file exists yet for this specification. This table is the planned surface for implementation stages and mirrors the DESIGN layout. Sources live at the repository root (`src/enforcement/`) as plain JavaScript with JSDoc types per the house build convention (`docs/omp-v17.3.7-contract.md`, `scripts/build-plugin.mjs`); the child payload `plugins/omp-spec-kit/` receives only generated `dist/` output plus `package.json`, `README.md`, `LICENSE`. The build script's closed source/output allowlist gains the enforcement stage only at its implementation stage.

| Path | Action | Reason |
|---|---|---|
| `src/enforcement/match.js` | create | Pure path match predicate for `.specs/**` writes (FR-3, FR-7) |
| `src/enforcement/mode.js` | create | Mode determination and gate status cache (FR-8, FR-9) |
| `src/enforcement/diagnostics.js` | create | Kernel diagnostic adapter and bounded rendering (FR-2, FR-10) |
| `src/enforcement/census.js` | create | Corpus census adapter and bounded rendering (FR-2) |
| `src/enforcement/block.js` | create | Enforcement-mode block reason renderer (FR-3) |
| `src/enforcement/fail-honest.js` | create | Fault barrier translating exceptions to explicit diagnostics (FR-4) |
| `src/enforcement/adapter.js` | create | OMP event subscriptions and extension factory entry (FR-1, FR-6) |
| `src/enforcement/release.js` | create | Release conjunction evaluator (FR-11) |
| `scripts/build-plugin.mjs` | edit | At the enforcement implementation stage only: extend the closed source/output allowlist with the enforcement stage files; no change in v0.1/v0.2/v0.3 (FR-6) |
| `.specs/spec-enforcement/fixtures/` | create | Real fixture corpus with manifest (FR-10) |
| `docs/validation/spec-enforcement-probes.md` | create | TASK-1 probe receipts bound to runtime pin (FR-1) |
| `docs/validation/spec-enforcement-release.md` | create | Release conjunction evidence receipts (FR-11) |

## Impact analysis

No destructive actions are planned. The enforcement stage touches the single child package and repository documentation only. The read-only v0.1.0 artifact, the v0.2/v0.3 kernel surfaces, existing specs, and the `plan-gate` stage are not modified by this specification; the enforcement hooks subscribe to OMP events independently and their release is stage-separated per DESIGN DEC-6.
