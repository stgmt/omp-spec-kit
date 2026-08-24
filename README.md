# omp-spec-kit

`omp-spec-kit` is a specification-first project for bringing trustworthy specification inventory, traceability, evidence, and authoring workflows to Oh My Pi (OMP).

## Current status: v0.3.0 MCP advisory; v0.3.1 corrective work

v0.3.0 is publicly tagged, but its MCP server can read its package directory rather than the active OMP project. Do not rely on its MCP query results. See the [v0.3.0 MCP advisory](docs/advisories/v0.3.0-mcp-root.md).

v0.3.1 is corrective work in this repository, not a released claim. It will publish only after its exact candidate archive, peeled tag, Docker BDD message artifact, public-safety record, v0.3.0 source proof, upgrade, rollback, and requirement receipts agree.

### Current published installation

```text
omp plugin marketplace add stgmt/omp-spec-kit
omp plugin install omp-spec-kit@omp-spec-kit --scope project
```

After installation, reload plugin metadata and start a fresh OMP session. The v0.1 `spec_inventory` tool remains a separate bounded read-only OMP tool; MCP guidance is in the advisory until v0.3.1 evidence is public.



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

## Planned delivery

The roadmap deliberately keeps one product boundary:

1. public specification and provenance init;
2. v0.1.0 — one installable OMP plugin with a bounded read-only inventory path (released);
3. v0.2 — a standalone graph/query kernel;
4. v0.3.0 — read-only MCP adapter, now superseded for its active-project-root defect;
5. v0.3.1 — corrective launcher, protocol, all-tool BDD, and evidence-bound release candidate (unreleased);
6. later — safe authoring and mutation, only after containment, CAS, concurrency, and evidence gates.

## Repository policy

- New repository-owned material is MIT licensed; see [`LICENSE`](LICENSE).
- Imported material retains the frozen snapshot as byte provenance and uses the separate source-owner MIT attestation as redistribution evidence; future imports still fail closed without their own sufficient license evidence.
- Secrets, credentials, `.env` files, logs, caches, user state, and mutable test evidence must never be imported; see [`SECURITY.md`](SECURITY.md).
- Contributions must preserve the single-plugin direction and specification-first gates; see [`CONTRIBUTING.md`](CONTRIBUTING.md).
