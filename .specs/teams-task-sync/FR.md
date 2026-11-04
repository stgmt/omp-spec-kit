# Functional Requirements

IDs are local here and qualified as `teams-task-sync:<id>` outside this specification.

## FR-1 — spec-registry is the single task store

Система ДОЛЖНА хранить все задачи команды в каноническом корпусе спецификаций, обслуживаемом `spec-registryd`. Команда teams ДОЛЖНА быть привязана к проекту реестра (`team.specProject`). Канонические поля задачи ДОЛЖНЫ читаться и писаться только через реестр: ни один компонент teams не ДОЛЖЕН хранить их копию, включая `~/.claude/tasks`, кэш или локальную проекцию. Локальное хранилище команды ДОЛЖНО содержать только исполнительские поля под детерминированным идентификатором задачи.

**Acceptance:** AC-1.1, AC-1.2

## FR-2 — Structured task operations in spec-kit

`spec_patch` ДОЛЖЕН поддерживать структурированные операции над задачами: `upsert_task` (создание с явным `localId`), `replace_task_status` (с обязательным `expectedStatus`), `replace_task_owner`, `replace_task_links`. Свободная сборка Markdown на стороне клиента запрещена. Задача ДОЛЖНА поддерживать поле `Tracking` вида `agent-teams:<team>/<uuid>`, где `<uuid>` — детерминированный идентификатор проекции, и отдавать `owner`, `tracking`, `contentHash`, а также вычисленные `dependsOn`, `blocks` и `blockedBy` в board/query. Существующий intent `addBacklogTask` ДОЛЖЕН быть переведён на `upsert_task`, чтобы в корпусе не появилось второе представление задачи.

**Acceptance:** AC-2.1, AC-2.2, AC-2.3, AC-2.4

## FR-3 — Teams creates tasks only through the registry

Любое создание задачи в teams (UI, MCP-инструмент `task_create`, `task_create_from_message`) ДОЛЖНО приводить к `spec_patch: upsert_task` в реестре. Локальное создание задачи ДОЛЖНО быть отклонено с типизированной ошибкой `TASK_CREATE_REQUIRES_REGISTRY`. Созданная задача ДОЛЖНА иметь минимум одну связь `Implements` на FR/NFR/AC той же спецификации.

**Acceptance:** AC-3.1, AC-3.2

## FR-4 — Status transitions are written through spec-kit

Смена статуса задачи в teams ДОЛЖНА выполнять `spec_patch: replace_task_status` с обязательным `expectedStatus` и только после успешной записи обновлять проекцию. Успешный ответ ДОЛЖЕН содержать квитанцию перехода (`requestId`, `from`, `to`, `actor`, `at`); teams ДОЛЖЕН дописывать её в `historyEvents` как append-only событие процесса. Повторный вызов с тем же `requestId` или при уже целевом статусе ДОЛЖЕН быть идемпотентным и не создавать вторую запись истории. Запись статуса напрямую в JSON задачи ДОЛЖНА быть запрещена. Обратная проекция (`spec -> teams`) ДОЛЖНА обновлять задачу без изменения канонических полей.

**Acceptance:** AC-4.1, AC-4.2, AC-4.3, AC-4.4

## FR-5 — Deterministic identity

Идентификатор задачи teams ДОЛЖЕН вычисляться как UUIDv5 с фиксированным namespace из строки `<projectId>/<specSlug>/<localId>`. Таблица соответствий идентификаторов запрещена. Повторное создание проекции из того же канонического узла ДОЛЖНО давать тот же `id`.

**Acceptance:** AC-5.1, AC-5.2

## FR-6 — Single field ownership

Каждое поле задачи ДОЛЖНО иметь ровно одного владельца. Канонические поля (идентичность, заголовок, тело, статус, владелец, зависимости, ссылки, приёмка, tracking) принадлежат spec-kit. Исполнительские поля (`workIntervals`, `reviewIntervals`, `historyEvents`, `comments`, `attachments`, `sourceMessage`, `groupChatId`, `activeForm`, `prompt`, `projectPath`) принадлежат teams; `historyEvents` — append-only журнал процесса, а не поле задачи. Производные поля (`subject`, `description`, `displayId`, `blocks`, `blockedBy`, `related`, `reviewState`) ДОЛЖНЫ вычисляться и НЕ ДОЛЖНЫ храниться как независимая истина. `reviewState` вычисляется на стороне teams из статуса и `historyEvents` и никогда не пишется в корпус; `reviewer` — назначение процесса teams, не источник прав.

**Acceptance:** AC-6.1, AC-6.2, AC-6.3

## FR-7 — Kanban and review are derived from status

Колонки канбана ДОЛЖНЫ вычисляться из статуса: `ready` — колонка review, `done` — колонка approved. `reviewState` ДОЛЖЕН вычисляться из статуса и истории переходов по таблице контракта: `ready` — `review`, `done` — `approved`, `ready -> in-progress` — `needsFix`, остальные переходы — `none`. В `kanban-state.json` ДОЛЖНЫ храниться только UI-данные: порядок карточек и назначенный ревьюер. Назначение ревьюера не даёт прав в реестре.

**Acceptance:** AC-7.1, AC-7.2, AC-7.3

## FR-8 — Fail-closed without the registry

При недоступности реестра, несовпадении версии или hash контракта, отсутствии контракта, конфликте ожидаемого статуса или отсутствии прав команда ДОЛЖНА отклонять операции с типизированной ошибкой. Локальная запись, очередь отложенных операций, оптимистическое состояние и «временный» локальный статус запрещены. `pending_projection` не является ни статусом задачи, ни очередью: это записанный маркер восстановления уже подтверждённой канонической записи. Доска задач ДОЛЖНА показывать состояние ошибки, а не устаревшие данные.

**Acceptance:** AC-8.1, AC-8.2, AC-8.3

## FR-9 — Three-way conflict resolution

Синхронизация ДОЛЖНА сравнивать три состояния: последний согласованный снапшот, текущее состояние корпуса и текущее состояние проекции. При расхождении всех трёх побеждает корпус, конфликт ДОЛЖЕН быть зафиксирован событием `task_sync.conflict` с полями и обоими значениями. Молчаливая перезапись запрещена. Переход, подтверждённый реестром, но ещё не применённый к проекции, ДОЛЖЕН быть записан как `pending_projection` до обновления проекции; успех закрывает его событием `task_sync.projected`, сбой — `task_sync.projection_failed` с переходом в конфликт. `pending_projection` не повторяет каноническую запись.

**Acceptance:** AC-9.1, AC-9.2, AC-9.3

## FR-10 — Legacy task removal

При первом запуске после включения синхронизации teams ДОЛЖЕН заархивировать `~/.claude/tasks/<team>` и `userData/attachments/<team>` в `userData/backups/teams-tasks-<timestamp>/` (или tar) с манифестом (`path`, `sha256`, `size`), затем удалить каталог задач. Повторный запуск ДОЛЖЕН быть no-op. Усыновление старых задач в корпус запрещено: в UI и каталоге MCP-инструментов нет команды adopt, а попытка вызова adopt-операции отклоняется типизированной ошибкой.

**Acceptance:** AC-10.1, AC-10.2, AC-10.3

## FR-11 — Versioned sync contract

Маппинг статусов, владение полями, namespace идентификаторов, коды ошибок, запись перехода и mapping review-событий ДОЛЖНЫ быть описаны одним машинно-читаемым контрактом `contracts/task-sync.contract.json` в omp-spec-kit с полями `version` и `sha256`. Реестр ДОЛЖЕН отдавать контракт и его версию/hash через `mcp_preflight` и `spec_catalog` (view `contract`); teams ДОЛЖЕН сверять версию и hash при старте и отклонять работу при несовпадении или отсутствии контракта. Контракт — единственный источник маппинга; npm-артефакт генерируется из него и не поддерживается вручную.

**Acceptance:** AC-11.1, AC-11.2, AC-11.3

## FR-12 — Authenticated authority and attribution

Реестр ДОЛЖЕН проверять роль (`owner`/`writer`/`reader`) на стороне реестра для каждой мутации; teams ДОЛЖЕН использовать аутентифицированный HTTP MCP, а не stdio. `actor` в квитанции и истории ДОЛЖЕН быть аутентифицированным principal из bearer-токена; `actorRef` — только корреляция и не источник прав. `team.config` ДОЛЖЕН маппить участника на registry login, а не на роль; роли резолвятся реестром. Назначение reviewer остаётся процессом teams и не даёт прав в реестре.

**Acceptance:** AC-12.1, AC-12.2, AC-12.3

## FR-13 — Sync metrics are exposed by the owning component

Компонент, владеющий фактом, ДОЛЖЕН экспортировать агрегаты: реестр — `spec_patch_latency_ms`, `spec_patch_conflict_total`; teams — `sync_pending_total`, `sync_pending_age_ms`, `status_transition_e2e_ms`, `sync_conflict_total`. Агрегаты ДОЛЖНЫ быть доступны через `/metrics`; новый MCP-инструмент для метрик не добавляется.

**Acceptance:** AC-13.1
