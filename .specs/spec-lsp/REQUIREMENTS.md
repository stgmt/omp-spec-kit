# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario tag | Story / Use case | Status |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-semantic-free-lsp-used-by-mcp-invisible-to-the-agent) | LSP used by MCP; agent sees MCP only | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-lsp-is-a-semantic-free-read-projection) | `@feature1` | [US-2](USER_STORIES.md#us-2-editor-or-mcp-adapter-navigating-spec-definitions-through-lsp-primitives) | Specified |

| [FR-2](FR.md#fr-2-read-only-posture-no-agent-visible-codeaction) | No codeAction capability in this stage | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-no-mutation-and-no-codeaction-capability-in-this-stage) | `@feature2` | [US-1](USER_STORIES.md#us-1-specification-author-receiving-automatic-conformance-feedback) | Specified |

| [FR-3](FR.md#fr-3-spec-layer-diagnostics-mapped-from-kernel-conformance-findings) | Diagnostics = kernel findings | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-diagnostics-are-kernel-findings-mapped-one-to-one) | `@feature3` | [US-1](USER_STORIES.md#us-1-specification-author-receiving-automatic-conformance-feedback), [UC-1](USE_CASES.md#uc-1-automatic-post-write-conformance-diagnostics-on-a-spec-document) | Specified |
| [FR-4](FR.md#fr-4-definition-and-references-through-the-kernel-anchor-registry) | Definition/references via anchor registry | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-definition-and-references-use-kernel-anchor-semantics) | `@feature4` | [US-2](USER_STORIES.md#us-2-editor-or-mcp-adapter-navigating-spec-definitions-through-lsp-primitives), [UC-2](USE_CASES.md#uc-2-navigate-from-a-cross-reference-to-its-definition), [UC-3](USE_CASES.md#uc-3-find-all-references-to-a-spec-definition) | Specified |
| [FR-5](FR.md#fr-5-completion-over-registered-aliases-and-documentsymbol-outline) | Completion and documentSymbol | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-completion-and-outline-reflect-kernel-nodes) | `@feature5` | [US-3](USER_STORIES.md#us-3-editor-or-mcp-adapter-completing-spec-aliases-without-typos), [US-4](USER_STORIES.md#us-4-editor-or-mcp-adapter-inspecting-spec-structure-through-document-outline), [UC-4](USE_CASES.md#uc-4-complete-a-partial-alias-in-a-markdown-link), [UC-5](USE_CASES.md#uc-5-view-document-outline-of-a-spec-file) | Specified |
| [FR-6](FR.md#fr-6-hover-surfaces-only-fields-the-kernel-actually-stores) | Hover kernel-stored fields only | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-hover-returns-only-kernel-stored-fields) | `@feature6` | [US-5](USER_STORIES.md#us-5-scenario-consumer-viewing-kernel-scenario-fields-through-hover), [UC-6](USE_CASES.md#uc-6-hover-over-a-scenario-tag-to-see-kernel-scenario-fields) | Specified |

| [FR-7](FR.md#fr-7-current-step-absence-and-future-step-profile) | Current absence; separately gated future step projection | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-this-stage-ships-no-step-binding-diagnostics), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72-future-step-profile-is-separately-gated) | `@feature7` / `SCEN-spec-lsp-step-layer-centralized`, `SCEN-spec-lsp-future-step-profile` | [US-6](USER_STORIES.md#us-6-release-owner-proving-step-layer-absence) | Current profile specified; future profile blocked on `spec-kernel:CHK-FR15-01` |
| [FR-8](FR.md#fr-8-adapter-to-service-parity-check) | Adapter-to-service parity | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-parity-check-proves-lsp-equals-kernel-on-fixtures) | `@feature8` | [US-7](USER_STORIES.md#us-7-release-owner-verifying-adapter-to-service-parity), [UC-10](USE_CASES.md#uc-10-verify-adapter-to-service-parity-on-shared-fixtures) | Specified |
| [FR-9](FR.md#fr-9-honest-rebuild-on-save-150-ms-incremental-is-not-this-stages-gate) | Honest didSave rebuild; 150 ms not a gate | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-lazy-start-and-honest-didsave-rebuild-150-ms-is-not-a-gate) | `@feature9` | [US-1](USER_STORIES.md#us-1-specification-author-receiving-automatic-conformance-feedback), [UC-1](USE_CASES.md#uc-1-automatic-post-write-conformance-diagnostics-on-a-spec-document) | Specified |
| [FR-10](FR.md#fr-10-scope-containment-out-of-scope-no-op-and-honest-absence) | Scope containment + out-of-scope no-op | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-scope-is-contained-out-of-scope-is-a-no-op-absence-is-honest) | `@feature10` | [UC-8](USE_CASES.md#uc-8-reject-an-out-of-scope-root-or-symlink), [UC-9](USE_CASES.md#uc-9-honest-absence-when-kernel-graph-is-unavailable) | Specified |
| [FR-11](FR.md#fr-11-self-contained-dependency-safe-distribution) | Self-contained distribution | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-installed-server-is-self-contained-and-binary-free) | `@feature11` | [US-7](USER_STORIES.md#us-7-release-owner-verifying-adapter-to-service-parity) | Specified |
| [FR-12](FR.md#fr-12-current-release-proves-step-layer-absence) | Release proves step-layer absence | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-release-proves-step-layer-absence) | `@feature12` | [US-6](USER_STORIES.md#us-6-release-owner-proving-step-layer-absence), [US-8](USER_STORIES.md#us-8-release-owner-keeping-oracle-parity-out-of-this-stage) | Specified |

## Contract checks

| Check | Requirement | Trace | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | FR-1 | FR-1, AC-1.1, `@feature1` | Integration test | Draft | Owner: TASK-1; capability/registry inspection proves MCP-only product routing without denying the generic host tool. |
| CHK-FR2-01 | FR-2 | FR-2, AC-2.1, `@feature2` | Integration test | Draft | Owner: TASK-1; protocol trace proves codeAction absence, empty direct response and zero writes. |
| CHK-FR3-01 | FR-3 | FR-3, AC-3.1, `@feature3` | Integration test | Draft | Owner: TASK-2; diagnostic mapping matrix proves every kernel finding maps exactly once. |
| CHK-FR3-02 | FR-3 | FR-3, AC-3.1, `@feature3`, NFR-USE-1 | Integration test | Draft | Owner: TASK-13; diagnostic, hover and completion bounds/truncation are enforced. |
| CHK-FR4-01 | FR-4 | FR-4, AC-4.1, `@feature4` | Integration test | Draft | Owner: TASK-3; definition/reference parity includes ambiguity and declaration behavior. |
| CHK-FR5-01 | FR-5 | FR-5, AC-5.1, `@feature5` | Integration test | Draft | Owner: TASK-4; completion and symbol outputs are bounded kernel projections. |
| CHK-FR6-01 | FR-6 | FR-6, AC-6.1, `@feature6` | Integration test | Draft | Owner: TASK-5; hover has the exact closed kernel-only shape. |
| CHK-FR7-01 | FR-7 | FR-7, AC-7.1, `SCEN-spec-lsp-step-layer-centralized` | Integration test | Draft | Owner: TASK-6; current manifest and runtime prove no step layer. |
| CHK-FR7-02 | FR-7 | FR-7, AC-7.2, `SCEN-spec-lsp-future-step-profile` | Integration test | Blocked | Owner: TASK-12; blocked on qualified `spec-kernel:CHK-FR15-01`. Not a current read-profile member. |
| CHK-FR8-01 | FR-8 | FR-8, AC-8.1, `@feature8` | Integration test | Draft | Owner: TASK-7; real-corpus normalized `LspKernelProjectionV1` parity. |
| CHK-FR9-01 | FR-9 | FR-9, AC-9.1, `@feature9` | Integration test | Draft | Owner: TASK-9; lazy start/full didSave rebuild is measured with no 150 ms gate. |
| CHK-FR9-02 | FR-9 | FR-9, AC-9.1, `@feature9`, NFR-PERF-1 | Integration test | Draft | Owner: TASK-13; cold/warm p95, sample count and cancellation cadence use the admitted benchmark. |
| CHK-FR9-03 | FR-9 | FR-9, AC-9.1, `@feature9`, NFR-MEM-1 | Integration test | Draft | Owner: TASK-13; peak RSS and one-shared-graph/no-step-index invariants. |
| CHK-FR10-01 | FR-10 | FR-10, AC-10.1, `@feature10` | Integration test | Draft | Owner: TASK-10; contained root, no-op and separate availability status all hold. |
| CHK-FR10-02 | FR-10 | FR-10, AC-10.1, `@feature10`, NFR-SEC-1 | Integration test | Draft | Owner: TASK-13; traversal/link/reparse, path minimization and zero-write/subprocess checks. |
| CHK-FR10-03 | FR-10 | FR-10, AC-10.1, `@feature10`, NFR-REL-1 | Integration test | Draft | Owner: TASK-13; repeated outputs are deterministic and graph absence stays honest. |
| CHK-FR11-01 | FR-11 | FR-11, AC-11.1, `@feature11` | Integration test | Draft | Owner: TASK-8; installed dependency-absent and binary-free smoke. |
| CHK-FR11-02 | FR-11 | FR-11, AC-11.1, `@feature11`, NFR-SIZE-1 | Integration test | Draft | Owner: TASK-13; installed uncompressed/gzip size measurements include bundled libraries/licenses. |
| CHK-FR11-03 | FR-11 | FR-11, AC-11.1, `@feature11`, NFR-PORT-1 | Integration test | Draft | Owner: TASK-13; dependency-absent smoke passes on every supported OMP platform. |
| CHK-FR12-01 | FR-12 | FR-12, AC-12.1, `@feature12` | Integration test | Draft | Owner: TASK-6 and TASK-11; current release proves step/oracle absence only. |

## Non-functional traceability

| NFR | Related requirement/check | Task | Verification obligation |
|---|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-latency-honest-for-this-stage) | FR-9 / CHK-FR9-02 | TASK-13 | Pinned benchmark, p95 samples, cancellation cadence and raw observations |
| [NFR-SIZE-1](NFR.md#nfr-size-1-bundle-size-without-cucumber-libraries) | FR-11 / CHK-FR11-02 | TASK-13 | Installed artifact uncompressed/gzip measurements including bundled libraries |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound) | FR-9 / CHK-FR9-03 | TASK-13 | Peak incremental RSS and proof of one shared graph/no step index |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-10 / CHK-FR10-02 | TASK-13 | Traversal/link/reparse variants, relative-path output and zero-write/subprocess checks |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-honest-absence) | FR-10 / CHK-FR10-03 | TASK-13 | Repeated determinism plus separate availability-status behavior |
| [NFR-PORT-1](NFR.md#nfr-port-1-portable-installed-runtime) | FR-11 / CHK-FR11-03 | TASK-13 | Dependency-absent installed smoke on supported OMP platforms |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-bounded-diagnostics) | FR-3 / CHK-FR3-02 | TASK-13 | Diagnostic/hover/completion bounds and truncation markers |

## Global invariants

1. The LSP adapter is a semantic-free read projection of the `spec-kernel` query service; it adds no parsing, resolution, or verdict semantics.
2. No mutation, proposal persistence, or status transition occurs through the LSP surface. This stage does not advertise `codeAction`.
3. Every LSP diagnostic maps 1:1 to a kernel conformance finding; no adapter-specific rules exist.
4. Definition and references use the kernel anchor registry with identical ambiguity semantics.
5. This stage emits no step-binding diagnostics and does not register `@cucumber/language-server`. A future step layer requires a separately accepted kernel change.
6. Adapter-to-service parity is fingerprint-bound and fails closed on divergence.
7. The server operates only on `.specs/**` and authored `.feature` files; Markdown outside `.specs/**` is an empty no-op; external roots and symlinks are refused.
8. An absent kernel graph produces empty LSP results/diagnostics plus a separate `SpecLspAvailabilityStatusV1`; no adapter-specific diagnostic or fabricated result is allowed.
9. The installed artifact is self-contained with no third-party binaries and no cucumber libraries in this stage; the Marksman DROP stands.
10. This stage's release proves step-layer absence; oracle parity is not a member.
11. The extension, MCP adapter, and LSP adapter call one query service and do not reinterpret results. The eight first-slice MCP query tools remain registered when later names are added.


12. A read operation through the LSP surface changes zero repository bytes and creates zero state artifacts.
13. Hover returns only fields stored on kernel nodes. Run result, provenance, and freshness are out of scope until `spec-evidence` lands.
14. 150 ms incremental rebuild is not a release gate until `spec-kernel` accepts an incremental rebuild check.
