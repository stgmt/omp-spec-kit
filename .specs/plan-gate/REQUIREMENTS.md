# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario | Delivery task | State |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-exact-plan-input-and-future-automatic-approval-event) | Exact manual input and future selected-plan event | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-interception-and-resolution-are-deterministic), [AC-1.2](ACCEPTANCE_CRITERIA.md#ac-12-session-identity-and-slug-normalization-are-pinned) | `@feature1`, `SCEN-approval-interception-and-plan-resolution`, `SCEN-session-transition-plan-resolution` | TASK-1, TASK-5, TASK-11 | Manual specified; automatic deferred |
| [FR-2](FR.md#fr-2-fail-open-bridge-policy) | Internal fail-open before outer fail-closed timeout | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-every-gate-fault-path-allows) | `@feature2`, `SCEN-every-gate-fault-allows` | TASK-5, TASK-9, TASK-11 | Specified |
| [FR-3](FR.md#fr-3-mode-scoped-preventive-contract) | Mode-scoped advisory/context contract | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-injection-is-plan-mode-scoped-and-bounded) | `@feature3`, `SCEN-plan-mode-contract-injection` | TASK-7, TASK-11 | Manual specified; automatic deferred |
| [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation) | Pure structure validation | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-mandatory-skeleton-failures-block-with-line-hints) | `@feature4`, `SCEN-skeleton-structure-validation-blocks` | TASK-2, TASK-3, TASK-6 | Specified |
| [FR-5](FR.md#fr-5-duplicate-plan-detection) | Explicit-candidate duplicate detection | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-byte-duplicate-plans-are-detected-deterministically) | `@feature5`, `SCEN-duplicate-plan-blocked` | TASK-3, TASK-5 | Specified |
| [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding) | Explicit prompt input and deterministic grounding | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-grounding-is-deterministic-and-cache-degrades-open) | `@feature6`, `SCEN-grounding-blocks-and-cache-degrades-open` | TASK-3, TASK-7 | Specified |
| [FR-7](FR.md#fr-7-file-change-cross-reference-validation) | File-change cross-reference validation | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-contaminated-file-changes-are-refused) | `@feature7`, `SCEN-file-change-cross-reference-blocks` | TASK-3 | Specified |
| [FR-8](FR.md#fr-8-extracted-requirements-obligation) | Extracted-requirements obligation | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-extracted-requirements-are-mandatory) | `@feature8`, `SCEN-extracted-requirements-enforced` | TASK-3 | Specified |
| [FR-9](FR.md#fr-9-spec-reference-enforcement) | Complete supplied index and contained manual reads | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-spec-touching-plans-require-existing-qualified-references) | `@feature9`, `SCEN-spec-references-enforced-against-disk` | TASK-2, TASK-4, TASK-5, TASK-6, TASK-9 | Specified |
| [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics) | Paged findings and bounded reason | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-deny-reason-is-actionable-and-bounded) | `@feature10`, `SCEN-deny-format-is-actionable` | TASK-2, TASK-5, TASK-9 | Specified |
| [FR-11](FR.md#fr-11-self-contained-in-process-runtime) | Self-contained installed runtime | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-installed-gate-executes-dependency-absent) | `@feature11`, `SCEN-self-contained-gate-artifact` | TASK-8, TASK-11 | Specified by profile |
| [FR-12](FR.md#fr-12-real-fixtures-and-provenance) | Real fixtures | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-fixtures-are-real-hashed-and-reconciled) | `@feature12`, `SCEN-plan-gate-real-fixture-provenance` | TASK-2, TASK-6 | Specified |
| [FR-13](FR.md#fr-13-release-eligibility-conjunction) | Manual and automatic release conjunctions | [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-gate-is-a-closed-conjunction) | `@feature13`, `SCEN-plan-gate-release-conjunction-fails-closed` | TASK-10, TASK-11 | Specified by profile |

## Contract checks

| Check | Requirement | Trace | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | MANUAL exact URL/content/hash/title/slug and SAME_SESSION binding; no scan/fallback | FR-1, AC-1.1, `SCEN-approval-interception-and-plan-resolution` | Integration test | Draft | Owner: TASK-1, TASK-5; evidence: Request/identity matrix. |
| CHK-FR1-02 | AUTOMATIC A→B transition IDs/kind/copied-plan hash remain exact; foreign/mismatched identity is diagnosed | FR-1, AC-1.2, `SCEN-session-transition-plan-resolution` | Integration test | Blocked | Owner: TASK-11; evidence: Supported-host transition receipt. |
| CHK-FR2-01 | Every plan/candidate/cache/index/resource/containment/exception/deadline bridge fault returns ALLOW before 20 s; complete validation errors alone BLOCK | FR-2, AC-2.1, `SCEN-every-gate-fault-allows` | Integration test | Draft | Owner: TASK-5, TASK-9; evidence: Exhaustive fault matrix with elapsed times. |
| CHK-FR3-MANUAL-01 | MANUAL guidance is advisory and never changes validation | FR-3, AC-3.1, `SCEN-plan-mode-contract-injection` | Integration test | Draft | Owner: TASK-7; evidence: Manual output matrix. |
| CHK-FR3-AUTOMATIC-01 | AUTOMATIC context output is possible only from `planMode:true` selected event and never changes validation | FR-3, AC-3.1, `SCEN-plan-mode-contract-injection` | Integration test | Blocked | Owner: TASK-11; evidence: Supported-host context receipt. |
| CHK-FR4-01 | Each structure variant yields exact line/code/hint; complete fixture passes | FR-4, AC-4.1, `SCEN-skeleton-structure-validation-blocks` | Integration test | Draft | Owner: TASK-2, TASK-3, TASK-6; evidence: Real-fixture census. |
| CHK-FR5-01 | Explicit candidates only; duplicate blocks; size short-circuit; unreadable declaration yields `DUPLICATE_INPUT_UNAVAILABLE` | FR-5, AC-5.1, `SCEN-duplicate-plan-blocked` | Integration test | Draft | Owner: TASK-3, TASK-5; evidence: Candidate access/hash instrumentation. |
| CHK-FR6-01 | Five-or-fewer prompt excerpts score deterministically at exact `-20`; empty skips; malformed/over-budget allows diagnostically | FR-6, AC-6.1, `SCEN-grounding-blocks-and-cache-degrades-open` | Integration test | Draft | Owner: TASK-3, TASK-7; evidence: Borderline relevance vectors. |
| CHK-FR7-01 | Above 0.5 unmentioned ratio blocks; at/below passes | FR-7, AC-7.1, `SCEN-file-change-cross-reference-blocks` | Integration test | Draft | Owner: TASK-3; evidence: Cross-reference fixture pairs. |
| CHK-FR8-01 | Missing/under-count Extracted Requirements blocks; two items pass | FR-8, AC-8.1, `SCEN-extracted-requirements-enforced` | Integration test | Draft | Owner: TASK-3; evidence: Phase fixture variants. |
| CHK-FR9-01 | Exact guarded policy triggers complete-index validation; missing IDs block; absent/partial/unreadable/containment/budget failures yield `SPEC_INDEX_UNAVAILABLE` | FR-9, AC-9.1, `SCEN-spec-references-enforced-against-disk` | Integration test | Draft | Owner: TASK-2, TASK-4, TASK-5, TASK-6, TASK-9; evidence: Guarded resource hash + real tree fault matrix. |
| CHK-FR10-01 | Structured paging preserves every finding; 16 KiB reason reports exact omitted count/cursor and optional complete excerpts | FR-10, AC-10.1, `SCEN-deny-format-is-actionable` | Integration test | Draft | Owner: TASK-2, TASK-5, TASK-9; evidence: Golden reason/page reconciliation. |
| CHK-FR11-MANUAL-01 | Installed manual profile runs dependency-absent with exact bundled resources | FR-11, AC-11.1, `SCEN-self-contained-gate-artifact` | Integration test | Draft | Owner: TASK-8; evidence: Installed manual smoke/resource hashes. |
| CHK-FR11-AUTOMATIC-01 | Installed automatic profile consumes a captured supported-host event | FR-11, AC-11.1, `SCEN-self-contained-gate-artifact` | Integration test | Blocked | Owner: TASK-11; evidence: Installed automatic event smoke. |
| CHK-FR12-01 | Fixture hashes/sizes/provenance/ground truth reconcile | FR-12, AC-12.1, `SCEN-plan-gate-real-fixture-provenance` | Integration test | Draft | Owner: TASK-2, TASK-6; evidence: Fixture admission report. |
| CHK-FR13-01 | Evaluator returns closed candidate-bound eligibility/state/blockers and every one-fault manifest variant fails | FR-13, AC-13.1, `SCEN-plan-gate-release-conjunction-fails-closed` | Integration test | Draft | Owner: TASK-10, TASK-11; evidence: Evaluator result/negative matrix. |
| CHK-HOST-ABI-01 | Exact host emits selected-plan event after native resolution with transition binding, block/allow and timeout ordering | FR-1, FR-2, FR-3, AC-1.1, AC-1.2, AC-2.1, AC-3.1, `SCEN-session-transition-plan-resolution`, `SCEN-plan-mode-contract-injection` | Integration test | Blocked | Owner: TASK-11; evidence: Source/behavior receipt, artifact digest, version/commit. |

## Non-functional traceability

| NFR | Related requirements | Delivery task | Verification obligation |
|---|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-validation-latency) | FR-1, FR-2, FR-4, FR-6, FR-9 | TASK-8, TASK-9, TASK-11 | Raw latency samples; all internal exits before 20 s |
| [NFR-SIZE-1](NFR.md#nfr-size-1-artifact-and-message-size) | FR-10, FR-11 | TASK-2, TASK-8 | Artifact delta and exact byte-budget observations |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound) | FR-4, FR-5 | TASK-8 | Peak incremental RSS on bounded corpus |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-1, FR-6, FR-9 | TASK-4, TASK-9 | Realpath/reparse/symlink and redaction matrix |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-fail-open-results) | FR-2, FR-4, FR-6, FR-7 | TASK-9 | Repeated byte-identical results on Windows/POSIX |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-deny-content) | FR-10 | TASK-5 | Finding/page/reason reconciliation |

## Global invariants

1. Only a complete successful validation with one or more ERROR findings can BLOCK.
2. MANUAL validates one explicit plan; AUTOMATIC accepts only `selected-plan-event@1` after native resolution.
3. No mode scans plan directories, guesses temp roots, or repeats native fallback selection.
4. The pure validator performs no I/O and consumes only a complete closed input.
5. Adapter unreadable, containment, partial-input, resource, exception, and internal-deadline failures return ALLOW plus one bounded diagnostic.
6. Every handler returns before the 30-second outer host timeout; outer timeout/error is fail-closed and an implementation defect.
7. Duplicate detection uses at most 20 explicit candidates/8 MiB; prompt grounding uses at most five excerpts/64 KiB and exact threshold `-20`.
8. Spec-reference validation never reasons from a partial index.
9. Structured findings preserve total counts and paging; the 16 KiB reason never truncates a finding row or lies about completeness.
10. Automatic eligibility cannot pass without `CHK-HOST-ABI-01` for the exact host pin.
11. Manual eligibility does not imply automatic interception.
12. Scenario text and specification structure are not execution evidence.
