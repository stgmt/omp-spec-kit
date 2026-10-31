# File Changes

## spec-kit

## FC-1 — Sync contract and generated constants

- **Action:** create
- **Paths:** `contracts/task-sync.contract.json`, `scripts/generate-task-sync-contract.mjs`, `src/adapters/task-sync-contract.generated.js`, `src/mcp/server.js`
- **Implements:** FR-11

## FC-2 — Structured task operations

- **Action:** edit
- **Paths:** `src/adapters/tool-contracts.js`, `src/authoring/proposals.js`, `src/adapters/query-service.js`, `src/authoring/service.js`
- **Implements:** FR-2, FR-3, FR-4

## FC-3 — Task attributes: Tracking, owner exposure, derived edges

- **Action:** edit
- **Paths:** `src/kernel/types.js`, `src/kernel/parsers/attributes.js`, `src/kernel/query/service.js`, `src/kernel/query/extended.js`
- **Implements:** FR-2, FR-6

## FC-4 — Sync planner and conflict events

- **Action:** create
- **Paths:** `src/adapters/task-sync-planner.js`, `src/adapters/task-sync-service.js`, `src/adapters/task-sync-journal.js`
- **Implements:** FR-9, NFR-DATA-1

## FC-5 — Registry MCP surface

- **Action:** edit
- **Paths:** `src/mcp/server.js`, `src/service/dispatch.js`, `src/service/projection.js`
- **Implements:** FR-1, FR-11, FR-12

## teams fork

## FC-6 — Projection writer and mapper

- **Action:** create
- **Paths:** `agent-teams-ai/src/main/services/team/TaskProjectionWriter.ts`, `agent-teams-ai/src/main/services/team/TaskMapper.ts`, `agent-teams-ai/src/main/services/team/StatusPolicy.ts`
- **Implements:** FR-5, FR-6, FR-7

## FC-7 — Registry client (MCP)

- **Action:** create
- **Paths:** `agent-teams-ai/src/main/services/team/SpecRegistryClient.ts`, `agent-teams-ai/src/main/services/team/TaskSyncService.ts`
- **Implements:** FR-1, FR-8, FR-12

## FC-8 — Task store becomes read-only projection

- **Action:** edit
- **Paths:** `agent-teams-ai/agent-teams-controller/src/internal/taskStore.js`, `agent-teams-ai/src/main/services/team/TeamTaskWriter.ts`, `agent-teams-ai/src/main/services/team/TeamTaskReader.ts`
- **Implements:** FR-3, FR-6

## FC-9 — Status model and kanban derivation

- **Action:** edit
- **Paths:** `agent-teams-ai/src/shared/types/team.ts`, `agent-teams-ai/src/main/services/team/TeamKanbanManager.ts`, `agent-teams-ai/src/main/services/team/teamTaskActiveState.ts`
- **Implements:** FR-7

## FC-10 — MCP tools routed through the registry

- **Action:** edit
- **Paths:** `agent-teams-ai/mcp-server/src/tools/taskTools.ts`, `agent-teams-ai/mcp-server/src/tools/kanbanTools.ts`, `agent-teams-ai/agent-teams-controller/src/mcpToolCatalog.js`
- **Implements:** FR-3, FR-4

## FC-11 — Renderer: error surface and generated statuses

- **Action:** edit
- **Paths:** `agent-teams-ai/src/renderer/store/team/*`, `agent-teams-ai/src/renderer/components/team/*`, `agent-teams-ai/src/renderer/components/dashboard/*`
- **Implements:** FR-8, FR-7

## FC-12 — Legacy task archive and removal

- **Action:** create
- **Paths:** `agent-teams-ai/src/main/services/team/LegacyTaskArchiver.ts`, `agent-teams-ai/src/main/services/team/startTeamTaskSync.ts`
- **Implements:** FR-10

## FC-13 — Tests on both sides

- **Action:** create
- **Paths:** `tests/teams-task-sync.test.mjs`, `tests/fixtures/task-sync-contract.json`, `tests/features/teams-task-sync.feature`, `agent-teams-ai/test/task-sync/*.test.ts`, `agent-teams-ai/test/task-sync/projection.e2e.test.ts`
- **Implements:** NFR-TEST-1

## Cross-cutting

## FC-14 — Authenticated authority and attribution

- **Action:** edit
- **Paths:** `src/service/auth.js`, `src/service/dispatch.js`, `src/adapters/query-service.js`, `agent-teams-ai/src/main/services/team/SpecRegistryClient.ts`, `agent-teams-ai/src/main/services/team/TaskSyncService.ts`
- **Implements:** FR-12, NFR-SEC-1

## FC-15 — Sync metrics

- **Action:** edit
- **Paths:** `src/service/http.js`, `src/adapters/task-sync-service.js`, `agent-teams-ai/src/main/services/team/TaskSyncService.ts`
- **Implements:** FR-13, NFR-OBS-1

## FC-16 — Reusable authoring constraints

- **Action:** create
- **Paths:** `docs/authoring-constraints.md`
- **Implements:** NFR-MAINT-1

## Specification documents

- `README.md` — spec metadata and key decisions
- `FR.md` — functional requirements
- `NFR.md` — non-functional requirements
- `DESIGN.md` — design decisions, conflict blast radius
- `TASKS.md` — implementation tasks
- `ACCEPTANCE_CRITERIA.md` — acceptance criteria
- `teams-task-sync.feature` — Gherkin scenarios
- `FILE_CHANGES.md` — this file
