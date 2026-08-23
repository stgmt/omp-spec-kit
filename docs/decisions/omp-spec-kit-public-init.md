# OMP Spec Kit Public Initialization Decision

- **Decision status:** Accepted for specification
- **Implementation status:** `SPEC_ONLY / LICENSE_RESOLVED / PUBLIC_INIT_VALIDATED / NON_PUBLIC`
- **Decision scope:** repository initialization, product boundary, import policy, distribution shape, and staged release gates
- **Source snapshot:** `stgmt/dev-pomogator` commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`
- **Source-owner attestation:** commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a`, [PR #232](https://github.com/stgmt/dev-pomogator/pull/232)

## Context

`omp-spec-kit` is a new standalone OMP product, not a new layer inside `dev-pomogator`. The source specification generator is coupled to a broader Claude Code and development harness that includes operational state, watchers, locks, SQLite, repair and backlog flows, model judging, and unrelated tools. Copying that monolith or its Git history would make the new product's boundary, provenance, licensing, and install behavior unverifiable.

The repository therefore begins specification-first. Its initial seed records the product contract, immutable upstream evidence, and migration decisions without claiming that an installable plugin exists. Runtime implementation, marketplace publication, and release tags are later gated outcomes.

## Decision

Create `stgmt/omp-spec-kit` with fresh history as the public home of a single OMP specification product. The repository-owned specifications are the product source of truth. Imported upstream material is retained only as provenance evidence and is never treated as an automatically valid target contract or as proof of implementation.

This decision authorizes creation and push of the reviewed specification-only initial commit. The historical license blocker is resolved and the source-freeze, specification, anchor, and public-safety evidence is recorded under `docs/validation/`; it does not authorize an installable payload or release.

## Product boundary

The canonical product requirements are divided into four repository-owned specifications:

1. `product` — product identity, lifecycle, readiness, and public-stage boundary;
2. `plugin-distribution` — marketplace, package, activation, upgrade, uninstall, and release authority;
3. `spec-kernel` — deterministic specification inventory, parsing, graph, evidence, and bounded read queries;
4. `spec-authoring-workflow` — specification guidance and the separately gated path toward safe proposals and mutation.

The immutable snapshot under `docs/upstream/dev-pomogator/` is a provenance reference only. It does not determine target readiness, release status, package shape, or runtime behavior.

The specification-only public-init milestone deliberately contains no installable catalog, plugin payload, extension, MCP server, release tag, or claim that the product can be installed. Those artifacts may be added only in their later phase after the corresponding aggregate requirement and evidence gate passes.

## Immutable source and provenance

All imported upstream bytes are selected from exactly this source object:

- repository: `https://github.com/stgmt/dev-pomogator.git`;
- commit: `158cd5ccfe4d08625734fc1692d8916cc5838fd6`;
- source subtree: `.specs/spec-generator-v4`;
- extraction rule: Git-object bytes only, never working-tree bytes.

`IMPORT_MANIFEST.yaml` is authoritative for the source path, target path, SHA-256, disposition, import status, and license status of every inventoried file. A copied file is admissible only when its bytes match the recorded source object and SHA-256. A mismatch fails closed; it is not repaired from another checkout or silently reclassified.

No local state, temporary test output, credentials, logs, caches, ignored files, or unrelated repository content may enter the snapshot or public history.

## Import and disposition rules

Every inventoried source file and every migrated requirement receives exactly one disposition with a non-empty rationale:

- **ADOPT** — retain the validated behavior in the standalone product, rewriting only product identity and repository-owned references where necessary;
- **REWRITE** — preserve the accepted intent but author a new standalone contract without `dev-pomogator` paths, harness assumptions, or inherited readiness claims;
- **DEFER** — keep as provenance or future-scope evidence, but exclude it from the current product/release contract until a separate requirement and gate admits it;
- **DROP** — retain no target requirement or runtime obligation; the rationale explains why it is state, obsolete architecture, unrelated scope, or otherwise unsuitable.

Imported documents remain byte-for-byte provenance records. Canonical specifications are authored separately from the migration matrix and must not be created by editing the snapshot. Source BDD scenarios, tests, statuses, and historical completion claims are inputs to review only; they are not target evidence.

The former root-integration architecture for `dev-pomogator` is excluded from the canonical corpus. It cannot be used to infer the standalone repository layout or runtime boundary.

## License and publication blocker

At the frozen snapshot commit, dev-pomogator declared MIT in package and marketplace metadata but had no root `LICENSE` file. That was an unresolved redistribution evidence gap for imported upstream bytes.

The source owner later merged `LICENSE` and `LICENSE-ATTESTATION.md` at commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a` in [PR #232](https://github.com/stgmt/dev-pomogator/pull/232). The attestation expressly covers every included byte at snapshot commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6` under `.specs/spec-generator-v4/**` and licenses it under MIT. Exact copies and SHA-256 hashes are recorded under `docs/upstream/dev-pomogator/`, `IMPORT_MANIFEST.yaml`, and the bounded provenance receipt.

This later evidence resolves the historical license blocker without changing the snapshot's byte provenance, admitting the three excluded mutable state/temp paths, or changing runtime implementation status. The repository is `SPEC_ONLY / LICENSE_RESOLVED / PUBLIC_INIT_VALIDATED / NON_PUBLIC`: the reviewed initial commit may be published, while every runtime, installability, and release claim remains gated separately.

For future or changed imports, the policy remains fail closed:

1. every imported byte requires sufficient redistribution evidence tied to its exact source identity;
2. a repository root license alone does not relabel unknown imported material;
3. package metadata alone or a secret scan is insufficient when source ownership or scope is ambiguous;
4. any file with unknown rights or a secret finding remains excluded from publication until resolved or removed/replaced.

## One-marketplace, one-plugin, one-extension invariant

When distribution work is admitted, the repository will contain one OMP marketplace catalog with exactly one plugin entry, pointing to one child package:

- preferred catalog: `.omp-plugin/marketplace.json`;
- marketplace identity: `omp-spec-kit`;
- child source: `./plugins/omp-spec-kit`;
- installed identity: `omp-spec-kit@omp-spec-kit`;
- child package: `plugins/omp-spec-kit`;
- runtime cardinality: exactly one `omp.extensions` entry.

Skills, commands, read tools, future graph queries, and any later MCP adapter remain capabilities of that same child plugin. They do not create a second marketplace entry, second plugin package, second extension entry, or independent specification engine. Catalog version, child-package version, and release tag must identify the same explicit semantic version.

A planted second catalog entry or extension entry is a mandatory negative release test and must fail the gate.

## Read-only-first kernel

The first useful runtime slice is bounded and read-only:

- `v0.1.0` provides one specification inventory/diagnostic path from the installed child package;
- it returns actionable results for absent or malformed specification roots;
- it performs zero writes to the user's repository and creates no hidden state;
- it is bundled so it does not depend on a source checkout or incidental root `node_modules`;
- install, invocation, and uninstall must preserve user specification bytes.

The standalone graph kernel follows in `v0.2` inside the same plugin. Its admitted scope is typed identities, selected Markdown/Gherkin/task/evidence parsing, deterministic in-memory graph construction, provenance, conformance findings, and bounded read queries. Safe rename support requires a complete heading, anchor, and link-occurrence inventory plus a query that identifies every affected occurrence before any mutation can be proposed.

Watchers, persistence, mutation, and repair are not shortcuts into the read-only phases. Writer capabilities require separately reviewed authoring requirements, proposal/dry-run behavior, expected-hash or CAS refusal, path and symlink containment, atomic commit/rollback, concurrent-session tests, audit/privacy policy, and failure recovery.

## Exact phase sequence

Phases are strictly ordered; a later phase cannot supply missing evidence for an earlier gate.

1. **Freeze source provenance.** Pin the immutable source object, inventory the source subtree, record hashes and dispositions, and reject working-tree exports.
2. **Seed the repository-owned specification corpus.** Preserve the immutable upstream reference; author the four canonical target specifications and public policies; keep the repository explicitly non-installable.
3. **Validate the public-init seed.** The license-evidence gate is resolved; complete the remaining independent source-freeze, structural, anchor, traceability, semantic, migration, secret, and public-tree review before any publication.
4. **Publish specification-only public init.** Create public history only after Phase 3 passes; do not include a marketplace catalog or imply an installable release.
5. **Build and verify the `v0.1.0` candidate.** Add the single marketplace/plugin/extension shape, the bundled read-only inventory capability, and user guidance; produce candidate-bound lifecycle evidence without treating a passing stage or job as release proof.
6. **Release `v0.1.0`.** Release only when `plugin-distribution:FR-13` reports eligible from complete current mandatory `plugin-distribution:FR-1` through `plugin-distribution:FR-12` evidence for the same candidate identity, including version consistency, clean project-scope installation, reload, fresh-session invocation, uninstall with fresh-session absence and user-spec preservation, and reinstall of the exact same `v0.1.0` candidate artifact with fresh-session invocation. Prior-version upgrade and rollback are inapplicable to this first release.
7. **Build and verify `v0.2`.** Extract the typed deterministic kernel and expose bounded read-only graph/status/query capabilities through the existing extension and shared query service. Its stage gate uses the `v0.2` profile of `spec-kernel:FR-14`, excludes `v0.3`-only MCP-adapter evidence, and also requires every earlier aggregate gate to remain accepted for the same lineage.
8. **Build and verify `v0.3`.** Add at most one bundled plugin-root MCP adapter over the same query service, with installed-artifact startup and response-parity evidence. Its stage gate uses the `v0.3` profile of `spec-kernel:FR-14`, includes the MCP-adapter evidence, and also requires every earlier aggregate gate to remain accepted for the same lineage.
9. **Consider later authoring and mutation releases.** Admit guidance, proposals, CAS, atomic mutation, archival, repair, backlog, judging, or persistence only through separate specifications and release gates; no writer is implied by this decision.

## Release and stage gates

### Public-init gate

Publication requires all of the following:

- every copied byte matches the immutable source object and manifest hash;
- every imported file and migrated requirement has an explicit disposition and rationale;
- the four canonical specifications pass structural, anchor, traceability, and semantic review;
- public-tree review finds no credentials, local state, logs, caches, temporary evidence, or private paths;
- redistribution rights for imported bytes are established and recorded;
- repository-facing material says that the seed is specification-only and not installable.

### `v0.1.0` gate

Release requires `plugin-distribution:FR-13` to report eligible from complete current mandatory evidence for `plugin-distribution:FR-1` through `plugin-distribution:FR-12`, including:

- exactly one catalog entry, child plugin, and extension entry;
- dependency-safe execution from the installed artifact;
- marketplace add/discovery, project-scope install, plugin listing, reload, and fresh-session activation;
- real invocation of the bounded inventory capability;
- actionable absent/malformed-input behavior and zero repository writes;
- project-scope uninstall with fresh-session absence and preservation of user specification hashes;
- reinstall of the exact same `v0.1.0` candidate artifact with fresh-session invocation;
- failure of planted cardinality violations.

Every receipt must be current, passed, mutually consistent, and bound to the same commit, OMP pin, platform fixture, catalog digest, artifact digest, and candidate version. Prior-version upgrade and rollback receipts are inapplicable to `v0.1.0`; they are not missing evidence.

### Subsequent release distribution gate

Beginning with the first release after `v0.1.0`, `plugin-distribution:FR-13` retains the candidate uninstall and exact-artifact reinstall evidence and additionally requires passed upgrade-from-prior and rollback-to-prior receipts. The receipts and all earlier aggregate gates must remain accepted for the same lineage; partial stage or job success cannot substitute for the aggregate result.

### `v0.2` kernel gate

Release of `v0.2` additionally requires `spec-kernel:FR-14` to accept its complete mandatory `v0.2` profile: typed deterministic outputs, qualified identity and collision refusal, endpoint and malformed-input diagnostics, provenance and conservation counts from real producer fixtures, complete safe-rename inventory/query behavior, bounded queries, and no operational or writer dependency. `v0.3`-only MCP-adapter evidence is inapplicable to this profile and cannot supply missing `v0.2` evidence.

### `v0.3` MCP gate

Release of `v0.3` additionally requires `spec-kernel:FR-14` to accept its complete mandatory `v0.3` profile, including installed-artifact MCP startup, bounded output/errors, and response parity with the shared query service, while every earlier aggregate gate remains accepted for the same lineage.

### Authoring gate

Any authoring release requires complete mandatory evidence for `spec-authoring-workflow:FR-13` and every earlier applicable aggregate gate for the same lineage. Guidance alone does not authorize mutation. A writer remains blocked until containment, authorization, proposal/dry-run, CAS, atomicity, rollback, concurrency, audit, privacy, and recovery evidence is complete.

A structural pass, generated scaffold, or historical upstream test result never satisfies a release gate. Evidence must exercise the built artifact and the exact stage contract.

## Excluded monolith subsystems

The following `dev-pomogator` concerns are excluded from initial extraction and cannot be copied as incidental dependencies:

- broad Claude Code plugin manifests, hooks, commands, skills, and compatibility catalog;
- advisor and model-judge services;
- watcher and daemon lifecycles;
- file locks, transaction coordinators, and mutation engines;
- SQLite, persistent state, local evidence stores, caches, and logs;
- repair, archive, backlog, planner, conflict-graph, and auto-commit systems;
- statusline, proxy, context/memory, browser, dashboard, and generic harness features;
- a second MCP server or registry that duplicates the plugin query service;
- the full `dev-pomogator` Git history or runtime import closure.

A later phase may admit one of these concerns only when a repository-owned specification explains why it belongs in the same product and its independent entry and release gates pass.

## Official OMP references

The distribution and runtime decisions follow these official OMP sources:

- [Marketplace catalog path, plugin source schema, installation lifecycle, and updates](https://github.com/can1357/oh-my-pi/blob/main/docs/marketplace.md)
- [Official mini-marketplace layout with a child plugin package](https://github.com/can1357/oh-my-pi/tree/main/docs/skills/examples/mini-marketplace)
- [Extension factory, registration API, and load/runtime boundary](https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md)
- [Extension discovery and factory resolution](https://github.com/can1357/oh-my-pi/blob/main/docs/extension-loading.md)
- [Plugin MCP configuration and nested `mcpServers` shape](https://github.com/can1357/oh-my-pi/blob/main/docs/mcp-config.md)

These mutable documentation URLs justify the repository design. Each implementation and release must additionally pin the exact OMP release or commit it verifies; mutable `main` documentation alone is not release evidence.

## Consequences

The repository can expose a reviewable product contract before runtime work while remaining honest about readiness. Provenance and licensing are fail-closed, and the product cannot accidentally expand into a copy of the source monolith. The cost is deliberate staging: public init, installation, kernel extraction, MCP transport, and mutation cannot be collapsed into one nominally green milestone.

This record authorizes the sequence and boundaries only. It does not assert that publication, installation, runtime behavior, or any release gate has completed.
