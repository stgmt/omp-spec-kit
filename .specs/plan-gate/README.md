# plan-gate

`plan-gate` specifies one manual, stateless validator for exact plan bytes.

## Status

LATER under `product:FR-5`. The contract is implementable but has no runtime evidence yet. It does not approve plans, intercept OMP, or create a new agent-facing tool.

## Public boundary

A caller invokes `validateExactPlan(request)` with plan content and optional display/source metadata. The function returns `VALID`, `INVALID`, or `UNAVAILABLE` with bounded line-level findings. Native OMP remains responsible for locating plans and deciding what to do with the result.

## Scope

The validator checks an outcome-bearing plan for:

- a non-empty objective;
- a concrete approach;
- repository-relative files paired with actions;
- a verification method;
- explicit assumptions;
- impact disclosure for destructive actions.

It computes the content digest itself. It never reads directories, selects a plan, writes files, stores context, calls a provider, or enforces spec-write authority.

## Evidence

Scenario text is specification, not execution evidence. Implementation must use real captured plan fixtures with recorded provenance and ground truth as defined in `FIXTURES.md`.

## Current lifecycle contract

The automatic gate consumes one post-resolver plan_approval_requested event carrying exact path, title, content, and SHA-256. TUI and ACP approval stay closed when the gate blocks or times out.
