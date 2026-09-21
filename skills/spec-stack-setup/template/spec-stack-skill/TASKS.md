# Tasks

## TASK-1 — compose.yml + .env стека

- **Status:** done

**Implements:** FR-1

**Refs:** NFR-2

- **Done When:** `docker compose up -d` из директории скила поднимает ровно три сервиса на портах 8089/9419/8644.

## TASK-2 — Оркестратор setup.mjs

- **Status:** done

**Implements:** FR-2, FR-3

**Refs:** NFR-1, NFR-2

- **Done When:** один запуск доводит стек до рабочего состояния и печатает ссылку на дашборд.

## TASK-3 — Шаблон спеки и загрузчик через MCP

- **Status:** done

**Implements:** FR-4

**Refs:** AC-2.1

- **Done When:** документы `template/spec-stack-skill/` загружаются в реестр через MCP-вызовы без прямых коммитов.

## TASK-4 — SKILL.md для omp/codex/claude

- **Status:** done

**Implements:** FR-1

**Refs:** NFR-1

- **Done When:** инструкция одинаково читается агентскими CLI и не требует знания внутренностей.
