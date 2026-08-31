# Requirements Matrix

## Functional traceability

| Requirement | Acceptance | Scenario | Story / Use case | State |
|---|---|---|---|---|
| [FR-1](FR.md#fr-1-pure-evaluation-boundary) | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-evaluator-has-no-side-effects) | `@feature1` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence), [UC-1](USE_CASES.md#uc-1-evaluate-task-evidence) | NEXT |
| [FR-2](FR.md#fr-2-supported-execution-artifacts) | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-closed-producer-artifact-set) | `@feature2` | [US-4](USER_STORIES.md#us-4-multi-runner-team), [UC-3](USE_CASES.md#uc-3-capture-a-real-run) | NEXT |
| [FR-3](FR.md#fr-3-trusted-capture-run-envelope) | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-one-run-has-one-capture-owned-envelope) | `@feature3` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence), [UC-3](USE_CASES.md#uc-3-capture-a-real-run) | NEXT |
| [FR-4](FR.md#fr-4-scenario-result-join) | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-only-stable-identity-can-join) | `@feature4` | [US-2](USER_STORIES.md#us-2-engineer-diagnosing-evidence), [UC-1](USE_CASES.md#uc-1-evaluate-task-evidence) | NEXT |
| [FR-5](FR.md#fr-5-full-run-scope-authority) | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-only-capture-owned-full-scope-is-authoritative) | `@feature5` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence), [UC-1](USE_CASES.md#uc-1-evaluate-task-evidence) | NEXT |
| [FR-6](FR.md#fr-6-freshness-and-staleness) | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-current-content-bindings-determine-freshness) | `@feature6` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence), [UC-2](USE_CASES.md#uc-2-diagnose-stale-or-partial-evidence) | NEXT |
| [FR-7](FR.md#fr-7-fail-closed-status-truth) | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-every-required-scenario-needs-fresh-passed-full-evidence) | `@feature7` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence), [UC-1](USE_CASES.md#uc-1-evaluate-task-evidence) | NEXT |
| [FR-8](FR.md#fr-8-waiver-honesty) | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-waived-tasks-remain-open) | `@feature8` | [US-3](USER_STORIES.md#us-3-author-whose-waiver-stays-open), [UC-1](USE_CASES.md#uc-1-evaluate-task-evidence) | NEXT |
| [FR-9](FR.md#fr-9-internal-row-accounting) | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-no-row-or-required-scenario-is-silently-lost) | `@feature9` | [US-2](USER_STORIES.md#us-2-engineer-diagnosing-evidence), [UC-2](USE_CASES.md#uc-2-diagnose-stale-or-partial-evidence) | NEXT |
| [FR-10](FR.md#fr-10-anti-false-green-invariants) | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-no-verdict-without-trusted-captured-bytes) | `@feature10` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence), [UC-2](USE_CASES.md#uc-2-diagnose-stale-or-partial-evidence) | NEXT |
| [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline) | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fixtures-are-real-hashed-and-reviewed) | `@feature11` | [US-4](USER_STORIES.md#us-4-multi-runner-team), [UC-3](USE_CASES.md#uc-3-capture-a-real-run) | NEXT |
| [FR-12](FR.md#fr-12-budgets) | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-budgets-are-enforced) | `@feature12` | [US-2](USER_STORIES.md#us-2-engineer-diagnosing-evidence), [UC-2](USE_CASES.md#uc-2-diagnose-stale-or-partial-evidence) | NEXT |
| [FR-13](FR.md#fr-13-release-eligibility-contribution) | [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-uses-ordinary-fresh-full-evidence) | `@feature13` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence), [UC-4](USE_CASES.md#uc-4-contribute-to-product-readiness) | NEXT |
| [FR-14](FR.md#fr-14-mcp-projection-of-gettestresult-and-getscenariotrace) | [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-result-returns-evidence-and-trace-uses-its-reference) | `@feature14` | [US-2](USER_STORIES.md#us-2-engineer-diagnosing-evidence), [UC-2](USE_CASES.md#uc-2-diagnose-stale-or-partial-evidence) | NEXT |

## Contract checks

| Check | Requirement | Trace | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | Repeated pure evaluation is byte-identical and performs no I/O | FR-1 + AC-1.1 + @feature1 | BDD scenario | Draft | TASK-1 |
| CHK-FR2-01 | Only two producer identities admit actual bytes; typed refusals cover the rest | FR-2 + AC-2.1 + @feature2 | BDD scenario | Draft | TASK-2 |
| CHK-FR3-01 | One actual run creates one capture-owned envelope; self-declared pairs prove nothing | FR-3 + AC-3.1 + @feature3 | BDD scenario | Draft | TASK-2 |
| CHK-FR4-01 | Only exact ID or verified tag joins; names are diagnostic only | FR-4 + AC-4.1 + @feature4 | BDD scenario | Draft | TASK-3 |
| CHK-FR5-01 | Partial evidence remains visible but cannot satisfy or replace full evidence | FR-5 + AC-5.1 + @feature5 | BDD scenario | Draft | TASK-2, TASK-3 |
| CHK-FR6-01 | Scenario, applicable step, and implementation bindings alone determine freshness | FR-6 + AC-6.1 + @feature6 | BDD scenario | Draft | TASK-3 |
| CHK-FR7-01 | Every required scenario needs PASSED/FRESH/FULL evidence | FR-7 + AC-7.1 + @feature7 | BDD scenario | Draft | TASK-3 |
| CHK-FR8-01 | Waived task is WAIVED_OPEN and never verified | FR-8 + AC-8.1 + @feature8 | BDD scenario | Draft | TASK-3 |
| CHK-FR9-01 | Every parsed row and current required scenario has one outcome | FR-9 + AC-9.1 + @feature9 | BDD scenario | Draft | TASK-3 |
| CHK-FR10-01 | Every result/status/trace resolves to re-hashed bytes from trusted capture | FR-10 + AC-10.1 + @feature10 | BDD scenario | Draft | TASK-2, TASK-3 |
| CHK-FR11-01 | Real producer fixtures carry complete provenance and reviewed outcomes | FR-11 + AC-11.1 + @feature11 | BDD scenario | Draft | TASK-4 |
| CHK-FR12-01 | Hard limits fail closed and latency measurement stays external | FR-12 + AC-12.1 + @feature12 | BDD scenario | Draft | TASK-5 |
| CHK-FR13-01 | Product readiness consumes ordinary task/scenario evidence with all-not-any semantics | FR-13 + AC-13.1 + @feature13 | BDD scenario | Draft | TASK-5 |
| CHK-FR14-01 | Result returns ScenarioEvidence; trace pages resolve its evidence reference | FR-14 + AC-14.1 + @feature14 | BDD scenario | Draft | TASK-6 |

## Non-functional traceability

| NFR | Related FR | Verification |
|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-evaluation-latency) | FR-1, FR-2, FR-4, FR-6 | Raw external latency observations |
| [NFR-SIZE-1](NFR.md#nfr-size-1-artifact-and-response-size) | FR-2, FR-12, FR-14 | Boundary and over-limit matrix |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound) | FR-2, FR-12 | Peak incremental RSS |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-1, FR-3, FR-10 | Path containment and leak scan |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-reproducibility) | FR-1, FR-4, FR-9 | Cross-platform repeated evaluation |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-diagnostics) | FR-4, FR-7, FR-9 | Closed-code diagnostic goldens |

## Global invariants

1. Only a trusted local capture adapter creates a run envelope from actual producer bytes.
2. The pure evaluator re-hashes bytes and never performs I/O.
3. Stable ID or verified canonical tag is authoritative; names are diagnostic only.
4. Freshness uses scenario content, applicable step binding, and tested implementation identity.
5. Every required scenario needs fresh passed full-scope evidence; waiver remains open.
6. Every parsed row and every required scenario has one outcome; counters are derived.
7. `ScenarioEvidence.evidenceRef` is the sole result/trace identity.
8. Product readiness consumes ordinary evidence; there is no evidence release subprotocol.
9. Real fixtures preserve producer provenance and reviewed ground truth.
