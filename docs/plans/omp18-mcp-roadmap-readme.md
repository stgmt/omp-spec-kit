# План: обновить OMP, довести MCP-поверхность и переписать публичные документы

## 💬 Простыми словами

### Сейчас (как работает)

В репозитории уже есть рабочий read-only MCP-сервер на восемь команд, и все восемь реально возвращают данные. Но установленный в проекте плагин застрял на v0.2.0, его кэш отсутствует, marketplace не подключён, а сам OMP отстаёт от доступного обновления. README и ROADMAP при этом написаны как внутренний отчёт: там номера FR/CHK, хэши, старые этапы и технические названия состояний вместо ответа «что пользователь получает сейчас и что будет дальше».

### Как должно быть (как я понял)

Сначала обновляем живой OMP и восстанавливаем нормальную установку актуального плагина. Затем не оставляем недостающие события вечным ограничением: добавляем в OMP проверяемую идентичность MCP-вызова и событие для уже выбранного нативным механизмом плана. MCP развиваем понятными релизами: полный read API, evidence API, затем безопасное authoring. README переписываем как короткую страницу продукта без внутренних ID; ROADMAP — как последовательность пользовательских результатов и релизов.

### Правильно понял?

Да. Пользователь явно потребовал план без повторного согласования: обновление OMP входит в работу, отсутствие host ABI становится задачей на реализацию в OMP, восемь текущих MCP-команд сохраняются, а публичные документы очищаются от внутренней трассировки.

## 🎯 Context

Предыдущий корпусный ремонт честно зафиксировал отсутствие двух OMP-событий, но оставил три продуктовые возможности в состоянии `DEFERRED_HOST_ABI`. Это было корректно для старого пина, но не является конечным продуктовым решением. Текущая проверка показала более конкретную картину:

- активный бинарник — OMP 18.0.3, доступен 18.0.10;
- репозиторий и пакет всё ещё пинят 17.3.7;
- проектная запись плагина указывает на v0.2.0, физический cache path отсутствует, marketplace не настроен;
- собранный из репозитория v0.3.2 MCP-сервер регистрирует восемь команд, и все восемь успешно отработали на реальном корпусе;
- OMP 18.0.10 хранит server/tool/provider/schema metadata внутри MCP tool object, но `tool_call` её не передаёт;
- OMP 18.0.10 уже получает точные выбранные plan bytes в native resolver, но approval contract выбрасывает content/hash и не вызывает blocking extension event;
- закрытая карта содержит 46 upstream имён: пять уже представлены текущими aliases, поэтому полный заявленный destination добавляет 41 имя и даёт 49 MCP-команд вместе с тремя собственными командами первого среза.

### Extracted Requirements

1. Обновить живой OMP и убрать старый v17.3.7 из текущего implementation baseline, не переписывая исторические release receipts.
2. Реализовать недостающую идентичность MCP-вызова в OMP, а не оставлять authoring/enforcement вечным ограничением.
3. Реализовать post-resolver plan approval event в OMP, а не угадывать выбранный plan по директориям.
4. Дать точный ответ по MCP: что работает сейчас, почему в живой сессии этого нет, сколько команд будет на следующих этапах.
5. Восстановить project-scope установку `omp-spec-kit` и доказать MCP-доступ из свежей OMP-сессии.
6. Переформатировать README: убрать FR/CHK/TASK/state-machine/hashes и исторический отчёт из главной страницы.
7. Переписать ROADMAP вокруг пользовательских результатов и релизов, сохранив точную внутреннюю трассировку только в specs/decision docs.
8. Сохранить восемь уже опубликованных MCP-команд и закрытый 46-name census без silent DROP.
9. Для каждой новой MCP-группы добавить runtime dogfood на реальном корпусе, а не считать зелёный build доказательством работоспособности.

## 📚 Existing-Spec Inventory

### Domain/Lifecycle

- `.specs/product/` — владеет публичным статусом и семью capability rows. Текущий v0.3.2 baseline доставлен; четыре capability описаны, три host-dependent capability не доставлены.
- `.specs/plugin-distribution/` — владеет package compatibility, marketplace/install/update/reload/fresh-session и release evidence. Текущий child package всё ещё содержит `engines.omp = 17.3.7`.
- `.specs/mcp-release-integrity/` — владеет installed MCP discovery, active-project root, JSON-RPC и exact tool parity. Исторический v17.3.7 receipt сохраняется; для нового кандидата нужен отдельный v18 receipt.
- `.specs/spec-kernel/` — владеет текущими восемью read operations и следующими 15 read/document operations.
- `.specs/spec-evidence/` — владеет двумя следующими MCP reads: `get_test_result`, `get_scenario_trace`.
- `.specs/spec-authoring-workflow/` — владеет 24 proposal-first/document-lifecycle mutations: 17 v1 + 7 v2.
- `.specs/spec-enforcement/` — владеет trusted authoring authority и no-bypass enforcement; текущая спецификация уже задаёт требуемый authority envelope.
- `.specs/plan-gate/` — владеет автоматической проверкой exact native-selected plan; контракт события уже описан.
- `.specs/spec-lsp/` — editor/MCP-internal capability; не добавляет agent-facing spec tools.
- `docs/decisions/spec-generator-port.md` — закрытая карта 46 upstream имён; пять уже представлены первым срезом, ещё 41 остаётся реализовать.

### Installation/Runtime

- `omp --version` → `omp/18.0.3`; `omp update --check` → доступен `18.0.10`.
- `@oh-my-pi/pi-coding-agent@18.0.10` — npm latest; tag commit `33cc6b9a043a74e00a157e72ca909272796d8461`.
- `.omp/plugins/installed_plugins.json` и `.omp/plugins/omp-plugins.lock.json` — проектная запись v0.2.0; записанный cache path отсутствует.
- `omp plugin marketplace list` → marketplace отсутствует; `omp plugin upgrade ... --dry-run` поэтому не может найти marketplace.
- `plugins/omp-spec-kit/.mcp.json` — один stdio server, но schema URL пинит старый OMP commit.
- `plugins/omp-spec-kit/package.json` — пакет v0.3.2, но `engines.omp` пинит 17.3.7.
- `src/adapters/tool-contracts.js` — единый реестр восьми текущих MCP contracts.
- `src/mcp/server.js` — dependency-free JSON-RPC server; registry выводится из той же таблицы.
- `src/kernel/query/service.js` и `src/adapters/query-service.js` — единый read/query runtime, который должны переиспользовать следующие read tools.
- `audit-reports/omp-v18-authority-and-plan-abi-2026-08-29.md` — source-grounded design двух OMP ABI.
- Skills/rules: `omp-extension-contract-grounding`, `runtime-dogfood`, `run-tests`, `strong-tests`, `anchor-fix`, `plan-pomogator`; repo authority — `AGENTS.md`.

### Verification

- Current runtime census: `audit-reports/omp-spec-kit-mcp-runtime-census-2026-08-29.json` и `.md`; 8/8 tools returned data.
- Build/package/corpus: `npm run build && npm run verify`.
- BDD: только `bash scripts/docker-bdd.sh` в Docker; host Cucumber запрещён.
- Installed lifecycle: fresh project-scope install, reload, process restart, `tools/list`, one real call per MCP tool, uninstall/reinstall/upgrade/rollback receipts.
- OMP upstream: targeted coding-agent tests for tool event parity, registry mutation, active/deferred MCP, nested/direct execution, TUI and ACP plan approval.
- Public docs: anchor integrity + manager-readable review with a ban on internal IDs in root README/ROADMAP.
- Plan validation: `npx tsx tools/plan-pomogator/validate-plan.ts <plan>` from `E:/repos/dev-pomogator`.

### Repository Baseline

- HEAD: `c9dc60dc43e163035cd0f3ee67a8e94719a29c96` on `spec/corpus-contract-repair`.
- Worktree before this plan: clean; planning creates `audit-reports/omp-spec-kit-mcp-runtime-census-2026-08-29.{json,md}`, `audit-reports/omp-v18-authority-and-plan-abi-2026-08-29.md` and `docs/plans/omp18-mcp-roadmap-readme.md`.
- Current corpus proof: 10 specs, 150 canonical docs, 1,085 graph nodes, 2,246 edges.
- Open implementation facts: live project plugin record is stale/broken; OMP 18.0.10 still drops authority and selected-plan bytes at extension events; 41 destination MCP names remain unimplemented.

## 👤 User Stories

- Как пользователь OMP, я хочу установить актуальный `omp-spec-kit` одной понятной последовательностью, чтобы MCP-команды реально появились в новой сессии.
- Как агент, я хочу сначала получить полный read API, чтобы находить требования, связи, статусы, документы и доказательства без чтения внутренних файлов вручную.
- Как автор спецификации, я хочу безопасный proposal-first authoring API, чтобы изменение specs было атомарным и проверяемым.
- Как владелец репозитория, я хочу проверять источник MCP-вызова по host metadata, чтобы одноимённый чужой инструмент не получил право записи.
- Как reviewer плана, я хочу блокировать exact plan, уже выбранный OMP, чтобы gate не проверял другой файл.
- Как новый пользователь, я хочу прочитать README за две минуты и понять ценность, установку, восемь доступных команд и ограничения текущего релиза без FR/CHK/TASK jargon.
- Как maintainer, я хочу roadmap по пользовательским релизам, чтобы internal trace IDs оставались в specs, а не в публичной коммуникации.

## 🔀 Use Cases

- UC-1: Обновить OMP, подключить marketplace, обновить project plugin, перезапустить OMP и увидеть восемь `omp-spec-kit` MCP tools.
- UC-2: Вызвать каждую из восьми текущих команд на реальном десяти-spec корпусе и получить непустой bounded result или ожидаемую paged result.
- UC-3: Выпустить read-complete stage: добавить 15 query/document commands без второго графа и получить registry size 23.
- UC-4: Выпустить evidence stage: добавить две result/trace команды и получить registry size 25.
- UC-5: Выпустить authoring stage: добавить 24 mutation commands, но разрешать запись только trusted `omp-spec-kit` authority; итоговый registry size 49.
- UC-6: Попытаться вызвать authoring tool с тем же именем из другого MCP server/extension — host authority mismatch блокирует вызов до filesystem mutation.
- UC-7: Отправить plan на approval в TUI или ACP — один shared resolver передаёт exact path/content/hash в gate; invalid plan остаётся в plan mode.
- UC-8: Открыть README — увидеть «что это», install/update, доступные команды, короткий пример, безопасность и ссылку на roadmap; не увидеть internal IDs или release hashes.
- UC-9: Открыть ROADMAP — увидеть shipped/next/later outcomes и release proof, а не историю public-init и таблицу внутренних owners/checks.
- Edge cases: отсутствующий marketplace, stale plugin lock, missing cache, MCP reconnect, duplicate registered name, schema change after startup, ACP without elicitation, paged result, historical v17.3.7 receipt, upstream ABI patch not yet released.

## 📐 Requirements

### FR (Functional Requirements)

- FR-1: Живой OMP SHALL быть обновлён с 18.0.3 до 18.0.10, а project plugin SHALL быть восстановлен на актуальном v0.3.2 до начала следующего runtime release.
- FR-2: OMP SHALL передавать в `tool_call` и `tool_result` non-model-controlled authority envelope с provider kind, registered name, server ID, source tool name, input-schema SHA-256, registry-snapshot SHA-256 и source path.
- FR-3: Authority envelope SHALL строиться из фактического registered tool object/manager source, а не из разбора model-visible имени.
- FR-4: OMP SHALL вызывать единый blocking `plan_approval_requested` event после native resolution exact plan bytes и до TUI/ACP approval.
- FR-5: TUI и ACP SHALL использовать один shared resolver-and-gate path; invalid plan SHALL сохранять plan mode и возвращать bounded reason.
- FR-6: Репозиторий SHALL сначала принять immutable OMP v18.0.10 как current read-only compatibility pin, а authority-dependent profiles SHALL отдельно поднять minimum pin до первого immutable OMP release/commit с FR-2..FR-5; каждый переход SHALL иметь собственный manager-handoff receipt.
- FR-7: Исторические v17.3.7 lifecycle/discovery/release receipts SHALL оставаться неизменными и явно историческими; текущие validators/workflows SHALL читать отдельный v18 receipt.
- FR-8: Восемь текущих MCP names SHALL оставаться зарегистрированными и behavior-compatible во всех следующих релизах.
- FR-9: Read-complete stage SHALL добавить ровно 15 mapped kernel/document operations и довести registry до 23 names.
- FR-10: Evidence stage SHALL добавить `get_test_result` и `get_scenario_trace`, доведя registry до 25 names.
- FR-11: Authoring stage SHALL добавить 17 v1 и 7 v2 proposal-first/document-lifecycle operations, доведя registry до 49 names без raw write API.
- FR-12: Каждая MCP stage SHALL иметь committed runtime-dogfood harness, который перечисляет registry, вызывает каждую команду на real corpus и запрещает dead/silent-empty entrypoints.
- FR-13: LSP SHALL оставаться editor/MCP-internal transport и SHALL NOT заменять agent-facing MCP spec API.
- FR-14: Root README SHALL быть полностью переписан вокруг продукта, install/update, current tools, quick use, safety и links; internal FR/AC/CHK/TASK IDs, state-machine labels, commit hashes и provenance narrative SHALL быть удалены с главной страницы.
- FR-15: Root ROADMAP SHALL быть переписан как `v0.3.2 shipped → v0.3.3 OMP 18 maintenance → v0.4.0 Read complete → v0.5.0 Evidence/navigation → v0.6.0 Safe authoring → v0.7.0 Automatic plan gate`, с user outcome и proof для каждого релиза, без internal IDs.
- FR-16: Internal owner/gate/census details SHALL оставаться в `.specs/**`, `docs/decisions/spec-generator-port.md` и validation reports; public docs SHALL ссылаться на них только как на maintainer detail.
- FR-17: Product/spec/release status SHALL переходить из host-deferred состояния только после source receipts и behavioral receipts нового OMP ABI; план SHALL реализовать эти receipts, а не suppress status checks.

### Acceptance Criteria (EARS)

- WHEN `omp update --check` выполняется после обновления THEN текущая версия SHALL быть не ниже 18.0.10 и update SHALL сообщать отсутствие доступного stable обновления на момент проверки.
- WHEN fresh project session загружает `omp-spec-kit` THEN `tools/list` SHALL содержать текущие восемь names и каждый SHALL вернуть real data на real corpus.
- WHEN MCP tool вызывается THEN `tool_call.authority` SHALL совпадать с live registered tool/server/schema/snapshot и SHALL быть неизменяемым модельным input.
- WHEN same-name tool приходит от другого server/provider/schema THEN enforcement SHALL блокировать вызов до execution и SHALL назвать mismatch field.
- WHEN registry меняется после startup THEN следующий authority snapshot SHALL измениться, а старое разрешение SHALL NOT наследоваться.
- WHEN plan отправляется на review THEN gate SHALL получить exact native-selected path/content/SHA/title в TUI и ACP.
- WHEN plan gate блокирует THEN approval UI SHALL NOT открываться, plan mode SHALL остаться активным, а причина SHALL быть видна пользователю и агенту.
- WHEN read-complete release строится THEN registry SHALL содержать 23 names, current eight SHALL быть сохранены и 15 new names SHALL пройти runtime dogfood.
- WHEN evidence release строится THEN registry SHALL содержать 25 names и result/trace SHALL возвращать hash-bound evidence либо закрытую ошибку.
- WHEN authoring release строится THEN registry SHALL содержать 49 names, все mutations SHALL быть proposal-first/transactional и ни один raw/untrusted caller SHALL не писать `.specs/**`.
- WHEN README проходит public-doc review THEN в нём SHALL отсутствовать regex `(?:FR|AC|CHK|TASK)-|DEFERRED_HOST_ABI|SPECIFIED|[0-9a-f]{40,64}`.
- WHEN ROADMAP проходит public-doc review THEN каждый этап SHALL содержать user outcome, visible tool count/behavior и release proof, но SHALL NOT содержать internal canonical IDs.
- WHEN historical v17 receipts проверяются THEN их bytes/hashes SHALL оставаться прежними и SHALL NOT называться текущим v18 evidence.

### NFR (Non-Functional Requirements)

- Performance: authority projection/hash lookup SHALL быть O(1) per call после session registry snapshot; MCP dogfood full registry SHALL завершаться в пределах существующего Docker test budget.
- Security: authority и selected-plan metadata SHALL создаваться host code до extension handler; model input, tool-name parsing и config-file claims SHALL NOT авторизовывать запись.
- Reliability: event handler error/timeout SHALL сохранять OMP fail-closed behavior; registry/schema/plan hash mismatch SHALL блокировать, а не понижать проверку.
- Usability: README SHALL объяснять продукт за две минуты; install/update и один пример SHALL копироваться без знания specs jargon.
- Compatibility: historical v0.3.2/eight-tool receipts SHALL оставаться читаемыми; новый current candidate SHALL иметь отдельный OMP v18 profile.
- Maintainability: tool schemas SHALL по-прежнему выводиться из одного registry; TUI/ACP plan approval SHALL использовать один shared function.

### Assumptions

- Upstream OMP work выполняется в отдельном checkout/worktree `can1357/oh-my-pi` от tag v18.0.10; конкретный локальный путь определяется первым upstream todo.
- До upstream release можно доказать ABI на exact commit build; публичный `omp-spec-kit` pin меняется только на immutable commit/release с прошедшими receipts.
- Root README и ROADMAP пишутся на английском, как текущая публичная документация; этот русский plan остаётся maintainer artifact.

### Risks

- OMP update может изменить plugin discovery/marketplace state; сначала сохраняются lock/config receipts, затем выполняется clean reinstall.
- 49 top-level MCP names могут ухудшить discoverability; каждый stage обязан измерить `tools/list`, model discoverability и bounded output. Если OMP tool search лучше top-level exposure, names остаются MCP inventory, но activation/load mode меняется без удаления census rows.
- Authority schema hashing может быть нестабилен между schema libraries; canonical serializer — blocking upstream probe.
- ACP и TUI сейчас имеют отдельные plan paths; частичный patch создаст bypass. Они мигрируются только вместе.
- Глобальная замена `17.3.7` испортит historical evidence; изменения делаются role-aware: historical files исключены, current pin получает новые versioned files.

### Out of Scope

- Переписывание исторических v0.1/v0.2/v0.3 release receipts или тегов.
- Удаление закрытого 46-name census ради уменьшения документации.
- Перенос agent-facing spec API в LSP.
- Копирование dev-pomogator daemon/dashboard/backlog/advisor runtime.
- Публикация нового `omp-spec-kit` release без install/upgrade/rollback/attestation receipts.

## 🔧 Implementation Plan

1. Сохранить текущие OMP/plugin/marketplace/cache receipts, обновить user binary до 18.0.10, заново подключить `stgmt/omp-spec-kit`, обновить project plugin до v0.3.2 и доказать восемь tools в fresh session.
2. Создать upstream OMP worktree от v18.0.10 commit `33cc6b9a043a74e00a157e72ca909272796d8461`, выполнить blocking probes З-1..З-4 и зафиксировать canonical authority projection contract.
3. Добавить authority envelope в OMP tool event types, MCP tool metadata и все model-loop/direct/nested event constructors, переиспользуя actual registered tool rather than name parsing.
4. Добавить upstream behavioral tests для built-in/extension/active-MCP/deferred-MCP/reconnect/registry-change/name-collision/input-revision/timeout paths и доказать ровно один equivalent envelope per dispatch.
5. Централизовать native selected-plan resolution в shared OMP method, добавить `plan_approval_requested`, затем перевести TUI и ACP на один gate before approval.
6. Добавить upstream tests для valid/block/error/timeout/hash-change в TUI и ACP; собрать exact OMP candidate и получить source plus behavior receipts.
7. Сначала принять OMP v18.0.10 как read-only compatibility pin для maintenance-релиза, создать versioned v18.0.10 contract/discovery fixture и не изменять historical v17 evidence.
8. Превратить выполненный одноразовый MCP census в committed `scripts/dogfood-mcp.mjs`; registry names берутся из `tools/list`, real inputs — из live corpus, а output row фиксирует data presence, size, pagination и errors.
9. Переписать root README с нуля: короткий value proposition, install/update, “available today”, восемь tools по пользовательским группам, quick example, read-only safety, roadmap/docs/contribution links; provenance details оставить по ссылке.
10. Переписать root ROADMAP с нуля: v0.3.2 shipped, v0.3.3 OMP 18 maintenance, v0.4.0 read-complete 23 tools, v0.5.0 evidence/navigation 25 tools, v0.6.0 safe authoring 49 tools и v0.7.0 automatic plan gate; internal IDs убрать.
11. Реализовать 15 read/document operations через существующий kernel/query service и adapter, расширить single `TOOL_CONTRACTS`, сохранить current eight aliases и прогнать all-tool dogfood plus Docker BDD.
12. Реализовать два evidence tools поверх hash-bound evidence service; не добавлять второй граф и не смешивать authored scenario count с producer result rows.
13. После принятия upstream ABI поднять authority-dependent package profile до первого immutable OMP release/commit с обоими событиями и получить отдельные source/behavior receipts.
14. Реализовать 24 authoring facades как proposal-first/transactional service, затем активировать их только совместно с accepted OMP authority/enforcement receipts.
15. Реализовать automatic plan gate поверх нового exact selected-plan event и shared deterministic validator; никакого directory scan или повторного native resolution.
16. Через spec MCP door обновить product/distribution/MRI/kernel/evidence/authoring/enforcement/plan-gate/LSP contracts и task/status evidence для каждого принятого OMP pin и delivered release stage.
17. На каждом release checkpoint выполнить build/package/corpus, permanent MCP dogfood, Docker BDD, clean install/reload/fresh-session, upgrade/rollback, anchor check, reality check и candidate-bound release evidence.

### Leverage / Code reuse

- `src/adapters/tool-contracts.js` — единственный registry для MCP и OMP tool schemas.
- `src/kernel/query/service.js` — все новые read operations; не создавать второй query engine.
- `src/mcp/server.js` — текущий JSON-RPC transport; расширять registry, не создавать второй server.
- `docs/decisions/spec-generator-port.md` — exact 46-name mapping и stage grouping.
- `.specs/spec-enforcement/spec-enforcement_SCHEMA.md` — authority envelope и installed-registry contract.
- `docs/omp-plan-approval-event-contract.md` — exact selected-plan event contract.
- `scripts/create-release-evidence.mjs`, `scripts/verify-release.mjs`, Docker BDD — существующий evidence conveyor.

### 🔎 Источники / Пруфы

- Активный OMP 18.0.3 и доступный 18.0.10: `[cmd:omp --version; omp update --check]`.
- npm latest 18.0.10: `[cmd:npm view @oh-my-pi/pi-coding-agent version dist-tags --json]`.
- v18.0.10 commit: `[src:https://api.github.com/repos/can1357/oh-my-pi/git/ref/tags/v18.0.10]`.
- Latest ToolCallEvent lacks authority: `[src:https://github.com/can1357/oh-my-pi/blob/v18.0.10/packages/coding-agent/src/extensibility/extensions/types.ts#L920-L978]`.
- MCPTool retains server/tool/provider/schema source: `[src:https://github.com/can1357/oh-my-pi/blob/v18.0.10/packages/coding-agent/src/mcp/tool-bridge.ts#L490-L555]`.
- Event constructor drops that metadata: `[src:https://github.com/can1357/oh-my-pi/blob/v18.0.10/packages/coding-agent/src/session/agent-session.ts#L3675-L3710]`.
- Native resolver already returns plan content: `[src:https://github.com/can1357/oh-my-pi/blob/v18.0.10/packages/coding-agent/src/plan-mode/approved-plan.ts#L130-L205]`.
- ACP has a separate approval path: `[src:https://github.com/can1357/oh-my-pi/blob/v18.0.10/packages/coding-agent/src/modes/acp/acp-agent.ts#L1870-L1920]`.
- Current eight-tool registry: `[ref:src/adapters/tool-contracts.js:33-145]`.
- Closed 46-name destination: `[ref:docs/decisions/spec-generator-port.md:33-88]`.
- Runtime 8/8 result: `[ref:audit-reports/omp-spec-kit-mcp-runtime-census-2026-08-29.md:1-45]`.
- Stale project install: `[cmd:omp plugin list; omp plugin marketplace list; read .omp/plugins/installed_plugins.json]`.
- Public doc internal-ID noise: `[ref:README.md:50-66]`, `[ref:ROADMAP.md:48-62]`.

## 💥 Impact Analysis

| Keyword | Files Found | Action in Plan |
|---|---|---|
| `17.3.7` / old OMP commit | current package/config/validators, MRI probe fixtures, product/plan/enforcement specs, historical validation reports | Current implementation pins and fixtures move to versioned v18 files; historical release reports remain unchanged and explicitly excluded. |
| `DEFERRED_HOST_ABI` | root README/ROADMAP, product status/spec, plan-gate, enforcement | Remove from public docs; internal state changes only after new ABI receipts. Do not global-replace historical review text. |
| `README.md` public headings | no real inbound root-anchor consumers found | Replace public structure; run anchor integrity after rewrite. |
| `ROADMAP.md` public headings | specs reference file semantics but no inbound root-anchor links found | Replace public structure; retain guarded-path identity and update product evidence. |
| `probe-omp-discovery-v17.3.7.mjs` | workflows, Dockerfile, MRI tasks/fixtures/helpers, release evidence | Create current v18 probe, migrate current callers, then delete obsolete current-code probe only after new receipt; historical report text remains. |
| 8 MCP names | tool registry, MCP server, OMP extension, MRI evidence | Preserve exactly; new stages are additive. |
| 46 upstream names | decision map and port ratchet | Preserve all rows; implement remaining 41 names in three product stages. |
| project plugin v0.2.0 lock | `.omp/plugins/installed_plugins.json`, `.omp/plugins/omp-plugins.lock.json` | Replace generated project install state with verified v0.3.2/current release state. |

Explicit historical exclusions: `docs/validation/distribution-lifecycle*.md`, existing v0.3.2 release receipt identities, prior Cucumber fixture provenance, `docs/omp-v17.3.7-contract.md`, and frozen upstream snapshot bytes. They remain evidence of what was actually released, not current implementation files.

## 📋 Todos

---

### 📋 `upgrade-live-omp-and-plugin`

> Обновить пользовательский OMP и восстановить фактическую project-scope установку текущего плагина.

- **files:** `.omp/plugins/installed_plugins.json` *(edit)*, `.omp/plugins/omp-plugins.lock.json` *(edit)*
- **changes:**
  - Выполнить `omp update`, проверить 18.0.10, заново добавить marketplace и обновить project plugin до v0.3.2/current published version.
  - Удалить stale missing-cache record только через штатный plugin lifecycle и доказать fresh-session activation.
- **refs:** FR-1, AC fresh project session
- **deps:** *none*

---

### 📋 `upstream-tool-authority-types`

> Добавить в OMP canonical authority envelope и проектор из фактического registered tool.

- **files:** `TBD/oh-my-pi/packages/coding-agent/src/extensibility/extensions/types.ts` *(edit)*, `TBD/oh-my-pi/packages/coding-agent/src/mcp/tool-bridge.ts` *(edit)*, `TBD/oh-my-pi/packages/coding-agent/src/extensibility/tool-authority.ts` *(create)*
- **changes:**
  - Определить `tool-call-authority-abi@1`, canonical schema hash и immutable session registry snapshot.
  - Проецировать MCP server/tool/provider metadata из actual tool object, не из model-visible имени.
- **refs:** FR-2, FR-3, NFR-Security
- **deps:** *none*

---

### 📋 `upstream-tool-authority-events`

> Протянуть один authority envelope через все pre/post execution event paths без bypass.

- **files:** `TBD/oh-my-pi/packages/coding-agent/src/session/agent-session.ts` *(edit)*, `TBD/oh-my-pi/packages/coding-agent/src/extensibility/extensions/wrapper.ts` *(edit)*, `TBD/oh-my-pi/packages/coding-agent/src/extensibility/hooks/tool-wrapper.ts` *(edit)*
- **changes:**
  - Добавить authority в model-loop, direct/nested и hook/extension events через общий projector.
  - Сохранить authority неизменным при input revision, approval, retry и reconnect.
- **refs:** FR-2, FR-3, NFR-Reliability
- **deps:** `upstream-tool-authority-types`

---

### 📋 `upstream-tool-authority-tests`

> Доказать authority parity и блокировку spoofed или stale registry identities.

- **files:** `TBD/oh-my-pi/packages/coding-agent/test/extensibility/tool-authority.test.ts` *(create)*, `TBD/oh-my-pi/packages/coding-agent/test/mcp/tool-authority.test.ts` *(create)*
- **changes:**
  - Покрыть built-in, extension, active/deferred MCP, reconnect, collision, registry mutation и nested/direct dispatch.
  - Добавить one-fault tests, которые отдельно ломают server, schema, snapshot, provider и handler timeout.
- **refs:** FR-2, FR-3, AC authority mismatch
- **deps:** `upstream-tool-authority-events`

---

### 📋 `upstream-selected-plan-event`

> Добавить blocking event после native plan resolution и до любого approval UI.

- **files:** `TBD/oh-my-pi/packages/coding-agent/src/plan-mode/approved-plan.ts` *(edit)*, `TBD/oh-my-pi/packages/coding-agent/src/extensibility/extensions/types.ts` *(edit)*, `TBD/oh-my-pi/packages/coding-agent/src/session/agent-session.ts` *(edit)*
- **changes:**
  - Возвращать exact path/content/SHA/title и вызывать `plan_approval_requested` из shared resolver-and-gate method.
  - При BLOCK сохранять plan mode и выдавать bounded reason без directory rescan.
- **refs:** FR-4, FR-5
- **deps:** *none*

---

### 📋 `upstream-plan-mode-parity`

> Перевести interactive и ACP plan approval на один shared gated path.

- **files:** `TBD/oh-my-pi/packages/coding-agent/src/modes/interactive-mode.ts` *(edit)*, `TBD/oh-my-pi/packages/coding-agent/src/modes/acp/acp-agent.ts` *(edit)*, `TBD/oh-my-pi/packages/coding-agent/test/plan-mode/approval-gate.test.ts` *(create)*
- **changes:**
  - Удалить duplicate ACP resolution/gating и использовать общий метод с exact content hash.
  - Проверить ALLOW/BLOCK/error/timeout/hash-change в обоих modes и отсутствие approval UI после BLOCK.
- **refs:** FR-4, FR-5, NFR-Reliability
- **deps:** `upstream-selected-plan-event`

---

### 📋 `adopt-omp-v18-pin`

> Перевести текущий read-only installable package и validators на immutable OMP v18.0.10.

- **files:** `plugins/omp-spec-kit/package.json` *(edit)*, `plugins/omp-spec-kit/.mcp.json` *(edit)*, `scripts/verify-package.mjs` *(edit)*
- **changes:**
  - Заменить current engine/schema pin на exact v18.0.10 tag commit и сохранить closed package profile.
  - Сохранить exact package allowlist и добавить явный отказ для runtime старее принятого current pin.
- **refs:** FR-6, FR-7
- **deps:** `upgrade-live-omp-and-plugin`

---

### 📋 `capture-omp-v18-contract`

> Создать current v18.0.10 source/manager contract рядом с неизменным historical v17 документом.

- **files:** `docs/omp-v18.0.10-contract.md` *(create)*, `docs/validation/omp-discovery-v18.0.10.md` *(create)*, `audit-reports/omp-v18-authority-and-plan-abi-2026-08-29.md` *(create)*
- **changes:**
  - Записать exact version, commit, source lines и manager-owned eight-tool handoff для unmodified v18.0.10.
  - Явно сохранить `docs/omp-v17.3.7-contract.md` как historical evidence без изменения его claims.
- **refs:** FR-6, FR-7
- **deps:** `adopt-omp-v18-pin`

---

### 📋 `adopt-omp-authority-pin`

> Поднять authority-dependent profiles до первого immutable OMP release с обоими принятыми ABI.

- **files:** `plugins/omp-spec-kit/package.json` *(edit)*, `plugins/omp-spec-kit/.mcp.json` *(edit)*, `scripts/verify-package.mjs` *(edit)*
- **changes:**
  - Заменить authority-profile minimum pin на exact upstream release/commit после зелёных source и behavior receipts.
  - Проверять наличие tool authority и selected-plan event отдельно от базовой v18.0.10 read-only совместимости.
- **refs:** FR-2 through FR-7, FR-17
- **deps:** `upstream-tool-authority-tests`, `upstream-plan-mode-parity`, `capture-omp-v18-contract`

---

### 📋 `migrate-current-omp-probe`

> Перевести текущий Docker manager handoff на OMP v18 и убрать obsolete current probe.

- **files:** `scripts/probe-omp-discovery-v18.mjs` *(create)*, `tests/fixtures/omp-discovery-runtime/package.json` *(edit)*, `tests/fixtures/omp-discovery-runtime/bun.lock` *(edit)*
- **changes:**
  - Записать v18.0.10 dependency lock и проверить manager-owned eight-tool handoff на новом current runtime.
  - Сохранить старый probe до переключения всех current callers и отдельного зелёного v18 receipt.
- **refs:** FR-6, FR-7, FR-8
- **deps:** `capture-omp-v18-contract`

---

### 📋 `switch-current-probe-callers`

> Переключить Docker и lifecycle producers на новый versioned OMP v18 probe.

- **files:** `tests/distribution/Dockerfile` *(edit)*, `tests/helpers/omp-discovery-world.mjs` *(edit)*, `tests/step-definitions/lifecycle-producers.steps.mjs` *(edit)*
- **changes:**
  - Копировать и запускать новый v18 probe во всех current candidate и lifecycle сценариях.
  - Проверять v18 version, manager source, eight-tool handoff и отдельные historical/current receipt identities.
- **refs:** FR-6, FR-7, FR-8
- **deps:** `migrate-current-omp-probe`

---

### 📋 `retire-current-v17-probe`

> Удалить obsolete executable v17 probe после переключения current release callers.

- **files:** `scripts/probe-omp-discovery-v17.3.7.mjs` *(delete)*, `.github/workflows/release.yml` *(edit)*, `.github/workflows/distribution-evidence.yml` *(edit)*
- **changes:**
  - Заменить workflow paths/digests на v18 probe и новый versioned discovery receipt.
  - Удалить старый executable probe, сохранив неизменными historical validation documents и release receipts.
- **refs:** FR-6, FR-7
- **deps:** `switch-current-probe-callers`

---

### 📋 `migrate-v18-release-evidence`

> Перевести current candidate evidence на новый OMP receipt без переписывания исторических релизов.

- **files:** `scripts/create-distribution-evidence.mjs` *(edit)*, `scripts/compose-mri-lifecycle-receipts.mjs` *(edit)*, `scripts/verify-release.mjs` *(edit)*
- **changes:**
  - Разделить historical v17 revision и current v18 revision в producer, composer и release verifier contracts.
  - Требовать exact current discovery, authority и selected-plan receipts только для применимых новых release profiles.
- **refs:** FR-6, FR-7, FR-17
- **deps:** `retire-current-v17-probe`, `adopt-omp-authority-pin`

---

### 📋 `recapture-v18-real-fixture`

> Перезахватить реальный Cucumber stream после смены OMP и evidence contracts.

- **files:** `tests/fixtures/release-candidate/cucumber-messages.ndjson` *(edit)*, `tests/fixtures/release-candidate/cucumber-messages.inputs.json` *(edit)*, `tests/fixtures/release-candidate/cucumber-messages.provenance.json` *(edit)*
- **changes:**
  - Захватить полный зелёный Docker output и пересчитать fixture, source-manifest и capture-image SHA-256 receipts.
  - Повторно прогнать Docker suite уже против recaptured fixture и отказать при source/provenance mismatch.
- **refs:** FR-7, FR-12, NFR-Reliability
- **deps:** `migrate-v18-release-evidence`

---

### 📋 `permanent-mcp-dogfood`

> Сделать runtime census обязательной повторяемой проверкой каждого MCP release.

- **files:** `scripts/dogfood-mcp.mjs` *(create)*, `package.json` *(edit)*, `audit-reports/omp-spec-kit-mcp-runtime-census-2026-08-29.json` *(create)*
- **changes:**
  - Получать registry через `tools/list`, выбирать real corpus inputs и вызывать каждый actual handler.
  - Fail при missing row, unexpected name, `ok:false`, silent-empty expected result или cursor inconsistency.
- **refs:** FR-8, FR-12
- **deps:** *none*

---

### 📋 `rewrite-public-readme`

> Полностью заменить главную страницу на короткое пользовательское описание продукта.

- **files:** `README.md` *(replace)*
- **changes:**
  - Добавить value proposition, install/update, available-today tool groups, quick example, read-only safety и links.
  - Удалить internal IDs/state labels/hashes, import history и длинный publication narrative с главной страницы.
- **refs:** FR-14, FR-16, NFR-Usability
- **deps:** `upgrade-live-omp-and-plugin`, `permanent-mcp-dogfood`

---

### 📋 `rewrite-public-roadmap`

> Заменить историко-внутренний roadmap на релизы с пользовательскими результатами.

- **files:** `ROADMAP.md` *(replace)*
- **changes:**
  - Описать shipped v0.3.2 и следующие registry outcomes 23/25/49 plus automatic plan gate.
  - Убрать FR/CHK owners, `DEFERRED_HOST_ABI`, старый public-init audit и implementation jargon.
- **refs:** FR-15, FR-16
- **deps:** `rewrite-public-readme`

---

### 📋 `deliver-read-complete-mcp`

> Добавить 15 query/document commands поверх существующего kernel/query runtime.

- **files:** `src/adapters/tool-contracts.js` *(edit)*, `src/kernel/query/service.js` *(edit)*, `src/adapters/query-service.js` *(edit)*
- **changes:**
  - Реализовать все 15 mapped request/result/error contracts внутри существующих query service и adapter paths.
  - Сохранить current eight aliases, довести registry до 23 и проверить pagination/limits.
- **refs:** FR-8, FR-9, FR-12
- **deps:** `adopt-omp-v18-pin`, `permanent-mcp-dogfood`

---

### 📋 `verify-read-complete-mcp`

> Доказать каждый новый read/document entrypoint на реальном корпусе и installed package.

- **files:** `.specs/spec-kernel/spec-kernel.feature` *(edit via MCP)*, `tests/step-definitions/mcp-release-integrity.steps.mjs` *(edit)*, `audit-reports/omp-spec-kit-mcp-runtime-census-read-complete.json` *(create)*
- **changes:**
  - Добавить BDD для exact 23-name registry, one-call-per-tool data и negative bounds/errors.
  - Запустить clean install/fresh-session dogfood против package launcher, не только source server.
- **refs:** FR-9, FR-12
- **deps:** `deliver-read-complete-mcp`

---

### 📋 `deliver-evidence-mcp`

> Добавить hash-bound result/trace service и две evidence MCP команды.

- **files:** `src/evidence/service.js` *(create)*, `src/adapters/tool-contracts.js` *(edit)*, `src/mcp/server.js` *(edit)*
- **changes:**
  - Реализовать `get_test_result`/`get_scenario_trace` через existing graph identities и separate evidence snapshot.
  - Возвращать closed freshness/errors и довести registry до 25 без смешения authored/producer counts.
- **refs:** FR-10, FR-12
- **deps:** `verify-read-complete-mcp`

---

### 📋 `deliver-authoring-core`

> Реализовать proposal-first authoring engine без прямой записи из tool handlers.

- **files:** `src/authoring/proposals.js` *(create)*, `src/authoring/transactions.js` *(create)*, `src/authoring/service.js` *(create)*
- **changes:**
  - Реализовать CAS, section/anchor operations, all-or-nothing transaction и rollback с canonical operation receipts.
  - Разделить dry-run proposals и apply receipts; запрещать mutation без accepted proposal и authority envelope.
- **refs:** FR-11, NFR-Security
- **deps:** `adopt-omp-authority-pin`, `deliver-evidence-mcp`

---

### 📋 `register-authoring-mcp`

> Зарегистрировать 24 authoring/document-lifecycle commands из единого закрытого mapping.

- **files:** `src/adapters/tool-contracts.js` *(edit)*, `src/mcp/server.js` *(edit)*, `src/v0.1/extension.js` *(edit)*
- **changes:**
  - Добавить 17 v1 + 7 v2 names, exact schemas и proposal/apply routing, доведя registry до 49.
  - Активировать mutation handlers только после accepted installed-registry, authority и enforcement evidence для same candidate.
- **refs:** FR-11, FR-12
- **deps:** `deliver-authoring-core`

---

### 📋 `deliver-spec-enforcement`

> Подключить no-bypass classifier к новому OMP authority envelope.

- **files:** `src/enforcement/classifier.js` *(create)*, `src/enforcement/adapter.js` *(create)*, `src/v0.1/extension.js` *(edit)*
- **changes:**
  - Классифицировать every tool call, canonicalize filesystem targets и разрешать spec mutation только exact authoring authority.
  - Блокировать unknown/schema/server/snapshot mismatch до execution и возвращать bounded diagnostic с mismatch field.
- **refs:** FR-2, FR-3, FR-11, NFR-Security
- **deps:** `register-authoring-mcp`

---

### 📋 `deliver-automatic-plan-gate`

> Реализовать automatic plan validation только на exact post-resolver OMP event.

- **files:** `src/gate/validator.js` *(create)*, `src/gate/automatic-adapter.js` *(create)*, `src/v0.1/extension.js` *(edit)*
- **changes:**
  - Переиспользовать deterministic plan checks и принимать только event path/content/hash/title tuple.
  - Сохранить fail-closed host timeout и не выполнять directory scan/native fallback duplicate.
- **refs:** FR-4, FR-5, NFR-Reliability
- **deps:** `adopt-omp-authority-pin`, `deliver-spec-enforcement`

---

### 📋 `synchronize-product-contracts`

> Перевести internal product/spec status на принятый OMP pin и delivered stage evidence.

- **files:** `.specs/product/product_SCHEMA.md` *(edit via MCP)*, `.specs/product/README.md` *(edit via MCP)*, `docs/validation/release-status-vNEXT.json` *(create per release)*
- **changes:**
  - Сохранить v0.3.2 historical status bytes и создавать отдельный current release status для каждого нового candidate.
  - Удалить host-deferred blockers только после accepted authority/plan receipts и stage-specific runtime evidence.
- **refs:** FR-6, FR-7, FR-17
- **deps:** `deliver-automatic-plan-gate`

---

### 📋 `release-and-ratchet`

> Выпустить каждую MCP stage только после полного installed-artifact evidence conveyor.

- **files:** `scripts/check-spec-corpus.mjs` *(edit)*, `scripts/verify-release.mjs` *(edit)*, `.github/workflows/release.yml` *(edit)*
- **changes:**
  - Ratchet exact registry counts 8→23→25→49, OMP pin, dogfood dataset и public-doc no-jargon rules.
  - Требовать build/package/corpus, Docker BDD, install/upgrade/rollback, attestation и exact release notes per stage.
- **refs:** FR-6, FR-8 through FR-17
- **deps:** `synchronize-product-contracts`

---

## ✅ Definition of Done (DoD)

- Active OMP обновлён; project marketplace/plugin state не stale, cache существует, fresh session видит текущий plugin.
- Upstream OMP содержит source-tested authority envelope и selected-plan event в TUI и ACP.
- omp-spec-kit пинит immutable OMP ABI release/commit; новый v18 manager-handoff receipt зелёный.
- Исторические v17.3.7 release receipts не изменены.
- Текущие восемь MCP tools сохранены и 8/8 проходят permanent dogfood.
- Read/evidence/authoring stages дают exact registry counts 23/25/49 и one-call-per-tool runtime proof.
- Authoring не активируется без exact authority/enforcement tuple; same-name spoof блокируется до записи.
- Automatic plan gate проверяет exact native-selected plan в TUI и ACP.
- README не содержит внутренних ID/state labels/hashes и объясняет продукт, установку, команды и безопасность.
- ROADMAP содержит user outcomes/release proof и не содержит FR/CHK/TASK IDs.
- Все spec mutations выполнены через MCP door; anchors/reality/smart verdicts зафиксированы честно.
- Каждая release stage имеет build/package/corpus, Docker BDD, fresh install, upgrade/rollback и attestation receipts.

### Verification Plan

- Automated Tests:
  - `omp update --check`
  - `omp plugin doctor`
  - `npm run build && npm run verify`
  - `npm run dogfood:mcp`
  - `bash scripts/docker-bdd.sh`
  - `node E:/repos/dev-pomogator/tools/anchor-integrity/check.mjs --all`
  - `npx tsx E:/repos/dev-pomogator/.claude/skills/spec-reality-check/scripts/verify.ts .specs/product --format human`
  - `git diff --check`
- Manual Verification:
  - Перезапустить OMP после clean project install и проверить наличие/описание всех expected MCP tools.
  - Вызвать по одному real happy-path и one-fault path на каждой новой MCP группе.
  - Прочитать README как новый пользователь и ответить: что это, как установить, что работает сейчас, куда смотреть дальше.
  - Прочитать ROADMAP и назвать следующие релизы без знания FR/CHK/TASK vocabulary.
  - Проверить blocked same-name authoring call и blocked invalid plan отдельно в TUI и ACP.

## 📁 File Changes

| Path | Action | Reason |
|---|---|---|
| `.omp/plugins/installed_plugins.json` | edit | Обновить фактическую project-scope запись плагина после штатного reinstall/upgrade. |
| `.omp/plugins/omp-plugins.lock.json` | edit | Зафиксировать текущую установленную версию вместо stale v0.2.0. |
| `audit-reports/omp-spec-kit-mcp-runtime-census-2026-08-29.json` | create | Сохранить machine-readable 8/8 runtime dogfood baseline. |
| `audit-reports/omp-spec-kit-mcp-runtime-census-2026-08-29.md` | create | Объяснить живой MCP статус и 8→23→25→49 destination. |
| `audit-reports/omp-v18-authority-and-plan-abi-2026-08-29.md` | create | Зафиксировать source-grounded OMP ABI design до реализации. |
| `README.md` | replace | Переписать публичную страницу без внутренних ID, hashes и state jargon. |
| `ROADMAP.md` | replace | Переписать roadmap как пользовательские релизы и outcomes. |
| `docs/decisions/spec-generator-port.md` | edit | Добавить release grouping и runtime status к сохранённому 46-name census. |
| `docs/omp-v18.0.10-contract.md` | create | Зафиксировать immutable read-only compatibility contract точного OMP v18.0.10 release. |
| `docs/validation/omp-discovery-v18.0.10.md` | create | Сохранить current manager-owned eight-tool handoff receipt для OMP v18.0.10. |
| `plugins/omp-spec-kit/package.json` | edit | Принять базовый OMP v18.0.10 и позже minimum authority ABI release. |
| `plugins/omp-spec-kit/.mcp.json` | edit | Пинить immutable MCP schema каждого принятого OMP compatibility profile. |
| `plugins/omp-spec-kit/README.md` | edit | Обновить install, update и fresh-session guidance без устаревшего runtime pin. |
| `src/adapters/tool-contracts.js` | edit | Расширить единый MCP registry до 23/25/49 по release stages. |
| `src/kernel/query/service.js` | edit | Реализовать 15 дополнительных read/document operations. |
| `src/adapters/query-service.js` | edit | Подключить новые read operations к real repository adapter. |
| `src/mcp/server.js` | edit | Проецировать read/evidence/authoring operations через один MCP server. |
| `src/evidence/service.js` | create | Реализовать hash-bound result и scenario-trace read operations для evidence stage. |
| `src/authoring/proposals.js` | create | Реализовать closed dry-run proposal contracts для безопасного authoring workflow. |
| `src/authoring/transactions.js` | create | Реализовать CAS, all-or-nothing apply и rollback mutation transactions. |
| `src/authoring/service.js` | create | Связать 24 authoring facades с proposal/transaction engine. |
| `src/enforcement/classifier.js` | create | Классифицировать полный tool surface и write effects. |
| `src/enforcement/adapter.js` | create | Проверять host authority и filesystem containment до выполнения. |
| `src/gate/validator.js` | create | Реализовать deterministic plan validation core. |
| `src/gate/automatic-adapter.js` | create | Подключить exact selected-plan OMP event. |
| `src/v0.1/extension.js` | edit | Подключить enforcement и automatic plan gate к единственной extension factory. |
| `scripts/dogfood-mcp.mjs` | create | Повторяемо вызывать каждую MCP-команду на real corpus. |
| `scripts/probe-omp-discovery-v18.mjs` | create | Захватить текущий OMP v18 manager/authority handoff. |
| `scripts/probe-omp-discovery-v17.3.7.mjs` | delete | Убрать obsolete current-code probe после создания нового receipt; historical docs остаются. |
| `scripts/verify-package.mjs` | edit | Проверять новый OMP engine/schema pin и package surface. |
| `scripts/verify-release.mjs` | edit | Требовать stage registry/dogfood/OMP ABI receipts. |
| `scripts/check-spec-corpus.mjs` | edit | Ratchet public-doc jargon ban и exact stage tool counts. |
| `package.json` | edit | Добавить постоянную `dogfood:mcp` команду в обычный verification workflow. |
| `tests/fixtures/omp-discovery-runtime/package.json` | edit | Перевести disposable manager fixture на OMP v18 ABI release. |
| `tests/fixtures/omp-discovery-runtime/bun.lock` | edit | Зафиксировать exact OMP v18 dependency graph. |
| `tests/step-definitions/mcp-release-integrity.steps.mjs` | edit | Проверить new pin, authority fields и staged tool parity. |
| `tests/step-definitions/release-candidate.steps.mjs` | edit | Проверить stage-specific registry/evidence and release refusal paths. |
| `.specs/spec-kernel/spec-kernel.feature` | edit | Добавить executable trace для 15 read/document operations. |
| `.specs/product/product_SCHEMA.md` | edit | Принять новый OMP ABI и stage evidence без изменения истории v0.3.2. |
| `.specs/product/README.md` | edit | Синхронизировать внутренний product status с доказанными stages. |
| `docs/validation/release-status-vNEXT.json` | create | Создавать отдельный current status для каждого нового релиза, не меняя v0.3.2 evidence. |
| `.github/workflows/release.yml` | edit | Добавить OMP v18 receipts, dogfood и staged registry release gates. |
| `.github/workflows/distribution-evidence.yml` | edit | Перевести current discovery digest и distribution evidence на versioned v18 receipt. |
| `scripts/create-distribution-evidence.mjs` | edit | Разделить historical и current OMP revision в producer evidence. |
| `scripts/compose-mri-lifecycle-receipts.mjs` | edit | Собирать новые manager и ABI receipts без изменения исторических lifecycle records. |
| `tests/distribution/Dockerfile` | edit | Копировать и запускать новый current OMP v18 probe в изолированном контейнере. |
| `tests/helpers/omp-discovery-world.mjs` | edit | Вызывать versioned v18 manager probe и проверять current receipt identity. |
| `tests/helpers/release-candidate-world.mjs` | edit | Связать candidate evidence с новым OMP profile и реальным Cucumber fixture. |
| `tests/step-definitions/lifecycle-producers.steps.mjs` | edit | Проверять current OMP v18 lifecycle отдельно от historical receipts. |
| `tests/fixtures/release-candidate/cucumber-messages.ndjson` | edit | Перезахватить полный реальный Docker Cucumber Message stream после runtime migration. |
| `tests/fixtures/release-candidate/cucumber-messages.inputs.json` | edit | Пересчитать content-addressed current source manifest для recaptured stream. |
| `tests/fixtures/release-candidate/cucumber-messages.provenance.json` | edit | Связать recaptured stream с source manifest, capture image и parent fixture. |
| `.specs/mcp-release-integrity/**` | edit | Принять versioned current OMP receipts и сохранить historical release identities. |
| `.specs/plugin-distribution/**` | edit | Обновить compatibility, install и release profiles для OMP v18 stages. |
| `.specs/spec-kernel/**` | edit | Трассировать и доказать 15 дополнительных read/document operations. |
| `.specs/spec-evidence/**` | edit | Трассировать два evidence reads и их hash-bound release profile. |
| `.specs/spec-authoring-workflow/**` | edit | Принять 24 proposal-first facades и authority-dependent activation. |
| `.specs/spec-enforcement/**` | edit | Заменить absent-host state на проверенные authority ABI receipts. |
| `.specs/plan-gate/**` | edit | Принять exact selected-plan event и automatic profile receipts. |
| `.specs/spec-lsp/**` | edit | Обновить OMP pin, сохранив editor/MCP-internal boundary. |
| `.specs/product/**` | edit | Синхронизировать versioned release outcomes и evidence-derived capability states. |
| `TBD/oh-my-pi/packages/coding-agent/src/extensibility/extensions/types.ts` | edit | Добавить authority и selected-plan event types в upstream OMP. |
| `TBD/oh-my-pi/packages/coding-agent/src/extensibility/tool-authority.ts` | create | Централизовать authority projection и registry snapshot. |
| `TBD/oh-my-pi/packages/coding-agent/src/mcp/tool-bridge.ts` | edit | Экспортировать фактические MCP authority fields. |
| `TBD/oh-my-pi/packages/coding-agent/src/session/agent-session.ts` | edit | Эмитить authority и shared selected-plan gate. |
| `TBD/oh-my-pi/packages/coding-agent/src/extensibility/extensions/wrapper.ts` | edit | Сохранить authority parity для direct/nested dispatch. |
| `TBD/oh-my-pi/packages/coding-agent/src/extensibility/hooks/tool-wrapper.ts` | edit | Сохранить authority parity на hook surface. |
| `TBD/oh-my-pi/packages/coding-agent/src/plan-mode/approved-plan.ts` | edit | Возвращать exact selected-plan contract для shared gate. |
| `TBD/oh-my-pi/packages/coding-agent/src/modes/interactive-mode.ts` | edit | Использовать shared gated plan approval path. |
| `TBD/oh-my-pi/packages/coding-agent/src/modes/acp/acp-agent.ts` | edit | Удалить отдельный ACP resolver path и использовать общий blocking approval gate. |
| `TBD/oh-my-pi/packages/coding-agent/test/extensibility/tool-authority.test.ts` | create | Доказать authority parity, registry changes и same-name spoof refusal. |
| `TBD/oh-my-pi/packages/coding-agent/test/plan-mode/approval-gate.test.ts` | create | Доказать exact-plan gating в TUI и ACP для ALLOW/BLOCK/error/timeout. |
