# Non-Functional Requirements

## NFR-PERF-1 — Performance

Генерация BLAST_RADIUS.md ДОЛЖНА занимать менее 30 секунд для типичного изменения в omp-spec-kit (менее 50 измененных файлов).

## NFR-CORR-1 — Correctness

Ревьюер ДОЛЖЕН выдавать не более 5% false-positive verdicts (т.е. корректные черновики не отклоняются без причины).

## NFR-REL-1 — Reliability

Workflow ДОЛЖЕН корректно обрабатывать сбои ripgrep (fallback на git grep) и отсутствие FILE_CHANGES.md (использовать git diff напрямую).

## NFR-MAINT-1 — Maintainability

Паттерны для секций ДОЛЖНЫ быть легко расширяемыми (добавление новой секции требует изменения только конфига, не кода).

## NFR-SEC-1 — Security

Workflow НЕ ДОЛЖЕН запускать произвольные команды shell; только ripgrep или git grep с контролируемыми аргументами.
