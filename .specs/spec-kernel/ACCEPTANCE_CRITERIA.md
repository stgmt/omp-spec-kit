# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1: Pure kernel has no side effects

**EARS:** WHEN the pure kernel parses supplied source bytes and serves every public v0.2 query THEN it SHALL produce values without filesystem, clock, environment, network, process, OMP, or MCP access; AND the v0.2-v0.3 public registries SHALL contain zero mutation/state-transition methods.

**Requirement:** [FR-1](FR.md#fr-1-pure-read-only-kernel-and-adapter-boundary)

**Scenario:** `@feature1`, `@id:SCEN-pure-read-only-boundary`

## AC-2.1: Canonical document and ID grammar

**EARS:** WHEN the current product, plugin-distribution, spec-kernel, and spec-authoring-workflow documents are parsed THEN every `FR-N` SHALL be defined exactly once only from `FR.md` by a level-2 colon-title or em-dash-title heading; every `AC-N.M` SHALL be defined exactly once only from `ACCEPTANCE_CRITERIA.md` by its level-2/3 colon-title, em-dash-title, or bare exact-ID heading; and every `TASK-N` SHALL be defined exactly once only from `TASKS.md` by a level-2 colon-title or em-dash-title heading. Same-looking IDs in the wrong document, product AC-file FR grouping headings, matrices, arbitrary prose/separators, malformed IDs, and fenced examples SHALL NOT become definitions. The parser SHALL preserve shared task states `planned` and `todo` distinctly, including canonical-corpus `Planned` → `planned`, `todo` → `todo`, and `Completed` → `done`, while emitting the schema-defined generated identities and typed diagnostics for actual malformed owning-document candidates.

**Requirement:** [FR-2](FR.md#fr-2-supported-documents-and-entity-ids)

**Scenario:** `@feature2`, `@id:SCEN-supported-documents-and-ids`

## AC-3.1: Qualified identity and reproducible snapshot

**EARS:** WHEN two specs both define `FR-1`, local and qualified references are present, and the same normalized files are supplied in different orders and line-ending forms THEN the graph SHALL contain distinct `<slug>:FR-1` identities, resolve local/cross-spec references by the stated rules, and serialize to the same fingerprint and canonical bytes.

**Requirement:** [FR-3](FR.md#fr-3-canonical-identity-and-deterministic-parsing)

**Scenario:** `@feature3`, `@id:SCEN-qualified-deterministic-snapshot`

## AC-4.1: Duplicates never overwrite source occurrences

**EARS:** IF a canonical ID has two valid definition occurrences THEN both SHALL remain in `definitionCandidates`, the canonical node SHALL be absent, one `DUPLICATE_DEFINITION` diagnostic SHALL list both spans, references SHALL resolve as `AMBIGUOUS_TARGET`, and `getNode` SHALL return `AMBIGUOUS_ID` with stable bounded candidates.

**Requirement:** [FR-4](FR.md#fr-4-lossless-duplicate-handling)

**Scenario:** `@feature4`, `@id:SCEN-lossless-duplicates`

## AC-5.1: Every reference has one explicit outcome

**EARS:** WHEN valid, missing, ambiguous, malformed, forbidden-endpoint, local, and qualified cross-spec references are parsed THEN each reference occurrence SHALL appear exactly once as a resolved typed edge or typed unresolved reference; AND every resolved edge SHALL join existing permitted node kinds.

**Requirement:** [FR-5](FR.md#fr-5-typed-edge-resolution)

**Scenario:** `@feature5`, `@id:SCEN-edge-resolution-outcomes`

## AC-6.1: Cardinality and conservation fail closed

**EARS:** WHEN a graph snapshot is built THEN its document, definition, domain-reference, Markdown-heading, Markdown-link, link-outcome, node, edge, and diagnostic counters SHALL satisfy every conservation/cardinality equation in the schema; AND planting an equation violation or ERROR diagnostic SHALL set `graph.valid=false` without reporting readiness or passing-test status.

**Requirement:** [FR-6](FR.md#fr-6-invariants-and-diagnostics)

**Scenario:** `@feature6`, `@id:SCEN-conservation-and-fail-closed-diagnostics`

## AC-7.1: Unsafe or over-budget trees are refused

**EARS:** IF a candidate repository path escapes the explicit root, contains a symlink/junction/reparse/mount segment, is not a regular canonical document, exceeds any input budget, or cannot be safely inspected THEN the adapter SHALL refuse before reading external/over-budget target bytes, return a sanitized bounded diagnostic, expose only repository-relative paths, and write zero bytes.

**Requirement:** [FR-7](FR.md#fr-7-bounded-repository-containment)

**Scenario:** `@feature7`, `@id:SCEN-contained-reader-rejects-links`

## AC-8.1: All query operations are bounded and stable

**EARS:** WHEN each of `inventory`, `getNode`, `findNodes`, `getEdges`, `trace`, `diagnostics`, `overview`, and `markdownInventory` is called with valid, boundary, excessive, unknown, and stale-cursor inputs THEN the service SHALL return the exhaustive envelope, stable ordering, valid fingerprint-bound pagination, explicit truncation/totals, or a closed typed error; AND it SHALL not mutate graph or repository state.

**Requirement:** [FR-8](FR.md#fr-8-bounded-read-only-query-service)

**Scenario:** `@feature8`, `@id:SCEN-bounded-query-service`

## AC-9.1: MCP is a semantic-free read projection

**EARS:** WHEN the v0.3 MCP adapter invokes every registered tool against the same graph/request as the v0.2 service THEN its canonical structured envelope SHALL match the service result exactly after transport metadata is removed; AND the registry SHALL contain exactly the eight named read tools and zero mutation-like tools.

**Requirement:** [FR-9](FR.md#fr-9-read-only-mcp-projection-in-v03)

**Scenario:** `@feature9`, `@id:SCEN-mcp-read-projection-only`

## AC-10.1: Installed artifact has no ambient dependency

**EARS:** WHEN `CHK-FR10-01` is evaluated for `targetStage=v0.2` and `evidenceProfile=kernel-v0.2` THEN only a hash-valid record with `packageSurface=OMP_EXTENSION_ONLY` proving the dependency-absent installed v0.2 extension can satisfy it, and no MCP implementation, byte, execution, or evidence SHALL be required or accepted. WHEN it is evaluated for `targetStage=v0.3` and `evidenceProfile=kernel-v0.3` THEN only a fresh hash-valid record with `packageSurface=OMP_EXTENSION_AND_MCP` proving both extension and MCP server execute the shared kernel from the exact v0.3 artifact can satisfy it. A cross-stage record, extension-only v0.3 record, MCP-inclusive v0.2 record, wrong profile/release line, or mismatched artifact SHALL fail closed.

**Requirement:** [FR-10](FR.md#fr-10-self-contained-runtime-distribution)

**Scenario:** `@feature10`, `@id:SCEN-self-contained-artifact`

## AC-11.1: Fixtures are real, hashed, and reconciled

**EARS:** WHEN an executable real fixture is admitted THEN its manifest SHALL contain every provenance, integrity, license, trimming, and ground-truth field; its bytes SHALL match SHA-256 and size; document/definition/domain-reference/Markdown-heading/Markdown-link/rewrite-site counts and outcomes SHALL reconcile with ground truth and conservation equations; and the report SHALL not infer upstream compatibility or executed scenario status.

**Requirement:** [FR-11](FR.md#fr-11-real-fixtures-and-provenance)

**Scenario:** `@feature11`, `@id:SCEN-real-fixture-provenance`

## AC-12.1: Budgets are measured, enforced, and visible

**EARS:** WHEN the pinned benchmark and hard-limit variants run against the packaged artifact THEN cold-build p95, query p95, peak incremental memory, bundle sizes, corpus/result caps, cancellation, and serialized response bounds SHALL meet `NFR.md`; AND any hard excess SHALL return a typed limit error or block release rather than silently discarding data.

**Requirement:** [FR-12](FR.md#fr-12-performance-size-and-result-budgets)

**Scenario:** `@feature12`, `@id:SCEN-performance-and-size-budgets`

## AC-13.1: Safe rename inventory is complete and conserved

**EARS:** WHEN historical kernel@1 is evaluated THEN `glfm-anchor@1` carriers/cursors and `CHK-FR13-01` SHALL remain exact; WHEN kernel@2 anchor migration is evaluated THEN `GraphSnapshotV2`/heading/migration carriers SHALL use `marksman-anchor@2`, conserve every occurrence, reject cross-version cursors, and require `kernel-anchor-migration@1` with exactly `CHK-FR13-02`; neither check/profile SHALL substitute for the other.

**Requirement:** [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory)

**Scenario:** `@feature13`, `@id:SCEN-complete-markdown-rename-inventory`

## AC-14.1: Release eligibility requires all mandatory evidence

**EARS:** WHEN the kernel release evaluator receives a manifest for one candidate artifact THEN it SHALL fail closed unless `targetStage` and `evidenceProfile` are a known matching pair and SHALL return `eligible=true` only when the exact all-PASS profile is satisfied: v0.2 requires FR-1 through FR-8 and FR-10 through FR-13, including stage-bound `CHK-FR10-01` with `OMP_EXTENSION_ONLY`, fixture, and budget gates but excluding and rejecting FR-9/MCP evidence; v0.3 requires a same-lineage accepted v0.2 input plus those checks, FR-9 adapter parity/read-only-registry evidence, stage-bound `CHK-FR10-01` with `OMP_EXTENSION_AND_MCP` proving both components from the exact v0.3 artifact, and MCP-inclusive budget evidence. Any unknown/mismatched stage or profile, wrong package surface/release line, missing lineage, missing/extra/duplicate/non-PASS record, empty or bad-hash evidence, or artifact/corpus/stage binding mismatch SHALL produce deterministic blockers and no side effect.

**Requirement:** [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility)

**Scenario:** `@feature14`, `@id:SCEN-kernel-release-gate-is-all-not-any`

## AC-15.1: Step bindings are contained and conserved

**EARS:** WHEN pre-registration `kernel-step-bindings@1` runs against one delivered v0.3 baseline and contained `StepDefinitionDocumentV2` sources **THEN** static string and RegExp source+flags SHALL produce distinct closed STEP_BINDING nodes, matching SHALL conserve BINDS_STEP/STEP_UNDEFINED/STEP_AMBIGUOUS, unsafe/dynamic patterns SHALL refuse, and exact `CHK-FR13-02` plus `CHK-FR15-01` records SHALL be required for the same candidate; **AND** historical v0.2/v0.3 manifests remain evaluable.

**Requirement:** [FR-15](FR.md#fr-15-contained-step-binding-index-not-a-v02v03-release-member)

**Scenario:** `@feature15`, `@id:SCEN-contained-step-binding-index`

## AC-16.1: Generator-port reads are named and read-only

**EARS:** WHEN pre-registration `kernel-generator-port-reads@1` runs **THEN** every FR-16 operation (including V2 STEP/CAP carriers where applicable) SHALL satisfy exact args/data/full-error/bounds/cursor contracts, `specStatus` SHALL expose structural coverage only, and dormant MCP mappings SHALL execute against the same candidate; exact `CHK-FR13-02` plus `CHK-FR16-01` SHALL be required; activation SHALL not rebuild; historical v0.2/v0.3 manifests remain evaluable.

**Requirement:** [FR-16](FR.md#fr-16-generator-port-read-operations-beyond-the-eight)

**Scenario:** `@feature16`, `@id:SCEN-generator-port-read-operations`

## AC-17.1: Adapter document and preflight I/O are named and read-only

**EARS:** WHEN pre-registration `kernel-adapter-io@1` runs **THEN** the four adapter operations SHALL satisfy exact request/success/full-error and containment contracts, remain outside QueryOperationV2, and execute dormant MCP mappings from the same candidate; exact `CHK-FR13-02` plus `CHK-FR17-01` SHALL be required; activation SHALL not rebuild; historical v0.2/v0.3 manifests remain evaluable.

**Requirement:** [FR-17](FR.md#fr-17-mcp-adapter-document-and-preflight-io-not-a-v02v03-release-member)

**Scenario:** `@feature17`, `@id:SCEN-mcp-adapter-document-preflight-io`


