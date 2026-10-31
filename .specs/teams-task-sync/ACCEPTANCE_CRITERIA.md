# Acceptance Criteria

## AC-1.1 — Team is bound to a registry project

**Given:** команда teams `tokenplan-ops` без привязки к проекту реестра
**When:** оператор открывает доску задач
**Then:** доска показывает состояние ошибки `TEAM_PROJECT_BINDING_MISSING`
**And:** ни один файл задачи не создаётся и не читается

## AC-1.2 — Registry is the only task source

**Given:** команда привязана к проекту реестра
**When:** teams загружает список задач
**Then:** список получен из `spec_query`-ответа реестра
**And:** каталог `~/.claude/tasks/<team>` не читается как источник задач

## AC-2.1 — upsert_task creates a task with an explicit local id

**Given:** спецификация `teams-task-sync` существует в корпусе
**When:** клиент вызывает `spec_patch` с операцией `upsert_task` для `localId: "TASK-20"`
**Then:** документ `TASKS.md` содержит узел `TASK-20` с полями `Status`, `Owner`, `Implements`
**And:** повторный вызов с теми же полями не создаёт дубль и возвращает `unchanged`

## AC-2.2 — Structured operations reject free-form markdown

**Given:** клиент передаёт `insert_at_eof` с телом задачи вместо `upsert_task`
**When:** операция адресована документу `TASKS.md`
**Then:** возвращается `INVALID_REQUEST` с указанием `STRUCTURED_TASK_OP_REQUIRED`
**And:** документ не изменяется

## AC-2.3 — Board exposes owner, tracking and content hash

**Given:** задача с `Owner: KASSA_BILLING_OWNER` и `Tracking: agent-teams:tokenplan-ops/<uuid>`
**When:** клиент запрашивает `spec_query` board view
**Then:** узел задачи содержит `owner`, `tracking`, `contentHash`, `dependsOn`, `blocks` и `blockedBy`

## AC-2.4 — Structured link operations replace task refs

**Given:** задача `TASK-5` без зависимостей
**When:** клиент вызывает `spec_patch: replace_task_links` с `Depends On: TASK-2`
**Then:** `TASKS.md` содержит `Depends On: TASK-2` у `TASK-5`
**And:** повторный вызов с тем же набором возвращает `unchanged`
**And:** свободный текст в поле ссылок отклоняется с `INVALID_REQUEST`

## AC-3.1 — Task creation without registry is rejected

**Given:** реестр недоступен
**When:** пользователь создаёт задачу в UI teams
**Then:** возвращается `TASK_CREATE_REQUIRES_REGISTRY`
**And:** файл задачи не создаётся
**And:** UI показывает блокирующую ошибку, а не локальную задачу

## AC-3.2 — Created task must trace to a requirement

**Given:** реестр доступен, в спецификации есть `FR-1`
**When:** создаётся задача без `Implements`
**Then:** возвращается `TASK_REQUIREMENT_REQUIRED`
**And:** задача не создаётся

## AC-4.1 — Status change is written to the registry first

**Given:** задача `TASK-3` в статусе `todo`
**When:** пользователь переводит её в `in-progress`
**Then:** клиент вызывает `spec_patch: replace_task_status` с `expectedStatus: "todo"`
**And:** успешный ответ содержит квитанцию перехода с `from`, `to`, `actor`, `at`, `requestId`
**And:** проекция обновляется только после успешного ответа реестра
**And:** `historyEvents` получает ровно одно событие перехода

## AC-4.2 — Direct status write is rejected

**Given:** задача с `Tracking`
**When:** агент вызывает `task_set_status` внутреннего MCP-инструмента teams
**Then:** операция маршрутизируется в реестр
**And:** прямой записи в JSON задачи не происходит

## AC-4.3 — Repeated status change is idempotent

**Given:** успешный переход с `requestId: "R1"` из `todo` в `in-progress`
**When:** тот же запрос с `R1` повторяется
**Then:** возвращается тот же ответ и квитанция
**And:** второго события в `historyEvents` не появляется
**And:** новый `requestId` при уже целевом статусе возвращает `unchanged` без события

## AC-4.4 — Stale expected status is rejected

**Given:** задача `TASK-3` в статусе `todo`
**When:** клиент отправляет `expectedStatus: "ready"` и целевой статус `done`
**Then:** возвращается `STATUS_CONFLICT` с текущим статусом `todo`
**And:** документ не изменяется и событие не создаётся

## AC-5.1 — Deterministic id

**Given:** `projectId: "tokenplan"`, `specSlug: "teams-task-sync"`, `localId: "TASK-3"`
**When:** проекция создаётся дважды, в том числе после удаления каталога задач
**Then:** оба раза получен один и тот же `id`
**And:** идентификатор равен UUIDv5 от строки `tokenplan/teams-task-sync/TASK-3`

## AC-5.2 — No identifier mapping table

**Given:** код teams и spec-kit
**When:** выполняется поиск соответствий идентификаторов
**Then:** таблица соответствий отсутствует
**And:** соответствие вычисляется из `Tracking` и namespace

## AC-6.1 — Canonical fields are read-only in teams

**Given:** задача с `Tracking`
**When:** teams пытается изменить `subject`, `status`, `owner` или `Depends On` локально
**Then:** возвращается `FIELD_OWNED_BY_SPEC`
**And:** значение в проекции не изменяется

## AC-6.2 — Derived fields are not stored as truth

**Given:** задача `TASK-3` со статусом `in-progress`
**When:** файл проекции читается напрямую
**Then:** `displayId` равен `TASK-3`, `subject` совпадает с заголовком корпуса
**And:** проекция хранит максимум `Depends On`; `blocks` и `blockedBy` пересчитываются из канонических рёбер

## AC-6.3 — reviewState is derived on the teams side

**Given:** задача в статусе `ready` и в `historyEvents` есть `review_requested`
**When:** проекция читается
**Then:** `reviewState` равен `review`
**And:** в корпусе нет поля `reviewState`
**And:** назначение `reviewer` не даёт прав в реестре

## AC-7.1 — Kanban column follows status

**Given:** задача переведена в `ready`
**When:** открывается доска teams
**Then:** карточка находится в колонке review
**And:** `kanban-state.json` не содержит колонку как отдельный источник статуса

## AC-7.2 — Approved means done

**Given:** задача в колонке review и reviewer назначен
**When:** ревьюер с ролью writer нажимает approve
**Then:** в реестр записывается `done`
**And:** квитанция содержит аутентифицированного actor
**And:** `reviewState` вычисляется как `approved`

## AC-7.3 — Request changes returns the task to work

**Given:** задача в колонке review
**When:** ревьюер нажимает request changes
**Then:** в реестр записывается `in-progress`
**And:** `historyEvents` получает `review_changes_requested`
**And:** `reviewState` вычисляется как `needsFix`

## AC-8.1 — Fail-closed on registry outage

**Given:** реестр отвечает тайм-аутом
**When:** пользователь меняет статус задачи
**Then:** операция завершается `REGISTRY_UNAVAILABLE`
**And:** проекция сохраняет прежний статус
**And:** отложенная очередь не создаётся

## AC-8.2 — Contract version mismatch blocks startup

**Given:** версия контракта в teams не равна версии в реестре
**When:** teams стартует
**Then:** синхронизация отключена с `CONTRACT_VERSION_MISMATCH`
**And:** операции с задачами отклоняются до устранения расхождения

## AC-8.3 — Missing contract blocks startup

**Given:** реестр доступен, но не отдаёт sync-контракт
**When:** teams стартует
**Then:** синхронизация отключена с `CONTRACT_UNAVAILABLE`
**And:** операции с задачами отклоняются
**And:** локальный файл задачи не создаётся

## AC-9.1 — Spec wins on triple divergence

**Given:** снапшот фиксирует `todo`, корпус содержит `done`, проекция содержит `in-progress`
**When:** выполняется синхронизация
**Then:** побеждает `done`
**And:** генерируется событие `task_sync.conflict` с обоими значениями

## AC-9.2 — No silent overwrite

**Given:** любое расхождение корпуса и проекции
**When:** синхронизация применяет решение
**Then:** событие с решением записано до применения
**And:** при отсутствии события изменение не выполняется

## AC-9.3 — Pending projection is recorded and bounded

**Given:** реестр подтвердил переход `todo -> ready`
**When:** запись проекции завершается ошибкой
**Then:** до обновления проекции записан `pending_projection`
**And:** отправлено событие `task_sync.projection_failed`
**And:** доска показывает ошибку, а не локальный статус
**And:** очередь и оптимистический статус не создаются
**And:** повторное применение канонического `ready` закрывает pending и очищает его

## AC-10.1 — Legacy tasks are archived

**Given:** каталог `~/.claude/tasks/tokenplan-ops` с 211 файлами
**When:** синхронизация включается впервые
**Then:** создан архив `userData/backups/teams-tasks-<timestamp>/` с исходными файлами
**And:** создан `manifest.json` с `path`, `sha256`, `size` для каждого файла
**And:** каталог задач удалён

## AC-10.2 — Adoption is impossible

**Given:** архив legacy-задач существует
**When:** оператор ищет adopt в UI или вызывает adopt-операцию через MCP
**Then:** в UI нет команды adopt, а вызов возвращает `ADOPTION_NOT_SUPPORTED` или `UNKNOWN_TOOL`
**And:** задача в корпусе не создаётся
**And:** архив не читается приложением как источник задач

## AC-10.3 — Attachments are archived with tasks

**Given:** legacy-задача со вложением в `userData/attachments/<team>/<messageId>/`
**When:** синхронизация включается впервые
**Then:** архив содержит файл вложения
**And:** `manifest.json` содержит его `path`, `sha256`, `size`
**And:** повторный запуск не создаёт второй архив и не теряет вложение

## AC-11.1 — Contract is the only mapping source

**Given:** контракт `contracts/task-sync.contract.json`
**When:** любая сторона строит таблицу статусов, владения полями или кодов ошибок
**Then:** таблица сгенерирована из контракта
**And:** собственной рукописной копии таблицы в коде нет

## AC-11.2 — Contract version is enforced

**Given:** контракт версии `1`
**When:** teams запускается с контрактом версии `2`
**Then:** возвращается `CONTRACT_VERSION_MISMATCH`
**And:** синхронизация не запускается

## AC-11.3 — Contract hash is enforced

**Given:** контракт версии `1` с hash `A`
**When:** реестр отдаёт версию `1` с hash `B`
**Then:** возвращается `CONTRACT_VERSION_MISMATCH`
**And:** синхронизация не запускается
**And:** `mcp_preflight` и `spec_catalog` (view `contract`) отдают одну и ту же пару `version`/`sha256`

## AC-12.1 — Actor is the authenticated principal

**Given:** writer-токен с login `alice` и `actorRef: "bob"` в запросе
**When:** выполняется `replace_task_status`
**Then:** квитанция содержит `actor: "alice"`
**And:** `actorRef` не используется для авторизации и не подменяет `actor` в истории

## AC-12.2 — Roles are enforced by the registry

**Given:** токен с ролью reader
**When:** клиент вызывает `replace_task_status`
**Then:** возвращается `FORBIDDEN_ROLE` (HTTP 403)
**And:** документ не изменяется
**And:** UI может заранее отключить контрол по capabilities, но enforcement остаётся на реестре

## AC-12.3 — Team mapping does not grant roles

**Given:** `team.config` маппит участника `bob` на registry login `bob`
**And:** у `bob` роль reader
**When:** `bob` назначен reviewer и нажимает approve
**Then:** approve отклоняется с `FORBIDDEN_ROLE`
**And:** назначение reviewer само по себе не даёт прав

## AC-13.1 — Sync metrics are exposed by owner

**Given:** инжектирован сбой записи проекции
**When:** синхронизация обрабатывает переход
**Then:** `sync_pending_total` увеличивается, `sync_pending_age_ms` фиксируется, `sync_conflict_total` увеличивается
**And:** `status_transition_e2e_ms` измеряется в teams, `spec_patch_latency_ms` — в реестре
**And:** агрегаты доступны через `/metrics`
**And:** новый MCP-инструмент не появляется, текст задач и секреты в метрики не попадают
