> **Статус: черновик.** Получен workflow `wf_90e5c250-b05` (2026-10-09): аудит репозитория, веб-исследование, адверсариальная проверка и синтез.
> Открытые вопросы Q1–Q4 (§6) не решены. Перед P1 их нужно закрыть. Фактические проверки запуском помечены `run`, первичные доки — `doc`.
> Побочный эффект аудита исправлен: в `.git/config` была строка `autocrlf = core.filemode`, она ломала git. Локальный ключ удалён, глобальной настройки нет, системная `core.autocrlf=true` действует как раньше.

# План: полная интеграция omp-spec-kit с Claude Code (рядом с OMP)

## 1. Вывод и рекомендация

Рекомендую добавить в тот же репозиторий второй, изолированный дистрибутив для Claude Code. Он состоит из корневого `.claude-plugin/marketplace.json` и сгенерированного каталога `hosts/claude/omp-spec-kit/` (manifest, `.mcp.json`, hook, skills). Каталог собирается из тех же `src/` и `plugins/omp-spec-kit/dist/`. Каталоги `plugins/omp-spec-kit/` и `.omp-plugin/` остаются побайтно неизменными, а OMP-гейты, Docker-BDD и OMP-рантайм затрагиваются минимально (одна правка `verify-marketplace.mjs`). Класть `.claude-plugin/` внутрь самого OMP-плагина нельзя по двум причинам. Во-первых, это ломает `verify-package` и Docker-сборку (проверено запуском). Во-вторых, пиннутый рантайм OMP 18.0.11 читает `.claude-plugin/plugin.json` и отдаёт его `mcpServers` приоритет над `.mcp.json`. «Фулпауэр» понимаю как MCP, skills, hook-энфорсмент и проверочные скрипты.

- Главный риск не упаковка, а энфорсмент. OMP-классификатор на событиях Claude Code молча пропускает Write/Edit/Read/NotebookEdit по `.specs` (проверено запуском). Нужен новый fail-closed адаптер hook, а классификатор переиспользуется без изменений.
- MCP-сервер переносится как есть. Он берёт только `node:`-модули и стартует из копии каталога. Запуск меняется на `node ${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js`, sh-лаунчер не нужен.
- Из 5 skills в Claude-сборку идут 3. Maintainer-only `release-operator` и `tool-e2e` исключаются. `spec-inventory` зовёт несуществующий `spec_inventory` и переписывается.
- MVP (P0–P6) не меняет OMP payload и не требует нового релиза. Общие дефекты сервера вынесены в P7.
- Начать нужно со spike (P0). Он закрывает неподтверждённые места: cwd и подстановки в MCP, рукопожатие v2, форму `mcp_server.source`.
- Оценка (шкала моя: S ≈ до полдня, M ≈ 1–2 дня, L ≈ 3–5 дней): P0 S, P1 M, P2 S, P3 L, P4 S, P5 S, P6 M, P7 L.

## 2. Что уже совместимо, что нет

Метки доказательств: run — выполнено кодом, doc — первичные доки (на 2026-10-09), read — чтение кода.

| Компонент | Состояние | Действие | Доказательство |
|---|---|---|---|
| Каталог marketplace | Есть только `.omp-plugin/marketplace.json`. Его копия в `.claude-plugin/` проходит `claude plugin validate` | Добавить Claude-каталог. В `verify-marketplace.mjs:160-164` разрешить его (сейчас «ровно один каталог») | run: validate 2.1.219 exit 0. run: mini-repo, второй каталог отклонён |
| Manifest плагина | Нет. По doc он опционален, но validate 2.1.219 без него падает («No manifest found») | `plugin.json` только в Claude-каталоге | run: validate. run: `verify-package` отклонил `.claude-plugin/plugin.json` в OMP-плагине |
| `omp.extensions`, `engines.omp`, `extension.js`, `adapter.js`, plan gate, OMP URI allowlist | OMP-only | Не трогать | read: `package.json:23-30`, `adapter.js:13-19`. run: `verify-package` фиксирует ключи |
| MCP-сервер `dist/mcp/server.js` | Стартует из копии вне репо, 10 tools, 32 модуля, SDK не импортирует | Переиспользовать | run: copy-тест, граф импортов |
| Рукопожатие MCP | Сервер возвращает любую `protocolVersion` (`server.js:222-228`), `server/discover` даёт -32601 сразу | MVP: не менять, проверить вживую. Фикс в P7 | run: эхо `1900-01-01`. doc: версию надо согласовывать. UNCERTAIN: реакция Claude Code v2 (вывод из спецификации) |
| `.mcp.json` | OMP `$schema` и `./bin/omp-spec-kit-mcp` (sh) | Новый Claude `.mcp.json`: `node` + `${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js`, `env OMP_SPEC_KIT_ROOT=${CLAUDE_PROJECT_DIR}`, без `$schema`, без `OMP_SPEC_KIT_PACKAGE_ROOT` | run (Node spawn): sh даёт ENOENT, `.cmd` даёт EINVAL, node работает. UNCERTAIN: relative `command` и cwd в Claude Code |
| Корень репозитория | cwd fallback. `OMP_SPEC_KIT_ROOT` игнорируется при `${` в значении. `PACKAGE_ROOT == cwd` роняет процесс при загрузке | ROOT задать, PACKAGE_ROOT не задавать | run: `query-service.js:71-111`, exit 1 |
| Hook-энфорсмент | Claude Write/Edit/Read/NotebookEdit по `.specs` дают `continue` (fail-open): в `PATH_KEYS` нет `file_path` и `notebook_path`, имена регистрозависимы | Новый адаптер (P3) | run: 4 из 4 пропущены |
| Glob/Grep/Bash/PowerShell | Glob/Grep блокируются, но с кодом `RAW_SPEC_WRITE`. Bash — regex по литералу: `.spe""cs` проходит, `.specs-repo` блокируется | Нормализовать имена. Bash оставить барьером, не песочницей | run |
| Собственные MCP-инструменты | Имена `mcp__plugin_omp-spec-kit_omp-spec-kit__*` не доходят до design-review/provenance-проверок. REFUTED: OMP-имя `mcp__omp_spec_kit_*`, а не `mcp__omp-spec-kit_*`. Для Claude не подходят оба | Маппинг в нормализаторе | run |
| Skill `engineering-anti-bique` → `engineering-anti-bike` | Валиден как есть (name+description, name = каталог) | Копировать | run: проверка frontmatter |
| `spec-elicitation` | `ask` и `skill://` — OMP-измы | Overlay без названий инструментов хоста | read: `SKILL.md:13,17`, `elicitation-guard.js:4-6` |
| `spec-inventory` (skill и command) | Вызывают `spec_inventory`, его нет среди 10 tools. `maxSpecs`/`maxDiagnostics` нет ни в одной схеме | В Claude: skill на `spec_catalog` (`view: inventory`). Command не включать (коллизия имён UNCERTAIN) | run: tools/list. read: `RETIRED_TOOL_NAMES` |
| `release-operator`, `tool-e2e` | Maintainer-only, широкие триггеры | Не включать в Claude-сборку | read |
| `dist/` в git | Закоммичен (43 файла) | Claude-каталог тоже коммитить: кэш Claude копирует только каталог плагина | run (shadow index). doc |
| Гейты и CI | `verify-marketplace`, `verify-package`, Docker и BDD жёстко закрывают раскладку. В fixture cucumber 62 из 331 хэшей не совпадают уже на HEAD | Baseline в P0. Править только `verify-marketplace.mjs` | run. UNVERIFIED: красный ли `release-evidence.feature` |
| README, `docs/omp-v18.0.10-contract.md`, README плагина | Устарели (старые 8 имён tools, «v0.4.0») | Обновить (P6, P7) | read |

## 3. Целевая архитектура: one source of truth plus thin adapters

```
src/                              # единый источник логики (в MVP без изменений)
plugins/omp-spec-kit/             # OMP-дистрибутив, payload побайтно неизменен
.omp-plugin/marketplace.json      # OMP-каталог, без изменений
.claude-plugin/marketplace.json   # NEW: name=omp-spec-kit, source=./hosts/claude/omp-spec-kit
hosts/claude/
  overlay/                        # NEW: рукописное, только Claude
    .claude-plugin/plugin.json
    .mcp.json
    hooks/hooks.json
    hook/pretooluse.mjs           # stdin -> normalize -> classifyToolCall -> exit 0|2, fail-closed
    hook/normalize.mjs            # tool_name/tool_input Claude -> форма классификатора
    skills/spec-elicitation/SKILL.md
    skills/spec-inventory/SKILL.md
    README.md
  omp-spec-kit/                   # NEW: СГЕНЕРИРОВАН, коммитится
scripts/build-claude-plugin.mjs   # NEW
scripts/verify-claude-plugin.mjs  # NEW
tests/claude/*.test.mjs           # NEW (только новые файлы)
.github/workflows/claude-plugin.yml  # NEW, существующие workflows не правим
```

- **Что получает сгенерированный каталог.** Он включает overlay, подмножество `dist/` по графу импортов `server.js` и `classifier.js`, skill `engineering-anti-bike` и LICENSE. Файлы `dist` и skills там побайтно равны исходным, это проверяет `verify-claude-plugin.mjs`.
- **Общее для обоих хостов.** Это server, kernel, services, `classifier.js`, `resolve-targets.js` (только reuse) и skill anti-bike.
- **Adapter Claude владеет.** Каталог, `plugin.json`, `.mcp.json`, `hooks.json`, нормализатор, два overlay-skill, README, build и verify.
- **Только OMP.** `extension.js`, `adapter.js`, `.omp-plugin`, `bin/*`, OMP `.mcp.json`, ключи `omp`/`engines.omp`, lifecycle producers, plan gate, OMP URI allowlist.
- **Отклонено.**
  - `.claude-plugin/` внутри `plugins/omp-spec-kit`: ломает гейты и Docker, затрагивает чтение manifest в OMP.
  - Inline `mcpServers` в `plugin.json` как «переопределение только для Claude»: REFUTED, в fixture 18.0.11 OMP читает его тоже.
  - Отдельный репозиторий: запасной вариант при отказе по Q1.

## 4. Пошаговый план работ

### P0. Базовая линия, гигиена, spike (S)
Цель: зафиксировать, что красное до работ, и закрыть UNCERTAIN.
Задачи:
1. Убрать из `.git/config` ошибочную строку `autocrlf = core.filemode`: `git config --local --unset core.autocrlf`. Её записал аудит по ошибке, git сейчас падает. Удалить временные каталоги вне репо: `C:/Users/stigm/AppData/Local/Temp/{omp-sk-copy-test,unrelated-proj-xyz,ompsk-verify-6bjTd4}`. Создать ветку `claude-integration`.
2. Baseline: `npm run build && npm run verify && npm run test:unit` и Docker-BDD (`tests/distribution`). Записать, что красное на HEAD, особенно `release-evidence.feature`.
3. Обновить Claude Code до версии 2.1.292 или новее. Стоит 2.1.219: в ней нет stdio-пробы 2026-07-28 и нет проверки `.mcp.json`. Выполнить `gh repo view stgmt/omp-spec-kit --json visibility`.
4. Spike вне репо. Собрать каталог вручную из копии плагина с минимальными `plugin.json`, `.mcp.json` и `hooks.json`, где hook пишет stdin в лог. Запустить `claude --plugin-dir <dir>`. Зафиксировать:
   - cwd сервера;
   - подстановку `${CLAUDE_PROJECT_DIR}` в env;
   - рукопожатие в `/mcp`;
   - реальный JSON PreToolUse (включая `mcp_server.source` и `NotebookEdit`);
   - правило корня для hook.

Приёмка: baseline-таблица лежит в описании PR, результаты spike записаны, ответ на Q1 получен.
Проверка: `git status`, `claude --debug`, `/mcp`, `claude plugin list`.

### P1. Скелет Claude-дистрибутива (M)
Задачи:
- `scripts/build-claude-plugin.mjs` и `scripts/verify-claude-plugin.mjs`.
- `hosts/claude/overlay/.claude-plugin/plugin.json` (`name: omp-spec-kit`, `version` по Q3) и overlay `.mcp.json` по §2.
- Корневой `.claude-plugin/marketplace.json`: marketplace `omp-spec-kit`, plugin `omp-spec-kit`, поля из `.omp-plugin/marketplace.json`, `version` не дублировать, `$schema` опустить.
- Правка `scripts/verify-marketplace.mjs:134-164`: игнорировать Claude-каталог, остальное не менять.
- Скрипты `build:claude` и `verify:claude` в `package.json`.
- Обновить текст спеки plugin-distribution («второго каталога нет») и шаг `plugin-distribution.steps.mjs:290-300`, если изменится stdout.
- `tests/claude/mcp-launch.test.mjs`: берёт сгенерированный `.mcp.json`, сам подставляет переменные, запускает без shell из чужого cwd и ждёт initialize + tools/list = 10 tools.

Приёмка: каталог собирается детерминированно, validate проходит, gate P5 зелёный.
Проверка: `npm run build:claude && npm run verify:claude`; `claude plugin validate .`; `claude plugin validate hosts/claude/omp-spec-kit`; `claude plugin marketplace add ./`.

### P2. Skills (S)
Задачи:
- Overlay `spec-inventory` на `spec_catalog` (`view: inventory`, `limit`; полное имя `mcp__plugin_omp-spec-kit_omp-spec-kit__spec_catalog` в `allowed-tools`).
- Overlay `spec-elicitation` без названий OMP-инструментов, с пометкой, что `skill://spec-elicitation` из текста серверных ошибок означает этот skill.
- `verify:claude` проверяет, что skills ровно 3, command нет, а подстрок `spec_inventory` и `skill://` в них нет.

Приёмка: в живой сессии `/omp-spec-kit:spec-inventory` вызывает `spec_catalog` и отдаёт данные fixture-проекта.
Проверка: `npm run verify:claude`, ручной прогон.

### P3. Hook-энфорсмент (L)
Задачи:
- `hooks/hooks.json`: PreToolUse, matcher `Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit|Read|Grep|Glob|mcp__plugin_omp-spec-kit_omp-spec-kit__.*`. Exec-форма: `node` + `${CLAUDE_PLUGIN_ROOT}/hook/pretooluse.mjs`, timeout не больше 10 с.
- `hook/normalize.mjs`: `file_path` и `notebook_path` переводятся в `path`, Bash/PowerShell в `command`. Одно правило корня для hook и server по итогам P0.
- Собственные MCP-инструменты определяются по `mcp_server.source`, а не по префиксу имени.
- `hook/pretooluse.mjs` fail-closed: пустой или битый stdin, неизвестная форма и любое исключение дают exit 2 с причиной в stderr. Размер stdin ограничен. `classifier.js` не меняется.
- `tests/claude/hook.test.mjs` запускает сам hook-скрипт на кейсах аудита: Write/Edit/Read/NotebookEdit/Glob/Grep/Bash/PowerShell по `.specs`, сессия в подкаталоге, MSYS-путь, битый JSON, `spec_patch`.

Приёмка: мутации `.specs` и (по Q2) чтения дают exit 2. Не-spec вызовы дают exit 0 без вывода. В живой сессии Write в `.specs/x/y.md` отклоняется с причиной.
Проверка: `node --test tests/claude/`, `claude --debug`.

### P4. CI (S)
Задачи: `.github/workflows/claude-plugin.yml` на ubuntu и windows, Node 22. Шаги: `npm ci`, `build:claude` с `git diff --exit-code hosts/claude` (контроль дрейфа), `verify:claude`, `node --test tests/claude/`, `claude plugin validate` (установка CLI через npm не проверялась в аудите).
Приёмка: зелёный на обеих ОС. Node 22 в аудите не запускался, это первый прогон.

### P5. Гейт «OMP остаётся зелёным» (S, после каждой фазы и финально)
Команды:
- `git diff --exit-code -- plugins/omp-spec-kit .omp-plugin` — пусто.
- `npm run build && npm run verify && npm run test:unit` и Docker-BDD — не хуже baseline P0.
- Установка OMP по `README.md:11-12` в чистый профиль: `tools/list` даёт 10 tools, enforcement-hook живой, skills и tools не дублируются.
- Проверить OMP 18.0.11 (пин, есть fixture) и 18.8.4 (установлен, в аудите не тестировался).

Приёмка: новых красных относительно baseline нет.

### P6. Установка из GitHub end to end (M)
Шаги:
1. На ветке, в чистом temp-проекте, scope local: `/plugin marketplace add stgmt/omp-spec-kit#claude-integration`, затем `/plugin install omp-spec-kit@omp-spec-kit`.
2. После merge в main, на чистом профиле: `/plugin marketplace add stgmt/omp-spec-kit` и `/plugin install omp-spec-kit@omp-spec-kit`, затем `/reload-plugins`.

Проверки:
- вкладка Errors в `/plugin` пуста;
- `/mcp` показывает `plugin:omp-spec-kit:omp-spec-kit` как connected;
- `spec_catalog` на fixture со `.specs` возвращает данные;
- `/omp-spec-kit:spec-inventory` работает;
- Write в `.specs` отклоняется hook'ом;
- `claude plugin list` и `claude plugin details omp-spec-kit` без ошибок;
- Windows native и Linux/WSL;
- цикл обновления: новый коммит, затем `/plugin marketplace update omp-spec-kit` и `claude plugin update omp-spec-kit@omp-spec-kit` (поведение зависит от Q3).

Уборка: `claude plugin uninstall`, `claude plugin marketplace remove`. Добавить в `README.md` секцию «Claude Code»: две команды, минимальная версия CLI, Node на PATH, оговорка «hook — барьер, не песочница».
Приёмка: все проверки пройдены на двух ОС, лог приложен к PR.

### P7. Общие дефекты и релиз (L, отдельный релиз, после Q4)
Задачи:
- `server.js`: согласовывать только реально поддерживаемые версии протокола.
- `PACKAGE_ROOT_REFUSED` вернуть как JSON-RPC-ошибку, а не падение процесса.
- Запасной корень через `CLAUDE_PROJECT_DIR`.
- Исправить `plugin: "1.0.0"` (`document-service.js:243`).
- OMP-сторона: исправить `spec-inventory` skill и command, README плагина, `docs/omp-v18.0.10-contract.md`.
- Версию 2.8.1 обновить во всех местах: `verify-marketplace.mjs:5`, `build-plugin.mjs:6`, `extension.js` (+ Claude, если решение Q3 это требует).
- Обновить fixture cucumber (`scripts/refresh-cucumber-fixture.mjs`, нужен Docker-BDD), выпустить тег, пройти `distribution-evidence` и `release`.
- Решить, входит ли Claude-каталог в release candidate и evidence. Сейчас в tar попадает только `plugins/omp-spec-kit`.

Приёмка: `verify.yml`, `distribution-evidence.yml`, `release.yml` зелёные, P6 повторён на релизе.

## 5. Риски и меры (ранжированы)

1. **Ложное чувство защиты.** Hook молча не срабатывает при отсутствии Node, при `disableAllHooks` и при таймауте (doc: fail-open). Bash-regex обходится (run). Меры: fail-closed обёртка, тесты на Claude-формах, серверные гейты `spec_patch` остаются авторитетом, в README написано «барьер, не песочница». Без Node не стартует и MCP, это видно в `/mcp`.
2. **Запуск MCP в Claude Code не доказан.** UNCERTAIN: relative `command` и cwd. Подстановки в env не проверены. Рукопожатие v2 не проверено. `validate` 2.1.219 `.mcp.json` не проверяет (run). Меры: spike на CLI ≥ 2.1.292, launch-contract тест, запасной `MCP_PROTOCOL_NEGOTIATION=legacy`, фикс в P7.
3. **Регрессия OMP через гейты и CI.** Затрагивает правка `verify-marketplace.mjs`, Docker, BDD, fixture (62 из 331 уже расходятся). Меры: отдельный каталог, нулевой diff OMP payload, гейт P5, baseline P0.
4. **Политика «второго каталога нет»** в замороженных спеках plugin-distribution. Решение владельца (Q1).
5. **Дрейф сгенерированного каталога от `src/`.** Мера: `verify:claude` и `git diff --exit-code` в CI.
6. **Разные корни у hook и server** (подкаталог, worktree: `CLAUDE_PROJECT_DIR` за worktree не следует, `event.cwd` следует). Меры: единое правило корня в P3, тесты, фиксация в README.
7. **Версионирование.** С `version` пользователи застревают до bump. Без `version` каждый коммит считается обновлением (doc). Решение Q3.
8. **Зависимость от версии Claude Code.** Стоит 2.1.219, нужные фичи начинаются с 2.1.275 / 2.1.281 / 2.1.292. Мера: минимум в README.
9. **Дефекты контента у потребителей** (`spec_inventory`, OMP-измы). Меры: overlay в P2, OMP-сторона в P7.
10. **Node.** Нужен на PATH, `engines.node` равен 22, а прогонялось на 24.17. Мера: матрица CI в P4.

## 6. Открытые вопросы для владельца

1. Можно ли держать в этом репозитории второй каталог `.claude-plugin/marketplace.json`? Замороженная спека plugin-distribution прямо говорит «Claude fallback catalog отсутствует, второго каталога нет». Если нельзя, нужен отдельный репозиторий (например `stgmt/omp-spec-kit-claude`), и команды установки из задачи станут другими.
2. Должен ли Claude Code блокировать прямое чтение `.specs` (Read/Grep/Glob с редиректом на MCP, как в OMP) или только запись? От ответа зависят matcher и тесты в P3.
3. Канал обновлений для Claude: rolling (без `version`, любой коммит считается обновлением) или только релизы (`version` в `plugin.json` и bump на каждый релиз)? От ответа зависят `verify:claude` и процесс релиза.
4. Чинить ли общие дефекты (протокол сервера, `spec-inventory` в OMP) отдельным релизом после MVP (моя рекомендация) или сразу, до публикации Claude-дистрибутива? Во втором случае MVP получает новый релиз и полный release evidence.

## 7. Ограничения доказательств

**Проверено запуском кода:**
- Старт сервера из копии вне репо, 10 tools, граф импортов (32 модуля, только `node:`).
- Эхо `protocolVersion` и реакция на `server/discover` (-32601).
- Fail-open на Write/Edit/Read/NotebookEdit.
- Поведение Glob/Grep/Bash/PowerShell и MCP-имён.
- Расхождение корней при сессии в подкаталоге.
- Node `spawn` на Windows: sh даёт ENOENT, `.cmd` даёт EINVAL, node работает.
- Отклонение второго каталога и `plugin.json` гейтами (mini-repo).
- `claude plugin validate` 2.1.219: каталог проходит, плагин без манифеста падает, `.mcp.json` не проверяется.
- Пересчёт хэшей fixture: 62 из 331 расходятся.
- Версии инструментов: node 24.17.0, bun 1.4.1, claude 2.1.219, omp 18.8.4.

**Подтверждено первичными доками (на 2026-10-09):**
- раскладка плагина и маркетплейса, типы source;
- семантика кэша и версий;
- переменные и порядок merge MCP-серверов;
- имена MCP-инструментов;
- правила skills;
- семантика hook (exit 2, fail-open);
- правило согласования версии протокола и порядок stdio-пробы;
- default-проба 2026-07-28 с Claude Code 2.1.292.

**REFUTED, и это учтено в плане:**
- inline `mcpServers` в `plugin.json` действует «только на Claude» (OMP 18.0.11 читает его тоже);
- «плоской формы `.mcp.json` нет» (она задокументирована, но используется форма с `mcpServers`);
- OMP-имя MCP как `mcp__omp-spec-kit_*` (верно `mcp__omp_spec_kit_*`);
- ложное срабатывание на буквальном `spec_inspect(paths:[".specs/.."])` (на `.specs/foo` срабатывает).

**UNCERTAIN или UNVERIFIED, ни одно из них не принимает решений без проверки:**
- relative `command` и cwd stdio-сервера в Claude Code (проверка в P0);
- подстановка `${CLAUDE_PROJECT_DIR}` в env плагина на живом клиенте (P0);
- поведение рукопожатия v2 с нашим сервером и «запоминание на 7 дней» (вывод из спецификации, P0 и P6);
- форма `mcp_server.source` и `NotebookEdit` в живом hook-событии (P0);
- запуск `.sh` и `.cmd` самим Claude Code на Windows (проверено только на уровне Node);
- имя `AskUserQuestion` как аналога `ask` (план от него не зависит, формулировка нейтральная);
- коллизия command и skill с одним именем внутри плагина (command не включается);
- красный ли `release-evidence.feature` на HEAD (P0);
- OMP 18.8.4 (тестировались только fixture-рантайм 18.0.11 и чтение кода), Node 22;
- `MultiEdit` (в docs нет, оставлен в matcher безвредно);
- установка CLI через npm в CI;
- видимость репозитория для анонимной установки (проверка в P0).

**Не исследовалось:** корневой каталог `skills/` (в частности `spec-stack-setup`), HTTP-сервис `src/service/http.js`, детали release evidence для Claude-артефакта.

**Прецеденты** (compound-engineering, context-mode, cc-safety-net, claude-mem, superpowers) прочитал только исследователь, верификаторы их не проверяли. Они иллюстрируют подход «ядро плюс тонкие адаптеры», но на решения не влияют.
