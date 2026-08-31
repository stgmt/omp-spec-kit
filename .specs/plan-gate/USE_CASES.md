# Use Cases

## UC-1: Validate an actionable plan

**Actor:** Manual caller.

1. The caller supplies exact UTF-8 plan content and may supply `sourceUri`, `expectedSha256`, and `requestText`.
2. `validateExactPlan` computes the content SHA-256.
3. The validator checks the native-compatible content model.
4. With no error findings, it returns `VALID`.

## UC-2: Reject an incomplete plan

**Actor:** Manual caller.

1. The caller supplies exact plan content.
2. The plan omits an objective, approach, scoped file/action, verification, assumptions, or required destructive-impact disclosure.
3. The validator returns `INVALID` with ordered line-level findings and hints.

## UC-3: Report unavailable validation

**Actor:** Manual caller.

1. The caller supplies a mismatched expected digest, an over-budget request, or the implementation cannot complete validation.
2. The validator returns `UNAVAILABLE`, never `VALID`.
3. The response contains one bounded diagnostic and does not claim that plan content passed.

## UC-4: Use request text as advice only

**Actor:** Manual caller.

1. The caller optionally supplies request text.
2. The validator compares normalized significant words with the objective and approach.
3. No overlap emits a warning; the warning alone does not make the plan invalid.
