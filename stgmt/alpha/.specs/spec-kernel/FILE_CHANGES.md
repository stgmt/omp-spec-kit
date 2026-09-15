# Planned File Changes

Every path below is a concrete future path and every action is **planned**, not present or implemented. All runtime code stays inside the repository’s single `plugins/omp-spec-kit` child package. No second plugin or marketplace entry is introduced.

## FC-1: Pure kernel contracts and identity

**Action:** create (planned)

**Requirements:** [FR-1](FR.md#fr-1-pure-read-only-kernel-and-adapter-boundary), [FR-2](FR.md#fr-2-supported-documents-and-entity-ids), [FR-3](FR.md#fr-3-canonical-identity-and-deterministic-parsing), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory), [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/types.ts` | Closed `spec-kernel@1`, collision-safe `glfm-anchor@1`, `kernel-release-evidence@1`, stage/profile, per-stage check-set, record binding, and v0.2-lineage types and enums |
| `plugins/omp-spec-kit/src/kernel/identity.ts` | Slug, local, canonical, generated ID validation |
| `plugins/omp-spec-kit/src/kernel/normalize.ts` | Path/content normalization, hashes, canonical JSON |
| `plugins/omp-spec-kit/src/kernel/limits.ts` | Default/hard limit values and explicit validation |

## FC-2: Pure parsers

**Action:** create (planned)

**Requirements:** [FR-2](FR.md#fr-2-supported-documents-and-entity-ids), [FR-3](FR.md#fr-3-canonical-identity-and-deterministic-parsing), [FR-11](FR.md#fr-11-real-fixtures-and-provenance), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/parsers/markdown.ts` | Canonical definitions/references plus complete GLFM heading/anchor/link occurrences, full-prior-anchor-set allocation, and rewrite spans |
| `plugins/omp-spec-kit/src/kernel/parsers/gherkin.ts` | English Gherkin scenarios/tags/steps/examples |
| `plugins/omp-spec-kit/src/kernel/parsers/source-document.ts` | Encoding, filename/kind, hash, size validation |

## FC-3: Graph and diagnostics

**Action:** create (planned)

**Requirements:** [FR-4](FR.md#fr-4-lossless-duplicate-handling), [FR-5](FR.md#fr-5-typed-edge-resolution), [FR-6](FR.md#fr-6-invariants-and-diagnostics), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/graph/build.ts` | Occurrence-first build, unique-node election, heading/link inventory, indexes |
| `plugins/omp-spec-kit/src/kernel/graph/resolve-edges.ts` | Qualification and endpoint-matrix resolution |
| `plugins/omp-spec-kit/src/kernel/graph/invariants.ts` | Cardinality, uniqueness, endpoint, heading/link, and conservation checks |
| `plugins/omp-spec-kit/src/kernel/diagnostics.ts` | Closed diagnostic construction, redaction, ordering |

## FC-4: Query service

**Action:** create (planned)

**Requirements:** [FR-8](FR.md#fr-8-bounded-read-only-query-service), [FR-12](FR.md#fr-12-performance-size-and-result-budgets), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/query/service.ts` | Eight read-only operations and canonical envelope |
| `plugins/omp-spec-kit/src/kernel/query/cursor.ts` | Fingerprint/filter-bound cursor codec |
| `plugins/omp-spec-kit/src/kernel/query/projections.ts` | Full/summary/Markdown-inventory projection, focus relations, totals, and size accounting |

## FC-5: Contained repository reader

**Action:** create (planned)

**Requirements:** [FR-7](FR.md#fr-7-bounded-repository-containment), [FR-12](FR.md#fr-12-performance-size-and-result-budgets)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/adapters/fs/repository-reader.ts` | Explicit-root discovery, lstat/reparse/link refusal, bounded reads |
| `plugins/omp-spec-kit/src/adapters/fs/path-security.ts` | Cross-platform real-root containment and path redaction |

## FC-6: OMP extension integration

**Action:** edit/create (planned)

**Requirements:** [FR-8](FR.md#fr-8-bounded-read-only-query-service), [FR-10](FR.md#fr-10-self-contained-runtime-distribution), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

| Planned path | Action | Responsibility |
|---|---|---|
| `plugins/omp-spec-kit/src/extension.ts` | edit planned | Compose one reader/graph/query service from the existing single extension entry |
| `plugins/omp-spec-kit/src/adapters/omp/register-spec-tools.ts` | create planned | Register read-only OMP tools and project envelopes |
| `plugins/omp-spec-kit/src/adapters/omp/input.ts` | create planned | Transport-only input validation |

## FC-7: v0.3 MCP projection

**Action:** create (planned for v0.3)

**Requirements:** [FR-9](FR.md#fr-9-read-only-mcp-projection-in-v03), [FR-10](FR.md#fr-10-self-contained-runtime-distribution), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/adapters/mcp/server.ts` | One bundled read-only server over shared service |
| `plugins/omp-spec-kit/src/adapters/mcp/tools.ts` | Exact eight-tool mapping, including `spec_markdown_inventory`, no mutations |
| `plugins/omp-spec-kit/.mcp.json` | Nested plugin-root MCP registration when v0.3 is released |

The `.mcp.json` structure SHALL follow https://github.com/can1357/oh-my-pi/blob/main/docs/mcp-config.md and SHALL not be introduced before the v0.3 adapter is implemented and packaged.

## FC-8: Real fixture corpus and manifests

**Action:** create (planned)

**Requirements:** [FR-11](FR.md#fr-11-real-fixtures-and-provenance), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/test/fixtures/real/target-spec-corpus/manifest.json` | Capture provenance, hashes, license, trimming, ground truth |
| `plugins/omp-spec-kit/test/fixtures/real/target-spec-corpus/.specs/sample/FR.md` | Target-owned captured Markdown bytes |
| `plugins/omp-spec-kit/test/fixtures/real/target-spec-corpus/.specs/sample/ACCEPTANCE_CRITERIA.md` | Target-owned captured AC bytes |
| `plugins/omp-spec-kit/test/fixtures/real/target-spec-corpus/.specs/sample/sample.feature` | Target-owned captured Gherkin bytes |
| `plugins/omp-spec-kit/test/fixtures/real/target-spec-corpus/.specs/sample/DESIGN.md` | Target-owned ordinary/duplicate ATX and Setext headings, adversarial `Foo`/`Foo`/`Foo-1` anchor sequences, and inline/reference/autolink destinations |
| `plugins/omp-spec-kit/test/fixtures/real/query-envelopes/manifest.json` | Canonical direct-service transport fixtures |
| `plugins/omp-spec-kit/test/fixtures/generated/benchmark-30-specs.json` | Reproducible scale-generator parameters/seed, explicitly synthetic |

## FC-9: Contract, safety, packaging, and benchmark verification

**Action:** create (planned)

**Requirements:** [FR-1](FR.md#fr-1-pure-read-only-kernel-and-adapter-boundary), [FR-4](FR.md#fr-4-lossless-duplicate-handling), [FR-5](FR.md#fr-5-typed-edge-resolution), [FR-6](FR.md#fr-6-invariants-and-diagnostics), [FR-7](FR.md#fr-7-bounded-repository-containment), [FR-8](FR.md#fr-8-bounded-read-only-query-service), [FR-9](FR.md#fr-9-read-only-mcp-projection-in-v03), [FR-10](FR.md#fr-10-self-contained-runtime-distribution), [FR-12](FR.md#fr-12-performance-size-and-result-budgets), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory), [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/test/kernel/parsers.contract.test.ts` | Real-byte definition/reference/heading/link parser, collision-safe base/base-N anchor allocation, and span contracts |
| `plugins/omp-spec-kit/test/kernel/identity.property.test.ts` | Qualified identity and deterministic ordering |
| `plugins/omp-spec-kit/test/kernel/graph-conservation.test.ts` | Duplicate/reference/document/heading/link conservation and planted failures |
| `plugins/omp-spec-kit/test/kernel/query.contract.test.ts` | Exhaustive eight-operation results/errors/cursors/limits and rename-inventory pages |
| `plugins/omp-spec-kit/test/adapters/repository-containment.test.ts` | Traversal/symlink/junction/reparse/non-regular/budget variants |
| `plugins/omp-spec-kit/test/adapters/mcp-parity.test.ts` | v0.3-only eight-tool adapter-to-service parity and exact read-only registry proof |
| `plugins/omp-spec-kit/test/packaging/dependency-absent.test.ts` | Stage-bound installed-directory runtime without ambient modules; v0.2 excludes MCP and v0.3 includes it |
| `plugins/omp-spec-kit/test/bench/kernel.bench.ts` | Pinned corpus stage-bound latency/memory/response measurement, including MCP-inclusive v0.3 budgets |
| `plugins/omp-spec-kit/test/release/kernel-release-eligibility.test.ts` | Exact v0.2/v0.3 profiles, unknown-stage fail-closed behavior, v0.2-without-MCP positive proof, v0.3 lineage/MCP proof, and one-fault-at-a-time matrices |
| `plugins/omp-spec-kit/test/release/evidence/v0.2/` | Immutable `kernel-v0.2` package, fixture, budget, query, and review inputs keyed by the v0.2 artifact hash; no MCP evidence |
| `plugins/omp-spec-kit/test/release/evidence/v0.3/` | Immutable accepted-v0.2 lineage input plus v0.3 MCP parity/registry, package, fixture, budget, query, and review inputs keyed by the v0.3 artifact hash |

## FC-10: Pure aggregate release evaluator

**Action:** create (planned)

**Requirements:** [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/release/evaluate-kernel-eligibility.ts` | Pure stage/profile selection, accepted-v0.2 lineage re-evaluation, all-not-any evidence validation, and deterministic blocker construction |
| `plugins/omp-spec-kit/src/release/evidence-schema.ts` | `kernel-release-evidence@1` runtime validation with closed `targetStage`/`evidenceProfile` pairs and schema-owned per-stage required checks |

## Excluded file changes

No path is planned for a watcher, SQLite/database index, lock file, `.progress.json`, state/log/evidence writeback, dev-pomogator hook, advisor, judge, backlog, repairer, dashboard, mutation handler, transaction/CAS writer, second plugin, or second extension entry.
