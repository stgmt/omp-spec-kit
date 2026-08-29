# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario | Delivery task | State |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-event-surface-selection-and-pinning) | Pinned event surface and classify-every-call entry | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-event-subscriptions-match-the-pinned-claim-set) | `@feature1`, `SCEN-event-surface-selection` | TASK-1, TASK-7 | Specified |
| [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection) | Informational kernel/census projection | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-diagnostics-are-injected-only-in-informational-mode), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-corpus-census-is-injected-on-session-start) | `@feature2`, `SCEN-informational-mode-diagnostic-injection`, `SCEN-corpus-census-session-start` | TASK-5, TASK-6 | Specified |
| [FR-3](FR.md#fr-3-enforcement-mode-write-interception) | Effect classification, I/O containment, qualified redirect | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-spec-writes-are-blocked-or-redirected-in-enforcement-mode) | `@feature3`, `SCEN-enforcement-mode-write-interception` | TASK-2, TASK-3 | Specified |
| [FR-4](FR.md#fr-4-fail-honest-policy) | Visible non-safety degradation and conservative safety blocks | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-hook-errors-produce-explicit-visible-messages) | `@feature4`, `SCEN-fail-honest-policy` | TASK-3, TASK-7, TASK-8 | Specified |
| [FR-5](FR.md#fr-5-no-hidden-state) | No hidden persistent state or FR-39 overclaim | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-no-state-exists-outside-event-visible-records) | `@feature5`, `SCEN-no-hidden-state` | TASK-7, TASK-8 | Specified; FR-39 audit deferred |
| [FR-6](FR.md#fr-6-dependency-safe-distribution) | Dependency-absent installed runtime | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-hooks-execute-dependency-absent) | `@feature6`, `SCEN-dependency-safe-distribution` | TASK-7, TASK-10 | Specified |
| [FR-7](FR.md#fr-7-no-bypass-paths) | Closed all-tool registry and authority manifest | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-all-write-surfaces-to-specs-are-intercepted) | `@feature7`, `SCEN-no-bypass-paths` | TASK-1, TASK-2, TASK-3, TASK-8 | Specified |
| [FR-8](FR.md#fr-8-degradation-ladder) | Explicit degradation ladder | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-enforcement-is-inert-before-cumulative-gate-acceptance) | `@feature8`, `SCEN-degradation-ladder` | TASK-4, TASK-7 | Specified |
| [FR-9](FR.md#fr-9-stage-gated-activation) | Same-candidate product/authoring/enforcement gate | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-enforcement-activates-only-after-cumulative-gate) | `@feature9`, `SCEN-stage-gated-activation` | TASK-4, TASK-10 | Specified |
| [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only) | Kernel-only conformance; separate policy diagnostics | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-diagnostics-originate-from-spec-kernel-only), [AC-10.2](ACCEPTANCE_CRITERIA.md#ac-102-no-independent-conformance-path-exists-in-the-extension) | `@feature10`, `SCEN-diagnostics-are-kernel-findings-only` | TASK-5, TASK-7, TASK-8 | Specified |
| [FR-11](FR.md#fr-11-release-eligibility-conjunction) | Capability-only release conjunction | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-release-gate-is-a-closed-conjunction) | `@feature11`, `SCEN-spec-enforcement-release-conjunction-fails-closed` | TASK-9, TASK-10 | Specified |

## Contract checks

| Check | Contract | Trace | Delivery task | Required evidence | State |
|---|---|---|---|---|---|
| CHK-FR1-01 | Pinned current hook fields prove provider identity absent; future host authority ABI plus candidate-bundled installed names/schema/provider identities reconcile | FR-1, AC-1.1, `SCEN-event-surface-selection` | TASK-1 | Current-absence and future host-ABI/installed-registry receipts with candidate hashes | Not recorded |
| CHK-FR2-01 | Informational read result adds <=2 KiB of kernel-only findings and never blocks | FR-2, AC-2.1, `SCEN-informational-mode-diagnostic-injection` | TASK-5 | Event integration report | Not recorded |
| CHK-FR2-02 | Session census injects once, <=4 KiB, deep-copy-only | FR-2, AC-2.2, `SCEN-corpus-census-session-start` | TASK-6 | Session/context receipt | Not recorded |
| CHK-FR3-01 | Exact authority/read-only/proven non-spec calls allow; spec/unknown/zero-target/incomplete/authority/containment cases block | FR-3, AC-3.1, `SCEN-enforcement-mode-write-interception` | TASK-2, TASK-3 | Request/classification/resolution/decision matrix | Not recorded |
| CHK-FR4-01 | Informational faults diagnose without block; enforcement safety faults block visibly; no handler exception escapes | FR-4, AC-4.1, `SCEN-fail-honest-policy` | TASK-7, TASK-8 | Fault-injection report | Not recorded |
| CHK-FR5-01 | No persistent/private state, network, subprocess, credential access, alternate query tool, or FR-39 audit claim | FR-5, AC-5.1, `SCEN-no-hidden-state` | TASK-7, TASK-8 | Filesystem/network/export audit | Not recorded |
| CHK-FR6-01 | Existing extension entry runs installed dependency-absent with exact bundled manifest | FR-6, AC-6.1, `SCEN-dependency-safe-distribution` | TASK-7, TASK-10 | Installed smoke and dist manifest hashes | Not recorded |
| CHK-FR7-01 | Exact 17-name V1/additive seven-name V2 authority, input-schema registry equality and new/renamed/dynamic/zero-target/spoof variants prevent bypass | FR-7, AC-7.1, `SCEN-no-bypass-paths` | TASK-1, TASK-2, TASK-8 | Adversarial all-tool/authority matrix | Not recorded |
| CHK-FR8-01 | Pre-gate product/authority absence disables enforcement; post-acceptance kernel loss disables only projections and preserves write gate | FR-8, AC-8.1, `SCEN-degradation-ladder` | TASK-4, TASK-7 | Degradation matrix | Not recorded |
| CHK-FR9-01 | Same-candidate `SPEC_ENFORCEMENT` activates; mismatched evidence or missing host ABI refuses; installed/event registry drift stays conservative | FR-9, AC-9.1, `SCEN-stage-gated-activation` | TASK-4, TASK-10 | Product binding/registry drift report | Not recorded |
| CHK-FR10-01 | Every injected conformance finding traces to a runtime `spec-kernel:FR-6` record; policy diagnostics never alias | FR-10, AC-10.1, `SCEN-diagnostics-are-kernel-findings-only` | TASK-5, TASK-8 | Origin reconciliation | Not recorded |
| CHK-FR10-02 | Installed bundle contains no private spec parser/rule/validator/finding producer; effect/containment policy emits no conformance | FR-10, AC-10.2, `SCEN-diagnostics-are-kernel-findings-only` | TASK-7, TASK-8 | Bundle/export/dependency audit | Not recorded |
| CHK-FR11-01 | Evaluator re-hashes bytes and rejects every one-fault candidate manifest; this check is not an input record | FR-11, AC-11.1, `SCEN-spec-enforcement-release-conjunction-fails-closed` | TASK-9, TASK-10 | Evaluator one-fault-at-a-time matrix | Not recorded |

## Non-functional traceability

| NFR | Related requirements | Delivery task | Verification obligation |
|---|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-hook-handler-latency) | FR-1, FR-2, FR-3 | TASK-2, TASK-3, TASK-10 | Raw classifier/resolver/event latency samples |
| [NFR-SIZE-1](NFR.md#nfr-size-1-artifact-and-message-size) | FR-2, FR-3, FR-6 | TASK-7, TASK-10 | Artifact/message/reason byte measurements |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound) | FR-2, FR-9 | TASK-10 | Peak RSS and census cache observations |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-3, FR-5, FR-7 | TASK-3, TASK-8 | Windows reparse/POSIX symlink/outside-root/dynamic-target matrix |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-fail-honest-results) | FR-4, FR-8 | TASK-8 | Repeated byte-identical decisions/diagnostics |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-block-and-diagnostic-content) | FR-3, FR-4, FR-10 | TASK-5, TASK-8 | Qualified redirect and record-kind golden output |

## Global invariants

1. Informational mode never blocks; accepted enforcement mode classifies every tool call.
2. Only exact same-candidate `omp-spec-kit` authoring authority may mutate specs through the sanctioned service.
3. A known raw writer passes only when exhaustive extraction plus the I/O resolver prove every target non-spec.
4. Unknown, changed, incomplete, dynamic, authority-mismatched, or containment-indeterminate calls block in enforcement mode.
5. Pure classification performs no filesystem claim; realpath/reparse/symlink truth belongs to the resolver.
6. Enforcement cannot activate without host-authenticated authority ABI; after activation, installed/event registry drift never opens a bypass and unmatched tools become `UNKNOWN`.
7. Spec-conformance findings originate exclusively from `spec-kernel:FR-6`; policy diagnostics are a separate kind.
8. The capability adds no private spec parser/rule/finding producer, alternate writer/query surface, persistent audit, network, subprocess, or credential access.
9. Product evaluator owns `SPEC_ENFORCEMENT` delivery; FR-11 returns capability eligibility only.
10. FR-39 persistent audit remains `DEFER`.
11. Scenario text and structural parsing are not execution evidence.
