# Teams Task Sync

Centralized task management for agent-teams-ai: the spec-kit corpus (served by `spec-registryd`) is the only task store, and the Electron application in the teams fork renders and mutates tasks exclusively through spec-kit MCP operations.

**Profile:** standard
**Status:** active

## Purpose

Today teams keeps tasks as per-task JSON files under `~/.claude/tasks/<team>` with no database and no single writer. A team can lose its task history with a single filesystem mistake, and task state cannot be reviewed, diffed or traced to requirements. This specification makes spec-kit the center:

- a task is a canonical `TASK` node in `.specs` with identity, status, owner, dependencies and `Done When`;
- teams creates, reads and moves tasks only through `spec_patch` / `spec_query` on `spec-registryd`;
- the local task files become a projection with a deterministic identity (`uuidv5`), so no mapping table exists;
- every field has exactly one owner; duplicates are resolved by ownership, not by merging values;
- the registry being unavailable is a hard error, never a local fallback.

## Key decisions

- Every status transition returns a receipt (`from`, `to`, `actor`, `at`, `requestId`); teams records it in `historyEvents`. `reviewState` is derived on the teams side, never stored in the corpus.
- Authority is enforced by the registry: the actor is the authenticated bearer principal, `actorRef` is only a correlation id, and `team.config` maps members to logins rather than roles. Reviewer is a teams process assignment, not a permission.
- The sync contract is served by the registry at startup (`version` + `sha256`) and generated into constants; a vendored hand-written copy is a defect.
- A confirmed canonical transition that has not reached the projection is a bounded `pending_projection` marker, not a queue and not an optimistic status.
- Legacy tasks and their attachments are archived together; adoption is impossible by construction.

## Shared tasks and personal agent tasks

The team board aggregates explicitly linked specifications. A lead can create and author specifications through the existing spec-kit MCP tools; tasks created by an authorized caller through either product surface remain bound to their own specification. All authorized team members can read the complete shared task and team execution data. Personal built-in agent tasks are separate and remain available; they are not imported into the board. Live cross-product verification is required before claiming this works.

## Documents

- [FR.md](FR.md) — functional requirements
- [NFR.md](NFR.md) — non-functional requirements
- [DESIGN.md](DESIGN.md) — design decisions, conflict resolution and blast radius
- [TASKS.md](TASKS.md) — implementation tasks
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) — acceptance criteria
- [teams-task-sync.feature](teams-task-sync.feature) — Gherkin scenarios
- [FILE_CHANGES.md](FILE_CHANGES.md) — file-level changes

## Related specifications

None. The feature spans two repositories: `omp-spec-kit` (canonical model and registry surface) and the `agent-teams-ai` fork (projection and Electron UI).
