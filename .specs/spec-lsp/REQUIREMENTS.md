# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario tag | Story / Use case | Status |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-one-server-semantic-free-read-projection) | Semantic-free read projection | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-fr-1-lsp-is-a-semantic-free-read-projection) | `@feature1` | [US-2](USER_STORIES.md#us-2-agent-navigating-spec-definitions-through-lsp-primitives), [UC-2](USE_CASES.md#uc-2-navigate-from-a-cross-reference-to-its-definition) | Specified |
| [FR-2](FR.md#fr-2-read-only-posture-with-proposal-only-code-actions) | Read-only + proposal code actions | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-fr-2-no-mutation-and-code-actions-propose-only) | `@feature2` | [US-1](USER_STORIES.md#us-1-specification-author-receiving-automatic-conformance-feedback) | Specified |
| [FR-3](FR.md#fr-3-spec-layer-diagnostics-mapped-from-kernel-conformance-findings) | Diagnostics = kernel findings | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-fr-3-diagnostics-are-kernel-findings-mapped-one-to-one) | `@feature3` | [US-1](USER_STORIES.md#us-1-specification-author-receiving-automatic-conformance-feedback), [UC-1](USE_CASES.md#uc-1-automatic-post-write-conformance-diagnostics-on-a-spec-document) | Specified |
| [FR-4](FR.md#fr-4-definition-and-references-through-the-kernel-anchor-registry) | Definition/references via anchor registry | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-fr-4-definition-and-references-use-kernel-anchor-semantics) | `@feature4` | [US-2](USER_STORIES.md#us-2-agent-navigating-spec-definitions-through-lsp-primitives), [UC-2](USE_CASES.md#uc-2-navigate-from-a-cross-reference-to-its-definition), [UC-3](USE_CASES.md#uc-3-find-all-references-to-a-spec-definition) | Specified |
| [FR-5](FR.md#fr-5-completion-over-registered-aliases-and-documentsymbol-outline) | Completion and documentSymbol | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-fr-5-completion-and-outline-reflect-kernel-nodes) | `@feature5` | [US-3](USER_STORIES.md#us-3-agent-completing-spec-aliases-without-typos), [US-4](USER_STORIES.md#us-4-agent-inspecting-spec-structure-through-document-outline), [UC-4](USE_CASES.md#uc-4-complete-a-partial-alias-in-a-markdown-link), [UC-5](USE_CASES.md#uc-5-view-document-outline-of-a-spec-file) | Specified |
| [FR-6](FR.md#fr-6-hover-surfaces-node-body-and-scenario-provenance) | Hover node body + scenario provenance | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-fr-6-hover-returns-kernel-node-body-and-scenario-provenance) | `@feature6` | [US-5](USER_STORIES.md#us-5-scenario-consumer-viewing-run-results-and-provenance-through-hover), [UC-6](USE_CASES.md#uc-6-hover-over-a-scenario-tag-to-see-run-results) | Specified |
| [FR-7](FR.md#fr-7-step-layer-centralization-with-bundled-libraries) | Step layer centralization | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-fr-7-step-layer-uses-bundled-libraries-not-external-server) | `@feature7` | [US-6](USER_STORIES.md#us-6-step-author-receiving-definedundefinedambiguous-step-diagnostics), [UC-7](USE_CASES.md#uc-7-diagnose-step-bindings-in-a-feature-file) | Specified |
| [FR-8](FR.md#fr-8-adapter-to-service-parity-check) | Adapter-to-service parity | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-fr-8-parity-check-proves-lsp-equals-kernel-on-fixtures) | `@feature8` | [US-7](USER_STORIES.md#us-7-release-owner-verifying-adapter-to-service-parity), [UC-10](USE_CASES.md#uc-10-verify-adapter-to-service-parity-on-shared-fixtures) | Specified |
| [FR-9](FR.md#fr-9-incremental-re-evaluation-budget-and-lazy-start) | Incremental budget + lazy start | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-fr-9-incremental-re-evaluation-meets-budget) | `@feature9` | [US-1](USER_STORIES.md#us-1-specification-author-receiving-automatic-conformance-feedback), [UC-1](USE_CASES.md#uc-1-automatic-post-write-conformance-diagnostics-on-a-spec-document) | Specified |
| [FR-10](FR.md#fr-10-scope-containment-and-honest-absence) | Scope containment + honest absence | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-fr-10-scope-is-contained-and-absence-is-honest) | `@feature10` | [UC-8](USE_CASES.md#uc-8-reject-an-out-of-scope-root-or-symlink), [UC-9](USE_CASES.md#uc-9-honest-absence-when-kernel-graph-is-unavailable) | Specified |
| [FR-11](FR.md#fr-11-self-contained-dependency-safe-distribution) | Self-contained distribution | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fr-11-installed-server-is-self-contained-and-binary-free) | `@feature11` | [US-7](USER_STORIES.md#us-7-release-owner-verifying-adapter-to-service-parity) | Specified |
| [FR-12](FR.md#fr-12-oracle-parity-for-cucumber-runner-step-verdicts) | Oracle parity for step verdicts | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-fr-12-oracle-parity-proves-step-verdict-agreement) | `@feature12` | [US-6](USER_STORIES.md#us-6-step-author-receiving-definedundefinedambiguous-step-diagnostics), [US-8](USER_STORIES.md#us-8-fixture-reviewer-validating-real-producer-step-fixtures), [UC-7](USE_CASES.md#uc-7-diagnose-step-bindings-in-a-feature-file) | Specified |

## Contract checks

| Check | Contract | Trace | Future evidence | State |
|---|---|---|---|---|
| CHK-FR1-01 | LSP capability set contains no mutation/write operation; all answers derive from kernel query operations | FR-1, AC-1.1, `@feature1` | Capability inspection plus boundary test | Not recorded |
| CHK-FR2-01 | No `workspace/applyEdit` invocation; code actions return proposal descriptions only without actionable WorkspaceEdit | FR-2, AC-2.1, `@feature2` | Protocol trace inspection | Not recorded |
| CHK-FR3-01 | Every kernel conformance finding maps to exactly one LSP diagnostic with matching code/file/line/message | FR-3, AC-3.1, `@feature3` | Diagnostic mapping contract test on shared fixtures | Not recorded |
| CHK-FR4-01 | Definition/references results match kernel getNode/getEdges answers including ambiguity semantics | FR-4, AC-4.1, `@feature4` | Navigation parity test on shared fixtures | Not recorded |
| CHK-FR5-01 | Completion items are a subset of registered kernel aliases; documentSymbol tree matches kernel node inventory | FR-5, AC-5.1, `@feature5` | Completion/outline contract test | Not recorded |
| CHK-FR6-01 | Hover content equals kernel graph node body/status/scenario fields; empty when graph has no data | FR-6, AC-6.1, `@feature6` | Hover content contract test | Not recorded |
| CHK-FR7-01 | Production plugin configuration does not register @cucumber/language-server; step decisions use bundled libraries + graph edges | FR-7, AC-7.1, `@feature7` | Plugin manifest inspection + step verdict test | Not recorded |
| CHK-FR8-01 | LSP definition/references/diagnostics equal kernel service answers on fingerprint-bound shared fixtures | FR-8, AC-8.1, `@feature8` | Installed adapter parity harness | Not recorded |
| CHK-FR9-01 | Incremental re-evaluation ≤150ms p95; cold start within kernel budget; lazy start compatible | FR-9, AC-9.1, `@feature9` | Benchmark report on reference corpus | Not recorded |
| CHK-FR10-01 | External roots/symlinks/traversal refused; absent graph produces explanatory diagnostics not fake results | FR-10, AC-10.1, `@feature10` | Containment + honest-absence integration test | Not recorded |
| CHK-FR11-01 | Installed artifact executes without source checkout, root node_modules, or third-party binaries; Marksman DROP honored | FR-11, AC-11.1, `@feature11` | Dependency-absent installed smoke | Not recorded |
| CHK-FR12-01 | Custom server step verdicts match @cucumber/language-server oracle on shared cucumber-runner fixtures; pytest-bdd receives equivalent diagnostics | FR-12, AC-12.1, `@feature12` | Oracle parity harness on fixture set | Not recorded |

## Non-functional traceability

| NFR | Related requirements | Verification obligation |
|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-incremental-and-cold-start-latency) | FR-9, FR-11 | Pinned benchmark, p95 samples, raw observations |
| [NFR-SIZE-1](NFR.md#nfr-size-1-bundle-size-with-step-libraries) | FR-11 | Installed artifact measurement including bundled libraries |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound-with-step-index) | FR-7, FR-9 | Peak incremental RSS with both layers active |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-10 | Traversal/symlink variants and absolute-path leak check |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-honest-absence) | FR-10 | Repeated snapshot determinism + absent-graph behavior |
| [NFR-PORT-1](NFR.md#nfr-port-1-portable-installed-runtime) | FR-11 | Dependency-absent installed smoke on supported OMP platforms |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-bounded-diagnostics) | FR-3, FR-6 | Diagnostic/hover/completion bound enforcement |

## Global invariants

1. The LSP adapter is a semantic-free read projection of the `spec-kernel` query service; it adds no parsing, resolution, or verdict semantics.
2. No mutation, proposal persistence, or status transition occurs through the LSP surface.
3. Every LSP diagnostic maps 1:1 to a kernel conformance finding; no adapter-specific rules exist.
4. Definition and references use the kernel anchor registry with identical ambiguity semantics.
5. Step decisions derive from bundled libraries plus kernel graph edges; no external step server runs in production.
6. Adapter-to-service parity is fingerprint-bound and fails closed on divergence.
7. The server operates only on `.specs/**` and authored `.feature` files; external roots and symlinks are refused.
8. Absent kernel graph produces explanatory diagnostics, never fabricated results.
9. The installed artifact is self-contained with no third-party binaries; the Marksman DROP stands.
10. Oracle parity for cucumber-runner step verdicts is proven on shared fixtures before release.
11. The extension, MCP adapter, and LSP adapter call one query service and do not reinterpret results.
12. A read operation through the LSP surface changes zero repository bytes and creates zero state artifacts.
