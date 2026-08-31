# Research

## Scope and authority

Research used the installed `pi-coding-agent@17.3.7` source pinned by `docs/omp-v17.3.7-contract.md` at commit `8500092296621a6826b7136e840f8a59ea338958`, plus the live `E:/repos/dev-pomogator/tools/plan-pomogator/` implementation as non-normative design history. No bytes are imported by this specification.

## RF-1: OMP owns plan resolution

Native `preparePlanForReview` and `resolveApprovedPlan` own plan location and fallback selection. Repeating those rules in this capability would create two authorities. The portable boundary therefore begins only after a caller already has exact plan bytes.

**Evidence:** installed source `src/plan-mode/approved-plan.ts` and `src/plan-mode/tools/propose.ts` at the pinned commit.

## RF-2: OMP content checks are intentionally light

The native approval path checks plan-mode state and resolves a plan file, while most content guidance lives in the plan prompt. A separate manual content validator is useful as an advisory library without taking ownership of approval.

**Evidence:** installed source `src/plan-mode/approved-plan.ts` and `src/plan-mode/system-prompt.ts` at the pinned commit.

## RF-3: Exact bytes are the sufficient input

Content structure, file/action scope, verification, assumptions, and impact disclosure can be checked deterministically from UTF-8 bytes. Plan discovery, filesystem inventories, model calls, and conversation storage are unnecessary inputs.

**Evidence:** the upstream phased validator demonstrates deterministic Markdown checks, but its rigid heading template, duplicate scan, cached grounding, and spec-reference inventory are intentionally not adopted.

## RF-4: Three outcomes preserve truth

A manual validator must not describe a mismatched, over-budget, or failed evaluation as valid. `VALID`, `INVALID`, and `UNAVAILABLE` keep content defects separate from inability to evaluate.

## Risks and decisions

- Flexible heading aliases can become ambiguous. The schema uses a closed alias set and reports duplicates.
- Destructive action detection can miss prose-only intent. Files/actions are therefore normative; destructive actions in that list require impact disclosure.
- Optional request alignment is advisory because lexical overlap can be wrong.
- Real fixture provenance remains mandatory; synthetic data is limited to boundaries and planted one-fault variants.
