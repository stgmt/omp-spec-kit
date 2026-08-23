# Research

## Scope and method

This research combines two evidence classes: (1) the installed OMP runtime source `pi-coding-agent@17.3.7` at `C:\Users\stigm\.omp\plugins\node_modules\@oh-my-pi\pi-coding-agent\src\` (pinned per the repository contract note `docs/omp-v17.3.7-contract.md`), and (2) the upstream `dev-pomogator` plan-gate working tree at `E:\repos\dev-pomogator\tools\plan-pomogator\` plus the 2026-08-23 design analysis in that repository's `audit-reports/`. OMP-side findings are stated with installed source paths and must be re-proven live by TASK-1 before implementation. Upstream facts are research evidence only; no upstream byte is imported without a manifest/hash/license decision.

## RF-1: Native OMP plan approval validates almost nothing

**Finding:** `preparePlanForReview` checks only that plan mode is active, that a plan file resolves/exist, and that the title normalizes. Plan content — structure, completeness, traceability — is enforced only by prompt text.

**Evidence:**
- `src/session/agent-session.ts:934` — `preparePlanForReview(title)` body: `resolveApprovedPlan` + `planExists: true`; no content validation.
- `src/prompts/system/plan-mode-active.md` — structure guidance (Context / Approach / Critical files / Verification / Assumptions) is prose only.

**Decision:** A content gate has a real gap to fill; it attaches at approval time, before the approval popup.

## RF-2: `tool_call` on the model-issued `write` to `xd://propose` is the interception point

**Finding:** Every tool execution emits `tool_call` with payload `{type, toolName, toolCallId, input}` before execution; a handler may return `{block?: boolean, reason?: string}` and blocking throws the reason back to the model. Extensions can subscribe to `tool_call` and `context` directly through the extension API overloads. The approval request travels through the ordinary `write` tool targeting `xd://propose`: the write CONTENT carries only the plan's `<slug>` title (matching `local://<slug>-plan.md`), while the full plan body was already written earlier to `local://<slug>-plan.md` — so validating at propose time reads the current plan file from disk. Model-issued calls emit the event; nested device dispatches do not.

**Evidence:**
- `src/extensibility/hooks/types.ts:306` — `ToolCallEvent` shape.
- `src/extensibility/extensions/types.ts:1246–1247` — extension `on("context")` and `on("tool_call")` subscription overloads with `ToolCallEventResult`.
- `src/extensibility/hooks/tool-wrapper.ts:42–74` — emission before execution, block/reason semantics, `input` rewrite rules including the nested-dispatch exception.
- `src/extensibility/shared-events.ts:306–332` — `ToolCallEventResult` contract.
- `src/tools/resolve.ts:33–63,86–89,294–307` — `PROPOSE_DEVICE_PATH = "xd://propose"`, `isProposeToolCall`, and the rule that propose accepts only the plan title while plan mode is active.

**Decision:** FR-1 matches `toolName === "write"` with target prefix `xd://propose` and reads the plan file separately from the session-local directory. Remaining live probe obligations (TASK-1): exact emission for model-issued propose writes and the nested-dispatch negative, plus the session-identity-to-directory-name mapping.

## RF-3: OMP hook faults fail closed; the port must compensate in code

**Finding:** The OMP tool wrapper treats a hook handler error or timeout as a block ("fail-safe"). The upstream gate's operational doctrine is the opposite: any gate fault allows (`catch { /* fail-open */ }`). Therefore fail-open in OMP is not a configurable policy but mandatory handler code: every internal fault path must be swallowed and translated to a non-blocking result.

**Evidence:**
- `src/extensibility/hooks/tool-wrapper.ts:43` — "If hook errors/times out, block by default (fail-safe)".
- Upstream `tools/plan-pomogator/plan-gate.ts:382` — fail-open catch around duplicate detection; `resolvePlanFile` returns null → exit 0.

**Decision:** FR-2 defines the exhaustive fault inventory and the invariant: blocking only after a complete successful validation that returned errors.

## RF-4: Session identity and plan-file location are derivable without heuristics

**Finding:** Extensions can read the session ID via the runner (`sessionId` getter delegating to `sessionManager.getSessionId()`), and `local://` artifacts live physically under `os.tmpdir()/omp-local/<safeSessionId>/`. A plan written as `local://<slug>-plan.md` is therefore an ordinary file at `%TEMP%/omp-local/<session-id>/<slug>-plan.md`.

**Evidence:**
- `src/extensibility/extensions/runner.ts:641` — `get sessionId()`.
- `src/internal-urls/local-protocol.ts` — `shortLocalRoot` builds `…/omp-local/<safeSessionId>`.

**Decision:** FR-1 resolves plans only from this deterministic directory; no guessing, no fallback search. Whether the directory name equals the runner session ID verbatim or transformed by `safeSessionId` is a TASK-1 probe obligation.

## RF-5: Grounding needs a self-owned prompt cache fed by `context` events

**Finding:** The upstream phases 2/2.5 consume a session prompt cache (`.plan-prompts-{sessionId}.json`, rolling 10 entries, 2h GC). OMP fires a `context` event before each LLM call carrying a deep copy of the outgoing messages, safe to read. Pulling prompts from `session_stop` transcripts would arrive too late (plan already at approval) and parse a foreign format.

**Evidence:**
- `src/extensibility/shared-events.ts:179–183` — `ContextEvent` with mutable deep copy.
- Upstream `tools/plan-pomogator/prompt-store.ts` (rolling cache semantics), `plan-gate.ts:403–411` (relevance window + deny at score ≤ −20).

**Decision:** FR-6 ports the relevance engine unchanged in semantics (deterministic, stop-word based, no LLM) and defines the OMP-side cache adapter. Cache absence degrades to skip, never block.

## RF-6: The upstream validation core is portable as a pure function

**Finding:** `validate-plan.ts` is a phased library (`validatePlanPhased`) over plan text: phase 0 duplicate (SHA-256 + ±10-byte size short-circuit), phase 1 structure (10 mandatory sections with order, human summary, Existing-Spec Inventory 4 subsections, FR/AC(EARS)/NFR/Assumptions subsections, Todos blocks, Verification Plan, File Changes relative-path/action/Reason rules, Impact Analysis on destructive actions), phase 2 Extracted Requirements ≥2, phase 2.5 relevance, phase 3 cross-references (`CROSS_REF_THRESHOLD = 0.5`), phase 4 actionability warnings. Deny rendering is `line N: message` + `💡 hint` per error (`formatDenyErrors`).

**Evidence:**
- `tools/plan-pomogator/validate-plan.ts:20–31` — `REQUIRED_SECTIONS` (10 entries); `:471` — `CROSS_REF_THRESHOLD = 0.5`; `:37–42` — requirements subsection grammar.
- `tools/plan-pomogator/plan-gate.ts:105–128` — duplicate detection; `:279–281` — `formatDenyErrors`; `:210` — `scorePromptRelevance`.
- Upstream registry `tools/hook-service/registry.json` — `PreToolUse/1/0`, matcher `ExitPlanMode`, timeout 60s (Claude-side trigger being replaced, not ported).

**Decision:** FR-4/FR-5/FR-6/FR-7 re-specify these phases as pure target-owned validation. The upstream file itself is not imported; the port is a rewrite that preserves measured semantics (thresholds, section set) as research inputs.

## RF-7: Spec-reference enforcement is new and disk-checkable before the kernel exists

**Finding:** The 2026-08-23 port analysis introduced requirement S-2 (absent from upstream too): plans touching `.specs/**` or guarded paths must cite existing `<slug>:FR-N`/`<slug>:AC-N.M`. Existence is verifiable directly from the repository tree (slug directory + GLFM heading scan) without the v0.2 kernel.

**Evidence:**
- Upstream `audit-reports/omp-plan-mode-analysis-2026-08-23.md` §6.5 item S-2; `audit-reports/omp-plan-gate-design-2026-08-23.md` §2/§3.
- Upstream `tools/_shared/scope-gate-score-diff.ts` — `detectGuardFiles` guarded-path set (research input for the guarded list).

**Decision:** FR-9 checks references against disk bytes. A later v0.2 kernel MAY strengthen ID resolution through graph edges, but the gate must not depend on the kernel.

## RF-8: The gate must satisfy the same self-containment discipline as shipped stages

**Finding:** Repository releases require dependency-absent installed artifacts; upstream gate dependencies (daemon HTTP dispatch, shared token, registry, prompt-cache files under `~/.claude`) are all harness machinery explicitly dropped by `MIGRATION_MATRIX.md` (FR-5/FR-19/FR-22/FR-24/FR-25).

**Evidence:**
- `MIGRATION_MATRIX.md` rows FR-5, FR-6, FR-19, FR-22, FR-24, FR-25 (DROP).
- `plugin-distribution:FR-5`, `spec-kernel:FR-10` — dependency-absent installed execution as the house standard.

**Decision:** FR-11: validation runs in-process inside the single child extension, dependency-free or fully bundled; no daemon, network, credential, or process spawn.

## RISK-1: OMP fail-closed default converts gate bugs into session denial

**Likelihood:** Medium. **Impact:** Critical. Any uncaught handler exception blocks `xd://propose` for the whole session.

**Mitigation:** FR-2 exhaustive fault inventory; a single wrapping catch; fault-injection scenarios `@feature2`; independent review plants every fault class.

## RISK-2: Contract drift between cited v17.3.7 source and a later runtime

**Likelihood:** Medium. **Impact:** High. Pin move or `input` shape change silently breaks matching.

**Mitigation:** Runtime pin documented; TASK-1 probes recorded as evidence; version mismatch fails the release conjunction.

## RISK-3: Injection spam degrades every LLM call

**Likelihood:** Medium. **Impact:** Medium. An unconditional context injection taxes tokens outside plan authoring.

**Mitigation:** FR-3 limits injection to plan-mode activity, one bounded message ≤2 KiB, never duplicating within one call.

## RISK-4: Spec-reference checks read outside containment

**Likelihood:** Low. **Impact:** High. Reference validation could be abused to read arbitrary paths.

**Mitigation:** FR-9 restricts reads to `<project-root>/.specs/<slug>/` canonical documents reached only through referenced slugs; symlinks rejected; absolute paths never returned in diagnostics.

## RISK-5: Grounding false positives block legitimate plans

**Likelihood:** Medium. **Impact:** Medium. Deterministic lexical relevance can misjudge short or meta prompts.

**Mitigation:** Keep the upstream-scored threshold as a research input but require fixture vectors for borderline cases; cache-empty degrades open; relevance block reason embeds the prompt window for human review.

## Open decisions

1. Exact deny channel budget split between error list, template excerpt, and prompt excerpt (bounded total per NFR-SIZE-1).
2. Whether guarded-path detection ports the upstream list verbatim or a target-owned subset (decide with TASK-6 fixtures).
3. Whether phase-4 advisory findings attach to a later `session_stop` continuation or remain diagnostic-only in the first release (deferred; first release is diagnostic-only).
