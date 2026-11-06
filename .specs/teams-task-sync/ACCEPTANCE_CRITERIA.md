# Acceptance Criteria

## AC-1.1 — Team is bound to a registry project

**Given:** команда teams `tokenplan-ops` без привязки к проекту реестра
**When:** оператор открывает доску задач
**Then:** доска показывает состояние ошибки `TEAM_PROJECT_BINDING_MISSING`
**And:** ни один файл задачи не создаётся и не читается

## AC-1.2 — Registry is the only task source
**Given:** команда привязана к проекту реестра
**When:** teams загружает список задач
**Then:** список получен из ответа реестра
**And:** каталог `~/.claude/tasks/<team>` не читается как источник общих задач; личные задачи участника и их собственные данные остаются доступными
**And:** локальное хранилище содержит только исполнительские поля под детерминированным идентификатором
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
**And:** файл общей задачи не создаётся
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
**When:** teams пытается изменить `subject`, `status`, `owner` или `Depends On` без вызова реестра
**Then:** возвращается `FIELD_OWNED_BY_SPEC`
**And:** локальное хранилище не содержит копии канонического поля
## AC-6.2 — Derived fields are not stored as truth
**Given:** задача `TASK-3` со статусом `in-progress`
**When:** доска запрашивает задачу из реестра
**Then:** `displayId` равен `TASK-3`, `subject` совпадает с заголовком корпуса
**And:** `blocks` и `blockedBy` вычисляются из канонических рёбер на стороне реестра, а не хранятся в teams
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
**And:** доска показывает ошибку и не сохраняет локальный канонический статус
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
**Covers:** FR-9

**Given:** клиент прочитал todo, в реестре задача стала done, а пользователь предлагает in-progress
**When:** отправляется запрос с устаревшей ожидаемой версией
**Then:** запись отклоняется с конфликтом и в реестре остаётся done
**And:** пользователь видит текущее и своё предлагаемое значение, а событие не содержит полного текста задачи

## AC-9.2 — No silent overwrite
**Covers:** FR-9

**Given:** ожидаемое состояние запроса не совпадает с состоянием реестра
**When:** реестр отклоняет изменение
**Then:** до ответа фиксируется событие конфликта с идентификатором задачи и поля без полного текста
**And:** никакой локальной канонической записи или очереди не создаётся

## AC-9.3 — Pending projection is recorded and bounded
**Covers:** FR-9

**Given:** реестр подтвердил переход todo в ready и вернул квитанцию
**When:** не удалось сохранить локальную историю или перечитать задачу
**Then:** маркер восстановления и ошибка видимы, а локальный статус и очередь не создаются
**And:** повторное восстановление добавляет квитанцию не более одного раза и перечитывает реестр

## AC-10.1 — Legacy tasks are archived

**Given:** каталог `~/.claude/tasks/tokenplan-ops` с 211 файлами
**When:** синхронизация включается впервые
**Then:** создан архив `userData/backups/teams-tasks-<timestamp>/` с исходными файлами
**And:** создан `manifest.json` с `path`, `sha256`, `size` для каждого файла
**And:** архив проверен и каталог удалён только если доказано, что он не содержит личных задач; при неопределённости удаление остановлено с ошибкой

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


## AC-14.1 — Personal tasks remain available

**Covers:** FR-14

**Given:** у тимлида и участника есть личные встроенные задачи, а команда связана с реестром
**When:** оба используют свои обычные личные инструменты задач
**Then:** личные задачи доступны и сохраняются без требования связи со спецификацией
**And:** они не появляются как общие задачи на доске и не записываются в корпус

## AC-14.2 — Migration preserves personal tasks

**Covers:** FR-14

**Given:** рядом со старыми общими задачами находятся личные задачи участника
**When:** выполняется миграция старой общей доски
**Then:** личные задачи и их содержимое сохраняются и остаются доступны участнику
**And:** если безопасно отделить данные невозможно, удаление не выполняется и пользователь видит ошибку

## AC-15.1 — Multiple specifications on one team board

**Covers:** FR-15

**Given:** одна команда связана со спецификациями A и B одного разрешённого проекта, в каждой есть TASK-1 с разным содержимым
**When:** открывается доска и запрашиваются детали обеих задач
**Then:** на доске присутствуют обе задачи с правильными project, spec и localId
**And:** изменение, комментарии и вложения одной задачи не присваиваются другой

## AC-15.2 — Lead-created specification is linked to the team

**Covers:** FR-15

**Given:** тимлид запущенной команды с правом записи создаёт новую спецификацию через MCP spec-kit в контексте этой команды
**When:** создание подтверждено и в спецификации создана общая задача с требованием
**Then:** связь новой спецификации с этой командой сохранена и задача появляется на её доске
**And:** другая команда не получает эту привязку автоматически

## AC-15.3 — Direct MCP task appears on board without duplication

**Covers:** FR-15

**Given:** спецификация связана с командой и содержит требование FR-1
**When:** разрешённый участник создаёт TASK-8 через MCP spec-kit в этой спецификации
**Then:** доска и MCP teams показывают именно TASK-8 из той же спецификации
**And:** в реестре есть одна задача, а не вторая копия после обновления доски

## AC-16.1 — Lead creates and authors a specification

**Covers:** FR-16

**Given:** тимлид команды имеет право создания в выбранном проекте
**When:** он через штатный MCP spec-kit создаёт поддерживаемую спецификацию и наполняет её требование
**Then:** спецификация и требование читаются через MCP из выбранного проекта
**And:** создание каркаса не выдаётся за заполненную и принятую спецификацию

## AC-16.2 — Shared task needs an existing same-spec requirement

**Covers:** FR-16

**Given:** запрос создания общей задачи поступает из интерфейса, MCP teams или напрямую из MCP spec-kit
**When:** спецификация отсутствует, недоступна или не указана, либо ссылка на требование пуста, неоднозначна или не указывает существующий FR, NFR или AC этой спецификации
**Then:** создание отклонено с явной ошибкой и ни каноническая, ни локальная общая задача не появляется
**And:** при существующей спецификации и существующем требовании разрешённое создание сохраняет корректную связь

## AC-16.3 — Specification preview has no persistent side effects

**Covers:** FR-16

**Given:** в тестовом репозитории отсутствует ветка новой спецификации
**When:** вызывается создание спецификации с dryRun=true
**Then:** показывается предварительный результат
**And:** никакая ветка, документ, commit или другая постоянная запись не создаётся

## AC-17.1 — All team participants can read complete task details

**Covers:** FR-17

**Given:** у общей задачи есть многострочное описание, исходный статус, исполнитель, требование, критерий завершения, зависимости, комментарий и вложение
**And:** тимлид и участник той же команды имеют право чтения
**When:** каждый запрашивает подробности этой задачи через доступные MCP-инструменты
**Then:** оба получают одинаковые канонические поля и доступные команде данные исполнения без обрезания или подмены значений
**And:** краткий список не считается полным ответом и позволяет запросить полную карточку

## AC-17.2 — Read access does not grant write access

**Covers:** FR-17

**Given:** участник имеет право читать общую задачу, но не имеет права изменять спецификацию
**When:** он читает задачу, затем пытается записать изменение
**Then:** чтение возвращает полные разрешённые данные, а запись явно отклоняется реестром
**And:** назначение в команду не меняет права токена

## AC-18.1 — Live lead-to-board-to-member flow

**Covers:** FR-18

**Given:** установленное приложение и настоящий сервер работают с отдельной тестовой спецификацией, тимлидом и участником
**When:** тимлид создаёт требование и общую задачу через MCP, а участник читает задачу и выполняет тестовую работу
**Then:** идентичность и данные задачи совпадают в сервере, на доске и в запросах обоих участников
**And:** изменения из каждого разрешённого пути доступны остальным без создания дубля

## AC-18.2 — Live failure and personal-task boundaries

**Covers:** FR-18

**Given:** на тестовой доске есть общая задача, а у участника есть личная задача
**When:** сервер временно недоступен или повторяется запрос с неизвестным результатом
**Then:** интерфейс и MCP явно показывают недоступность или неопределённость, без ложного успеха и локального дубликата
**And:** личная задача остаётся доступной и не превращается в общую


## AC-15.4 — Partial specification creation is recoverable

**Covers:** FR-15

**Given:** тимлид создаёт спецификацию в достоверном контексте команды
**When:** сервер подтвердил создание, но сохранение связи с командой не удалось или результат неизвестен
**Then:** тимлид видит частичный результат с идентичностью созданной спецификации
**And:** связь можно безопасно завершить без повторного создания спецификации и без привязки к другой команде

## AC-15.5 — Explicit sharing between teams isolates execution data

**Covers:** FR-15

**Given:** две разрешённые команды явно связаны с одной спецификацией и видят одну каноническую задачу
**When:** участник первой команды добавляет комментарий или вложение к задаче
**Then:** данные исполнения первой команды не подменяются данными второй команды
**And:** Tracking не переписывается для выражения второй привязки и не выдаёт права

## AC-17.3 — Full task details are assembled at the owning boundary

**Covers:** FR-17

**Given:** общая задача содержит канонический критерий завершения и локальные комментарии и вложения команды
**When:** участник читает канон через MCP spec-kit и полную карточку через MCP teams
**Then:** spec-kit возвращает полные канонические данные, а teams добавляет данные исполнения своей команды
**And:** при ошибке чтения или ограничении размера возвращается явная ошибка вместо успешной неполной карточки


## AC-9.4 — Confirmed transition survives a crash before local receipt

**Covers:** FR-9

**Given:** teams сохранил requestId и контрольную сумму, а реестр подтвердил переход с авторизованным actor
**When:** процесс завершился до получения квитанции или записи локального маркера
**Then:** после запуска teams запрашивает прежний результат по requestId и добавляет подлинную квитанцию в историю не более одного раза
**And:** если результат недоступен, пользователь видит неизвестный исход и повторная новая запись не выполняется
