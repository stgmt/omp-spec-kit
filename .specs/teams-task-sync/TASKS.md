# Tasks

## TASK-1 — Define the sync contract artifact

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-11, NFR-MAINT-1

- **Done When:** the contract `contracts/task-sync.contract.json` carries `version` and `sha256` plus the status and failure tables and the transition record and the review-event mapping. The codes `CONTRACT_UNAVAILABLE` `STATUS_CONFLICT` `ADOPTION_NOT_SUPPORTED` and `FORBIDDEN_ROLE` are present. The generator emits both sides' constants. The registry serves the contract through `mcp_preflight` and the `spec_catalog` contract view. A drift test fails on any hand-written status list.

## TASK-2 — Add structured task operations to spec-kit

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-2, FR-4, NFR-COMPAT-1

**Refs:** TASK-1

- **Done When:** `spec_patch` accepts `upsert_task` and `replace_task_owner` and `replace_task_links` and `replace_task_status` with `expectedStatus`. `upsert_task` is idempotent on identical input. Status transitions return a receipt with `from` `to` `actor` `at` and `requestId`. Free-form `insert_at_eof` into `TASKS.md` is rejected with `STRUCTURED_TASK_OP_REQUIRED`.

## TASK-3 — Expose owner, tracking, content hash and derived edges

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-2, FR-6

**Refs:** TASK-2

- **Done When:** TASK nodes expose owner, tracking, contentHash and derived dependency edges; no local canonical dependency copy is stored.

## TASK-4 — Enforce requirement linkage on task creation

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-3

**Refs:** TASK-2

- **Done When:** `upsert_task` without `Implements` on an FR or NFR or AC of the same spec returns `TASK_REQUIREMENT_REQUIRED` and linked creation succeeds.

## TASK-5 — Replace the teams task store with a projection

- **Status:** todo
- **Owner:** teams

**Implements:** FR-1, FR-6

**Depends On:** TASK-2, TASK-3

- **Done When:** `~/.claude/tasks/<team>` is written only by the projection writer. `taskStore` has no creation path. the projection stores no derived edges. reading disk as the source of truth is removed.

## TASK-6 — Deterministic identifiers in teams

- **Status:** todo
- **Owner:** teams

**Implements:** FR-5

**Refs:** TASK-5

- **Done When:** the id helper derives UUIDv5 from project and spec and local id with the contract namespace. Two independent projections agree and no mapping table exists in code or data.

## TASK-7 — Route status transitions through the registry

- **Status:** todo
- **Owner:** teams

**Implements:** FR-4

**Depends On:** TASK-5

- **Done When:** `task_set_status` plus `task_start` and `task_complete` and the UI status control call `spec_patch: replace_task_status` with `expectedStatus`. A direct JSON write is unreachable. The receipt is appended to `historyEvents` only after `APPLIED`. A replay is idempotent and covered by a failing test.

## TASK-8 — Expand the teams status model to eight statuses

- **Status:** todo
- **Owner:** teams

**Implements:** FR-7, NFR-MAINT-1

**Depends On:** TASK-6

- **Done When:** `TeamTask.status` accepts the eight contract statuses. The renderer imports generated constants and legacy values stay read-only aliases used only for archive import.

## TASK-9 — Derive kanban and review state from status

- **Status:** todo
- **Owner:** teams

**Implements:** FR-7

**Depends On:** TASK-8

- **Done When:** `kanbanColumn` and `reviewState` are computed from status and `historyEvents` using the contract review mapping. `kanban-state.json` keeps only `columnOrder` and `reviewer`. Approve writes `done` and records the authenticated actor. Request-changes writes `in-progress` and emits `review_changes_requested`. Reviewer remains advisory.

## TASK-10 — Implement fail-closed error surface

- **Status:** todo
- **Owner:** teams

**Implements:** FR-8, NFR-OBS-1

**Depends On:** TASK-7

- **Done When:** every registry failure maps to a contract error code including `CONTRACT_UNAVAILABLE` and `STATUS_CONFLICT`. The task board shows an error state. No queue or cache or optimistic status exists in code. `pending_projection` is treated only as a recovery marker.

## TASK-11 — Implement three-way conflict resolution

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-9, NFR-DATA-1

**Depends On:** TASK-3

- **Done When:** `planSyncDecision` implements the DEC-7 table. The sync service emits `task_sync.conflict` before applying spec-wins. It writes `pending_projection` before the projection update. It emits `task_sync.projected` on success and `task_sync.projection_failed` on failure. Tests cover all five rows plus the pending path.

## TASK-12 — Bind a team to a registry project

- **Status:** todo
- **Owner:** teams

**Implements:** FR-1

**Refs:** TASK-5

- **Done When:** team config stores `specProject`. A missing binding returns `TEAM_PROJECT_BINDING_MISSING` and the binding is visible in team settings.

## TASK-13 — Archive and delete legacy tasks

- **Status:** todo
- **Owner:** teams

**Implements:** FR-10

**Refs:** TASK-5

- **Done When:** first sync writes `userData/backups/teams-tasks-<timestamp>/` with `tasks/` and `attachments/` and `manifest.json` containing `path` `sha256` `size`. Then it removes `~/.claude/tasks/<team>`. A repeat run is a no-op. Archive contents match the removed files. Attachments are present. Adoption is impossible.

## TASK-14 — BDD suite for the contract

- **Status:** todo
- **Owner:** spec-kit

**Implements:** NFR-TEST-1

**Depends On:** TASK-1, TASK-7, TASK-11, TASK-19, TASK-20

- **Done When:** `tests/features/teams-task-sync.feature` runs against the real spec-kit MCP server and against the teams MCP server. A fixture contract covers the pre-TASK-1 run. All SCEN ids pass in CI. Every AC has an `@AC-N.M` tag. Every claimed FR has `@featureN`. `spec_inspect coverage` shows the expected `testedBy` edges.

## TASK-15 — Update the two repositories' documentation

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-11, FR-12

**Refs:** TASK-14

- **Done When:** spec-kit `docs/` describes the contract and its runtime serving and the authority model. The teams fork documents the projection-only store and authenticated HTTP MCP and the removal of local task creation.

## TASK-16 — Prove the status transition latency budget

- **Status:** todo
- **Owner:** teams

**Implements:** NFR-PERF-1

**Refs:** TASK-7

- **Done When:** spec_patch round trip plus projection update measured end-to-end on the reference environment gives p95 at or below 1500 ms over 200 transitions. Registry leg and projection leg are recorded separately. A timeout maps to REGISTRY_TIMEOUT.

## TASK-17 — Prove atomic canonical writes under interruption

- **Status:** todo
- **Owner:** spec-kit

**Implements:** NFR-REL-1

**Refs:** TASK-2

- **Done When:** killing the process during upsert_task leaves the previous TASKS.md bytes intact in 100 of 100 runs and the next call succeeds.

## TASK-18 — Keep registry credentials inside the main process

- **Status:** todo
- **Owner:** teams

**Implements:** NFR-SEC-1, FR-12

**Refs:** TASK-7

- **Done When:** the renderer bundle plus logs and telemetry contain no token. A token rotation takes effect without restarting the team runtime. The receipt actor is derived from the token and `actorRef` is never trusted for authorization.

## TASK-19 — Enforce registry roles and authenticated attribution

- **Status:** todo
- **Owner:** teams

**Implements:** FR-12, NFR-SEC-1

**Depends On:** TASK-5, TASK-7

- **Done When:** teams uses authenticated HTTP MCP with a per-member token. `team.config` maps member to registry login. A reader cannot mutate (`FORBIDDEN_ROLE`). The receipt actor equals the token login. `actorRef` is ignored for authorization. Reviewer assignment grants no role.

## TASK-20 — Expose sync metrics by owning component

- **Status:** todo
- **Owner:** teams

**Implements:** FR-13, NFR-OBS-1

**Depends On:** TASK-11, TASK-16

- **Done When:** the registry exposes `spec_patch_latency_ms` and `spec_patch_conflict_total`. teams exposes `sync_pending_total` `sync_pending_age_ms` `sync_conflict_total` and `status_transition_e2e_ms`. The aggregates are available through `/metrics`. No MCP tool is added. An injected projection failure increments the counters without leaking task text or secrets.

## TASK-21 — Apply editorial deduplication and single-source authoring constraints

- **Status:** done
- **Owner:** spec-kit

**Implements:** NFR-MAINT-1

**Depends On:** TASK-1, TASK-11, TASK-19, TASK-20

- **Done When:** DESIGN carries one authoring-constraints section. The kit repository documents the same rules in `docs/authoring-constraints.md`. Each rule has one normative home: FR behavior or DEC rationale or AC check. The glossary fixes registry and corpus and projection terminology. No duplicated fail-closed or single-writer text remains.

## TASK-22 — Реализовать RegistryTaskProvider в agent-teams-ai

- **Status:** in-progress
- **Owner:** spec-kit

**Implements:** FR-1

- **Tracking:** agent-teams:tokenplan-ops/9b1f6d7e-0000-4000-8000-000000000001

- **Done When:** Приложение читает канонические поля только из реестра; локально остаются исполнительские поля.

## TASK-23 — Перевести MCP-инструменты команды на реестровый провайдер

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-3, FR-4

- **Done When:** Задачи создаются и меняют статус через реестр; локальная запись канона запрещена.

## TASK-24 — Включить реестр для команды tokenplan-ops и проверить доску

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-1, FR-8

- **Done When:** Команда привязана к проекту stgmt/tokenplan; доска показывает задачи реестра, реестр недоступен — видимая ошибка.

## TASK-25 — Живой E2E: агент создаёт задачу в реестре

- **Status:** todo
- **Owner:** spec-kit

**Implements:** FR-12, FR-3

- **Done When:** Участник команды через MCP создаёт задачу с требованием; она видна на доске и в spec_tasks.

## TASK-26 — Preserve personal agent task tools

- **Status:** todo

**Implements:** FR-14

- **Done When:** Personal native tasks remain usable and unchanged; migration cannot delete personal data and fails safely if separation is uncertain.

## TASK-27 — Support several specification scopes on one team board

- **Status:** todo

**Implements:** FR-15

- **Done When:** A single team shows tasks from linked specifications with collision-free project/spec/task identity and isolated execution data.

## TASK-28 — Connect lead spec authoring and linked shared-task creation

- **Status:** todo

**Implements:** FR-16

- **Done When:** Lead can create and author supported specifications through MCP; all shared task creation paths require an existing same-spec requirement.

## TASK-29 — Expose complete shared task details to team participants

- **Status:** todo

**Implements:** FR-17

- **Done When:** Lead and authorized members read the same untruncated canonical task fields and team execution data while registry roles remain enforced.

## TASK-30 — Prove the real lead-to-board-to-member workflow

- **Status:** todo

**Implements:** FR-18

- **Done When:** Run installed application, real registry and real lead and member in a sandbox; prove both directions, boundaries and negative outcomes.

## TASK-31 — Make specification creation preview side-effect free

- **Status:** todo

**Implements:** FR-16

- **Done When:** A dry-run creation leaves remote branches, commits and documents unchanged while a separate confirmed apply can create the specification.
