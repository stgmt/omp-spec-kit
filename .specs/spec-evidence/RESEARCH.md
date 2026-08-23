# Research

## Scope and method

This research combines three evidence classes: (1) the spec-kernel graph contract as defined in `.specs/spec-kernel/FR.md` and `spec-kernel_SCHEMA.md`; (2) the upstream `dev-pomogator` specification at `docs/upstream/dev-pomogator/spec-generator-v4/` (`FR.md`, `DESIGN.md`) as provenance for evidence-evaluation concepts; and (3) the `MIGRATION_MATRIX.md` dispositions that assign upstream FR-9, FR-31, FR-32, FR-35, FR-46, FR-50, and FR-56 to this specification's scope. Upstream facts are research evidence only; no upstream byte is imported without a manifest/hash/license decision.

## RF-1: The kernel cannot evaluate evidence by architectural mandate

**Finding:** `spec-kernel:FR-6` states that diagnostics "never convert a structural parse into a readiness or passing-test claim." The kernel produces definitions, references, headings, links, nodes, edges, and conservation-checked diagnostics — but not verdicts about whether tests passed, whether evidence is fresh, or whether tasks are verified.

**Evidence:**
- `spec-kernel:FR-6` — explicit prohibition on readiness/passing-test claims from structural parsing.
- `spec-kernel:FR-1` — pure read-only kernel with no execution-artifact input.

**Decision:** Evidence evaluation must be a separate specification consuming the kernel graph as one immutable input and execution artifacts as a second immutable input. This spec defines that boundary.

## RF-2: Upstream evidence-derived task status requires rewrite

**Finding:** `MIGRATION_MATRIX.md` row FR-32 disposes upstream "Evidence-derived task status" as REWRITE: "Keep fail-closed status truth; remove source runner paths and define standalone evidence inputs." The upstream implementation coupled task status to dev-pomogator runner paths and Claude-specific machinery.

**Evidence:**
- `MIGRATION_MATRIX.md` row FR-32 — REWRITE disposition.
- `docs/upstream/dev-pomogator/spec-generator-v4/FR.md` FR-32 — upstream evidence-derived status concept.
- `docs/upstream/dev-pomogator/spec-generator-v4/DESIGN.md` — honesty-gate component referencing FR-32.

**Decision:** FR-7 in this spec rewrites the concept as a pure function of kernel graph + artifact bytes, with no runner-path or harness coupling.

## RF-3: Stale results reported as passed is a known incident class

**Finding:** Upstream incident class "526 stale results reported as passed while execution lane claimed GREEN" demonstrates that without explicit freshness enforcement, once-passing results continue to satisfy completion even after the scenarios they claim have changed.

**Evidence:**
- Upstream FR-56 disposition (ADOPT): "Preserve current-run provenance and never let stale overlays replace the canonical snapshot."
- Upstream FR-35 disposition (ADOPT): "Passing plumbing alone must not count as requirement evidence."

**Decision:** FR-6 defines freshness/staleness as pass-through metadata; stale results never satisfy readiness. FR-10 codifies anti-false-green invariants motivated by this incident class.

## RF-4: Cucumber Messages NDJSON is the portable canonical format

**Finding:** `MIGRATION_MATRIX.md` row FR-9 disposes "Language-neutral Cucumber Messages input" as ADOPT: "Canonical multi-runner evidence is product-neutral and belongs in the evidence model." Row FR-31 adopts real multi-language NDJSON fixtures.

**Evidence:**
- `MIGRATION_MATRIX.md` rows FR-9, FR-31.
- Cucumber Messages protocol is language-neutral and emitted by Cucumber-JS, Reqnroll, behave, and Cucumber-JVM.

**Decision:** FR-2 establishes Cucumber Messages NDJSON as the canonical artifact kind with a closed, versioned set.

## RF-5: Task↔scenario↔requirement trace is adopted

**Finding:** `MIGRATION_MATRIX.md` row FR-46 adopts "Task↔scenario↔requirement trace": "Completion must be backed by the task's own current scenario evidence." Row FR-50 adopts "Refuse fake-close of waived tasks."

**Evidence:**
- `MIGRATION_MATRIX.md` rows FR-46, FR-50.

**Decision:** FR-4 defines scenario-result join; FR-8 defines waiver honesty; both contribute to the trace obligation.

## RF-6: Canonical coverage plus freshness overlay separation

**Finding:** `MIGRATION_MATRIX.md` row FR-56 adopts "Canonical coverage + freshness overlay": the canonical full-run result must be retained separately from any newest overlay, and overlays never replace canonical.

**Evidence:**
- `MIGRATION_MATRIX.md` row FR-56.

**Decision:** FR-5 defines canonical vs overlay separation as a first-class invariant.

## RISK-1: Evaluation purity depends on adapter discipline

**Risk:** If the evaluator imports filesystem, clock, network, or process observation internally, it violates the pure-function boundary and becomes non-deterministic.

**Mitigation:** FR-1 mirrors `spec-kernel:FR-1` discipline: evaluation is a pure function of (kernel graph + immutable artifact bytes + limits); adapters handle all I/O separately.

## RISK-2: Fixture provenance gap for multi-language NDJSON

**Risk:** Real NDJSON fixtures from multiple producers require capture, hashing, and license disposition per `spec-kernel:FR-11`. No target-owned captures exist yet.

**Mitigation:** TASK-6 plans fixture capture; FIXTURES.md defines admission policy consistent with `spec-kernel:FR-11`.
