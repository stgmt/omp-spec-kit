# Verify Runner

Status: DRAFT

## TASK-1 — Parse checks and run them under an allowlist

- **Status:** planned

**Implements:** FR-1, FR-2

<!-- agent-teams-description:start -->
> Parse the verify and guard lines with their modifiers, run an allowlisted argument vector in the repository root with a timeout, and expose a dry mode that spawns nothing.
> 
> Done when:
> - the check line parses with spend and timeout modifiers
> - a non-allowlisted executable is refused before the spawn
> - a hanging command terminates at its timeout with partial output kept
> - dry mode returns the parsed command and the allowlist verdict
<!-- agent-teams-description:end -->

## TASK-2 — Record and answer evidence

- **Status:** planned

**Implements:** FR-3

<!-- agent-teams-description:start -->
> Persist one record per run and answer the latest run, the run history and the last green run from those records instead of a single overwritten file.
> 
> Done when:
> - a record carries task, commit, dirty state, command, exit code, duration, output tail and output hash
> - the history query returns runs in order
> - a missing run answers not-run rather than an error
<!-- agent-teams-description:end -->
