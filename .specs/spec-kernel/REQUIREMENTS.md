# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario tag | Story / Use case | Status |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-pure-read-only-kernel-and-adapter-boundary) | Pure read-only kernel/adapters | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-kernel-has-no-side-effects) | `@feature1` | [US-1](USER_STORIES.md#us-1-portable-maintainer-facing-graph), [UC-1](USE_CASES.md#uc-1-build-a-deterministic-graph-snapshot) | Specified |
| [FR-2](FR.md#fr-2-supported-documents-and-entity-ids) | Documents and IDs | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-canonical-document-and-id-grammar) | `@feature2` | [US-7](USER_STORIES.md#us-7-spec-corpus-integrator) | Specified |
| [FR-3](FR.md#fr-3-canonical-identity-and-deterministic-parsing) | Qualified deterministic identity | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-qualified-identity-and-reproducible-snapshot) | `@feature3` | [US-1](USER_STORIES.md#us-1-portable-maintainer-facing-graph), [UC-1](USE_CASES.md#uc-1-build-a-deterministic-graph-snapshot) | Specified |
| [FR-4](FR.md#fr-4-lossless-duplicate-handling) | Duplicate conservation | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-duplicates-never-overwrite-source-occurrences) | `@feature4` | [US-3](USER_STORIES.md#us-3-honest-specification-consumer), [UC-2](USE_CASES.md#uc-2-inspect-duplicate-definitions-without-data-loss) | Specified |
| [FR-5](FR.md#fr-5-typed-edge-resolution) | Edge resolution | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-every-reference-has-one-explicit-outcome) | `@feature5` | [US-3](USER_STORIES.md#us-3-honest-specification-consumer), [UC-3](USE_CASES.md#uc-3-follow-an-intra-spec-and-cross-spec-trace) | Specified |
| [FR-6](FR.md#fr-6-invariants-and-diagnostics) | Invariants and diagnostics | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-cardinality-and-conservation-fail-closed) | `@feature6` | [US-3](USER_STORIES.md#us-3-honest-specification-consumer) | Specified |
| [FR-7](FR.md#fr-7-bounded-repository-containment) | Contained input adapter | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-unsafe-or-over-budget-trees-are-refused) | `@feature7` | [US-2](USER_STORIES.md#us-2-safe-repository-reader), [UC-6](USE_CASES.md#uc-6-reject-an-unsafe-repository-tree) | Specified |
| [FR-8](FR.md#fr-8-bounded-read-only-query-service) | Shared query service | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-all-query-operations-are-bounded-and-stable) | `@feature8` | [US-4](USER_STORIES.md#us-4-bounded-query-user), [UC-4](USE_CASES.md#uc-4-query-through-the-omp-extension) | Specified |
| [FR-9](FR.md#fr-9-read-only-mcp-projection-in-v03) | v0.3 MCP projection | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-mcp-is-a-semantic-free-read-projection) | `@feature9` | [US-4](USER_STORIES.md#us-4-bounded-query-user), [UC-5](USE_CASES.md#uc-5-query-through-mcp-in-v03) | Specified |
| [FR-10](FR.md#fr-10-self-contained-runtime-distribution) | Self-contained artifact | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-installed-artifact-has-no-ambient-dependency) | `@feature10` | [US-5](USER_STORIES.md#us-5-release-owner) | Specified |
| [FR-11](FR.md#fr-11-real-fixtures-and-provenance) | Real fixtures | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fixtures-are-real-hashed-and-reconciled) | `@feature11` | [US-6](USER_STORIES.md#us-6-fixture-reviewer), [UC-7](USE_CASES.md#uc-7-validate-a-real-fixture-corpus) | Specified |
| [FR-12](FR.md#fr-12-performance-size-and-result-budgets) | Budgets | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-budgets-are-measured-enforced-and-visible) | `@feature12` | [US-5](USER_STORIES.md#us-5-release-owner), [UC-8](USE_CASES.md#uc-8-enforce-packaging-and-benchmark-budgets) | Specified |
| [FR-13](FR.md#fr-13-complete-markdown-heading-anchor-and-link-inventory) | Complete safe-rename inventory | [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-safe-rename-inventory-is-complete-and-conserved) | `@feature13` | [US-4](USER_STORIES.md#us-4-bounded-query-user), [UC-9](USE_CASES.md#uc-9-inventory-a-heading-before-safe-rename-planning) | Specified |
| [FR-14](FR.md#fr-14-conjunctive-kernel-release-eligibility) | All-mandatory release gate | [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-release-eligibility-requires-all-mandatory-evidence) | `@feature14` | [US-5](USER_STORIES.md#us-5-release-owner), [UC-10](USE_CASES.md#uc-10-evaluate-the-aggregate-kernel-release-gate) | Specified |
| [FR-15](FR.md#fr-15-contained-step-binding-index-not-a-v02v03-release-member) | Contained step-binding index | [AC-15.1](ACCEPTANCE_CRITERIA.md#ac-151-step-bindings-are-contained-and-conserved) | `@feature15` | [US-4](USER_STORIES.md#us-4-bounded-query-user) | Specified; not a v0.2/v0.3 gate member |

## Contract checks

| Check | Contract | Trace | Future evidence | State |
|---|---|---|---|---|
| CHK-FR1-01 | Pure kernel has no ambient I/O and registries have no mutation operations | FR-1, AC-1.1, `@feature1` | Boundary test plus public-export inspection | Not recorded |
| CHK-FR2-01 | Document-role grammar emits each current FR/AC/TASK definition exactly once: FR only from FR.md colon/em-dash title, AC only from ACCEPTANCE_CRITERIA.md colon/em-dash/bare exact ID, TASK only from TASKS.md colon/em-dash title; grouping/wrong-document headings emit none; `planned` and `todo` remain distinct | FR-2, AC-2.1, `@feature2` | Exact target-corpus parser census plus planted wrong-document/group/arbitrary-heading and status-preservation controls | Not recorded |
| CHK-FR3-01 | Input ordering/newlines do not alter qualified snapshot | FR-3, AC-3.1, `@feature3` | Property test over captured bytes | Not recorded |
| CHK-FR4-01 | Duplicate candidates survive and no winner is elected | FR-4, AC-4.1, `@feature4` | Negative fixture graph test | Not recorded |
| CHK-FR5-01 | Every reference has exactly one permitted resolution outcome | FR-5, AC-5.1, `@feature5` | Edge matrix/conservation test | Not recorded |
| CHK-FR6-01 | Cardinality and conservation failures invalidate graph | FR-6, AC-6.1, `@feature6` | Invariant mutation test | Not recorded |
| CHK-FR7-01 | Traversal/link/reparse/budget variants are rejected before unsafe read | FR-7, AC-7.1, `@feature7` | Cross-platform adapter integration test | Not recorded |
| CHK-FR8-01 | Eight operations use bounded exhaustive envelopes and stable cursors | FR-8, AC-8.1, `@feature8` | Query contract suite | Not recorded |
| CHK-FR9-01 | MCP structured results equal shared service results; registry is read-only | FR-9, AC-9.1, `@feature9` | Installed MCP adapter contract test | Not recorded |
| CHK-FR10-01 | Stage-bound dependency-absent package proof: v0.2 accepts only `OMP_EXTENSION_ONLY`; v0.3 accepts only `OMP_EXTENSION_AND_MCP` with both components from the exact v0.3 artifact; wrong profile/surface/stage/artifact fails closed | FR-10, AC-10.1, `@feature10` | Two installed-directory smokes keyed by targetStage plus cross-profile package-surface swaps | Not recorded |
| CHK-FR11-01 | Real fixture manifest hash/provenance/ground truth reconcile | FR-11, AC-11.1, `@feature11` | Fixture admission test | Not recorded |
| CHK-FR12-01 | Artifact and benchmark meet every hard budget | FR-12, AC-12.1, `@feature12` | Packaged benchmark report | Not recorded |
| CHK-FR13-01 | Every GLFM heading/link occurrence, canonical anchor, rewrite site, outcome, and focused inbound/outbound relation is complete and conserved; anchor candidates are tested against the full previously emitted set, including `Foo`/`Foo`/`Foo-1` collisions | FR-13, AC-13.1, `@feature13` | Real Markdown inventory/query contract with adversarial anchor vectors and complete cursor-chain reconciliation | Not recorded |
| CHK-FR14-01 | `v0.2`/`kernel-v0.2` is the exact all-PASS FR-1..FR-8 plus FR-10..FR-13 profile with no FR-9/MCP dependency and extension-only FR-10 proof; `v0.3`/`kernel-v0.3` additionally requires a same-lineage accepted v0.2 input, FR-9, exact-v0.3 extension-plus-MCP FR-10 proof, and MCP-inclusive budgets; unknown or mismatched profiles/surfaces fail closed | FR-14, AC-14.1, `@feature14` | Per-profile evidence manifests, v0.2 extension-only positive proof, v0.3 exact-artifact MCP/lineage positive proof, and one-fault-at-a-time negative matrix | Not recorded |
| CHK-FR15-01 | Allowlisted `tests/step-definitions/**/*.js|mjs` parse to `STEP_BINDING`; conservation of BINDS_STEP/STEP_UNDEFINED/STEP_AMBIGUOUS; symlink/escape refused; not a v0.2/v0.3 required check; unblocks spec-lsp step diagnostics | FR-15, AC-15.1, `@feature15` | Real cucumber-js step-def fixtures plus negative path/ambiguity cases | Not recorded |

## Non-functional traceability

| NFR | Related requirements | Verification obligation |
|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-build-and-query-latency) | FR-8, FR-12, FR-13, FR-14 | Pinned benchmark, p95 samples, raw observations, mandatory budget-gate evidence |
| [NFR-SIZE-1](NFR.md#nfr-size-1-bundle-and-response-size) | FR-10, FR-12, FR-13, FR-14 | Installed artifact, Markdown inventory page, response byte measurement, mandatory package/budget evidence |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound) | FR-7, FR-12, FR-13 | Peak incremental RSS on benchmark corpus including heading/link occurrence arrays |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-1, FR-7, FR-9 | Traversal/link variants and absolute-path leak check |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-fail-closed-results) | FR-3, FR-4, FR-5, FR-6, FR-13, FR-14 | Repeated canonical snapshot, inventory cursor chain, invariant and aggregate-gate tests |
| [NFR-PORT-1](NFR.md#nfr-port-1-portable-installed-runtime) | FR-10, FR-14 | Dependency-absent installed smoke and mandatory package-gate evidence on supported OMP platforms |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-bounded-diagnostics) | FR-6, FR-8, FR-13, FR-14 | Error/diagnostic/inventory/blocker schema contracts and truncation evidence |

## Global invariants

1. `canonicalId = specSlug + ":" + localId`; no bare ID is a corpus-wide key.
2. `definitionOccurrences = uniqueNodes + ambiguousCandidateOccurrences + rejectedDefinitionOccurrences`.
3. `referenceOccurrences = resolvedEdges + unresolvedReferences`.
4. `discoveredCanonicalDocuments = acceptedDocuments + rejectedDocuments`.
5. Every resolved edge has exactly two existing endpoints allowed by the endpoint matrix.
6. Any canonical identity has either one elected node or two-or-more ambiguous candidates, never both.
7. The extension and MCP adapter call one query service and do not reinterpret results.
8. A read operation changes zero repository bytes and creates zero state artifacts.
9. Scenario text and structural parsing never imply executed/passing evidence.
10. Every accepted GLFM heading contributes exactly one `MarkdownHeadingOccurrence`, including ordinary non-ID headings, and its canonical anchor is the smallest base/base-N candidate absent from the complete set previously emitted for that document.
11. `markdownLinkOccurrences = internalHeading + internalDocument + external + unresolved`; each semantic link use has one outcome and one stable rewrite key.
12. A complete rename inventory is proven only by one graph fingerprint, a fully consumed cursor chain, reconciled global/matched totals, and pairwise-unique canonical anchors even for suffix-shaped adversarial headings.
13. Kernel release eligibility is the conjunction of the schema-owned selected profile: v0.2 requires exactly FR-1..FR-8 and FR-10..FR-13 checks, rejects FR-9/MCP evidence, and binds `CHK-FR10-01` to `OMP_EXTENSION_ONLY`; v0.3 requires an accepted same-lineage v0.2 input plus the complete v0.2 set, FR-9, fresh `OMP_EXTENSION_AND_MCP` FR-10 evidence from the exact v0.3 artifact, and fresh MCP-inclusive FR-12 evidence. Unknown/mismatched stage/profile/package-surface values fail closed.
14. Definition roles are closed before heading recognition: FR only from `FR.md`, AC only from `ACCEPTANCE_CRITERIA.md`, and TASK only from `TASKS.md`; grouping/reference headings never create definition candidates, and shared `TASK.status` preserves `planned` and `todo` distinctly.
