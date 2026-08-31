# File Changes

This is the implementation map for the simplified contract. It does not claim that planned NEXT edits already ship.

| Path | State / action | FR | Purpose |
|---|---|---|---|
| `.omp-plugin/marketplace.json` | SHIPPED; retain | FR-1, FR-7 | Target entry and candidate version. |
| `plugins/omp-spec-kit/package.json` | SHIPPED; retain | FR-1, FR-2, FR-7 | Child version and contained extension entry. |
| `plugins/omp-spec-kit/.mcp.json` | SHIPPED; retain | FR-1, FR-3 | MCP configuration consumed by OMP; no duplicate schema here. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp{,.cmd}` | SHIPPED; retain | FR-3, FR-5 | POSIX/Windows installed launchers. |
| `plugins/omp-spec-kit/dist/**` | Generated SHIPPED payload | FR-2, FR-3, FR-5 | Deterministic installed bytes; never hand-edit. |
| `src/v0.1/**`, `src/kernel/**`, `src/adapters/**`, `src/mcp/**` | SHIPPED sources | FR-2, FR-3, FR-6 | Root sources consumed by the build/runtime owners. |
| `scripts/build-plugin.mjs` | SHIPPED; retain | FR-2, FR-5 | Clean deterministic build and manifest. |
| `scripts/verify-marketplace.mjs` | NEXT simplify | FR-1, FR-7 | Validate only target uniqueness, identity, version, and containment; delegate host parsing. |
| `scripts/verify-package.mjs` | SHIPPED; retain | FR-2, FR-5 | Payload allowlist, digests, dependency absence. |
| `scripts/verify-public-tree.mjs` | SHIPPED; retain | FR-9 | Provenance/license/secret/state/public-path gate. |
| `tests/features/plugin-distribution.feature` and steps | NEXT simplify | FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-9, FR-12, FR-13 | Drive installed distribution behavior without duplicating runtime schemas or @2 trust matrix. |
| `tests/features/lifecycle-producers.feature` and steps | SHIPPED; retain | FR-4, FR-7, FR-8 | Real fresh-session and recovery lifecycle. |
| `scripts/create-distribution-evidence.mjs` | Historical v0.3.2 only | FR-10, FR-11 | Preserve old receipt readback; not a forward release dependency. |
| `.github/workflows/distribution-evidence.yml` | Historical v0.3.2 only | FR-10, FR-11 | Preserve old run identity; next release does not attest an internal subject. |
| `scripts/create-release-evidence.mjs`, `scripts/verify-release.mjs` | NEXT simplify; preserve @1 readers | FR-10, FR-11, FR-12, FR-13 | Remove forward @2/per-FR evaluator and emit compact distribution status after publication. |
| `.github/workflows/verify.yml` | NEXT reuse named checks | FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-12 | Verify-only for PR/push and producer logs. |
| `.github/workflows/release.yml` | NEXT simplify | FR-10, FR-11, FR-12, FR-13 | Consume verified archive digest, publish without rebuild, final-attest public archive once. |
| `docs/validation/release-status-v0.3.2.json` | SHIPPED immutable evidence | FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11 | Historical current-release identity and receipts. |
| future distribution status record | NEXT create per release | FR-11, FR-12, FR-13 | Compact candidate/check/lifecycle/asset/final-attestation result. |

## Historical boundary

v0.1–v0.3.2 evidence files, release assets, tags, and receipts are not deleted or regenerated. Simplifying the forward workflow changes no published digest and does not reinterpret the historical internal evidence attestation as the required next-release trust path.
