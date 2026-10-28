# Tasks

## TASK-1 — Define the sync contract artifact

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-11, NFR-MAINT-1

- **Done When:** `contracts/task-sync.contract.json` carries `version` plus the status and failure tables — a generator emits both sides' constants and a drift test fails on any hand-written status list.

## TASK-2 — Add structured task operations to spec-kit

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-2, NFR-COMPAT-1

**Refs:** TASK-1

- **Done When:** `spec_patch` accepts `upsert_task` and `replace_task_owner` and `replace_task_links` — `upsert_task` is idempotent on identical input and free-form `insert_at_eof` into `TASKS.md` is rejected with `STRUCTURED_TASK_OP_REQUIRED`.

## TASK-3 — Expose owner, tracking and content hash

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-2

**Refs:** TASK-2

- **Done When:** TASK nodes parse `Tracking` — `spec_query` board and task views return `owner` plus `tracking` and `contentHash` while the kernel schema stays `spec-kernel@2`.

## TASK-4 — Enforce requirement linkage on task creation

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-3

**Refs:** TASK-2

- **Done When:** `upsert_task` without `Implements` on an FR or NFR or AC of the same spec returns `TASK_REQUIREMENT_REQUIRED` — linked creation succeeds.

## TASK-5 — Replace the teams task store with a projection

- **Status:** todo
- **Owner:** teams

**Implements:** FR-1, FR-6

**Depends On:** TASK-2, TASK-3

- **Done When:** `~/.claude/tasks/<team>` is written only by the projection writer — `taskStore` has no creation path and reading disk as the source of truth is removed.

## TASK-6 — Deterministic identifiers in teams

- **Status:** todo
- **Owner:** teams

**Implements:** FR-5

**Refs:** TASK-5

- **Done When:** the id helper derives UUIDv5 from project and spec and local id with the contract namespace — two independent projections agree and no mapping table exists in code or data.

## TASK-7 — Route status transitions through the registry

- **Status:** todo
- **Owner:** teams

**Implements:** FR-4

**Depends On:** TASK-5

- **Done When:** `task_set_status` plus `task_start` and `task_complete` and the UI status control call `spec_patch: replace_task_status` — a direct JSON write is unreachable and covered by a failing test.

## TASK-8 — Expand the teams status model to eight statuses

- **Status:** todo
- **Owner:** teams

**Implements:** FR-7, NFR-MAINT-1

**Depends On:** TASK-6

- **Done When:** `TeamTask.status` accepts the eight contract statuses — the renderer imports generated constants and legacy values stay read-only aliases used only for archive import.

## TASK-9 — Derive kanban and review state from status

- **Status:** todo
- **Owner:** teams

**Implements:** FR-7

**Depends On:** TASK-8

- **Done When:** `kanbanColumn` and `reviewState` are computed — `kanban-state.json` keeps only `columnOrder` and `reviewer` while approve writes `done` and request-changes writes `in-progress`.

## TASK-10 — Implement fail-closed error surface

- **Status:** todo
- **Owner:** teams

**Implements:** FR-8, NFR-OBS-1

**Depends On:** TASK-7

- **Done When:** every registry failure maps to a contract error code — the task board shows an error state and no queue or cache or optimistic status exists in code.

## TASK-11 — Implement three-way conflict resolution

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-9, NFR-DATA-1

**Depends On:** TASK-3

- **Done When:** `planSyncDecision` implements the DEC-7 table — the sync service emits `task_sync.conflict` before applying spec-wins and tests cover all five rows.

## TASK-12 — Bind a team to a registry project

- **Status:** todo
- **Owner:** teams

**Implements:** FR-1

**Refs:** TASK-5

- **Done When:** team config stores `specProject` — a missing binding returns `TEAM_PROJECT_BINDING_MISSING` and the binding is visible in team settings.

## TASK-13 — Archive and delete legacy tasks

- **Status:** todo
- **Owner:** teams

**Implements:** FR-10

**Refs:** TASK-5

- **Done When:** first sync writes `userData/backups/teams-tasks-<timestamp>.tar` and then removes `~/.claude/tasks/<team>` — a repeat run is a no-op and archive contents match the removed files.

## TASK-14 — BDD suite for the contract

- **Status:** todo
- **Owner:** both

**Implements:** NFR-TEST-1

**Depends On:** TASK-1, TASK-7, TASK-11

- **Done When:** `tests/features/teams-task-sync.feature` runs against the real spec-kit MCP server and against the teams MCP server — all SCEN ids pass in CI.

## TASK-15 — Update the two repositories' documentation

- **Status:** todo
- **Owner:** both

**Implements:** FR-11

**Refs:** TASK-14

- **Done When:** spec-kit `docs/` describes the contract and operations — the teams fork documents the projection-only store and the removal of local task creation.
