# Tasks

These are future capability-delivery tasks. `Planned` means no runtime evidence exists. `Blocked` means the task has an explicit external prerequisite. Specification prose and Gherkin never satisfy Done When.

## TASK-1: Freeze manual admission and current host-absence contract

**Status:** Planned

**Estimate:** 2 days

**Owner:** Plan-gate maintainer

**Depends On:** none

**Requirements:** [FR-1](FR.md#fr-1-exact-plan-input-and-future-automatic-approval-event)
**Checks:** CHK-FR1-01

**Done When:**
- Runtime types implement `ManualPlanValidationRequestV1` and reject every non-exact URL/content/hash/title/slug identity with the documented result.
- A pinned v17.3.7 source receipt proves the selected-plan event is absent and records version, commit, paths, capture command, date, and evidence SHA-256.
- Manual output is labeled advisory; no test or documentation calls a title-only propose write automatic interception.

## TASK-2: Implement closed schemas and bundled resources

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** TASK-1

**Requirements:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation), [FR-9](FR.md#fr-9-spec-reference-enforcement), [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics), [FR-12](FR.md#fr-12-real-fixtures-and-provenance)
**Checks:** CHK-FR4-01, CHK-FR9-01, CHK-FR10-01, CHK-FR12-01

**Done When:**
- Runtime types represent every `plan-gate@2` input/result/diagnostic/page/release field without widening.
- `section-model.json`, `plan-template.md`, and exact four-pattern `guarded-paths.json` carry one shipped resource-inventory hash.
- Every closed finding/diagnostic code has one bounded message and remediation template.

## TASK-3: Implement pure validator phases

**Status:** Planned

**Estimate:** 5 days

**Owner:** Validator maintainer

**Depends On:** TASK-2

**Requirements:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation), [FR-5](FR.md#fr-5-duplicate-plan-detection), [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding), [FR-7](FR.md#fr-7-file-change-cross-reference-validation), [FR-8](FR.md#fr-8-extracted-requirements-obligation)
**Checks:** CHK-FR4-01, CHK-FR5-01, CHK-FR6-01, CHK-FR7-01, CHK-FR8-01

**Done When:**
- `validatePlan` is pure over `PlanValidationInputV2` and imports no filesystem, OMP, clock, network, process, or MCP API.
- Identity, duplicate, structure, grounding, cross-reference, and actionability phases emit deterministic bounded findings.
- Candidate and prompt limits, ±10-byte short-circuit, exact `-20` threshold, and 0.5 cross-reference threshold are covered by reviewed vectors.

## TASK-4: Implement contained manual spec-index builder

**Status:** Planned

**Estimate:** 3 days

**Owner:** I/O adapter maintainer

**Depends On:** TASK-2

**Requirements:** [FR-9](FR.md#fr-9-spec-reference-enforcement)
**Checks:** CHK-FR9-01

**Done When:**
- The adapter reads only canonical documents needed for a complete index under the project root.
- Lexical normalization plus Windows reparse/POSIX realpath/symlink containment and 512 KiB/2 MiB limits are enforced.
- Unreadable, containment, partial-index, and budget branches return ALLOW with `SPEC_INDEX_UNAVAILABLE`; invalid/missing identities in a complete index remain validation errors.

## TASK-5: Implement manual adapter, deadline, paging, and fault barrier

**Status:** Planned

**Estimate:** 4 days

**Owner:** Plan-gate maintainer

**Depends On:** TASK-2, TASK-3, TASK-4

**Requirements:** [FR-1](FR.md#fr-1-exact-plan-input-and-future-automatic-approval-event), [FR-2](FR.md#fr-2-fail-open-bridge-policy), [FR-5](FR.md#fr-5-duplicate-plan-detection), [FR-9](FR.md#fr-9-spec-reference-enforcement), [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics)
**Checks:** CHK-FR1-01, CHK-FR2-01, CHK-FR5-01, CHK-FR9-01, CHK-FR10-01

**Done When:**
- Admission reads only the exact plan and declared candidates; no directory scan or temp-root fallback exists.
- Every loop/I/O path observes a hard internal deadline no greater than 20 seconds.
- Each unreadable/containment/resource/exception/deadline fault returns ALLOW plus exactly one bounded diagnostic before the outer timeout.
- Structured pages conserve every complete finding; the 16 KiB reason reports exact omitted count/cursor.

## TASK-6: Capture real fixtures and reviewed ground truth

**Status:** Planned

**Estimate:** 3 days

**Owner:** Fixture reviewer

**Depends On:** TASK-3, TASK-4

**Requirements:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation), [FR-9](FR.md#fr-9-spec-reference-enforcement), [FR-12](FR.md#fr-12-real-fixtures-and-provenance)
**Checks:** CHK-FR4-01, CHK-FR9-01, CHK-FR12-01

**Done When:**
- At least one real valid plan and real negative plans cover every validation phase with producer/version/source/date/hash/size/license/trimming provenance.
- A real contained spec-tree sample covers existing/missing IDs, unreadable documents, symlink/reparse escape, and budget exhaustion.
- Observed findings reconcile exactly with independently reviewed line/code ground truth; synthetic vectors remain labeled.

## TASK-7: Implement explicit prompt adapter and advisory contract output

**Status:** Planned

**Estimate:** 2 days

**Owner:** Plan-gate maintainer

**Depends On:** TASK-1, TASK-3

**Requirements:** [FR-3](FR.md#fr-3-mode-scoped-preventive-contract), [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding)
**Checks:** CHK-FR3-MANUAL-01, CHK-FR6-01

**Done When:**
- Manual requests accept at most five hash-verified user excerpts/64 KiB and return bounded contract guidance as advisory output.
- Empty prompt input skips grounding; malformed/over-budget input returns `PROMPT_CACHE_UNAVAILABLE` without BLOCK.
- No prompt-text or filesystem heuristic claims plan mode, and no repository/session bytes are mutated.

## TASK-8: Bundle and prove the installed manual artifact

**Status:** Planned

**Estimate:** 3 days

**Owner:** Release maintainer

**Depends On:** TASK-5, TASK-6, TASK-7

**Requirements:** [FR-11](FR.md#fr-11-self-contained-in-process-runtime)
**Checks:** CHK-FR11-MANUAL-01

**Done When:**
- The candidate runs the complete MANUAL pipeline from its installed directory with source checkout and external/root `node_modules` absent.
- Instrumentation observes zero daemon, network, subprocess, or credential activity; resources match the shipped hash inventory.
- Windows and POSIX installed smokes produce byte-identical results for the reference corpus and raw budget measurements.

## TASK-9: Run independent adversarial fault review

**Status:** Planned

**Estimate:** 2 days

**Owner:** Independent reviewer

**Depends On:** TASK-8

**Requirements:** [FR-2](FR.md#fr-2-fail-open-bridge-policy), [FR-9](FR.md#fr-9-spec-reference-enforcement), [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics)
**Checks:** CHK-FR2-01, CHK-FR9-01, CHK-FR10-01

**Done When:**
- The reviewer plants exact-plan/candidate/cache/index unreadable faults, realpath/reparse/symlink escapes, partial indexes, oversized input, malformed resources, exceptions, deadline exhaustion, and reason overflow.
- Every internal fault returns ALLOW before 20 seconds; only complete validation errors BLOCK.
- The signed review report carries candidate/evidence hashes and distinguishes specification from execution.

## TASK-10: Implement and prove the manual release conjunction

**Status:** Planned

**Estimate:** 2 days

**Owner:** Release maintainer

**Depends On:** TASK-8, TASK-9

**Requirements:** [FR-13](FR.md#fr-13-release-eligibility-conjunction)
**Checks:** CHK-FR13-01

**Done When:**
- `plan-gate-manual@1` accepts only the exact typed check-ID set in the schema, all bound to one candidate and `explicit-plan-input@1`.
- `PlanGateEligibilityResultV2` returns candidate-bound `eligible`, manual capability state, and closed deterministic blockers; no product delivery authority.
- Missing, extra, duplicate, failed, stale, mismatched, unbound, structural-only, and unexecuted-scenario variants each return deterministic blockers.
- Eligibility updates only the independent manual plan-gate capability state; it does not imply automatic interception or alter historical v0.3 receipts.

## TASK-11: Adopt a supported selected-plan host event

**Status:** Blocked

**Estimate:** 3 days after host availability

**Owner:** OMP adapter maintainer

**Depends On:** external OMP release implementing `docs/omp-plan-approval-event-contract.md`, TASK-10

**Requirements:** [FR-1](FR.md#fr-1-exact-plan-input-and-future-automatic-approval-event), [FR-2](FR.md#fr-2-fail-open-bridge-policy), [FR-3](FR.md#fr-3-mode-scoped-preventive-contract), [FR-11](FR.md#fr-11-self-contained-in-process-runtime), [FR-13](FR.md#fr-13-release-eligibility-conjunction)
**Checks:** CHK-FR1-02, CHK-FR3-AUTOMATIC-01, CHK-FR11-AUTOMATIC-01, CHK-HOST-ABI-01, CHK-FR13-01

**Done When:**
- The repository pins an exact OMP version/commit whose source emits `plan_approval_requested` after native resolution and before approval.
- A live receipt captures selection/approval session IDs, transition kind/copied-plan hash, URL/content/hash/title/slug/planMode, block/allow propagation, nested/non-plan negatives, timeout ordering, capture command/date, and evidence SHA-256.
- The automatic adapter maps that event one-to-one, performs zero fallback scans, and passes dependency-absent installed tests.
- `CHK-HOST-ABI-01`, CHK-FR1-02, CHK-FR3-AUTOMATIC-01, CHK-FR11-AUTOMATIC-01, and the exact automatic release manifest all PASS for the same host/candidate hashes.

## Task summary

| Task | Status | Owner | Primary output |
|---|---|---|---|
| TASK-1 | Planned | Plan-gate maintainer | Manual admission + current host-absence receipt |
| TASK-2 | Planned | Kernel maintainer | Closed schemas/resources |
| TASK-3 | Planned | Validator maintainer | Pure validator |
| TASK-4 | Planned | I/O adapter maintainer | Contained complete spec index |
| TASK-5 | Planned | Plan-gate maintainer | Manual adapter/fault barrier/paging |
| TASK-6 | Planned | Fixture reviewer | Real fixtures/ground truth |
| TASK-7 | Planned | Plan-gate maintainer | Explicit prompt/advisory adapter |
| TASK-8 | Planned | Release maintainer | Installed manual artifact proof |
| TASK-9 | Planned | Independent reviewer | Fault/containment review |
| TASK-10 | Planned | Release maintainer | Manual release conjunction |
| TASK-11 | Blocked | OMP adapter maintainer | Supported host event + automatic profile |
