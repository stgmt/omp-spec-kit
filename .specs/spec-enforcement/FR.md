# Functional Requirements

All runtime identities in this specification use `spec-enforcement:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status. The enforcement hooks target pinned OMP v17.3.7 extension surfaces; every cited runtime contract carries a probe obligation in [TASKS.md](TASKS.md) before implementation.

## FR-1: Event-surface selection and pinning

The enforcement hooks SHALL use exactly these OMP hook events: `tool_call` for pre-execution interception of write/edit/bash operations touching `.specs/**`; `tool_result` for post-execution diagnostic injection on spec-file reads; `context` for message injection of corpus census summaries; `session_start` for lifecycle-scoped kernel initialization and corpus census computation. No other events SHALL be subscribed. Every cited event contract SHALL be re-proven live by TASK-1 probes against the pinned v17.3.7 runtime before implementation. The claim set is pinned to the installed source paths documented in `RESEARCH.md` and the pinned-commit extensions guide; mutable `main` documentation is not authoritative.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-event-subscriptions-match-the-pinned-claim-set)

**Scenario:** `@feature1` / `SCEN-event-surface-selection`

**Sources:** installed `src/extensibility/hooks/types.ts` `ToolCallEvent`; `src/extensibility/shared-events.ts` `ContextEvent`, `ToolCallEventResult`; `docs/hooks.md` event catalog; `plan-gate:FR-1` provenance posture for pinned-commit citation.

## FR-2: Informational mode diagnostic injection

While informational mode is active (stages before any authoring door exists), the hooks SHALL inject spec-kernel findings and corpus census summaries into `tool_result` content and `context` messages. The hooks SHALL NEVER block any tool execution in informational mode. The hooks SHALL NEVER mutate repository state. Diagnostic injections SHALL be bounded (≤2 KiB per `tool_result` addition, ≤4 KiB per `context` message). Kernel diagnostics SHALL contain only findings produced by `spec-kernel:FR-6`; no private rule set SHALL be introduced. When the kernel is unavailable, informational summaries SHALL be absent with an explicit stated reason per FR-4.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-diagnostics-are-injected-only-in-informational-mode), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-corpus-census-is-injected-on-session-start)

**Scenario:** `@feature2` / `SCEN-informational-mode-diagnostic-injection`

**Sources:** installed `src/extensibility/hooks/tool-wrapper.ts` post-execution emission; `src/extensibility/shared-events.ts` `ContextEvent`; `spec-kernel:FR-6` diagnostics contract; `plan-gate:FR-3` injection precedent.

## FR-3: Enforcement mode write interception

While enforcement mode is active, the `tool_call` handler SHALL intercept agent writes to `.specs/**` by matching `write` and `edit` tool calls whose target path resolves under `.specs/`, and `bash` tool calls whose command string contains file-write operations targeting `.specs/`. Matched calls SHALL return `{block: true, reason}` where the reason directs the agent to the authoring door (`spec-authoring-workflow`) or states the specific policy violation. The decision contract SHALL mirror `plan-gate:FR-10` deny format discipline: bounded reason, actionable redirect, no stack traces. Non-matching calls SHALL return nothing and SHALL NOT be inspected further. Path matching SHALL normalize separators to `/`, reject traversal and symlinks, and stay inside the project root.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-spec-writes-are-blocked-or-redirected-in-enforcement-mode)

**Scenario:** `@feature3` / `SCEN-enforcement-mode-write-interception`

**Sources:** installed `src/extensibility/hooks/tool-wrapper.ts:42–74` block semantics; `docs/skills/authoring-hooks.md` lines 82–101 pre-tool blocking contract; `plan-gate:FR-10` deny format discipline; `spec-authoring-workflow:FR-12` no-bypass invariant.

## FR-4: Fail-honest policy

A hook error, missing kernel, unparseable artifact, or any internal fault SHALL produce an explicit visible message surfaced through `tool_result` content addition or `context` message injection. The hooks SHALL NEVER produce silent pass-through on fault. The hooks SHALL NEVER report fake success or fake-green indicators. Every fault class SHALL map to one bounded diagnostic record with a closed code and a human-readable reason. Handler exceptions SHALL be caught within the handler and translated to diagnostic content; they SHALL NOT propagate to the OMP tool wrapper's fail-closed default. This policy applies in both informational and enforcement modes.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-hook-errors-produce-explicit-visible-messages)

**Scenario:** `@feature4` / `SCEN-fail-honest-policy`

**Sources:** installed `src/extensibility/hooks/tool-wrapper.ts:43` fail-closed default; `spec-kernel:FR-6` anti-fake-green lineage; `plan-gate:FR-2` fault compensation precedent (adapted from fail-open to fail-honest).

## FR-5: No hidden state

The enforcement hooks SHALL keep no private logs, counters, audit trails, or persistent state outside event-visible records. All observable state SHALL surface through `tool_result` content additions, `context` message injections, or session-local diagnostic records visible through the extension's public query surface. No files SHALL be created outside the session-local temporary directory. No network calls SHALL be made. No credentials SHALL be accessed. This policy is consistent with `MIGRATION_MATRIX.md` FR-39 deferral (audit log deferred to a later adapter/policy stage).

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-no-state-exists-outside-event-visible-records)

**Scenario:** `@feature5` / `SCEN-no-hidden-state`

**Sources:** `MIGRATION_MATRIX.md` row FR-39 DEFER rationale; `spec-kernel:FR-1` pure read-only boundary; `plan-gate:FR-11` self-contained runtime precedent.

## FR-6: Dependency-safe distribution

Hook modules SHALL ship inside the bundled `omp-spec-kit` plugin artifact with no ambient `node_modules`, no dynamic post-install downloads, no native addons, and no unresolved dynamic imports. The runtime SHALL either use no third-party dependencies or fully bundle every non-OMP dependency and required data/license. Hook absence (module not found, factory throws at load time) SHALL degrade honestly per FR-4 and FR-8: an explicit diagnostic message SHALL be produced, and the session SHALL continue without enforcement or informational behavior. This posture mirrors `spec-kernel:FR-10` and `plan-gate:FR-11`.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-hooks-execute-dependency-absent)

**Scenario:** `@feature6` / `SCEN-dependency-safe-distribution`

**Sources:** `spec-kernel:FR-10` self-contained runtime distribution; `plan-gate:FR-11` self-contained in-process runtime; `docs/marketplace.md` plugin installation model.

## FR-7: No bypass paths

The enforcement surface SHALL NOT create alternate write routes around the authoring door. Every tool capable of writing to `.specs/**` SHALL be matched by the `tool_call` handler: at minimum `write`, `edit`, and `bash` with file-redirection patterns. Extension-registered tools that write to `.specs/**` SHALL also be intercepted because `tool_call` fires for all tools once the registry is wrapped. The handler SHALL NOT expose any configuration option, environment variable, or API that disables interception for specific callers or paths. This mirrors `spec-authoring-workflow:FR-12` "no bypass, hidden state".

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-all-write-surfaces-to-specs-are-intercepted)

**Scenario:** `@feature7` / `SCEN-no-bypass-paths`

**Sources:** `spec-authoring-workflow:FR-12` no-bypass invariant; installed `src/extensibility/extensions/wrapper.ts` tool wrapping for all registered tools; `docs/extensions.md` line 44 — every tool execution is wrapped with extension interception.

## FR-8: Degradation ladder

When the kernel is unavailable (missing module, initialization failure, version mismatch), informational summaries SHALL be absent with an explicit stated reason; enforcement mode SHALL NOT activate. When the authoring door is absent (not yet accepted per FR-9), enforcement mode SHALL be disabled by stage, not by error; informational mode SHALL continue if the kernel is available. Each degradation step SHALL produce one bounded diagnostic record naming the missing component and the resulting behavior change. Degradation SHALL never produce silent pass-through or fake success per FR-4.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-enforcement-is-inert-before-cumulative-gate-acceptance)

**Scenario:** `@feature8` / `SCEN-degradation-ladder`

**Sources:** `spec-kernel:FR-10` honest degradation posture; `plan-gate:FR-2` fault inventory precedent; RESEARCH RF-5 fail-honest distinction.

## FR-9: Stage-gated activation

Enforcement mode SHALL be inert until the authoring stage's cumulative gate is accepted: `product:FR-6` requires accepted current-candidate `plugin-distribution:FR-13`, `spec-kernel:FR-14` for both `v0.2` and `v0.3` with typed predecessor linkage, and `spec-authoring-workflow:FR-13`. Before acceptance, the hooks SHALL operate in informational mode only regardless of configuration. After acceptance, enforcement mode SHALL activate automatically without user intervention. The gate status check SHALL be performed at `session_start` and cached for the session duration; it SHALL NOT be re-evaluated mid-session.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-enforcement-activates-only-after-cumulative-gate)

**Scenario:** `@feature9` / `SCEN-stage-gated-activation`

**Sources:** `product:FR-6` cumulative gate; `spec-authoring-workflow:FR-13` authoring door acceptance; `ROADMAP.md` lines 46–50 authoring/mutation entry gates.

## FR-10: Diagnostics are spec-kernel findings only

All diagnostic content injected by the hooks SHALL originate from `spec-kernel:FR-6` findings. The hooks SHALL NOT introduce a private rule set, custom validation logic, or independent conformance checks. When the kernel produces no findings for a touched spec, the diagnostic injection SHALL state "no findings" rather than omitting the section. Diagnostic format SHALL follow the kernel's bounded diagnostic record contract (closed codes, bounded messages, repository-relative paths only).

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-diagnostics-originate-from-spec-kernel-only)

**Scenario:** `@feature10` / `SCEN-diagnostics-are-kernel-findings-only`

**Sources:** `spec-kernel:FR-6` invariants and diagnostics contract; `spec-kernel_SCHEMA.md` diagnostic record shape.

## FR-11: Release eligibility conjunction

The release evaluator SHALL produce `spec-enforcement-release@1` and mark a candidate eligible only with: closed stage/profile match; one passing hash-bound record per mandatory check for FR-1 through FR-10, including TASK-1 live ABI probe records as gating evidence for FR-1/FR-3; dependency-absent installed smoke; budget evidence; and the independent adversarial review record. Missing, extra, duplicate, failed, stale, mismatched, or unbound records SHALL fail closed with deterministic blockers. Structural specification text and unexecuted Gherkin SHALL NOT satisfy evidence. Eligibility SHALL NOT imply authorization to ship; the release stage decision is recorded separately per the roadmap authoring/mutation gate. Informational mode requires `spec-kernel:FR-14` eligibility for `v0.2` as a prerequisite.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-release-gate-is-a-closed-conjunction)

**Scenario:** `@feature11` / `SCEN-spec-enforcement-release-conjunction-fails-closed`

**Sources:** `plugin-distribution:FR-13`, `spec-kernel:FR-14` house standard; [README.md](README.md) release boundary; `plan-gate:FR-13` release conjunction precedent.
