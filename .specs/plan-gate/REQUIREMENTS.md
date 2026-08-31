# Requirements Matrix

## Functional traceability

| Requirement | Acceptance criterion | Scenario | Check | Delivery task | State |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-exact-manual-validation-contract) | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-exact-request-produces-a-typed-result) | `@feature1`, `SCEN-exact-plan-request` | CHK-FR1-01 | TASK-1 | Specified |
| [FR-2](FR.md#fr-2-input-integrity-and-truthful-unavailability) | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-integrity-and-runtime-failures-are-unavailable) | `@feature2`, `SCEN-unavailable-is-not-valid` | CHK-FR2-01 | TASK-1 | Specified |
| [FR-3](FR.md#fr-3-native-compatible-actionable-content) | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-actionable-content-is-required-without-a-fixed-template) | `@feature3`, `SCEN-actionable-plan-content` | CHK-FR3-01 | TASK-2 | Specified |
| [FR-4](FR.md#fr-4-optional-request-alignment-is-advisory) | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-request-alignment-never-blocks) | `@feature4`, `SCEN-request-alignment-warning` | CHK-FR4-01 | TASK-2 | Specified |
| [FR-5](FR.md#fr-5-bounded-deterministic-findings) | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-findings-are-complete-bounded-and-stable) | `@feature5`, `SCEN-bounded-deterministic-findings` | CHK-FR5-01 | TASK-2 | Specified |
| [FR-6](FR.md#fr-6-pure-and-self-contained-execution) | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-the-installed-validator-has-no-side-effects) | `@feature6`, `SCEN-installed-validator-is-pure` | CHK-FR6-01 | TASK-3 | Specified |
| [FR-7](FR.md#fr-7-real-fixture-provenance) | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-real-fixtures-reconcile-with-ground-truth) | `@feature7`, `SCEN-real-plan-fixtures-reconcile` | CHK-FR7-01 | TASK-4 | Specified |

## Contract checks

| Check | Requirement | Trace | Verification Method | Status | Owner and evidence |
|---|---|---|---|---|---|
| CHK-FR1-01 | Closed request and result shape | FR-1, AC-1.1, `SCEN-exact-plan-request` | Integration test | Draft | TASK-1; exact request/result vectors |
| CHK-FR2-01 | Digest, bound, shape, and failure branches return `UNAVAILABLE` | FR-2, AC-2.1, `SCEN-unavailable-is-not-valid` | Integration test | Draft | TASK-1; one-fault matrix |
| CHK-FR3-01 | Every semantic field and destructive-impact branch has positive and negative coverage | FR-3, AC-3.1, `SCEN-actionable-plan-content` | Integration test | Draft | TASK-2; native plan fixture matrix |
| CHK-FR4-01 | Disjoint request text emits only a warning | FR-4, AC-4.1, `SCEN-request-alignment-warning` | Integration test | Draft | TASK-2; token vectors |
| CHK-FR5-01 | Ordering, row bounds, and omitted count are exact and repeatable | FR-5, AC-5.1, `SCEN-bounded-deterministic-findings` | Integration test | Draft | TASK-2; sixty-finding vector |
| CHK-FR6-01 | Installed module runs dependency-absent with zero side effects | FR-6, AC-6.1, `SCEN-installed-validator-is-pure` | Integration test | Draft | TASK-3; installed-artifact instrumentation |
| CHK-FR7-01 | Real fixture provenance, hashes, sizes, and results reconcile | FR-7, AC-7.1, `SCEN-real-plan-fixtures-reconcile` | Integration test | Draft | TASK-4; fixture admission report |

## Non-functional traceability

| NFR | Related requirements | Delivery task | Verification obligation |
|---|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-bounded-latency) | FR-1, FR-3, FR-5 | TASK-3 | Recorded 1 MiB latency samples |
| [NFR-SIZE-1](NFR.md#nfr-size-1-bounded-input-and-output) | FR-2, FR-5 | TASK-1, TASK-2 | Boundary and overflow vectors |
| [NFR-REL-1](NFR.md#nfr-rel-1-cross-platform-determinism) | FR-1, FR-5 | TASK-2, TASK-4 | Byte-identical Windows and POSIX results |
| [NFR-SEC-1](NFR.md#nfr-sec-1-data-minimization) | FR-2, FR-6 | TASK-1, TASK-3 | Side-effect and redaction instrumentation |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-diagnostics) | FR-3, FR-5 | TASK-2, TASK-4 | Reviewed line/message/hint ground truth |

## Global invariants

1. Exact caller-supplied bytes are the only plan content evaluated.
2. Content errors yield `INVALID`; inability to evaluate yields `UNAVAILABLE`.
3. Heading order and unrelated sections never determine validity.
4. The function never discovers, reads, selects, writes, or stores plans.
5. Request alignment is advisory and cannot create an error.
6. Findings are complete rows with deterministic ordering and exact omitted count.
7. Specification text is not execution evidence.
