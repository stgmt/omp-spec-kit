# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario tag | Story / Use case | Status |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-pure-evaluation-boundary) | Pure evaluation boundary | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-evaluator-has-no-side-effects) | `@feature1` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence-verdicts), [UC-1](USE_CASES.md#uc-1-evaluate-fresh-green-evidence-for-a-task) | Specified |
| [FR-2](FR.md#fr-2-supported-execution-artifacts) | Supported artifact kinds | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-closed-versioned-artifact-kind-set) | `@feature2` | [US-5](USER_STORIES.md#us-5-multi-language-team-using-canonical-ndjson), [UC-5](USE_CASES.md#uc-5-ingest-artifacts-with-fail-closed-state) | Specified |
| [FR-3](FR.md#fr-3-artifact-level-ingestion-state) | Artifact ingestion state | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-ingestion-state-is-closed-and-conserved) | `@feature3` | [US-3](USER_STORIES.md#us-3-engineer-diagnosing-unmatched-execution-results), [UC-5](USE_CASES.md#uc-5-ingest-artifacts-with-fail-closed-state) | Specified |
| [FR-4](FR.md#fr-4-scenario-result-join) | Scenario result join | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-every-result-is-joined-or-counted-unmatched) | `@feature4` | [US-3](USER_STORIES.md#us-3-engineer-diagnosing-unmatched-execution-results), [UC-1](USE_CASES.md#uc-1-evaluate-fresh-green-evidence-for-a-task) | Specified |
| [FR-5](FR.md#fr-5-canonical-vs-overlay-separation) | Canonical vs overlay separation | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-canonical-and-overlay-are-retained-separately) | `@feature5` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence-verdicts), [UC-1](USE_CASES.md#uc-1-evaluate-fresh-green-evidence-for-a-task) | Specified |
| [FR-6](FR.md#fr-6-freshness-and-staleness) | Freshness and staleness | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-stale-results-never-satisfy-readiness) | `@feature6` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence-verdicts), [UC-2](USE_CASES.md#uc-2-detect-stale-evidence-that-cannot-satisfy-readiness) | Specified |
| [FR-7](FR.md#fr-7-fail-closed-status-truth) | Fail-closed status truth | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-doneverified-requires-fresh-green-evidence) | `@feature7` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence-verdicts), [UC-1](USE_CASES.md#uc-1-evaluate-fresh-green-evidence-for-a-task) | Specified |
| [FR-8](FR.md#fr-8-waiver-honesty) | Waiver honesty | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-waived-tasks-remain-open-and-unsatisfied) | `@feature8` | [US-2](USER_STORIES.md#us-2-specification-author-whose-waived-work-stays-honest), [UC-3](USE_CASES.md#uc-3-refuse-fake-close-of-a-waived-task) | Specified |
| [FR-9](FR.md#fr-9-coverage-census-with-conservation-equations) | Coverage census conservation | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-census-conservation-equations-hold) | `@feature9` | [US-3](USER_STORIES.md#us-3-engineer-diagnosing-unmatched-execution-results), [UC-4](USE_CASES.md#uc-4-produce-a-coverage-census-with-conservation) | Specified |
| [FR-10](FR.md#fr-10-anti-false-green-invariants) | Anti-false-green invariants | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-no-verdict-without-evidence-bytes) | `@feature10` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence-verdicts), [UC-2](USE_CASES.md#uc-2-detect-stale-evidence-that-cannot-satisfy-readiness) | Specified |
| [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline) | Real fixtures | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fixtures-are-real-hashed-and-reconciled) | `@feature11` | [US-5](USER_STORIES.md#us-5-multi-language-team-using-canonical-ndjson), [UC-5](USE_CASES.md#uc-5-ingest-artifacts-with-fail-closed-state) | Specified |
| [FR-12](FR.md#fr-12-budgets) | Budgets | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-budgets-are-measured-and-enforced) | `@feature12` | [US-4](USER_STORIES.md#us-4-integrator-plugging-evidence-into-release-gates), [UC-6](USE_CASES.md#uc-6-contribute-to-release-eligibility) | Specified |
| [FR-13](FR.md#fr-13-release-eligibility-contribution) | Release contribution | [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-contribution-fails-closed) | `@feature13` | [US-4](USER_STORIES.md#us-4-integrator-plugging-evidence-into-release-gates), [UC-6](USE_CASES.md#uc-6-contribute-to-release-eligibility) | Specified |
| [FR-14](FR.md#fr-14-mcp-projection-of-gettestresult-and-getscenariotrace) | MCP projection of run-result tools | [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-mcp-projection-of-gettestresult-and-getscenariotrace) | `@feature14` | [US-3](USER_STORIES.md#us-3-engineer-diagnosing-unmatched-execution-results), [UC-1](USE_CASES.md#uc-1-evaluate-fresh-green-evidence-for-a-task) | Specified |

## Contract checks

| Check | Contract | Trace | Future evidence | Owning task | State |
|---|---|---|---|---|---|
| CHK-FR1-01 | Identical input yields byte-identical output with zero evaluator I/O | FR-1, AC-1.1, `@feature1` | Purity/instrumented adapter proof | TASK-1 | Not recorded |
| CHK-FR2-01 | Present supported kinds ingest; unknown kind produces NOT_INGESTED/UNSUPPORTED_ARTIFACT_IDENTITY | FR-2, AC-2.1, `@feature2` | Artifact-kind fixture matrix | TASK-2 | Not recorded |
| CHK-FR3-01 | PRESENT/ABSENT/SKIPPED variants and parse conservation are exact | FR-3, AC-3.1, `@feature3` | Ingestion-state matrix | TASK-2 | Not recorded |
| CHK-FR4-01 | ID/tag/name joins and ambiguous/unmatched outcomes conserve every producer row | FR-4, AC-4.1, `@feature4` | Join fixture matrix | TASK-3 | Not recorded |
| CHK-FR5-01 | Canonical and overlay rows coexist without replacement | FR-5, AC-5.1, `@feature5` | Dual-layer real producer fixture | TASK-2, TASK-3 | Not recorded |
| CHK-FR6-01 | Equal hashes are FRESH; unequal hashes STALE; missing bindings INDETERMINATE | FR-6, AC-6.1, `@feature6` | Hash-binding one-fault matrix | TASK-4 | Not recorded |
| CHK-FR7-01 | done-verified requires every fresh PASSED canonical row and evidence hashes | FR-7, AC-7.1, `@feature7` | Task-status all-not-any matrix | TASK-5 | Not recorded |
| CHK-FR8-01 | Waived task remains open-waived and never satisfies counts | FR-8, AC-8.1, `@feature8` | Waiver matrix | TASK-5 | Not recorded |
| CHK-FR9-01 | Authored-scenario, producer-row and parse equations hold independently | FR-9, AC-9.1, `@feature9` | Split census matrix | TASK-7 | Not recorded |
| CHK-FR10-01 | No status/freshness/trace claim lacks producer bytes and bindings | FR-10, AC-10.1, `@feature10` | Anti-false-green matrix | TASK-8 | Not recorded |
| CHK-FR11-01 | Real fixtures have producer provenance and reconciled ground truth | FR-11, AC-11.1, `@feature11` | Multi-producer fixture admission | TASK-6 | Not recorded |
| CHK-FR12-01 | Count/byte budgets enforce; caller measures latency outside evaluator | FR-12, AC-12.1, `@feature12` | Budget/overflow matrix | TASK-10 | Not recorded |
| CHK-FR13-01 | Exact FR-1..FR-14 release record set binds candidate and graph | FR-13, AC-13.1, `@feature13` | Release manifest one-fault matrix | TASK-9 | Not recorded |
| CHK-FR14-01 | Result/trace MCP projections return complete fields and explicit null absence | FR-14, AC-14.1, `@feature14` | MCP projection and purity matrix | TASK-11 | Not recorded |

## Non-functional traceability

| NFR | Related requirements | Verification obligation |
|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-evaluation-latency) | FR-1, FR-3, FR-4, FR-6, FR-9 | Latency samples on reference corpus with raw observations |
| [NFR-SIZE-1](NFR.md#nfr-size-1-artifact-and-result-size) | FR-2, FR-3, FR-12 | Artifact/output byte measurements, diagnostic cap enforcement |
| [NFR-MEM-1](NFR.md#nfr-mem-1-memory-bound) | FR-3, FR-4 | Peak incremental RSS on reference corpus |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-data-minimization) | FR-1, FR-3 | Containment variants, leak scan of diagnostics/output |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-reproducibility) | FR-1, FR-3, FR-4, FR-9 | Repeated-run byte-identical result comparison on Windows and POSIX |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-diagnostics) | FR-3, FR-9, FR-10 | Diagnostic golden comparison with code/message/context presence |

## Global invariants

1. Evaluation is pure over closed kernel/artifact/limit inputs; adapter I/O/containment is separate.
2. PRESENT bytes are re-hashed and kind/version admitted; every input yields one discriminated ingestion record.
3. Every producer result has exactly one JOINED, UNMATCHED or AMBIGUOUS_JOIN record.
4. Canonical and overlay rows remain separate; deterministic LATEST never overwrites either.
5. Four-dimensional hash freshness is pass-through metadata; timestamps never satisfy readiness.
6. `done-verified` requires fresh PASSED canonical evidence for every required scenario; rollups are all-not-any.
7. Waived status is exactly `open-waived` and never satisfied.
8. Authored/producer equations, collection lengths, unique IDs, memberships and per-artifact/global sums all conserve or invalidate output.
9. No result/status/trace exists without evidence bytes and complete applicable bindings.
10. Fixtures are real producer bytes with full provenance; synthetic fixtures are labeled.
11. Scenario text and structural parsing never imply executed/passing evidence.
12. Release contribution is a closed conjunction member that does not loosen product:FR-6.
13. MCP `get_test_result` and `get_scenario_trace` are later read-only projections of evaluator output; the evaluator never calls MCP; `spec-kernel:FR-6` never claims pass/fail; `spec-lsp` hover invents no run results before this FR.
