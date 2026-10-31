# Fixtures

Fixtures are deterministic and contain no credentials or live state.

## Authoring fixtures

1. missing canonical Markdown target plus any real apply: ELICITATION_REQUIRED with zero bytes changed;
2. retry after refusal: commit success with atomic receipt;
3. changed retry after refusal: commit success without a second stop;
4. third edit to the same document: success with no check;
5. pre-existing document: success with no check on first attempt;
6. preview for a missing target: PREVIEW, no files, and no consumed ticket;
7. multi-document creation: one refusal listing all missing Markdown targets, then one successful retry;
8. canonical feature target and delete operation: no Markdown elicitation candidate;
9. restart with a still-missing document: one safe refusal may be issued again, then retry success.

## Error fixtures

The refusal carries the memo path, the target spec plus document, and the retry rule. A byte comparison of the repository before and after refusal is equality.

## Replay fixtures

A missing-target replay verifies the typed refusal, unchanged repository state, and successful retry. Source review can assess question quality separately; that qualitative result is not an automated fixture.
