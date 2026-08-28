# План: спеки готовы к переносу двери генератора, без потолка «восемь тулов»

## 💬 Простыми словами

### Сейчас (как работает)
В репозитории уже есть ядро и восемь команд чтения. Я ошибочно описал это как весь продукт: будто агенту больше ничего не нужно, а сорок шесть команд из старого генератора «не наши». Из‑за этого в дорожной карте и в историях до сих пор написано противоположное: агент якобы ходит в LSP, а восьмёрка навсегда. Куски про «дверь генератора» уже дописаны в двух местах, но корпус противоречит сам себе. По таким спекам следующий агент снова заморозит первый срез.

### Как должно быть (как я понял)
Спеки должны говорить одно: сюда переносится дверь генератора. Агент видит только MCP. LSP — внутренний сервер для MCP и редактора. Восемь команд — первый срез, чтобы ядро село, не потолок. Каждая из сорока шести команд старого генератора имеет хозяина (ядро / адаптер / улики / авторство) либо явную потерю. После правки нельзя снова принять срез за цель.

### Правильно понял?
Да: этот план только про тексты спек и дорожную карту, без реализации ядра и LSP. Восьмёрка остаётся доказательством текущего v0.3, но перестаёт быть «всем продуктом». Не выкидываем команды молча.

## 🎯 Context

Инцидент: в `omp-spec-kit` первый срез v0.3 (восемь read-only MCP-имён `spec_*`) был описан как потолок продукта. Это противоречит цели порта двери spec-generator из `dev-pomogator`. Коммит `56e8ddc` уже добавил `spec-kernel` FR-16 и `spec-lsp` FR-1 («агент видит MCP»), но корпус не готов:

- `ROADMAP.md` всё ещё утверждает, что реестр v0.3 — это не дверь из 46 тулов.
- `spec-lsp` USER_STORIES / USE_CASES всё ещё учат агента звать `textDocument/*`.
- `spec-kernel` FR-15 и AC-9.1 требуют «навсегда ровно восемь» MCP-тулов.
- `spec-authoring-workflow` исключает archive/backlog, хотя в переносимой двери они есть.
- Нет закрытой таблицы «46 имён → хозяин», поэтому путаница воспроизводима.

Желаемый результат: один канонический census + product-инвариант «срез ≠ цель», согласованные спеки, grep-проверка запрещённых формулировок.

### Extracted Requirements
1. Такой путаницы больше не должно быть: первый срез нельзя снова принять за весь продукт.
2. Спеки сейчас не готовы; их нужно обновить, а не считать коммит `56e8ddc` завершением.
3. Нужен план работ по обновлению спек (не скрытая реализация ядра/LSP в этом же заходе).
4. Агент видит только MCP; LSP не в инвентаре агента.
5. Восемь команд — первый срез v0.3, не потолок двери генератора.
6. Растить MCP можно; удалять восьмёрку и молча выкидывать команды двери — нельзя.

## 📚 Existing-Spec Inventory

### Domain/Lifecycle
- `.specs/product/` — Specified; FR-1..FR-8; стадии public init → v0.1 → v0.2 → v0.3 → later authoring. Нет FR «дверь генератора / агент только MCP / census 46». `product.feature`, `TASKS.md` есть. Пересечение: владеет ROADMAP-границей.
- `.specs/spec-kernel/` — Specified; FR-1..FR-16. FR-8/FR-9 = первый срез; FR-15 step-bindings; FR-16 generator-port reads. Lifecycle v0.2/v0.3 gates **исключают** FR-15/FR-16. Код ядра уже есть; FR-16 не реализован. `.feature` + `TASKS.md` (TASK-13).
- `.specs/spec-lsp/` — SPEC_ONLY. FR-1 уже «MCP only», но USER_STORIES US-2/US-3/US-4 и USE_CASES UC-2+ всё ещё агент→LSP. DESIGN alternative E: «there is no 46-tool door to prune».
- `.specs/spec-authoring-workflow/` — DEFERRED / SPECIFICATION ONLY. FR-1..FR-13 proposal-first mutations. README **исключает** archival и backlog resolution. Нет таблицы MCP-имён мутаций.
- `.specs/spec-evidence/` — SPEC_ONLY. Честность прогонов; не названы `get_test_result` / `get_scenario_trace` как MCP-проекция.
- `.specs/plugin-distribution/` — Specified; cardinality плагина, не реестр MCP-имён.
- `.specs/mcp-release-integrity/` — Specified; README: «All eight read-only MCP tools» как identity v0.3-кандидата.
- `.specs/spec-enforcement/`, `.specs/plan-gate/`, `.specs/spec-capability/` — не владельцы двери генератора; не трогать, кроме если всплывёт запрещённая фраза.

### Installation/Runtime
- Уже установленный первый срез: `src/mcp/server.js` / `plugins/omp-spec-kit/dist/` регистрирует восемь `spec_*` тулов. Это runtime v0.3, не цель этого плана.
- OMP host `lsp` — встроенный инструмент хоста (`docs/tools/lsp.md` у oh-my-pi); продукт не должен класть спек-работу на этот tool.
- Skills/rules этого плана: `docs/decisions/omp-spec-kit-public-init.md` (read-only-first, authoring later). CLAUDE.md / allowed-tools N/A — план не меняет runtime skills.
- Docker/hooks/doctor: N/A для spec-only правок.

### Verification
- BDD спек: `.specs/spec-kernel/spec-kernel.feature`, `.specs/spec-lsp/spec-lsp.feature`, `.specs/product/product.feature` — specification text, не execution evidence (`product:FR-7`).
- Runtime BDD восьмёрки: `tests/features/spec-mcp.feature` — **вне скоупа**: это доказательство текущего v0.3, его нельзя ломать этим планом.
- Lint/test skill: N/A для markdown-спек; проверка плана — `npx tsx tools/plan-pomogator/validate-plan.ts` из `dev-pomogator`; проверка корпуса — grep запрещённых фраз + `spec-kernel`/`spec-lsp` heading links.

### Repository Baseline
- SHA: `56e8ddcf32d0691f309c5192eb1ea5299cd39b6e` (`docs: agent sees MCP only; kernel FR-16 grows the generator door`).
- Worktree: clean (`git status --short` empty).
- Unresolved: leftover «exactly eight forever» in kernel AC-9.1 / FR-15 / ROADMAP L46; spec-lsp stories still agent-LSP; no 46-row census document.

## 👤 User Stories
- Как владелец продукта, я хочу чтобы спеки называли дверь генератора целью, чтобы агент больше не замораживал восьмёрку.
- Как агент в OMP, я хочу один MCP-инвентарь спек, чтобы не звать host `lsp` за FR/AC/сценариями.
- Как автор спек, я хочу закрытую таблицу «имя тула → хозяин», чтобы ни одна команда двери не потерялась молча.
- Как релизный владелец v0.3, я хочу сохранить доказательство «сейчас восемь read-тулов», чтобы не ломать уже принятый срез.

## 🔀 Use Cases
- UC-1 happy path: агент в сессии OMP видит MCP-тулы спек и ходит в них за узлом/трассой/задачами; LSP не в списке тулов.
- UC-2 first-slice: v0.3-кандидат по-прежнему доказывает ровно восемь `spec_*` имён; ROADMAP называет это срезом, не целью.
- UC-3 growth: после FR-16 MCP добавляет `list_specs`/`list_tasks`/… без удаления восьмёрки и без второго графа.
- UC-4 authoring later: мутации появляются только через `spec-authoring-workflow` на MCP, не через `lsp` `codeAction`.
- Edge: документ снова пишет «это не дверь из 46 тулов» / «агент использует LSP» → CHK продукта падает.
- Edge: архив/бэклог не описаны как DROP без строки потери в census.

## 📐 Requirements

### FR (Functional Requirements)
- FR-1: Канонический decision `docs/decisions/spec-generator-port.md` содержит закрытый census всех 46 имён из `dev-pomogator` `tools/spec-mcp-server/tools.ts` с колонками: upstream name, owner spec, stage, MCP-visible-to-agent, kernel-op-or-adapter-io.
- FR-2: Product получает требование «срез ≠ цель»: агент видит только MCP; LSP не агентский тул; рост MCP не удаляет восьмёрку; молчаливый DROP строки census запрещён.
- FR-3: `ROADMAP.md` перестаёт утверждать, что v0.3 «не дверь из 46 тулов»; v0.3 = первый срез; отдельно названы later generator-port reads (kernel FR-16), LSP sibling (не агентский API), evidence MCP, authoring MCP.
- FR-4: `spec-kernel` AC-9.1 / FR-15 / TASK-9 / feature оставляют «exactly eight» только как v0.3 first-slice evidence, не как запрет FR-16.
- FR-5: `spec-lsp` stories/use cases/CHK описывают редактор и внутреннее потребление MCP, не агента, зовущего `textDocument/*`.
- FR-6: `spec-evidence` владеет MCP-проекцией `get_test_result` и `get_scenario_trace`.
- FR-7: `spec-authoring-workflow` называет MCP-имена мутаций двери (propose/apply/create/archive/backlog/status) как later agent-facing door; текущие README-исключения archive/backlog либо снимаются в later FR, либо помечаются явной потерей в census.
- FR-8: Механический anti-confusion check (product CHK): корпус `.specs/**` + `ROADMAP.md` не содержит запрещённых формулировок без «first slice».

### Acceptance Criteria (EARS)
- WHEN census document is read THEN it SHALL list all 46 upstream MCP names with a non-empty owner and stage.
- WHEN an agent inventory is specified THEN it SHALL include MCP spec tools AND SHALL NOT include an `lsp` spec tool.
- IF a document describes the v0.3 eight-tool registry THEN it SHALL call that registry the first slice AND SHALL NOT call it the destination door.
- WHEN spec-lsp user stories are followed THEN the actor invoking navigation SHALL be MCP or the editor, not the agent calling host `lsp`.
- WHEN CHK-product-destination runs THEN leftover phrases «not the 46-tool door» and «agent uses LSP primitives» SHALL fail the check.

### NFR (Non-Functional Requirements)
- Performance: N/A — spec-document work; no runtime budget change.
- Security: N/A for new secrets; census must not import live credentials; keep existing secret gate.
- Reliability: After the edit pass, product/kernel/lsp/authoring/evidence/roadmap SHALL not contradict the destination invariant.
- Usability: A later agent SHALL be able to answer «what does the agent call?» from product FR + census without reading git history.

### Assumptions
- v0.3 release evidence stays «exactly eight `spec_*` tools» until a later stage lands FR-16; this plan does not move FR-16 into the v0.3 required-check set.
- The 46 names in `tools/spec-mcp-server/tools.ts` (`name:` fields) are the closed census; SCHEMA-11 eight names are the first-slice mapping, not a second inventory.
- Runtime tests in `tests/features/spec-mcp.feature` stay eight-tool until implementation of FR-16; this plan does not edit them.
- Marksman/Claude-hook DROP rows in `MIGRATION_MATRIX.md` stay DROP; they are not generator-door tools.

### Risks
- Heading retitles in `spec-lsp` USER_STORIES break inbound markdown anchors; retitles must update REQUIREMENTS links in the same pass.
- Lifting authoring exclusions (archive/backlog) is a semantic product change; if left as later-FR rather than DROP, census must say `later` not `drop`.
- Agents may still quote ROADMAP from memory; CHK + decision doc are the ratchet, not a comment on issue #7.

### Out of Scope
- Kernel/LSP/MCP implementation and new query operations in code.
- Changing v0.3 eight-tool runtime proofs (`tests/features/spec-mcp.feature`, `src/mcp/server.js`).
- Authoring/mutation implementation.
- Rewriting historical CHANGELOG entries for already-shipped v0.2/v0.3 as if they were always the destination.
- Importing `dev-pomogator` source as product code.

## 🔧 Implementation Plan
1. Create `docs/decisions/spec-generator-port.md` with the destination invariant and the closed 46-row census (owner, stage, MCP-visible, kernel vs adapter I/O), citing `tools/spec-mcp-server/tools.ts` as research not a code import.
2. Add `product` FR-9 (destination census + agent-MCP-only + first-slice-is-not-ceiling) and wire AC, Gherkin, REQUIREMENTS, TASKS so the invariant has a home outside `spec-lsp`.
3. Rewrite `ROADMAP.md` v0.3 paragraph and the LSP sibling paragraph so v0.3 remains eight-tool first slice while generator-port reads, evidence MCP, and authoring MCP are named later stages; add an Unreleased note to root `CHANGELOG.md` without rewriting shipped history.
4. In `spec-kernel`, keep FR-9 v0.3 eight-tool proof but remove «MCP registry SHALL remain the eight» from FR-15; AC-9.1 / feature / TASK-9 must say first slice, and SCHEMA/TASK-13 must list FR-16 operations as later query names.
5. Rewrite `spec-lsp` USER_STORIES, USE_CASES, DESIGN alternative E, README, CHANGELOG leftover, feature header, CHK-FR1-01, and TASK-1 so the agent never uses host `lsp` for spec work; editor diagnostics stay on `lsp.diagnosticsOnWrite`.
6. Add `spec-evidence` ownership of `get_test_result` / `get_scenario_trace` as later MCP projections that wait for evidence evaluation, not kernel FR-8.
7. Map authoring MCP names onto `spec-authoring-workflow` (propose/apply/create/status/doc CRUD plus later archive/backlog) and replace silent README exclusions with census rows.
8. Carve `mcp-release-integrity` eight-tool language as v0.3 candidate identity, then add a product CHK (forbidden-phrase grep over `.specs` + `ROADMAP.md`) so the freeze cannot return unnoticed.
9. After edits, retarget inbound links for any renamed headings and run the forbidden-phrase grep plus heading-anchor check before claiming specs ready.

### 🔎 Источники / Пруфы
- 46 MCP `name:` fields in upstream registry `[ref:E:/repos/dev-pomogator/tools/spec-mcp-server/tools.ts:961-3502]`.
- ROADMAP freeze sentence `[ref:E:/repos/omp-spec-kit/ROADMAP.md:46]`.
- Kernel FR-16 already names later reads `[ref:E:/repos/omp-spec-kit/.specs/spec-kernel/FR.md:183-205]`.
- spec-lsp FR-1 already says agent sees MCP `[ref:E:/repos/omp-spec-kit/.specs/spec-lsp/FR.md:5-11]`.
- spec-lsp US-2 still sends the agent through LSP primitives `[ref:E:/repos/omp-spec-kit/.specs/spec-lsp/USER_STORIES.md:9-13]`.
- Kernel FR-15 still forbids a ninth MCP tool `[ref:E:/repos/omp-spec-kit/.specs/spec-kernel/FR.md:171]`.
- Authoring README excludes archival and backlog `[ref:E:/repos/omp-spec-kit/.specs/spec-authoring-workflow/README.md:32-33]`.
- Baseline SHA `[cmd:git rev-parse HEAD → 56e8ddcf32d0691f309c5192eb1ea5299cd39b6e]`.

## 💥 Impact Analysis
N/A — нет удалений/переименований файлов. Heading retitles inside existing spec documents are in-place edits; inbound links are updated in the same todo that retitles.

## 📋 Todos

---

### 📋 `decision-census`

> Зафиксировать цель порта и закрытую таблицу 46 имён, чтобы срез больше нельзя было принять за продукт.

- **files:** `docs/decisions/spec-generator-port.md` *(create)*
- **changes:**
  - Создать decision: продукт = OMP-порт двери spec-generator; агент видит только MCP; LSP внутренний; восемь `spec_*` = first slice v0.3.
  - Вставить таблицу на все 46 `name:` из `tools/spec-mcp-server/tools.ts` с owner/stage/MCP-visible/kernel-or-adapter.
  - Явно запретить формулировки «это не дверь из 46 тулов» и «агент ходит в lsp» без first-slice оговорки.
- **refs:** FR-1, FR-2, NFR-Usability
- **leverage:** `.specs/spec-kernel/FR.md` FR-16 table; `tools/spec-mcp-server/tools.ts` name census
- **deps:** *none*

---

### 📋 `product-destination-fr`

> Дать инварианту дом в product FR, чтобы дорожная карта не была единственным местом правды.

- **files:** `.specs/product/FR.md` *(edit)*
- **changes:**
  - Добавить FR-9: destination census, agent-MCP-only, first-slice-is-not-ceiling, no silent DROP of a census row.
  - Поправить FR-6/FR-8: later stages включают generator-port reads, spec-lsp sibling (не агентский API), spec-evidence MCP, authoring MCP.
  - Ссылаться на `docs/decisions/spec-generator-port.md` как канон census, не дублировать 46 строк в FR.
- **refs:** FR-2, FR-3
- **leverage:** `.specs/product/FR.md` FR-6 stage list
- **deps:** `decision-census`

---

### 📋 `product-trace`

> Протянуть FR-9 в AC, feature, матрицу и задачи, иначе инвариант останется прозой.

- **files:** `.specs/product/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/product/product.feature` *(edit)*, `.specs/product/REQUIREMENTS.md` *(edit)*
- **changes:**
  - Добавить AC-9.1 EARS: census complete; agent inventory MCP-only; v0.3 eight named first slice.
  - Добавить `@feature9` scenario: forbidden leftover phrases fail; eight-tool v0.3 proof still evaluable.
  - Дописать строку FR-9 в inventory + contract card + CHK-FR9-01 (grep корпуса).
- **refs:** FR-2, FR-8
- **deps:** `product-destination-fr`

---

### 📋 `roadmap-unfreeze`

> Убрать корневую ложь дорожной карты, с которой начинается каждая следующая путаница.

- **files:** `ROADMAP.md` *(edit)*, `.specs/product/TASKS.md` *(edit)*, `.specs/product/CHANGELOG.md` *(edit)*
- **changes:**
  - Заменить абзац «v0.3 MCP registry is exactly the eight… not the upstream 46-tool door» на «v0.3 first slice; destination is generator-port MCP growth».
  - В LSP sibling: агент не вызывает host `lsp`; MCP может потреблять LSP внутри.
  - Добавить later bullets: generator-port reads (kernel FR-16), evidence MCP, authoring MCP names; TASK + changelog для FR-9.
- **refs:** FR-3
- **deps:** `product-destination-fr`

---

### 📋 `kernel-unfreeze`

> Оставить восьмёрку доказательством v0.3, но снять запрет расти MCP после FR-16.

- **files:** `.specs/spec-kernel/FR.md` *(edit)*, `.specs/spec-kernel/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/spec-kernel/spec-kernel.feature` *(edit)*
- **changes:**
  - FR-15: убрать «MCP registry SHALL remain the eight read tools; this FR SHALL NOT add a ninth MCP tool»; индекс шагов остаётся на findNodes/getEdges/diagnostics.
  - AC-9.1 и `@feature9`: «exactly eight» только пока CHK-FR16-01 не PASS; после PASS реестр растёт read-only именами FR-16.
  - `@feature15` не требует «MCP registry is still exactly eight» как вечный инвариант.
- **refs:** FR-4
- **leverage:** `.specs/spec-kernel/FR.md` FR-9 and FR-16
- **deps:** `decision-census`

---

### 📋 `kernel-schema-tasks`

> Записать FR-16 операции в схему и задачи, чтобы они не жили только в абзаце FR.

- **files:** `.specs/spec-kernel/spec-kernel_SCHEMA.md` *(edit)*, `.specs/spec-kernel/TASKS.md` *(edit)*, `.specs/spec-kernel/REQUIREMENTS.md` *(edit)*
- **changes:**
  - SCHEMA: later query names from FR-16 listed as non-v0.2 members; v0.2 still enumerates the original eight.
  - TASK-9 Done When: eight tools as v0.3 first-slice evidence, not destination; TASK-13 remains CHK-FR16-01 owner.
  - REQUIREMENTS/CHK: CHK-FR9-01 stays first-slice; CHK-FR16-01 remains outside kernel-v0.2/v0.3 required sets.
- **refs:** FR-4
- **deps:** `kernel-unfreeze`

---

### 📋 `lsp-agent-stories`

> Переписать истории и сценарии: агент зовёт MCP, редактор получает диагностику через LSP.

- **files:** `.specs/spec-lsp/USER_STORIES.md` *(edit)*, `.specs/spec-lsp/USE_CASES.md` *(edit)*, `.specs/spec-lsp/REQUIREMENTS.md` *(edit)*
- **changes:**
  - US-2/US-3/US-4: актёр навигации — MCP-адаптер или редактор; агент вызывает MCP (`get_node`/`find_refs`/FR-16), не host `lsp`.
  - UC-2/UC-3/UC-4: тот же сдвиг актора; UC-1 может остаться editor `lsp.diagnosticsOnWrite`.
  - Обновить якоря REQUIREMENTS после переименования заголовков US/UC в том же проходе.
- **refs:** FR-5
- **deps:** `product-destination-fr`

---

### 📋 `lsp-design-residue`

> Вычистить leftover «46 тулов не этот продукт» и «не трогать восьмёрку как потолок».

- **files:** `.specs/spec-lsp/DESIGN.md` *(edit)*, `.specs/spec-lsp/README.md` *(edit)*, `.specs/spec-lsp/CHANGELOG.md` *(edit)*, `.specs/spec-lsp/spec-lsp.feature` *(edit)*, `.specs/spec-lsp/TASKS.md` *(edit)*
- **changes:**
  - Alternative E: нельзя резать MCP, чтобы спрятать cliff; восьмёрка — срез; дверь растёт по census, LSP не заменяет MCP.
  - README: таблица 46 — карта порта, не «чужой реестр»; feature header не обещает вечные eight tools.
  - CHANGELOG: убрать «46-tool door is upstream, not this product»; CHK-FR1-01 и TASK-1 в TASKS.md не проверяют «агент должен звать lsp».
- **refs:** FR-5
- **deps:** `lsp-agent-stories`

---

### 📋 `evidence-mcp-owners`

> Назначить хозяином улик два read-тула, которые ядро сознательно не умеет честно отвечать.

- **files:** `.specs/spec-evidence/FR.md` *(edit)*, `.specs/spec-evidence/REQUIREMENTS.md` *(edit)*, `.specs/spec-evidence/README.md` *(edit)*
- **changes:**
  - Добавить FR: MCP projection `get_test_result` и `get_scenario_trace` after evidence evaluation exists; kernel FR-6 remains forbidden from pass/fail claims.
  - Матрица + README: эти имена ждут spec-evidence, не FR-8 и не spec-lsp hover.
  - В FR и README явно пометить stage later: эти два MCP-имени не входят в required-check sets `kernel-v0.2` и `kernel-v0.3`.
- **refs:** FR-6
- **deps:** `decision-census`

---

### 📋 `authoring-census`

> Назвать MCP-имена мутаций и не оставлять archive/backlog молчаливым исключением.

- **files:** `.specs/spec-authoring-workflow/README.md` *(edit)*, `.specs/spec-authoring-workflow/FR.md` *(edit)*, `.specs/spec-authoring-workflow/REQUIREMENTS.md` *(edit)*
- **changes:**
  - README: агентский API авторства — MCP; список propose/apply/create/status/doc CRUD; archive/backlog = later members, не silent DROP.
  - FR later increment: map upstream mutation names onto proposal-first operations already specified.
  - REQUIREMENTS: ссылка на census rows; v0.3 read registry still has zero mutation tools.
- **refs:** FR-7
- **deps:** `decision-census`

---

### 📋 `anti-confusion-chk`

> Поставить механический засов, чтобы формулировка-потолок не вернулась в корпус.

- **files:** `.specs/product/REQUIREMENTS.md` *(edit)*, `.specs/mcp-release-integrity/README.md` *(edit)*, `CHANGELOG.md` *(edit)*
- **changes:**
  - CHK-FR9-01: grep `.specs` + `ROADMAP.md` на «not the 46-tool door», «agent navigating … LSP primitives», «there is no 46-tool door to prune» без first-slice.
  - mcp-release-integrity README: eight tools = v0.3 candidate identity, not destination registry.
  - Root CHANGELOG Unreleased: spec destination correction; не переписывать shipped v0.3 eight-tool evidence as a mistake of that release.
- **refs:** FR-8, NFR-Reliability
- **deps:** `product-trace`, `roadmap-unfreeze`, `lsp-design-residue`

---

## ✅ Definition of Done (DoD)
- Decision census lists all 46 upstream names with owner/stage.
- Product FR-9 + ROADMAP + spec-lsp stories + kernel FR-15/AC-9.1 no longer freeze eight tools as the destination.
- Agent-facing API in specs is MCP only; LSP is editor/MCP-internal.
- Authoring/evidence names from the census have owners; archive/backlog are later or explicit loss, not silent DROP.
- Forbidden-phrase grep is clean on `.specs` and `ROADMAP.md`.
- v0.3 eight-tool runtime tests are intentionally untouched.
- No secrets added; heading links for retitled US/UC still resolve.

### Verification Plan
- Automated Tests:
  - `npx tsx tools/plan-pomogator/validate-plan.ts docs/plans/spec-generator-port-spec-ready.md`
  - `rg -n "not the (upstream )?46-tool door|there is no 46-tool door to prune|Agent navigating spec definitions through LSP primitives|MCP registry SHALL remain the eight" ROADMAP.md .specs/product .specs/spec-kernel .specs/spec-lsp .specs/spec-authoring-workflow .specs/spec-evidence .specs/mcp-release-integrity`
- Manual Verification:
  - Read `docs/decisions/spec-generator-port.md` and answer: what does the agent call? (must be MCP)
  - Read ROADMAP v0.3 + later LSP: first slice vs destination vs editor LSP.
  - Confirm `tests/features/spec-mcp.feature` still describes eight tools (unchanged on purpose).

## 📁 File Changes
| Path | Action | Reason |
|---|---|---|
| `docs/decisions/spec-generator-port.md` | create | Canonical destination invariant and 46-name census so first slice cannot be mistaken for the product. |
| `docs/plans/spec-generator-port-spec-ready.md` | create | This work plan, executable by the next spec-edit pass. |
| `.specs/product/FR.md` | edit | Add FR-9 destination census and stop treating v0.3 eight tools as the final door. |
| `.specs/product/ACCEPTANCE_CRITERIA.md` | edit | Add AC-9.1 EARS for MCP-only agent inventory and first-slice wording. |
| `.specs/product/product.feature` | edit | Add `@feature9` scenario that fails leftover freeze phrases. |
| `.specs/product/REQUIREMENTS.md` | edit | Trace FR-9 and CHK-FR9-01 forbidden-phrase grep. |
| `.specs/product/TASKS.md` | edit | Add the product task that owns the destination invariant. |
| `.specs/product/CHANGELOG.md` | edit | Record the destination correction at spec level. |
| `ROADMAP.md` | edit | Replace the sentence that denied the 46-tool generator door. |
| `CHANGELOG.md` | edit | Unreleased note: specs now treat eight tools as first slice, not destination. |
| `.specs/spec-kernel/FR.md` | edit | Stop FR-15 from forbidding MCP growth after FR-16. |
| `.specs/spec-kernel/ACCEPTANCE_CRITERIA.md` | edit | Keep eight-tool proof as v0.3 first slice, not a forever ceiling. |
| `.specs/spec-kernel/spec-kernel.feature` | edit | Align `@feature9`/`@feature15` with first-slice versus FR-16 growth. |
| `.specs/spec-kernel/spec-kernel_SCHEMA.md` | edit | Name FR-16 operations as later query members beside the original eight. |
| `.specs/spec-kernel/TASKS.md` | edit | TASK-9 first-slice evidence; TASK-13 remains generator-port reads. |
| `.specs/spec-kernel/REQUIREMENTS.md` | edit | Keep CHK-FR16-01 outside v0.2/v0.3 required sets. |
| `.specs/spec-lsp/USER_STORIES.md` | edit | Agent navigates through MCP, not host LSP primitives. |
| `.specs/spec-lsp/USE_CASES.md` | edit | Same actor shift for definition/references/completion. |
| `.specs/spec-lsp/REQUIREMENTS.md` | edit | Retarget US/UC links after heading changes. |
| `.specs/spec-lsp/DESIGN.md` | edit | Rewrite alternative E: do not deny the generator door. |
| `.specs/spec-lsp/README.md` | edit | 46-name table is the port map, not a foreign registry. |
| `.specs/spec-lsp/CHANGELOG.md` | edit | Remove leftover «46-tool door is not this product». |
| `.specs/spec-lsp/spec-lsp.feature` | edit | Feature header must not freeze eight MCP tools as destination. |
| `.specs/spec-lsp/TASKS.md` | edit | TASK-1 must not treat agent-must-use-lsp as a desired probe outcome. |
| `.specs/spec-evidence/FR.md` | edit | Own later MCP names `get_test_result` and `get_scenario_trace`. |
| `.specs/spec-evidence/REQUIREMENTS.md` | edit | Trace those names to evidence, not kernel FR-8. |
| `.specs/spec-evidence/README.md` | edit | State MCP projection waits for this spec. |
| `.specs/spec-authoring-workflow/README.md` | edit | Name mutation MCP tools; archive/backlog become later members. |
| `.specs/spec-authoring-workflow/FR.md` | edit | Map upstream mutation names onto proposal-first operations. |
| `.specs/spec-authoring-workflow/REQUIREMENTS.md` | edit | Trace census mutation rows; keep them off the v0.3 read registry. |
| `.specs/mcp-release-integrity/README.md` | edit | Eight tools are v0.3 candidate identity, not the destination registry. |
