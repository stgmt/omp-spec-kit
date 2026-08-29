# File Changes

This inventory separates delivered v0.3.2 files from the one planned forward evaluator change. Presence is verified against repository reality; delivered status is bound to `docs/validation/release-status-v0.3.2.json`, not inferred from this table.

| Path | State / action | Requirement | Purpose |
|---|---|---|---|
| `.omp-plugin/marketplace.json` | Delivered | FR-1, FR-7 | One catalog/entry at v0.3.2. |
| `plugins/omp-spec-kit/package.json` | Delivered | FR-2, FR-5, FR-7 | One child, exact profile allowlist, one extension. |
| `plugins/omp-spec-kit/.mcp.json` | Delivered v0.3 profile | FR-2, FR-3 | One MCP server identity inside same package. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp` | Delivered v0.3 profile | FR-2, FR-5 | POSIX installed launcher. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp.cmd` | Delivered v0.3 profile | FR-2, FR-5 | Windows installed launcher. |
| `plugins/omp-spec-kit/{README.md,LICENSE}` | Delivered | FR-2, FR-4, FR-9 | Installed boundary/license. |
| `plugins/omp-spec-kit/skills/spec-inventory/SKILL.md` | Delivered | FR-3, FR-11 | Guidance; no duplicate runtime. |
| `plugins/omp-spec-kit/commands/spec-inventory.md` | Delivered | FR-3, FR-11 | Human guidance; no duplicate logic. |
| `src/v0.1/extension.js` | Delivered | FR-2, FR-4, FR-12 | Existing single extension factory, preserved across profiles. |
| `src/v0.1/inventory.js` | Delivered | FR-3, FR-6, FR-12 | Root-relative bounded inventory. |
| `src/kernel/**` | Delivered v0.2/v0.3 baseline | FR-2, FR-5 | Read-only kernel source tree. |
| `src/adapters/**` | Delivered v0.3 baseline | FR-2, FR-5 | Query/OMP adapters. |
| `src/mcp/**` | Delivered v0.3 baseline | FR-2, FR-5 | One read-only MCP server source tree. |
| `plugins/omp-spec-kit/dist/**` | Generated/delivered | FR-2, FR-3, FR-5 | Installed extension/kernel/adapters/MCP plus deterministic manifest; never hand-edited. |
| `scripts/build-plugin.mjs` | Delivered | FR-5 | Clean profile-aware copier/rebaser and manifest builder. |
| `scripts/verify-marketplace.mjs` | Delivered | FR-1, FR-2, FR-7 | Closed topology/version/profile validator. |
| `scripts/verify-public-tree.mjs` | Delivered | FR-9 | Secret/state/license/provenance/public-tree gate. |
| `scripts/verify-package.mjs` | Delivered | FR-5, FR-12 | Child allowlist/digest/dependency/version verifier. |
| `scripts/create-distribution-evidence.mjs` | Delivered | FR-4 through FR-13 | Candidate-bound FR-1..FR-12 producer matrix. |
| `scripts/create-release-evidence.mjs` | Delivered historical v0.3.2 | FR-11, FR-13 | `omp-spec-kit-release-evidence@3` assembler. |
| `scripts/verify-release.mjs` | Delivered @1; edit planned | FR-11, FR-13 | Preserve historical public@1 receipts; add forward distribution-only @2 result and remove MRI/product output from that profile. |
| `scripts/render-release-notes.mjs` | Delivered; wording edit planned separately | FR-11 | Evidence-bound notes; v0.3 names are first slice. |
| `tests/distribution/Dockerfile` | Delivered | FR-4, FR-5 | Pinned isolated runtime. |
| `tests/features/plugin-distribution.feature` | Delivered @1; edit planned | FR-1 through FR-13 | Add @2 trust-owner/negative matrix without rewriting historical scenarios. |
| `tests/step-definitions/plugin-distribution.steps.mjs` | Delivered @1; edit planned | FR-1 through FR-13 | Drive @2 distribution-only trust cases on real verifier fixtures. |
| `tests/features/lifecycle-producers.feature` | Delivered | FR-4, FR-7, FR-8 | Real install/reload/upgrade/rollback producer flows. |
| `tests/step-definitions/lifecycle-producers.steps.mjs` | Delivered | FR-4, FR-7, FR-8 | Lifecycle producer bindings. |
| `tests/helpers/release-candidate-world.mjs` | Delivered | FR-4 through FR-13 | Candidate/evidence fixture orchestration. |
| `.github/workflows/verify.yml` | Delivered | FR-9, FR-10, FR-11 | Verify-only PR/push entry. |
| `.github/workflows/distribution-evidence.yml` | Delivered | FR-10, FR-13 | Fixed-workflow evidence subject producer and attestation. |
| `.github/workflows/release.yml` | Delivered | FR-10, FR-11, FR-13 | Tag-commit selection, trust verification, same-digest publish and asset attestation. |
| `docs/omp-v17.3.7-contract.md` | Delivered | FR-2, FR-4, FR-5 | Immutable OMP pin/copy/lifecycle boundary. |
| `docs/validation/release-status-v0.3.2.json` | Delivered | FR-4, FR-7 through FR-13 | Bounded current release/attestation/digest status record. |
| `README.md`, `CHANGELOG.md`, `SECURITY.md` | Delivered current baseline; future edits evidence-gated | FR-4, FR-7 through FR-13 | Public status/history/security policy. |

## Historical and future profile boundary

The v0.1.0 profile correctly forbade MCP. The delivered v0.3.2 profile correctly includes one `.mcp.json`, two launchers and generated kernel/adapters/MCP trees inside the same child. Future generator/evidence/authoring/enforcement capabilities may extend only that one package/server/factory after their product gates; they may not add another marketplace, package, extension/server identity, source workspace, ambient dependency, or raw writer.
