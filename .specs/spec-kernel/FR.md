# Functional Requirements

All runtime identities in this specification use `<spec-slug>:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status.

## FR-1: Pure read-only kernel and adapter boundary

The v0.2 kernel SHALL be a pure function of caller-supplied `SourceDocument[]`, `KernelLimits`, and `QueryRequest`. It SHALL NOT read or write the filesystem, observe the clock/environment/process/network, start watchers, persist caches or indexes, or call OMP/MCP APIs. Filesystem, OMP, and MCP behavior SHALL exist only in adapters. Every v0.2-v0.3 public operation SHALL be read-only; mutation, proposal, CAS, repair, archival, status transition, evidence writeback, and transaction APIs SHALL be absent.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-kernel-has-no-side-effects)

**Scenario:** `@feature1` / `SCEN-pure-read-only-boundary`

**Sources:** `MIGRATION_MATRIX.md` rows FR-2, FR-39, FR-40, FR-48; `docs/upstream/dev-pomogator/spec-generator-v4/DESIGN.md` is provenance for the mixed historical boundary, not target architecture.

## FR-2: Supported documents and entity IDs

The kernel SHALL recognize exactly these canonical documents inside `.specs/<slug>/`: `README.md`, `USER_STORIES.md`, `USE_CASES.md`, `RESEARCH.md`, `REQUIREMENTS.md`, `FR.md`, `NFR.md`, `ACCEPTANCE_CRITERIA.md`, `DESIGN.md`, `TASKS.md`, `FILE_CHANGES.md`, `CHANGELOG.md`, `<slug>.feature`, `FIXTURES.md`, and `<slug>_SCHEMA.md`. Definition recognition SHALL be document-role-aware before heading matching: only `FR.md` may define `FR-N`, only `ACCEPTANCE_CRITERIA.md` may define `AC-N.M`, and only `TASKS.md` may define `TASK-N`. `FR.md` SHALL admit exactly level-2 colon-title and em-dash-title FR headings; `ACCEPTANCE_CRITERIA.md` SHALL admit level-2/3 colon-title, em-dash-title, and bare exact AC headings; `TASKS.md` SHALL admit exactly level-2 colon-title and em-dash-title task headings. Same-looking headings in other documents, arbitrary/group headings, matrices, and narrative bare tokens SHALL remain heading/reference prose and SHALL NOT become definitions. The other document-role mappings and local-ID grammars remain the closed set in `spec-kernel_SCHEMA.md`; explicit Gherkin `@id:SCEN-<slug>` tags define Scenario IDs. Generated document and file nodes SHALL use `DOC:<canonical-filename>` and `FILE:<normalized-repository-relative-path>`.

Shared `TASK.status` SHALL preserve both `planned` and `todo` as distinct values; canonical-corpus `Planned`, `todo`, and `Completed` spellings normalize to `planned`, `todo`, and `done`. The kernel SHALL NOT run an authoring reducer or coerce one state into another. The external authoring reducer contract is restricted to `todo | ready | in-progress | blocked | done`; `planned` remains non-mutable until a future accepted proposal defines explicit normalization.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-canonical-document-and-id-grammar)

**Scenario:** `@feature2` / `SCEN-supported-documents-and-ids`

**Sources:** `MIGRATION_MATRIX.md` rows FR-47, FR-57, FR-64, FR-72; source-document disposition table.

## FR-3: Canonical identity and deterministic parsing

The spec slug SHALL match `[a-z0-9]+(?:-[a-z0-9]+)*` and come only from the immediate directory under `.specs/`. Each valid definition SHALL receive canonical identity `<spec-slug>:<local-id>`. Bare IDs SHALL resolve only in their source spec; cross-spec references SHALL use the qualified form. Parsing SHALL normalize path separators to `/`, Unicode to NFC, UTF-8 BOM away, and line endings to LF; sort source paths by Unicode code point; use no locale or timestamp input; preserve repository-relative source spans; and compute the graph fingerprint from sorted normalized paths, raw content hashes, schema version, and limits. Equivalent input sets in any arrival order SHALL serialize identically.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-qualified-identity-and-reproducible-snapshot)

**Scenario:** `@feature3` / `SCEN-qualified-deterministic-snapshot`

**Sources:** `MIGRATION_MATRIX.md` rows FR-3, FR-36, FR-62, FR-67.

## FR-4: Lossless duplicate handling

The parser SHALL accumulate all definition occurrences before creating the unique node index. If one canonical ID has more than one valid definition candidate, the graph SHALL preserve every candidate and emit `DUPLICATE_DEFINITION`; it SHALL NOT select a winner or insert that identity into `nodes`. Any reference to the ambiguous identity SHALL remain unresolved with `AMBIGUOUS_TARGET`. `getNode` SHALL return `AMBIGUOUS_ID` with bounded, stable candidate summaries. Duplicate definitions in different specs SHALL not conflict because their canonical identities differ.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-duplicates-never-overwrite-source-occurrences)

**Scenario:** `@feature4` / `SCEN-lossless-duplicates`

**Sources:** `MIGRATION_MATRIX.md` row FR-36; `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4_SCHEMA.md` historical duplicate invariant.

## FR-5: Typed edge resolution

The builder SHALL retain every parsed reference occurrence and resolve it only to an unambiguous canonical node. Supported edge types SHALL be `REFS`, `COVERS`, `TESTED_BY`, `IMPLEMENTS`, `DEPENDS_ON`, `DOCUMENTS`, and `DECLARES`. Edge endpoint kind pairs SHALL follow the closed matrix in `spec-kernel_SCHEMA.md`. Markdown links and structured fields (`Refs`, `Related`, `Covers`, `Implements`, `Depends On`) MAY create references; Gherkin `@featureN`, `@AC-N.M`, and qualified reference fields MAY create trace edges. A missing, malformed, ambiguous, forbidden-kind, or unqualified cross-spec target SHALL produce one typed unresolved reference and SHALL NOT produce a dangling edge.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-every-reference-has-one-explicit-outcome)

**Scenario:** `@feature5` / `SCEN-edge-resolution-outcomes`

**Sources:** `MIGRATION_MATRIX.md` rows FR-29, FR-44, FR-46, FR-67, FR-68, FR-69, FR-73, FR-74.

## FR-6: Invariants and diagnostics

Every graph build SHALL evaluate cardinality, uniqueness, endpoint, containment, and conservation invariants. At minimum: canonical nodes are unique; each resolved edge has two existing permitted endpoints; each definition occurrence is exactly one of unique-node, ambiguous-candidate, or rejected-definition; each domain reference occurrence is exactly one of resolved-edge or unresolved-reference; every accepted GLFM heading has one heading occurrence; every semantic GLFM link use has one internal-heading, internal-document, external, or unresolved outcome; document counts reconcile with accepted plus rejected documents; all public arrays and diagnostics have deterministic ordering; and any ERROR makes `graph.valid=false`. Diagnostics SHALL use the exhaustive fields and closed codes in `spec-kernel_SCHEMA.md`, contain repository-relative paths only, and never convert a structural parse into a readiness or passing-test claim.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-cardinality-and-conservation-fail-closed)

**Scenario:** `@feature6` / `SCEN-conservation-and-fail-closed-diagnostics`

**Sources:** `MIGRATION_MATRIX.md` rows FR-37, FR-44, FR-56, FR-57, FR-63, FR-64, FR-67; `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4_SCHEMA.md` general invariants.

## FR-7: Bounded repository containment

The filesystem adapter SHALL accept one explicit repository root and SHALL inspect only `.specs/<valid-slug>/` canonical document names. It SHALL resolve and retain the root once, reject absolute external paths, traversal, path aliases that escape the root, non-regular files, and every symbolic link, junction, mount/reparse point, or linked ancestor before opening target bytes. It SHALL apply file count, spec count, per-file byte, aggregate byte, path length, diagnostic, and time/cancellation limits. It SHALL return repository-relative paths and sanitized OS failures. It SHALL create no files or directories and SHALL not fall back to plugin-cache paths, source checkout paths, environment heuristics, stdin inheritance, or dev-pomogator state.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-unsafe-or-over-budget-trees-are-refused)

**Scenario:** `@feature7` / `SCEN-contained-reader-rejects-links`

**Sources:** `MIGRATION_MATRIX.md` rows FR-62, FR-70, FR-74; `docs/upstream/dev-pomogator/spec-generator-v4/REQUIREMENTS.md` CHK-FR70-07.

## FR-8: Bounded read-only query service

v0.2 SHALL expose one shared pure query service with operations `inventory`, `getNode`, `findNodes`, `getEdges`, `trace`, `diagnostics`, `overview`, and `markdownInventory`. These eight are the **first slice**. Additional generator-port reads are [FR-16](FR.md#fr-16-generator-port-read-operations-beyond-the-eight) and are not v0.2 mandatory members. Every request and response SHALL use the exhaustive versioned schema in `spec-kernel_SCHEMA.md`; validate operation-specific parameters; enforce default/hard limits, traversal depth, visited-node, text, diagnostic, heading/link-occurrence, and cursor bounds; return stable ordering and opaque fingerprint-bound cursors; and use one success/error envelope. The service SHALL query an immutable graph only and SHALL expose no operation whose name or effect mutates repository, graph, evidence, task status, or lifecycle state.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-all-query-operations-are-bounded-and-stable)

**Scenario:** `@feature8` / `SCEN-bounded-query-service`

**Sources:** `MIGRATION_MATRIX.md` rows FR-61, FR-82 and staged release boundary; [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), exact phase sequence and v0.2 kernel gate.

## FR-9: Read-only MCP projection in v0.3

v0.3 MAY expose the v0.2 service through one bundled MCP server in the same `omp-spec-kit` child plugin. The **v0.3 first slice** SHALL map `spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory` one-to-one. Additional [FR-16](FR.md#fr-16-generator-port-read-operations-beyond-the-eight) query operations and [FR-17](FR.md#fr-17-mcp-adapter-document-and-preflight-io-not-a-v02v03-release-member) adapter I/O SHALL be projected onto MCP as they land so the **agent sees only MCP** (the spec-generator door); they are not `kernel-v0.3` required-check members. The v0.3 first-slice read registry SHALL contain no mutation, proposal, apply, repair, archive, status-transition, or write tool. MCP absence or failure SHALL not create a second graph. LSP SHALL NOT be an agent-visible spec tool.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-mcp-is-a-semantic-free-read-projection)

**Scenario:** `@feature9` / `SCEN-mcp-read-projection-only`

**Sources:** `MIGRATION_MATRIX.md` rows FR-4, FR-38, FR-82; [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), exact phase sequence; https://github.com/can1357/oh-my-pi/blob/main/docs/mcp-config.md.

## FR-10: Self-contained runtime distribution

`CHK-FR10-01` SHALL be interpreted by its bound `targetStage` and matching evidence profile. For `v0.2`/`kernel-v0.2`, it SHALL prove only that the dependency-absent installed v0.2 OMP extension package builds a graph and executes a query with no source checkout or external/root `node_modules`; no MCP server byte, execution, or evidence is required or accepted. For `v0.3`/`kernel-v0.3`, a fresh record SHALL prove that both the OMP extension and MCP server execute the same bundled kernel and schema from the exact installed v0.3 artifact under the same dependency-absent conditions. Runtime implementation SHALL either use no third-party dependencies or fully bundle every non-OMP dependency and required data/license, and SHALL use no unresolved dynamic imports, post-install compilation/downloads, native addons, or absolute build-machine paths. A record with the wrong stage, profile, package surface, release line, or artifact binding SHALL fail closed and SHALL NOT be reused across profiles.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-installed-artifact-has-no-ambient-dependency)

**Scenario:** `@feature10` / `SCEN-self-contained-artifact`

**Sources:** [Public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), read-only-first kernel and release gates; https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md.

## FR-11: Real fixtures and provenance

Every executable parser/graph fixture SHALL originate from actual bytes emitted by or stored in an identified producer/source, be immutable, and record fixture ID, capture command/method, producer and version/commit, source path or URL, capture date, SHA-256, byte count, license disposition, permitted trimming, and human-reviewed ground truth. Ground truth SHALL include document, definition, domain-reference, Markdown-heading, Markdown-link, rewrite-site, and outcome counts plus expected resolved/unresolved/diagnostic results so every conservation equation can be reconciled. Synthetic fixtures MAY be used only for generated scale or minimal negative variants and SHALL be labeled synthetic. The pinned upstream snapshot MAY seed research and capture candidates but SHALL not be copied into test fixtures until its manifest license gap is resolved; target-owned captures are preferred.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fixtures-are-real-hashed-and-reconciled)

**Scenario:** `@feature11` / `SCEN-real-fixture-provenance`

**Sources:** `MIGRATION_MATRIX.md` rows FR-31 and FR-64; `IMPORT_MANIFEST.yaml`; `docs/upstream/dev-pomogator/spec-generator-v4/FIXTURES.md`.

## FR-12: Performance, size, and result budgets

The kernel and adapters SHALL enforce the concrete budgets in `NFR.md`: benchmark corpus shape, cold-build latency, query latency, incremental memory, installed bundle size, maximum accepted corpus/file/path sizes, result/page/traversal limits, diagnostic caps, cancellation checks, and serialized response size. Measurements SHALL report runtime/OS/CPU, corpus fingerprint, warm-up, sample count, percentiles, artifact hash, and raw observations. An exceeded hard limit SHALL return `LIMIT_EXCEEDED` or refuse release; it SHALL not silently truncate except where the schema explicitly returns `truncated=true`, `nextCursor`, and conservation-visible totals.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-budgets-are-measured-enforced-and-visible)

**Scenario:** `@feature12` / `SCEN-performance-and-size-budgets`

**Sources:** [Public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), v0.2 kernel gate; `docs/upstream/dev-pomogator/spec-generator-v4/FR.md` historical two-second 30-spec benchmark is provenance only.

## FR-13: Complete Markdown heading, anchor, and link inventory

For every accepted canonical Markdown document, the kernel SHALL preserve exactly one `MarkdownHeadingOccurrence` for every GLFM ATX level 1–6 or Setext level 1–2 heading outside code, including headings with no specification ID. Each occurrence SHALL carry the versioned `glfm-anchor@1` base-anchor derivation, selected duplicate ordinal, unique canonical anchor, exact heading and section spans, and rendered plain text. Headings SHALL be processed in document order. For each heading, the allocator SHALL test `baseAnchor` for ordinal zero and `baseAnchor-N` for increasing integer ordinals against the complete set of canonical anchors already emitted for that document, select the smallest unused candidate, and add it to that set before processing the next heading. It SHALL NOT count only prior headings with the same base. Thus rendered headings `Foo`, `Foo`, `Foo-1` SHALL emit `foo`, `foo-1`, `foo-1-1`; equivalent adversarial orders such as `Foo-1`, `Foo`, `Foo` SHALL also remain pairwise unique.

The kernel SHALL also preserve every parsed GLFM link occurrence—inline, full/collapsed/shortcut reference, and autolink—with its use span, exact destination rewrite span/key, enclosing source heading when present, raw and normalized destination, and exactly one `INTERNAL_HEADING | INTERNAL_DOCUMENT | EXTERNAL | UNRESOLVED` outcome. Reference-style uses that share one definition destination SHALL remain separate link occurrences while sharing the same rewrite key.

The `markdownInventory` query SHALL expose the exhaustive versioned request, result, pagination, focus/direction, summary, total, and error fields in `spec-kernel_SCHEMA.md`. An unscoped query SHALL enumerate every heading and link occurrence; a focused `{path, canonicalAnchor}` query SHALL return the exact ordinary-or-ID heading plus every inbound link to it and every outbound link in its section, without converting headings into domain nodes. Results SHALL be fingerprint-bound, stably ordered, and complete across the returned cursor chain. Response limits MAY split the inventory into explicit pages but SHALL NOT silently omit, coalesce, or deduplicate occurrences. Heading/link counts and link-outcome counts SHALL satisfy the schema conservation equations before any rename plan may claim completeness. This requirement is read-only and authorizes no rename or mutation.

Historical `spec-kernel@1` SHALL retain `glfm-anchor@1`, its exact carriers/cursors and mandatory `CHK-FR13-01`. Future `spec-kernel@2` SHALL use `marksman-anchor@2`, emit the complete legacy→current migration table, and release only through `kernel-anchor-migration@1` / `CHK-FR13-02`. The two checks, graphs, cursors and fingerprints SHALL never substitute for one another.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-safe-rename-inventory-is-complete-and-conserved)

**Scenario:** `@feature13` / `SCEN-complete-markdown-rename-inventory`

**Sources:** [Public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), read-only-first kernel and v0.2 kernel gate.

## FR-14: Conjunctive kernel release eligibility

The pure kernel release evaluator SHALL consume the versioned mandatory-evidence manifest plus caller-supplied immutable evidence bytes defined in `spec-kernel_SCHEMA.md`. The manifest SHALL declare a closed `targetStage` and matching `evidenceProfile`: `v0.2` with `kernel-v0.2`, or `v0.3` with `kernel-v0.3`. Missing, unknown, or mismatched stage/profile values, a candidate version outside the declared `0.2.x` or `0.3.x` release line, and any record bound to another stage SHALL fail closed.

For `v0.2`, eligibility SHALL require exactly one passing, non-empty, hash-valid, artifact-bound record for every mandatory check mapped to FR-1 through FR-8 and FR-10 through FR-13. `CHK-FR9-01` is not a v0.2 member and its presence SHALL be rejected as wrong-profile evidence; therefore a v0.2 candidate can become eligible before the MCP adapter exists. Its stage-bound `CHK-FR10-01` SHALL declare `packageSurface=OMP_EXTENSION_ONLY` and prove the dependency-absent extension package only. FR-11 fixture admission and FR-12 v0.2 performance/size/result-budget evidence SHALL remain mandatory members of this conjunction.

For `v0.3`, eligibility SHALL require a re-evaluated, eligible v0.2 input whose artifact SHA-256 is the declared v0.2 parent of the v0.3 artifact, plus exactly one passing record for every v0.2-profile check and `CHK-FR9-01`. The v0.3 FR-9 record SHALL prove adapter-to-service parity and the exact read-only registry; its fresh stage-bound `CHK-FR10-01` SHALL declare `packageSurface=OMP_EXTENSION_AND_MCP` and prove both the extension and MCP server from the exact v0.3 artifact; and its stage-bound FR-12 record SHALL prove every MCP-inclusive v0.3 budget. A prior result from another lineage, a claimed result without its hash-valid evaluation input, a missing MCP check, a v0.2-only package/budget record, or any wrong-profile package surface SHALL not satisfy v0.3.

Within either profile, eligibility is all-not-any: the required-check multiset SHALL match that profile exactly; every record SHALL have status `PASS`, cite non-empty evidence whose supplied bytes match the declared hash, and agree on the candidate artifact version/SHA-256 and applicable corpus fingerprint. Any missing, extra, duplicate, failed, stale, mismatched, waived, partial, unverifiable, absent-byte, bad-hash, wrong-stage, wrong-profile, or invalid-lineage record SHALL make eligibility false and SHALL be listed deterministically.

Graph validity, a structural specification pass, generated scaffold, historical upstream result, or unexecuted Gherkin text SHALL NOT satisfy evidence. Eligibility evaluation SHALL be pure and fail closed, SHALL NOT publish or mutate anything, and SHALL NOT clear or override remaining repository publication-validation gates or the fail-closed license policy for future or changed imports in the [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md).

**Acceptance:** [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-release-eligibility-requires-all-mandatory-evidence)

**Scenario:** `@feature14` / `SCEN-kernel-release-gate-is-all-not-any`

**Sources:** [Public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), release and stage gates.

## FR-15: Contained step-binding index (not a v0.2/v0.3 release member)

The @2 kernel SHALL accept an optional `StepDefinitionDocumentV2[]` input set besides canonical `SourceDocument[]`. Each step-definition source uses `NodeSourceV2.kind="STEP_DEFINITION"`, not a canonical `DocumentKind`; its path is under `tests/step-definitions/` with `.js` or `.mjs`. The filesystem adapter SHALL apply the same symlink, junction, reparse, traversal, and non-regular-file refusal as [FR-7](FR.md#fr-7-bounded-repository-containment).

The pure kernel SHALL parse cucumber-js `Given`/`When`/`Then`/`And`/`But` string and `RegExp` patterns into `STEP_BINDING` nodes. Canonical ID is `step-bindings:STEP:` plus the SHA-256 hex of canonical JSON `{path,startOffset,patternKind,pattern,regexFlags}`; RegExp source and canonical flags are preserved and dynamic/unsupported patterns are rejected. Attributes and source fields SHALL match SCHEMA-14 exactly.

For every step text on every `SCENARIO` node the kernel SHALL count matching bindings and emit exactly one outcome:

- one match → one `BINDS_STEP` edge from that `SCENARIO` to the `STEP_BINDING` (span = the step line);
- zero matches → WARNING diagnostic `STEP_UNDEFINED` (SHALL NOT set `graph.valid=false`);
- two or more matches → WARNING diagnostic `STEP_AMBIGUOUS` listing candidate canonical IDs, and no `BINDS_STEP` edge.

Callers SHALL query this index through existing operations `findNodes` (`kinds` includes `STEP_BINDING`), `getEdges` (`types` includes `BINDS_STEP`), and `diagnostics` (`codes` includes `STEP_UNDEFINED`/`STEP_AMBIGUOUS`). This FR SHALL NOT add an MCP tool.

pytest-bdd and other runners are out of scope for this increment; they MAY later reuse the same node kind with another `patternKind` without a second index.

This FR is **not** a member of `kernel-v0.2` or `kernel-v0.3`. A historical candidate remains evaluable without FR-15 evidence. `kernel-step-bindings@1` requires prerequisite anchor migration `CHK-FR13-02` plus its own `CHK-FR15-01`, both bound to one pre-registration candidate and delivered v0.3 baseline. [spec-lsp:FR-7](../spec-lsp/FR.md#fr-7-current-step-absence-and-future-step-profile) SHALL keep current-profile step diagnostics absent until this profile passes.


**Acceptance:** [AC-15.1](ACCEPTANCE_CRITERIA.md#ac-151-step-bindings-are-contained-and-conserved)

**Scenario:** `@feature15` / `SCEN-contained-step-binding-index`


## FR-16: Generator-port read operations beyond the eight

This product is the OMP port of the `dev-pomogator` spec-generator MCP door. [FR-8](FR.md#fr-8-bounded-read-only-query-service) defines the historical eight-operation first slice. The agent-facing API remains MCP ([spec-lsp:FR-1](../spec-lsp/FR.md#fr-1-semantic-free-lsp-used-by-mcp-invisible-to-the-agent)).

The @2 kernel SHALL expose the following additional read-only operations using the exact args/results/errors/cursor contracts in SCHEMA-14:

| Operation | Upstream MCP name | Meaning |
|---|---|---|
| `listSpecs` | `list_specs` | Enumerate spec slugs in the graph |
| `findByTags` | `find_by_tags` | Scenarios whose tags contain every supplied tag |
| `listTasks` | `list_tasks` | Tasks in one spec with status/phase/requirement filters |
| `listPhaseTasks` | `list_phase_tasks` | Tasks under one canonical phase |
| `findOrphans` | `find_orphans` | Orphan-class diagnostics only |
| `validateAnchor` | `validate_anchor` | Compact-id/alias registry (not Marksman heading slugs) |
| `policyQuery` | `policy_query_requirements` | Requirements by verification/safety/delivery fields |
| `validateRequirementMetadata` | `validate_requirement_metadata` | Read-only metadata schema check |
| `archivalProof` | `get_archival_proof` | Live inbound refs from other specs |
| `validateSpec` | `validate_spec` | Read-only multilayer validation + verdict |
| `specStatus` | `get_spec_status` | Graph-validity, counts and structural traceability coverage only; no run/verified evidence |

`get_test_result` and `get_scenario_trace` SHALL wait for `spec-evidence`. `list_spec_docs`, `read_spec_doc`, `read_attachment`, and `mcp_preflight` SHALL be [FR-17](FR.md#fr-17-mcp-adapter-document-and-preflight-io-not-a-v02v03-release-member) adapter I/O, not FR-16 query-service operations. Mutation tools SHALL stay in `spec-authoring-workflow` and SHALL NOT appear on the v0.3 read MCP registry.

`kernel-generator-port-reads@1` requires prerequisite anchor migration `CHK-FR13-02` plus its own `CHK-FR16-01`, bound to the delivered v0.3 baseline and same pre-registration candidate. It SHALL prove every named operation, one-to-one MCP mapping, bounds, errors and absence of mutation names. The same built artifact contains dormant mappings during proof and activates them only after eligibility, without rebuild; passing grows MCP without deleting the eight first-slice names and without changing historical `kernel-v0.3`.

**Acceptance:** [AC-16.1](ACCEPTANCE_CRITERIA.md#ac-161-generator-port-reads-are-named-and-read-only)

**Scenario:** `@feature16` / `SCEN-generator-port-read-operations`

**Sources:** `dev-pomogator` `tools/spec-mcp-server/tools.ts` name census (research, not a code import); `MIGRATION_MATRIX.md` FR-4, FR-30, FR-38, FR-39, FR-82 DEFER/REWRITE.

## FR-17: MCP adapter document and preflight I/O (not a v0.2/v0.3 release member)

The destination agent-facing spec API is MCP. Census rows 17–20 of [spec-generator-port](../../docs/decisions/spec-generator-port.md) name four **MCP adapter I/O** tools that are not FR-8/FR-16 query-service operations:

| MCP name | Role |
|---|---|
| `list_spec_docs` | Enumerate readable documents of one spec |
| `read_spec_doc` | Read one spec document by a name from that inventory |
| `read_attachment` | Read one contained binary attachment |
| `mcp_preflight` | Read-only MCP admission snapshot |

These four operations SHALL be read-only and use the exact request/result/error contracts in SCHEMA-14. FR-7 containment applies before bytes leave the adapter. They are not `QueryOperationV2` values, do not create a second graph, and become agent-visible only through MCP.

`kernel-adapter-io@1` requires prerequisite anchor migration `CHK-FR13-02` plus its own `CHK-FR17-01`, bound to the delivered v0.3 baseline and same pre-registration candidate. Historical v0.2/v0.3 eligibility remains evaluable without FR-17 evidence.

**Acceptance:** [AC-17.1](ACCEPTANCE_CRITERIA.md#ac-171-adapter-document-and-preflight-io-are-named-and-read-only)

**Scenario:** `@feature17` / `SCEN-mcp-adapter-document-preflight-io`

**Sources:** `docs/decisions/spec-generator-port.md` census rows 17–20 (`mcp_preflight`, `list_spec_docs`, `read_spec_doc`, `read_attachment`); `dev-pomogator` `tools/spec-mcp-server/tools.ts` name census (research, not a code import).


