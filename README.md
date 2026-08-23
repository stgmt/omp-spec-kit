# omp-spec-kit

`omp-spec-kit` is a specification-first project for bringing trustworthy specification inventory, traceability, evidence, and authoring workflows to Oh My Pi (OMP).

## Current status: `v0.1.0 RELEASED / SPEC_ONLY+INVENTORY`
**Publication:** `PUBLIC_SPECIFICATION_INIT + v0.1.0 PLUGIN`


**v0.1.0 is released and installable.** It contains exactly one marketplace, one plugin package, and one bounded read-only tool, `spec_inventory`. It does **not** yet contain a graph/query kernel, MCP server, or any write/authoring capability; those remain gated stages below.

### Install v0.1.0

```text
omp plugin marketplace add stgmt/omp-spec-kit
omp plugin install omp-spec-kit@omp-spec-kit --scope project
```

Start a fresh OMP session in your project and call `spec_inventory`. Uninstall with `omp plugin uninstall omp-spec-kit@omp-spec-kit --scope project`. Evidence for this exact artifact: Docker BDD 17/17 scenarios, dependency-absent payload, and the installed lifecycle (install / fresh-session invocation / uninstall / reinstall) bound to release commit `a959a1af3abeb1fc61eefda48b011a6470a6d621` in [`docs/validation/distribution-lifecycle.md`](docs/validation/distribution-lifecycle.md). First release: prior-version upgrade/rollback is inapplicable by contract.



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
4. v0.3 — one MCP adapter over the same query service;
5. later — safe authoring and mutation, only after containment, CAS, concurrency, and evidence gates.

See [`ROADMAP.md`](ROADMAP.md) for stage gates. Released capability is limited to what the evidence receipts cover; see [`CHANGELOG.md`](CHANGELOG.md).

## Repository policy

- New repository-owned material is MIT licensed; see [`LICENSE`](LICENSE).
- Imported material retains the frozen snapshot as byte provenance and uses the separate source-owner MIT attestation as redistribution evidence; future imports still fail closed without their own sufficient license evidence.
- Secrets, credentials, `.env` files, logs, caches, user state, and mutable test evidence must never be imported; see [`SECURITY.md`](SECURITY.md).
- Contributions must preserve the single-plugin direction and specification-first gates; see [`CONTRIBUTING.md`](CONTRIBUTING.md).
