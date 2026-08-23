# Functional Requirements

All runtime identities in this specification use `plan-gate:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status. The gate targets pinned OMP v17.3.7 extension surfaces; every cited runtime contract carries a probe obligation in [TASKS.md](TASKS.md) before implementation.

## FR-1: Approval interception and deterministic plan resolution

The gate SHALL intercept plan approval by matching the `tool_call` hook event where `toolName` is `write` and the write target is an `xd://propose` URL issued by the model. It SHALL resolve the plan file deterministically: session identity from the extension runner, plan directory `os.tmpdir()/omp-local/<session-identity>/` per the `local://` protocol root, and file name `<slug>-plan.md` where the slug is the propose write content per the native propose contract. It SHALL NOT match nested device dispatches, other tools, or other `xd://` targets. When the resolved file is absent, unreadable, or over budget, the gate SHALL allow and SHALL NOT guess alternate locations or names.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-interception-and-resolution-are-deterministic)

**Scenario:** `@feature1` / `SCEN-approval-interception-and-plan-resolution`

**Sources:** installed `src/extensibility/hooks/types.ts` `ToolCallEvent`; `src/extensibility/hooks/tool-wrapper.ts` emission/block semantics; `src/internal-urls/local-protocol.ts` local root; `src/tools/resolve.ts` propose contract; upstream `plan-gate.ts:resolvePlanFile` fail-open resolution as provenance.

## FR-2: Fail-open bridge policy

The gate handler SHALL translate every internal fault into a non-blocking result. The exhaustive fault classes are: handler exception at any stage; absent or unresolvable plan file; plan bytes over budget; unreadable or malformed prompt cache; relevance/cross-reference/spec-reference subsystem failure; missing template resource; handler deadline expiry; and containment failure (unsafe path rejected during plan or spec-document reads). The gate SHALL NOT throw out of its handler and SHALL NOT rely on host default fault handling. Blocking SHALL occur only after a complete successful validation run that returned one or more blocking errors. Every fault SHALL append one bounded diagnostic record (closed code, bounded message, no absolute paths) to session-local diagnostic state.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-every-gate-fault-path-allows)

**Scenario:** `@feature2` / `SCEN-every-gate-fault-allows`

**Sources:** installed `src/extensibility/hooks/tool-wrapper.ts:43` fail-closed default; upstream `plan-gate.ts` fail-open doctrine (provenance); RESEARCH RF-3, RISK-1.

## FR-3: Preventive contract injection

While plan mode is active, the gate SHALL append at most one bounded injection message to the outgoing messages of each `context` event. The injection SHALL contain the ten-section skeleton names in order, the spec-reference obligation summary, and a bounded template pointer. It SHALL modify only the deep copy supplied by the event, never session-stored messages or repository bytes; it SHALL NOT inject outside plan mode, SHALL NOT duplicate within one event, and SHALL NOT exceed the injection byte budget. Injection absence or failure SHALL NOT affect validation or blocking.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-injection-is-plan-mode-scoped-and-bounded)

**Scenario:** `@feature3` / `SCEN-plan-mode-contract-injection`

**Sources:** installed `src/extensibility/shared-events.ts` `ContextEvent`; upstream design decision D-3 (prevention is part of the gate); RESEARCH RF-5.

## FR-4: Plan content model and structure validation

The validator SHALL be a pure function of plan text, project root, session prompt cache, and limits: it SHALL NOT touch the clock, network, process, OMP, or MCP APIs and SHALL NOT write bytes. It SHALL enforce, as blocking errors, the upstream-derived content model: (a) ten mandatory sections in fixed order — human summary, Context, Existing-Spec Inventory, User Stories, Use Cases, Requirements, Implementation Plan, Todos, Definition of Done, File Changes — with emoji prefixes optional; (b) non-empty human summary body; (c) Existing-Spec Inventory with four subsections (Domain/Lifecycle, Installation/Runtime, Verification, Repository Baseline), each holding verified paths or an explicit `N/A` with reason; (d) Requirements subsections FR, Acceptance Criteria (EARS), NFR, Assumptions in order; (e) Todos blocks with kebab identifiers, description, files, refs, deps fields; (f) Verification Plan naming concrete commands; (g) File Changes as a table with repository-relative paths, actions restricted to `create/edit/delete/rename/move/replace`, and non-empty Reason; (h) Impact Analysis mandatory when any File Changes action is destructive. Every violation SHALL produce one bounded error carrying 1-based line, closed message, and remediation hint.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-mandatory-skeleton-failures-block-with-line-hints)

**Scenario:** `@feature4` / `SCEN-skeleton-structure-validation-blocks`

**Sources:** upstream `validate-plan.ts:20–31` `REQUIRED_SECTIONS`, `:37–42` subsection grammar, `:104–512` phase validators (provenance); RESEARCH RF-6.

## FR-5: Duplicate plan detection

Before structure validation, the gate SHALL compute the plan's SHA-256 and compare it against every other `*-plan.md` file in the same session-local plan directory, applying the ±10-byte size short-circuit before reading candidate bytes. A hash match SHALL produce a blocking error naming the duplicate file by its session-relative name. Unreadable candidates SHALL be skipped without failing the run.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-byte-duplicate-plans-are-detected-deterministically)

**Scenario:** `@feature5` / `SCEN-duplicate-plan-blocked`

**Sources:** upstream `plan-gate.ts:105–128` `checkDuplicatePlan` (provenance).

## FR-6: Prompt cache and deterministic grounding

The gate SHALL maintain a session-scoped prompt cache of at most ten entries, each entry the text of the most recent user-role message observed on `context` events, evicted after two hours of age, keyed strictly per session, stored only in the session-local plan directory, and never written into the repository. Validation phase grounding SHALL score the plan against a deterministic relevance window of cached prompts using stop-word filtered lexical overlap with flood damping and no LLM; a score at or below the deny threshold SHALL produce a blocking error whose reason embeds the selected prompt window excerpt. An empty, absent, or unreadable cache SHALL skip grounding, never block.

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

When File Changes or guarded-path detection shows the plan touches `.specs/**` or a guarded repository path, the plan body SHALL contain at least one qualified reference `.specs/<slug>:FR-N` or `.specs/<slug>:AC-N.M`. The gate SHALL verify each referenced slug exists as a directory directly under `<project-root>/.specs/` and each referenced local ID exists as a canonical heading in that spec's `FR.md` (for `FR-N`) or `ACCEPTANCE_CRITERIA.md` (for `AC-N.M`). Reads SHALL stay inside the project root, reject symbolic links and traversal, and SHALL enforce 512 KiB per-document and 2 MiB aggregate byte limits across all spec-document reads in one run. Missing slug, missing ID, or zero references when required SHALL block. When the plan does not touch spec or guarded paths this phase SHALL not run.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-spec-touching-plans-require-existing-qualified-references)

**Scenario:** `@feature9` / `SCEN-spec-references-enforced-against-disk`

**Sources:** upstream design analysis S-2 (new requirement, absent upstream too); upstream `scope-gate-score-diff.ts:detectGuardFiles` guarded-set concept (provenance); RESEARCH RF-7, RISK-4.

## FR-10: Bounded deny format and diagnostics

A blocking result SHALL return `{block: true, reason}` where reason renders one `line N: message` entry with one remediation hint per blocking error, followed by a bounded plan-template excerpt of at most 8 KiB, followed by the last five cached prompt excerpts. Total reason bytes SHALL respect the response budget; truncation SHALL preserve complete error entries first, then template, then prompts, marking truncation explicitly. Advisory phase findings (anti-generic phrasing, minimal detail, evidence tags, test-spec-sync, bugfix-BDD) SHALL NOT block in this release; they SHALL surface only as bounded diagnostics.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-deny-reason-is-actionable-and-bounded)

**Scenario:** `@feature10` / `SCEN-deny-format-is-actionable`

**Sources:** upstream `plan-gate.ts:279–281` `formatDenyErrors`, template ≤8KB, last-5-prompts inclusion (provenance); upstream `validate-plan.ts` phase 4 warnings (provenance).

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

The release evaluator SHALL produce `plan-gate-release@1` and mark a candidate eligible only with: closed stage/profile match; one passing hash-bound record per mandatory check for FR-1 through FR-12, including TASK-1 live ABI probe records as gating evidence for FR-1/FR-3; dependency-absent installed smoke; budget evidence; and the independent adversarial review record. Missing, extra, duplicate, failed, stale, mismatched, or unbound records SHALL fail closed with deterministic blockers. Structural specification text and unexecuted Gherkin SHALL NOT satisfy evidence. Eligibility SHALL NOT imply authorization to ship in v0.1.0/v0.2/v0.3; the release stage decision is recorded separately per the roadmap authoring/mutation gate.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-gate-is-a-closed-conjunction)

**Scenario:** `@feature13` / `SCEN-plan-gate-release-conjunction-fails-closed`

**Sources:** `plugin-distribution:FR-13`, `spec-kernel:FR-14` house standard; [README.md](README.md) release boundary.
