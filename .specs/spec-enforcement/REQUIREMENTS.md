# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario tag | Story / Use case | Status |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-event-surface-selection-and-pinning) | Event-surface selection | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-event-subscriptions-match-the-pinned-claim-set) | `@feature1` | [US-4](USER_STORIES.md#us-4-release-owner-verifying-self-contained-distribution), [UC-8](USE_CASES.md#uc-8-release-the-enforcement-artifact) | Specified |
| [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection) | Informational mode diagnostics | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-diagnostics-are-injected-only-in-informational-mode), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-corpus-census-is-injected-on-session-start) | `@feature2` | [US-2](USER_STORIES.md#us-2-agent-receiving-diagnostic-context-about-spec-corpus-state), [UC-1](USE_CASES.md#uc-1-inject-kernel-diagnostics-on-spec-file-read), [UC-2](USE_CASES.md#uc-2-inject-corpus-census-on-session-start) | Specified |
| [FR-3](FR.md#fr-3-enforcement-mode-write-interception) | Enforcement write interception | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-spec-writes-are-blocked-or-redirected-in-enforcement-mode) | `@feature3` | [US-1](USER_STORIES.md#us-1-spec-corpus-owner-protected-from-uncontrolled-writes), [UC-3](USE_CASES.md#uc-3-block-a-direct-spec-write-in-enforcement-mode), [UC-4](USE_CASES.md#uc-4-allow-a-non-spec-write-in-enforcement-mode) | Specified |
| [FR-4](FR.md#fr-4-fail-honest-policy) | Fail-honest policy | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-hook-errors-produce-explicit-visible-messages) | `@feature4` | [US-3](USER_STORIES.md#us-3-session-owner-whose-workflow-never-breaks-on-hook-failure), [UC-5](USE_CASES.md#uc-5-surface-explicit-failure-on-kernel-absence) | Specified |
| [FR-5](FR.md#fr-5-no-hidden-state) | No hidden state | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-no-state-exists-outside-event-visible-records) | `@feature5` | [US-5](USER_STORIES.md#us-5-privacy-conscious-operator-with-no-hidden-state) | Specified |
| [FR-6](FR.md#fr-6-dependency-safe-distribution) | Dependency-safe distribution | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-hooks-execute-dependency-absent) | `@feature6` | [US-4](USER_STORIES.md#us-4-release-owner-verifying-self-contained-distribution), [UC-8](USE_CASES.md#uc-8-release-the-enforcement-artifact) | Specified |
| [FR-7](FR.md#fr-7-no-bypass-paths) | No bypass paths | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-all-write-surfaces-to-specs-are-intercepted) | `@feature7` | [US-1](USER_STORIES.md#us-1-spec-corpus-owner-protected-from-uncontrolled-writes), [UC-7](USE_CASES.md#uc-7-verify-no-bypass-paths-exist) | Specified |
| [FR-8](FR.md#fr-8-degradation-ladder) | Degradation ladder | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-enforcement-is-inert-before-cumulative-gate-acceptance) | `@feature8` | [US-3](USER_STORIES.md#us-3-session-owner-whose-workflow-never-breaks-on-hook-failure), [UC-5](USE_CASES.md#uc-5-surface-explicit-failure-on-kernel-absence), [UC-6](USE_CASES.md#uc-6-degrade-honestly-when-authoring-door-is-absent) | Specified |
| [FR-9](FR.md#fr-9-stage-gated-activation) | Stage-gated activation | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-enforcement-activates-only-after-cumulative-gate) | `@feature9` | [US-6](USER_STORIES.md#us-6-stage-gated-activation-observer), [UC-6](USE_CASES.md#uc-6-degrade-honestly-when-authoring-door-is-absent) | Specified |
| [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only) | Kernel-only diagnostics | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-diagnostics-originate-from-spec-kernel-only) | `@feature10` | [US-2](USER_STORIES.md#us-2-agent-receiving-diagnostic-context-about-spec-corpus-state), [UC-1](USE_CASES.md#uc-1-inject-kernel-diagnostics-on-spec-file-read) | Specified |
| [FR-11](FR.md#fr-11-release-eligibility-conjunction) | Release conjunction | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-release-gate-is-a-closed-conjunction) | `@feature11` | [US-4](USER_STORIES.md#us-4-release-owner-verifying-self-contained-distribution), [UC-8](USE_CASES.md#uc-8-release-the-enforcement-artifact) | Specified |

## Contract checks

| Check | Contract | Trace | Future evidence | State |
|---|---|---|---|---|
| CHK-FR1-01 | Live ABI probes: `tool_call` emits for write/edit/bash with inspectable target/input; `tool_result` fires post-execution with override support; `context` supplies deep copy; `session_start` fires once per session | FR-1, AC-1.1, `@feature1` | TASK-1 probe receipts bound to runtime pin | Not recorded |
| CHK-FR2-01 | Diagnostic injection present only in informational mode; bounded ≤2 KiB per tool_result; kernel findings only; no blocking | FR-2, AC-2.1, `@feature2` | Integration suite with kernel mock | Not recorded |
| CHK-FR2-02 | Census injection on session_start; bounded ≤4 KiB; deep-copy-only mutation | FR-2, AC-2.2, `@feature2` | Context-event contract test | Not recorded |
| CHK-FR3-01 | Matching spec writes blocked with redirect reason; non-matching writes pass; path normalization correct | FR-3, AC-3.1, `@feature3` | Write-interception fixture matrix | Not recorded |
| CHK-FR4-01 | Each planted fault produces explicit visible message; no silent pass-through; no fake success | FR-4, AC-4.1, `@feature4` | Fault-injection integration suite | Not recorded |
| CHK-FR5-01 | No files created outside session-local temp; no network calls; no persistent state | FR-5, AC-5.1, `@feature5` | Filesystem and network audit across sessions | Not recorded |
| CHK-FR6-01 | Dependency-absent installed smoke loads hooks; hook absence degrades honestly | FR-6, AC-6.1, `@feature6` | Installed-artifact smoke plus hash inventory | Not recorded |
| CHK-FR7-01 | All write surfaces (write, edit, bash, extension tools) intercepted; no bypass config | FR-7, AC-7.1, `@feature7` | Adversarial bypass attempt matrix | Not recorded |
| CHK-FR8-01 | Kernel absent → informational absent with reason; door absent → enforcement disabled by stage | FR-8, AC-8.1, `@feature8` | Degradation ladder fixture matrix | Not recorded |
| CHK-FR9-01 | Enforcement inert before cumulative gate; active after acceptance; cached per session | FR-9, AC-9.1, `@feature9` | Gate-status toggle integration test | Not recorded |
| CHK-FR10-01 | All diagnostic content traces to spec-kernel:FR-6; no private rules | FR-10, AC-10.1, `@feature10` | Diagnostic origin audit | Not recorded |
| CHK-FR11-01 | Release conjunction passes only on exact all-PASS bound profile; one-fault-at-a-time matrix fails closed | FR-11, AC-11.1, `@feature11` | Evidence manifests plus negative matrix | Not recorded |

## Non-functional traceability

| NFR | Related requirements | Verification obligation |
|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-hook-handler-latency) | FR-1, FR-2, FR-3 | Latency samples on reference corpus with raw observations |
| [NFR-SIZE-1](NFR.md#nfr-size-1-artifact-and-message-size) | FR-2, FR-3, FR-6 | Artifact delta, diagnostic/reason byte measurement |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound) | FR-2, FR-9 | Peak incremental RSS on reference corpus |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-3, FR-5, FR-7 | Containment variants, leak scan of reasons/diagnostics |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-fail-honest-results) | FR-4, FR-8 | Repeated-run byte-identical result comparison on Windows and POSIX |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-block-and-diagnostic-content) | FR-3, FR-4, FR-10 | Block/diagnostic golden comparison with redirect/finding presence |

## Global invariants

1. Blocking occurs only in enforcement mode after cumulative gate acceptance; informational mode never blocks.
2. The match predicate touches no filesystem or kernel for non-matching tool calls.
3. Diagnostic content originates exclusively from `spec-kernel:FR-6`; no private rule set exists.
4. One `tool_call` match produces at most one block result and zero repository mutations.
5. No state persists outside event-visible records and session-local temporary storage.
6. Handler exceptions are caught within the handler; they never propagate to the OMP wrapper.
7. Degradation is always explicit; silent pass-through and fake success are invariant violations.
8. Path matching normalizes separators, rejects traversal/symlinks, and stays inside the project root.
9. Gate status is evaluated once at `session_start` and cached; mid-session re-evaluation does not occur.
10. Scenario text and structural parsing never imply executed/passing evidence.
