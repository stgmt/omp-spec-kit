# План: привести весь корпус спецификаций к реализуемым контрактам

## 💬 Простыми словами

### Сейчас (как работает)

Репозиторий уже публикует v0.3.2, но продуктовые спеки всё ещё говорят, что плагина и runtime нет. Собственный kernel строит по корпусу невалидный граф: одна спека даёт 17 ошибок, часть AC/NFR не распознаётся, а новые функции evidence/capability невозможно вычислить из заявленных входов. При этом канон 46 MCP-имён составлен правильно.

### Как должно быть (как я понял)

Спеки должны стать единым выполнимым контрактом. Текущий публичный статус отражает v0.3.2. Исторические доказательства v0.2/v0.3 и восемь SCHEMA-11 имён сохраняются. Исправленные схемы получают новую версию, а дополнительные возможности выпускаются как независимые capability-гейты после базовой цепочки релизов. Каждый blocker превращается в конкретное решение: новый вход, новая схема, новый владелец, новый гейт или явно отложенная host-зависимость с проверяемым контрактом.

### Правильно понял?

Да: задача не в том, чтобы убрать красные слова или ослабить проверки. Нужно перепроектировать противоречивые функции так, чтобы их можно было реализовать и доказать, затем синхронизировать все FR/AC/Scenario/CHK/TASK/SCHEMA/README и поставить механические запреты на повторный drift.

## 🎯 Context

Полный read-only аудит 10 спек и 150 канонических документов выявил:

- поставляемый kernel строит 1 027 узлов и 2 103 ребра, но `graph.valid=false` из-за 17 неправильных scenario ID в `mcp-release-integrity`;
- 21 AC heading и 26 NFR heading не соответствуют собственной kernel-грамматике;
- Marksman подтверждает 10 реальных битых anchors;
- `spec-evidence` не имеет данных для freshness, несовместимо считает conservation и не может представить `get_test_result`/`get_scenario_trace` [ref:.specs/spec-evidence/FR.md:55-67] [ref:.specs/spec-evidence/spec-evidence_SCHEMA.md:122-147];
- `spec-capability` не помещает repository-level CAP ID в canonical identity, требует evidence IDs без evidence input и планирует второй agent-facing OMP tool surface [ref:.specs/spec-capability/spec-capability_SCHEMA.md:5-24] [ref:.specs/spec-capability/FILE_CHANGES.md:49-58];
- `plan-gate` повторяет native plan resolver неправильно и ставит fail-open deadline за host fail-closed timeout;
- `spec-enforcement` обещает перехват всех write surfaces, но DESIGN пропускает все tool names кроме write/edit/bash и поручает pure matcher проверять symlink;
- product stage enum не представляет LSP/generator-read/evidence/capability stages;
- release/status docs отстали от опубликованной v0.3.2;
- `glfm-anchor@1` в kernel не совпадает с измеренным Marksman slugger (kernel не collapse-ит повторные `-`), поэтому исправление anchors должно быть версионированным, а не тихой сменой старого алгоритма.

### Extracted Requirements

1. Обновить весь корпус спек, а не только файлы, затронутые предыдущим generator-port коммитом.
2. Сделать blocker-ы разрешёнными архитектурными решениями, не suppress/ignore/waiver.
3. Продумать входы, выходы, схемы и release gates для каждой новой функции.
4. Сохранить историческую истинность v0.2/v0.3 и восемь SCHEMA-11 имён.
5. Сохранить agent-facing MCP-only boundary; LSP остаётся editor/MCP-internal поверхностью.
6. Исправить текущий публичный статус на v0.3.2 и убрать planned-файлы, которые уже существуют.
7. Сделать FR ↔ AC ↔ Scenario ↔ CHK ↔ TASK ↔ FILE_CHANGES двунаправленно полным.
8. Добавить механические проверки census, graph, anchors, status drift и release wording.

## 📚 Existing-Spec Inventory

### Domain/Lifecycle

| Spec | Census | Current audit verdict | Primary repair |
|---|---:|---|---|
| `mcp-release-integrity` | 6 FR / 6 AC / 17 scenarios / 11 CHK / 8 tasks | FAIL | v0.3.1↔v0.3.2 identity, scenario IDs/tags, task/CHK/status truth |
| `plan-gate` | 13 FR / 14 AC / 13 scenarios / 13 CHK / 10 tasks | FAIL | native resolver event, fallback semantics, timeout policy, AC-1.2 trace |
| `plugin-distribution` | 13 FR / 16 AC / 15 scenarios / 17 CHK / 13 tasks | FAIL | current attestation trust root, product-stage aggregate, current release status |
| `product` | 9 FR / 17 AC / 17 scenarios / 1 CHK / 9 tasks | FAIL | v0.3.2 truth, capability DAG, complete CHK matrix/census ratchet |
| `spec-authoring-workflow` | 14 FR / 51 AC / 45 scenarios / 14 CHK / 13 tasks | FAIL | v1 facade mapping, current build layout, FR-14 task/gate |
| `spec-capability` | 10 FR / 10 AC / 10 scenarios / 10 CHK / 7 tasks | FAIL | canonical CAP owner, graph/evidence split, MCP-only projection |
| `spec-enforcement` | 11 FR / 13 AC / 12 scenarios / 12 CHK / 10 tasks | FAIL | all-tool classification, filesystem containment, product release ownership |
| `spec-evidence` | 14 FR / 14 AC / 14 scenarios / 14 CHK / 10 tasks | FAIL | hash freshness, split conservation, release records, result/trace projection |
| `spec-kernel` | 17 FR / 17 AC / 17 scenarios / 17 CHK / 14 tasks | FAIL | schema v2, FR-15 source kind, FR-16/17 exhaustive operations/profiles, FC-8 |
| `spec-lsp` | 12 FR / 12 AC / 12 scenarios / 12 CHK / 12 tasks | FAIL | scope/schema cleanup, Phase-B split, task form, canonical ACs |

Every spec has the 15 canonical documents. `mcp-release-integrity` additionally has `.progress.json` and `REVIEW_NOTES.md`; `.progress.json` must stop acting as product truth and become historical/review evidence only.

### Installation/Runtime

- Root `README.md` reports public v0.3.2 and project-scope install commands.
- Runtime source of truth: root `src/**`; built payload: `plugins/omp-spec-kit/dist/**`; child `plugins/omp-spec-kit/src/**` is not a supported source layout.
- Pinned host contract: OMP v17.3.7 commit `8500092296621a6826b7136e840f8a59ea338958`.
- Native plan resolver uses `<artifactsDir>/local` before temp fallback and scans several candidate plans; existing `plan-gate` hard-codes only one temp path.
- Native `tool_call` timeout defaults to 30 seconds and fails closed; the spec currently gives its own handler 60 seconds and promises fail-open.
- Shipped eight-tool v0.3 evidence remains historical truth. New operations do not retroactively enter `kernel-v0.3`.

### Verification

- Real-corpus kernel smoke: `src/adapters/query-service.js` over repository root.
- Authoritative anchor command: `DEV_POMOGATOR_REPO_ROOT=E:/repos/omp-spec-kit node E:/repos/dev-pomogator/tools/anchor-integrity/check.mjs --all`.
- Generator-port ratchet: `npm run check:spec-port`.
- BDD: only Docker through `scripts/docker-bdd.sh`; specification text alone is not execution evidence.
- Plan validation: `npx tsx tools/plan-pomogator/validate-plan.ts` from `E:/repos/dev-pomogator`.

### Repository Baseline

- SHA: `86525eaf6f411757e001474f69d38447bafd0d28`.
- Worktree: clean at audit start.
- Canonical MCP census: exact 46/46 names, unique numbering 1..46, no silent DROP.
- Canonical documents: 150/150 present.
- Actual broken anchors: 10 (3 capability, 7 evidence).
- Runtime corpus status: invalid; 17 errors in `mcp-release-integrity`.

### Audit Closure Matrix

| Confirmed finding class | Owning todos | Closure proof |
|---|---|---|
| v0.3.2 status/evidence drift | `capture-current-release-evidence`, `truth-product-status`, `truth-distribution-kernel`, `mri-version-contract`, `mri-consumer-migration`, `mri-history-migration`, `mri-progress-state` | Root/product/distribution/kernel/MRI name one release identity and exact receipt hashes |
| Invalid AC/NFR/scenario/FC identities | `mri-trace-status`, `canonical-ac-headings`, `canonical-lsp-ac-headings`, `propagate-ac-*`, `canonical-nfr-headings`, `propagate-nfr-*`, `kernel-task-design-sync` | Candidate graph has zero rejected definitions, duplicate IDs or scenario-ID errors |
| Broken Marksman anchors | `repair-known-anchors`, `repair-evidence-anchors` | Authoritative whole-corpus anchor check returns zero |
| Kernel anchor/FR-15/16/17 schema gaps | `kernel-anchor-v2`, `kernel-step-source-schema`, `kernel-generator-schemas`, `kernel-task-design-sync` | Historical kernel@1 and contract-v2 checks both pass their own profiles |
| Evidence P0 contracts | `evidence-freshness-hash`, `evidence-conservation-output`, `evidence-release-gate`, `evidence-secondary-contracts` | Hash freshness, split conservation, release records and MCP outputs are representable |
| Capability P0 contracts | `capability-identity-core`, `capability-impact-overlay`, `capability-mcp-gate` | Per-owning-spec CAP identities, graph/evidence split and MCP-only surface are closed |
| Authoring v1/build/citation drift | `authoring-v1-facade`, `authoring-build-trace`, `authoring-pinned-sources` | Every v1 name has one mapping; paths/pins match repository reality |
| LSP scope/trace drift | `canonical-lsp-ac-headings`, `lsp-current-scope`, `lsp-research-fixtures`, `lsp-task-form-trace` | Current profile contains no evidence/oracle/Phase-B behavior and every CHK owns a task |
| Plan-gate unsupported host ABI | `plan-gate-host-contract-docs`, `plan-gate-host-event`, `plan-gate-timeout-schema`, `plan-gate-trace` | Current pin truthfully reports automatic mode deferred; manual/advisory contract remains implementable |
| Enforcement bypass/ownership drift | `enforcement-no-bypass`, `enforcement-release-wiring`, `enforcement-boundary-docs` | Closed tool-effect registry, I/O containment and product gate are consistent |
| Distribution/MRI trust and stage drift | `distribution-trust-contract`, `distribution-release-schema`, `distribution-current-tasks` | Distribution result and product release conjunction have non-overlapping owners |
| Ratchet coverage holes | `ratchet-port-census`, `ratchet-graph-anchor-status`, `release-wording-ratchet`, `final-corpus-verdict` | Exact census, status, graph, anchor and release wording regressions fail normal verification |


## 👤 User Stories

- Как пользователь, я хочу читать один честный current status, чтобы понимать, что уже опубликовано, а что только спроектировано.
- Как агент OMP, я хочу вызывать только MCP-дверь спек, чтобы LSP и extension tools не создавали конкурирующие API.
- Как автор спеки, я хочу чтобы каждое требование имело реализуемые входы/выходы и полный trace, чтобы green scenario нельзя было получить на неполном контракте.
- Как release owner, я хочу независимые capability-гейты поверх доказанной базовой версии, чтобы одна новая функция не переписывала историю v0.3.
- Как maintainer kernel, я хочу версионированные schema/anchor contracts, чтобы исправление Marksman parity не ломало старые receipts.
- Как reviewer, я хочу один corpus ratchet, который ловит invalid graph, битые anchors, status drift, потерю census rows и неверное eight-tool wording.

## 🔀 Use Cases

- UC-1: Открыть product status и увидеть v0.3.2 DELIVERED, advisory для v0.3.0 и отдельно planned/deferred capability-гейты.
- UC-2: Собрать корпус kernel v2 и получить `graph.valid=true`, ноль rejected canonical AC/NFR/scenario definitions и ноль duplicate IDs.
- UC-3: Запросить later generator read через MCP; запрос/ответ/error/cursor определены exhaustively, первые восемь имён остаются.
- UC-4: Присоединить test result к текущей версии сценария по content hashes/graph fingerprint; timestamp не нужен для доказательства freshness.
- UC-5: Получить `get_test_result` и `get_scenario_trace` с pass/fail, run identity, provenance, failed step/error и evidence hash.
- UC-6: Запросить capability impact; pure graph отвечает affected nodes/scenarios, evidence overlay отдельно отвечает какие result records стали stale.
- UC-7: Применить authoring facade `add_phase`/repair через proposal-first v1 mapping без отдельного raw write path.
- UC-8: Открыть `.specs/**` в editor; LSP показывает kernel-only hover. Evidence и Phase-B step diagnostics появляются только в отдельных accepted profiles.
- UC-9: Запросить plan approval; host отдаёт gate уже выбранный native resolver plan URL/hash/content, поэтому gate не повторяет fallback search.
- UC-10: Попытаться писать в `.specs/**` через любой raw tool; enforcement классифицирует effect, проверяет realpath/reparse через I/O resolver и разрешает только authoring MCP authority.
- UC-11: Выпустить capability после v0.3: product evaluator проверяет baseline stage + capability-specific aggregate, не перезаписывая historical v0.3 gate.

## 📐 Requirements

### FR (Functional Requirements)

- PLAN-FR-1: Product/status documents SHALL describe published v0.3.2 and bind claims to current receipts; historical public-init/v0.1/v0.2/v0.3 records remain evidence, not current status.
- PLAN-FR-2: Every canonical FR/AC/NFR/TASK/SCEN/CHK/FC identity SHALL parse under the repository's own kernel schema; the real corpus graph SHALL be valid.
- PLAN-FR-3: The lifecycle SHALL be baseline sequence `public → v0.1 → v0.2 → v0.3`, followed by a dependency DAG of independently gated capabilities (`generator-reads`, `lsp`, `evidence`, `capability`, `plan-gate`, `authoring`, `enforcement`) rather than one false linear order.
- PLAN-FR-4: Historical `spec-kernel@1`/`glfm-anchor@1` receipts SHALL remain immutable; corrected Marksman parity and later operations SHALL use versioned `spec-kernel@2` / `marksman-anchor@2` contracts.
- PLAN-FR-5: `marksman-anchor@2` SHALL implement the measured Marksman rule (Unicode lowercase, punctuation removed, whitespace/hyphen runs collapsed) and expose an explicit migration map from legacy anchors.
- PLAN-FR-6: FR-15 SHALL have a constructible step-source type; FR-16 query operations and FR-17 adapter I/O SHALL have exhaustive args/results/errors/MCP mappings and standalone evidence profiles.
- PLAN-FR-7: Evidence freshness SHALL bind producer results to graph fingerprint, scenario content hash, step-binding-set hash and implementation artifact hash; wall-clock timestamps MAY be display metadata but SHALL NOT be the freshness authority.
- PLAN-FR-8: Evidence conservation SHALL separate unique authored scenarios from producer result rows and canonical/overlay records.
- PLAN-FR-9: Evidence release records SHALL contain status, evidence refs/hashes, candidate identity, graph/evidence fingerprints and deterministic blockers; FR-14 SHALL be mandatory for the evidence-MCP capability gate.
- PLAN-FR-10: `get_test_result` / `get_scenario_trace` SHALL have exhaustive request/result/error schemas including run ID/source, canonical-vs-overlay, pass/fail, trace identity, failed step/error, freshness binding and evidence hashes.
- PLAN-FR-11: Capability nodes SHALL use a real owner slug and kernel-compatible document kind; pure impact SHALL return affected graph/scenario IDs, while evidence invalidation SHALL be a separate overlay operation.
- PLAN-FR-12: Capability projection SHALL be MCP-only. No new `pi.registerTool` agent surface is permitted.
- PLAN-FR-13: Authoring v1 MCP names SHALL map explicitly to closed proposal/EditOperation requests. Names without a v1 mapping SHALL move consistently to v2; no name may be both v1 and “not in v1”.
- PLAN-FR-14: LSP v1 SHALL expose only kernel-stored fields and current-stage navigation/diagnostics. Evidence hover, oracle parity and Phase-B step diagnostics require separate accepted profiles.
- PLAN-FR-15: Plan gate SHALL consume the exact plan selected by the native resolver via a pinned host event carrying URL/content hash/content. Until that host event exists, the automatic gate is DEFERRED, not simulated with guessed paths. Internal work SHALL complete before the host's 30-second fail-closed timeout.
- PLAN-FR-16: Enforcement SHALL classify write effect for every tool, use an I/O-capable containment resolver, and route accepted mutations only to the authoring MCP authority. The product authoring gate SHALL include `spec-enforcement`.
- PLAN-FR-17: Distribution/MRI contracts SHALL use one current version (v0.3.2), one attestation trust-root contract, complete baseline/capability aggregates and consistent scenario/task statuses.
- PLAN-FR-18: Corpus ratchets SHALL verify exact 46-name conservation, owner/stage non-empty, shipped-graph validity, canonical ID forms, Marksman anchors, status reality and release-note first-slice wording on every normal verification run.

### Acceptance Criteria (EARS)

- WHEN the current product status is rendered THEN it SHALL report v0.3.2 as delivered and SHALL NOT report an absent plugin/runtime/public remote.
- WHEN the real corpus is built with the shipped/candidate kernel THEN graph validity SHALL be true, error count SHALL be zero, and every canonical definition SHALL be elected exactly once.
- WHEN a post-v0.3 capability is evaluated THEN the product SHALL require the v0.3 baseline plus that capability's exact aggregate and SHALL NOT imply unrelated sibling capability delivery.
- WHEN a result claims FRESH THEN its graph/scenario/step/artifact hashes SHALL equal the current inputs; missing hash bindings SHALL yield INDETERMINATE.
- WHEN canonical and overlay results both exist THEN authored conservation SHALL count one scenario while producer conservation SHALL count both producer rows.
- WHEN `get_scenario_trace` returns a failed result THEN it SHALL include run/source, trace identity, failed step/error, current freshness bindings and evidence hashes.
- WHEN capability impact runs without evidence input THEN it SHALL return affected scenarios, not producer result IDs; evidence invalidation SHALL require an evidence snapshot input.
- WHEN authoring v1 inventory is listed THEN each listed MCP name SHALL resolve to one proposal-first request mapping and no v1 exclusion sentence SHALL deny that mapping.
- WHEN plan approval is requested THEN the gate SHALL validate the exact native-resolver selection and SHALL NOT run an independent fallback search.
- WHEN a raw tool can mutate `.specs/**` THEN enforcement SHALL classify it before execution and SHALL refuse or route through the authoring MCP authority.
- WHEN release notes are generated for the v0.3 lineage THEN eight tools SHALL be labeled v0.3 first slice/candidate identity, not destination ceiling.
- WHEN corpus verification runs THEN deleting/duplicating a census row, breaking an anchor, adding a noncanonical ID, creating status drift or making graph invalid SHALL fail the command.

### NFR (Non-Functional Requirements)

- Performance: deterministic corpus checks SHALL finish in 10 seconds on the current 150-document corpus; plan/enforcement handlers SHALL finish before the 30-second host timeout with an internal hard budget no greater than 20 seconds.
- Security: all filesystem checks SHALL use canonical root, realpath/reparse/symlink containment and repository-relative redacted diagnostics; no pure function may claim to inspect filesystem links.
- Reliability: all release/capability gates use all-not-any, hash-bound records and closed failure codes; historical receipts remain readable after schema versioning.
- Usability: current status and roadmap must answer “what is delivered / what is next / what blocks it” without reading task internals; errors name exact file/entity/repair.

### Assumptions

- v0.3.2 is the current public release and remains the baseline for this spec repair.
- Existing v0.2/v0.3 receipts are immutable historical evidence; new schema versions do not reinterpret them.
- Actual runtime implementation of generator/evidence/capability/authoring/LSP is outside this spec-repair change; this plan produces implementable contracts, task DAGs and ratchets.
- The OMP host event needed by automatic plan-gate may require an upstream OMP change; the plan records the exact event contract and keeps the feature deferred until the pin includes it rather than faking current support.

### Risks

- Renaming 47 noncanonical AC/NFR headings changes anchors; use LSP/anchor fixer and one atomic link migration per spec.
- Changing anchor semantics without versioning would invalidate old receipts; use `marksman-anchor@2` and an explicit migration table.
- Updating current status without binding real receipts would launder root README claims; cite existing release/attestation/lifecycle evidence by exact path/hash.
- Splitting product stages into a capability DAG can expose previously implicit missing gates; that is desired and must not be papered over with generic “later”.

### Out of Scope

- Runtime implementation of FR-16/FR-17/evidence/capability/authoring/LSP handlers.
- Rewriting or deleting public v0.1/v0.2/v0.3 tags, release assets or historical receipts.
- Adding a second plugin, extension control plane or agent-facing LSP/OMP spec tool surface.
- Weakening kernel validation, skipping scenarios, suppressing diagnostics or marking tasks done without evidence.

## 🔧 Implementation Plan

1. Establish current truth: bind product/distribution/kernel/MRI status to v0.3.2 release evidence and separate historical status from current state.
2. Normalize all AC/NFR/scenario/FC identities under the kernel grammar; migrate inbound links atomically and remove duplicate FC-8.
3. Introduce `spec-kernel@2` / `marksman-anchor@2` as a later capability schema while preserving @1 receipts and first-slice v0.3 evidence.
4. Replace the false linear post-v0.3 roadmap with a baseline-plus-capability DAG and exact aggregate gates/owners for every sibling capability.
5. Complete kernel FR-15/16/17 request/result/error/evidence-profile schemas, then synchronize their design, tasks, acceptance criteria and Docker BDD obligations.
6. Redesign evidence around content-hash freshness, split conservation counts, executable release records and complete result/trace projections.
7. Redesign capability identity and impact as graph-only core plus evidence overlay; remove the second agent-facing OMP registration path.
8. Resolve authoring v1/v2 inventory into a closed facade-to-proposal mapping and update the actual root-source/build layout.
9. Trim LSP v1 to its accepted kernel-only scope and move evidence/step/oracle behavior into separately gated profiles.
10. Ground plan-gate in an exact post-native-resolver host event and set an internal deadline below the host timeout; do not ship automatic gating on the current missing ABI.
11. Redesign enforcement around effect classification plus filesystem-backed containment, wire it into the single extension, and add its aggregate to the product authoring gate.
12. Reconcile distribution/MRI trust, version and stage aggregates; regenerate trace matrices/tasks from the single v0.3.2 contract.
13. Expand corpus ratchets and normal verification so census/graph/anchors/status/release wording cannot drift independently.
14. Run one fresh ten-spec review plus shipped-kernel graph smoke; store the evidence report and leave every unresolved finding as a named open task, never a hidden warning.

### 🔎 Источники / Пруфы

- Current public release and install command: `[ref:README.md:5-18]`.
- Current baseline commit: `[cmd:git rev-parse HEAD → 86525eaf6f411757e001474f69d38447bafd0d28]`.
- Exact 46-name census: `[ref:docs/decisions/spec-generator-port.md:37-86]`; source equality checked against `E:/repos/dev-pomogator/tools/spec-mcp-server/tools.ts`.
- Kernel graph smoke: `[cmd:createSpecService(E:/repos/omp-spec-kit) → graph.valid=false; 17 errors; 1,027 nodes; 2,103 edges]`.
- Marksman anchor truth: `[cmd:anchor-integrity/check.mjs --all → 10 broken anchors]`.
- Native local root precedence: `[ref:C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/internal-urls/local-protocol.ts:242-253]`.
- Native plan fallback order: `[ref:C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/plan-mode/approved-plan.ts:151-182]`.
- Native tool-call timeout/fail-closed behavior: `[ref:C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/extensions/runner.ts:1429-1468]`.
- Evidence has no kernel source timestamps: `[ref:.specs/spec-kernel/spec-kernel_SCHEMA.md:59-79]`, `[ref:.specs/spec-evidence/FR.md:55-67]`.
- Authoring v1 contradiction: `[ref:.specs/spec-authoring-workflow/FR.md:128-138]`, `[ref:.specs/spec-authoring-workflow/spec-authoring-workflow_SCHEMA.md:226]`.

## 💥 Impact Analysis

N/A — план не удаляет, не перемещает и не переименовывает файлы. Heading retitles выполняются как edits с одновременным обновлением всех inbound links через Marksman/anchor tooling.

## 📋 Todos

---

### 📋 `capture-current-release-evidence`

> Захватить независимую current-status запись v0.3.2 до редактирования product status.

- **files:** `docs/validation/release-status-v0.3.2.json` *(create)*, `.specs/product/FIXTURES.md` *(edit)*
- **changes:**
  - Записать release URL, tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`, package-tree digest `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92` и archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5b15c7e3bb363a0cbea9`.
  - Скачать release assets во временную директорию, выполнить `gh attestation verify` и сохранить только bounded receipt identities/hashes, не asset bytes.
- **refs:** PLAN-FR-1, PLAN-FR-17
- **deps:** *none*

---

### 📋 `public-capability-map`

> Синхронизировать root README с baseline-plus-capability DAG без изменения опубликованной истории.

- **files:** `README.md` *(edit)*, `ROADMAP.md` *(edit)*
- **changes:**
  - Заменить линейный planned-delivery список на baseline v0.3.2 плюс independently gated capability map.
  - Сохранить public install/advisory text и добавить qualified owner/gate links для каждого capability.
- **refs:** PLAN-FR-1, PLAN-FR-3
- **deps:** `capture-current-release-evidence`

---

### 📋 `truth-product-status`

> Сделать product current status равным опубликованной v0.3.2, сохранив public-init как исторический этап.

- **files:** `.specs/product/README.md` *(edit)*, `.specs/product/product_SCHEMA.md` *(edit)*, `.specs/product/CHANGELOG.md` *(edit)*
- **changes:**
  - Заменить текущий PUBLIC_INIT/SPEC_ONLY instance на evidence-bound v0.3.2 status и отдельно сохранить historical stage rows.
  - Удалить текущие утверждения «нет plugin/runtime/release» и привязать delivered claims только к `docs/validation/release-status-v0.3.2.json`.
- **refs:** PLAN-FR-1, PLAN-FR-3
- **deps:** `capture-current-release-evidence`

---

### 📋 `truth-distribution-kernel`

> Синхронизировать distribution и kernel документы с уже существующими v0.1/v0.2/v0.3 артефактами.

- **files:** `.specs/plugin-distribution/README.md` *(edit)*, `.specs/plugin-distribution/CHANGELOG.md` *(edit)*, `.specs/spec-kernel/README.md` *(edit)*
- **changes:**
  - Разделить normative contract и current delivery evidence вместо заявления, что implementation отсутствует.
  - Заменить planned-only file/status language на historical delivered baseline и future capability rows.
- **refs:** PLAN-FR-1
- **deps:** `truth-product-status`

---

### 📋 `mri-version-contract`

> Выбрать v0.3.2 единственным текущим MRI candidate contract и оставить v0.3.1 историей.

- **files:** `.specs/mcp-release-integrity/FR.md` *(edit)*, `.specs/mcp-release-integrity/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/mcp-release-integrity/mcp-release-integrity_SCHEMA.md` *(edit)*
- **changes:**
  - Обновить candidate/tag/archive/upgrade/rollback identities на v0.3.2 и вынести v0.3.1 в historical changelog prose.
  - Нормализовать AC IDs к AC-N.M и сохранить v0.3 first-slice qualifier у eight-tool доказательства.
- **refs:** PLAN-FR-2, PLAN-FR-17
- **deps:** `truth-product-status`

---

### 📋 `mri-trace-status`

> Сделать MRI сценарии распознаваемыми kernel и синхронизировать matrix/check/task состояния.

- **files:** `.specs/mcp-release-integrity/mcp-release-integrity.feature` *(edit)*, `.specs/mcp-release-integrity/REQUIREMENTS.md` *(edit)*, `.specs/mcp-release-integrity/TASKS.md` *(edit)*
- **changes:**
  - Переименовать 17 scenario IDs в lower-kebab, добавить canonical `@featureN`/`@AC-N.M` tags и обновить все ссылки.
  - Связать каждый scenario с CHK и task; сделать summary статусы равными detailed block статусам.
- **refs:** PLAN-FR-2, PLAN-FR-14, PLAN-FR-17
- **deps:** `mri-version-contract`

### 📋 `mri-consumer-migration`

> Обновить все пользовательские и исследовательские ссылки после v0.3.2/scenario-ID миграции.

- **files:** `.specs/mcp-release-integrity/USER_STORIES.md` *(edit)*, `.specs/mcp-release-integrity/USE_CASES.md` *(edit)*, `.specs/mcp-release-integrity/RESEARCH.md` *(edit)*
- **changes:**
  - Заменить каждую v0.3.1 current claim и старый SCEN-MRI-NNN reference на canonical v0.3.2/lower-kebab identity.
  - Исправить независимые тесты, которые сейчас ссылаются на сценарий с другим поведением.
- **refs:** PLAN-FR-2, PLAN-FR-17
- **deps:** `mri-trace-status`

---

### 📋 `mri-history-migration`

> Отделить v0.3.1 history от текущего v0.3.2 contract во всех design/fixture/file maps.

- **files:** `.specs/mcp-release-integrity/DESIGN.md` *(edit)*, `.specs/mcp-release-integrity/FILE_CHANGES.md` *(edit)*, `.specs/mcp-release-integrity/FIXTURES.md` *(edit)*
- **changes:**
  - Перевести current candidate/version authorities на v0.3.2, оставив v0.3.1 только в explicit historical sections.
  - Обновить fixture ground truth, archive names и planned/delivered file-state descriptions.
- **refs:** PLAN-FR-1, PLAN-FR-17
- **deps:** `mri-consumer-migration`

---

### 📋 `mri-progress-state`

> Сделать MRI progress/review/changelog состояние внутренне возможным и неавторитетным для product status.

- **files:** `.specs/mcp-release-integrity/.progress.json` *(edit)*, `.specs/mcp-release-integrity/REVIEW_NOTES.md` *(edit)*, `.specs/mcp-release-integrity/CHANGELOG.md` *(edit)*
- **changes:**
  - Исправить порядок phase confirmations и пометить progress JSON как workflow metadata, не release authority.
  - Записать v0.3.2 current contract и v0.3.1 historical remediation без contradictory unreleased claims.
- **refs:** PLAN-FR-1, PLAN-FR-17
- **deps:** `mri-history-migration`

---


---

### 📋 `canonical-ac-headings`

> Нормализовать оставшиеся parenthetical AC headings, которые kernel сейчас не избирает как nodes.

- **files:** `.specs/plan-gate/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/spec-capability/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/spec-enforcement/ACCEPTANCE_CRITERIA.md` *(edit)*
- **changes:**
  - Перевести AC-1.2, AC-7.2 и AC-10.2 в colon/em-dash canonical форму и обновить локальные inbound anchors.
  - Довести каждый новый AC до FR, scenario, CHK и task, а не оставлять orphan heading.
- **refs:** PLAN-FR-2, PLAN-FR-18
- **deps:** *none*

---

### 📋 `canonical-lsp-ac-headings`

> Перевести все двенадцать LSP AC из parenthetical формы в kernel-supported форму.

- **files:** `.specs/spec-lsp/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/spec-lsp/REQUIREMENTS.md` *(edit)*, `.specs/spec-lsp/spec-lsp.feature` *(edit)*
- **changes:**
  - Удалить `(FR-N)` из heading identity, сохранить explicit Requirement field и обновить все AC anchors/tags.
  - Подтвердить, что local AC nodes избираются внутри spec-lsp и не резолвятся ошибочно в plan-gate.
- **refs:** PLAN-FR-2, PLAN-FR-14
- **deps:** *none*

### 📋 `propagate-ac-plan-gate`

> Применить новый AC-1.2 identity ко всем plan-gate consumers.

- **files:** `.specs/plan-gate/FR.md` *(edit)*, `.specs/plan-gate/REQUIREMENTS.md` *(edit)*, `.specs/plan-gate/plan-gate.feature` *(edit)*
- **changes:**
  - Обновить FR acceptance backlinks, matrix row, CHK trace и scenario tags на canonical AC-1.2.
  - Добавить changed-session branch с explicit previous/new session identities, ради которого отдельный AC-1.2 существует.
- **refs:** PLAN-FR-2, PLAN-FR-15
- **deps:** `canonical-ac-headings`

---

### 📋 `propagate-ac-capability`

> Применить новый AC-7.2 identity ко всем capability consumers.

- **files:** `.specs/spec-capability/FR.md` *(edit)*, `.specs/spec-capability/REQUIREMENTS.md` *(edit)*, `.specs/spec-capability/spec-capability.feature` *(edit)*
- **changes:**
  - Обновить acceptance backlinks, matrix/CHK trace, feature tags и every inbound anchor.
  - Сохранить separate AC-7.1 и AC-7.2 observables вместо объединения двух independently verifiable contracts.
- **refs:** PLAN-FR-2, PLAN-FR-11
- **deps:** `canonical-ac-headings`

---

### 📋 `propagate-ac-enforcement`

> Применить новый AC-10.2 identity ко всем enforcement consumers.

- **files:** `.specs/spec-enforcement/FR.md` *(edit)*, `.specs/spec-enforcement/REQUIREMENTS.md` *(edit)*, `.specs/spec-enforcement/spec-enforcement.feature` *(edit)*
- **changes:**
  - Добавить reverse FR link, matrix/CHK row и `@AC-10.2` scenario tag.
  - Не считать AC-10.1 заменой отдельного no-independent-path observable и его negative scenario.
- **refs:** PLAN-FR-2, PLAN-FR-16
- **deps:** `canonical-ac-headings`

---


---

### 📋 `canonical-nfr-headings`

> Сделать 26 category-less NFR распознаваемыми по `NFR-<CATEGORY>-N` грамматике.

- **files:** `.specs/plugin-distribution/NFR.md` *(edit)*, `.specs/product/NFR.md` *(edit)*, `.specs/spec-authoring-workflow/NFR.md` *(edit)*
- **changes:**
  - Назначить стабильные категории Security/Performance/Reliability/Usability/Maintainability, уникальные numeric suffixes и canonical qualified IDs для всех двадцати шести NFR headings.
  - Подготовить полный old→new ID map для REQUIREMENTS/FR/AC/TASK links, release evidence records и cross-spec consumers.
- **refs:** PLAN-FR-2, PLAN-FR-18
- **deps:** *none*

### 📋 `propagate-nfr-distribution`

> Применить old→new NFR mapping во всех distribution trace consumers.

- **files:** `.specs/plugin-distribution/REQUIREMENTS.md` *(edit)*, `.specs/plugin-distribution/FR.md` *(edit)*, `.specs/plugin-distribution/TASKS.md` *(edit)*
- **changes:**
  - Обновить every NFR reference, check mapping, task trace и evidence requirement ID.
  - Запретить compatibility aliases на category-less NFR IDs после проверенного чистого cutover всех consumers.
- **refs:** PLAN-FR-2, PLAN-FR-18
- **deps:** `canonical-nfr-headings`

---

### 📋 `propagate-nfr-product`

> Применить old→new NFR mapping во всех product trace consumers.

- **files:** `.specs/product/REQUIREMENTS.md` *(edit)*, `.specs/product/FR.md` *(edit)*, `.specs/product/TASKS.md` *(edit)*
- **changes:**
  - Обновить current-status schema references, requirement matrix, tasks и qualified cross-spec uses.
  - Удалить category-less NFR IDs без compatibility aliases после полного qualified-reference readback.
- **refs:** PLAN-FR-2, PLAN-FR-18
- **deps:** `canonical-nfr-headings`

---

### 📋 `propagate-nfr-authoring`

> Применить old→new NFR mapping во всех authoring trace consumers.

- **files:** `.specs/spec-authoring-workflow/REQUIREMENTS.md` *(edit)*, `.specs/spec-authoring-workflow/FR.md` *(edit)*, `.specs/spec-authoring-workflow/TASKS.md` *(edit)*
- **changes:**
  - Обновить release checks, task requirements, schema citations и evidence-profile IDs.
  - Удалить category-less NFR IDs без compatibility aliases после полного release-profile readback.
- **refs:** PLAN-FR-2, PLAN-FR-13, PLAN-FR-18
- **deps:** `canonical-nfr-headings`

---


---

### 📋 `repair-known-anchors`

> Исправить десять подтверждённых Marksman anchors и только затем запускать общий anchor gate.

- **files:** `.specs/spec-capability/FILE_CHANGES.md` *(edit)*, `.specs/spec-capability/USE_CASES.md` *(edit)*, `.specs/spec-evidence/REQUIREMENTS.md` *(edit)*
- **changes:**
  - Исправить три capability FR-2 anchors на measured Marksman slug `derivesfrom`.
  - Исправить evidence AC-7.1/FR-14/AC-14.1 anchors, включая две ссылки на одной REQUIREMENTS строке.
- **refs:** PLAN-FR-2, PLAN-FR-5, PLAN-FR-18
- **deps:** `canonical-ac-headings`

---

### 📋 `repair-evidence-anchors`

> Закрыть остальные evidence anchor occurrences после окончательных FR-14/AC-14.1 заголовков.

- **files:** `.specs/spec-evidence/FR.md` *(edit)*, `.specs/spec-evidence/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/spec-evidence/README.md` *(edit)*
- **changes:**
  - Обновить четыре оставшиеся FR/AC/README ссылки на measured slug без slash/underscore punctuation.
  - Запустить per-spec Marksman check и зафиксировать ноль broken anchors до следующих semantic edits.
- **refs:** PLAN-FR-5, PLAN-FR-18
- **deps:** `repair-known-anchors`

---

### 📋 `product-capability-dag`

> Заменить ложный линейный порядок later stages на baseline плюс независимые capability gates.

- **files:** `.specs/product/FR.md` *(edit)*, `.specs/product/product_SCHEMA.md` *(edit)*, `.specs/product/DESIGN.md` *(edit)*
- **changes:**
  - Оставить последовательность public→v0.1→v0.2→v0.3 и добавить закрытый CapabilityDelivery map с dependency sets.
  - Включить generator reads, LSP, evidence, capability, plan-gate, authoring и enforcement как отдельные агрегаты.
- **refs:** PLAN-FR-3, PLAN-FR-16
- **deps:** `truth-product-status`

---

### 📋 `product-capability-traces`

> Дать каждому новому capability gate проверяемый AC/scenario/CHK и полную owner ссылку.

- **files:** `.specs/product/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/product/product.feature` *(edit)*, `.specs/product/REQUIREMENTS.md` *(edit)*
- **changes:**
  - Добавить checks для FR-1..FR-8 и capability DAG вместо единственного phrase-only CHK-FR9-01.
  - Расширить census CHK до exact 46 names, unique 1..46, non-empty owner/stage и source-set equality.
- **refs:** PLAN-FR-3, PLAN-FR-18
- **deps:** `product-capability-dag`

---

### 📋 `product-roadmap-ownership`

> Синхронизировать публичный roadmap, product tasks и enforcement ownership с новой DAG.

- **files:** `ROADMAP.md` *(edit)*, `.specs/product/TASKS.md` *(edit)*, `.specs/product/README.md` *(edit)*
- **changes:**
  - Указать exact qualified aggregate owner на каждой capability строке и убрать противоречивые LSP/generator/evidence порядки.
  - Добавить `spec-enforcement` к authoring delivery gate и обновить task statuses по текущей реальности.
- **refs:** PLAN-FR-1, PLAN-FR-3, PLAN-FR-16
- **deps:** `product-capability-traces`

---

### 📋 `kernel-anchor-v2`

> Ввести Marksman-compatible anchor schema без ретроактивного изменения v0.2/v0.3 receipts.

- **files:** `.specs/spec-kernel/FR.md` *(edit)*, `.specs/spec-kernel/spec-kernel_SCHEMA.md` *(edit)*, `.specs/spec-kernel/DESIGN.md` *(edit)*
- **changes:**
  - Зафиксировать `marksman-anchor@2` с collapse hyphen runs и explicit legacy anchor migration map.
  - Сохранить `glfm-anchor@1` только как historical kernel@1 profile и запретить смешение cursor/fingerprint версий.
- **refs:** PLAN-FR-4, PLAN-FR-5
- **deps:** *none*

---

### 📋 `kernel-step-source-schema`

> Сделать STEP_BINDING node конструктивным, не притворяясь canonical Markdown document.

- **files:** `.specs/spec-kernel/spec-kernel_SCHEMA.md` *(edit)*, `.specs/spec-kernel/FR.md` *(edit)*, `.specs/spec-kernel/spec-kernel.feature` *(edit)*
- **changes:**
  - Добавить adapter-source kind для StepDefinitionDocument и согласовать обязательные Node source/document fields со всеми STEP_BINDING records.
  - Покрыть отсутствие FR-15 в v0.2 и v0.3 profiles отдельными scenario steps и deterministic blockers.
- **refs:** PLAN-FR-6
- **deps:** `kernel-anchor-v2`

---

### 📋 `kernel-generator-schemas`

> Определить все FR-16/FR-17 запросы и ответы exhaustively вместо списка имён в прозе.

- **files:** `.specs/spec-kernel/spec-kernel_SCHEMA.md` *(edit)*, `.specs/spec-kernel/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/spec-kernel/REQUIREMENTS.md` *(edit)*
- **changes:**
  - Добавить operation-specific args, QueryData variants, error/limit/cursor rules и MCP mapping для одиннадцати query ops.
  - Добавить request/result/error contracts для четырёх adapter I/O ops и отдельные evidence profile schemas FR-15/16/17.
- **refs:** PLAN-FR-6
- **deps:** `kernel-step-source-schema`

---

### 📋 `kernel-task-design-sync`

> Синхронизировать kernel design/task/file map и убрать duplicate FC-8.

- **files:** `.specs/spec-kernel/TASKS.md` *(edit)*, `.specs/spec-kernel/FILE_CHANGES.md` *(edit)*, `.specs/spec-kernel/CHANGELOG.md` *(edit)*
- **changes:**
  - Переименовать step-binding FILE_CHANGE в новый уникальный FC ID и обновить references.
  - Добавить schema/profile deliverables FR-15/16/17, current delivered baseline и explicit kernel@2 future tasks.
- **refs:** PLAN-FR-2, PLAN-FR-4, PLAN-FR-6
- **deps:** `kernel-generator-schemas`

---

### 📋 `evidence-freshness-hash`

> Заменить отсутствующие source timestamps на воспроизводимые content-hash bindings.

- **files:** `.specs/spec-evidence/FR.md` *(edit)*, `.specs/spec-evidence/spec-evidence_SCHEMA.md` *(edit)*, `.specs/spec-evidence/DESIGN.md` *(edit)*
- **changes:**
  - Определить graph/scenario/step-binding/artifact fingerprints как единственный freshness authority, сохранив timestamps только как необязательные display metadata.
  - Сделать FRESH/STALE/INDETERMINATE полностью вычислимым из EvidenceEvaluationInput без clock access или скрытых файлов.
- **refs:** PLAN-FR-7
- **deps:** `kernel-step-source-schema`

---

### 📋 `evidence-conservation-output`

> Разделить уникальные сценарии и producer rows, затем определить полноценные result/trace records.

- **files:** `.specs/spec-evidence/spec-evidence_SCHEMA.md` *(edit)*, `.specs/spec-evidence/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/spec-evidence/spec-evidence.feature` *(edit)*
- **changes:**
  - Заменить один `joinedResultCount` на `joinedScenarioCount` и `joinedProducerResultCount`, затем определить независимые conservation equations для каждой cardinality.
  - Добавить pass/fail, canonical/overlay, run/source/trace/failed-step/error/evidence-hash fields и one-fault negative matrices для всех выходов.
- **refs:** PLAN-FR-8, PLAN-FR-10
- **deps:** `evidence-freshness-hash`

---

### 📋 `evidence-release-gate`

> Сделать evidence release manifest доказательством, а FR-14 обязательной частью evidence-MCP stage.

- **files:** `.specs/spec-evidence/REQUIREMENTS.md` *(edit)*, `.specs/spec-evidence/TASKS.md` *(edit)*, `.specs/spec-evidence/FILE_CHANGES.md` *(edit)*
- **changes:**
  - Добавить evidence record/status/hash/candidate/blocker schema ownership и отдельные delivery tasks для FR-5 и FR-14.
  - Обновить mandatory conjunction до FR-1..FR-14 для evidence-MCP profile и добавить реальный MCP adapter planned surface.
- **refs:** PLAN-FR-9, PLAN-FR-10
- **deps:** `evidence-conservation-output`

### 📋 `evidence-secondary-contracts`

> Синхронизировать evidence NFR/use-cases/fixtures с новой схемой.

- **files:** `.specs/spec-evidence/NFR.md` *(edit)*, `.specs/spec-evidence/USE_CASES.md` *(edit)*, `.specs/spec-evidence/FIXTURES.md` *(edit)*
- **changes:**
  - Сделать diagnostic ordering, byte budgets и conservation формулы byte-identical public schema contracts.
  - Ограничить synthetic fixtures scale/minimal-negative ролями и добавить real producer provenance для executable branches.
- **refs:** PLAN-FR-7 through PLAN-FR-10
- **deps:** `evidence-release-gate`

---


---

### 📋 `capability-identity-core`

> Поместить CAP definitions в kernel-compatible owner/document identity.

- **files:** `.specs/spec-capability/FR.md` *(edit)*, `.specs/spec-capability/spec-capability_SCHEMA.md` *(edit)*, `.specs/spec-capability/DESIGN.md` *(edit)*
- **changes:**
  - Определить distributed owner rule: capability ID всегда `<owning-spec>:CAP-N`; первичные продуктовые capability принадлежат `product:CAP-N`.
  - Определить optional `<owning-spec>/CAPABILITIES.md` только в kernel@2 schema/fixtures; текущий 150-document kernel@1 corpus не получает live дополнительный документ.
- **refs:** PLAN-FR-11
- **deps:** `kernel-anchor-v2`

---

### 📋 `capability-impact-overlay`

> Разделить pure graph impact и evidence result invalidation на две операции.

- **files:** `.specs/spec-capability/spec-capability_SCHEMA.md` *(edit)*, `.specs/spec-capability/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/spec-capability/spec-capability.feature` *(edit)*
- **changes:**
  - Pure response возвращает affected requirements/AC/scenarios/tasks без producer `ScenarioResultId`, которого нет в graph-only input.
  - Evidence overlay принимает explicit evidence snapshot и возвращает stale producer result IDs вместе с hash-binding proof.
- **refs:** PLAN-FR-8, PLAN-FR-11
- **deps:** `capability-identity-core`, `evidence-conservation-output`

---

### 📋 `capability-mcp-gate`

> Удалить второй OMP tool registry и завершить capability release/trace contracts.

- **files:** `.specs/spec-capability/FILE_CHANGES.md` *(edit)*, `.specs/spec-capability/REQUIREMENTS.md` *(edit)*, `.specs/spec-capability/TASKS.md` *(edit)*
- **changes:**
  - Оставить только MCP adapter projection; удалить planned `pi.registerTool` capability surface.
  - Добавить complete release input/records/FR-9/FR-10 checks, CHK↔TASK links и реальные build paths.
- **refs:** PLAN-FR-11, PLAN-FR-12, PLAN-FR-18
- **deps:** `capability-impact-overlay`

---

### 📋 `authoring-v1-facade`

> Разрешить конфликт v1 names против closed request union одной нормативной mapping таблицей.

- **files:** `.specs/spec-authoring-workflow/FR.md` *(edit)*, `.specs/spec-authoring-workflow/spec-authoring-workflow_SCHEMA.md` *(edit)*, `.specs/spec-authoring-workflow/ACCEPTANCE_CRITERIA.md` *(edit)*
- **changes:**
  - Для каждого из 18 v1 MCP names указать exact proposal/EditOperation request mapping или согласованно перенести имя в v2.
  - Убрать contradiction repair/phase “v1 и отсутствует в v1” и добавить one-fault mapping tests в AC.
- **refs:** PLAN-FR-13
- **deps:** `product-capability-dag`

---

### 📋 `authoring-build-trace`

> Перенести planned implementation surface на существующий root-source build и дать FR-14 delivery task.

- **files:** `.specs/spec-authoring-workflow/FILE_CHANGES.md` *(edit)*, `.specs/spec-authoring-workflow/TASKS.md` *(edit)*, `.specs/spec-authoring-workflow/DESIGN.md` *(edit)*
- **changes:**
  - Заменить nonexistent child TypeScript paths на root `src/authoring/**` JavaScript и generated dist mapping.
  - Добавить FR-14/AC-14.1/CHK-FR14-01 task, MCP registry surface и qualified cumulative product gate.
- **refs:** PLAN-FR-13, PLAN-FR-16
- **deps:** `authoring-v1-facade`

### 📋 `authoring-pinned-sources`

> Убрать mutable OMP citations и синхронизировать authoring fixtures с v1/v2 mapping.

- **files:** `.specs/spec-authoring-workflow/README.md` *(edit)*, `.specs/spec-authoring-workflow/RESEARCH.md` *(edit)*, `.specs/spec-authoring-workflow/FIXTURES.md` *(edit)*
- **changes:**
  - Заменить каждый mutable `blob/main` URL на pinned commit `8500092296621a6826b7136e840f8a59ea338958` documentation authority.
  - Добавить fixture rows для каждого facade mapping и v2-only refusal.
- **refs:** PLAN-FR-13, PLAN-FR-17
- **deps:** `authoring-v1-facade`

---


---

### 📋 `lsp-current-scope`

> Сделать LSP schema равной принятому kernel-only v1 контракту.

- **files:** `.specs/spec-lsp/FR.md` *(edit)*, `.specs/spec-lsp/spec-lsp_SCHEMA.md` *(edit)*, `.specs/spec-lsp/DESIGN.md` *(edit)*
- **changes:**
  - Удалить result/provenance/freshness из hover v1 и убрать oracle-fixture из CHK-FR12-01.
  - Разделить Phase-A absence и будущий Phase-B step profile с отдельными AC/CHK/profile IDs.
- **refs:** PLAN-FR-10, PLAN-FR-14
- **deps:** `evidence-conservation-output`, `kernel-step-source-schema`

---

### 📋 `lsp-research-fixtures`

> Убрать старые решения codeAction/150ms/oracle/pytest-bdd из текущей LSP стадии.

- **files:** `.specs/spec-lsp/RESEARCH.md` *(edit)*, `.specs/spec-lsp/FIXTURES.md` *(edit)*, `.specs/spec-lsp/USE_CASES.md` *(edit)*
- **changes:**
  - Зафиксировать empty codeAction, full rebuild until kernel incremental profile и informational latency only.
  - Перенести oracle/step/evidence fixtures в будущие профили без текущего release membership.
- **refs:** PLAN-FR-14
- **deps:** `lsp-current-scope`

---

### 📋 `lsp-task-form-trace`

> Довести двенадцать LSP tasks до canonical формы и полной CHK/FR traceability.

- **files:** `.specs/spec-lsp/TASKS.md` *(edit)*, `.specs/spec-lsp/REQUIREMENTS.md` *(edit)*, `.specs/spec-lsp/CHANGELOG.md` *(edit)*
- **changes:**
  - Добавить Estimate, Done When, owner и qualified refs каждому task; все sibling CHK IDs указать без bare-ID ambiguity.
  - Привязать CHK-FR1-01, CHK-FR2-01 и каждый Phase-B check к одному конкретному delivery task.
- **refs:** PLAN-FR-14, PLAN-FR-18
- **deps:** `lsp-research-fixtures`

---

### 📋 `plan-gate-host-contract-docs`

> Зафиксировать, что текущий OMP pin не поддерживает automatic gate, и закрыть будущий ABI без выдуманного runtime claim.

- **files:** `docs/omp-plan-approval-event-contract.md` *(create)*, `docs/omp-v17.3.7-contract.md` *(edit)*, `.specs/plan-gate/README.md` *(edit)*
- **changes:**
  - Определить exact future event `{planFileUrl, planContent, planSha256, planMode, requestId}` и blocking response contract.
  - Пометить automatic mode `DEFERRED_HOST_ABI`; current implementable scope — explicit/manual validation, не automatic interception.
- **refs:** PLAN-FR-15
- **deps:** *none*

---

### 📋 `plan-gate-host-event`

> Заменить guessed file resolution на точный host contract после native plan selection.

- **files:** `.specs/plan-gate/FR.md` *(edit)*, `.specs/plan-gate/RESEARCH.md` *(edit)*, `.specs/plan-gate/DESIGN.md` *(edit)*
- **changes:**
  - Определить `plan_approval_requested` event с selected URL/content/hash/mode, blocking response и versioned host ABI.
  - Пометить automatic gate DEFERRED до OMP pin с этим event; удалить duplicate fallback resolver из target product design.
- **refs:** PLAN-FR-15
- **deps:** `plan-gate-host-contract-docs`

---

### 📋 `plan-gate-timeout-schema`

> Согласовать fail-open внутреннюю политику с 30-second host fail-closed boundary.

- **files:** `.specs/plan-gate/NFR.md` *(edit)*, `.specs/plan-gate/plan-gate_SCHEMA.md` *(edit)*, `.specs/plan-gate/ACCEPTANCE_CRITERIA.md` *(edit)*
- **changes:**
  - Установить internal deadline ≤20 seconds, closed relevance threshold и representable plan-mode/session inputs.
  - Разрешить 16 KiB completeness contradiction через bounded error count плюс explicit overflow artifact/reference.
- **refs:** PLAN-FR-15
- **deps:** `plan-gate-host-event`

---

### 📋 `plan-gate-trace`

> Закрыть AC-1.2, containment/unreadable branches и task/check связи plan-gate.

- **files:** `.specs/plan-gate/REQUIREMENTS.md` *(edit)*, `.specs/plan-gate/plan-gate.feature` *(edit)*, `.specs/plan-gate/TASKS.md` *(edit)*
- **changes:**
  - Добавить AC-1.2 и все fail-open negative branches в matrix/scenario/check/task, включая unreadable и containment failures.
  - Привязать host-event delivery к отдельному task с exact pin, captured receipt digest и executable Done When.
- **refs:** PLAN-FR-15, PLAN-FR-18
- **deps:** `plan-gate-timeout-schema`

---

### 📋 `enforcement-no-bypass`

> Сделать no-bypass contract реализуемым для всех raw write surfaces.

- **files:** `.specs/spec-enforcement/FR.md` *(edit)*, `.specs/spec-enforcement/DESIGN.md` *(edit)*, `.specs/spec-enforcement/spec-enforcement_SCHEMA.md` *(edit)*
- **changes:**
  - Определить closed `ToolEffectRegistryEntry {toolName,effect,targetExtractor,authority}`: sanctioned authoring MCP разрешён, raw writer проходит containment, unknown без доказанного non-spec target блокируется.
  - Вынести realpath/symlink/reparse проверку из pure matcher в filesystem-backed resolver с bounded diagnostics.
- **refs:** PLAN-FR-16
- **deps:** `authoring-v1-facade`

---

### 📋 `enforcement-release-wiring`

> Встроить enforcement в единственную extension factory и продуктовый authoring aggregate.

- **files:** `.specs/spec-enforcement/FILE_CHANGES.md` *(edit)*, `.specs/spec-enforcement/REQUIREMENTS.md` *(edit)*, `.specs/spec-enforcement/TASKS.md` *(edit)*
- **changes:**
  - Добавить root source import into existing extension/build path и удалить unreachable standalone adapter plan.
  - Исправить FR-39 disposition на DEFER, закрыть AC-10.2/CHK/TASK и добавить complete release evidence fields.
- **refs:** PLAN-FR-16, PLAN-FR-18
- **deps:** `enforcement-no-bypass`, `product-capability-dag`

### 📋 `enforcement-boundary-docs`

> Убрать DROP/DEFER и arbitrary-door противоречия из публичной enforcement границы.

- **files:** `.specs/spec-enforcement/README.md` *(edit)*, `.specs/spec-enforcement/CHANGELOG.md` *(edit)*
- **changes:**
  - Назвать FR-39 DEFER и закрыть redirect target только на qualified authoring MCP authority.
  - Добавить product capability-gate owner и current SPEC_ONLY/deferred status без release implication.
- **refs:** PLAN-FR-3, PLAN-FR-16
- **deps:** `enforcement-release-wiring`

---


---

### 📋 `distribution-trust-contract`

> Сделать GitHub Artifact Attestations одним действующим normative trust-root контрактом.

- **files:** `.specs/plugin-distribution/FR.md` *(edit)*, `.specs/plugin-distribution/ACCEPTANCE_CRITERIA.md` *(edit)*, `.specs/plugin-distribution/plugin-distribution.feature` *(edit)*
- **changes:**
  - Удалить фразу “trusted path only future” и описать current verifier, signer workflow/source-ref/repo pin failures.
  - Разделить distribution eligibility и product public release eligibility; MRI не заменяет kernel/product aggregates.
- **refs:** PLAN-FR-1, PLAN-FR-17
- **deps:** `truth-distribution-kernel`

---

### 📋 `distribution-release-schema`

> Согласовать release schema с product baseline/capability aggregates и текущей v0.3.2.

- **files:** `.specs/plugin-distribution/plugin-distribution_SCHEMA.md` *(edit)*, `.specs/plugin-distribution/DESIGN.md` *(edit)*, `.specs/plugin-distribution/REQUIREMENTS.md` *(edit)*
- **changes:**
  - Оставить FR-13 distribution-only result; перенести public product conjunction в product evaluator.
  - Добавить CHK↔TASK/@id trace и first-slice qualifier к manager eight-tool receipt.
- **refs:** PLAN-FR-3, PLAN-FR-17
- **deps:** `distribution-trust-contract`, `product-capability-dag`

---

### 📋 `distribution-current-tasks`

> Превратить существующие planned paths/tasks в честную current/historical/future карту.

- **files:** `.specs/plugin-distribution/FILE_CHANGES.md` *(edit)*, `.specs/plugin-distribution/TASKS.md` *(edit)*, `.specs/plugin-distribution/CHANGELOG.md` *(edit)*
- **changes:**
  - Пометить реально существующие catalog/package/src/build/test files delivered и оставить planned только будущие изменения.
  - Обновить pin/attestation/release tasks по текущим receipts и exact v0.3.2 state.
- **refs:** PLAN-FR-1, PLAN-FR-17
- **deps:** `distribution-release-schema`

---

### 📋 `ratchet-port-census`

> Расширить generator-port gate с phrase search до точной conservation проверки.

- **files:** `scripts/check-spec-generator-port-freeze.mjs` *(edit)*, `docs/decisions/spec-generator-port.md` *(edit)*, `package.json` *(edit)*
- **changes:**
  - Парсить source tools.ts и decision table; требовать exact 46 unique names, numbers 1..46, non-empty owner/stage и eight-name preservation.
  - Сканировать scripts/root CHANGELOG/plugin-distribution и включить check в normal `verify` до BDD.
- **refs:** PLAN-FR-18
- **deps:** `product-capability-traces`

---

### 📋 `ratchet-graph-anchor-status`

> Добавить один portable corpus gate поверх собственного kernel, Marksman и current status.

- **files:** `scripts/check-spec-corpus.mjs` *(create)*, `package.json` *(edit)*, `.specs/product/REQUIREMENTS.md` *(edit)*
- **changes:**
  - Fail на graph.valid=false, error diagnostics, rejected canonical definitions, duplicate IDs, broken Marksman anchors и missing qualified targets.
  - Сверять root release version/installability с product/distribution/kernel/MRI current status records и evidence receipt identities.
- **refs:** PLAN-FR-1, PLAN-FR-2, PLAN-FR-18
- **deps:** `ratchet-port-census`, `repair-evidence-anchors`, `canonical-nfr-headings`

---

### 📋 `release-wording-ratchet`

> Убрать генератор вечной восьмёрки и связать release notes с candidate stage.

- **files:** `scripts/render-release-notes.mjs` *(edit)*, `.specs/mcp-release-integrity/README.md` *(edit)*, `CHANGELOG.md` *(edit)*
- **changes:**
  - Генерировать “v0.3 first slice / candidate identity” вместо “surface remains exactly eight tools”.
  - Добавить release-note check к MRI/public status evidence и записать spec repair как Unreleased, не новый runtime release.
- **refs:** PLAN-FR-1, PLAN-FR-17, PLAN-FR-18
- **deps:** `mri-version-contract`, `ratchet-port-census`

---

### 📋 `final-corpus-verdict`

> Повторить аудит с нуля и сохранить доказательство, что blockers превращены в реализуемые contracts.

- **files:** `docs/validation/spec-corpus-contract-review.md` *(create)*, `.specs/product/TASKS.md` *(edit)*
- **changes:**
  - Записать per-spec census/verdict, shipped-kernel graph counts, anchor truth, exact census equality и remaining capability states.
  - Не закрывать задачу при любом P0/P1, invalid graph, broken anchor, stale current status или unowned capability gate.
- **refs:** PLAN-FR-1 through PLAN-FR-18
- **deps:** `ratchet-graph-anchor-status`, `release-wording-ratchet`, `distribution-current-tasks`, `lsp-task-form-trace`, `enforcement-release-wiring`, `capability-mcp-gate`, `evidence-release-gate`, `kernel-task-design-sync`

---

## ✅ Definition of Done (DoD)

### Spec-ready DoD — completion gate for this plan

- Root/product/distribution/kernel/MRI current status all describe v0.3.2 consistently and cite `docs/validation/release-status-v0.3.2.json`.
- Historical kernel@1 reads the unchanged 150-document baseline; contract-v2 static validation accepts all new schema declarations without claiming runtime@2 exists.
- Current corpus graph is valid with zero ERROR, rejected canonical AC/NFR/scenario definitions or duplicate authored IDs.
- Marksman anchor check reports zero broken anchors across all specs and root-doc targets.
- Product schema represents baseline plus every independent capability gate with qualified owner/aggregate IDs.
- Every kernel@2/evidence/capability/authoring/LSP/plan-gate/enforcement schema represents its normative outcomes and negative cases.
- Canonical 46 census is exact, source-equal and mechanically gated; eight historical SCHEMA-11 names remain.
- Every confirmed audit P0/P1 row in the Audit Closure Matrix has one passing closure proof.
- Automatic plan-gate is honestly `DEFERRED_HOST_ABI`; that state does not block other capability specs from becoming spec-ready.
- Final independent corpus review has no remaining P0/P1 against the declared spec-ready scope.

### Runtime-ready DoD — recorded for later implementation plans, not required to finish this spec repair

- Runtime kernel@2 implements marksman-anchor@2, step source kind, FR-16/FR-17 operations and standalone profiles.
- Evidence/capability/authoring/LSP/enforcement handlers pass real producer Docker BDD and candidate-bound evidence gates.
- Automatic plan-gate may move out of `DEFERRED_HOST_ABI` only after a pinned OMP runtime exposes the exact approved-plan event.
- Product capability states move to DELIVERED only from current observable aggregate evidence, never from this specification update.

### Critical files & anchors

- `.specs/product/product_SCHEMA.md` — baseline/capability state authority; reread before changing any status.
- `.specs/spec-kernel/spec-kernel_SCHEMA.md` — @1/@2 compatibility and every graph/query identity.
- `.specs/spec-evidence/spec-evidence_SCHEMA.md` — freshness, conservation, result/trace and release-record closure.
- `.specs/spec-capability/spec-capability_SCHEMA.md` — distributed CAP identity and graph/evidence split.
- `docs/decisions/spec-generator-port.md` — exact 46-name MCP ownership authority.

### Verification Plan

- Automated Tests:
  - `npm run check:spec-port`
  - `node scripts/check-spec-corpus.mjs --profile historical-kernel1`
  - `node scripts/check-spec-corpus.mjs --profile contract-v2`
  - `node scripts/check-spec-generator-port-freeze.mjs`
  - `npx tsx tools/plan-pomogator/validate-plan.ts E:/repos/omp-spec-kit/docs/plans/omp-spec-kit-corpus-contract-repair.md`
- Behavioral spec checks:
  - Build the 150-document corpus with shipped kernel@1; expect valid graph, zero errors and no rejected current-format definitions.
  - Run contract-v2 checker against planted missing operation/profile/result fields; expect exact deterministic blocker codes.
  - Delete one census row in an isolated fixture; expect `check:spec-port` to fail with missing source name.
  - Break one heading anchor in an isolated fixture; expect corpus check to report source file, line, old slug and current Marksman slug.
- Runtime BDD is deliberately absent from the spec-ready gate; each later implementation plan owns its Docker BDD commands and real fixtures.
- Manual Verification:
  - Compare current status with public release v0.3.2 and exact captured digests.
  - Inspect every capability state; each names exact dependencies, owner and evidence profile.
  - Confirm automatic plan-gate remains deferred on OMP v17.3.7 rather than silently allowing or falsely claiming interception.


## 📁 File Changes

| Path | Action | Reason |
|---|---|---|
| `docs/plans/omp-spec-kit-corpus-contract-repair.md` | create | Executable work plan for whole-corpus contract repair. |
| `docs/validation/spec-corpus-contract-review.md` | create | Final independent proof over repaired specs. |
| `docs/decisions/spec-generator-port.md` | edit | Add source-equality and capability-stage authority details. |
| `ROADMAP.md` | edit | Replace false linear later order with capability DAG and exact owners. |
| `CHANGELOG.md` | edit | Record specification repair without claiming runtime delivery. |
| `package.json` | edit | Run census/graph/anchor/status ratchets during normal verification. |
| `scripts/check-spec-generator-port-freeze.mjs` | edit | Verify exact 46-row conservation and broader wording surface. |
| `scripts/check-spec-corpus.mjs` | create | Gate shipped graph, IDs, anchors, references and current status. |
| `scripts/render-release-notes.mjs` | edit | Qualify eight tools as v0.3 first slice/candidate identity. |
| `.specs/product/README.md` | edit | Report current v0.3.2 and capability states truthfully. |
| `.specs/product/FR.md` | edit | Define baseline plus capability DAG and enforcement ownership. |
| `.specs/product/NFR.md` | edit | Convert NFR IDs to canonical category grammar. |
| `.specs/product/ACCEPTANCE_CRITERIA.md` | edit | Accept current status, capability gates and census conservation. |
| `.specs/product/product_SCHEMA.md` | edit | Represent current v0.3.2 and independent capability delivery states. |
| `.specs/product/product.feature` | edit | Cover current status, DAG and exact census ratchets. |
| `.specs/product/REQUIREMENTS.md` | edit | Complete CHK matrix and qualified owner dependencies. |
| `.specs/product/TASKS.md` | edit | Reconcile delivered/current/future task states and final review. |
| `.specs/product/DESIGN.md` | edit | Model capability DAG and one product release evaluator. |
| `.specs/product/CHANGELOG.md` | edit | Replace stale no-runtime status with history/current separation. |
| `.specs/mcp-release-integrity/FR.md` | edit | Unify current contract on v0.3.2 and first-slice wording. |
| `.specs/mcp-release-integrity/ACCEPTANCE_CRITERIA.md` | edit | Canonicalize AC IDs and v0.3.2 acceptance. |
| `.specs/mcp-release-integrity/mcp-release-integrity_SCHEMA.md` | edit | Unify candidate/evidence/lifecycle schema on v0.3.2. |
| `.specs/mcp-release-integrity/mcp-release-integrity.feature` | edit | Canonicalize scenario IDs/tags and version. |
| `.specs/mcp-release-integrity/REQUIREMENTS.md` | edit | Complete the scenario, check and task traceability matrix. |
| `.specs/mcp-release-integrity/TASKS.md` | edit | Make summary/detail states identical and trace checks. |
| `.specs/mcp-release-integrity/README.md` | edit | State current MRI scope and first-slice identity. |
| `.specs/plugin-distribution/README.md` | edit | Separate normative spec from delivered distribution evidence. |
| `.specs/plugin-distribution/FR.md` | edit | Make current attestation trust root normative and distribution-only. |
| `.specs/plugin-distribution/NFR.md` | edit | Convert every NFR to canonical category-qualified identifiers. |
| `.specs/plugin-distribution/ACCEPTANCE_CRITERIA.md` | edit | Cover current trust-root and failure cases. |
| `.specs/plugin-distribution/plugin-distribution.feature` | edit | Align release scenarios with current attestation. |
| `.specs/plugin-distribution/plugin-distribution_SCHEMA.md` | edit | Remove incomplete product release conjunction and qualify eight-tool receipt. |
| `.specs/plugin-distribution/DESIGN.md` | edit | Describe distribution result consumed by product evaluator. |
| `.specs/plugin-distribution/REQUIREMENTS.md` | edit | Complete CHK/task/scenario trace and current pin. |
| `.specs/plugin-distribution/TASKS.md` | edit | Reconcile planned tasks with delivered files/receipts. |
| `.specs/plugin-distribution/FILE_CHANGES.md` | edit | Mark current files delivered and retain future changes only. |
| `.specs/plugin-distribution/CHANGELOG.md` | edit | Record actual delivered release history and current evidence. |
| `.specs/spec-kernel/README.md` | edit | Separate delivered @1 baseline from planned @2 capabilities. |
| `.specs/spec-kernel/FR.md` | edit | Version anchors and complete FR-15/16/17 contracts. |
| `.specs/spec-kernel/spec-kernel_SCHEMA.md` | edit | Add @2 anchors, step source, later operations and evidence profiles. |
| `.specs/spec-kernel/DESIGN.md` | edit | Model FR-15/16/17 and schema-version boundaries. |
| `.specs/spec-kernel/ACCEPTANCE_CRITERIA.md` | edit | Cover exhaustive later operation/profile behavior. |
| `.specs/spec-kernel/spec-kernel.feature` | edit | Cover v0.2/v0.3 non-membership and @2 migration. |
| `.specs/spec-kernel/REQUIREMENTS.md` | edit | Trace new profiles, checks, scenarios and owning tasks. |
| `.specs/spec-kernel/TASKS.md` | edit | Add @2 and exhaustive schema deliverables. |
| `.specs/spec-kernel/FILE_CHANGES.md` | edit | Remove duplicate FC-8 and map current root-source layout. |
| `.specs/spec-kernel/CHANGELOG.md` | edit | Record delivered baseline and planned @2 changes. |
| `.specs/spec-evidence/FR.md` | edit | Define hash freshness and complete MCP output semantics. |
| `.specs/spec-evidence/spec-evidence_SCHEMA.md` | edit | Split conservation and add records/release/result/trace schemas. |
| `.specs/spec-evidence/DESIGN.md` | edit | Describe pure hash-bound evaluator and overlays. |
| `.specs/spec-evidence/ACCEPTANCE_CRITERIA.md` | edit | Cover new freshness, conservation and release evidence contracts. |
| `.specs/spec-evidence/spec-evidence.feature` | edit | Add executable scenarios for every new observable. |
| `.specs/spec-evidence/REQUIREMENTS.md` | edit | Make FR-14 mandatory in evidence-MCP profile. |
| `.specs/spec-evidence/TASKS.md` | edit | Add FR-5/FR-14 owners and MCP projection task. |
| `.specs/spec-evidence/FILE_CHANGES.md` | edit | Add real evaluator/MCP adapter implementation surface. |
| `.specs/spec-evidence/README.md` | edit | Explain hash freshness and evidence stage gate. |
| `.specs/spec-capability/FR.md` | edit | Define canonical CAP identity and graph/evidence split. |
| `.specs/spec-capability/spec-capability_SCHEMA.md` | edit | Make capability source, impact and release contracts fully representable. |
| `.specs/spec-capability/DESIGN.md` | edit | Describe graph core plus evidence overlay. |
| `.specs/spec-capability/ACCEPTANCE_CRITERIA.md` | edit | Canonicalize AC-7.2 and test both impact layers. |
| `.specs/spec-capability/spec-capability.feature` | edit | Cover canonical identity, overlay and MCP-only projection. |
| `.specs/spec-capability/REQUIREMENTS.md` | edit | Complete release and CHK/task trace. |
| `.specs/spec-capability/TASKS.md` | edit | Add owners for every check and release obligation. |
| `.specs/spec-capability/FILE_CHANGES.md` | edit | Remove agent-facing OMP tool path and use real build layout. |
| `.specs/spec-capability/USE_CASES.md` | edit | Repair confirmed FR-2 anchor and impact interaction wording. |
| `.specs/spec-authoring-workflow/FR.md` | edit | Resolve every v1/v2 facade mapping contradiction normatively. |
| `.specs/spec-authoring-workflow/NFR.md` | edit | Convert every NFR to canonical category-qualified identifiers. |
| `.specs/spec-authoring-workflow/spec-authoring-workflow_SCHEMA.md` | edit | Define exact MCP-name-to-request and edit-operation mappings. |
| `.specs/spec-authoring-workflow/ACCEPTANCE_CRITERIA.md` | edit | Cover facade mapping and v2 exclusions. |
| `.specs/spec-authoring-workflow/DESIGN.md` | edit | Use actual root-source build and product gate. |
| `.specs/spec-authoring-workflow/FILE_CHANGES.md` | edit | Replace nonexistent child TypeScript paths. |
| `.specs/spec-authoring-workflow/TASKS.md` | edit | Add FR-14 task and qualified checks. |
| `.specs/spec-lsp/FR.md` | edit | Clarify current and future profiles. |
| `.specs/spec-lsp/ACCEPTANCE_CRITERIA.md` | edit | Canonicalize all AC headings and linked requirement fields. |
| `.specs/spec-lsp/spec-lsp_SCHEMA.md` | edit | Remove evidence fields/oracle from v1. |
| `.specs/spec-lsp/DESIGN.md` | edit | Match component architecture to the accepted release scope. |
| `.specs/spec-lsp/RESEARCH.md` | edit | Remove stale codeAction, rebuild and latency decisions. |
| `.specs/spec-lsp/FIXTURES.md` | edit | Move oracle/step fixtures to future profiles. |
| `.specs/spec-lsp/USE_CASES.md` | edit | Align rebuild and actor behavior. |
| `.specs/spec-lsp/REQUIREMENTS.md` | edit | Trace profiles, checks, scenarios and owning tasks completely. |
| `.specs/spec-lsp/TASKS.md` | edit | Add canonical task fields and check ownership. |
| `.specs/spec-lsp/spec-lsp.feature` | edit | Cover current scope and future profile separation. |
| `.specs/plan-gate/FR.md` | edit | Use the exact post-native-resolver host approval event. |
| `.specs/plan-gate/RESEARCH.md` | edit | Ground resolver, fallback and timeout behavior. |
| `.specs/plan-gate/DESIGN.md` | edit | Remove guessed plan-file resolution and duplicate fallback search. |
| `.specs/plan-gate/NFR.md` | edit | Set host-compatible deadlines and bounds. |
| `.specs/plan-gate/plan-gate_SCHEMA.md` | edit | Represent selected plan/session/mode and bounded overflow. |
| `.specs/plan-gate/ACCEPTANCE_CRITERIA.md` | edit | Canonicalize AC-1.2 and complete fail-open branches. |
| `.specs/plan-gate/REQUIREMENTS.md` | edit | Trace AC-1.2 and host contract. |
| `.specs/plan-gate/plan-gate.feature` | edit | Cover exact selection and failure branches. |
| `.specs/plan-gate/TASKS.md` | edit | Add host-event delivery, pinning and receipt verification tasks. |
| `.specs/spec-enforcement/FR.md` | edit | Make all-tool no-bypass and MCP routing normative. |
| `.specs/spec-enforcement/DESIGN.md` | edit | Add effect classifier and filesystem containment resolver. |
| `.specs/spec-enforcement/spec-enforcement_SCHEMA.md` | edit | Close redirect target to authoring MCP and complete release records. |
| `.specs/spec-enforcement/ACCEPTANCE_CRITERIA.md` | edit | Canonicalize AC-10.2 and cover no-bypass. |
| `.specs/spec-enforcement/REQUIREMENTS.md` | edit | Trace every AC/check/task and product gate. |
| `.specs/spec-enforcement/TASKS.md` | edit | Add implementation, build, release and check ownership tasks. |
| `.specs/spec-enforcement/FILE_CHANGES.md` | edit | Wire into the existing extension/build surface. |
| `README.md` | edit | Present baseline v0.3.2 plus independently gated capability delivery map. |
| `docs/validation/release-status-v0.3.2.json` | create | Bind current status to public tag, digests and attestation receipts. |
| `docs/omp-plan-approval-event-contract.md` | create | Define the future exact approved-plan host event without claiming current support. |
| `docs/omp-v17.3.7-contract.md` | edit | Record that the current pin lacks the automatic plan-gate event. |
| `.specs/mcp-release-integrity/USER_STORIES.md` | edit | Migrate version and scenario references to the v0.3.2 contract. |
| `.specs/mcp-release-integrity/USE_CASES.md` | edit | Migrate version and scenario references to the v0.3.2 contract. |
| `.specs/mcp-release-integrity/RESEARCH.md` | edit | Separate historical v0.3.1 findings from current v0.3.2 authority. |
| `.specs/mcp-release-integrity/DESIGN.md` | edit | Make the candidate architecture consistently target v0.3.2. |
| `.specs/mcp-release-integrity/FILE_CHANGES.md` | edit | Reconcile current and historical file-version authorities. |
| `.specs/mcp-release-integrity/FIXTURES.md` | edit | Update candidate and lifecycle fixture ground truth to v0.3.2. |
| `.specs/mcp-release-integrity/REVIEW_NOTES.md` | edit | Record current evidence truth and historical diagnostics separately. |
| `.specs/mcp-release-integrity/.progress.json` | edit | Repair phase ordering and mark workflow metadata non-authoritative. |
| `.specs/mcp-release-integrity/NFR.md` | edit | Align public communication requirements with the v0.3.2 candidate. |
| `.specs/spec-evidence/NFR.md` | edit | Make ordering and byte-budget contracts match the public schema. |
| `.specs/spec-evidence/USE_CASES.md` | edit | Use the same split conservation equations as the schema. |
| `.specs/spec-evidence/FIXTURES.md` | edit | Enforce real producer provenance for executable evidence fixtures. |
| `.specs/spec-authoring-workflow/README.md` | edit | Pin OMP authorities and state the closed authoring boundary. |
| `.specs/spec-authoring-workflow/RESEARCH.md` | edit | Replace mutable OMP citations and align v1/v2 findings. |
| `.specs/spec-authoring-workflow/FIXTURES.md` | edit | Add complete facade-mapping and refusal fixture obligations. |
| `.specs/spec-enforcement/README.md` | edit | Correct FR-39 to DEFER and close routing to authoring MCP. |
| `.specs/spec-enforcement/CHANGELOG.md` | edit | Record the corrected product ownership and enforcement boundary. |
| `.specs/product/FIXTURES.md` | edit | Define provenance and ground truth for captured v0.3.2 release status. |
| `.specs/spec-enforcement/spec-enforcement.feature` | edit | Trace canonical AC-10.2 and no-bypass behavior through executable scenarios. |
