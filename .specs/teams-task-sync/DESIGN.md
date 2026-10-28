# Design

## Architecture overview

```
teams renderer (Electron)
  |  IPC (typed, main-process only)
teams main process
  |  TaskSyncService (domain, pure)
  |    StatusPolicy        contract -> rank/derivation
  |    TaskMapper          spec node <-> projection record
  |    ConflictResolver    three-way merge, spec wins
  |    ProjectionWriter    idempotent upsert into ~/.claude/tasks
  |  RegistryClient (MCP)  spec_patch / spec_query, fail-closed
  v
spec-registryd  ->  canonical corpus (.specs, writer = registry only)
```

## DEC-1 — spec-registry is the canonical task store

**Rationale:** реестр уже является единственным писателем корпуса, сериализует записи проектным локом и проверяет `expectedSha`; это снимает вопрос «кто прав» до уровня протокола. teams получает только MCP-доступ, без git и без файлового доступа к корпусу.
**Trade-off:** teams больше не работает без реестра; офлайн-режим отсутствует по построению (см. DEC-9).
**Alternatives:** прямое чтение/запись `.specs` из процессов teams (нет единого писателя, нет авторизации); гибрид с локальным кэшем (второе состояние, расходится молча).

## DEC-2 — Duplicate resolution: one owner per field

Дубли полей решаются не согласованием значений, а назначением владельца. Таблица обязательна для обеих сторон и генерируется из контракта.

| Поле | Владелец | Направление | Преобразование |
|---|---|---|---|
| `canonicalId` / `localId` | spec | spec → teams | `id = uuidv5(ns, "<project>/<spec>/<localId>")`, `displayId = localId` |
| `title` / `subject` | spec | spec → teams | `subject = title` |
| `body` / `description` | spec | spec → teams | `description = body` |
| `status` | spec | spec ↔ teams (запись только в spec) | таблица статусов, DEC-4 |
| `owner` | spec | spec → teams | строка, валидируется контрактом |
| `Depends On` / `blockedBy` / `blocks` | spec | spec → teams | `blockedBy = Depends On`; `blocks` вычисляется |
| `Refs` / `related` | spec | spec → teams | `related = Refs` |
| `Done When` / приёмка | spec | spec → teams (read-only) | текст в `description`-секции |
| `Tracking` | spec | spec ↔ teams | единственная внешняя ссылка, `agent-teams:<team>/<uuid>` |
| `workIntervals`, `reviewIntervals` | teams | — | не покидают teams |
| `historyEvents` | teams | teams → spec (событие конфликта/аудита) | только как audit-событие, не как поле задачи |
| `comments`, `attachments` | teams | — | не покидают teams |
| `sourceMessage`, `groupChatId`, `activeForm`, `prompt`, `projectPath` | teams | — | не покидают teams |
| `reviewState` | производное | — | вычисляется из статуса и `historyEvents` |
| `kanbanColumn`, порядок, `reviewer` | teams (UI) | — | колонка вычисляется из статуса, порядок и ревьюер хранятся в `kanban-state.json` |

**Rationale:** исчезает класс дефектов «две копии одного факта»; любое поле либо каноническое, либо производное, либо исполнительское.
**Trade-off:** teams теряет возможность локально переименовать задачу или поправить описание — такие правки идут через реестр.
**Alternatives:** двусторонняя синхронизация каждого поля с last-write-wins (недетерминированно при расхождении часов); хранение копий с регулярным мержем (дубли сохраняются).

## DEC-3 — Deterministic identity instead of a mapping table

`id = uuidv5(TASK_SYNC_NAMESPACE, "<projectId>/<specSlug>/<localId>")`; namespace — константа контракта.

**Rationale:** соответствие вычисляется, а не хранится; восстановление после потери `~/.claude` даёт те же идентификаторы; повторная проекция идемпотентна.
**Trade-off:** `localId` неизменяем после создания задачи; переименование `TASK-3` в `TASK-30` запрещено (архивирование + новая задача).
**Alternatives:** таблица `externalRef` в JSON (дублирующее состояние, требует восстановления); автоинкремент (не воспроизводим).

## DEC-4 — Status lattice: eight canonical statuses, no lossy mapping

Канонические статусы: `planned`, `todo`, `ready`, `in-progress`, `blocked`, `done`, `deferred`, `unknown`.

| teams UI | spec status | Смысл |
|---|---|---|
| Backlog | `planned`, `todo` | не начата / запланирована |
| Active | `in-progress` | в работе |
| Review | `ready` | работа заявлена готовой, ждёт приёмки |
| Done | `done` | принята |
| Blocked | `blocked` | заблокирована зависимостью или уточнением |
| Deferred | `deferred` | снята с очереди (в т.ч. удалённая задача) |
| Unknown | `unknown` | статус не распознан |

Правила: `completed` в терминах старой модели teams ДОЛЖЕН читаться как `ready`; `deleted` — как `deferred` (файл остаётся tombstone с `deletedAt`). Обратный маппинг один: `ready → Review`, `done → Done`.
**Rationale:** ни один переход не теряет смысл; канбан становится представлением статуса, а не второй машиной состояний.
**Trade-off:** «завершено» и «принято» разделены, поэтому исполнителю нужно явное действие ревьюера.
**Alternatives:** оставить 4 статуса teams и терять `ready`/`blocked`/`deferred` (искажение при каждом круге); добавить девятый `cancelled` (девятое состояние ради одного перехода).

## DEC-5 — Kanban is a projection with two stored UI facts

`kanbanColumn = ready ? review : done ? approved : null`. В `kanban-state.json` остаются только `columnOrder` и `reviewer`; `column` и `movedAt` больше не являются источником статуса.

**Rationale:** устраняется дубль «колонка vs статус», который сейчас может расходиться.
**Trade-off:** ручное перетаскивание карточки в колонку без смены статуса невозможно — перетаскивание меняет статус.
**Alternatives:** хранить колонку независимо (текущее поведение, два источника); убрать канбан (потеря UX ревью).

## DEC-6 — One contract artifact, generated constants

`contracts/task-sync.contract.json`: `version`, `namespace`, `statuses[]`, `statusTransitions[]`, `fieldOwnership[]`, `errorCodes[]`. Из него генерируются константы для spec-kit и для форка teams; обе стороны валидируют `version` при старте и в тестах.

**Rationale:** DRY и OCP — новое поле или статус добавляются в контракт и генератор, а не в два ручных списка.
**Trade-off:** появляется шаг генерации в сборке обеих сторон; рассинхронизация сборки ловится версией и тестом.
**Alternatives:** два ручных списка (текущее состояние: 8 статусов в spec-kit, 4 в teams); рантайм-запрос схемы у реестра (сеть в горячем пути маппинга).

## DEC-7 — Conflicts: three-way merge, spec wins, event first

Сравниваются `baseline` (последний согласованный снапшот), `spec` (текущий корпус) и `projection` (текущая проекция) по `contentHash` и `updatedAt`.

| baseline vs spec | baseline vs projection | Решение |
|---|---|---|
| равно | равно | ничего |
| равно | изменено | применить проекцию (это и есть pull) |
| изменено | равно | применить корпус (push) |
| изменено | изменено | корпус побеждает, `task_sync.conflict` |
| нет baseline | любое | корпус побеждает, `task_sync.conflict` |

Событие пишется до применения; при сбое записи события изменение не применяется.
**Rationale:** воспроизводит уже проверенную схему `youtrack-status-sweep.js`, но с обязательной фиксацией конфликта.
**Trade-off:** при конфликте теряется локальное изменение teams; компенсация — событие и видимый диалог.
**Alternatives:** last-write-wins (зависит от часов); блокировка задач на время сессии (не работает с несколькими агентами).

## DEC-8 — Bounded contexts, ports and adapters

- Domain (`TaskSyncService`, `StatusPolicy`, `TaskMapper`, `ConflictResolver`) — чистые функции и классы без I/O.
- Порты: `RegistryPort` (query/patch), `ProjectionPort` (read/write projection), `SyncStatePort` (baseline), `ClockPort`.
- Адаптеры: `McpRegistryClient`, `FileProjectionStore`, `JsonSyncStateStore`.
- Renderer не содержит правил маппинга и не знает про статусы корпуса — только IPC-контракт.

**Rationale:** SOLID по границам: SRP на преобразование/политику/мерж, OCP через контракт, ISP через узкие порты, DIP через инъекцию адаптеров; KISS — без event sourcing и очередей.
**Trade-off:** больше файлов, чем «один сервис, который всё делает».
**Alternatives:** логика в renderer (нельзя тестировать без Electron и утекают секреты); один god-service (нарушает SRP, не тестируется).

## DEC-9 — No fallback, fail closed

Любая операция, требующая корпуса, либо выполняется реестром, либо завершается ошибкой: `REGISTRY_UNAVAILABLE`, `CONTRACT_VERSION_MISMATCH`, `TEAM_PROJECT_BINDING_MISSING`, `FIELD_OWNED_BY_SPEC`, `TASK_CREATE_REQUIRES_REGISTRY`, `TASK_REQUIREMENT_REQUIRED`, `STRUCTURED_TASK_OP_REQUIRED`. Запрещены: локальная очередь, «оффлайн-статус», оптимистичный UI, запись JSON в обход MCP, тихий retry с локальной фиксацией.

**Rationale:** fallback превращает централизацию в два источника правды и делает конфликт необнаружимым; отказ виден и обратим, расхождение — нет.
**Trade-off:** недоступность реестра останавливает работу с задачами (по решению — приемлемо).
**Alternatives:** outbox с последующей отправкой (дубли и порядок); read-only кэш (устаревшие статусы, ложные решения).

## DEC-10 — Legacy removal, no adoption

Первый запуск: архив `userData/backups/teams-tasks-<ts>.tar`, затем удаление `~/.claude/tasks/<team>`. Усыновление запрещено.

**Rationale:** 211 задач без требований и без трассировки не проходят FR-3; усыновление создало бы мусорный корпус и ложную историю.
**Trade-off:** теряется история переписки по задачам (остаётся в архиве и в инбоксах).
**Alternatives:** массовое усыновление (мусор в корпусе); read-only legacy (второй режим, второй источник).

## Conflict blast radius

| Конфликтующая поверхность | Что ломается при расхождении | Решение по DEC-7 | Проверка |
|---|---|---|---|
| Статус | канбан-колонка, счётчики, уведомления | spec wins + событие | SCEN-5, SCEN-6 |
| Владелец | маршрутизация сообщений и work-sync | spec wins + событие | SCEN-7 |
| Зависимости | блокировка задач, порядок выдачи работы | spec wins, `blockedBy` пересчитывается | SCEN-8 |
| Приёмка (`Done When`) | ревью и `done`-переход | spec wins, проекция только читает | SCEN-9 |
| Идентичность | дубли задач, потеря истории | детерминированный id исключает конфликт | SCEN-3 |
| Контракт | вся синхронизация | отказ при старте | SCEN-1, SCEN-2 |
| Реестр недоступен | любая запись | fail-closed | SCEN-4 |

Затронутые поверхности в teams: `team-task-detail`, `member-work-sync`, `stallMonitor`, `taskLogs`, `agent-graph`, уведомления о комментариях. В spec-kit: `src/kernel/*` (атрибуты задачи), `src/adapters/query-service.js`, `src/adapters/tool-contracts.js`, `src/authoring/proposals.js`, `src/mcp/server.js`.
