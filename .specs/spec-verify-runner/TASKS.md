# Tasks

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

## TASK-3 — Gate completion and record overrides

- **Status:** planned

**Implements:** FR-4, FR-5

<!-- agent-teams-description:start -->
> Refuse a completion without a green record for the current commit, refuse a spending command without an authorization, and record any override with its written reason.
> 
> Done when:
> - a completion without evidence is refused and names the missing record
> - an override carrying a reason is applied and the receipt shows it
> - a spending command without authorization is refused and names it
> - a non-spending command runs without authorization
<!-- agent-teams-description:end -->

## TASK-4 — Ingest external results and keep history

- **Status:** planned

**Implements:** FR-6

<!-- agent-teams-description:start -->
> Ship a pytest plugin and a vitest reporter that write the declared result schema with a run identifier and commit, and ingest them so a scenario answers its last green run.
> 
> Done when:
> - both writers emit the declared schema from a real run
> - ingestion keeps every run rather than one file per machine
> - a scenario answers last green with commit and timestamp
> - a binding mismatch reports unknown instead of green
<!-- agent-teams-description:end -->
