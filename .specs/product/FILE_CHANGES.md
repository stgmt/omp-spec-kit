# Product file state and future changes

This map separates delivered/current product evidence from future capability work. Presence/status is verified against repository reality and `docs/validation/release-status-v0.3.2.json`; sibling internals remain owned by their specs.

## Delivered/current product paths

| Path | State / action | Purpose | Trace |
|---|---|---|---|
| `README.md` | delivered; edit with evidence | Public v0.3.2 installation/status and capability map. | `product:FR-1`, `product:FR-7`, `product:FR-8` |
| `ROADMAP.md` | delivered; edit per accepted gate | Baseline sequence plus independent post-v0.3 capability DAG. | `product:FR-6`, `product:FR-8`, `product:FR-9` |
| `.specs/product/README.md` | delivered; edit with evidence | Canonical product status/detail. | `product:FR-1`, `product:FR-7` |
| `IMPORT_MANIFEST.yaml` | delivered; provenance-controlled edit | Immutable imported source paths/hashes/dispositions. | `product:FR-2`, `product:FR-3` |
| `MIGRATION_MATRIX.md` | delivered; decision-controlled edit | ADOPT/REWRITE/DEFER/DROP boundary. | `product:FR-2`, `product:FR-8`, `product:FR-9` |
| `docs/decisions/spec-generator-port.md` | delivered; edit with source census | Exact 46-name destination owner/stage table. | `product:FR-9` |
| `docs/decisions/omp-spec-kit-public-init.md` | delivered historical decision | Original public-init sequence and one-product boundary. | `product:FR-1`, `product:FR-8` |
| `docs/upstream/dev-pomogator/LICENSE` | delivered immutable evidence | Imported snapshot license. | `product:FR-2`, `product:FR-3` |
| `docs/upstream/dev-pomogator/LICENSE-ATTESTATION.md` | delivered immutable evidence | Source-owner snapshot coverage. | `product:FR-3` |
| `docs/validation/provenance/dev-pomogator-license-attestation.yaml` | delivered immutable evidence | Bounded attestation identity/hash. | `product:FR-3` |
| `docs/validation/source-freeze.md` | delivered evidence | Independent source reconstruction. | `product:FR-2` |
| `docs/validation/public-safety.md` | delivered evidence | License/allowlist/secret/public-diff review. | `product:FR-3`, `product:FR-4` |
| `docs/validation/spec-review.md` | delivered historical review | Initial trace/semantic/link/public-init review. | `product:FR-1`, `product:FR-8` |
| `docs/validation/publication-receipt.md` | delivered historical evidence | Initial public commit/tree/readback. | `product:FR-1`, `product:FR-4` |
| `docs/validation/release-status-v0.3.2.json` | delivered current evidence | Exact public tag/release/digest/lifecycle/attestation status. | `product:FR-6`, `product:FR-7` |
| `.omp-plugin/marketplace.json` | delivered v0.3.2 | One catalog/plugin identity. | `product:FR-5`, `plugin-distribution:FR-1` |
| `plugins/omp-spec-kit/package.json` | delivered v0.3.2 | One child package/extension/MCP profile identity. | `product:FR-5`, `plugin-distribution:FR-2` |
| `plugins/omp-spec-kit/README.md` | delivered; edit with evidence | Installed scope and v0.3 first-slice wording. | `product:FR-7`, `product:FR-9` |
| `CHANGELOG.md` | delivered; unreleased edits are spec-only until release | Historical releases and current contract repair. | `product:FR-7`, `product:FR-8` |
| `SECURITY.md` | delivered; policy-controlled edit | Public disclosure/prohibited-content policy. | `product:FR-4` |

## Current corpus-repair and ratchet paths

| Path | Action | Purpose | Trace |
|---|---|---|---|
| `scripts/check-spec-generator-port-freeze.mjs` | edit | Source/decision 46-name, first-slice and wording ratchet. | `product:FR-9`, CHK-FR9-01 |
| `scripts/check-spec-corpus.mjs` | edit | 10-spec/150-doc graph, IDs, Marksman anchors, contract markers and status ratchet. | `product:FR-7`, `product:FR-8` |
| `package.json` | edit | Run both ratchets in normal verification before BDD. | `product:FR-7`, `product:FR-9` |
| `docs/validation/spec-corpus-contract-review.md` | edit | Fresh ten-spec review and closure evidence. | `product:FR-7`, `product:FR-8` |

## Future capability-owned paths

These are not delivered by the v0.3.2 baseline and may be added only after their own capability/product gates.

| Path family | Owner | Product gate |
|---|---|---|
| `src/kernel/**`, `src/adapters/**`, `src/mcp/**` extensions | `spec-kernel`, `spec-evidence`, `spec-capability` | Exact independent read/evidence/capability aggregates. |
| `src/lsp/**` | `spec-lsp` | LSP profile; editor/MCP-internal only. |
| `src/authoring/**` | `spec-authoring-workflow` | Joint evidence FR-13/14 + authoring FR-13/14 + enforcement FR-11 tuple for one candidate. |
| `src/enforcement/**` | `spec-enforcement` | The same joint evidence/authoring/enforcement tuple; enforcement cannot deliver alone. |
| `src/gate/**` | `plan-gate` | Manual profile independently; automatic additionally requires selected-plan host ABI. |
| `src/v0.1/extension.js`, `scripts/build-plugin.mjs` | existing integration/build owners | Edit only to integrate an accepted capability into the same factory/package. |

## Prohibited product paths

No capability may add a second marketplace, plugin package, extension/control plane, MCP server identity, raw spec writer, user-global state/credential dependency, unresolved imported runtime, or dev-pomogator harness/advisor/dashboard/backlog runtime.
