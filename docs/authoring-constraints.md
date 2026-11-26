# Authoring constraints for the spec corpus

These are kernel-level workarounds discovered while validating specifications, not decisions of a particular spec. They apply to every corpus authored through the registry (`spec_patch`) with the current `spec-kernel@2` parser.

| Правило | Причина | Проверка |
|---|---|---|
| Ссылки пишутся как `**Implements:** FR-1` без ведущего `- ` | сканер структурированных полей (`src/kernel/parsers/md-blocks.js`) не распознаёт bullet-форму и рёбра не создаются молча | тест графа на `IMPLEMENTS`/`REFS`/`DEPENDS_ON` |
| `Status` пишется только каноническим словом (`todo`, а не `pending`) | неизвестное слово нормализуется в `unknown` без ошибки | `tests/authoring-task-status.test.mjs` |
| В `Done When` нет `,` и `;` | значение режется на список по этим разделителям | проверка атрибутов задачи |
| `@id:SCEN-n` ставится на `Scenario`, не на `Feature` | иначе диагностика `MISSING_SCENARIO_ID` | `spec_inspect validation` |
| Для покрытия FR используется `@featureN`, для AC — `@AC-N.M` | `@featureN` и `@AC-N.M` создают `TESTED_BY`; `@FR-N` без namespace игнорируется, а `@ac:AC-1.1` создаёт `REFS` | `spec_inspect orphans`, `spec_inspect validation` |
| Критерий NFR пишется как `AC-NFR-<CATEGORY>-<N>.<M>` | ID кодирует родителя `NFR-<CATEGORY>-<N>`; форма `AC-PERF-1` не распознаётся и остаётся обычным текстом | `spec_inspect readiness`, `spec_entities` |
| Для покрытия другой спеки используется `@ref:<slug>:<FR-N\|NFR-CATEGORY-N\|AC-N.M>` | `@featureN` и `@AC-N.M` всегда локальны; голой ID, существующий только в другой спеке, теперь ошибка | `spec_inspect validation`, `spec_documents` |

These constraints are workarounds. The remaining parser gaps (bullet-form structured fields, status diagnostics) should be fixed separately; documenting them here does not make the corpus self-validating. NFR criteria are already supported as `AC-NFR-<CATEGORY>-<N>.<M>`.

## Where this file lives

The canonical corpus lives on orphan `spec-<slug>` branches of each project repository, served by `spec-registryd` over MCP. A canonical branch contains only `.spec-kit.json` and files under `.specs/<slug>/`, so corpus-level guidance cannot be stored there; this product document is the single place for these rules. `DESIGN.md` of a specification keeps only the constraints that spec itself discovered, with a pointer here for the rest.
