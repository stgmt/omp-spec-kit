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
  |    TransitionJournal   receipt -> historyEvents, pending_projection
  |  RegistryClient (HTTP MCP, bearer)  spec_patch / spec_query, fail-closed
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
| `Depends On` / `blockedBy` / `blocks` | spec | spec → teams | `blockedBy = Depends On`; `blocks` вычисляется, DEC-13 |
| `Refs` / `related` | spec | spec → teams | `related = Refs` |
| `Done When` / приёмка | spec | spec → teams (read-only) | текст в `description`-секции |
| `Tracking` | spec | spec ↔ teams | единственная внешняя ссылка, `agent-teams:<team>/<uuid>` |
| `workIntervals`, `reviewIntervals` | teams | — | не покидают teams |
| `historyEvents` | teams | teams-only | append-only журнал процесса; вход для `reviewState`, не поле задачи |
| `comments`, `attachments` | teams | — | не покидают teams |
| `sourceMessage`, `groupChatId`, `activeForm`, `prompt`, `projectPath` | teams | — | не покидают teams |
| `reviewState` | производное (teams) | — | вычисляется из статуса и `historyEvents`; в корпус не пишется |
| `kanbanColumn`, порядок, `reviewer` | teams (UI) | — | колонка вычисляется из статуса; порядок и ревьюер хранятся в `kanban-state.json`; ревьюер не даёт прав |
| `pending_projection`, baseline | teams (sync state) | — | маркер восстановления уже подтверждённой канонической записи; не поле задачи |

**Review state formula.** `reviewState` — производное поле teams, не канон. Оно вычисляется из последнего review-события и текущего статуса:

| Переход статуса | Review-событие | `reviewState` |
|---|---|---|
| `planned`/`todo` → `ready` | `review_requested` | `review` |
| `ready` → `done` | `review_approved` | `approved` |
| `ready` → `in-progress` | `review_changes_requested` | `needsFix` |
| любой → `planned`/`todo`/`deferred` | `review_reset` | `none` |

Mapping переходов в review-события задаётся контрактом. Если переход пришёл из синхронизации без квитанции, teams добавляет синтетическое `status_changed`-событие без actor и пересчитывает `reviewState`.

**Rationale:** исчезает класс дефектов «две копии одного факта»; любое поле либо каноническое, либо производное, либо исполнительское. `reviewState` остаётся процессным отображением, а не вторым статусом.
**Trade-off:** teams теряет возможность локально переименовать задачу или поправить описание — такие правки идут через реестр.
**Alternatives:** двусторонняя синхронизация каждого поля с last-write-wins (недетерминированно при расхождении часов); хранение копий с регулярным мержем (дубли сохраняются); хранение `reviewState` в корпусе (второй статус, merge-конфликты).

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

Правила: `completed` в терминах старой модели teams ДОЛЖЕН читаться как `ready`; `deleted` — как `deferred` (файл остаётся tombstone с `deletedAt`). Обратный маппинг один: `ready → Review`, `done → Done`. Каждый переход статуса выполняется с `expectedStatus` и возвращает квитанцию; протокол перехода — DEC-12.
**Rationale:** ни один переход не теряет смысл; канбан становится представлением статуса, а не второй машиной состояний.
**Trade-off:** «завершено» и «принято» разделены, поэтому исполнителю нужно явное действие ревьюера.
**Alternatives:** оставить 4 статуса teams и терять `ready`/`blocked`/`deferred` (искажение при каждом круге); добавить девятый `cancelled` (девятое состояние ради одного перехода).

## DEC-5 — Kanban is a projection with two stored UI facts

`kanbanColumn = ready ? review : done ? approved : null`. В `kanban-state.json` остаются только `columnOrder` и `reviewer`; `column` и `movedAt` больше не являются источником статуса. `reviewState` вычисляется по DEC-2, а не хранится. `reviewer` — назначение процесса, не право: approve проверяет роль в реестре и авторизованного actor, а не только имя в UI.

**Rationale:** устраняется дубль «колонка vs статус», который сейчас может расходиться.
**Trade-off:** ручное перетаскивание карточки в колонку без смены статуса невозможно — перетаскивание меняет статус.
**Alternatives:** хранить колонку независимо (текущее поведение, два источника); убрать канбан (потеря UX ревью); сделать reviewer источником прав (второй policy engine).

## DEC-6 — One contract artifact, generated constants

`contracts/task-sync.contract.json`: `version`, `sha256`, `namespace`, `statuses[]`, `statusTransitions[]`, `fieldOwnership[]`, `errorCodes[]`, `transitionRecord`, `reviewEventMapping`. Из него генерируются константы для spec-kit и для форка teams; обе стороны валидируют `version` и `sha256` при старте и в тестах.

Контракт отдаётся реестром в рантайме: `mcp_preflight` возвращает `version` и `sha256`, `spec_catalog` (view `contract`) или аутентифицированный `/contract` — полный JSON. teams сверяет контракт при старте; несовпадение — `CONTRACT_VERSION_MISMATCH`, отсутствие — `CONTRACT_UNAVAILABLE`. В горячем пути маппинга сетевого запроса нет: используются сгенерированные константы. npm-артефакт генерируется из того же файла и не поддерживается вручную.

**Rationale:** DRY и OCP — новое поле или статус добавляются в контракт и генератор, а не в два ручных списка; версия и hash ловят рассинхронизацию сборки.
**Trade-off:** появляется шаг генерации в сборке обеих сторон и startup-зависимость от реестра; это соответствует fail-closed DEC-9.
**Alternatives:** два ручных списка (текущее состояние: 8 статусов в spec-kit, 4 в teams); vendors-копия контракта (вторая копия, NFR-MAINT-1); рантайм-запрос схемы в горячем пути маппинга (сеть и отказ в каждом переходе).

## DEC-7 — Conflicts: three-way merge, spec wins, event first

Сравниваются `baseline` (последний согласованный снапшот), `spec` (текущий корпус) и `projection` (текущая проекция) по `contentHash` и `updatedAt`.

| baseline vs spec | baseline vs projection | Решение |
|---|---|---|
| равно | равно | ничего |
| равно | изменено | применить проекцию (это и есть pull) |
| изменено | равно | применить корпус (push) |
| изменено | изменено | корпус побеждает, `task_sync.conflict` |
| нет baseline | любое | корпус побеждает, `task_sync.conflict` |

Событие пишется до применения; при сбое записи события изменение не применяется. `pending_projection` — не четвёртое состояние мержа: это переход, уже подтверждённый корпусом, но ещё не применённый к проекции. Он закрывается успехом проекции или переходит в конфликт при сбое.
**Rationale:** воспроизводит уже проверенную схему `youtrack-status-sweep.js`, но с обязательной фиксацией конфликта.
**Trade-off:** при конфликте теряется локальное изменение teams; компенсация — событие и видимый диалог.
**Alternatives:** last-write-wins (зависит от часов); блокировка задач на время сессии (не работает с несколькими агентами); считать pending отдельным статусом (второй статус).

## DEC-8 — Bounded contexts, ports and adapters

- Domain (`TaskSyncService`, `StatusPolicy`, `TaskMapper`, `ConflictResolver`, `TransitionJournal`) — чистые функции и классы без I/O.
- Порты: `RegistryPort` (query/patch, authenticated), `ProjectionPort` (read/write projection), `SyncStatePort` (baseline, pending), `ClockPort`.
- Адаптеры: `McpRegistryClient` (HTTP MCP with bearer), `FileProjectionStore`, `JsonSyncStateStore`.
- Renderer не содержит правил маппинга и не знает про статусы корпуса — только IPC-контракт.

**Rationale:** SOLID по границам: SRP на преобразование/политику/мерж, OCP через контракт, ISP через узкие порты, DIP через инъекцию адаптеров; KISS — без event sourcing и очередей.
**Trade-off:** больше файлов, чем «один сервис, который всё делает».
**Alternatives:** логика в renderer (нельзя тестировать без Electron и утекают секреты); один god-service (нарушает SRP, не тестируется).

## DEC-9 — No fallback, fail closed

Любая операция, требующая корпуса, либо выполняется реестром, либо завершается ошибкой: `REGISTRY_UNAVAILABLE`, `CONTRACT_VERSION_MISMATCH`, `CONTRACT_UNAVAILABLE`, `TEAM_PROJECT_BINDING_MISSING`, `FIELD_OWNED_BY_SPEC`, `TASK_CREATE_REQUIRES_REGISTRY`, `TASK_REQUIREMENT_REQUIRED`, `STRUCTURED_TASK_OP_REQUIRED`, `STATUS_CONFLICT`, `CONFLICT`, `ADOPTION_NOT_SUPPORTED`, `FORBIDDEN_ROLE`, `UNAUTHENTICATED`. Запрещены: локальная очередь, «оффлайн-статус», оптимистичный UI, запись JSON в обход MCP, тихий retry с локальной фиксацией. teams использует аутентифицированный HTTP MCP; stdio-транспорт не несёт `ctx.role` и для teams запрещён.

`pending_projection` разрешён, потому что фиксирует уже подтверждённую каноническую запись и не повторяет её: это маркер восстановления проекции, а не очередь и не оптимистический статус. Он не может обслуживать чтение задачи как источник истины.

**Rationale:** fallback превращает централизацию в два источника правды и делает конфликт необнаружимым; отказ виден и обратим, расхождение — нет.
**Trade-off:** недоступность реестра останавливает работу с задачами (по решению — приемлемо).
**Alternatives:** outbox с последующей отправкой (дубли и порядок); read-only кэш (устаревшие статусы, ложные решения); pending как локальный статус (второй статус).

## DEC-10 — Legacy removal, no adoption

Первый запуск: архив `userData/backups/teams-tasks-<ts>/` с `tasks/`, `attachments/` и `manifest.json` (`path`, `sha256`, `size`), затем удаление `~/.claude/tasks/<team>`. Повторный запуск — no-op. Усыновление запрещено по построению: в UI и каталоге MCP-инструментов нет команды adopt, попытка adopt-операции возвращает `ADOPTION_NOT_SUPPORTED`, архив находится вне read-path приложения.

**Rationale:** 211 задач без требований и без трассировки не проходят FR-3; усыновление создало бы мусорный корпус и ложную историю.
**Trade-off:** архив включает вложения и может быть большим; блобы дедуплицируются по `sha256`.
**Alternatives:** массовое усыновление (мусор в корпусе); read-only legacy (второй режим, второй источник); архивировать только JSON задач (осиротевшие вложения).

## DEC-11 — Authority is authenticated; reviewer is process

Реестр — единственная точка enforcement ролей. `team.config` хранит `specProject` и маппинг `member -> registry login`; роли `owner`/`writer`/`reader` резолвятся реестром из групп IdP. `actor` в квитанции — аутентифицированный principal из bearer-токена; `actorRef` — корреляция, не доказательство. Reviewer — назначение процесса teams: он может ограничивать кнопку approve в UI, но не даёт роли в реестре; реестр всё равно проверяет роль и записывает аутентифицированного actor.

**Rationale:** одна политика вместо двух; авторство перехода нельзя подделать клиентским полем; reviewer остаётся процессным UX-фактом, а не вторым security boundary.
**Trade-off:** для агентской атрибуции нужны per-agent токены; один токен на команду даёт командную идентичность. Если reviewer должен быть единственным, кто может approve, это правило проверяется в teams до вызова, а реестр фиксирует фактического actor.
**Alternatives:** доверять `actorRef` (подделывается); роли в `team.config` (вторая политика, повышение прав); показывать только 403 без capabilities (плохой UX); сделать reviewer каноническим полем (меняет ownership FR-6).

## DEC-12 — Transition protocol: one record, expected status, pending projection

Каждый переход статуса описывается одной записью:

```json
{
  "requestId": "uuid",
  "taskId": "teams-task-sync:TASK-3",
  "from": "todo",
  "to": "in-progress",
  "actor": "alice",
  "at": "2026-10-29T12:00:00.000Z",
  "contentHashBefore": "sha256:...",
  "contentHashAfter": "sha256:..."
}
```

Правила:

1. `replace_task_status` требует `expectedStatus`; несовпадение — `STATUS_CONFLICT` с текущим статусом, без записи и события.
2. Успешный ответ содержит `transitions[]`; teams дописывает запись в `historyEvents` только после `outcome: APPLIED`.
3. Повтор с тем же `requestId` и payload возвращает сохранённый ответ; другой payload — `CONFLICT`. Дедупликация `requestId` сохраняется под write-lock, а не только в памяти процесса.
4. Если задача уже в целевом статусе, ответ — `unchanged`, новая запись истории не создаётся.
5. `pending_projection` пишется после квитанции и до обновления проекции; успех — `task_sync.projected`, сбой — `task_sync.projection_failed` и конфликт. Pending не повторяет каноническую запись.
6. Изменение статуса, обнаруженное синхронизацией без квитанции, получает синтетическое `status_changed`-событие без actor; `reviewState` пересчитывается.

**Rationale:** одна запись перехода вместо четырёх разных форм (receipt, history, pending, expectedStatus); история не дублируется при retry; проекция восстанавливается после падения.
**Trade-off:** появляется pending-состояние и персистентный dedupe; это ограниченная цена за восстановимость.
**Alternatives:** история в корпусе (markdown пухнет, merge-конфликты); без истории (теряется цикл review); только `requestId`-идемпотентность (теряется после рестарта); `expectedSha` на весь документ (слишком грубо для одной задачи).

## DEC-13 — Derived edges are computed, not stored twice

Проекция хранит максимум `Depends On` в одном направлении. `blockedBy` и `blocks` вычисляются при чтении/в query из канонических рёбер; обе стороны одного ребра не материализуются. `related` = `Refs`, `displayId` = `localId`, `subject`/`description` — из `title`/`body`. Инвалидация по `contentHash` не нужна, потому что нет второй копии.

**Rationale:** FR-6 запрещает derived-поля как независимую истину; две стороны ребра — классический источник расхождений.
**Trade-off:** чтение дороже; query обязан отдавать вычисленные поля.
**Alternatives:** хранить обе стороны (текущий дубль); хранить + инвалидировать по `contentHash` (сложность без выгоды); не отдавать зависимости вовсе (потеря блокировок).

## DEC-14 — Metrics belong to the component that owns the fact

Реестр экспортирует `spec_patch_latency_ms` и `spec_patch_conflict_total`; teams — `sync_pending_total`, `sync_pending_age_ms`, `sync_conflict_total`, `status_transition_e2e_ms`. Агрегаты доступны через `/health` (JSON) или аутентифицированный `/metrics`; новый MCP-инструмент не добавляется. NFR-PERF-1 измеряется end-to-end в teams; latency реестра — диагностическое плечо.

**Rationale:** реестр не знает про проекцию; один счётчик в реестре не измерит end-to-end NFR и будет создавать ложное чувство покрытия.
**Trade-off:** два health-эндпоинта вместо одного; зато каждый факт измеряется владельцем.
**Alternatives:** все метрики в реестре (слепое пятно на проекции); парсинг логов (хрупко, не p95); только трейсы (не заменяют счётчики).

## Conflict blast radius

| Конфликтующая поверхность | Что ломается при расхождении | Решение по DEC-7 | Проверка |
|---|---|---|---|
| Статус | канбан-колонка, счётчики, уведомления | spec wins + событие | SCEN-5, SCEN-6 |
| Владелец | маршрутизация сообщений и work-sync | spec wins + событие | SCEN-7 |
| Зависимости | блокировка задач, порядок выдачи работы | spec wins, `blockedBy` пересчитывается | SCEN-8 |
| Приёмка (`Done When`) | ревью и `done`-переход | spec wins, проекция только читает | SCEN-9 |
| Идентичность | дубли задач, потеря истории | детерминированный id исключает конфликт | SCEN-3 |
| Контракт | вся синхронизация | отказ при старте | SCEN-1, SCEN-2, SCEN-19 |
| Реестр недоступен | любая запись | fail-closed | SCEN-4 |
| Роль/actor | approve и владелец | реестр проверяет роль, actor из токена | SCEN-23 |
| Pending projection | доска показывает устаревший статус | pending + событие + ошибка | SCEN-20 |
| Вложения legacy | архив неполон, blob осиротел | архив с manifest | SCEN-24 |

Затронутые поверхности в teams: `team-task-detail`, `member-work-sync`, `stallMonitor`, `taskLogs`, `agent-graph`, уведомления о комментариях. В spec-kit: `src/kernel/*` (атрибуты задачи), `src/adapters/query-service.js`, `src/adapters/tool-contracts.js`, `src/authoring/proposals.js`, `src/authoring/service.js`, `src/mcp/server.js`, `src/service/auth.js`, `src/service/dispatch.js`.

## Authoring constraints discovered while validating this spec

| Правило | Причина | Проверка |
|---|---|---|
| Ссылки пишутся как `**Implements:** FR-1` без ведущего `- ` | сканер структурированных полей (`src/kernel/parsers/md-blocks.js:51`) не распознаёт bullet-форму и рёбра не создаются молча | SCEN-2, тест графа на `IMPLEMENTS`/`REFS`/`DEPENDS_ON` |
| `Status` пишется только каноническим словом (`todo` а не `pending`) | неизвестное слово нормализуется в `unknown` без ошибки | `tests/authoring-task-status.test.mjs` |
| В `Done When` нет `,` и `;` | значение режется на список по этим разделителям | проверка атрибутов задачи |
| `@id:SCEN-n` ставится на `Scenario`, не на `Feature` | иначе диагностика `MISSING_SCENARIO_ID` | `spec_catalog validation` |
| `@featureN` покрывает FR, `@AC-N.M` покрывает AC | `@FR-N` без namespace игнорируется | `spec_inspect coverage` |

Эти ограничения — workaround-ы уровня ядра, а не решения этой спецификации. Каноничный корпус не содержит файлов вне `.specs/<slug>/`, поэтому правила живут здесь; исправление парсера (bullet-форма ссылок, `@NFR-N`) отслеживается отдельно.
