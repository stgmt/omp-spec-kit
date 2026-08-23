# Use Cases

## UC-1: Block a duplicated plan

**Primary actor:** Agent submitting plan approval.

**Precondition:** Plan mode is active; one or more `*-plan.md` files exist in the session-local plan directory.

**Flow:**
1. The agent issues `write` targeting `xd://propose` with a plan title.
2. The gate matches the model-issued `tool_call`, resolves the session-local plan file deterministically, and reads it within budgets.
3. Duplicate detection compares SHA-256 against other plan files in the same session directory after a ±10-byte size short-circuit.
4. A hash match produces a block with the duplicate identity in the reason.

**Postcondition:** The approval popup never opens; the model receives the typed reason.

**Related:** [FR-5](FR.md#fr-5-duplicate-plan-detection), [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-byte-duplicate-plans-are-detected-deterministically), `@feature5`

## UC-2: Block a plan missing mandatory structure

**Primary actor:** Agent submitting plan approval.

**Flow:**
1. The gate parses the plan against the ten-section skeleton, order, non-empty human summary, Existing-Spec Inventory subsections, Requirements subsections, Todos blocks, Verification Plan commands, File Changes table constraints, and Impact Analysis obligation.
2. Every violation becomes one bounded error with line, message, and hint.
3. One or more errors produce a block whose reason is the bounded deny rendering.

**Postcondition:** Approval is blocked; the reason is repair-actionable per [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics).

**Related:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation), [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-mandatory-skeleton-failures-block-with-line-hints), `@feature4`

## UC-3: Block an ungrounded plan

**Primary actor:** Agent submitting plan approval.

**Precondition:** The prompt cache for the session contains recent user prompts captured from `context` events.

**Flow:**
1. The gate computes the deterministic relevance score of the plan against the selected relevance window of cached prompts (no LLM).
2. A score at or below the relevance deny threshold produces a block whose reason embeds the recent prompt excerpt so the agent can re-anchor on the actual task.

**Postcondition:** Approval blocked; empty or unreadable cache degrades to skip, never to block.

**Related:** [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding), [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-grounding-is-deterministic-and-cache-degrades-open), `@feature6`

## UC-4: Block a plan whose file changes do not match its body

**Primary actor:** Agent submitting plan approval.

**Flow:**
1. The gate parses the File Changes table and tests each relative path for mention in the plan body outside the table.
2. When the unmentioned ratio exceeds the cross-reference threshold, approval is blocked with the first bounded path list.

**Related:** [FR-7](FR.md#fr-7-file-change-cross-reference-validation), [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-contaminated-file-changes-are-refused), `@feature7`

## UC-5: Block a spec-touching plan without spec references

**Primary actor:** Agent submitting plan approval.

**Flow:**
1. File Changes or guarded-path detection shows the plan touches `.specs/**` or a guarded repository path.
2. The gate extracts `.specs/<slug>:FR-N` / `.specs/<slug>:AC-N.M` references from the plan body.
3. Every referenced slug must exist as a `.specs/<slug>/` directory in the project root; every referenced local ID must exist as a canonical GLFM heading in `FR.md` / `ACCEPTANCE_CRITERIA.md`. Missing directories, missing IDs, or zero references when required produce a block.

**Postcondition:** Approval blocked; references are checked against disk bytes, not memory.

**Related:** [FR-9](FR.md#fr-9-spec-reference-enforcement), [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-spec-touching-plans-require-existing-qualified-references), `@feature9`

## UC-6: Allow through gate faults

**Primary actor:** OMP runtime.

**Flow:**
1. Any of: validator exception, absent plan file after resolution, unreadable prompt cache, oversized plan bytes, malformed cache JSON, or handler timeout occurs.
2. The handler swallows the fault and returns no blocking result.
3. The approval flow proceeds as if the gate were absent; the fault is recorded in bounded diagnostic state only.

**Postcondition:** Blocking never results from a fault; the invariant "block only after a complete successful validation with errors" holds.

**Related:** [FR-2](FR.md#fr-2-fail-open-bridge-policy), [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-every-gate-fault-path-allows), `@feature2`

## UC-7: Inject the plan contract during plan mode

**Primary actor:** Agent composing the plan.

**Flow:**
1. While plan mode is active, each `context` event receives exactly one appended bounded injection message containing the section skeleton, the spec-reference obligation, and the bounded template pointer.
2. The injection modifies only the deep copy destined for the LLM; session messages and repository bytes are untouched.
3. Outside plan mode no injection occurs.

**Related:** [FR-3](FR.md#fr-3-preventive-contract-injection), [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-injection-is-plan-mode-scoped-and-bounded), `@feature3`

## UC-8: Release the gate artifact

**Primary actor:** Release owner.

**Flow:**
1. Probes, implementation, fixtures, dependency-absent smoke, budgets, and adversarial review produce hash-bound evidence records.
2. The release evaluator checks the `plan-gate-release@1` conjunction: stage/profile match, all mandatory records PASS, same artifact binding.
3. Any missing, extra, failed, stale, or mismatched record yields `eligible=false` with deterministic blockers.

**Related:** [FR-13](FR.md#fr-13-release-eligibility-conjunction), [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-gate-is-a-closed-conjunction), `@feature13`
