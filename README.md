# omp-spec-kit

`omp-spec-kit` is a specification-first project for bringing trustworthy specification inventory, traceability, evidence, and authoring workflows to Oh My Pi (OMP).

## Current status: v0.3.2 published; v0.3.0 MCP advisory remains

v0.3.0 is publicly tagged, but its MCP server can read its package directory rather than the active OMP project. Do not rely on its MCP query results. See the [v0.3.0 MCP advisory](docs/advisories/v0.3.0-mcp-root.md).

v0.3.1 is the first corrective public release. v0.3.2 keeps that fix and publishes only after GitHub Actions proves install, upgrade, rollback, and the release receipts against the exact tagged bytes.

### Current published installation

```text
omp plugin marketplace add stgmt/omp-spec-kit
omp plugin install omp-spec-kit@omp-spec-kit --scope project
```

After installation, reload plugin metadata and start a fresh OMP session. The v0.1 `spec_inventory` tool remains a separate bounded read-only OMP tool.



This initial repository contains:

- an immutable reference snapshot of the upstream `spec-generator-v4` specification;
- a per-file provenance and SHA-256 manifest;
- an explicit ADOPT / REWRITE / DEFER / DROP decision for every upstream functional requirement and major document;
- public contribution, security, licensing, and staged-delivery policies.

## Why start with specifications

The source system is coupled to dev-pomogator's Claude hooks, advisor, local state, backlog, dashboards, persistence, and release machinery. Copying that runtime would create a large product before its public boundary was agreed. This repository instead preserves the source evidence, separates reusable concepts from harness-specific behavior, and stages one independently verifiable OMP product.

## Provenance

The reference snapshot comes only from immutable dev-pomogator commit:

```text
158cd5ccfe4d08625734fc1692d8916cc5838fd6
```

- [`IMPORT_MANIFEST.yaml`](IMPORT_MANIFEST.yaml) records all 27 pinned source paths, per-file SHA-256 values, 24 copied targets, and three intentionally excluded state/test-state files.
- Source-owner license evidence was added later in dev-pomogator commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a` ([PR #232](https://github.com/stgmt/dev-pomogator/pull/232)). Its [`LICENSE`](docs/upstream/dev-pomogator/LICENSE) and [`LICENSE-ATTESTATION.md`](docs/upstream/dev-pomogator/LICENSE-ATTESTATION.md) expressly cover the frozen snapshot subtree; the snapshot commit remains the byte provenance.
- [`MIGRATION_MATRIX.md`](MIGRATION_MATRIX.md) classifies all 86 source functional requirements and every source document.
- [`docs/upstream/dev-pomogator/spec-generator-v4/`](docs/upstream/dev-pomogator/spec-generator-v4/) is provenance reference only. It is not the standalone product's source of truth or release status.

### Publication gate

The historical upstream root-license evidence gap is resolved by the merged source-owner MIT attestation at commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a`, copied byte-for-byte under [`docs/upstream/dev-pomogator/`](docs/upstream/dev-pomogator/). Source-freeze, specification, anchor, secret/public-tree, and complete candidate review are recorded under [`docs/validation/`](docs/validation/). The reviewed initial commit `fe70b10caaed888daf7c48dfc8f1bad9caf45598` is public at [`stgmt/omp-spec-kit`](https://github.com/stgmt/omp-spec-kit); its SHA/tree/readback proof is in [`publication-receipt.md`](docs/validation/publication-receipt.md).

## Delivered baseline and capability map

The public baseline is v0.3.2: one plugin, the v0.2 graph/query kernel, and the eight-tool v0.3 MCP first slice. Its tag, candidate/package/archive digests, lifecycle receipts and GitHub attestation identity are summarized in [`release-status-v0.3.2.json`](docs/validation/release-status-v0.3.2.json).

Post-v0.3 work is a dependency graph, not a linear promise:

| Capability | Owner | Required baseline / gate | Current state |
|---|---|---|---|
| Generator-port reads and adapter I/O | `spec-kernel:FR-16`, `spec-kernel:FR-17` | v0.3 baseline + CHK-FR16-01/CHK-FR17-01 | `SPECIFIED` |
| Editor/MCP-internal LSP | `spec-lsp:FR-1`, `spec-lsp:FR-12` | v0.3 baseline + complete LSP profile | `SPECIFIED` |
| Evidence MCP (`get_test_result`, `get_scenario_trace`) | `spec-evidence:FR-13`, `spec-evidence:FR-14` | v0.3 baseline + evidence aggregate | `SPECIFIED` |
| Capability graph/impact | `spec-capability:FR-6`, `spec-capability:FR-9` | v0.3 baseline + kernel@2/capability profile | `SPECIFIED` |
| Authoring MCP | `spec-authoring-workflow:FR-13`, `spec-authoring-workflow:FR-14` | joint tuple + authenticated tool-call provider/server/schema ABI | `DEFERRED_HOST_ABI` |
| Spec write enforcement | `spec-enforcement:FR-1`, `spec-enforcement:FR-11` | joint tuple + authenticated tool-call provider/server/schema ABI | `DEFERRED_HOST_ABI` |
| Automatic plan approval gate | `plan-gate:FR-1`, `plan-gate:FR-13` | v0.3 baseline + plan-gate aggregate + selected-plan host ABI | `DEFERRED_HOST_ABI` |

No capability row changes the historical v0.3 eight-tool evidence or implies delivery of a sibling capability.

## Repository policy

- New repository-owned material is MIT licensed; see [`LICENSE`](LICENSE).
- Imported material retains the frozen snapshot as byte provenance and uses the separate source-owner MIT attestation as redistribution evidence; future imports still fail closed without their own sufficient license evidence.
- Secrets, credentials, `.env` files, logs, caches, user state, and mutable test evidence must never be imported; see [`SECURITY.md`](SECURITY.md).
- Contributions must preserve the single-plugin direction and specification-first gates; see [`CONTRIBUTING.md`](CONTRIBUTING.md).
