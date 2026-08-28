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
| [FR-7](FR.md#fr-7-fail-closed-status-truth) | Fail-closed status truth | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-done-verified-requires-fresh-green-evidence) | `@feature7` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence-verdicts), [UC-1](USE_CASES.md#uc-1-evaluate-fresh-green-evidence-for-a-task) | Specified |
| [FR-8](FR.md#fr-8-waiver-honesty) | Waiver honesty | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-waived-tasks-remain-open-and-unsatisfied) | `@feature8` | [US-2](USER_STORIES.md#us-2-specification-author-whose-waived-work-stays-honest), [UC-3](USE_CASES.md#uc-3-refuse-fake-close-of-a-waived-task) | Specified |
| [FR-9](FR.md#fr-9-coverage-census-with-conservation-equations) | Coverage census conservation | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-census-conservation-equations-hold) | `@feature9` | [US-3](USER_STORIES.md#us-3-engineer-diagnosing-unmatched-execution-results), [UC-4](USE_CASES.md#uc-4-produce-a-coverage-census-with-conservation) | Specified |
| [FR-10](FR.md#fr-10-anti-false-green-invariants) | Anti-false-green invariants | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-no-verdict-without-evidence-bytes) | `@feature10` | [US-1](USER_STORIES.md#us-1-release-owner-who-trusts-evidence-verdicts), [UC-2](USE_CASES.md#uc-2-detect-stale-evidence-that-cannot-satisfy-readiness) | Specified |
| [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline) | Real fixtures | [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fixtures-are-real-hashed-and-reconciled) | `@feature11` | [US-5](USER_STORIES.md#us-5-multi-language-team-using-canonical-ndjson), [UC-5](USE_CASES.md#uc-5-ingest-artifacts-with-fail-closed-state) | Specified |
| [FR-12](FR.md#fr-12-budgets) | Budgets | [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-budgets-are-measured-and-enforced) | `@feature12` | [US-4](USER_STORIES.md#us-4-integrator-plugging-evidence-into-release-gates), [UC-6](USE_CASES.md#uc-6-contribute-to-release-eligibility) | Specified |
| [FR-13](FR.md#fr-13-release-eligibility-contribution) | Release contribution | [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-contribution-fails-closed) | `@feature13` | [US-4](USER_STORIES.md#us-4-integrator-plugging-evidence-into-release-gates), [UC-6](USE_CASES.md#uc-6-contribute-to-release-eligibility) | Specified |
| [FR-14](FR.md#fr-14-mcp-projection-of-get_test_result-and-get_scenario_trace) | MCP projection of run-result tools | [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-mcp-projection-of-get_test_result-and-get_scenario_trace) | `@feature14` | [US-3](USER_STORIES.md#us-3-engineer-diagnosing-unmatched-execution-results), [UC-1](USE_CASES.md#uc-1-evaluate-fresh-green-evidence-for-a-task) | Specified |

## Contract checks

| Check | Contract | Trace | Future evidence | State |
|---|---|---|---|---|
| CHK-FR1-01 | Evaluator produces identical output from identical inputs with zero I/O; adapter boundary proven | FR-1, AC-1.1, `@feature1` | Purity proof with instrumented adapter stubs | Not recorded |
| CHK-FR2-01 | Each recognized kind ingests; unrecognized kind produces NOT_INGESTED/MALFORMED_ARTIFACT | FR-2, AC-2.1, `@feature2` | Artifact-kind fixture matrix | Not recorded |
| CHK-FR3-01 | Each ingestion state variant produces correct state/reason; conservation holds for INGESTED | FR-3, AC-3.1, `@feature3` | Ingestion-state fixture matrix with count reconciliation | Not recorded |
| CHK-FR4-01 | Join by ID, tag, name fallback each succeed; ambiguous and unmatched counted; no silent drops | FR-4, AC-4.1, `@feature4` | Join-outcome fixture matrix with conservation check | Not recorded |
| CHK-FR5-01 | Canonical and overlay both present in output; overlay never replaces canonical | FR-5, AC-5.1, `@feature5` | Dual-source fixture with labeled output verification | Not recorded |
| CHK-FR6-01 | Stale result fails readiness; absent timestamp fails readiness; fresh result passes | FR-6, AC-6.1, `@feature6` | Freshness fixture matrix with timestamp variants | Not recorded |
| CHK-FR7-01 | DONE/verified only with all-fresh-green; one-green-among-siblings insufficient; DONE-but-unverified named | FR-7, AC-7.1, `@feature7` | Status-truth fixture matrix with rollup variants | Not recorded |
| CHK-FR8-01 | Waived task remains open-waived despite green evidence; excluded from satisfied counts | FR-8, AC-8.1, `@feature8` | Waiver fixture with evidence-present and evidence-absent variants | Not recorded |
| CHK-FR9-01 | All three conservation equations hold; violation produces diagnostic and invalid census | FR-9, AC-9.1, `@feature9` | Census fixture matrix including planted equation violations | Not recorded |
| CHK-FR10-01 | No verdict without hash reference; no green without parsed record; freshness unbypassable | FR-10, AC-10.1, `@feature10` | Anti-false-green invariant test matrix | Not recorded |
| CHK-FR11-01 | Fixture manifest hashes/sizes/ground truth reconcile; multi-language coverage ≥2 producers | FR-11, AC-11.1, `@feature11` | Fixture admission test with provenance validation | Not recorded |
| CHK-FR12-01 | Latency/size/count/cap budgets met on reference corpus; exceeded limits refuse | FR-12, AC-12.1, `@feature12` | Budget measurement suite with raw observations | Not recorded |
| CHK-FR13-01 | Release conjunction passes only on exact all-PASS profile; one-fault-at-a-time fails closed | FR-13, AC-13.1, `@feature13` | Evidence manifests plus negative matrix | Not recorded |
| CHK-FR14-01 | MCP exposes get_test_result and get_scenario_trace as read-only projections of evaluator output; evaluator has zero MCP calls; tools absent from v0.3 read registry and from v0.2/v0.3 kernel required checks; hover invents no run results before this FR | FR-14, AC-14.1, `@feature14` | MCP projection contract plus purity/absence proofs | Not recorded |

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

1. Evaluation is a pure function of kernel graph + artifact bytes + limits; no internal I/O.
2. Every artifact has exactly one ingestion state with a closed reason.
3. Every valid producer result is either joined to a canonical scenario or counted as unmatched; no silent drops.
4. Canonical results and overlay results are retained separately; overlays never replace canonical.
5. Staleness is pass-through metadata; stale results never satisfy readiness.
6. DONE/verified requires fresh green evidence for every required scenario; rollups are all-not-any.
7. Waived tasks remain open-waived regardless of evidence; they are excluded from satisfied counts.
8. Census conservation equations always hold or the census is marked invalid with diagnostics.
9. No verdict exists without evidence bytes; no status derives from flags alone.
10. Fixtures are real producer bytes with full provenance; synthetic fixtures are labeled.
11. Scenario text and structural parsing never imply executed/passing evidence.
12. Release contribution is a closed conjunction member that does not loosen product:FR-6.
13. MCP `get_test_result` and `get_scenario_trace` are later read-only projections of evaluator output; the evaluator never calls MCP; `spec-kernel:FR-6` never claims pass/fail; `spec-lsp` hover invents no run results before this FR.
