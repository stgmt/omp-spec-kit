# Non-Functional Requirements

## NFR-1 — Performance

Генерация BLAST_RADIUS.md ДОЛЖНА занимать менее 30 секунд для типичного изменения в omp-spec-kit (менее 50 измененных файлов).

## NFR-2 — Correctness

Ревьюер ДОЛЖЕН выдавать не более 5% false-positive verdicts (т.е. корректные черновики не отклоняются без причины).

## NFR-3 — Reliability

Workflow ДОЛЖЕН корректно обрабатывать сбои ripgrep (fallback на git grep) и отсутствие FILE_CHANGES.md (использовать git diff напрямую).

## NFR-4 — Maintainability

Паттерны для секций ДОЛЖНЫ быть легко расширяемыми (добавление новой секции требует изменения только конфига, не кода).

## NFR-5 — Security

Workflow НЕ ДОЛЖЕН запускать произвольные команды shell; только ripgrep или git grep с контролируемыми аргументами.
