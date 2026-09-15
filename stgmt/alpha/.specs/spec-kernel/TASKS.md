# Tasks

All tasks are future implementation work. Status `Planned` means not started and does not imply runtime evidence; no current status is changed here. The shared kernel model preserves both `planned` and `todo`, but the external authoring reducer operates only on `todo | ready | in-progress | blocked | done`; `planned` is non-mutable until a future accepted proposal defines normalization. Mutation/authoring work is not a task in this specification.

## TASK-1: Freeze schema and canonical fixtures

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** none

**Requirements:** [FR-2](FR.md#fr-2-supported-documents-and-entity-ids), [FR-11](FR.md#fr-11-real-fixtures-and-provenance), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory), [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

**Done When:**
- `spec-kernel@1`, `glfm-anchor@1`, and `kernel-release-evidence@1` types, document-role heading productions, shared `TASK.status` including distinct `planned`/`todo`, closed stage/profile/package-surface enums, per-stage check sets, v0.2 baseline binding, inventory/release records, and canonical serialization rules are represented in runtime types without widening.
- The exact current product, plugin-distribution, spec-kernel, and spec-authoring-workflow FR/AC/TASK bytes have complete manifests, hashes, license disposition, and independently reviewed per-document definition/reference/heading/link ground truth.
- Fixture admission refuses missing provenance fields and mismatched bytes; grammar vectors cover FR colon/em-dash title, AC colon/em-dash/bare ID, TASK colon/em-dash title, wrong-document/grouping/arbitrary negatives, and status preservation; release vectors cover both exact stage/package profiles plus unknown/mismatched failures.

## TASK-2: Implement pure normalization and identity

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** TASK-1

**Requirements:** [FR-1](FR.md#fr-1-pure-read-only-kernel-and-adapter-boundary), [FR-3](FR.md#fr-3-canonical-identity-and-deterministic-parsing)

**Done When:**
- Slug, local ID, canonical ID, public path, UTF-8/BOM/line-ending, and content-hash rules match the schema.
- Equivalent source sets in permuted order serialize identically.
- The pure module has no filesystem, clock, environment, network, process, OMP, or MCP imports.

## TASK-3: Implement occurrence-first Markdown and Gherkin parsers

**Status:** Planned

**Estimate:** 4 days

**Owner:** Parser maintainer

**Depends On:** TASK-1, TASK-2

**Requirements:** [FR-2](FR.md#fr-2-supported-documents-and-entity-ids), [FR-3](FR.md#fr-3-canonical-identity-and-deterministic-parsing), [FR-11](FR.md#fr-11-real-fixtures-and-provenance), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

**Done When:**
- The parser selects canonical document role before heading shape, emits every current FR/AC/TASK definition exactly once only from its owning document, preserves `planned` and `todo` distinctly, and retains every ordinary-or-ID GLFM heading plus every inline/reference/autolink use with exact spans.
- `glfm-anchor@1` tests base/base-N candidates against the complete previously emitted canonical-anchor set; the selected ordinal and pairwise-unique anchors for `Foo`/`Foo`/`Foo-1`, `Foo-1`/`Foo`/`Foo`, and equivalent orders match real fixture ground truth.
- Product AC-file FR grouping headings, matrix/reference IDs, wrong-role and arbitrary headings yield no definitions; malformed owning-document forms yield typed diagnostics; all definition/reference/heading/link counts reconcile.

## TASK-4: Build lossless graph and invariants

**Status:** Planned

**Estimate:** 4 days

**Owner:** Graph maintainer

**Depends On:** TASK-3

**Requirements:** [FR-4](FR.md#fr-4-lossless-duplicate-handling), [FR-5](FR.md#fr-5-typed-edge-resolution), [FR-6](FR.md#fr-6-invariants-and-diagnostics), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

**Done When:**
- Duplicate groups preserve every candidate, elect no winner, and make incoming references ambiguous.
- Every reference has exactly one resolved/unresolved outcome and every resolved edge satisfies the endpoint matrix.
- Document, definition, domain-reference, Markdown-heading, Markdown-link, link-outcome, and rewrite-site conservation equations are checked and an injected violation invalidates the snapshot.

## TASK-5: Implement bounded query service

**Status:** Planned

**Estimate:** 4 days

**Owner:** Query maintainer

**Depends On:** TASK-4

**Requirements:** [FR-8](FR.md#fr-8-bounded-read-only-query-service), [FR-12](FR.md#fr-12-performance-size-and-result-budgets), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

**Done When:**
- All eight operations implement their exhaustive inputs, results, errors, ordering, projections, pagination, and limits.
- `markdownInventory` provides complete unscoped and focused ordinary-heading inbound/outbound pages with reconciled totals and shared rewrite sites.
- Cursors bind to graph fingerprint, normalized filters, operation, projection, and stable sort position; normal, boundary, excessive, ambiguous, cancelled, stale-cursor, and oversized-response cases return the specified envelope without graph mutation.

## TASK-6: Implement contained filesystem adapter

**Status:** Planned

**Estimate:** 3 days

**Owner:** Platform security maintainer

**Depends On:** TASK-1, TASK-2

**Requirements:** [FR-7](FR.md#fr-7-bounded-repository-containment), [FR-12](FR.md#fr-12-performance-size-and-result-budgets)

**Done When:**
- One explicit root and only canonical documents are read within every hard input budget.
- Traversal, external absolute paths, symlink, junction, reparse/mount, non-regular, race/change, and OS-failure variants refuse safely on Windows and POSIX.
- Public diagnostics contain no absolute path/OS prose and the adapter creates or changes zero filesystem entries.

## TASK-7: Register the v0.2 OMP query surface

**Status:** Planned

**Estimate:** 2 days

**Owner:** OMP adapter maintainer

**Depends On:** TASK-5, TASK-6

**Requirements:** [FR-1](FR.md#fr-1-pure-read-only-kernel-and-adapter-boundary), [FR-8](FR.md#fr-8-bounded-read-only-query-service), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

**Done When:**
- The single child-plugin extension registers only the specified read operations and uses the shared reader, graph builder, and query service.
- Transport validation does not alter semantic results.
- An installed-directory invocation returns a canonical envelope and changes zero repository bytes.

## TASK-8: Bundle and prove the installed v0.2 artifact

**Status:** Planned

**Estimate:** 3 days

**Owner:** Release maintainer

**Depends On:** TASK-7

**Requirements:** [FR-10](FR.md#fr-10-self-contained-runtime-distribution), [FR-12](FR.md#fr-12-performance-size-and-result-budgets), [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

**Done When:**
- The exact v0.2 artifact contains no undeclared external/runtime dependency and its extension builds a graph and executes a query with source/root dependencies unavailable.
- Required third-party code/data/licenses are fully bundled and inventoried, or the runtime is dependency-free.
- The fresh `CHK-FR10-01` record is bound to `targetStage=v0.2`, `kernel-v0.2`, `packageSurface=OMP_EXTENSION_ONLY`, and the exact v0.2 artifact; v0.2 bundle, latency, memory, response, hard-limit, and complete Markdown inventory measurements meet every NFR budget, and no MCP byte, tool, execution, or evidence is required or accepted.

## TASK-9: Add the v0.3 MCP read projection

**Status:** Planned

**Estimate:** 3 days

**Owner:** MCP adapter maintainer

**Depends On:** TASK-8

**Requirements:** [FR-9](FR.md#fr-9-read-only-mcp-projection-in-v03), [FR-10](FR.md#fr-10-self-contained-runtime-distribution), [FR-12](FR.md#fr-12-performance-size-and-result-budgets), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory), [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

**Done When:**
- One bundled MCP server in the same child plugin exposes exactly the eight named read tools.
- For a common graph/request, each structured canonical envelope equals the direct service result after transport metadata is removed.
- Registry inspection proves no mutation-like tool; a dependency-absent installed smoke proves both extension and MCP server execute the shared kernel from the exact v0.3 artifact; every v0.3 MCP-inclusive size/performance budget remains satisfied.
- Hash-bound v0.3 records for FR-9, stage-bound `CHK-FR10-01` with `packageSurface=OMP_EXTENSION_AND_MCP`, and the MCP-inclusive FR-12 budget gate are available for `kernel-v0.3`; extension-only, v0.2, wrong-profile, or foreign-artifact records are rejected.

## TASK-10: Run adversarial conservation and packaging review

**Status:** Planned

**Estimate:** 2 days

**Owner:** Independent reviewer

**Depends On:** TASK-8

**Requirements:** [FR-4](FR.md#fr-4-lossless-duplicate-handling), [FR-6](FR.md#fr-6-invariants-and-diagnostics), [FR-7](FR.md#fr-7-bounded-repository-containment), [FR-10](FR.md#fr-10-self-contained-runtime-distribution), [FR-11](FR.md#fr-11-real-fixtures-and-provenance), [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory), [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

**Done When:**
- An independent review plants last-writer duplicate, dangling edge, lost domain reference, missing ordinary heading/link occurrence, shared rewrite-site loss, `Foo`/`Foo`/`Foo-1` anchor collision, wrong-document/grouping definition harvest, dropped `todo`, path escape, link, over-budget, ambient dependency, fixture-hash, stage/profile/package-surface, and mandatory-evidence faults and observes explicit failures.
- Document/definition/reference/heading/link conservation totals remain explainable; every current FR/AC/TASK definition occurs exactly once in its owning role, grouping headings occur zero times as definitions, `planned`/`todo` remain distinct, and every emitted canonical anchor is pairwise unique.
- The v0.2 review proves the complete `kernel-v0.2` conjunction and `OMP_EXTENSION_ONLY` FR-10 smoke pass before MCP exists and rejects FR-9/MCP package evidence; the v0.3 review, once TASK-9 evidence exists, proves no pass without an accepted same-lineage v0.2 input and fresh exact-v0.3 `OMP_EXTENSION_AND_MCP` evidence.
- The report distinguishes structural graph validity from aggregate release evidence and records no unexecuted scenario as passing.

## TASK-11: Implement and prove the aggregate kernel release gate

**Status:** Planned

**Estimate:** 2 days

**Owner:** Release maintainer

**Depends On:** TASK-8

**Requirements:** [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

**Done When:**
- The evaluator validates the closed `targetStage`/`evidenceProfile` pairs, candidate release line, per-record stage/artifact binding, and the stage-selected `CHK-FR10-01.packageSurface`, and fails closed for every unknown or mismatched value.
- For v0.2 it derives exactly FR-1..FR-8 and FR-10..FR-13 checks, rejects FR-9 and MCP-inclusive package evidence as wrong-profile, and returns eligible for exactly one hash-valid `PASS` record per required check after the dependency-absent extension smoke without any MCP dependency.
- For v0.3 it re-evaluates an accepted v0.2 input, verifies the declared parent artifact SHA-256, derives the complete v0.2 set plus FR-9, and requires fresh v0.3-bound FR-9 parity/registry, FR-10 `OMP_EXTENSION_AND_MCP` proof for extension plus server from the exact v0.3 artifact, and FR-12 MCP-budget records.
- Candidate artifact/corpus bindings and the FR-10 package, FR-11 fixture, and FR-12 budget gate IDs are verified rather than caller-selected.
- One-fault-at-a-time variants for unknown/mismatched stage/profile/package surface, wrong release line, missing lineage, missing, extra, duplicate, failed, stale, mismatched, waived, partial, unverifiable, empty, bad-hash, and cross-stage evidence each return deterministic blockers and `eligible=false`.
- The result creates no readiness evidence, publication side effect, publication-validation override, or future-import license-gate override.

## Task summary

| Task | Status | Estimate | Owner | Primary output |
|---|---|---:|---|---|
| TASK-1 | Planned | 2 days | Kernel maintainer | Schema and admitted real fixtures |
| TASK-2 | Planned | 2 days | Kernel maintainer | Pure identity/normalization |
| TASK-3 | Planned | 4 days | Parser maintainer | Markdown/Gherkin occurrences |
| TASK-4 | Planned | 4 days | Graph maintainer | Graph, duplicates, invariants |
| TASK-5 | Planned | 4 days | Query maintainer | Eight-operation service and complete Markdown inventory |
| TASK-6 | Planned | 3 days | Platform security maintainer | Contained repository reader |
| TASK-7 | Planned | 2 days | OMP adapter maintainer | v0.2 read surface |
| TASK-8 | Planned | 3 days | Release maintainer | Self-contained v0.2 artifact proof |
| TASK-9 | Planned | 3 days | MCP adapter maintainer | v0.3 projection |
| TASK-10 | Planned | 2 days | Independent reviewer | Adversarial review evidence |
| TASK-11 | Planned | 2 days | Release maintainer | Conjunctive kernel eligibility result |
