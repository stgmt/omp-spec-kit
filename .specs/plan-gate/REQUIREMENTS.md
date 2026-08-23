# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario tag | Story / Use case | Status |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-approval-interception-and-deterministic-plan-resolution) | Approval interception and plan resolution | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-interception-and-resolution-are-deterministic) | `@feature1` | [US-1](USER_STORIES.md#us-1-approver-protected-from-ungrounded-plans), [UC-1](USE_CASES.md#uc-1-block-a-duplicated-plan) | Specified |
| [FR-2](FR.md#fr-2-fail-open-bridge-policy) | Fail-open fault policy | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-every-gate-fault-path-allows) | `@feature2` | [US-3](USER_STORIES.md#us-3-session-owner-whose-workflow-never-breaks-on-gate-failure), [UC-6](USE_CASES.md#uc-6-allow-through-gate-faults) | Specified |
| [FR-3](FR.md#fr-3-preventive-contract-injection) | Plan-mode contract injection | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-injection-is-plan-mode-scoped-and-bounded) | `@feature3` | [US-6](USER_STORIES.md#us-6-plan-author-working-in-native-plan-mode), [UC-7](USE_CASES.md#uc-7-inject-the-plan-contract-during-plan-mode) | Specified |
| [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation) | Structure validation | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-mandatory-skeleton-failures-block-with-line-hints) | `@feature4` | [US-1](USER_STORIES.md#us-1-approver-protected-from-ungrounded-plans), [UC-2](USE_CASES.md#uc-2-block-a-plan-missing-mandatory-structure) | Specified |
| [FR-5](FR.md#fr-5-duplicate-plan-detection) | Duplicate detection | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-byte-duplicate-plans-are-detected-deterministically) | `@feature5` | [US-1](USER_STORIES.md#us-1-approver-protected-from-ungrounded-plans), [UC-1](USE_CASES.md#uc-1-block-a-duplicated-plan) | Specified |
| [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding) | Prompt cache and grounding | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-grounding-is-deterministic-and-cache-degrades-open) | `@feature6` | [US-1](USER_STORIES.md#us-1-approver-protected-from-ungrounded-plans), [UC-3](USE_CASES.md#uc-3-block-an-ungrounded-plan) | Specified |
| [FR-7](FR.md#fr-7-file-change-cross-reference-validation) | Cross-reference validation | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-contaminated-file-changes-are-refused) | `@feature7` | [US-1](USER_STORIES.md#us-1-approver-protected-from-ungrounded-plans), [UC-4](USE_CASES.md#uc-4-block-a-plan-whose-file-changes-do-not-match-its-body) | Specified |
| [FR-8](FR.md#fr-8-extracted-requirements-obligation) | Extracted requirements | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-extracted-requirements-are-mandatory) | `@feature8` | [US-1](USER_STORIES.md#us-1-approver-protected-from-ungrounded-plans), [UC-3](USE_CASES.md#uc-3-block-an-ungrounded-plan) | Specified |
| [FR-9](FR.md#fr-9-spec-reference-enforcement) | Spec-reference enforcement | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-spec-touching-plans-require-existing-qualified-references) | `@feature9` | [US-4](USER_STORIES.md#us-4-spec-corpus-owner), [UC-5](USE_CASES.md#uc-5-block-a-spec-touching-plan-without-spec-references) | Specified |
| [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics) | Deny format and diagnostics | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-deny-reason-is-actionable-and-bounded) | `@feature10` | [US-2](USER_STORIES.md#us-2-agent-that-receives-actionable-repair-guidance), [UC-2](USE_CASES.md#uc-2-block-a-plan-missing-mandatory-structure) | Specified |
| [FR-11](FR.md#fr-11-self-contained-in-process-runtime) | Self-contained runtime | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-installed-gate-executes-dependency-absent) | `@feature11` | [US-5](USER_STORIES.md#us-5-release-owner), [UC-8](USE_CASES.md#uc-8-release-the-gate-artifact) | Specified |
| [FR-12](FR.md#fr-12-real-fixtures-and-provenance) | Real fixtures | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-fixtures-are-real-hashed-and-reconciled) | `@feature12` | [US-5](USER_STORIES.md#us-5-release-owner), [UC-8](USE_CASES.md#uc-8-release-the-gate-artifact) | Specified |
| [FR-13](FR.md#fr-13-release-eligibility-conjunction) | Release conjunction | [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-gate-is-a-closed-conjunction) | `@feature13` | [US-5](USER_STORIES.md#us-5-release-owner), [UC-8](USE_CASES.md#uc-8-release-the-gate-artifact) | Specified |

## Contract checks

| Check | Contract | Trace | Future evidence | State |
|---|---|---|---|---|
| CHK-FR1-01 | Live ABI probes: model-issued propose write emits `tool_call` with inspectable target/title; runner session identity maps to the session-local plan directory name; nested dispatches do not emit | FR-1, FR-3, AC-1.1, `@feature1` | TASK-1 probe receipts bound to runtime pin | Not recorded |
| CHK-FR2-01 | Each planted fault class allows; blocking only after complete successful validation | FR-2, AC-2.1, `@feature2` | Fault-injection integration suite | Not recorded |
| CHK-FR3-01 | Injection present only in plan mode, one bounded message per event, deep-copy-only mutation | FR-3, AC-3.1, `@feature3` | Context-event contract test with plan-mode toggle | Not recorded |
| CHK-FR4-01 | Every mandatory-section/structure negative fixture yields exactly one error per violation with line/hint; complete fixture passes | FR-4, AC-4.1, `@feature4` | Structure validator census over real fixtures | Not recorded |
| CHK-FR5-01 | Identical-bytes duplicate blocks; size-differing sibling unread; removal unblocks | FR-5, AC-5.1, `@feature5` | Duplicate fixture matrix | Not recorded |
| CHK-FR6-01 | Relevance deny blocks with window excerpt; determinism across runs; empty cache skips | FR-6, AC-6.1, `@feature6` | Grounding fixture matrix incl. borderline scores | Not recorded |
| CHK-FR7-01 | Above-threshold unmentioned paths block; at/below threshold pass | FR-7, AC-7.1, `@feature7` | Cross-reference fixture pairs | Not recorded |
| CHK-FR8-01 | Missing/under-count Extracted Requirements block; two items pass | FR-8, AC-8.1, `@feature8` | Phase-two fixture variants | Not recorded |
| CHK-FR9-01 | Fabricated slug/ID and zero-reference spec-touching plans block; existing references pass; containment refusals | FR-9, AC-9.1, `@feature9` | Spec-reference fixture corpus against real `.specs` tree | Not recorded |
| CHK-FR10-01 | Deny reason renders complete errors + template ≤8 KiB + five prompts ≤16 KiB with explicit truncation; advisories never block | FR-10, AC-10.1, `@feature10` | Deny-format golden comparison | Not recorded |
| CHK-FR11-01 | Dependency-absent installed smoke runs the full pipeline with zero external I/O; resource hashes match | FR-11, AC-11.1, `@feature11` | Installed-artifact smoke plus hash inventory | Not recorded |
| CHK-FR12-01 | Fixture manifest hashes/sizes/ground truth reconcile | FR-12, AC-12.1, `@feature12` | Fixture admission test | Not recorded |
| CHK-FR13-01 | Release conjunction passes only on the exact all-PASS bound profile; one-fault-at-a-time matrix fails closed | FR-13, AC-13.1, `@feature13` | Evidence manifests plus negative matrix | Not recorded |

## Non-functional traceability

| NFR | Related requirements | Verification obligation |
|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-validation-latency) | FR-1, FR-4, FR-6, FR-9 | Latency samples on reference corpus with raw observations |
| [NFR-SIZE-1](NFR.md#nfr-size-1-artifact-and-message-size) | FR-10, FR-11 | Artifact delta, reason/denial byte measurement, cache file size |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound) | FR-4, FR-5 | Peak incremental RSS on reference plan corpus |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-1, FR-6, FR-9 | Containment variants, leak scan of reasons/diagnostics/injection |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-fail-open-results) | FR-2, FR-4, FR-6, FR-7 | Repeated-run byte-identical result comparison on Windows and POSIX |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-deny-content) | FR-10 | Deny golden comparison with line/hint/template/prompt presence |

## Global invariants

1. Blocking occurs only after a complete successful validation run returning one or more blocking errors; every other outcome allows.
2. The match predicate touches no filesystem for non-matching tool calls.
3. Plan files are read only from the session-local plan directory; spec documents only from `<project-root>/.specs/<referenced-slug>/`.
4. One `tool_call` match produces at most one validation run and at most one blocking result.
5. Duplicate detection compares content hashes; file names never influence the duplicate verdict.
6. The relevance score is a pure function of plan text and cached prompt texts; identical inputs give identical scores on all platforms.
7. Cache and diagnostic state live only inside the session-local directory; the repository receives zero gate writes.
8. The deny reason preserves complete error entries under truncation; error list integrity outranks template and prompt excerpts.
9. Qualified spec references are verified against disk bytes at validation time; nothing is cached across runs.
10. Advisory (phase-4-class) findings never participate in the block decision in this release.
11. Injection mutates only the event deep copy; session-stored messages and repository bytes are invariant under the gate.
12. Scenario text and structural parsing never imply executed/passing evidence.
