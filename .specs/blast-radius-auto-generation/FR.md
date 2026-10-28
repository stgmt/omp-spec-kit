# Functional Requirements

IDs are local here and qualified as `blast-radius-auto-generation:<id>` outside this specification.

## FR-1 — New spec_patch intent for blast radius generation

`spec_patch` ДОЛЖЕН поддерживать новый intent `generateBlastRadius`, который запускает автоматическую генерацию BLAST_RADIUS.md.

**Acceptance:** AC-1.1

## FR-2 — Generator subagent produces BLAST_RADIUS.md draft

Генератор ДОЛЖЕН анализировать изменения в репозитории (через git diff или FILE_CHANGES.md), запускать grep паттерны по секциям, и генерировать BLAST_RADIUS.md в формате presentation-reels (11 секций: Bundle paths, Configuration literals, Profile contract identifiers, и т.д.).

**Acceptance:** AC-2.1, AC-2.2

## FR-3 — Reviewer subagent validates blast radius draft

Ревьюер ДОЛЖЕН проверять черновик BLAST_RADIUS.md на полноту (все измененные файлы упомянуты), точность (паттерны покрывают изменения), и корректность (секции заполнены, подсчеты верны). Ревьюер возвращает verdict: APPROVED или NEEDS_REVISION с комментариями.

**Acceptance:** AC-3.1, AC-3.2

## FR-4 — Supervisor coordinates generator and reviewer with retry policy

Супервайзор ДОЛЖЕН координировать два сабагента через LangGraph supervisor-subagent pattern: запустить генератор → передать черновик ревьюеру → если APPROVED → сохранить через spec_patch, если NEEDS_REVISION → вернуться к генератору (максимум 2 ретрая).

**Acceptance:** AC-4.1

## FR-5 — Automatic generation enabled by default

По умолчанию, после любого `spec_patch` с operations ДОЛЖНА запускаться генерация BLAST_RADIUS.md для соответствующей спеки. Пользователь может отключить через флаг `generateBlastRadius: false`.

**Acceptance:** AC-5.1

## FR-6 — Hardcoded patterns for omp-spec-kit

Паттерны для секций ДОЛЖНЫ быть хардкодены для omp-spec-kit:
- Authoring surface: `specPatch|authoring|proposals`
- Kernel surface: `kernel|graph|parsers`
- MCP contracts: `tool-contracts|TOOL_CONTRACTS`
- Service layer: `service|dispatch|writepath`
- Test surface: `test.*\.test\.|step-definitions`

**Acceptance:** AC-6.1

## FR-7 — BLAST_RADIUS.md tracked as separate document

BLAST_RADIUS.md ДОЛЖЕН создаваться как отдельный документ в спецификации и трекироваться в графе через FILE_CHANGES.md.

**Acceptance:** AC-7.1
