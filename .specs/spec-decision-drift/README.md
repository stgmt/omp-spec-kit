# Decision Drift

Status: DRAFT

Release 3.4.0, wave 1c of issue #51. A decision an owner made once SHALL live in one place and SHALL be checked against every other mention of the same value. A question that is still open SHALL be a first-class entity that blocks work explicitly, not a sentence inside prose.

This specification owns: the QUESTION entity kind, structured decision metadata, the drift diagnostic that compares a decision with the rest of the corpus, the blocking relation between an open question and the work it holds, and supersession of decisions.

It does not own: the DECISION entity kind itself, which already exists with `DEC-n` identifiers in the design document (`spec-mcp-operations`), the requirement and criterion grammars (`spec-mcp-operations`), or evidence gating of task completion (`spec-verify-runner`).

## Public states

- **DRAFT.** `DECISION` exists as a kind with `DEC-n` identifiers, but nothing reads a decision's value, so the same rule can be stated three different ways in three documents without a diagnostic. `QUESTION` does not exist at all.
- **Observed field failure:** a role limit stated as open in one document and as `1 / up to 5 / up to 5` in another passed every check until a human read both.

## Documents

[Requirements](REQUIREMENTS.md) · [NFR](NFR.md) · [FR](FR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-decision-drift.feature) · [Fixtures](FIXTURES.md)

Local IDs become qualified outside this directory, for example `spec-decision-drift:FR-3`.
