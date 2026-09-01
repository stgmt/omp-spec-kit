# Отключение legacy dev-pomogator от OMP

**Дата аудита:** 2026-08-30  
**Целевой проект:** `E:/repos/omp-spec-kit`  
**Цель:** оставить в OMP только native `omp-spec-kit`; не переносить и не адаптировать legacy dev-pomogator.

## Итог

Да, legacy dev-pomogator сейчас реально подключен к OMP и загрязняет native-сеанс. Но исходная ошибка была не в том, что сам dev-pomogator хранит «фальшивые» спеки. Ошибка в смешении двух plugin-регистраций и двух источников MCP:

- OMP user scope содержит включенный npm/link plugin `dev-pomogator`.
- Его symlink указывает прямо на `E:/repos/dev-pomogator`.
- Legacy plugin поставляет `.mcp.json` с серверами `dev-pomogator-advisor` и `dev-pomogator-specs`.
- Native проектный plugin `omp-spec-kit` подключен отдельно и имеет сервер `omp-spec-kit`.
- OMP умеет одновременно подхватывать native project plugin, OMP user plugins и Claude-compatible user plugins.

Поэтому безопасный cutover должен отключить **обе legacy-регистрации, через которые OMP может их увидеть**, а native проектный plugin оставить.

## Важная поправка к предыдущему forensic-отчету

Предыдущий файл `audit-reports/forensic-session-01a05200-advisor-data.md` содержал неверные ссылки на:

- несуществующий сервер `target-specs-maintenance`;
- несуществующий `E:/repos/omp-spec-kit/.omp/mcp.json`;
- `SPECS_GENERATOR_ROOT` как настройку omp-spec-kit;
- неподтвержденную привязку identity hash к этому серверу.

Этот отчет заменяет те утверждения. Реальные native/legacy имена и пути приведены ниже.

## Фактическая регистрация сейчас

### Native `omp-spec-kit`

Фактический пакетный MCP-конфиг:

`E:/repos/omp-spec-kit/plugins/omp-spec-kit/.mcp.json:3-8`

```json
"omp-spec-kit": {
  "type": "stdio",
  "command": "./bin/omp-spec-kit-mcp"
}
```

Проектный registry:

`E:/repos/omp-spec-kit/.omp/plugins/installed_plugins.json:4-10`

```json
"omp-spec-kit@omp-spec-kit": {
  "scope": "project",
  "version": "0.3.2"
}
```

Native package сам описывает поверхность как bounded read-only: `plugins/omp-spec-kit/README.md:1-15`. Код подтверждает:

- `src/mcp/server.js:1-7` — только read-only MCP, без mutation и filesystem writes;
- `src/mcp/server.js:9-11` — root берется из `OMP_SPEC_KIT_ROOT`, иначе из cwd процесса;
- `src/mcp/server.js:19` — server name `omp-spec-kit`;
- `src/v0.1/extension.js:27-63` — `spec_inventory` плюс семь read-only graph/query tools.

Реальный native smoke в текущем OMP-сеансе прошел:

```text
inventory ok, returned=8/8
```

### Legacy `dev-pomogator` в OMP user scope

User OMP lock:

`C:/Users/stigm/.omp/plugins/omp-plugins.lock.json:23-27`

```json
"dev-pomogator": {
  "version": "2.0.6",
  "enabled": true
}
```

Реальный пакет в OMP user node_modules:

```text
C:/Users/stigm/.omp/plugins/node_modules/dev-pomogator
  -> E:\repos\dev-pomogator
```

`package.json` по этому пути подтверждает `dev-pomogator` версии `2.0.6` и legacy MCP/Claude package metadata: `C:/Users/stigm/.omp/plugins/node_modules/dev-pomogator/package.json:1-35`.

Фактический OMP CLI inventory в cwd `E:/repos/omp-spec-kit` вернул:

```json
{
  "npm": [
    {"name":"omp-dynamic-workflows", "enabled":true},
    {"name":"omp-extension-probe", "enabled":true},
    {"name":"claude-plugin-probe", "enabled":true},
    {"name":"omp-cwd-probe-2", "enabled":true},
    {
      "name":"dev-pomogator",
      "version":"2.0.6",
      "path":"C:\\Users\\stigm\\.omp\\plugins\\node_modules\\dev-pomogator",
      "enabled":true
    }
  ],
  "marketplace": [
    {"id":"omp-spec-kit@omp-spec-kit", "scope":"project"}
  ]
}
```

Это прямое доказательство: OMP видит legacy `dev-pomogator` одновременно с native `omp-spec-kit`.

### Legacy Claude-compatible registration

Отдельно существует user-scoped Claude registry:

`C:/Users/stigm/.claude/plugins/installed_plugins.json:81-98`

```json
"dev-pomogator@stgmt": [
  {
    "scope": "user",
    "installPath": "C:\\Users\\stigm\\.claude\\plugins\\cache\\stgmt\\dev-pomogator\\2.0.4",
    "version": "2.0.4"
  }
]
```

Эта запись тоже важна для OMP: установленный runtime OMP читает Claude-compatible plugin roots. Поэтому удалить только OMP npm/link entry недостаточно для гарантии «legacy полностью отключен от OMP».

## Почему legacy MCP попал в native-сеанс

Пинованный OMP runtime содержит следующие механизмы.

1. `src/extensibility/plugins/loader.ts:40-55` читает user `omp-plugins.lock.json`.
2. `loader.ts:72-156` собирает включенные пакеты из user `node_modules` и runtime lock; `enabled:false` исключает пакет.
3. `loader.ts:164-216` объединяет user и project plugin scopes.
4. `src/discovery/omp-extension-roots.ts:168-207` добавляет включенные npm/link plugins как extension roots.
5. `omp-extension-roots.ts:249-267` возвращает root пакета в OMP discovery.
6. `src/discovery/omp-plugins.ts:274-348` читает `.mcp.json` extension package и регистрирует каждый сервер.
7. `src/discovery/helpers.ts:911-1031` дополнительно читает Claude user registry и project registry.
8. `src/discovery/claude-plugins.ts:421-593` читает fallback `.mcp.json` legacy plugin и namespac'ит его серверы.

Результат: наличие `dev-pomogator` в OMP user lock уже достаточно, чтобы его `.mcp.json` стал частью discovery. Claude user registry — второй независимый путь возврата legacy surface.

В `E:/repos/dev-pomogator/.mcp.json:3-24` реально объявлены:

- `dev-pomogator-advisor`;
- `dev-pomogator-specs`;
- launcher `./tools/mcp-stdio-launcher.mjs`.

## Что именно было причиной инцидента Advisor

Нужно разделять два факта:

- **Legacy dev-pomogator был источником чужого MCP-графа** и сделал неправильный маршрут доступным.
- **Карточки `<advisory>` из исследованного сеанса не доказывают вызов `dev-pomogator-advisor`.** Они записаны в native OMP child transcript `__advisor.jsonl`; native OMP runtime содержит собственный Advisor и собственную настройку `advisor.enabled`.

Текущая глобальная настройка OMP:

`C:/Users/stigm/.omp/agent/config.yml:44-45`

```yaml
advisor:
  enabled: true
```

Native OMP contract подтверждается `src/config/settings-schema.ts:450-459`: Advisor — отдельная встроенная функция OMP, которая пассивно проверяет ходы и добавляет заметки. `src/advisor/advise-tool.ts:44-75` определяет формат `<advisory>` и то, что `concern`/`blocker` прерывают текущий вызов.

Вывод: удаление legacy dev-pomogator устранит foreign MCP/skills/hooks/commands, но **само по себе не выключит native OMP Advisor**. Если нужны вообще никакие автоматические блокеры, это отдельное решение: `advisor.enabled: false`.

## Что не нужно удалять в рамках OMP cutover

Это не активная legacy-регистрация и должно остаться:

- `docs/upstream/dev-pomogator/` — immutable historical provenance snapshot;
- `IMPORT_MANIFEST.yaml` и `MIGRATION_MATRIX.md` — документированная история происхождения и решений;
- `.dev-pomogator/` в `omp-spec-kit` — ignored BDD/release state, который сейчас использует native `scripts/docker-bdd.sh:42-43`;
- ссылки на dev-pomogator в README, SECURITY, research и migration docs, пока они явно обозначены как исторические/reference.

Их удаление превратило бы отключение внешнего plugin в отдельную destructive cleanup-задачу и могло бы сломать native BDD/release evidence path.

## Рекомендуемый план работ

### Фаза 0 — зафиксировать состояние и закрыть живые процессы

1. Закрыть все OMP-сеансы, использующие текущий plugin inventory.
2. Сохранить redacted backup только трех конфигураций:
   - `C:/Users/stigm/.omp/plugins/omp-plugins.lock.json`;
   - `C:/Users/stigm/.omp/plugins/package.json`;
   - `C:/Users/stigm/.claude/plugins/installed_plugins.json`.
3. Записать baseline:
   - `omp plugin list --json`;
   - native `omp-spec-kit` inventory;
   - наличие legacy MCP tool names.

### Фаза 1 — отключить legacy registrations без удаления исходников

1. Отключить OMP npm/link plugin `dev-pomogator` штатной командой `omp plugin disable dev-pomogator`.
2. Проверить, что user OMP lock содержит `enabled:false`, а `omp plugin list --json` больше не показывает legacy в enabled npm list.
3. Отключить или удалить user-scoped Claude plugin `dev-pomogator@stgmt` через штатный Claude plugin lifecycle. Пока эта user entry активна, OMP compatibility discovery может снова подхватить legacy plugin.
4. Не редактировать вручную `.dev-pomogator/.mcp-lock.json`; это runtime lock исходного проекта, не OMP registration.
5. Не удалять `E:/repos/dev-pomogator` на этой фазе: сначала должен быть доказан нулевой OMP runtime reachability.

### Фаза 2 — удалить OMP link после smoke

После успешного чистого smoke:

1. Выполнить `omp plugin uninstall dev-pomogator` для удаления OMP user link/package registration.
2. Убедиться, что symlink `C:/Users/stigm/.omp/plugins/node_modules/dev-pomogator` исчез, а исходный `E:/repos/dev-pomogator` не затронут.
3. Повторно прочитать lock и `omp plugin list --json`.

Отключение перед uninstall дает rollback без восстановления исходного кода. Удаление symlink — финальная cleanup-операция, не первый шаг.

### Фаза 3 — поднять чистую native-сессию

1. Запустить новый OMP-сеанс из `E:/repos/omp-spec-kit`.
2. Проверить, что доступен native сервер `omp-spec-kit` и работает `spec_inventory`.
3. Проверить отсутствие:
   - `dev-pomogator-advisor`;
   - `dev-pomogator-specs`;
   - legacy `mcp__dev_pomogator_*` routes;
   - legacy skills/commands/hooks из `E:/repos/dev-pomogator`.
4. Убедиться, что native inventory по-прежнему возвращает 8 текущих спек.
5. Проверить OMP runtime log: не должно быть spawn/reconnect для legacy dev-pomogator.

### Фаза 4 — отдельно решить судьбу native Advisor

Рекомендованный первый baseline — временно выключить native OMP Advisor через глобальную настройку `advisor.enabled: false`, чтобы проверить native surface без автоматических blocker interruptions.

Альтернатива: оставить `advisor.enabled: true`. Тогда это уже не legacy dev-pomogator, но native Advisor нужно проверять отдельным acceptance smoke: его карточки не должны делать rootless утверждения о наличии/отсутствии файлов.

Это независимое решение; не смешивать его с удалением legacy plugin.

### Фаза 5 — не обещать скрытую миграцию возможностей

Текущий native `omp-spec-kit` v0.3.2 — read-only inventory/query surface. Он не является полной заменой legacy spec-generator, mutation doors, hooks, backlog, Advisor MCP или dashboards.

В рамках этого cutover намеренно не переносить эти возможности. Если позже понадобятся native записи/ремонт/authoring, это отдельная native feature plan в `omp-spec-kit`, с собственным контрактом и тестами, а не копирование dev-pomogator.

## Acceptance criteria

Cutover можно считать успешным только если одновременно выполняются все условия:

- `omp plugin list --json` не показывает enabled `dev-pomogator` в npm plugins;
- user OMP lock не включает legacy plugin;
- Claude user registry не оставляет активную `dev-pomogator@stgmt` entry, если требуется полный OMP isolation;
- legacy symlink/package root не участвует в OMP discovery;
- свежий OMP-сеанс видит native `omp-spec-kit`;
- `spec_inventory` возвращает текущие 8 спек;
- native BDD/release path продолжает работать с `.dev-pomogator/` state;
- historical `docs/upstream/dev-pomogator/` остаётся только provenance и не загружается как plugin;
- ни один legacy MCP/skill/hook/command не запускается.

## Rollback

До Фазы 2 rollback простой: вернуть `enabled:true` в OMP plugin lifecycle и восстановить активность Claude plugin через штатный registry command. После uninstall потребуется повторный `omp plugin link`/install из сохраненного `E:/repos/dev-pomogator`, поэтому uninstall выполняется только после чистого smoke.

## Резюме решения

**Рекомендуемое решение:** отключить и затем удалить OMP user registration `dev-pomogator`, убрать активную Claude user registration `dev-pomogator@stgmt`, оставить проектный native `omp-spec-kit`, перезапустить OMP, проверить только native MCP surface и отдельно решить, нужен ли встроенный OMP Advisor.

Это удаляет legacy влияние из OMP без удаления исторической документации и без разрушения native BDD/release state.
## Execution receipt

Выполнено 2026-08-30 после подготовки этого плана:

- `omp plugin disable dev-pomogator` завершился успешно.
- `omp plugin uninstall dev-pomogator` завершился успешно.
- Legacy path `C:/Users/stigm/.omp/plugins/node_modules/dev-pomogator` удален; отдельная проверка подтвердила `legacy OMP path absent; source repo present`.
- User-scoped `claude plugin uninstall dev-pomogator@stgmt --scope user` завершился успешно.
- `claude plugin list --json` оставил только отключенную project-scoped запись для `E:/repos/WHW_AI_Private`; user-scoped legacy entry удалена.
- Финальный `omp plugin list --json` не содержит `dev-pomogator`; project marketplace содержит native `omp-spec-kit` версии `0.3.2`.
- Zero-reference поиск по активным OMP lock/registry/MCP config не нашел `dev-pomogator`, `DEV_POMOGATOR` или `mcp__dev_pomogator`.
- Native MCP smoke через `plugins/omp-spec-kit/bin/omp-spec-kit-mcp` вернул `inventory ok, returned=8/8`.
- Свежий `omp -p` probe также дошел до `omp-spec-kit:omp-spec-kit` и получил `8 specifications found; 8 returned`; внешний wrapper затем превысил timeout при завершении вывода. Чистым runtime proof считается прямой native MCP smoke плюс финальный plugin inventory.

Встроенный OMP Advisor не изменялся: `advisor.enabled` остается отдельной native настройкой.
