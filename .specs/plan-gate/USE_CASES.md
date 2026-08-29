# Use Cases

## UC-1: Block a duplicated plan

**Primary actor:** Manual validator caller now; future automatic host after ABI delivery.

**Precondition:** One exact plan plus a bounded explicit duplicate-candidate set is available.

**Flow:**
1. The caller supplies exact plan bytes/hash and at most 20 named candidates within 8 MiB.
2. The adapter reads only declared candidates; any unreadable candidate returns ALLOW plus `DUPLICATE_INPUT_UNAVAILABLE`.
3. The pure validator applies the ±10-byte size short-circuit, then compares hashes.
4. A hash match produces BLOCK naming the candidate URL.

**Postcondition:** The decision is based on a complete explicit set; no plan directory was scanned.

**Related:** [FR-5](FR.md#fr-5-duplicate-plan-detection), [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-byte-duplicate-plans-are-detected-deterministically), `@feature5`

## UC-2: Block a plan missing mandatory structure

**Primary actor:** Plan validator caller.

**Flow:**
1. The pure validator parses the ten-section skeleton and all required forms.
2. Every violation becomes one bounded finding with line, message, and hint.
3. One or more complete validation errors produce BLOCK; the host reason includes complete rows and an overflow cursor.

**Postcondition:** The plan is repair-actionable without claiming every finding fits in 16 KiB.

**Related:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation), [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-mandatory-skeleton-failures-block-with-line-hints), `@feature4`

## UC-3: Block an ungrounded plan

**Primary actor:** Plan validator caller.

**Precondition:** The request carries explicit bounded user prompt excerpts.

**Flow:**
1. The validator computes deterministic lexical relevance with exact threshold `-20`.
2. A score at or below the threshold produces BLOCK and includes the selected prompt excerpt.
3. Empty input skips grounding; malformed or over-budget adapter input returns ALLOW plus a bridge diagnostic.

**Related:** [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding), [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-grounding-is-deterministic-and-cache-degrades-open), `@feature6`

## UC-4: Block a plan whose file changes do not match its body

**Primary actor:** Plan validator caller.

**Flow:**
1. The validator parses File Changes and tests each relative path for mention outside the table.
2. An unmentioned ratio greater than 0.5 produces BLOCK with up to five paths.

**Related:** [FR-7](FR.md#fr-7-file-change-cross-reference-validation), [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-contaminated-file-changes-are-refused), `@feature7`

## UC-5: Block a spec-touching plan without spec references

**Primary actor:** Plan validator caller.

**Flow:**
1. Guarded/spec-path detection requires qualified references.
2. A manual I/O adapter builds a complete contained `SpecReferenceIndexV2`; unreadable, containment, partial-index, or budget failure returns ALLOW plus `SPEC_INDEX_UNAVAILABLE`.
3. The pure validator resolves cited `.specs/<slug>:FR-N` and `.specs/<slug>:AC-N.M` identities only against that complete index.
4. Invalid syntax, missing indexed identity, or no required reference produces BLOCK.

**Related:** [FR-9](FR.md#fr-9-spec-reference-enforcement), [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-spec-touching-plans-require-existing-qualified-references), `@feature9`

## UC-6: Allow through gate faults

**Primary actor:** OMP/manual adapter.

**Flow:**
1. A validator exception, unreadable declared input, containment refusal, malformed/over-budget input, resource mismatch, or internal deadline occurs.
2. The adapter returns ALLOW plus exactly one bounded diagnostic before 20 seconds.
3. An outer host timeout remains fail-closed and is recorded as an implementation defect.

**Postcondition:** Only complete successful validation with ERROR findings can BLOCK.

**Related:** [FR-2](FR.md#fr-2-fail-open-bridge-policy), [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-every-gate-fault-path-allows), `@feature2`

## UC-7: Inject the plan contract during plan mode

**Primary actor:** Manual caller now; future automatic host after ABI delivery.

**Flow:**
1. MANUAL returns bounded contract/template guidance as advisory output.
2. A future automatic adapter may append one bounded deep-copy context message only when the selected-plan event carries `planMode:true`.
3. No mode infers plan state from text/files and injection failure never changes validation.

**Related:** [FR-3](FR.md#fr-3-mode-scoped-preventive-contract), [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-injection-is-plan-mode-scoped-and-bounded), `@feature3`

## UC-8: Release the gate artifact

**Primary actor:** Release owner.

**Flow:**
1. Manual implementation, fixtures, dependency-absent smoke, budgets, and adversarial review produce hash-bound records.
2. `plan-gate-manual@1` checks its closed manual branch set.
3. `plan-gate-automatic@1` additionally checks every automatic branch and `CHK-HOST-ABI-01` for the exact pinned host.
4. Missing, extra, duplicate, failed, stale, mismatched, or unbound records yield `eligible=false`.

**Related:** [FR-13](FR.md#fr-13-release-eligibility-conjunction), [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-release-gate-is-a-closed-conjunction), `@feature13`
