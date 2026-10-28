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
