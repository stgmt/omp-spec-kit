# Functional Requirements

All runtime identities in this specification use `spec-evidence:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status. This specification consumes the spec-kernel graph as an immutable input; it does not modify or extend the kernel.

## FR-1: Pure evaluation boundary

The evaluator SHALL be a pure function of (kernel graph + immutable execution-artifact bytes + limits). It SHALL NOT read or write the filesystem, observe the clock/environment/process/network, start watchers, persist caches, or call OMP/MCP APIs internally. Adapters SHALL handle all I/O, artifact retrieval, and integration with external systems separately, mirroring `spec-kernel:FR-1` discipline. Every public evaluation operation SHALL be read-only with respect to repository and graph state.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-evaluator-has-no-side-effects)

**Scenario:** `@feature1` / `SCEN-spec-evidence-pure-evaluation-boundary`

**Sources:** `MIGRATION_MATRIX.md` row FR-32 (REWRITE: standalone evidence inputs); `spec-kernel:FR-1` (pure kernel boundary as mirrored discipline); `docs/upstream/dev-pomogator/spec-generator-v4/DESIGN.md` honesty-gate component (provenance only).

## FR-2: Supported execution artifacts

The evaluator SHALL admit only `cucumber-messages-ndjson@33.0.4`, `pytest-bdd-cucumber-json@1`, and `scenario-result-overlay@1`. Unknown kind/version yields `NOT_INGESTED/UNSUPPORTED_ARTIFACT_IDENTITY`; malformed bytes yield `NOT_INGESTED/MALFORMED_ARTIFACT`. Cucumber Messages remains canonical.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-closed-versioned-artifact-kind-set)

**Scenario:** `@feature2` / `SCEN-spec-evidence-supported-artifact-kinds`

**Sources:** `MIGRATION_MATRIX.md` rows FR-9 (ADOPT), FR-31 (ADOPT); `docs/upstream/dev-pomogator/spec-generator-v4/FR.md` FR-1 (NDJSON canonical output, provenance only).

## FR-3: Artifact-level ingestion state

Input state is exactly PRESENT, ABSENT, or caller SKIPPED. Output is the discriminated `INGESTED`, `NOT_INGESTED`, `ABSENT`, or `SKIPPED` record in the schema. Missing scenario results is parse-derived `NOT_INGESTED/MISSING_SCENARIO_RESULTS`; callers cannot assert it. INGESTED counts satisfy parsed = matched + unmatched + ambiguous + malformed; no other state/reason pairing is valid.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-ingestion-state-is-closed-and-conserved)

**Scenario:** `@feature3` / `SCEN-spec-evidence-artifact-ingestion-state`

**Sources:** `MIGRATION_MATRIX.md` row FR-32 (REWRITE: standalone evidence inputs); `spec-kernel:FR-6` (conservation discipline).

## FR-4: Scenario result join

Every valid producer result SHALL be JOINED, UNMATCHED, or AMBIGUOUS_JOIN. Priority is qualified ID, canonical tag, then name fallback. Multiple same-priority candidates produce AMBIGUOUS_JOIN with the full bounded candidate set and are counted in `ambiguousProducerResultCount`, never silently folded into unmatched or arbitrarily elected.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-every-result-is-joined-or-counted-unmatched)

**Scenario:** `@feature4` / `SCEN-spec-evidence-scenario-result-join`

**Sources:** `MIGRATION_MATRIX.md` rows FR-46 (ADOPT: task↔scenario↔requirement trace), FR-56 (ADOPT: coverage); `spec-kernel:FR-5` (typed edge resolution discipline).

## FR-5: Canonical vs overlay separation

The evaluator SHALL retain the canonical full-run result separately from any newest overlay. Overlays SHALL supplement but never replace canonical results. When both canonical and overlay exist for the same scenario, the evaluation output SHALL expose both with explicit labeling. Freshness/staleness verdicts SHALL apply independently to canonical and overlay results. A release-eligibility check SHALL require canonical evidence; overlay-only evidence SHALL NOT satisfy readiness.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-canonical-and-overlay-are-retained-separately)

**Scenario:** `@feature5` / `SCEN-spec-evidence-canonical-overlay-separation`

**Sources:** `MIGRATION_MATRIX.md` row FR-56 (ADOPT: canonical coverage + freshness overlay).

## FR-6: Freshness and staleness

Freshness SHALL be hash-bound, not clock-derived. A result is `FRESH` only when its evidence graph fingerprint, scenario content hash, applicable step-binding-set hash and implementation artifact hash equal the current kernel/evidence inputs. Any unequal binding is `STALE`; any missing required binding is `INDETERMINATE`. Wall-clock timestamps MAY be retained as display metadata but SHALL NOT establish readiness.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-stale-results-never-satisfy-readiness)

**Scenario:** `@feature6` / `SCEN-spec-evidence-freshness-staleness`

**Sources:** `MIGRATION_MATRIX.md` row FR-56 (ADOPT: freshness overlay); upstream incident class "526 stale results reported as passed while execution lane claimed GREEN" (motivation).

## FR-7: Fail-closed status truth

`done-verified` SHALL require one FRESH PASSED canonical result for every scenario required by the task and a non-empty set of evidence hashes. Overlay-only, stale, skipped, failed, unknown, ambiguous or absent results SHALL NOT satisfy it. `done-unverified`, `open-waived`, and `not-done` remain explicit, deterministic states derived from evidence bytes rather than flags or structural parsing.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-doneverified-requires-fresh-green-evidence)

**Scenario:** `@feature7` / `SCEN-spec-evidence-fail-closed-status-truth`

**Sources:** `MIGRATION_MATRIX.md` rows FR-32 (REWRITE: fail-closed status truth), FR-35 (ADOPT: test-quality honesty gate); `spec-kernel:FR-6` (no readiness from structural parsing).

## FR-8: Waiver honesty

A waived task SHALL remain exact status `open-waived` regardless of green evidence and never count satisfied. The other derived states are exactly `done-verified`, `done-unverified`, and `not-done`; prose aliases such as “DONE/verified” are not public values.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-waived-tasks-remain-open-and-unsatisfied)

**Scenario:** `@feature8` / `SCEN-spec-evidence-waiver-honesty`

**Sources:** `MIGRATION_MATRIX.md` row FR-50 (ADOPT: refuse fake-close of waived tasks).

## FR-9: Coverage census with conservation equations

The evaluator SHALL report authored counts separately from producer-row counts, including `ambiguousProducerResultCount`. Every equation, collection length, unique result membership, join outcome partition, and per-artifact/global sum in `spec-evidence_SCHEMA.md` SHALL hold; overlay rows may increase producer counts without increasing unique authored scenarios.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-census-conservation-equations-hold)

**Scenario:** `@feature9` / `SCEN-spec-evidence-coverage-census-conservation`

**Sources:** `MIGRATION_MATRIX.md` rows FR-46 (ADOPT: trace), FR-56 (ADOPT: coverage); `spec-kernel:FR-6` (conservation invariants).

## FR-10: Anti-false-green invariants

No verdict SHALL be produced without parsed evidence bytes and bindings parsed from a separately hash-verified canonical sidecar whose artifact ID/hash match those bytes. Every `done-verified` claim SHALL cite evidence hashes; every green result SHALL correspond to a parsed producer row; freshness configuration cannot bypass required bindings; overlay-only evidence cannot satisfy canonical readiness; and every task/result/trace projection SHALL retain its candidate/graph/evidence identities.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-no-verdict-without-evidence-bytes)

**Scenario:** `@feature10` / `SCEN-spec-evidence-anti-false-green-invariants`

**Sources:** `MIGRATION_MATRIX.md` rows FR-35 (ADOPT: test-quality honesty gate), FR-56 (ADOPT: freshness); upstream incident class 526 (motivation).

## FR-11: Real fixtures per spec-kernel discipline

Every executable evaluation fixture SHALL originate from actual bytes emitted by an identified producer, be immutable, and record: fixture ID, capture command/method, producer and version/commit, source path or URL, capture date, SHA-256, byte count, license disposition, permitted trimming, and human-reviewed ground truth. Ground truth SHALL include expected ingestion state, join outcomes, freshness verdicts, and census counts so every conservation equation can be reconciled. Synthetic fixtures MAY be used only for scale or minimal negative variants and SHALL be labeled synthetic. Multi-language NDJSON fixtures SHALL cover at least two distinct producers.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fixtures-are-real-hashed-and-reconciled)

**Scenario:** `@feature11` / `SCEN-spec-evidence-real-fixture-provenance`

**Sources:** `spec-kernel:FR-11` (house standard); `MIGRATION_MATRIX.md` rows FR-31 (ADOPT: real multi-language NDJSON fixtures), FR-9 (ADOPT: language-neutral input).

## FR-12: Budgets

The pure evaluator SHALL enforce input count/byte, parsed-record, diagnostic-byte, census-byte and response-byte limits from `EvidenceLimitsV2`. The caller SHALL measure latency externally because the evaluator observes no clock. Exceeded hard limits return `LIMIT_EXCEEDED`; truncation is permitted only with explicit totals and cursor/overflow fields defined by the public schema.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-budgets-are-measured-and-enforced)

**Scenario:** `@feature12` / `SCEN-spec-evidence-budget-enforcement`

**Sources:** `spec-kernel:FR-12` (budget discipline); [NFR.md](NFR.md).

## FR-13: Release-eligibility contribution

The release evaluator SHALL consume `SpecEvidenceReleaseManifestV2` and require exactly one current PASS record for every CHK-FR1-01 through CHK-FR14-01. Every record SHALL carry non-empty rehashed evidence and matching candidate/graph bindings; the aggregate evidence fingerprint SHALL follow the canonical byte formula in the schema. Missing, extra, duplicate, failed, stale, mismatched, unbound or structural-only records SHALL fail closed with deterministic blockers. This evidence aggregate contributes to, but never replaces, `product:FR-6`.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-contribution-fails-closed)

**Scenario:** `@feature13` / `SCEN-spec-evidence-release-contribution`

**Sources:** `spec-kernel:FR-14` (conjunctive release eligibility as template); `product:FR-6` (cumulative gate); [README.md](README.md) release boundary.

## FR-14: MCP projection of get_test_result and get_scenario_trace

The pure evaluator SHALL expose sufficient fingerprint-bound output for the two read-only MCP projections defined in `spec-evidence_SCHEMA.md`: `get_test_result` returns the selected canonical/overlay result, freshness bindings and evidence hashes; `get_scenario_trace` additionally returns run identity/source, trace identity/source hash, failed step and bounded error. Missing evidence returns explicit nulls, never fabricated status; ambiguous candidates and trace steps use consumable fingerprint-bound cursors. These tools are not historical `spec-kernel:FR-8` operations and do not appear in the v0.3 first-slice registry.

**Acceptance:** [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-mcp-projection-of-gettestresult-and-getscenariotrace)

**Scenario:** `@feature14` / `SCEN-spec-evidence-mcp-projection-of-run-results`

**Sources:** `docs/decisions/spec-generator-port.md` census rows 21–22 (`get_test_result`, `get_scenario_trace`); `spec-kernel:FR-6` (no pass/fail from parse); `spec-lsp:FR-6` (hover kernel-stored fields only).
