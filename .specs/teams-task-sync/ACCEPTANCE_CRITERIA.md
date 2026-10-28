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
**Then:** узел задачи содержит `owner`, `tracking` и `contentHash`

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
**Then:** клиент вызывает `spec_patch: replace_task_status`
**And:** проекция обновляется только после успешного ответа реестра

## AC-4.2 — Direct status write is rejected

**Given:** задача с `Tracking`
**When:** агент вызывает `task_set_status` внутреннего MCP-инструмента teams
**Then:** операция маршрутизируется в реестр
**And:** прямой записи в JSON задачи не происходит

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
**And:** `blocks`/`blockedBy` не являются независимым источником: они пересчитываются из `Depends On`

## AC-7.1 — Kanban column follows status

**Given:** задача переведена в `ready`
**When:** открывается доска teams
**Then:** карточка находится в колонке review
**And:** `kanban-state.json` не содержит колонку как отдельный источник статуса

## AC-7.2 — Approved means done

**Given:** задача в колонке review
**When:** ревьюер нажимает approve
**Then:** в реестр записывается `done`
**And:** `reviewState` вычисляется как `approved`

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

## AC-10.1 — Legacy tasks are archived

**Given:** каталог `~/.claude/tasks/tokenplan-ops` с 211 файлами
**When:** синхронизация включается впервые
**Then:** создан архив `userData/backups/teams-tasks-<timestamp>.tar` с исходными файлами
**And:** каталог задач удалён

## AC-10.2 — Adoption is impossible

**Given:** архив legacy-задач существует
**When:** оператор пытается усыновить задачу из архива
**Then:** команда отсутствует
**And:** архив доступен только как файл вне приложения

## AC-11.1 — Contract is the only mapping source

**Given:** контракт `contracts/task-sync.contract.json`
**When:** любая сторона строит таблицу статусов или владения полями
**Then:** таблица сгенерирована из контракта
**And:** собственной копии таблицы в коде нет

## AC-11.2 — Contract version is enforced

**Given:** контракт версии `1`
**When:** teams запускается с контрактом версии `2`
**Then:** возвращается `CONTRACT_VERSION_MISMATCH`
**And:** синхронизация не запускается
