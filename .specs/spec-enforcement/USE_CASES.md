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

**Primary actor:** Agent attempting to write a spec file.

**Precondition:** Enforcement mode is active; the authoring door (`spec-authoring-workflow`) is accepted.

**Flow:**
1. The agent issues a `write`, `edit`, or `bash` tool call whose target touches `.specs/**`.
2. The `tool_call` handler matches the write target against the `.specs/` prefix.
3. The handler returns `{block: true, reason}` directing the agent to the authoring door.
4. The tool does not execute; the model receives the block reason.

**Postcondition:** The spec file is not modified; the agent receives an actionable redirect message.

**Related:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception), [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-spec-writes-are-blocked-or-redirected-in-enforcement-mode), `@feature3`

## UC-4: Allow a non-spec write in enforcement mode

**Primary actor:** Agent writing a non-spec file.

**Precondition:** Enforcement mode is active.

**Flow:**
1. The agent issues a `write` targeting `src/index.ts` (outside `.specs/**`).
2. The `tool_call` handler inspects the target and determines it does not match `.specs/`.
3. The handler returns nothing; the tool executes normally.

**Postcondition:** The file is written without interference.

**Related:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception), [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-spec-writes-are-blocked-or-redirected-in-enforcement-mode), `@feature3`

## UC-5: Surface explicit failure on kernel absence

**Primary actor:** OMP runtime with enforcement hooks loaded but kernel unavailable.

**Precondition:** Informational or enforcement mode is nominally active; `spec-kernel` module is missing or fails to initialize.

**Flow:**
1. A hook handler attempts to query the kernel.
2. The kernel is absent or throws during initialization.
3. The handler produces an explicit visible diagnostic message stating kernel unavailability with reason.
4. No silent pass-through occurs; no fake success is reported.

**Postcondition:** The user sees an honest degradation message; informational summaries are absent with stated reason; enforcement mode disables by stage, not by error.

**Related:** [FR-4](FR.md#fr-4-fail-honest-policy), [FR-8](FR.md#fr-8-degradation-ladder), [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-hook-errors-produce-explicit-visible-messages), `@feature4`, `@feature8`

## UC-6: Degrade honestly when authoring door is absent

**Primary actor:** OMP runtime before authoring-stage acceptance.

**Precondition:** Enforcement mode is nominally configured but `spec-authoring-workflow:FR-13` is not yet accepted.

**Flow:**
1. An agent issues a `write` to `.specs/**`.
2. The `tool_call` handler checks the cumulative gate status.
3. The authoring door is not accepted; enforcement mode is inert.
4. The write proceeds without interception; a diagnostic note MAY be injected indicating enforcement is pending gate acceptance.

**Postcondition:** No block occurs; the write is not silently intercepted; the degradation reason is visible.

**Related:** [FR-8](FR.md#fr-8-degradation-ladder), [FR-9](FR.md#fr-9-stage-gated-activation), [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-enforcement-is-inert-before-cumulative-gate-acceptance), `@feature8`, `@feature9`

## UC-7: Verify no bypass paths exist

**Primary actor:** Adversarial reviewer.

**Precondition:** Enforcement mode is active.

**Flow:**
1. Attempt spec writes through every available tool surface: `write`, `edit`, `bash` with file redirection, `apply_patch`.
2. Each attempt is matched by the `tool_call` handler.
3. All matching attempts are blocked or redirected.
4. No alternate write route circumvents the enforcement surface.

**Postcondition:** Every write path to `.specs/**` is intercepted; no bypass exists.

**Related:** [FR-7](FR.md#fr-7-no-bypass-paths), [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-all-write-surfaces-to-specs-are-intercepted), `@feature7`

## UC-8: Release the enforcement artifact

**Primary actor:** Release owner.

**Precondition:** All mandatory evidence records exist for the release conjunction.

**Flow:**
1. Build the candidate plugin artifact with enforcement hooks bundled.
2. Hide source checkout and root `node_modules`.
3. Execute informational-mode smoke from the installed extension.
4. Evaluate the `spec-enforcement-release@1` conjunction.
5. Missing, failed, or mismatched records fail closed.

**Postcondition:** Eligibility is all-not-any; structural specification alone does not satisfy evidence.

**Related:** [FR-11](FR.md#fr-11-release-eligibility-conjunction), [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-release-gate-is-a-closed-conjunction), `@feature11`
