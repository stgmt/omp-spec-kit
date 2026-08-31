# Product file ownership

This map records the small product-status surface. Owner specifications retain implementation detail.

## Current product paths

| Path | State | Purpose | Trace |
|---|---|---|---|
| `README.md` | current | Public install identity and concise status. | `product:FR-1`, `product:FR-2`, `product:FR-5` |
| `ROADMAP.md` | current | SHIPPED/NEXT/LATER roadmap. | `product:FR-3`, `product:FR-4`, `product:FR-5` |
| `.specs/product/README.md` | current | Canonical manager-readable product status. | `product:FR-1` through `product:FR-5` |
| `docs/validation/release-status-v0.3.2.json` | immutable current proof | Bounded v0.3.2 release identity and producer receipts. | `product:FR-1`, `product:FR-3` |
| `.omp-plugin/marketplace.json` | current | Single marketplace identity. | `product:FR-2` |
| `plugins/omp-spec-kit/package.json` | current | Single package and extension identity. | `product:FR-2` |
| `CHANGELOG.md` | current | Repository release history; specification edits do not imply a release. | `product:FR-3`, `product:FR-5` |


## Prohibited additions

The product SHALL NOT add a second marketplace, plugin package, extension, public mutation tool beyond `propose_patch` and `apply_proposed_patch`, raw specification writer, user-global secret/state dependency, or alternate product identity.
