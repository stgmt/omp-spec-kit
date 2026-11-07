# Verify Runner

Status: DRAFT

Release 3.4.0, wave 1d of issue #51. A check written next to a task SHALL be a command that runs, not a sentence. Task completion SHALL mean the command ran green on the current commit and its output is recorded.

This specification owns: the executable check field of a task, running it under an allowlist and a timeout, the evidence record it produces, the completion gate that consumes that record, spend authorization, and the external result writers that make scenario evidence answer "last green run".

It does not own: the task graph and its transitions (`spec-mcp-operations`), the decision about which rule a check enforces (`spec-decision-drift`), project registration (`spec-project-registration`), or the preview surface (`spec-patch-bundle`).

## Public states

- **DRAFT.** Today a task's promise is prose. The task parser reads status, estimate, owner and the done-when list; nothing reads or runs a `Verify:` line, and a task status change to `done` is gated only by enum membership.
- **Observed field failure:** a task described `pytest tests/test_intake_chat.py` as its check for a week and was marked done without the command ever running.

## Documents

[Requirements](REQUIREMENTS.md) · [NFR](NFR.md) · [FR](FR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-verify-runner.feature) · [Fixtures](FIXTURES.md)

Local IDs become qualified outside this directory, for example `spec-verify-runner:FR-4`.
