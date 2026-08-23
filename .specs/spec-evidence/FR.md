# Functional Requirements

All runtime identities in this specification use `spec-evidence:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status. This specification consumes the spec-kernel graph as an immutable input; it does not modify or extend the kernel.

## FR-1: Pure evaluation boundary

The evaluator SHALL be a pure function of (kernel graph + immutable execution-artifact bytes + limits). It SHALL NOT read or write the filesystem, observe the clock/environment/process/network, start watchers, persist caches, or call OMP/MCP APIs internally. Adapters SHALL handle all I/O, artifact retrieval, and integration with external systems separately, mirroring `spec-kernel:FR-1` discipline. Every public evaluation operation SHALL be read-only with respect to repository and graph state.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-evaluator-has-no-side-effects)

**Scenario:** `@feature1` / `SCEN-spec-evidence-pure-evaluation-boundary`

**Sources:** `MIGRATION_MATRIX.md` row FR-32 (REWRITE: standalone evidence inputs); `spec-kernel:FR-1` (pure kernel boundary as mirrored discipline); `docs/upstream/dev-pomogator/spec-generator-v4/DESIGN.md` honesty-gate component (provenance only).

## FR-2: Supported execution artifacts

The evaluator SHALL accept exactly these execution-artifact kinds: Cucumber Messages NDJSON (canonical, language-neutral), pytest-bdd cucumber-json (legacy compatibility), and scenario-result overlays (supplementary metadata). The set SHALL be closed and versioned; unrecognized kinds SHALL produce `NOT_INGESTED` with reason `MALFORMED_ARTIFACT`. Each kind SHALL declare its supported schema versions; unsupported versions SHALL produce `NOT_INGESTED` with reason `MALFORMED_ARTIFACT`. Cucumber Messages NDJSON SHALL be the preferred canonical format per upstream FR-9 adoption.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-closed-versioned-artifact-kind-set)

**Scenario:** `@feature2` / `SCEN-spec-evidence-supported-artifact-kinds`

**Sources:** `MIGRATION_MATRIX.md` rows FR-9 (ADOPT), FR-31 (ADOPT); `docs/upstream/dev-pomogator/spec-generator-v4/FR.md` FR-1 (NDJSON canonical output, provenance only).

## FR-3: Artifact-level ingestion state

Each supplied artifact SHALL receive exactly one ingestion state: `INGESTED`, `NOT_INGESTED`, or `SKIPPED`. `NOT_INGESTED` SHALL carry one closed reason from: `ARTIFACT_ABSENT`, `MALFORMED_ARTIFACT`. `SKIPPED` SHALL carry the closed reason `MISSING_SCENARIO_RESULTS` (parseable container with no scenario results) or `INGESTION_SKIPPED` (caller-directed skip). Artifact-level truth SHALL be distinct from individual scenario results. An `INGESTED` artifact SHALL report counts: parsed (total records), matched (joined to canonical scenarios), unmatched (no canonical join), and malformed (unparseable records within the artifact). Conservation SHALL hold: parsed = matched + unmatched + malformed.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-ingestion-state-is-closed-and-conserved)

**Scenario:** `@feature3` / `SCEN-spec-evidence-artifact-ingestion-state`

**Sources:** `MIGRATION_MATRIX.md` row FR-32 (REWRITE: standalone evidence inputs); `spec-kernel:FR-6` (conservation discipline).

## FR-4: Scenario result join

Every valid producer result SHALL be joined to a canonical scenario or counted as unmatched (conservation). Join SHALL proceed by: (1) qualified scenario ID match (preferred); (2) tag-based match when the producer tags a result with a canonical scenario identifier; (3) name-based fallback when executed feature paths differ from canonical mirrors. When multiple canonical candidates match at the same priority level, the result SHALL be counted as unmatched with reason `AMBIGUOUS_JOIN` rather than arbitrarily assigned. Every join outcome SHALL be recorded: `JOINED`, `UNMATCHED`, or `AMBIGUOUS_JOIN`.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-every-result-is-joined-or-counted-unmatched)

**Scenario:** `@feature4` / `SCEN-spec-evidence-scenario-result-join`

**Sources:** `MIGRATION_MATRIX.md` rows FR-46 (ADOPT: task↔scenario↔requirement trace), FR-56 (ADOPT: coverage); `spec-kernel:FR-5` (typed edge resolution discipline).

## FR-5: Canonical vs overlay separation

The evaluator SHALL retain the canonical full-run result separately from any newest overlay. Overlays SHALL supplement but never replace canonical results. When both canonical and overlay exist for the same scenario, the evaluation output SHALL expose both with explicit labeling. Freshness/staleness verdicts SHALL apply independently to canonical and overlay results. A release-eligibility check SHALL require canonical evidence; overlay-only evidence SHALL NOT satisfy readiness.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-canonical-and-overlay-are-retained-separately)

**Scenario:** `@feature5` / `SCEN-spec-evidence-canonical-overlay-separation`

**Sources:** `MIGRATION_MATRIX.md` row FR-56 (ADOPT: canonical coverage + freshness overlay).

## FR-6: Freshness and staleness

A once-passing result SHALL be stale when its timestamp is older than the scenario definition or step-definition sources it claims, as recorded in the kernel graph. Staleness SHALL be recorded as pass-through metadata on the result; it SHALL NOT be stripped, hidden, or silently corrected. Stale results SHALL NOT satisfy DONE/verified readiness. Freshness comparison SHALL use source timestamps from the kernel graph's heading/span metadata and artifact-embedded timestamps; absent timestamps on either side SHALL produce an indeterminate freshness verdict that also fails to satisfy readiness.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-stale-results-never-satisfy-readiness)

**Scenario:** `@feature6` / `SCEN-spec-evidence-freshness-staleness`

**Sources:** `MIGRATION_MATRIX.md` row FR-56 (ADOPT: freshness overlay); upstream incident class "526 stale results reported as passed while execution lane claimed GREEN" (motivation).

## FR-7: Fail-closed status truth

DONE/verified status SHALL require fresh green evidence joined to the task's own scenarios. Rollups SHALL use all-not-any semantics: one green result among open siblings verifies nothing; every required scenario for a task MUST have fresh green evidence for the task to be DONE/verified. DONE-but-unverified SHALL be a named state distinct from DONE/verified and not-DONE, produced when evidence exists but is stale, ambiguous, or incomplete. Status derivation SHALL NOT use flags, labels, or structural parsing alone; it SHALL require evidence bytes.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-done-verified-requires-fresh-green-evidence)

**Scenario:** `@feature7` / `SCEN-spec-evidence-fail-closed-status-truth`

**Sources:** `MIGRATION_MATRIX.md` rows FR-32 (REWRITE: fail-closed status truth), FR-35 (ADOPT: test-quality honesty gate); `spec-kernel:FR-6` (no readiness from structural parsing).

## FR-8: Waiver honesty

A waived open task SHALL NOT be closed or counted as satisfied by evidence. The waiver flag SHALL be read from the kernel graph's task node metadata. When a task is waived, its status SHALL remain open-waived regardless of any matching green evidence. Coverage census SHALL retain waived tasks in authored totals but exclude them from satisfied counts. The waiver state SHALL be explicitly named in the evaluation output and distinguishable from DONE/verified, DONE-but-unverified, and not-DONE.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-waived-tasks-remain-open-and-unsatisfied)

**Scenario:** `@feature8` / `SCEN-spec-evidence-waiver-honesty`

**Sources:** `MIGRATION_MATRIX.md` row FR-50 (ADOPT: refuse fake-close of waived tasks).

## FR-9: Coverage census with conservation equations

The evaluator SHALL produce a coverage census containing: authored scenario count (from kernel graph), joined result count, unmatched result count (producer-side and author-side separately), malformed record count, and waived task count. Conservation equations SHALL hold: (a) authored scenarios = joined + unmatched-author-side + waived-excluded; (b) ingested valid results = joined + unmatched-producer-side; (c) parsed records = matched + unmatched + malformed. Equation violations SHALL produce a diagnostic and set the census validity flag to false. All counts SHALL be deterministic and reproducible from the same inputs.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-census-conservation-equations-hold)

**Scenario:** `@feature9` / `SCEN-spec-evidence-coverage-census-conservation`

**Sources:** `MIGRATION_MATRIX.md` rows FR-46 (ADOPT: trace), FR-56 (ADOPT: coverage); `spec-kernel:FR-6` (conservation invariants).

## FR-10: Anti-false-green invariants

No verdict SHALL be produced without evidence bytes; no status SHALL be derived from flags, labels, or structural parsing alone. The evaluator SHALL enforce: (a) every DONE/verified claim references at least one evidence byte hash; (b) no result is marked green without a corresponding parsed artifact record; (c) freshness checks cannot be bypassed by configuration; (d) overlay-only evidence cannot satisfy canonical readiness. These invariants are motivated by upstream incident class "526 stale results reported as passed while execution lane claimed GREEN." Violations SHALL produce diagnostics with the specific invariant breached.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-no-verdict-without-evidence-bytes)

**Scenario:** `@feature10` / `SCEN-spec-evidence-anti-false-green-invariants`

**Sources:** `MIGRATION_MATRIX.md` rows FR-35 (ADOPT: test-quality honesty gate), FR-56 (ADOPT: freshness); upstream incident class 526 (motivation).

## FR-11: Real fixtures per spec-kernel discipline

Every executable evaluation fixture SHALL originate from actual bytes emitted by an identified producer, be immutable, and record: fixture ID, capture command/method, producer and version/commit, source path or URL, capture date, SHA-256, byte count, license disposition, permitted trimming, and human-reviewed ground truth. Ground truth SHALL include expected ingestion state, join outcomes, freshness verdicts, and census counts so every conservation equation can be reconciled. Synthetic fixtures MAY be used only for scale or minimal negative variants and SHALL be labeled synthetic. Multi-language NDJSON fixtures SHALL cover at least two distinct producers.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-fixtures-are-real-hashed-and-reconciled)

**Scenario:** `@feature11` / `SCEN-spec-evidence-real-fixture-provenance`

**Sources:** `spec-kernel:FR-11` (house standard); `MIGRATION_MATRIX.md` rows FR-31 (ADOPT: real multi-language NDJSON fixtures), FR-9 (ADOPT: language-neutral input).

## FR-12: Budgets

The evaluator SHALL enforce concrete budgets defined in [NFR.md](NFR.md): evaluation latency, maximum artifact size, maximum artifact count per evaluation, maximum census size, and diagnostic caps. Measurements SHALL report runtime/OS/CPU, corpus fingerprint, warm-up, sample count, percentiles, artifact hash, and raw observations. An exceeded hard limit SHALL return `LIMIT_EXCEEDED` or refuse evaluation; it SHALL NOT silently truncate except where the schema explicitly returns `truncated=true` with conservation-visible totals.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-budgets-are-measured-and-enforced)

**Scenario:** `@feature12` / `SCEN-spec-evidence-budget-enforcement`

**Sources:** `spec-kernel:FR-12` (budget discipline); [NFR.md](NFR.md).

## FR-13: Release-eligibility contribution

The evaluator SHALL produce `spec-evidence-release@1` evidence records that plug a future release stage's all-not-any conjunction like `spec-kernel:FR-14`. Mandatory checks SHALL cover FR-1 through FR-12: each check requires exactly one passing, non-empty, hash-valid, artifact-bound record. Missing, extra, duplicate, failed, stale, mismatched, or unbound records SHALL fail closed with deterministic blockers. Structural specification text and unexecuted Gherkin SHALL NOT satisfy evidence. Eligibility SHALL NOT imply authorization to ship; the release stage decision is recorded separately in `ROADMAP.md`. This spec's contribution SHALL NOT loosen the `product:FR-6` cumulative gate.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-contribution-fails-closed)

**Scenario:** `@feature13` / `SCEN-spec-evidence-release-contribution`

**Sources:** `spec-kernel:FR-14` (conjunctive release eligibility as template); `product:FR-6` (cumulative gate); [README.md](README.md) release boundary.
