# Аудит раздутой MCP-поверхности: 38 инструментов для работы со спецификациями

Дата: 2026-09-04  
Объект: `omp-spec-kit`, текущая MCP-поверхность из 38 инструментов  
Статус: аналитический отчёт, без изменения протокола и без миграции инструментов

## 1. Короткий вывод

Да, показанный фрагмент — реальная UX-проблема:

```text
spec_get_node      getNode
spec_find_nodes    findNodes
spec_get_edges     getEdges
```

`spec_get_node` и `spec_find_nodes` описывают один и тот же пользовательский маршрут: найти узел графа спецификации. Разница между ними небольшая:

- `spec_get_node` принимает один `canonicalId` и умеет добавить `includeIncidentCounts`;
- `spec_find_nodes` уже принимает `canonicalIds[]`, `kinds[]`, текстовый фильтр, проекцию и пагинацию.

Это не три независимых концепции. Это один поиск сущностей с разными режимами результата.

Однако все 38 инструментов не являются одним и тем же инструментом. Поверхность состоит из нескольких настоящих границ: чтение графа, чтение документов, проверка доказательств, безопасное предложение изменений и применение изменений. Поэтому правильное решение — не один огромный `spec_query` с десятками необязательных полей, а несколько крупных предметных инструментов с явным типом операции.

Рекомендуемое направление:

1. объединить `spec_get_node` и `spec_find_nodes` в один запрос сущностей;
2. передавать тип сущности через `entityKind`/`kinds`;
3. отдавать каталог типов сущностей с короткими описаниями в `spec_catalog` или `spec_overview`, а не плодить отдельный discovery-тул;
4. объединить авторские фасады вокруг существующего `propose_patch`;
5. отдельно оставить границу применения изменения `apply_proposed_patch`;
6. не смешивать запрос узлов с рёбрами, файлами, доказательствами и записью.

## 2. Что проверено

Источники фактов:

- `src/adapters/tool-contracts.js:43-399` — полный список 38 контрактов;
- `src/mcp/server.js:191-247` — публикация каталога и единый вызов `service.runQuery(contract.operation, ...)`;
- `src/kernel/types.js` — типы узлов, рёбер и базовых операций;
- `src/kernel/query/service.js:23-30,704-1090` — базовые операции графа;
- `src/kernel/query/extended.js:9-15,231-398` — расширенные операции чтения и проверки;
- `src/adapters/document-service.js` — чтение документов;
- `src/evidence/service.js` — чтение результатов проверок;
- `src/authoring/service.js:17-33,107-203,352-380` — авторские фасады и их компиляция в proposal-операции;
- `docs/decisions/mcp-ux-adoption-plan-2026-09-04.md:27-31` — прежнее решение не объединять namespace/verb-инструменты.

Фактическая матрица backend-операций:

| Семейство | Backend-операций | Контрактов MCP |
|---|---:|---:|
| Базовый графовый запрос | 8 | 8 |
| Расширенная аналитика | 11 | 10 |
| Документы и preflight | 4 | 4 |
| Доказательства | 2 | 2 |
| Авторинг | 14 | 14 |
| **Итого** | **39 backend-операций** | **38 инструментов** |

`listPhaseTasks` существует в `EXTENDED_OPERATIONS`, но отдельного MCP-контракта сейчас не имеет. Это не потерянный инструмент, а внутренняя операция, недоступная через текущий каталог.

## 3. Полный список 38 инструментов

### 3.1. Базовый граф — 8 инструментов

| Инструмент | Для чего нужен | Перекрытие |
|---|---|---|
| `spec_inventory` | Пагинированный список спецификаций и, при необходимости, их документов | Перекрывается с каталогом спецификаций и статусом |
| `spec_get_node` | Получить один узел по `canonicalId` | Почти полностью перекрывается с `spec_find_nodes` |
| `spec_find_nodes` | Найти узлы по спецификации, типу, ID и тексту | Главный кандидат на объединение с `spec_get_node` |
| `spec_get_edges` | Получить рёбра, связанные с одним узлом | Та же графовая навигация, но другой результат |
| `spec_trace` | Пройти граф от узла на ограниченную глубину | Соседний режим `spec_get_edges`, не обычный поиск узлов |
| `spec_diagnostics` | Получить диагностические сообщения парсера и графа | Пересекается с проверкой спецификации, но нужен отдельный эксплуатационный результат |
| `spec_overview` | Получить сводку корпуса, гистограммы и ограничения | Перекрывается с `spec_inventory` и `get_spec_status` по discovery |
| `spec_markdown_inventory` | Найти заголовки и Markdown-ссылки | Связано с графом ссылок, но не с сущностями узлов |

### 3.2. Расширенная аналитика — 10 опубликованных инструментов

| Инструмент | Для чего нужен | Перекрытие |
|---|---|---|
| `find_by_tags` | Найти сценарии, содержащие все заданные теги | Частный фильтр сценариев |
| `list_tasks` | Список задач спецификации с фильтрами статуса, фазы и требования | Частично совпадает с общим поиском узлов типа `TASK` |
| `find_orphans` | Найти требования, задачи и сценарии без нужных связей | Частная проверка графа |
| `validate_anchor` | Проверить ID узла или Markdown-якорь | Частная проверка адресуемости сущности |
| `list_specs` | Перечислить slug спецификаций | Почти точный дубль части `spec_inventory` и `spec_overview` |
| `validate_requirement_metadata` | Проверить объект метаданных требования | Частная проверка схемы сущности |
| `policy_query_requirements` | Отфильтровать требования по политике проверки, классу риска и поставке | Частный поиск узлов `FUNCTIONAL_REQUIREMENT`/`NON_FUNCTIONAL_REQUIREMENT` |
| `get_archival_proof` | Проверить входящие ссылки перед архивированием | Частная проверка графа ссылок |
| `validate_spec` | Проверить одну спецификацию и вернуть verdict/findings | Сводит часть функций diagnostics/orphans/policy в один результат |
| `get_spec_status` | Получить статус, counts или coverage одной спецификации/корпуса | Почти точный дубль части `spec_inventory` и `spec_overview` |

### 3.3. Документы и preflight — 4 инструмента

| Инструмент | Для чего нужен | Перекрытие |
|---|---|---|
| `mcp_preflight` | Проверить окружение, корень, lock и зависимости | Самостоятельная граница допуска среды |
| `list_spec_docs` | Получить список документов и вложений спецификации | Естественно объединяется с чтением документов |
| `read_spec_doc` | Прочитать документ, секцию или ограниченное окно строк | Естественно объединяется с `list_spec_docs` |
| `read_attachment` | Прочитать бинарное вложение как base64 | Та же документная граница, но отдельный тип результата |

### 3.4. Доказательства — 2 инструмента

| Инструмент | Для чего нужен | Перекрытие |
|---|---|---|
| `get_test_result` | Получить последний результат и freshness одного сценария | Тот же объект сценария, что и trace |
| `get_scenario_trace` | Получить результат сценария с hash-bound runtime trace | Частично дублирует `get_test_result`, но trace богаче |

### 3.5. Авторинг — 14 инструментов

| Инструмент | Для чего нужен | Перекрытие |
|---|---|---|
| `propose_patch` | Создать проверяемое многооперационное предложение | Уже является универсальным примитивом |
| `apply_proposed_patch` | Применить предложение после проверки хэшей и approval | Единственная граница записи; оставить отдельно |
| `amend_requirement` | Предложить добавление текста в FR | Фасад над `proposePatch` |
| `add_acceptance_criterion` | Предложить новый AC | Фасад над `proposePatch` |
| `add_phase` | Предложить фазу в TASKS.md | Фасад над `proposePatch` |
| `set_entity_status` | Предложить переход статуса задачи | Фасад над `proposePatch` |
| `set_spec_status` | Предложить изменение статуса спецификации | Фасад над `proposePatch` |
| `set_requirement_metadata` | Предложить метаданные требования | Фасад над `proposePatch` |
| `delete_spec_doc` | Предложить удаление документа | Фасад над `proposePatch` |
| `rename_spec_doc` | Предложить переименование документа | Фасад над `proposePatch` |
| `create_spec` | Предложить полный каркас новой спецификации | Особый фасад, но всё равно proposal |
| `archive_spec` | Предложить архивирование после проверки ссылок | Особый фасад с graph proof |
| `add_backlog_task` | Предложить backlog-задачу | Фасад над `proposePatch` |
| `register_incident_backlog` | Предложить incident-задачу | Фасад над `proposePatch` |

Ключевое наблюдение: 12 из 14 авторских операций — удобные имена над одним механизмом предложения. `compileFacade()` направляет их в `operationForFacade()`, компилирует в операции патча и затем вызывает `proposePatch()` (`src/authoring/service.js:352-380`). Это самый крупный источник лишних карточек в каталоге.

## 4. Где именно blast повторяется

### 4.1. Узлы: `get` против `find`

Это безусловное объединение.

Входы текущих инструментов:

```text
spec_get_node:
  canonicalId: string
  projection: summary | full
  includeIncidentCounts: boolean

spec_find_nodes:
  specSlugs: string[]
  kinds: NodeKind[]
  canonicalIds: string[]
  text: string | null
  projection: summary | full
  limit: integer
  cursor: string | null
```

`spec_find_nodes` уже может искать по одному `canonicalIds[]`. Для сохранения полной семантики достаточно добавить `includeIncidentCounts` и определить правило:

- один `canonicalId` плюс `includeIncidentCounts` — точечный результат;
- несколько ID, тип или текст — список;
- найдено несколько одноимённых кандидатов — обычная неоднозначность списка;
- пустые фильтры — bounded list с пагинацией.

Вариант целевого имени: `spec_entities` или оставить `spec_find_nodes` и расширить его. Второй вариант дешевле и не вводит лишнее имя.

### 4.2. Рёбра: `get_edges` против `trace`

Это не дубль получения сущности. Оба инструмента начинают с `canonicalId`, `direction` и `types`, но возвращают разную информацию:

- `get_edges` — непосредственные связи;
- `trace` — ограниченный обход графа с `maxDepth` и `maxVisited`.

Их можно объединить в `spec_graph` с обязательным `view: "edges" | "trace"`. Объединять их с `spec_entities` нельзя: модель будет выбирать не только тип сущности, но и тип графовой операции.

### 4.3. Каталог: `inventory`, `list_specs`, `overview`, `status`

Здесь четыре точки входа сообщают разные срезы одного вопроса: «что есть в корпусе и в каком оно состоянии».

- `list_specs` — только slug;
- `spec_inventory` — список спецификаций, опционально документы и пагинация;
- `spec_overview` — counts и гистограммы;
- `get_spec_status` — status/summary/counts/coverage.

Их следует объединить в `spec_catalog` с явным `view`:

```json
{
  "view": "specs" | "inventory" | "overview" | "status",
  "spec": "optional-slug",
  "includeDocuments": false,
  "limit": 20,
  "cursor": null
}
```

Но не следует делать все ответы одинаковыми искусственно. Общий тул может иметь discriminated output по `view`, а не один объект с десятками nullable-полей.

### 4.4. Общий поиск узлов против частных фильтров

Следующие инструменты используют заранее известные типы узлов или связей:

- `list_tasks` — `TASK`;
- `policy_query_requirements` — два типа требований;
- `find_by_tags` — `SCENARIO`;
- `find_orphans` — специальные графовые условия;
- `validate_anchor` — адрес узла/заголовка;
- `get_archival_proof` — входящие ссылки;
- `validate_spec` — diagnostics по спецификации.

Нельзя механически убрать каждый частный инструмент в `spec_find_nodes`: у них разные правила валидации и разные результаты. Но их можно собрать в один предметный `spec_inspect`/`spec_validate` с обязательным `check` и строго разделённой схемой параметров. Это уменьшит список имён, не превращая вход в бесформенный JSON.

### 4.5. Документный маршрут

`list_spec_docs`, `read_spec_doc` и `read_attachment` образуют естественный файловый браузер:

```json
{
  "action": "list" | "read" | "readAttachment",
  "spec": "spec-mcp-operations",
  "doc": "FR.md",
  "path": "fixtures/example.bin",
  "section": "optional",
  "offset": 1,
  "limit": 80
}
```

`mcp_preflight` сюда не включать: это проверка допуска среды, а не чтение спецификации.

### 4.6. Доказательства сценариев

`get_test_result` и `get_scenario_trace` читают один объект сценария с разной глубиной. Их можно объединить:

```json
{
  "scenarioId": "SCEN-...",
  "spec": "optional-slug",
  "view": "result" | "trace"
}
```

### 4.7. Авторинг

Текущая архитектура уже показывает правильную внутреннюю форму:

```text
typed facade -> operationForFacade() -> proposal operations[] -> proposePatch()
                                                              -> applyProposedPatch()
```

Для MCP UX наружу достаточно:

- `spec_propose_patch` — один typed/generic proposal-контракт;
- `apply_proposed_patch` — отдельное действие с approval и hash recheck.

`propose_patch` уже принимает `operations[]`, поэтому compound edit не требует отдельного инструмента. Для человекочитаемости можно сохранить имена операций внутри schema enum и добавить в описание короткую таблицу действий, но не публиковать 12 фасадов как 12 верхнеуровневых тулов.

`apply_proposed_patch` нельзя объединять с proposal: это отдельная граница записи, риска и подтверждения.

## 5. Почему идея «сначала список типов сущностей, потом один query» подходит

Она подходит, если список типов является описательным каталогом, а не ещё одним обязательным сетевым round-trip перед каждым вызовом.

Текущий граф имеет 15 типов узлов:

```text
DOCUMENT
USER_STORY
USE_CASE
RESEARCH_FINDING
RISK
FUNCTIONAL_REQUIREMENT
NON_FUNCTIONAL_REQUIREMENT
ACCEPTANCE_CRITERION
DECISION
TASK
FILE_CHANGE
FILE
SCENARIO
FIXTURE
SCHEMA_ENTITY
```

Сейчас эти значения видны как enum в `kinds`, но enum сам по себе не объясняет смысл типа. Модели приходится угадывать разницу между `FUNCTIONAL_REQUIREMENT`, `ACCEPTANCE_CRITERION`, `SCENARIO`, `FIXTURE` и `FILE_CHANGE`.

Лучше возвращать в `spec_catalog` объект вроде:

```json
{
  "entityKinds": [
    {
      "kind": "FUNCTIONAL_REQUIREMENT",
      "label": "Functional requirement",
      "description": "Observable product behavior the system must provide.",
      "identity": "FR-*",
      "document": "FR.md"
    },
    {
      "kind": "ACCEPTANCE_CRITERION",
      "label": "Acceptance criterion",
      "description": "Testable condition proving a requirement is satisfied.",
      "identity": "AC-*",
      "document": "ACCEPTANCE_CRITERIA.md"
    }
  ],
  "edgeTypes": [
    {
      "type": "COVERS",
      "description": "Requirement or criterion coverage relation."
    }
  ]
}
```

После этого один `spec_entities` может принимать:

```json
{
  "entityKind": "FUNCTIONAL_REQUIREMENT",
  "spec": "spec-mcp-operations",
  "id": "FR-30",
  "text": null,
  "projection": "full",
  "includeIncidentCounts": true,
  "limit": 20,
  "cursor": null
}
```

Важно: каталог типов должен быть кэшируемым и входить в уже существующий `spec_overview`/`spec_catalog`. Отдельный `get_entity_kinds` нужен только если каталог нельзя вернуть вместе с обычным discovery. Иначе новый тул просто заменит три старых карточки на одну новую карточку, не улучшив маршрут.

## 6. Предлагаемая целевая поверхность

Не минимизировать количество любой ценой. Цель — один понятный маршрут на одну пользовательскую задачу.

| Целевой тул | Что объединяет |
|---|---|
| `mcp_preflight` | Оставить отдельно |
| `spec_catalog` | `spec_inventory`, `list_specs`, `spec_overview`, `get_spec_status`; добавить каталог типов |
| `spec_entities` | `spec_get_node`, `spec_find_nodes`; `entityKind`/filters/projection/paging |
| `spec_graph` | `spec_get_edges`, `spec_trace`; `view: edges/trace` |
| `spec_documents` | `list_spec_docs`, `read_spec_doc`, `read_attachment`; `action` |
| `spec_inspect` | `find_by_tags`, `find_orphans`, `validate_anchor`, `validate_requirement_metadata`, `policy_query_requirements`, `get_archival_proof`, `validate_spec`; `check` |
| `spec_tasks` | `list_tasks` и будущий `list_phase_tasks`; task-specific filters |
| `spec_evidence` | `get_test_result`, `get_scenario_trace`; `view: result/trace` |
| `spec_markdown` | `spec_markdown_inventory`; оставить отдельно, если link/heading inventory нужен часто |
| `spec_propose_patch` | `propose_patch` и typed authoring facades как внутренние compile helpers |
| `apply_proposed_patch` | Единственная запись; оставить отдельно |

Итого: ориентировочно 11 инструментов вместо 38. Если `spec_markdown` и `spec_tasks` объединить в `spec_inspect`, получится 9, но это уже ухудшит тематическую навигацию. Практический диапазон — 9–11, а не 1 и не 38.

## 7. Что не следует объединять

### Не делать один «бог-тул»

Плохая форма:

```json
{
  "type": "node|edge|trace|document|diagnostic|proposal",
  "kind": "optional",
  "action": "optional",
  "spec": "optional",
  "id": "optional",
  "path": "optional",
  "operations": "optional",
  "... еще 30 полей"
}
```

Она экономит строки в `tools/list`, но переносит сложность в угадывание комбинаций. Для модели это хуже: ошибки становятся `invalid parameter`, а не понятным выбором карточки.

### Не объединять чтение и запись

`apply_proposed_patch` имеет другую безопасность, другое подтверждение и другой набор ошибок. Даже если параметр `action` технически позволяет объединить его с proposal, UX и безопасность ухудшатся.

### Не включать тип сущности в каждый тул без смысла

`entityKind` уместен для списка узлов, поиска, task/requirement/scenario inspection. Он неуместен для чтения `README.md`, бинарного attachment или проверки Docker evidence.

### Не делать предварительный список обязательным для каждого вызова

Правильный порядок для модели:

```text
один раз: spec_catalog -> entityKinds с описаниями
далее: spec_entities(entityKind=...)
```

Неправильный порядок:

```text
перед каждым чтением: get_entity_kinds -> query -> get_node -> get_edges
```

Это утроит задержку и расход токенов. Каталог должен быть частью начального discovery и кэшироваться клиентом/моделью.

## 8. Риски и условия чистого cutover

### Риск 1: разные формы результата

`getNode`, `findNodes`, `getEdges`, `trace`, overview и status сейчас возвращают разные `data`. Решение: discriminated output по `view`, а не насильственный общий результат с nullable-полями.

### Риск 2: потеря строгой валидации

Текущие 38 контрактов дают закрытые поля и enum. При объединении нужно сохранить закрытую схему каждой ветви. Один `any` для `filters`/`action` отменит пользу объединения.

### Риск 3: ухудшение выбора инструмента моделью

Порог выбора должен быть виден в первом описании:

- `spec_catalog` — что есть в корпусе;
- `spec_entities` — найти сущность;
- `spec_graph` — связи сущности;
- `spec_documents` — байты документов;
- `spec_inspect` — проверка/аудит;
- `spec_propose_patch` — подготовить изменение;
- `apply_proposed_patch` — применить после проверки.

### Риск 4: сломанные клиенты

Проектная политика требует чистый cutover: без псевдонимов, таблицы замен и скрытой совместимости. Значит, перед удалением 38 имён нужно обновить все внутренние вызовы, BDD, спецификации и discovery-проверки в одной операции.

### Риск 5: повторное появление фасадов

Если оставить публичными 12 typed authoring facades, blast вернётся. Типизированные фасады можно оставить внутренними функциями `operationForFacade()` для удобства реализации, но не публиковать их все как MCP tools.

## 9. Внешние GitHub-проекты

Поиск готового инструмента не дал готовой статической архитектуры для этого корпуса:

- `MCPJam/inspector` — интерактивный отладчик MCP-серверов с просмотром tools/resources/prompts и вызовами; он решает задачу отладки живого сервера, а не уменьшения доменной поверхности контрактов.
- `simonw/mcp-explorer` — CLI, который умеет `list`, `inspect`, `--json` и показывает полные tool definitions; это удобный клиент для исследования, но не целевая архитектура доменного MCP API и не статический каталог с типами сущностей.

Использование этих проектов вместо redesign не устранит повторение `get`/`find` и 12 authoring-фасадов. Они могут быть инструментами проверки после cutover, но не заменой модели API.

## 10. Итоговое решение

Пользовательская гипотеза верна частично и должна стать основой следующего дизайна:

- да, сначала нужен описательный каталог типов сущностей;
- да, `getNode` и `findNodes` нужно свести к одному query маршруту;
- да, discovery/status/inventory нужно собрать в один каталог;
- да, авторинг нужно показывать как proposal/apply, а не как 14 верхнеуровневых действий;
- нет, все 38 нельзя заменить одним нестрогим `spec_query`;
- нет, рёбра, документы, доказательства и запись не являются той же сущностью, что node;
- оптимальная поверхность для текущего домена — примерно 9–11 инструментов с discriminated схемами.

Приоритет реализации:

1. `spec_get_node` + `spec_find_nodes`;
2. `spec_inventory` + `list_specs` + `spec_overview` + `get_spec_status`;
3. 12 authoring facades → один proposal surface, `apply` отдельно;
4. documents/evidence/graph view объединения;
5. каталог `entityKinds` и `edgeTypes` с описаниями;
6. clean cutover всех старых имён и сквозная проверка JSON-RPC, OMP и архива.
