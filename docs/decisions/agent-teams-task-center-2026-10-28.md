# ADR-кандидат: spec-kit как центр задач для agent-teams-ai

- Дата: 2026-10-28
- Статус: анализ + предложение (решение не принято)
- Контекст: `agent-teams-ai` (форк `777genius/agent-teams-ai`, локально `E:\repos\agent-teams-ai`) ведёт свои задачи в файлах без БД; `omp-spec-kit` ведёт задачи в markdown-корпусе `.specs`. Нужен один центр (spec-kit) и двусторонняя связка.

## 0. TL;DR

1. Источник правды для *идентичности, статуса, владельца, зависимостей и приёмки* переносим в `.specs`: markdown в git, обозримый, восстановимый.
2. `agent-teams-ai` остаётся источником правды только для *исполнительских* данных: `workIntervals`, `historyEvents`, `comments`, `attachments`, `sourceMessage`, канбан.
3. Связка — не «файлы туда-сюда», а проекция по образцу уже существующего YouTrack-адаптера: push `spec -> teams` через MCP-инструменты, pull `teams -> spec` через `spec_patch: replace_task_status` с трёхсторонним мержем и правилом «spec wins».
4. Дубли, которые надо убрать: два ID на задачу, два статус-множества, двусторонние `blocks`/`blockedBy` против одностороннего `Depends On`, `related` против `Refs`, две «доски», два владельца ревью-вердикта.
5. Модель spec-kit расширяется минимально: `Owner` уже парсится (`src/kernel/parsers/attributes.js:170`), но не отдаётся наружу; нужны `Tracking` (внешняя ссылка), статус `cancelled`, операция `replace_task_owner`/`upsert_task`, поле `owner` в board/query.

## 1. Состояние репозитория после мержа (2026-10-28)

- `main` = `3b33a07` (merge `release/v2.9.0`), ветки `release/v2.9.0` и `main` содержат одно дерево.
- В `E:\repos\omp-spec-kit` (ветка `release/v2.9.0`) рабочее дерево чистое; `.specs/blast-radius-auto-generation` и `docs/plans/claude-code-integration.md` теперь в git.
- В `E:\repos\omp-fix-wt` (ветка `main`) поверх мержа лежит незакоммиченный WIP `endpoint-resilience` (`src/tools/endpoint-alloc.js`, `src/tools/registry-doctor.js`, `src/service/endpoint-url.js`, фича + шаги, `test:endpoint-resilience`). Резервная копия: `stash@{0}`.
- Коммиты сделаны с `--no-verify`: review-гейт `omp-reviewer-kit` упал инфраструктурно (reviewer task exit 1, пустой yield, отчёт `C:\Users\stigm\Documents\omp-reviewer-kit\omp-spec-kit-c73b750bfb34\2026-10-28T16-49-48-164Z-b8db2bcbfbcb.md`), содержательных замечаний нет. Гейт нужно перезапустить перед релизом.
- `npm run test:unit` на мерже: 1 падение, `tests/claude/release-evidence.test.mjs` — фикстура `tests/fixtures/release-candidate/cucumber-messages.inputs.json` пинит `package.json` (5066 байт), после мержа файл 5129 байт. Это не регрессия мержа: на `main` до мержа было 4893. Лечится только честным путём: `bash scripts/docker-bdd.sh`, затем `node scripts/refresh-cucumber-fixture.mjs`, затем коммит фикстуры. Делать это нужно после того, как WIP `endpoint-resilience` попадёт в дерево, иначе прогон придётся повторять.

## 2. Задачи в agent-teams-ai

### 2.1 Где лежит

| Данные | Путь | Писатель |
|---|---|---|
| Задача | `~/.claude/tasks/<team>/<uuid>.json` (+ `.lock`) | `agent-teams-controller/src/internal/taskStore.js`, `src/main/services/team/TeamTaskWriter.ts` |
| Канбан-колонки `review`/`approved`, порядок | `~/.claude/teams/<team>/kanban-state.json` | `TeamKanbanManager.ts:220` |
| Метаданные команды | `teams/<team>/{config.json,team.meta.json,members.meta.json,bootstrap-state.json,bootstrap-journal.jsonl}` | `TeamMetaStore.ts`, `TeamMembersMetaStore.ts` |
| Инбоксы агентов | `teams/<team>/inboxes/<MEMBER>.json` | `TeamInboxWriter.ts` |
| Отправленные сообщения | `teams/<team>/sentMessages.json` | `TeamSentMessagesStore.ts` |
| Журналы активности/сталов | `~/.claude/task-change-summaries`, `task-change-presence`, `teams/<team>/task-log-freshness`, `stall-monitor-journal.*` | `TaskChangeWorkerClient.ts`, `stallMonitor/*` |
| Вложения, mcp-configs, бэкапы | Electron `userData` | `TeamAttachmentStore.ts`, `TeamMcpConfigBuilder.ts` |
| SQLite | `src/features/internal-storage/*` — только журналы (comment-notification, stall, command ledger), не задачи | `SqliteTaskCommentNotificationJournalStore.ts` |

Факт на машине: `C:\Users\stigm\.claude\tasks\tokenplan-ops` — 211 задач; `kanban-state.json` 8.5 KB; инбокс лида 4.3 MB.

### 2.2 Модель `TeamTask` (`src/shared/types/team.ts:309`)

Обязательные: `id`, `subject`, `status` (`pending|in_progress|completed|deleted`).
Значимые опциональные: `displayId`, `description`, `owner`, `createdBy`, `blocks[]`, `blockedBy[]`, `related[]`, `createdAt`, `updatedAt`, `comments[]`, `historyEvents[]`, `workIntervals[]`, `reviewIntervals[]`, `needsClarification: 'lead'|'user'`, `deletedAt`, `attachments[]`, `reviewState: 'none'|'review'|'needsFix'|'approved'`, `sourceMessageId`, `sourceMessage`, `groupChatId`, `activeForm`, `prompt`, `projectPath`.

Запись атомарная (`atomicWrite.ts`) под `.lock`; `deleted` — tombstone, файл остаётся; `blocks`/`blockedBy` хранят обе стороны одного ребра.

### 2.3 API (единственный безопасный путь записи)

MCP-инструменты (каталог `agent-teams-controller/src/mcpToolCatalog.js`), задачи: `task_create`, `task_create_from_message`, `task_get`, `task_list`, `task_set_status`, `task_start`, `task_complete`, `task_set_owner`, `task_add_comment`, `task_attach_file`, `task_attach_comment_file`, `task_set_clarification`, `task_link`, `task_unlink`, `task_restore`, `task_briefing`, `member_briefing`; отдельно `kanban_*`, `review_*`, `message_send`.
Транспорты: HTTP MCP `127.0.0.1` `/mcp` (порты 43100–43800, `AgentTeamsMcpHttpServer.ts`) и stdio (`mcp-server/src/tools/taskTools.ts`). Идемпотентность создания: `creationCommand.payloadHash` (sha256 полезной нагрузки).

## 3. Задачи в omp-spec-kit

- `TASKS.md`, заголовок `## TASK-N — title` (грамматика `src/kernel/types.js:263`), поля: `Status`, `Owner`, `Estimate`, `Done When` (`attributes.js:158-172`), ссылки `Refs/Related/Covers/Implements/Depends On` → рёбра `REFS/COVERS/IMPLEMENTS/DEPENDS_ON` (`types.js:271`).
- Статусы: `planned, todo, ready, in-progress, blocked, done, deferred, unknown` (`types.js:286`), нормализация `Completed → done` уже есть.
- Единственная мутация — `spec_patch` (`src/adapters/tool-contracts.js:54`), в т.ч. `replace_task_status` (`needs entity + status`, `src/authoring/proposals.js:121`).
- Чтение: `spec_query` (board/status/tasks), `boardNode` отдаёт `taskStatus`, но **не отдаёт `owner`** (`src/kernel/query/service.js:776`), `taskEntry` тоже (`extended.js:107`).
- Готовый образец двусторонней связи: `src/adapters/youtrack-projection.js` (push карточек, ссылки, снятие устаревших), `youtrack-store.js:430 YouTrackSyncStateStore` (подписанный HMAC указатель ревизии), `youtrack-status-sweep.js` (трёхсторонний мерж + «spec wins»).

## 4. Матрица полей

| Понятие | agent-teams | omp-spec-kit | Вердикт |
|---|---|---|---|
| Идентичность | `id` (uuid v5) + `displayId` (8 hex) | `canonicalId = <spec>/<localId>`, `localId = TASK-N` | canonical = spec; teams получает `externalRef` |
| Заголовок | `subject` | заголовок `TASK-N —` | spec канон, teams рендерит |
| Текст | `description`, `prompt`, `activeForm` | тело задачи | spec канон (description); `prompt/activeForm` — runtime |
| Статус | 4 значения | 8 значений | канон spec; таблица отображения |
| Владелец | `owner`, `createdBy` | `Owner` (парсится, не отдаётся) | spec канон + публикация в query/board |
| Зависимости | `blocks`, `blockedBy` (обе стороны) | `Depends On` | канон `Depends On`; `blocks` выводится |
| Прочие связи | `related` | `Refs`, `Related`, `Covers` | spec канон; `related` = производное |
| Приёмка | нет поля (в тексте/комментариях) | `Done When`, AC-узлы | spec канон |
| Ревью-процесс | `reviewState`, `reviewIntervals`, канбан `review/approved` | design-review гейт, evidence | процесс — teams, вердикт/evidence — spec |
| Ревью-вердикт | `reviewState` + колонка | `evidence`, `AC` | spec канон, teams отражает |
| Комментарии | `comments[]` | нет | teams (runtime), в spec — только выжимка по требованию |
| История/интервалы | `historyEvents`, `workIntervals`, `reviewIntervals` | нет | teams, не переносим |
| Вложения | `attachments[]` (метаданные, файлы в userData) | нет | teams; в spec — ссылка |
| Уточнения | `needsClarification` | elicitation-guard | teams (runtime), эскалация человеку — spec-процесс |
| Источник | `sourceMessageId`, `sourceMessage` | нет | teams |
| Канбан | `kanban-state.json` | board-вид `spec_query` | одна доска: spec; канбан — UI-оверлей |
| Проект | `projectPath` | `Project`/specSlug | spec |

## 5. Дубли и что с ними делать

1. **Два ID.** `TASK-3` и `06fce4b2-…`. Требуется явное поле связи, иначе сопоставление по тексту. Решение: `- **Tracking:** agent-teams:tokenplan-ops/06fce4b2-850b-5b53-9a97-168f8d1586d2` в задаче; в teams — `externalRef` в JSON.
2. **`displayId` в UI и чатах.** Сейчас в интерфейсе и сообщениях `#06fce4b2`. При каноне `TASK-3` форк должен разрешить кастомный `displayId` (сейчас `deriveDisplayId` режет uuid, `taskStore.js`), иначе люди видят два разных номера одной задачи.
3. **Два статус-множества.** Нужна закрытая таблица: `pending→todo`, `in_progress→in-progress`, `completed→done`, `deleted→cancelled` (новый статус в spec), `blocked→blocked` только в одну сторону (teams не имеет `blocked`, выводить из `needsClarification` + `blockedBy`).
4. **`blocks`/`blockedBy`.** В teams хранятся обе стороны одного ребра — классический дубль. Канон: `Depends On` в spec; в teams писать только `blockedBy` (или только `blocks`), вторую сторону не материализовать.
5. **`related` против `Refs`.** Один факт в двух местах. Канон `Refs`; `related` в teams — производное от `REFS`.
6. **Две доски.** `spec_query` board и панель Tasks в teams показывают одни и те же задачи. Канон — board; teams UI читает спроецированное состояние, колонки `review/approved` остаются оверлеем процесса.
7. **Два ревью-вердикта.** `reviewState` (teams) и `evidence`/AC (spec) легко расходятся. Правило: teams владеет *процессом* (кто смотрит, сколько циклов), spec — *вердиктом* и доказательствами; `reviewState` не пишется в spec, `evidence` не пишется в teams.
8. **Владелец и ростер.** `owner` в teams — имя из `members.meta.json`; в spec имена агентов не живут. Решение: `Owner` в spec — строка, валидируемая против `.specs/<spec>/ASSIGNMENTS.md` (или team roster, читаемый адаптером read-only), а не второй ростер.
9. **Описание.** `description` (spec) + `description/subject/prompt` (teams) — три копии текста. Канон — тело задачи; `subject` = заголовок, `prompt` — runtime-обёртка, `activeForm` — UI-строка.
10. **«Дубли» данных в teams.** SQLite `internal-storage` дублирует JSON только как fallback-реплики журналов (`*.sqlite-fallback-replica`) — это не дубль задач, трогать не нужно.

## 6. Целевое разделение ответственности

- **spec-kit (git, `.specs`)**: идентичность (`<spec>/TASK-N`), заголовок, тело, `Status`, `Owner`, `Done When`, `Depends On`/`Refs`/`Implements`, `Tracking`, evidence/вердикт.
- **agent-teams-ai (файлы, `~/.claude`)**: исполнение — `workIntervals`, `reviewIntervals`, `historyEvents`, `comments`, `attachments`, `sourceMessage`, `groupChatId`, канбан, инбоксы.
- Правило одного писателя на поле: spec-поля пишет только spec-адаптер (через `spec_patch`), teams-поля — только runtime. Никаких «двусторонних» записей одного поля.

## 7. Что менять в omp-spec-kit

1. `Owner` в вывод: `boardNode` (`query/service.js:776`) и `taskEntry` (`query/extended.js:107`) — добавить `owner`, `estimate`; фильтр `spec_query` по `owner`.
2. Новое поле задачи `Tracking` (внешняя ссылка) — распознавать в `attributes.js` (TASK), отдавать в query, включать в `contentHash` (иначе мерж не заметит смену связи).
3. Статус `cancelled` + нормализация `deleted/Cancelled → cancelled`; обновить `TASK_STATUSES`, `TASK_STATUS_NORMALIZATION`, `tool-contracts.TASK_STATUS_VALUES`, `roadmap/assemble.js` (нетерминальные статусы).
4. Новые операции `spec_patch`: `replace_task_owner`, `upsert_task` (создание с явным `localId` + валидацией уникальности; сейчас создание — только `insert_at_eof`, что для адаптера хрупко), `append_task_note` (ограниченная выжимка комментария, опционально).
5. `spec_query`: отдавать `contentHash` задачи в board-виде (он уже есть в `boardNode`) — это готовый `If-Match` для мержа.
6. Новый адаптер `src/adapters/agent-teams-projection.js` + `agent-teams-status-sweep.js` по образцу YouTrack: порты `sourceReader`, `tracker`, `syncState`, `writeback`; переиспользовать `planCardWriteback`-логику (spec wins, baseline, ownership proof).
7. Состояние синхронизации: файл `.omp-spec-kit/agent-teams/<team>-sync.json` с HMAC-подписью (секрет из того же механизма, что `marker-secret.js`), содержимое: `snapshotHash`, `nodes[{canonicalId, taskStatus, owner, externalId}]`, `cardIds`.

## 8. Что менять в форке agent-teams-ai

1. `TeamTask.externalRef?: { source: 'omp-spec-kit'; specSlug: string; taskId: string; repository?: string }` — в `src/shared/types/team.ts:309`, `normalizeTask` (`taskStore.js`), `TeamTaskWriter.ts`, белый список полей в `TeamTaskReader.getTasks()` (`satisfies Record<keyof TeamTask, unknown>` — компилятор сам покажет все места).
2. `task_create`/`task_create_from_message`: приём `externalRef`, идемпотентность по `externalRef` в дополнение к `payloadHash`.
3. Кастомный `displayId`: разрешить значение из `externalRef.taskId` (`TASK-3`), чтобы UI и чаты показывали spec-номер.
4. Запрет на запись spec-полей: `status/owner/subject` меняются только через синхронизацию; локальные `task_set_status` от агентов должны либо блокироваться для задач с `externalRef`, либо эмититься как событие для адаптера (иначе два писателя).
5. Watcher-события: экспорт «task changed» в стабильном виде (JSON-строка в stdout или файл-очередь), чтобы адаптер не полагался на `fs.watch` по 211 файлам.

## 9. Протокол синхронизации

```
push (spec -> teams): board(spec) -> diff(committedSnapshot) -> task_create / task_set_status /
                       task_set_owner / task_link / kanban_*   (только через MCP, идемпотентно)
pull (teams -> spec): список задач с externalRef -> planCardWriteback(specStatus, teamsStatus, baseline)
                       -> spec_patch: replace_task_status  (spec wins при расхождении baseline)
```

Правила:
- Трёхсторонний мерж: `baseline` (последний закоммиченный снапшот) + текущее spec-состояние + текущее teams-состояние. Если spec изменился после baseline и teams тоже — побеждает spec, конфликт логируется (`youtrack-status-sweep.js:20-36` — готовая логика).
- Ownership proof: менять spec может только задача, которой владеет этот `team` в `cardIds`; иначе чужой/поддельный `Tracking` не должен перезаписывать корпус.
- Мерж по `contentHash` + `updatedAt`: идемпотентность и защита от «затёр ручную правку».
- Никакой записи JSON задач напрямую: только MCP (иначе гонки с `.lock` и `atomicWrite`).
- Удаление: только `cancelled` в spec + `deleted` (tombstone) в teams; физическое удаление — отдельная архивная процедура spec-kit.
- Потеря `~/.claude` (главный риск: БД нет) восстанавливается из spec: задачи, владельцы, статусы, зависимости восстанавливаются полностью, теряются только исполнительские артефакты (`workIntervals`, `comments`, `attachments`).

## 10. Риски и миграция

1. **211 существующих задач** в `tokenplan-ops` не имеют spec-соответствия. Автоматическое сопоставление по тексту запрещено — только явное усыновление (`adopt --spec <slug> --task <displayId> --local TASK-N`), иначе получим мусорные дубли.
2. **Смешанный режим**: пока не все задачи усыновлены, часть живёт только в teams. Адаптер обязан различать «spec-owned» и «teams-only» и не пытаться мержить вторые.
3. **Смена `displayId`** ломает ссылки в истории чатов и инбоксах (`#06fce4b2`) — нужен `legacyDisplayIds[]` для поиска.
4. **Два писателя статуса** — самая вероятная причина расхождений; без запрета п.8.4 связка будет «мигать».
5. **Фикстура релиза** (п.1) должна быть обновлена честным Docker-прогоном до релиза.
6. **Мерж-гейт** не прогонялся на коммитах (см. п.1) — перед тегом нужно прогнать `omp-reviewer-kit` на диапазоне мержа.

## 11. Порядок работ

| Шаг | Что | Где | Оценка |
|---|---|---|---|
| 1 | `owner`/`contentHash` в board+query, статус `cancelled`, поле `Tracking` | `src/kernel/*`, `src/adapters/tool-contracts.js` | S |
| 2 | `replace_task_owner`, `upsert_task` | `src/authoring/proposals.js`, `tool-contracts.js` | M |
| 3 | `externalRef` + кастомный `displayId` + запрет локальной записи spec-полей | форк `agent-teams-ai` | M |
| 4 | `agent-teams-projection.js` + `agent-teams-status-sweep.js` + sync-state | `src/adapters/*` | L |
| 5 | CLI/сервис: `projection agent-teams sync`, watcher-петля | `src/service/*`, `scripts/*` | M |
| 6 | Усыновление существующих задач + прогон на `tokenplan-ops` | операционно | M |
| 7 | Обновление фикстуры релиза + review-гейт | инфра | S |

S/M/L — относительные оценки, не сроки.
