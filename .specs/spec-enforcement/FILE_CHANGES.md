# File Changes

All runtime paths are future and repository-relative. Root JavaScript is source of truth; the existing `src/v0.1/extension.js` remains the single extension factory. `scripts/build-plugin.mjs` copies/bundles accepted root files into `plugins/omp-spec-kit/dist/**`; no `plugins/omp-spec-kit/src/**` source or standalone enforcement factory is supported.

| Path | Action | State | Reason |
|---|---|---|---|
| `src/enforcement/registry.js` | create | planned | Closed supported-host tool-effect manifest and live comparison (FR-1, FR-7) |
| `src/enforcement/classify.js` | create | planned | Pure all-tool effect/authority classification (FR-3, FR-7) |
| `src/enforcement/command-effects.js` | create | planned | Versioned exhaustive command target grammar; dynamic input becomes incomplete (FR-7) |
| `src/enforcement/resolve-targets.js` | create | planned | I/O-capable realpath/reparse/symlink/ancestor containment (FR-3, FR-7) |
| `src/enforcement/decision.js` | create | planned | Conservative enforcement decision table and qualified redirect (FR-3, FR-4) |
| `src/enforcement/mode.js` | create | planned | Same-candidate product/authoring/enforcement binding (FR-8, FR-9) |
| `src/enforcement/diagnostics.js` | create | planned | Kernel finding and separate policy-diagnostic projections (FR-2, FR-10) |
| `src/enforcement/census.js` | create | planned | Bounded corpus census projection (FR-2) |
| `src/enforcement/release.js` | create | planned | `spec-enforcement-release@2` capability evaluator (FR-11) |
| `src/enforcement/register.js` | create | planned | Register handlers on the existing ExtensionAPI; no default factory (FR-1, FR-6) |
| `src/v0.1/extension.js` | edit | planned | Import `registerSpecEnforcement` into the existing single extension entry (FR-6, FR-9) |
| `scripts/build-plugin.mjs` | edit | planned | Add accepted enforcement root sources/dist hashes to the closed build allowlist (FR-6) |
| `.specs/spec-enforcement/fixtures/**` | create | planned | Real event/input/filesystem/no-bypass fixtures with provenance (FR-3, FR-7, FR-10) |
| `docs/validation/spec-enforcement-probes.json` | create | planned | Pinned v17.3.7 authority-ABI absence plus future host-authority and candidate-bundled installed-registry receipts (FR-1, FR-7) |
| `.github/workflows/spec-enforcement-evidence.yml` | create | planned | Produce candidate-bound check receipts and GitHub Artifact Attestation bundles under the fixed signer identity (FR-11) |
| `docs/validation/spec-enforcement-sigstore-trust.json` | create | planned | Reviewed Sigstore TUF/Fulcio/Rekor trust-root snapshot with version/hash/validity and rotation rule (FR-11) |
| `docs/validation/spec-enforcement-release.json` | create | planned | Candidate-bound eligibility, installed, containment, budget, and adversarial receipts (FR-11) |
| `.specs/product/product_SCHEMA.md` | unchanged | delivered contract | Already owns `SPEC_ENFORCEMENT` capability after `AUTHORING_MCP`; evaluator result remains required |
| `MIGRATION_MATRIX.md` | unchanged | current contract | FR-39 remains DEFER; this capability does not claim persistent audit delivery |

## Impact analysis

No destructive action is planned. Enforcement extends the single existing extension only after the product capability gate accepts the same candidate. Historical v0.3 read-only behavior and receipts remain unchanged. Raw `.specs/**` mutation is blocked or redirected exclusively to the qualified `omp-spec-kit` authoring MCP authority; the capability adds no second writer, validator, query surface, persistent audit, or control plane.
