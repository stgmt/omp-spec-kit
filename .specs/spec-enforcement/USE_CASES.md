# Use Cases

## UC-1: Inject kernel diagnostics on spec-file read

**Primary actor:** Agent reading a spec document.

**Precondition:** Informational mode is active; `spec-kernel` v0.2+ is available.

**Flow:**
1. The agent issues a `read` or `edit` tool call targeting a path under `.specs/**`.
2. The `tool_result` handler fires after successful execution.
3. The handler queries the kernel for diagnostics on the touched spec slug.
4. Kernel findings are appended to the result content as a bounded diagnostic summary.

**Postcondition:** The agent receives the original tool output plus a diagnostic appendix; no blocking occurs; repository state is unchanged.

**Related:** [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection), [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-diagnostics-are-injected-only-in-informational-mode), `@feature2`

## UC-2: Inject corpus census on session start

**Primary actor:** OMP runtime starting a new session.

**Precondition:** Informational mode is active; `spec-kernel` v0.2+ is available.

**Flow:**
1. The `session_start` event fires.
2. The handler queries the kernel for a corpus overview (spec count, document counts, diagnostic summary).
3. A bounded census summary is stored for injection on the next `context` event.
4. The `context` handler appends the census as a system-role message to the outgoing messages.

**Postcondition:** The agent's first LLM call includes corpus status context; no blocking occurs; no repository writes occur.

**Related:** [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-corpus-census-is-injected-on-session-start), `@feature2`

## UC-3: Block a direct spec write in enforcement mode

**Primary actor:** Agent invoking a raw or indirect writer.

**Precondition:** Same-candidate `SPEC_ENFORCEMENT` mode is active.

**Flow:**
1. Every tool call enters the closed effect classifier.
2. A raw writer's exhaustive extractor emits targets; the I/O resolver proves one target is under `.specs/**`.
3. The decision returns BLOCK `RAW_SPEC_WRITE` with the repository-relative target and qualified `omp-spec-kit:spec-authoring-workflow` redirect.
4. The raw tool does not execute.

**Postcondition:** The spec is unchanged; mutation is possible only through the accepted authoring MCP authority.

**Related:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception), [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-spec-writes-are-blocked-or-redirected-in-enforcement-mode), `@feature3`

## UC-4: Allow a non-spec write in enforcement mode

**Primary actor:** Agent writing a non-spec file.

**Precondition:** Enforcement mode is active.

**Flow:**
1. A registered raw writer supplies an input whose exhaustive extractor returns all targets.
2. The filesystem resolver proves every target is inside the project and outside `.specs/**`.
3. The decision returns ALLOW `PROVEN_NON_SPEC_TARGETS`.

**Postcondition:** The non-spec write executes without interference; target safety is proven rather than inferred from the tool name.

**Related:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception), [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-spec-writes-are-blocked-or-redirected-in-enforcement-mode), `@feature3`

## UC-5: Surface explicit failure on kernel absence

**Primary actor:** OMP runtime with enforcement handlers loaded but kernel unavailable.

**Precondition:** Product/authority evidence and effect registry may still be available.

**Flow:**
1. Kernel initialization/query fails.
2. The handler emits a separate `KERNEL_UNAVAILABLE` policy diagnostic and no fake conformance result.
3. Informational kernel summaries are absent.
4. If enforcement capability is otherwise accepted, write-effect enforcement remains active; a non-safety kernel failure does not open a bypass.

**Postcondition:** Kernel diagnostics degrade honestly while access enforcement follows its own accepted inputs.

**Related:** [FR-4](FR.md#fr-4-fail-honest-policy), [FR-8](FR.md#fr-8-degradation-ladder), [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-hook-errors-produce-explicit-visible-messages), `@feature4`, `@feature8`

## UC-6: Degrade honestly when authoring door is absent

**Primary actor:** OMP runtime before product enforcement acceptance.

**Precondition:** `SPEC_ENFORCEMENT` or its same-candidate `AUTHORING_MCP` prerequisite is absent.

**Flow:**
1. `session_start` evaluates product/candidate/authority evidence.
2. Missing or mismatched input refuses enforcement activation regardless of local configuration.
3. Behavior remains informational/degraded and states the missing capability.
4. No product or release document may claim enforcement is delivered.

**Postcondition:** Pre-gate behavior is honest non-enforcement, not a locally overrideable partial security mode.

**Related:** [FR-8](FR.md#fr-8-degradation-ladder), [FR-9](FR.md#fr-9-stage-gated-activation), [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-enforcement-is-inert-before-cumulative-gate-acceptance), `@feature8`, `@feature9`

## UC-7: Verify no bypass paths exist

**Primary actor:** Independent adversarial reviewer.

**Precondition:** Enforcement mode is active with a pinned registry manifest.

**Flow:**
1. Drive every live built-in, MCP, and extension tool from the TASK-1 census.
2. Attempt raw spec targets, a qualified authoring call, a name-only authority spoof, a newly registered/renamed tool, dynamic command targets, outside-root/traversal, POSIX symlink, Windows reparse point, and missing-ancestor variants.
3. Verify qualified authority/read-only/proven non-spec controls pass.
4. Verify every raw spec, unknown, incomplete, spoofed, or indeterminate variant blocks with the expected closed code.

**Postcondition:** Registry drift and new write surfaces fail conservatively; no alternate raw route circumvents the authority.

**Related:** [FR-7](FR.md#fr-7-no-bypass-paths), [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-all-write-surfaces-to-specs-are-intercepted), `@feature7`

## UC-8: Release the enforcement artifact

**Primary actor:** Release owner.

**Precondition:** Candidate-bound baseline, authoring capability/authority, registry, CHK, installed, containment, budget, and adversarial records exist.

**Flow:**
1. Build the candidate through the existing extension factory and closed dist manifest.
2. Hide source checkout and root/external `node_modules`; exercise informational and enforcement decisions.
3. Evaluate `spec-enforcement-release@2`.
4. Present eligibility to the product evaluator for the same `SPEC_ENFORCEMENT` candidate.
5. Missing, extra, duplicate, failed, stale, mismatched, cross-candidate, or unbound input fails closed.

**Postcondition:** Capability eligibility is all-not-any and does not by itself claim product/public delivery.

**Related:** [FR-11](FR.md#fr-11-release-eligibility-conjunction), [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-release-gate-is-a-closed-conjunction), `@feature11`
