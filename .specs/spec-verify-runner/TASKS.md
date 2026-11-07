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
