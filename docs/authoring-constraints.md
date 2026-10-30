# Authoring constraints for the spec corpus

These are kernel-level workarounds discovered while validating specifications, not decisions of a particular spec. They apply to every corpus authored through the registry (`spec_patch`) with the current `spec-kernel@2` parser.

| Правило | Причина | Проверка |
|---|---|---|
| Ссылки пишутся как `**Implements:** FR-1` без ведущего `- ` | сканер структурированных полей (`src/kernel/parsers/md-blocks.js`) не распознаёт bullet-форму и рёбра не создаются молча | тест графа на `IMPLEMENTS`/`REFS`/`DEPENDS_ON` |
| `Status` пишется только каноническим словом (`todo`, а не `pending`) | неизвестное слово нормализуется в `unknown` без ошибки | `tests/authoring-task-status.test.mjs` |
| В `Done When` нет `,` и `;` | значение режется на список по этим разделителям | проверка атрибутов задачи |
| `@id:SCEN-n` ставится на `Scenario`, не на `Feature` | иначе диагностика `MISSING_SCENARIO_ID` | `spec_inspect validation` |
| Для покрытия FR используется `@featureN`, для AC — `@AC-N.M` | `@featureN` и `@AC-N.M` создают `TESTED_BY`; `@FR-N` без namespace игнорируется, а `@ac:AC-1.1` создаёт `REFS` | `spec_inspect coverage`, `spec_inspect orphans` |
| `@NFR-N` пока не поддержан парсером | NFR-покрытие не материализуется; используйте сценарии, привязанные к FR/AC, которые ограничивает NFR | расширение `acTagRef` в `src/kernel/parsers/gherkin.js` |

These constraints are workarounds. The underlying parser gaps (bullet-form structured fields, status diagnostics, `@NFR-N`) should be fixed separately; documenting them here does not make the corpus self-validating.

## Where this file lives

The canonical corpus lives in the dedicated specs repository, served by `spec-registryd` over MCP. It contains only files under `.specs/<slug>/`, so corpus-level guidance cannot be stored there; this product document is the single place for these rules. `DESIGN.md` of a specification keeps only the constraints that spec itself discovered, with a pointer here for the rest.
