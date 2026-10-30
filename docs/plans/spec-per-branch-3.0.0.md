# План: спека = ветка (3.0.0)

Статус: **черновик на согласование**. Код не меняется до утверждения плана.
Владелец: stgmt. Курировать по чек-листу в конце; каждый пункт закрывается только с доказательством (тест/прогон/дифф).

## 1. Целевая модель

```
stgmt/omp-spec-kit                         ← один репозиторий, много проектов
  ├─ main                                  ← код (без .specs)
  ├─ spec-teams-task-sync                  ← orphan-ветка = одна спека
  │    .spec-kit.json                      ← project → spec → branch
  │    .specs/teams-task-sync/…            ← корпус
  ├─ spec-teams-task-sync/retry-policy     ← сабветка (рабочая)
  ├─ spec-blast-radius-auto-generation     ← orphan-ветка = другая спека
  │    .spec-kit.json
  │    .specs/blast-radius-auto-generation/…
  └─ …
```

Правила:

1. Ветка спеки **всегда** начинается с `spec-`: `spec-<slug>`.
2. Ветка спеки — **orphan** (без родителя, без кода в истории).
3. Сабветка: `spec-<slug>/<topic>` (обычная ветка от ветки спеки), канон — только `spec-<slug>`.
4. `spec/<slug>` + `spec/<slug>/<topic>` **невозможны вместе**: git не разрешает ref-файл и ref-каталог с одним именем. Поэтому дефис: `spec-<slug>`.
5. Один репозиторий может содержать много проектов; проект определяется `.spec-kit.json`, а не именем ветки.
6. Любая ветка, не начинающаяся с `spec-`, для реестра не существует: писать в неё сервис отказывается.
7. Нет общего `stgmt/spec-database`, нет `specs-database`, нет дефолтного репозитория.
8. Токен на репозиторий даёт юзер; на каждый репозиторий свой.
9. Спеки только в git. SQLite — операционная (claims/credentials/ledger/audit), контента спек там нет.
10. Merge сабветок — **прямой**, сервисом, под write-lock (PR не рассматриваем: ревьюеров нет). PR-режим не добавляем.

## 2. Метадата `.spec-kit.json`

В корне каждой ветки спеки:

```json
{
  "schema": "omp-spec-kit/spec-binding@1",
  "project": "stgmt/omp-spec-kit",
  "spec": "teams-task-sync",
  "repo": "stgmt/omp-spec-kit",
  "branch": "spec-teams-task-sync",
  "createdAt": "2026-10-30T00:00:00.000Z",
  "owner": "stgmt"
}
```

Правила:

- `project` — единственный источник привязки спеки к проекту; один репозиторий может содержать несколько проектов.
- `spec` обязан совпадать со slug каталога `.specs/<slug>/` и с суффиксом ветки.
- `branch` обязан совпадать с фактическим именем ветки.
- Реестр читает метадату через `git show <branch>:.spec-kit.json` без checkout.
- Спека без метадаты или с расхождением — `SPEC_BINDING_INVALID`, не индексируется.

## 3. Операционный store (SQLite)

| Таблица | Содержимое | Почему нужна |
|---|---|---|
| `repo_bindings` | project, repoUrl, status, boundBy, boundAt | привязка проект → репозиторий |
| `credentials` | project, repoUrl, tokenEnc (AES-GCM), username | clone/push по приватным репозиториям |
| `claims` | specKey (`project/spec`), holder, expiresAt | lease 30 мин, защита от параллельной записи |
| `ledger` | specKey, version, digest, commitSha, repoUrl, repoBranch | опубликованные версии и теги |
| `access_log` | login, role, project, op, spec, result | аудит |

Env-секреты:

| Переменная | Назначение |
|---|---|
| `SPEC_REGISTRY_SECRETS_KEY` | ключ шифрования токенов репозиториев |
| токен репозитория (per repo) | fine-grained PAT, вводит юзер, хранится зашифрованным |
| `YOUTRACK_TOKEN` | проверка пользователей/карточек |
| `SPEC_SYNC_MARKER_KEY` | HMAC маркера проекции |
| `SPEC_AGENT_TOKEN` | токен агента для writeback-listener |
| `SPEC_WRITEBACK_TOKEN` | секрет правила YouTrack → listener |
| `SPEC_REGISTRY_CONFIG` / `CLONE` / `STORE` | конфиг, клон, SQLite |
| `SPEC_REGISTRY_BOT_NAME` / `EMAIL` | identity бота |
| `SPEC_REGISTRY_PROJECTION` | включение проекции |

Глобальный `SPEC_REGISTRY_GIT_TOKEN` удаляется из модели.

## 4. MCP-поверхность

- Добавляется **11-й инструмент** `spec_branch`:
  - `action: list` — ветки спек проекта (read-only);
  - `action: create` — создать `spec-<slug>` (orphan) или `spec-<slug>/<topic>`;
  - `action: merge` — влить сабветку в ветку спеки (fast-forward или `--no-ff`, под lock, коммит ботом);
  - `action: delete` — удалить сабветку (ветку спеки — только `archiveSpec`).
- `spec_catalog` получает view `branches` (без нового инструмента на чтение).
- `spec_patch` остаётся единственным инструментом записи документов; `branch` в нём не появляется.
- Контракт инструментов меняется → полный `@tool-e2e` матрикс на 11 инструментов.

## 5. Фазы

### P0. Переавторинг канона (MCP) — L

| ID | Задача | Файлы/артефакты | Приёмка |
|---|---|---|---|
| P0-1 | Переписать `spec-registry-service` README/FR-1: per-spec orphan branch, metadata, multi-project repo | `.specs/spec-registry-service/*` через `spec_patch` | validation VALID, coverage не падает |
| P0-2 | Новые FR: branch discovery, `.spec-kit.json`, `spec_branch`, merge, no-fallback | FR/NFR/AC | каждый AC покрыт сценарием |
| P0-3 | Обновить `spec-mcp-access-gate`: граница `.specs` на ветке спеки, setup-required | `.specs/spec-mcp-access-gate/*` | сценарии на блокировку |
| P0-4 | Обновить `youtrack-visualization`: проекция только с `spec-<slug>` | `.specs/youtrack-visualization/*` | сценарий «сабветка не проецируется» |
| P0-5 | Обновить `spec-mcp-operations`: 11 инструментов, `spec_branch` | `.specs/spec-mcp-operations/*` | tool-contract тесты |
| P0-6 | ADR: «спека = orphan-ветка, метадата в корне» | `docs/decisions/` | ссылка из README |

### P1. Модель хранения в сервисе — L

| ID | Задача | Файлы | Приёмка |
|---|---|---|---|
| P1-1 | Убрать `specsRepo`/`defaultMount`; конфиг: проекты + обязательные binding | `src/service/mounts.js` | boot падает на unbound |
| P1-2 | Layout `project-repo`: root = checkout ветки, `.specs` в корне | `mounts.js`, `registry.js` | путь не содержит `<owner>/<project>` |
| P1-3 | Branch policy: `spec-<slug>` и `spec-<slug>/<topic>`, запрет `main` и чужих | `branch-policy.js` | unit-тесты на валид/невалид |
| P1-4 | `for(project)` без binding → `REPO_BINDING_REQUIRED` для всех, не только external | `mounts.js` | тест |
| P1-5 | Ledger/bindings: `repoBranch` = ветка спеки | `ledger.js`, `repos.js` | миграция схемы |

### P2. Discovery и worktrees — L

| ID | Задача | Файлы | Приёмка |
|---|---|---|---|
| P2-1 | Клон репозитория + `git for-each-ref refs/heads/spec-*` | `src/service/branches.js` (new) | список веток |
| P2-2 | Чтение `.spec-kit.json` через `git show`, валидация | `branches.js` | невалидная → `SPEC_BINDING_INVALID` |
| P2-3 | Worktree на ветку спеки (bare clone + worktree) | `mounts.js`/`worktrees.js` | параллельное чтение двух спек |
| P2-4 | Индекс `project → spec → branch` вместо `<owner>/<project>/.specs` | `registry.js` | `/registry` без ошибок |
| P2-5 | Boot/sync: fetch всех веток, не только `main` | `sync.js` | новые ветки видны без рестарта |

### P3. `spec_branch` — M

| ID | Задача | Файлы | Приёмка |
|---|---|---|---|
| P3-1 | Контракт инструмента + схема | `src/adapters/tool-contracts.js` | 11 инструментов |
| P3-2 | `create` orphan `spec-<slug>` + `.spec-kit.json` | `src/authoring/branches.js` | ветка без родителя |
| P3-3 | `create` сабветку `spec-<slug>/<topic>` от ветки спеки | там же | родитель = спека |
| P3-4 | `merge` прямой, под lock, бот-коммит, аудит | там же | сабветка влита, история линейна/`--no-ff` |
| P3-5 | `delete` сабветки; запрет удаления ветки спеки | там же | `BRANCH_PROTECTED` |

### P4. Write path / publish / drift — M

| ID | Задача | Файлы | Приёмка |
|---|---|---|---|
| P4-1 | `spec_patch` пишет в ветку спеки | `writepath.js` | коммит в `spec-<slug>` |
| P4-2 | Публикация тега на ветке спеки | `publish.js` | тег + ledger |
| P4-3 | Drift по каждой ветке `spec-*` | `drift.js` | non-bot commit виден |
| P4-4 | Версионные чтения из ветки | `versioned.js` | чтение по тегу |
| P4-5 | Проекция только с ветки спеки | `projection.js` | сабветка не создаёт карточек |

### P5. Setup-required — M

| ID | Задача | Файлы | Приёмка |
|---|---|---|---|
| P5-1 | `GET /status` + `mcp_preflight.setup` | `src/service/http.js`, `ops/*` | `{required, code, command}` |
| P5-2 | Типизированная ошибка `SETUP_REQUIRED` | `error-codes.js` | любой spec_* при unbound |
| P5-3 | Claude: SessionStart + PreToolUse | `plugins/omp-spec-kit/hooks/*` | сообщение агенту |
| P5-4 | Codex: SessionStart + PreToolUse | `src/hosts/codex/*` | сообщение агенту |
| P5-5 | OpenCode: `session.created` + `tool.execute.before` | `src/hosts/opencode/*` | сообщение агенту |
| P5-6 | OMP: `tool_call` (и session_start, если поддерживается) | `src/enforcement/*` | сообщение агенту |

Сообщение: «spec-kit требует настройки: привяжи репозиторий и токен, команда …». Хук не настраивает сам.

### P6. Установщик и конфиг — M

| ID | Задача | Файлы | Приёмка |
|---|---|---|---|
| P6-1 | `projects.json`: проекты + repo bindings, без `specsRepo` | `skills/spec-stack-setup/template/*` | схема валидируется |
| P6-2 | Ввод токена на каждый репозиторий | `setup.mjs` | без токена — отказ |
| P6-3 | Создание/привязка репозитория проекта | `setup.mjs` | binding active |
| P6-4 | Проверка веток `spec-*` и метадаты | `setup.mjs` | setup падает на невалидной |
| P6-5 | `SPECS_BRANCH` удалить из модели | `setup.mjs`, compose | нет упоминаний |

### P7. Тесты и фикстуры — L

| ID | Задача | Приёмка |
|---|---|---|
| P7-1 | Unit: branch policy, metadata, discovery | зелёные |
| P7-2 | Service: per-repo mount, worktree, no-fallback | зелёные |
| P7-3 | E2E: 9 спек → 9 веток, проекция | 15/15 |
| P7-4 | BDD: create/merge/delete, setup-required | зелёные |
| P7-5 | `@tool-e2e` 11 инструментов, архив | полный матрикс |
| P7-6 | Фикстуры/кандидат/BDD обновить | identity зелёный |

### P8. Миграция данных — L

| ID | Задача | Приёмка |
|---|---|---|
| P8-1 | В `stgmt/omp-spec-kit` создать 9 orphan-веток `spec-<slug>` | ветки без родителя |
| P8-2 | В каждую положить `.spec-kit.json` + `.specs/<slug>/` | метадата валидна |
| P8-3 | Привязать проект к репозиторию (токен юзера) | binding active |
| P8-4 | Пересобрать образ, перезапустить, проверить digest'ы | `/registry` зелёный |
| P8-5 | Перепроецировать YouTrack | 13/8/36/21/29 |
| P8-6 | `stgmt/spec-database` → архив/read-only | не источник истины |

### P9. Документация и схема — S

| ID | Задача | Приёмка |
|---|---|---|
| P9-1 | Обновить анимированную схему: repo → ветки-спеки, metadata, merge | визуально проверено |
| P9-2 | Статичный SVG в README + ссылка на HTML | README рендерится |
| P9-3 | `docs/specs-repo-operations.md`, plugin README, SKILL.md | нет старой модели |
| P9-4 | ADR + changelog | ссылки |

### P10. Релиз 3.0.0 — M

| ID | Задача | Приёмка |
|---|---|---|
| P10-1 | Версии 3.0.0 во всех сайтах | verify-package |
| P10-2 | Release candidate + evidence + attestation | preflight passed |
| P10-3 | GitHub Release + Latest | assets |
| P10-4 | Установка на этот ПК из релиза | 4 хоста |
| P10-5 | Финальная матрица проверок | отчёт |

## 6. Definition of Done

- [ ] Спека `spec-registry-service` переавторена через MCP, VALID, покрытие не упало.
- [ ] Ни одного упоминания `specsRepo`, `specs-database`, `<owner>/<project>/.specs` в коде/доках/тестах.
- [ ] Unbound проект → `REPO_BINDING_REQUIRED`; любой spec_* → `SETUP_REQUIRED`; фолбеков нет.
- [ ] `spec_branch` create/merge/delete/list работает, merge прямой, аудит есть.
- [ ] 9 спек живут в 9 orphan-ветках `spec-*` репозитория `stgmt/omp-spec-kit`.
- [ ] Проекция только с веток спек; сабветки не проецируются.
- [ ] Все 4 хоста показывают setup-required, когда не настроено, и блокируют `.specs`.
- [ ] Unit + service + e2e + BDD + tool-e2e + preflight — зелёные.
- [ ] Релиз 3.0.0 опубликован с attestation, установлен на ПК.
- [ ] README содержит обновлённую схему (SVG) и ссылку на анимацию.

## 7. Риски

| Риск | Митигация |
|---|---|
| Git не даёт `spec/<slug>` + `spec/<slug>/<topic>` | принят `spec-<slug>` + `spec-<slug>/<topic>`; зафиксировать в ADR |
| Много worktree на репозиторий | один bare clone + worktree per branch, лимит и cleanup |
| Токены на N репозиториев | шифрование `SPEC_REGISTRY_SECRETS_KEY`, аудит bind |
| Ветка спеки = orphan, но репозиторий общий с кодом | branch protection: пуш только бот; drift ловит людей |
| Миграция меняет digest'ы | перепроекция + новый ledger, старый репозиторий архив |
| 11-й инструмент ломает 10-tool контракт | 3.0.0 + tool-e2e матрикс |

## 8. Чек-лист куратора

- [ ] P0 закрыт и опубликован в реестр.
- [ ] P1-P2: сервис читает ветки и метадату, worktree.
- [ ] P3: `spec_branch` создаёт/мержит/удаляет.
- [ ] P4: запись/публикация/дрифт по веткам.
- [ ] P5: setup-required на 4 хостах.
- [ ] P6: установщик без `specsRepo`.
- [ ] P7: все тесты.
- [ ] P8: 9 спек мигрированы.
- [ ] P9: README-схема.
- [ ] P10: 3.0.0 в GitHub и на ПК.
