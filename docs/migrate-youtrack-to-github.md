# Миграция с YouTrack на GitHub Projects

## Краткий вывод (по результатам исследования)

Прямой нативной миграции YouTrack → GitHub Projects нет. GitHub Projects v2 не умеет импортировать из YouTrack. Подход — кастомный скрипт:

1. Выгрузка из YouTrack через REST API (`/api/issues` + `/api/issues/{id}/comments`).
2. Создание GitHub-issues через **неофициальный Issue Import API** (`POST /repos/{owner}/{repo}/import/issues`) — он сохраняет `created_at`/`updated_at`/`closed_at` (обычный REST создаёт с текущей датой и автором токена).
3. Добавление каждого issue в GitHub Project v2 через GraphQL `addProjectV2ItemById`.
4. Заполнение полей проекта (Status/Priority/Type и т.д.) через `updateProjectV2ItemFieldValue`.

Скрипт: `scripts/migrate_youtrack_to_github.py`.

## Маппинг полей

| YouTrack | GitHub |
|---|---|
| summary | issue.title |
| description | issue.body |
| created | issue.created_at |
| updated | issue.updated_at |
| resolved / State | issue.closed + closed_at; поле проекта Status |
| tags | labels |
| Type (custom field) | label + поле проекта Type |
| Priority (custom field) | label + поле проекта Priority |
| Assignee (custom field) | issue.assignee (логин GitHub) |
| comments (text, created) | comments[] с created_at |
| numberInProject / idReadable | добавляется в тело как ссылка (опционально) |

## Ограничения (важно)

- **Автор**: Issue Import API не позволяет задать автора issue/комментария — всё создаётся от имени владельца токена. Чтобы сохранить идентичность, создайте отдельного "migration" пользователя или укажите в теле `Originally reported by: ...`.
- **Вложения**: API не поддерживает attachments. Нужно отдельно скачать из YouTrack и загрузить в репо (Contents API) или оставить ссылки.
- **Связи (links)**: `relates to`/`blocks`/`parent for` не переносятся. GitHub поддерживает sub-issues и dependencies (blocked by) — можно добавить отдельным проходом по `links`.
- **Лейблы**: чувствительны к регистру; дефолтный `bug` GitHub может конфликтовать с вашим `Bug`.
- **Закрытые issue**: historically был баг при `closed: true` без `closed_at`; скрипт ставит `closed_at` из `resolved`.
- **Производительность**: импорт асинхронный, скрипт опрашивает статус. Рейт-лимиты GitHub.
- **Project fields**: имена полей (`Status`, `Priority`, `Type`) должны существовать в проекте; опции single-select должны совпадать (или задаётся `STATUS_FIELD_MAP`).

## Подготовка GitHub

1. Создать репозиторий (issues).
2. Создать GitHub Project v2 с полями Status (single select), Priority, Type, Iteration.
3. Создать лейблы (или дать скрипту создать из тегов).
4. Токен с правами `repo`, `project`, `read:org` (admin на репо для import API).

## Подготовка YouTrack

1. Создать permanent token: Profile → Authentication → Permanent Token (scope: issues read).
2. Узнать ключ проекта (например `SP`).

## Запуск

```bash
export YOUTRACK_URL=https://youtrack.example.com
export YOUTRACK_TOKEN=perm-...
export YOUTRACK_PROJECT=SP
export GITHUB_TOKEN=ghp_...
export GITHUB_OWNER=myorg
export GITHUB_REPO=myrepo
export GITHUB_PROJECT_NUMBER=1
export USER_MAP='{"john.doe":"johndoe"}'
python scripts/migrate_youtrack_to_github.py
```

## Дополнительные инструменты (найденные в ходе исследования)

- `zyv/github-issues-import` — Python-клиент для неофициального Import API (используется как референс схемы).
- `aboutcode-org/github-import-issues-csv` — импорт issues из CSV в GitHub (теряет даты/автора, но проще).
- `timrogers/gh-migrate-project` — GitHub CLI extension для миграции проектов между репо.
- GitHub Marketplace "Issue Importer Action" — импорт из CSV/JSON через Actions.
- `fuglede/youtrack-to-azure-devops-boards` — аналогичный скрипт YouTrack → Azure DevOps (референс подхода).
- `nicwise/youtrack-to-linear` — YouTrack → Linear.

## Что не покрыто скриптом (TODO)

- Вложения (скачать + загрузить в репо, переписать ссылки).
- Связи issues (sub-issues, blocked-by) — отдельный проход.
- Пользователи/группы, SP/SLA, time tracking, agile boards (sprints → iterations) — ручной маппинг.
- Проверка идемпотентности (повторный запуск создаст дубликаты) — добавить проверку по `idReadable` в теле.
