# Functional Requirements

IDs are local here and qualified as `teams-task-sync:<id>` outside this specification.

## FR-1 — spec-registry is the single task store

Система ДОЛЖНА хранить все задачи команды в каноническом корпусе спецификаций, обслуживаемом `spec-registryd`. Команда teams ДОЛЖНА быть привязана к проекту реестра (`team.specProject`), и ни один компонент teams не ДОЛЖЕН читать или писать задачи из `~/.claude/tasks` как из источника правды.

**Acceptance:** AC-1.1, AC-1.2

## FR-2 — Structured task operations in spec-kit

`spec_patch` ДОЛЖЕН поддерживать структурированные операции над задачами: `upsert_task` (создание с явным `localId`), `replace_task_status`, `replace_task_owner`, `replace_task_links`. Свободная сборка Markdown на стороне клиента запрещена. Задача ДОЛЖНА поддерживать поле `Tracking` и отдавать `owner`, `tracking`, `contentHash` в board/query.

**Acceptance:** AC-2.1, AC-2.2, AC-2.3

## FR-3 — Teams creates tasks only through the registry

Любое создание задачи в teams (UI, MCP-инструмент `task_create`, `task_create_from_message`) ДОЛЖНО приводить к `spec_patch: upsert_task` в реестре. Локальное создание задачи ДОЛЖНО быть отклонено с типизированной ошибкой `TASK_CREATE_REQUIRES_REGISTRY`. Созданная задача ДОЛЖНА иметь минимум одну связь `Implements` на FR/NFR/AC той же спецификации.

**Acceptance:** AC-3.1, AC-3.2

## FR-4 — Status transitions are written through spec-kit

Смена статуса задачи в teams ДОЛЖНА выполнять `spec_patch: replace_task_status` и только после успешной записи обновлять проекцию. Запись статуса напрямую в JSON задачи ДОЛЖНА быть запрещена. Обратная проекция (`spec -> teams`) ДОЛЖНА обновлять задачу без изменения канонических полей.

**Acceptance:** AC-4.1, AC-4.2

## FR-5 — Deterministic identity

Идентификатор задачи teams ДОЛЖЕН вычисляться как UUIDv5 с фиксированным namespace из строки `<projectId>/<specSlug>/<localId>`. Таблица соответствий идентификаторов запрещена. Повторное создание проекции из того же канонического узла ДОЛЖНО давать тот же `id`.

**Acceptance:** AC-5.1, AC-5.2

## FR-6 — Single field ownership

Каждое поле задачи ДОЛЖНО иметь ровно одного владельца. Канонические поля (идентичность, заголовок, тело, статус, владелец, зависимости, ссылки, приёмка, tracking) принадлежат spec-kit. Исполнительские поля (`workIntervals`, `reviewIntervals`, `historyEvents`, `comments`, `attachments`, `sourceMessage`, `groupChatId`, `activeForm`, `prompt`, `projectPath`) принадлежат teams. Производные поля (`subject`, `description`, `displayId`, `blocks`, `blockedBy`, `related`, `reviewState`) ДОЛЖНЫ вычисляться и НЕ ДОЛЖНЫ храниться как независимая истина.

**Acceptance:** AC-6.1, AC-6.2

## FR-7 — Kanban and review are derived from status

Колонки канбана ДОЛЖНЫ вычисляться из статуса: `ready` — колонка review, `done` — колонка approved. `reviewState` ДОЛЖЕН вычисляться из статуса и истории переходов. В `kanban-state.json` ДОЛЖНЫ храниться только UI-данные: порядок карточек и назначенный ревьюер.

**Acceptance:** AC-7.1, AC-7.2

## FR-8 — Fail-closed without the registry

При недоступности реестра, несовпадении версии контракта или отсутствии прав команда ДОЛЖНА отклонять операции с типизированной ошибкой. Локальная запись, очередь отложенных операций, оптимистическое состояние и «временный» локальный статус запрещены. Доска задач ДОЛЖНА показывать состояние ошибки, а не устаревшие данные.

**Acceptance:** AC-8.1, AC-8.2

## FR-9 — Three-way conflict resolution

Синхронизация ДОЛЖНА сравнивать три состояния: последний согласованный снапшот, текущее состояние корпуса и текущее состояние проекции. При расхождении всех трёх побеждает корпус, конфликт ДОЛЖЕН быть зафиксирован событием `task_sync.conflict` с полями и обоими значениями. Молчаливая перезапись запрещена.

**Acceptance:** AC-9.1, AC-9.2

## FR-10 — Legacy task removal

При первом запуске после включения синхронизации teams ДОЛЖЕН заархивировать `~/.claude/tasks/<team>` в `userData/backups/teams-tasks-<timestamp>.tar` и удалить каталог задач. Усыновление старых задач в корпус запрещено.

**Acceptance:** AC-10.1, AC-10.2

## FR-11 — Versioned sync contract

Маппинг статусов, владение полями, namespace идентификаторов и коды ошибок ДОЛЖНЫ быть описаны одним машинно-читаемым контрактом `contracts/task-sync.contract.json` в omp-spec-kit с полем `version`. teams ДОЛЖЕН проверять версию контракта при старте и отклонять работу при несовпадении.

**Acceptance:** AC-11.1, AC-11.2
