# Requirements

## Scope

Stop silent first creation of missing canonical Markdown documents in specifications. One memo plus one short shared hint plus a one-time authoring stop. Later edits and existing documents are untouched. The specification kernel stays the sole source of truth.

## REQ-1: Canonical memo

The agent behavior lives in exactly one elicitation memo with trigger, steps, dumb-question ban, and do-it-now mode.

## REQ-2: Single shared hint

One short hint constant in the contract module is referenced by instructions and the stop error. The raw-write enforcement hook does not carry elicitation text.

## REQ-3: One-time first-write stop

The first real apply targeting a missing canonical Markdown document is refused once with zero bytes changed and a recorded ticket keyed by specification slug plus document name. The rule is based on missing-file identity, not payload quality or retry equality. One multi-document request receives one refusal listing all missing Markdown targets.

## REQ-4: Error with memo and retry

The refusal names the memo URI, sorted targets, and states that a later attempt is allowed; automation may retry with the same or changed payload.

## REQ-5: No second stop

Retries and all later edits to the same document pass with no second check, including changed payloads.

## REQ-6: Backwards compatibility

Pre-existing documents, previews, canonical feature files, deletes, and non-canonical paths never meet the stop. The corpus gate lists the new specification.

## REQ-7: Observable verification

Inspection, link sweep, corpus check, package verification, and replay scenarios prove the guard. Question quality is a manual review concern, not a machine assertion.

## Traceability

| Requirement | Functional requirements | Acceptance criteria |
|---|---|---|
| REQ-1 | FR-1 | AC-1.1 |
| REQ-2 | FR-2 | AC-2.1 |
| REQ-3 | FR-3 | AC-3.1 |
| REQ-4 | FR-4 | AC-4.1 |
| REQ-5 | FR-5 | AC-5.1 |
| REQ-6 | FR-6 | AC-6.1 |
| REQ-7 | FR-7 | AC-7.1 |
