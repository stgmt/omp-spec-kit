# Spec Kernel

## Status

The `spec-kernel@1` v0.2 graph/query runtime and eight-name v0.3 MCP first slice are delivered in public v0.3.2; tag/artifact identities are in `release-status-v0.3.2.json`. The local task/check board conservatively remains `in-progress` until exact per-CHK evidence documents are indexed; generic release status is not substituted. FR-15/16/17 and `spec-kernel@2`/`marksman-anchor@2` are separate planned profiles.

## Product boundary

The kernel turns a bounded snapshot of canonical `.specs/<slug>/` documents into a deterministic in-memory graph, complete versioned Markdown heading/anchor/link occurrences, diagnostics, and bounded query results. It does not watch files, persist indexes, mutate specifications, infer task status from local state, invoke models, or depend on dev-pomogator paths, hooks, databases, logs, dashboards, advisors, backlogs, or status engines.

The architecture has three explicit layers:

1. **Pure kernel** — identity, Markdown/Gherkin parsing, complete heading/link occurrence inventory, graph assembly, invariants, diagnostics, queries over caller-supplied bytes, and pure release-evidence evaluation. It performs no filesystem, clock, environment, network, process, or OMP calls.
2. **Read adapter** — resolves one explicit repository root, enforces containment and limits, rejects symbolic links/junctions/reparse points, and supplies immutable source documents to the kernel.
3. **Host adapters** — the v0.2 OMP extension and optional v0.3 MCP server only validate transport inputs and project the same query service contract. They add no graph semantics and expose no mutation API.

## Release scope

| Stage | Kernel capability |
|---|---|
| v0.2 | Deterministic parsing, qualified identity, collision-safe complete ordinary-or-ID Markdown heading/anchor/link inventory, graph assembly, diagnostics, invariants, and eight bounded read queries in the existing single `omp-spec-kit` plugin. Release profile `kernel-v0.2` is all-not-any over FR-1..FR-8 and FR-10..FR-13 checks, including package, fixture, and v0.2 budget evidence; it excludes and rejects FR-9 evidence and can pass before MCP exists. |
| v0.3 | One bundled, read-only MCP adapter over the exact v0.2 query service; release profile `kernel-v0.3` requires a same-lineage accepted v0.2 input, the complete v0.2 check set, FR-9 adapter parity/exact-registry evidence, and fresh MCP-inclusive package and budget evidence. No second plugin, graph, or control plane. |
| Later, separately specified | Proposals, CAS, writes, repair, archival, persistence, semantic judging, planning, and authoring automation. |

Every manifest and result carries the closed matching pair `targetStage`/`evidenceProfile`. Unknown or mismatched values, wrong release lines, cross-stage records, and absent v0.3 lineage fail closed. Within a recognized profile, one missing or non-passing obligation blocks eligibility.

## Canonical identity

An authored entity has a local ID such as `FR-8` or `AC-8.1`. Runtime identity is always `<spec-slug>:<local-id>`, for example `spec-kernel:FR-8`. A bare local ID resolves only inside its owning spec. Cross-spec references must use the qualified form. Duplicate definitions are preserved as candidates and diagnosed; a map overwrite is forbidden.

## Documents

The kernel recognizes exactly the canonical set listed in [FR-2](FR.md#fr-2-supported-documents-and-entity-ids). Unsupported files are not silently parsed as specification authority. Every heading and semantic link in accepted canonical Markdown is separately inventoried for safe rename planning under [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory), including ordinary non-ID headings. Canonical anchor allocation tests each base/base-N candidate against the complete set of previously emitted anchors, preventing suffix-shaped collisions such as `Foo`/`Foo`/`Foo-1`. See [spec-kernel_SCHEMA.md](spec-kernel_SCHEMA.md) for exhaustive entity, graph, query, result, error, occurrence, and release-evidence fields.

## Traceability

- Functional requirements: [FR.md](FR.md)
- Acceptance criteria: [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)
- Scenario specifications: [spec-kernel.feature](spec-kernel.feature)
- Requirement matrix and checks: [REQUIREMENTS.md](REQUIREMENTS.md)
- Architecture: [DESIGN.md](DESIGN.md)
- Planned implementation files: [FILE_CHANGES.md](FILE_CHANGES.md)
- Fixture provenance: [FIXTURES.md](FIXTURES.md)

## Authority and provenance

These requirements are newly authored for the standalone product. The immutable upstream snapshot is research evidence, not target authority, and no implementation code or compatibility claim is imported. Decisions are grounded in:

- `MIGRATION_MATRIX.md` at source commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`, especially rows FR-2, FR-3, FR-9, FR-13, FR-29, FR-31, FR-36, FR-44, FR-47, FR-61, FR-62, FR-64, FR-67, FR-68, FR-69, FR-70, FR-72, FR-73, FR-74, FR-77, FR-82, and the staged release boundary.
- `IMPORT_MANIFEST.yaml` and `docs/upstream/dev-pomogator/spec-generator-v4/` for pinned local provenance.
- [Public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md) for the original repository-owned boundary and phase sequence; current public-release status is bound separately by `docs/validation/release-status-v0.3.2.json`.
- OMP extension guidance at the implementation pin: https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extensions.md
- OMP MCP configuration at the implementation pin: https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/mcp-config.md

## Explicit exclusions

There are no `create`, `update`, `delete`, `apply`, `repair`, `archive`, `set_status`, `ingest-and-write`, or transaction methods in the v0.2-v0.3 public contract. Parsing a repository produces zero file writes and zero hidden state.
