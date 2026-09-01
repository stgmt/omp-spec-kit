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

---

## Product lifecycle domain (merged)

This map records the small product-status surface. Owner specifications retain implementation detail.

## Current product paths

| Path | State | Purpose | Trace |
|---|---|---|---|
| `README.md` | current | Public install identity and concise status. | `plugin-distribution:FR-14`, `plugin-distribution:FR-15`, `plugin-distribution:FR-18` |
| `README.md` | current | SHIPPED/NEXT/LATER roadmap. | `plugin-distribution:FR-16`, `plugin-distribution:FR-17`, `plugin-distribution:FR-18` |
| `README.md` | current | Canonical manager-readable product status. | `plugin-distribution:FR-14` through `plugin-distribution:FR-18` |
| `docs/validation/release-status-v0.3.2.json` | immutable current proof | Bounded v0.3.2 release identity and producer receipts. | `plugin-distribution:FR-14`, `plugin-distribution:FR-16` |
| `.omp-plugin/marketplace.json` | current | Single marketplace identity. | `plugin-distribution:FR-15` |
| `plugins/omp-spec-kit/package.json` | current | Single package and extension identity. | `plugin-distribution:FR-15` |
| `CHANGELOG.md` | current | Repository release history; specification edits do not imply a release. | `plugin-distribution:FR-16`, `plugin-distribution:FR-18` |


## Prohibited additions

The product SHALL NOT add a second marketplace, plugin package, extension, public mutation tool beyond `propose_patch` and `apply_proposed_patch`, raw specification writer, user-global secret/state dependency, or alternate product identity.

---

## MCP release-integrity domain (merged)

| Path | Action | Reason |
|---|---|---|
| `plugins/omp-spec-kit/.mcp.json` | edit | Keep package-relative command with active-project cwd behavior for FR-19. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp` | edit | Launch the packaged server without choosing the data root. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp.cmd` | edit | Preserve the same Windows installed behavior. |
| `src/adapters/query-service.js` | edit | Create the shared canonical root context, opaque root identities, provenance projection, and mismatch visibility for every query result. |
| `src/mcp/server.js` | edit | Pass one startup root context to the stdio server and retain the exact eight-tool protocol surface. |
| `src/v0.1/extension.js` | edit | Give legacy inventory and the seven query tools the same resolved root context. |
| `src/v0.1/inventory.js` | edit | Carry the shared server/root provenance in the legacy inventory result without absolute-path disclosure. |
| `src/adapters/tool-contracts.js` | edit | Keep the exact historical v0.3.2 eight-tool table while exposing the provenance-bearing result contract. |
| `scripts/docker-bdd.sh` | edit | Produce and atomically promote only successful unfiltered real Cucumber Messages. |
| `tests/helpers/mcp-world.mjs` | edit | Drive copied installed package, raw frames, provenance, corpus snapshots, and all eight handlers. |
| `tests/step-definitions/mcp-release-integrity.steps.mjs` | edit | Implement FR-19 through FR-21 and FR-25 black-box root/provenance scenarios. |
| `tests/features/spec-mcp.feature` | edit | Assert the built extension/MCP envelope contract and provenance on the real package surface. |
| `tests/helpers/release-candidate-world.mjs` | edit | Drive one compact MRI run and same-byte candidate checks. |
| `scripts/create-release-candidate.mjs` | edit | Assemble deterministic contained clean-tag bytes. |
| `scripts/verify-public-tree.mjs` | edit | Enforce no-credential outcome with redacted findings. |
| `scripts/verify-release.mjs` | edit | Consume one MRI run and native attestation result; remove nested authority lattices. |
| `.github/workflows/verify.yml` | edit | Run the candidate profile and retain its exact artifacts. |
| `.github/workflows/release.yml` | edit | Download, re-hash, and publish the verified archive without rebuild. |
| `scripts/render-release-notes.mjs` | edit | Render claims only from verified current candidate identities. |
| `docs/validation/release-status-v0.3.2.json` | edit | Keep immutable historical evidence reader compatibility; do not rewrite recorded bytes. |
| `docs/advisories/v0.3.0-mcp-root.md` | edit | Retain reversible recovery guidance. |
| `README.md` | edit | Keep current v0.3.2 and fresh-session guidance accurate. |
| `plugins/omp-spec-kit/README.md` | edit | Keep installed package guidance accurate. |
| `CHANGELOG.md` | edit | Preserve v0.3.0/v0.3.1/v0.3.2 history. |