# Research

## Scope and method

This research combines two evidence classes: (1) the installed OMP runtime source `pi-coding-agent@17.3.7` at `C:\Users\stigm\.omp\plugins\node_modules\@oh-my-pi\pi-coding-agent\src\` (pinned by `docs/omp-v17.3.7-contract.md`), and (2) the upstream `dev-pomogator` plan-gate working tree at `E:\repos\dev-pomogator\tools\plan-pomogator\` plus its design analyses. OMP-side bytes establish what the current pin does and does not expose. Upstream facts are provenance for validation semantics only; no upstream byte is imported without a manifest/hash/license decision.

## RF-1: Native OMP plan approval validates almost nothing

**Finding:** `preparePlanForReview` checks only that plan mode is active, that a plan file resolves/exist, and that the title normalizes. Plan content — structure, completeness, traceability — is enforced only by prompt text.

**Evidence:**
- `src/session/agent-session.ts:934` — `preparePlanForReview(title)` body: `resolveApprovedPlan` + `planExists: true`; no content validation.
- `src/prompts/system/plan-mode-active.md` — structure guidance (Context / Approach / Critical files / Verification / Assumptions) is prose only.

**Decision:** A content gate has a real gap to fill; it attaches at approval time, before the approval popup.

## RF-2: The current propose tool call is not a selected-plan event

**Finding:** A model-issued propose write emits `tool_call` before execution and carries only a title. Native `resolveApprovedPlan` subsequently owns state/title/newest-plan fallback and reads the selected plan. The current extension event therefore cannot identify the exact post-resolution plan and is not a sound automatic approval gate.

**Evidence:**
- `src/extensibility/hooks/types.ts:306` — `ToolCallEvent` shape.
- `src/extensibility/extensions/types.ts:1246–1247` — `context` and `tool_call` subscriptions.
- `src/extensibility/hooks/tool-wrapper.ts:42–74` — pre-execution emission, blocking semantics, and nested-dispatch behavior.
- `src/tools/resolve.ts:33–63,86–89,294–307` — `xd://propose` accepts the title, not selected plan content.
- `src/plan-mode/approved-plan.ts:151–182` — native resolution owns candidate/fallback selection.

**Decision:** The current propose write is not used for automatic interception. `MANUAL` accepts exact explicit plan bytes. `AUTOMATIC` is `DEFERRED_HOST_ABI` until a pinned host emits the post-resolver `plan_approval_requested` event in `docs/omp-plan-approval-event-contract.md`.

## RF-3: OMP hook faults fail closed; the port must compensate in code

**Finding:** The OMP tool wrapper treats a hook handler error or timeout as a block ("fail-safe"). The upstream gate's operational doctrine is the opposite: any gate fault allows (`catch { /* fail-open */ }`). Therefore fail-open in OMP is not a configurable policy but mandatory handler code: every internal fault path must be swallowed and translated to a non-blocking result.

**Evidence:**
- `src/extensibility/hooks/tool-wrapper.ts:43` — "If hook errors/times out, block by default (fail-safe)".
- Upstream `tools/plan-pomogator/plan-gate.ts:382` — fail-open catch around duplicate detection; `resolvePlanFile` returns null → exit 0.

**Decision:** FR-2 defines the exhaustive fault inventory and the invariant: blocking only after a complete successful validation that returned errors.

## RF-4: Session artifact location is not native plan selection

**Finding:** Session-local artifact roots are derivable, but native plan selection is not equivalent to `<session>/<slug>-plan.md`: the host can carry plan state across transitions and apply title/state/newest-plan fallback. Reconstructing only one local path would disagree with native selection.

**Evidence:**
- `src/extensibility/extensions/runner.ts:641` — runner session identity.
- `src/internal-urls/local-protocol.ts:242–253` — local artifact-root precedence and safe session mapping.
- `src/plan-mode/approved-plan.ts:151–182` — candidate/fallback order.

**Decision:** Session/local path knowledge may support bounded MANUAL reads of explicitly supplied URLs, but it is never an automatic selection algorithm. The future host event carries the already selected URL/content/hash.

## RF-5: Grounding needs an explicit bounded prompt input

**Finding:** The upstream phases consume a prompt cache, while OMP `context` events expose a deep copy of outgoing messages. That surface can feed a separately tested manual adapter, but the pure validator does not need to own session storage or subscribe to the host.

**Evidence:**
- `src/extensibility/shared-events.ts:179–183` — `ContextEvent` deep copy.
- Upstream `prompt-store.ts` and `plan-gate.ts:403–411` — relevance provenance and score `<= -20`.

**Decision:** `PlanValidationInputV2` carries at most five prompt excerpts and 64 KiB. Exact threshold is `-20`. Empty input skips grounding; malformed/over-budget adapter input returns an allow diagnostic. Future automatic prompt context requires its own host-backed receipt and is not inferred from plan text or filesystem state.

## RF-6: The upstream validation core is portable as a pure function

**Finding:** `validate-plan.ts` is a phased library (`validatePlanPhased`) over plan text: phase 0 duplicate (SHA-256 + ±10-byte size short-circuit), phase 1 structure (10 mandatory sections with order, human summary, Existing-Spec Inventory 4 subsections, FR/AC(EARS)/NFR/Assumptions subsections, Todos blocks, Verification Plan, File Changes relative-path/action/Reason rules, Impact Analysis on destructive actions), phase 2 Extracted Requirements ≥2, phase 2.5 relevance, phase 3 cross-references (`CROSS_REF_THRESHOLD = 0.5`), phase 4 actionability warnings. Deny rendering is `line N: message` + `💡 hint` per error (`formatDenyErrors`).

**Evidence:**
- `tools/plan-pomogator/validate-plan.ts:20–31` — `REQUIRED_SECTIONS` (10 entries); `:471` — `CROSS_REF_THRESHOLD = 0.5`; `:37–42` — requirements subsection grammar.
- `tools/plan-pomogator/plan-gate.ts:105–128` — duplicate detection; `:279–281` — `formatDenyErrors`; `:210` — `scorePromptRelevance`.
- Upstream registry `tools/hook-service/registry.json` — `PreToolUse/1/0`, matcher `ExitPlanMode`, timeout 60s (Claude-side trigger being replaced, not ported).

**Decision:** FR-4/FR-5/FR-6/FR-7 re-specify these phases as a pure validator over a closed explicit input. The upstream file itself is not imported; its section set and thresholds are provenance, while directory scanning and a 60-second Claude hook timeout are deliberately not ported.

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

## RISK-2: Required automatic host ABI is absent

**Likelihood:** Certain on v17.3.7. **Impact:** High. Pretending a title-only pre-write event identifies the selected plan would validate the wrong bytes.

**Mitigation:** Automatic state is `DEFERRED_HOST_ABI`; `CHK-HOST-ABI-01` requires source and behavioral receipts for the exact future event before the automatic profile can pass.

## RISK-3: Injection spam degrades every LLM call

**Likelihood:** Medium. **Impact:** Medium. An unconditional context injection taxes tokens outside plan authoring.

**Mitigation:** FR-3 limits injection to plan-mode activity, one bounded message ≤2 KiB, never duplicating within one call.

## RISK-4: Spec-reference checks read outside containment

**Likelihood:** Low. **Impact:** High. Reference validation could be abused to read arbitrary paths.

**Mitigation:** Manual adapter reads only canonical documents needed for a complete index below `<project-root>/.specs/<slug>/`, with realpath/reparse/symlink refusal and bounded redacted diagnostics.

## RISK-5: Grounding false positives block legitimate plans

**Likelihood:** Medium. **Impact:** Medium. Deterministic lexical relevance can misjudge short or meta prompts.

**Mitigation:** Keep the upstream-scored threshold as a research input but require fixture vectors for borderline cases; cache-empty degrades open; relevance block reason embeds the prompt window for human review.

## Resolved and deferred decisions

1. Resolved: target-owned `plan-gate-guarded-paths@1` contains exactly `.specs/**`, `MIGRATION_MATRIX.md`, `ROADMAP.md`, and `docs/decisions/**`; it is a bundled hash-inventoried resource.
2. Deferred: an editor projection for actionability diagnostics; manual @1 returns them only in the structured result.
3. Deferred: the exact future OMP version implementing `selected-plan-event@1`; no date or release is assumed.
