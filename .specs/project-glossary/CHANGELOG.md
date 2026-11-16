# История изменений
## 2026-11-16 — решения по хранению и контракту
- Хранение: одна ветка `spec-glossary` на репозиторий, файл по пути `glossary/<owner>/<project>/GLOSSARY.md`; перизоляция проектов в общем репозитории сохранена.
- Контракт: новый инструмент не вводится. Чтение — варианты `spec_documents` (`glossaryStatus`, `glossaryRead`, `glossarySearch`), запись — интенты `spec_patch` (`createGlossary`, `upsertGlossaryTerm`, `deleteGlossaryTerm`), проверка прозы — `spec_inspect {check:"glossaryViolations"}`; `spec_patch` получает общее поле `glossarySha256`. Поверхность остаётся 10 инструментов, единственный пишущий — `spec_patch`.
- Гейт допуска без автосоздания файла: отказ называет `spec_patch {intent:"createGlossary"}`; ссылка на механизм появляется в MCP-инструкциях и в `AGENTS.md` проекта.
- Нормализация текста: Unicode NFC и `toLowerCase()` JavaScript; полный case folding не применяется, `ß`/`İ` закреплены фикстурой.
- Сняты ссылки на отсутствующие в корпусе документы `spec-readiness-gate` и `spec-local-corpus-mode`.
- Второй проход ревью: варианты `spec_documents` сделаны плоскими (`glossaryStatus`, `glossaryRead`, `glossarySearch`), проверка формата перенесена из `spec_inspect` в `spec_patch` (глоссарий не узел графа), `spec_inspect` проверяет только запрещённые формы в прозе (`check:"glossaryViolations"`), гейт привязан к `READINESS_BLOCKER_CODES`/`READINESS_RULE_TEXT`/`READINESS_REFUSALS` с паритетом просмотра и записи, защита ветки подтверждается запросом правил и падает закрыто, `AGENTS.md` пишется только явной командой настройки, добавлены коды ошибок формата и лимит 1 MiB.
- Открыто: защита новой ветки, поведение при нескольких процессах, порядок поставки вместе с планом `docs/plans/corpus-outline-and-decisions-2026-11-16.md`.
