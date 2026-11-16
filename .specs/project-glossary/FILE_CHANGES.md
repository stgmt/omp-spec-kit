# Предполагаемые области изменений
- Контракты существующих инструментов: вариант `action:"glossary"` в `spec_documents`, интенты `createGlossary|upsertGlossaryTerm|deleteGlossaryTerm` и общее поле `glossarySha256` в `spec_patch`, проверка `check:"glossary"` в `spec_inspect` — `src/adapters/tool-contracts.js`, `src/mcp/server.js` (`MCP_SERVER_INSTRUCTIONS`), `src/service/dispatch.js`. Новый инструмент не добавляется.
- Хранение и привязка: ветка `spec-glossary`, путь `glossary/<owner>/<project>/GLOSSARY.md`, сверка метаданных — `src/service/mounts.js`, `src/service/spec-binding.js`, `src/service/branch-policy.js`.
- Запись: переиспользовать `src/authoring/transactions.js` (`withWriteLock`, журнал по `requestId`), не создавать второй путь; атомарность и повтор — там же.
- Разбор и проверка: `src/kernel/parsers/markdown.js` (единый Markdown-парсер, кодовые блоки, inline-code), правила нормализации — в схеме и в одном модуле ядра, не в двух.
- Гейт допуска: `src/kernel/readiness.js` — новый код блокера и текст отказа, единый источник для описаний инструментов, MCP-инструкций и хуков.
- Инструкции проекта: генерация раздела `AGENTS.md` со ссылкой на порядок работы с глоссарием (`spec_documents` для чтения, `spec_patch` для создания и правки); точка генерации уточняется при реализации, дублировать определения в `AGENTS.md` нельзя.
- Тесты: юнит ядра и сервиса, реальный MCP по обоим транспортам, плюс отрицательная проверка защиты ветки. Случаи из FIXTURES.md.
- Проверить пересечение с `docs/plans/corpus-outline-and-decisions-2026-11-16.md`: он правит `spec_documents`, `spec_catalog` и `src/kernel/parsers/markdown.js`; одновременная работа по одной поверхности не допускается.
Это план областей, не утверждение о существующих изменениях или готовности.
