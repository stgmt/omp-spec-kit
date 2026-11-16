# Предполагаемые области изменений
- Контракт инструмента `spec_glossary` (действия `status|read|search|check|create|upsertTerm|deleteTerm`) и параметр `glossarySha256` у существующего `spec_patch`: `src/adapters/tool-contracts.js`, `src/mcp/server.js` (`MCP_SERVER_INSTRUCTIONS`), `src/service/dispatch.js`.
- Хранение и привязка: ветка `spec-glossary`, путь `glossary/<owner>/<project>/GLOSSARY.md`, сверка метаданных — `src/service/mounts.js`, `src/service/spec-binding.js`, `src/service/branch-policy.js`.
- Запись: переиспользовать `src/authoring/transactions.js` (`withWriteLock`, журнал по `requestId`), не создавать второй путь; атомарность и повтор — там же.
- Разбор и проверка: `src/kernel/parsers/markdown.js` (единый Markdown-парсер, кодовые блоки, inline-code), правила нормализации — в схеме и в одном модуле ядра, не в двух.
- Гейт допуска: `src/kernel/readiness.js` — новый код блокера и текст отказа, единый источник для описаний инструментов, MCP-инструкций и хуков.
- Инструкции проекта: генерация раздела `AGENTS.md` со ссылкой на `spec_glossary`; точка генерации уточняется при реализации, дублировать определения в `AGENTS.md` нельзя.
- Тесты: юнит ядра и сервиса, реальный MCP по обоим транспортам, плюс отрицательная проверка защиты ветки. Случаи из FIXTURES.md.
- Проверить пересечение с `docs/plans/corpus-outline-and-decisions-2026-11-16.md`: он правит `spec_documents`, `spec_catalog` и `src/kernel/parsers/markdown.js`; одновременная работа по одной поверхности не допускается.
Это план областей, не утверждение о существующих изменениях или готовности.
