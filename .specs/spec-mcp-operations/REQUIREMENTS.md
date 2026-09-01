# REQUIREMENTS

## Read / Core

Each row is a complete FR ↔ AC ↔ scenario ↔ check ↔ task trace. Status describes the specification contract, not executed evidence.

## Functional traceability

| Requirement | Acceptance | Scenario tag | Check | Owning task |
|---|---|---|---|---|
| [FR-1](FR.md#fr-1-pure-occurrence-first-core) | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-occurrence-first-core) | `@feature1` / `@id:SCEN-mcp-read-core-pure-occurrence-first-core` | CHK-READ-CORE-FR1-01 | [TASK-1](TASKS.md#task-1-define-the-pure-core-boundary) |
| [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids) | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-canonical-documents-and-qualified-ids) | `@feature2` / `@id:SCEN-mcp-read-core-canonical-documents-and-qualified-ids` | CHK-READ-CORE-FR2-01 | [TASK-2](TASKS.md#task-2-implement-canonical-inventory-and-identity) |
| [FR-3](FR.md#fr-3-typed-graph-conservation) | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-typed-graph-conservation) | `@feature3` / `@id:SCEN-mcp-read-core-typed-graph-conservation` | CHK-READ-CORE-FR3-01 | [TASK-3](TASKS.md#task-3-build-typed-conserved-graph) |
| [FR-4](FR.md#fr-4-four-bounded-core-primitives) | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-four-bounded-primitives) | `@feature4` / `@id:SCEN-mcp-read-core-four-bounded-core-primitives` | CHK-READ-CORE-FR4-01 | [TASK-4](TASKS.md#task-4-implement-four-primitives-and-cursors) |
| [FR-5](FR.md#fr-5-contained-inputs-and-budgets) | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-contained-bounded-inputs) | `@feature5` / `@id:SCEN-mcp-read-core-contained-inputs-and-budgets` | CHK-READ-CORE-FR5-01 | [TASK-5](TASKS.md#task-5-enforce-containment-cancellation-and-budgets) |
| [FR-6](FR.md#fr-6-historical-eight-name-compatibility) | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-historical-eight-name-compatibility) | `@feature6` / `@id:SCEN-mcp-read-core-historical-eight-name-compatibility` | CHK-READ-CORE-FR6-01 | [TASK-6](TASKS.md#task-6-preserve-eight-compatibility-adapters) |
| [FR-7](FR.md#fr-7-deterministic-diagnostics-and-fingerprint) | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-deterministic-diagnostics-and-fingerprint) | `@feature7` / `@id:SCEN-mcp-read-core-deterministic-diagnostics-and-fingerprint` | CHK-READ-CORE-FR7-01 | [TASK-7](TASKS.md#task-7-prove-deterministic-diagnostics-and-fingerprint) |
| [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets) | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-real-evidence-and-measurable-budgets) | `@feature8` / `@id:SCEN-mcp-read-core-real-fixtures-and-measurable-budgets` | CHK-READ-CORE-FR8-01 | [TASK-8](TASKS.md#task-8-retain-real-fixture-and-budget-evidence) |

## Contract checks

| Check | Observable contract | Trace | Verification Method | State | Notes |
|---|---|---|---|---|---|
| CHK-READ-CORE-FR1-01 | Pure occurrence-first core has no ambient I/O | FR-1, AC-1.1, `@feature1` | BDD scenario | Draft | boundary inspection and source-occurrence conservation |
| CHK-READ-CORE-FR2-01 | Canonical role grammar and qualified identity are exact | FR-2, AC-2.1, `@feature2` | BDD scenario | Draft | document census and duplicate/spec collision controls |
| CHK-READ-CORE-FR3-01 | Typed edges and unresolved references conserve occurrences | FR-3, AC-3.1, `@feature3` | BDD scenario | Draft | duplicate, missing, ambiguous, and endpoint cases |
| CHK-READ-CORE-FR4-01 | Four primitives share bounded deterministic pagination | FR-4, AC-4.1, `@feature4` | BDD scenario | Draft | primitive envelope and cursor cases |
| CHK-READ-CORE-FR5-01 | Containment, cancellation, and hard budgets fail closed | FR-5, AC-5.1, `@feature5` | BDD scenario | Draft | traversal/link/limit variants |
| CHK-READ-CORE-FR6-01 | Eight historical names project one shared result | FR-6, AC-6.1, `@feature6` | Integration test | Draft | v0.3.2 compatibility receipt and adapter parity |
| CHK-READ-CORE-FR7-01 | Fingerprint excludes query availability and remains stable | FR-7, AC-7.1, `@feature7` | Unit test | Draft | normalized permutation and diagnostic ordering |
| CHK-READ-CORE-FR8-01 | Real provenance and package/memory/latency budgets remain visible | FR-8, AC-8.1, `@feature8` | Manual review | Draft | manifest oracle and retained receipts |

## Invariants

1. A definition occurrence is exactly unique, ambiguous, or rejected.
2. A reference occurrence is exactly resolved or unresolved.
3. Resolved edges have existing permitted endpoints.
4. Spec-qualified IDs prevent cross-spec collision.
5. Four primitives read one immutable graph and mutate no repository or state.
6. Fingerprint inputs exclude query/MCP availability.
7. Structural validity and product release evidence are separate.

## Read / Evidence

## Functional traceability

| Requirement | Acceptance | Scenario | Story / Use case | State |
|---|---|---|---|---|
| [FR-9](FR.md#fr-9-pure-evaluation-boundary) | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-pure-evaluator-has-no-side-effects) | `@feature9` | [US-6](USER_STORIES.md#us-6-release-owner-who-trusts-evidence), [UC-5](USE_CASES.md#uc-5-evaluate-task-evidence) | NEXT |
| [FR-10](FR.md#fr-10-supported-execution-artifacts) | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-closed-producer-artifact-set) | `@feature10` | [US-9](USER_STORIES.md#us-9-multi-runner-team), [UC-7](USE_CASES.md#uc-7-capture-a-real-run) | NEXT |
| [FR-11](FR.md#fr-11-trusted-capture-run-envelope) | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-one-run-has-one-capture-owned-envelope) | `@feature11` | [US-6](USER_STORIES.md#us-6-release-owner-who-trusts-evidence), [UC-7](USE_CASES.md#uc-7-capture-a-real-run) | NEXT |
| [FR-12](FR.md#fr-12-scenario-result-join) | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-only-stable-identity-can-join) | `@feature12` | [US-7](USER_STORIES.md#us-7-engineer-diagnosing-evidence), [UC-5](USE_CASES.md#uc-5-evaluate-task-evidence) | NEXT |
| [FR-13](FR.md#fr-13-full-run-scope-authority) | [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-only-capture-owned-full-scope-is-authoritative) | `@feature13` | [US-6](USER_STORIES.md#us-6-release-owner-who-trusts-evidence), [UC-5](USE_CASES.md#uc-5-evaluate-task-evidence) | NEXT |
| [FR-14](FR.md#fr-14-freshness-and-staleness) | [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-current-content-bindings-determine-freshness) | `@feature14` | [US-6](USER_STORIES.md#us-6-release-owner-who-trusts-evidence), [UC-6](USE_CASES.md#uc-6-diagnose-stale-or-partial-evidence) | NEXT |
| [FR-15](FR.md#fr-15-fail-closed-status-truth) | [AC-15.1](ACCEPTANCE_CRITERIA.md#ac-151-every-required-scenario-needs-fresh-passed-full-evidence) | `@feature15` | [US-6](USER_STORIES.md#us-6-release-owner-who-trusts-evidence), [UC-5](USE_CASES.md#uc-5-evaluate-task-evidence) | NEXT |
| [FR-16](FR.md#fr-16-waiver-honesty) | [AC-16.1](ACCEPTANCE_CRITERIA.md#ac-161-waived-tasks-remain-open) | `@feature16` | [US-8](USER_STORIES.md#us-8-author-whose-waiver-stays-open), [UC-5](USE_CASES.md#uc-5-evaluate-task-evidence) | NEXT |
| [FR-17](FR.md#fr-17-internal-row-accounting) | [AC-17.1](ACCEPTANCE_CRITERIA.md#ac-171-no-row-or-required-scenario-is-silently-lost) | `@feature17` | [US-7](USER_STORIES.md#us-7-engineer-diagnosing-evidence), [UC-6](USE_CASES.md#uc-6-diagnose-stale-or-partial-evidence) | NEXT |
| [FR-18](FR.md#fr-18-anti-false-green-invariants) | [AC-18.1](ACCEPTANCE_CRITERIA.md#ac-181-no-verdict-without-trusted-captured-bytes) | `@feature18` | [US-6](USER_STORIES.md#us-6-release-owner-who-trusts-evidence), [UC-6](USE_CASES.md#uc-6-diagnose-stale-or-partial-evidence) | NEXT |
| [FR-19](FR.md#fr-19-real-fixtures-per-read-core-discipline) | [AC-19.1](ACCEPTANCE_CRITERIA.md#ac-191-fixtures-are-real-hashed-and-reviewed) | `@feature19` | [US-9](USER_STORIES.md#us-9-multi-runner-team), [UC-7](USE_CASES.md#uc-7-capture-a-real-run) | NEXT |
| [FR-20](FR.md#fr-20-budgets) | [AC-20.1](ACCEPTANCE_CRITERIA.md#ac-201-budgets-are-enforced) | `@feature20` | [US-7](USER_STORIES.md#us-7-engineer-diagnosing-evidence), [UC-6](USE_CASES.md#uc-6-diagnose-stale-or-partial-evidence) | NEXT |
| [FR-21](FR.md#fr-21-release-eligibility-contribution) | [AC-21.1](ACCEPTANCE_CRITERIA.md#ac-211-release-uses-ordinary-fresh-full-evidence) | `@feature21` | [US-6](USER_STORIES.md#us-6-release-owner-who-trusts-evidence), [UC-8](USE_CASES.md#uc-8-contribute-to-product-readiness) | NEXT |
| [FR-22](FR.md#fr-22-mcp-projection-of-gettestresult-and-getscenariotrace) | [AC-22.1](ACCEPTANCE_CRITERIA.md#ac-221-result-returns-evidence-and-trace-uses-its-reference) | `@feature22` | [US-7](USER_STORIES.md#us-7-engineer-diagnosing-evidence), [UC-6](USE_CASES.md#uc-6-diagnose-stale-or-partial-evidence) | NEXT |

## Contract checks

| Check | Requirement | Trace | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-READ-EVIDENCE-FR1-01 | Repeated pure evaluation is byte-identical and performs no I/O | FR-9 + AC-9.1 + @feature9 | BDD scenario | Draft | TASK-9 |
| CHK-READ-EVIDENCE-FR2-01 | Only two producer identities admit actual bytes; typed refusals cover the rest | FR-10 + AC-10.1 + @feature10 | BDD scenario | Draft | TASK-10 |
| CHK-READ-EVIDENCE-FR3-01 | One actual run creates one capture-owned envelope; self-declared pairs prove nothing | FR-11 + AC-11.1 + @feature11 | BDD scenario | Draft | TASK-10 |
| CHK-READ-EVIDENCE-FR4-01 | Only exact ID or verified tag joins; names are diagnostic only | FR-12 + AC-12.1 + @feature12 | BDD scenario | Draft | TASK-11 |
| CHK-READ-EVIDENCE-FR5-01 | Partial evidence remains visible but cannot satisfy or replace full evidence | FR-13 + AC-13.1 + @feature13 | BDD scenario | Draft | TASK-10, TASK-11 |
| CHK-READ-EVIDENCE-FR6-01 | Scenario, applicable step, and implementation bindings alone determine freshness | FR-14 + AC-14.1 + @feature14 | BDD scenario | Draft | TASK-11 |
| CHK-READ-EVIDENCE-FR7-01 | Every required scenario needs PASSED/FRESH/FULL evidence | FR-15 + AC-15.1 + @feature15 | BDD scenario | Draft | TASK-11 |
| CHK-READ-EVIDENCE-FR8-01 | Waived task is WAIVED_OPEN and never verified | FR-16 + AC-16.1 + @feature16 | BDD scenario | Draft | TASK-11 |
| CHK-READ-EVIDENCE-FR9-01 | Every parsed row and current required scenario has one outcome | FR-17 + AC-17.1 + @feature17 | BDD scenario | Draft | TASK-11 |
| CHK-READ-EVIDENCE-FR10-01 | Every result/status/trace resolves to re-hashed bytes from trusted capture | FR-18 + AC-18.1 + @feature18 | BDD scenario | Draft | TASK-10, TASK-11 |
| CHK-READ-EVIDENCE-FR11-01 | Real producer fixtures carry complete provenance and reviewed outcomes | FR-19 + AC-19.1 + @feature19 | BDD scenario | Draft | TASK-12 |
| CHK-READ-EVIDENCE-FR12-01 | Hard limits fail closed and latency measurement stays external | FR-20 + AC-20.1 + @feature20 | BDD scenario | Draft | TASK-13 |
| CHK-READ-EVIDENCE-FR13-01 | Product readiness consumes ordinary task/scenario evidence with all-not-any semantics | FR-21 + AC-21.1 + @feature21 | BDD scenario | Draft | TASK-13 |
| CHK-READ-EVIDENCE-FR14-01 | Result returns ScenarioEvidence; trace pages resolve its evidence reference | FR-22 + AC-22.1 + @feature22 | BDD scenario | Draft | TASK-14 |

## Non-functional traceability

| NFR | Related FR | Verification |
|---|---|---|
| [NFR-EVIDENCE-PERF-1](NFR.md#nfr-evidence-perf-1-evaluation-latency) | FR-9, FR-10, FR-12, FR-14 | Raw external latency observations |
| [NFR-EVIDENCE-SIZE-1](NFR.md#nfr-evidence-size-1-artifact-and-response-size) | FR-10, FR-20, FR-22 | Boundary and over-limit matrix |
| [NFR-EVIDENCE-MEM-1](NFR.md#nfr-evidence-mem-1-memory-bound) | FR-10, FR-20 | Peak incremental RSS |
| [NFR-EVIDENCE-SEC-1](NFR.md#nfr-evidence-sec-1-containment-and-data-minimization) | FR-9, FR-11, FR-18 | Path containment and leak scan |
| [NFR-EVIDENCE-REL-1](NFR.md#nfr-evidence-rel-1-determinism-and-reproducibility) | FR-9, FR-12, FR-17 | Cross-platform repeated evaluation |
| [NFR-EVIDENCE-USE-1](NFR.md#nfr-evidence-use-1-actionable-diagnostics) | FR-12, FR-15, FR-17 | Closed-code diagnostic goldens |

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

## Write

## Delivery status

`spec-mcp-operations` is `NEXT`. The shipped v0.3.2 product remains the eight-tool read-only baseline; this specification defines future implementation and verification only.

## Functional requirement index

| Qualified ID | Requirement | Priority | Depends on | Acceptance | Scenario |
|---|---|---:|---|---|---|
| `spec-mcp-operations:FR-23` | Two-tool public boundary and host path policy | P0 | `plugin-distribution:FR-17`, existing MCP server | [AC-23.1–1.2](ACCEPTANCE_CRITERIA.md#ac-231) | `@feature23` |
| `spec-mcp-operations:FR-24` | Pure deterministic proposal | P0 | FR-23, `Read / Core` snapshot/query core | [AC-24.1–2.2](ACCEPTANCE_CRITERIA.md#ac-241) | `@feature24` |
| `spec-mcp-operations:FR-25` | Containment, anchors, and resulting-spec validation | P0 | FR-24, `Read / Core` validators | [AC-25.1–3.2](ACCEPTANCE_CRITERIA.md#ac-251) | `@feature25` |
| `spec-mcp-operations:FR-26` | Exact-proposal apply with CAS and revalidation | P0 | FR-24, FR-25 | [AC-26.1–4.2](ACCEPTANCE_CRITERIA.md#ac-261) | `@feature26` |
| `spec-mcp-operations:FR-27` | Atomic commit and internal rollback | P0 | FR-26 | [AC-27.1–5.2](ACCEPTANCE_CRITERIA.md#ac-271) | `@feature27` |
| `spec-mcp-operations:FR-28` | Byte conservation and redacted outcomes | P0 | FR-24, FR-27 | [AC-28.1–6.2](ACCEPTANCE_CRITERIA.md#ac-281) | `@feature28` |
| `spec-mcp-operations:FR-29` | Real correctness evidence | P0 | FR-23–FR-28 | [AC-29.1–7.2](ACCEPTANCE_CRITERIA.md#ac-291) | `@feature29` |

## Invariants

1. Public mutation names are exactly `propose_patch` and `apply_proposed_patch`.
2. Helpers compile internally; apply accepts Proposal identity and hashes, never raw edits.
3. Every request targets exactly one ordinary contained spec.
4. Proposal is pure and complete; a truncated preview is not valid.
5. Apply re-resolves, CAS-checks, rebuilds, and revalidates under the lock without automatic rebase.
6. Commit visibility is one complete old or new generation.
7. Internal rollback never invents replacement bytes; unrecoverable state stops at manual VCS/backup restore.
8. Untouched bytes/EOLs and changed after-hashes are conserved.
9. Receipts are compact and redacted; no authoring-owned ledger or durable review lifecycle exists.
10. Quality checks produce verification evidence only; they do not govern runtime availability.

## Verification matrix

| CHK-ID | Requirement | Traces To | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-WRITE-FR1-01 | FR-23 | FR-23, AC-23.1, @feature23 | Integration test | Draft | SCEN-mcp-write-authoring-two-tool-inventory; TASK-15 |
| CHK-WRITE-FR1-02 | FR-23 | FR-23, AC-23.2, @feature23 | Integration test | Draft | SCEN-mcp-write-authoring-path-policy-denies-raw-writer; TASK-15 |
| CHK-WRITE-FR2-01 | FR-24 | FR-24, AC-24.1, @feature24 | BDD scenario | Draft | SCEN-mcp-write-authoring-proposal-deterministic-no-write; TASK-16 |
| CHK-WRITE-FR2-02 | FR-24 | FR-24, AC-24.2, @feature24 | Unit test | Draft | SCEN-mcp-write-authoring-invalid-preview-refused; TASK-16 |
| CHK-WRITE-FR3-01 | FR-25 | FR-25, AC-25.1, @feature25 | Integration test | Draft | SCEN-mcp-write-authoring-containment-refuses-escape; TASK-17 |
| CHK-WRITE-FR3-02 | FR-25 | FR-25, AC-25.2, @feature25 | Integration test | Draft | SCEN-mcp-write-authoring-result-validation-refuses-drift; TASK-17 |
| CHK-WRITE-FR4-01 | FR-26 | FR-26, AC-26.1, @feature26 | Integration test | Draft | SCEN-mcp-write-authoring-apply-exact-proposal; TASK-18 |
| CHK-WRITE-FR4-02 | FR-26 | FR-26, AC-26.2, @feature26 | Integration test | Draft | SCEN-mcp-write-authoring-concurrent-apply-conflict; TASK-18 |
| CHK-WRITE-FR5-01 | FR-27 | FR-27, AC-27.1, @feature27 | Integration test | Draft | SCEN-mcp-write-authoring-fault-preserves-generation; TASK-19 |
| CHK-WRITE-FR5-02 | FR-27 | FR-27, AC-27.2, @feature27 | Manual review | Draft | SCEN-mcp-write-authoring-unrecoverable-needs-manual-restore; TASK-19 |
| CHK-WRITE-FR6-01 | FR-28 | FR-28, AC-28.1, @feature28 | Integration test | Draft | SCEN-mcp-write-authoring-byte-eol-conservation; TASK-20 |
| CHK-WRITE-FR6-02 | FR-28 | FR-28, AC-28.2, @feature28 | Unit test | Draft | SCEN-mcp-write-authoring-receipt-redaction; TASK-20 |
| CHK-WRITE-FR7-01 | FR-29 | FR-29, AC-29.1, @feature29 | Manual review | Draft | SCEN-mcp-write-authoring-real-fixture-provenance; TASK-21 |
| CHK-WRITE-FR7-02 | FR-29 | FR-29, AC-29.2, @feature29 | Unit test | Draft | SCEN-mcp-write-authoring-protected-check-omissions-fail; TASK-21 |
## Non-functional ownership

| NFR | Check | Task |
|---|---|---|
| [NFR-SAFETY-1](NFR.md#nfr-safety-1-fail-closed) | CHK-WRITE-FR5-02 | TASK-19 |
| [NFR-DURABILITY-1](NFR.md#nfr-durability-1-atomic-visibility) | CHK-WRITE-FR5-01 | TASK-19 |
| [NFR-DETERMINISM-1](NFR.md#nfr-determinism-1-stable-proposal-identity) | CHK-WRITE-FR2-01 | TASK-16 |
| [NFR-CONCURRENCY-1](NFR.md#nfr-concurrency-1-bounded-locking) | CHK-WRITE-FR4-02 | TASK-18 |
| [NFR-PORTABILITY-1](NFR.md#nfr-portability-1-platform-containment) | CHK-WRITE-FR3-01 | TASK-17 |
| [NFR-PRIVACY-1](NFR.md#nfr-privacy-1-redaction) | CHK-WRITE-FR6-02 | TASK-20 |
| [NFR-COMPATIBILITY-1](NFR.md#nfr-compatibility-1-byte-and-eol-conservation) | CHK-WRITE-FR6-01 | TASK-20 |
| [NFR-WRITE-PERFORMANCE-1](NFR.md#nfr-write-performance-1-bounded-work) | CHK-WRITE-FR2-02 | TASK-16 |
| [NFR-MAINTAINABILITY-1](NFR.md#nfr-maintainability-1-one-core) | CHK-WRITE-FR1-01 | TASK-15 |

## Assumptions

- The current kernel supplies immutable graph/query data plus canonical form, trace, and anchor validation.
- The first authoring capability supports exactly one spec per Proposal and commit.
- Canonical spec documents remain ordinary unlinked files under one selected repository root.
- VCS or backup is available to an operator for the explicitly unrecoverable storage case.