# OMP crash forensics — 2026-09-10

Источник: `~/.omp/logs/omp.2026-09-10.<pid>.log` (227 файлов; вчера 16).
Windows Event Log (Application, `omp-windows-x64|bun.exe`): пусто — падений на уровне ОС нет.

## 1. Фаталы (время местное, UTC+3)

| Время | PID | Ошибка |
|---|---|---|
| 09:13:31 | 19208 | `Fatal error` + `Session exit reason=unhandled_rejection, kind=fatal`: `EPIPE: broken pipe, write` (fd 1, stdout). Сессия `01a089f1`. Контекст: `agent_end maintenance routing` → `Auto-compaction threshold decision` → запись в закрытый stdout. |
| 09:23:28–09:23:39 | 24356, 38436, 59896, 69556, 73892, 91052 | `MCP reconnect failed after retries`, `path=mcp:omp-spec-kit:omp-spec-kit`: `MCP subprocess closed stdout before responding` (×5), `exited with code 1` (×1). Одновременная потеря двери у всех живых сессий. |
| 09:25:00, 09:26:04 | 61520, 94556 | `CliUsageError: Unknown tool in --tools: spec_graph` — reconnect-пробы при мёртвой двери (`Valid tools` без `mcp__omp_spec_kit_*`). Не падения, а следствие. |
| 09:26:14 | 78720 | `No API key found for openai` — запуск с ненастроенным провайдером. |

## 2. Таймлайн MCP-двери omp-spec-kit

- ~09:21–09:23 — сервер двери умирает на живых сессиях (subprocess закрыл stdout / exit 1).
- 09:23:28–39 — шторм reconnect-ошибок во всех живых PID.
- 09:25–09:26 — пробы `--tools spec_graph` падают (`CliUsageError`).
- 09:27:40 — `omp-spec-kit@omp-spec-kit v1.1.0` переустановлен (`installed_plugins.json`, `06:27:40Z` = 09:27:40 местн.).
- 09:27:43+ — новые сессии идут нормально, дверь жива.
- Команда сервера: `./bin/omp-spec-kit-mcp` (stdio) из кэша плагина. Вывод: переустановка на живых окнах убила дверь на ~6 минут.

## 3. Ошибки моделей, 291 шт. (главная причина «невозможно работать»)

| Кол-во | Провайдер / модель | Текст |
|---|---|---|
| 124 | meta-model-api `muse-spark-1.3` + `-contributor` | `429 Subscription quota exhausted. Resets 2026-09-14T00:00:00Z` — мертво до 14.09 |
| 53 | google-antigravity `gemini-3.8-flash` | `429 Individual quota reached… Resets in ~10h` |
| 40 | anthropic `claude-sonnet-5` | `Connection error.` (пик 29 шт. в 10:00; сеть/прокси, не квота) |
| 30 | openrouter `nex-agi/nex-n2.5-pro:free` | `400 Provider returned error` (пик в 04:00) |
| 7 | xai-oauth `grok-4.6` | `402 usage balance exhausted` |
| 7 | zai `glm-5.3-flash` | `429` 5-часовая + недельная (ресет 13:14, 12.09) |
| 7 | openai-codex `gpt-5.6-luna` | `usage_limit_reached` |
| 8 | byteplus-ark-coding | `429` 5-часовая (ресеты 13:39, 19:59) |
| 7 | cline-pass | `429 Daily free limit` |
| — | Sharpshooter extraction | 454 строки `429` от Cloud Code Assist — извлечение памяти тоже упирается в квоту google-antigravity |

Ошибки идут весь день (01:00 → 19:00, включая 19:00). Цепочка перебора провайдеров упирается в стену на каждом.

## 4. Штормы перезапусков (симптомы, не падения)

- 09:21–09:35: десятки однострочных логов 155 Б (`global proxy fetch not installed` — быстрые CLI-пробы) вокруг outage двери.
- 12:49–13:25: ~40 сессий по ~25 с, все `reason=dispose` (штатное закрытие), каждая: старт → `Sharpshooter extraction failed (429)` → выход. Цикл повторных попыток упёрся в квоты.
- Явных `Session exit`: 77 (почти все `dispose`, несколько `sighup`); 128 файлов без маркера — в основном 1-строчные пробы.

## 5. Фоновый шум (не падения)

`Failed to parse YAML frontmatter`, `model discovery failed for provider llama.cpp` (порт 8080), `ui.loop-blocked`, `OAuth preflight refresh failed`, `plugins: skipping stale lockfile entry (context-mode)`, `Marketplace updated`.

## 6. Причины по убыванию

1. **Квоты всех моделей исчерпаны** — Meta до 14.09, Google ~10-часовые окна, Anthropic рвёт соединение, остальные на лимитах. Рабочий сейчас вариант — `alibaba-token-plan/deepseek-v4-flash` (текущая сессия).
2. **Outage двери omp-spec-kit 09:21–09:27**, закрыт переустановкой.
3. **Один EPIPE-краш 09:13:31** — запись в закрытый stdout во время end-of-turn maintenance (`Auto-compaction threshold decision`) как необработанный rejection убивает процесс. Кандидат в upstream-issue: EPIPE на fd 1 не должен быть фаталом.

## 7. Рекомендации

- Meta `muse-spark` не трогать до 14.09; google-antigravity — ждать окно ~10 ч.
- Плагины не переустанавливать на живых сессиях (убивает MCP-дверь у всех окон).
- EPIPE: держать терминал открытым до конца `agent_end`/компакшна; долгосрочно — глотать EPIPE на stdout в OMP.
