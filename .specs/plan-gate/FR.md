# Functional Requirements

All runtime identities in this specification use `plan-gate:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status. Manual validation targets the pinned OMP v17.3.7 environment; automatic approval interception is `DEFERRED_HOST_ABI` until a later pinned host implements `docs/omp-plan-approval-event-contract.md`.

## FR-1: Exact plan input and future automatic approval event

Manual mode SHALL validate one explicitly supplied URL/content/SHA/title/slug tuple. Automatic mode SHALL consume only the post-native-resolver `plan_approval_requested` event defined in `docs/omp-plan-approval-event-contract.md`; it SHALL validate the exact selected plan and SHALL NOT scan directories, guess temp roots or repeat native fallback resolution. On pinned OMP v17.3.7 automatic mode SHALL report `HOST_ABI_UNSUPPORTED` and remain `DEFERRED_HOST_ABI`.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-interception-and-resolution-are-deterministic), [AC-1.2](ACCEPTANCE_CRITERIA.md#ac-12-session-identity-and-slug-normalization-are-pinned)

**Scenarios:** `@feature1` / `SCEN-approval-interception-and-plan-resolution`; `@feature1` / `SCEN-session-transition-plan-resolution`

**Sources:** `docs/omp-v17.3.7-contract.md`; `docs/omp-plan-approval-event-contract.md`; pinned native `resolveApprovedPlan`.

## FR-2: Fail-open bridge policy

The validator's own exception, subsystem failure, resource failure, containment refusal or internal deadline SHALL return ALLOW plus one bounded diagnostic. Internal deadline SHALL be at most 20 seconds, below the pinned host's default 30-second fail-closed timeout. An outer host timeout/error remains fail-closed and is an implementation defect, not ordinary fail-open behavior. BLOCK occurs only after a complete successful validation pipeline returns one or more ERROR findings.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-every-gate-fault-path-allows)

**Scenario:** `@feature2` / `SCEN-every-gate-fault-allows`

**Sources:** pinned extension runner timeout policy; `plan-gate_SCHEMA.md` bridge diagnostics.

## FR-3: Mode-scoped preventive contract

Manual mode returns the template/contract as advisory output for the explicit plan. Future automatic mode MAY append one bounded context message only when the selected-plan host event carries `planMode:true`. The adapter SHALL not infer plan mode from prompt text or filesystem state, mutate stored messages, duplicate injection, or treat injection failure as validation failure.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-injection-is-plan-mode-scoped-and-bounded)

**Scenario:** `@feature3` / `SCEN-plan-mode-contract-injection`

**Sources:** current ContextEvent limits; future selected-plan host contract.

## FR-4: Plan content model and structure validation

The validator SHALL be a pure function of `PlanValidationInputV2`: exact plan bytes and identity, explicit duplicate candidates, explicit prompt excerpts, explicit spec-reference index, and limits. It SHALL NOT touch the filesystem, clock, network, process, OMP, or MCP APIs and SHALL NOT write bytes. It SHALL enforce, as blocking errors, the upstream-derived content model: (a) ten mandatory sections in fixed order — human summary, Context, Existing-Spec Inventory, User Stories, Use Cases, Requirements, Implementation Plan, Todos, Definition of Done, File Changes — with emoji prefixes optional; (b) non-empty human summary body; (c) Existing-Spec Inventory with four subsections (Domain/Lifecycle, Installation/Runtime, Verification, Repository Baseline), each holding verified paths or an explicit `N/A` with reason; (d) Requirements subsections FR, Acceptance Criteria (EARS), NFR, and Assumptions; (e) canonical Todos blocks; (f) a command-bearing Verification Plan; (g) a File Changes table with repository-relative paths, closed actions, and non-empty reasons; and (h) Impact Analysis for destructive actions.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-mandatory-skeleton-failures-block-with-line-hints)

**Scenario:** `@feature4` / `SCEN-skeleton-structure-validation-blocks`

**Sources:** upstream `validate-plan.ts:20–31` `REQUIRED_SECTIONS`, `:37–42` subsection grammar, `:104–512` phase validators (provenance); RESEARCH RF-6.

## FR-5: Duplicate plan detection

Before structure validation, the gate SHALL compute the plan's SHA-256 and compare it against the bounded `duplicateCandidates` supplied explicitly with the request. It SHALL accept at most 20 candidates and 8 MiB aggregate bytes, apply the ±10-byte size short-circuit before hashing, and BLOCK naming a matching candidate URL. It SHALL NOT scan a directory. If a manual adapter cannot read any declared candidate before constructing the complete input, it SHALL return ALLOW plus `DUPLICATE_INPUT_UNAVAILABLE`; an automatic host SHALL supply already-read candidates or omit them.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-byte-duplicate-plans-are-detected-deterministically)

**Scenario:** `@feature5` / `SCEN-duplicate-plan-blocked`

**Sources:** upstream `plan-gate.ts:105–128` `checkDuplicatePlan` (provenance).

## FR-6: Prompt cache and deterministic grounding

Validation SHALL consume an explicit bounded `promptCache` (at most five excerpts and 64 KiB aggregate) supplied with the request. A manual caller MAY construct it from session context available through a separately tested adapter; a future automatic host adapter MAY use host-provided plan-mode context, but the pure validator SHALL neither read session files nor subscribe to OMP events. Grounding SHALL score the plan against the supplied excerpts using deterministic stop-word-filtered lexical overlap with flood damping and no LLM; the exact default deny threshold is `-20`, and a score at or below it SHALL produce a blocking error with the selected prompt excerpt. An empty or unavailable cache SHALL skip grounding; malformed or over-budget cache input SHALL return ALLOW plus a bounded bridge diagnostic.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-grounding-is-deterministic-and-cache-degrades-open)

**Scenario:** `@feature6` / `SCEN-grounding-blocks-and-cache-degrades-open`

**Sources:** upstream `plan-gate.ts:178–269` relevance engine, `plan-gate.ts:403–411` threshold usage, `prompt-store.ts` rolling cache (provenance); installed `shared-events.ts` `ContextEvent` (cache source).

## FR-7: File change cross-reference validation

The gate SHALL verify that File Changes paths are discussed in the plan body: each table path SHALL be searched in the plan text outside the File Changes section; when the unmentioned ratio exceeds the cross-reference threshold 0.5, validation SHALL block with the first five unmentioned paths named in the error. Path comparison SHALL be case-sensitive and separator-normalized to `/`.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-contaminated-file-changes-are-refused)

**Scenario:** `@feature7` / `SCEN-file-change-cross-reference-blocks`

**Sources:** upstream `validate-plan.ts:471–512` `CROSS_REF_THRESHOLD` and phase 3 (provenance).

## FR-8: Extracted requirements obligation

The plan Context section SHALL contain an `Extracted Requirements` block with at least two numbered items derived from the session task. Absence or under-count SHALL produce a blocking error; the deny reason SHALL embed the prompt window excerpt to re-anchor authoring.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-extracted-requirements-are-mandatory)

**Scenario:** `@feature8` / `SCEN-extracted-requirements-enforced`

**Sources:** upstream `validate-plan.ts` phase 2 and `plan-gate.ts` phase 2 deny path (provenance).

## FR-9: Spec-reference enforcement

When File Changes or guarded-path detection shows the plan touches `.specs/**` or a guarded repository path, the plan body SHALL contain at least one qualified reference `.specs/<slug>:FR-N` or `.specs/<slug>:AC-N.M`. The pure validator SHALL resolve those references only against the explicit `specReferenceIndex` supplied with the request. A manual adapter MAY build that index by reading only canonical documents below `<project-root>/.specs/<slug>/`, after lexical normalization plus realpath/reparse/symlink containment, under 512 KiB per-document and 2 MiB aggregate limits. Invalid reference syntax, a missing indexed slug/ID, or zero references when required SHALL block. An unreadable document, containment refusal, missing index, or byte-budget exhaustion while constructing the index SHALL return ALLOW plus `SPEC_INDEX_UNAVAILABLE`; the validator SHALL not infer absence from a partial index. When the plan does not touch spec or guarded paths this phase SHALL not run.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-spec-touching-plans-require-existing-qualified-references)

**Scenario:** `@feature9` / `SCEN-spec-references-enforced-against-disk`

**Sources:** upstream design analysis S-2 (new requirement, absent upstream too); upstream `scope-gate-score-diff.ts:detectGuardFiles` guarded-set concept (provenance); RESEARCH RF-7, RISK-4.

## FR-10: Bounded deny format and diagnostics

A blocking result SHALL expose total error count and a cursor-paged ordered error list. The rendered host reason SHALL include only complete error+hint rows that fit within 16 KiB, then exact omitted count/cursor, then bounded template/prompt excerpts if space remains. It SHALL never claim all N errors fit. Advisory findings remain non-blocking diagnostics.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-deny-reason-is-actionable-and-bounded)

**Scenario:** `@feature10` / `SCEN-deny-format-is-actionable`

**Sources:** `plan-gate_SCHEMA.md` result/overflow contract; upstream formatting only as provenance.

## FR-11: Self-contained in-process runtime

The gate SHALL run inside the single `plugins/omp-spec-kit` child extension with no daemon, network call, credential access, subprocess, or runtime dependency beyond Node/OMP builtins or fully bundled code. It SHALL execute from the installed artifact with source checkout and root `node_modules` absent. It SHALL NOT reuse upstream `hook-service` dispatch, registry, or shared-token machinery. Template and section-model data SHALL ship as bundled plugin resources with hash inventory.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-installed-gate-executes-dependency-absent)

**Scenario:** `@feature11` / `SCEN-self-contained-gate-artifact`

**Sources:** `plugin-distribution:FR-5`, `spec-kernel:FR-10` house standard; `MIGRATION_MATRIX.md` DROP rows FR-5/FR-19/FR-22/FR-24/FR-25.

## FR-12: Real fixtures and provenance

Every executable validation fixture SHALL be a real plan document with recorded provenance: capture method, producer/version, source path, capture date, SHA-256, byte count, license disposition, permitted trimming, and reviewed ground truth listing expected blocking errors per phase with lines and codes. Synthetic fixtures MAY exist only for scale or minimal negative variants and SHALL be labeled synthetic. Upstream fixture bytes are not admitted without their own license/provenance decision.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-fixtures-are-real-hashed-and-reconciled)

**Scenario:** `@feature12` / `SCEN-plan-gate-real-fixture-provenance`

**Sources:** `spec-kernel:FR-11` house standard; upstream `fixtures/valid.plan.md` as capture candidate only.

## FR-13: Release eligibility conjunction

The release evaluator SHALL produce `plan-gate-release@2` and SHALL evaluate two closed profiles. `plan-gate-manual@1` requires one passing hash-bound record for every manual branch of FR-1 through FR-12, including explicit-input identity, unreadable/containment fail-open variants, dependency-absent installed smoke, budgets, fixtures, and independent adversarial review. `plan-gate-automatic@1` additionally requires every automatic FR-1/FR-3 branch plus a source-and-behavior receipt proving `selected-plan-event@1` on the exact pinned host. Missing, extra, duplicate, failed, stale, mismatched, or unbound records SHALL fail closed with deterministic blockers. Structural specification text and unexecuted Gherkin SHALL NOT satisfy evidence. Eligibility belongs to the independent plan-gate capability and SHALL NOT reinterpret v0.1/v0.2/v0.3 history.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-gate-is-a-closed-conjunction)

**Scenario:** `@feature13` / `SCEN-plan-gate-release-conjunction-fails-closed`

**Sources:** `plugin-distribution:FR-13`, `spec-kernel:FR-14` house standard; [README.md](README.md) release boundary.
