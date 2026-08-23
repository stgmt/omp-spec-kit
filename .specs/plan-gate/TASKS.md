# Tasks

All tasks are future implementation work. Status `Planned` means not started and does not imply runtime evidence. The shared kernel model preserves both `planned` and `todo`, but the external authoring reducer operates only on `todo | ready | in-progress | blocked | done`; `planned` is non-mutable until a future accepted proposal defines normalization.

## TASK-1: Record live ABI probe receipts on the pinned runtime

**Status:** Planned

**Estimate:** 2 days

**Owner:** OMP adapter maintainer

**Depends On:** none

**Requirements:** [FR-1](FR.md#fr-1-approval-interception-and-deterministic-plan-resolution), [FR-3](FR.md#fr-3-preventive-contract-injection), [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding)

**Done When:**
- A disposable OMP project records, for the pinned v17.3.7 runtime: (a) the exact `tool_call` payload of a model-issued `write` to `xd://propose`, confirming the title arrives as the write content; (b) confirmation that nested device dispatches do not emit the event; (c) the mapping between runner session identity and the `omp-local` plan-directory name; (d) the plan-mode visibility signal available to a `context` handler; (e) the user-role message shape observable on `context` events.
- Each probe receipt names runtime version/commit, date, capture command, and artifact hash; receipts are stored under `docs/validation/` of the gate stage and bound to CHK-FR1-01.
- Any deviation from the RESEARCH citations produces a spec correction before TASK-2 starts.

## TASK-2: Freeze gate schema and section model resources

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** TASK-1

**Requirements:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation), [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics), [FR-12](FR.md#fr-12-real-fixtures-and-provenance)

**Done When:**
- `plan-gate@1` types (validation input/result, error codes, deny rendering envelope, cache entry, diagnostic record, release evidence manifest) are represented in runtime types without widening.
- `resources/section-model.json` captures the ten-section skeleton, subsection grammar, closed action set, and guarded-path list with hash inventory; `resources/plan-template.md` is bundled with its hash.
- Every error code in `plan-gate_SCHEMA.md` has a message template and remediation-hint template.

## TASK-3: Implement pure validator phases 0–3

**Status:** Planned

**Estimate:** 5 days

**Owner:** Validator maintainer

**Depends On:** TASK-2

**Requirements:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation), [FR-5](FR.md#fr-5-duplicate-plan-detection), [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding), [FR-7](FR.md#fr-7-file-change-cross-reference-validation), [FR-8](FR.md#fr-8-extracted-requirements-obligation)

**Done When:**
- `validatePlan` is a pure function of plan text, cache entries, sibling-plan reader handle, and limits; it imports no OMP, clock, or network module.
- Phases 0 (duplicate), 1 (structure), 2 (extracted requirements), 2.5 (grounding), and 3 (cross-reference) each emit bounded errors with 1-based lines, closed codes, and hints, ordered deterministically.
- Error lists for the fixture corpus reconcile with reviewed ground truth on Windows and POSIX with byte-identical serialization.

## TASK-4: Implement spec-reference enforcement

**Status:** Planned

**Estimate:** 3 days

**Owner:** Validator maintainer

**Depends On:** TASK-3

**Requirements:** [FR-9](FR.md#fr-9-spec-reference-enforcement)

**Done When:**
- Guarded/spec-touch detection runs over File Changes paths plus the bundled guarded list; plans not touching spec/guarded paths skip the phase.
- Qualified reference extraction recognizes `.specs/<slug>:FR-N` and `.specs/<slug>:AC-N.M`; slug directory existence and canonical-heading existence are read from the project tree with traversal/symlink rejection and per-file/aggregate budgets.
- Fabricated slug, fabricated ID, and zero-reference variants block on the fixture corpus; containment refusals take the fault-allow path with diagnostics.

## TASK-5: Implement match, resolution, cache, deny renderer, and fault barrier

**Status:** Planned

**Estimate:** 4 days

**Owner:** OMP adapter maintainer

**Depends On:** TASK-1, TASK-3

**Requirements:** [FR-1](FR.md#fr-1-approval-interception-and-deterministic-plan-resolution), [FR-2](FR.md#fr-2-fail-open-bridge-policy), [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding), [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics)

**Done When:**
- The `tool_call` subscription matches exactly model-issued propose writes per probe receipts; non-matches return with zero I/O.
- Plan resolution is deterministic from session identity + slug; absent/over-budget resolves allow.
- The prompt cache maintains rolling 10/2h entries in the session-local directory only; malformed cache reads degrade open.
- The deny renderer produces the bounded reason (errors, template ≤8 KiB, five prompts, ≤16 KiB total, explicit truncation).
- One wrapping fault barrier translates every planted fault class to allow + diagnostic; the fault-injection suite proves blocking only after complete successful validation.

## TASK-6: Capture real fixtures and ground truth

**Status:** Planned

**Estimate:** 3 days

**Owner:** Fixture reviewer

**Depends On:** TASK-3

**Requirements:** [FR-12](FR.md#fr-12-real-fixtures-and-provenance), [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation), [FR-9](FR.md#fr-9-spec-reference-enforcement)

**Done When:**
- At least one real valid plan (captured from actual authored plans), plus real negative plans covering every phase, are admitted with complete manifests (capture method, producer, hash, size, license, trimming, ground truth listing expected errors with lines/codes).
- The spec-reference corpus uses a real `.specs` tree snapshot with known existing and fabricated references.
- Synthetic variants are labeled and do not satisfy the real-fixture obligation.

## TASK-7: Implement plan-mode injection

**Status:** Planned

**Estimate:** 2 days

**Owner:** OMP adapter maintainer

**Depends On:** TASK-1, TASK-5

**Requirements:** [FR-3](FR.md#fr-3-preventive-contract-injection)

**Done When:**
- The `context` subscription appends at most one ≤2 KiB injection while plan mode is active, mutates only the event deep copy, and injects nothing outside plan mode or twice per event.
- Injection failure is a non-fatal skip with a diagnostic; validation and blocking are unaffected by injection state.

## TASK-8: Bundle and prove the installed gate artifact

**Status:** Planned

**Estimate:** 3 days

**Owner:** Release maintainer

**Depends On:** TASK-5, TASK-6, TASK-7

**Requirements:** [FR-11](FR.md#fr-11-self-contained-in-process-runtime), [FR-13](FR.md#fr-13-release-eligibility-conjunction)

**Done When:**
- The candidate artifact runs the complete pipeline from the installed directory with source checkout and root/external `node_modules` absent, with zero daemon/network/subprocess/credential activity observed.
- Bundled resources match the shipped hash inventory; artifact size delta and budgets meet `NFR.md` with raw observations.
- Windows and POSIX installed smokes both produce byte-identical validation results for the fixture corpus.

## TASK-9: Run adversarial fault-injection review

**Status:** Planned

**Estimate:** 2 days

**Owner:** Independent reviewer

**Depends On:** TASK-8

**Requirements:** [FR-2](FR.md#fr-2-fail-open-bridge-policy), [FR-9](FR.md#fr-9-spec-reference-enforcement), [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics)

**Done When:**
- An independent reviewer plants each FR-2 fault class, symlink/traversal spec-read attempts, oversized plans, malformed caches, deadline exhaustion, and reason-truncation edges, and observes allow/containment behavior with diagnostics.
- The review confirms the invariant: blocking only after complete successful validation with errors.
- The report distinguishes structural specification from executed evidence and records no unexecuted scenario as passing.

## TASK-10: Implement and prove the release conjunction

**Status:** Planned

**Estimate:** 2 days

**Owner:** Release maintainer

**Depends On:** TASK-8, TASK-9

**Requirements:** [FR-13](FR.md#fr-13-release-eligibility-conjunction)

**Done When:**
- The evaluator validates the closed stage/profile pair, per-record artifact binding, and mandatory check set FR-1..FR-12 including probe receipts, dependency-absent smoke, budgets, and adversarial review records.
- One-fault-at-a-time variants (missing, extra, duplicate, failed, stale, mismatched, unbound records; structural-only claims; unexecuted scenarios) each return deterministic blockers and `eligible=false`.
- The result carries no publication authority and does not authorize release in v0.1.0/v0.2/v0.3.

## Task summary

| Task | Status | Estimate | Owner | Primary output |
|---|---|---:|---|---|
| TASK-1 | Planned | 2 days | OMP adapter maintainer | Live ABI probe receipts |
| TASK-2 | Planned | 2 days | Kernel maintainer | Schema and section-model resources |
| TASK-3 | Planned | 5 days | Validator maintainer | Pure validator phases 0–3 |
| TASK-4 | Planned | 3 days | Validator maintainer | Spec-reference enforcement |
| TASK-5 | Planned | 4 days | OMP adapter maintainer | Match/resolution/cache/deny/fault barrier |
| TASK-6 | Planned | 3 days | Fixture reviewer | Real fixtures and ground truth |
| TASK-7 | Planned | 2 days | OMP adapter maintainer | Plan-mode injection |
| TASK-8 | Planned | 3 days | Release maintainer | Self-contained artifact proof |
| TASK-9 | Planned | 2 days | Independent reviewer | Adversarial fault-injection review |
| TASK-10 | Planned | 2 days | Release maintainer | Release conjunction evidence |
