# Functional Requirements

## FR-1: Unified diff with hunks and context

A preview SHALL return a unified diff per changed document, with `---` and `+++` file headers, `@@` hunk headers carrying line numbers and counts, and at least three lines of context around every change. Documents SHALL be ordered by document name, and the concatenation of all per-document diffs SHALL reproduce the applied result byte for byte.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-unified-diff-with-hunks-and-context)

**Scenario:** `@feature1` / `SCEN-unified-diff`

**Task:** [TASK-1](TASKS.md#task-1-emit-real-unified-diffs)

## FR-2: Section-end append and keyed bullet upsert

The public operation set SHALL include `append_to_section`, which inserts text at the end of a named section (immediately before the next heading of equal or higher level), and `upsert_bullet`, which replaces the bullet whose leading key matches and otherwise inserts one at the end of that section. Repeating the same upsert SHALL be idempotent: a second application SHALL leave the document byte-identical.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-section-end-append), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-keyed-bullet-upsert-is-idempotent)

**Scenario:** `@feature2` / `SCEN-section-operations`

**Task:** [TASK-2](TASKS.md#task-2-publish-section-end-append-and-bullet-upsert)

## FR-3: Ordered operations on one document

A bundle SHALL accept several operations targeting the same document and SHALL apply them in array order inside the same transaction. Rejecting a duplicate document target SHALL be replaced by ordered application, while a later operation that cannot find its selector SHALL fail the whole bundle with the failing index named.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-ordered-operations-on-one-document)

**Scenario:** `@feature3` / `SCEN-ordered-operations`

**Task:** [TASK-3](TASKS.md#task-3-apply-ordered-operations-per-document)

## FR-4: Explicit preview truncation and size report

A preview SHALL report, per document, the before and after byte sizes and an explicit truncation flag. A truncated diff SHALL NOT be presented as complete: the envelope SHALL say which document was truncated and at which byte budget the diff stopped.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-explicit-preview-truncation)

**Scenario:** `@feature4` / `SCEN-preview-truncation`

**Task:** [TASK-4](TASKS.md#task-4-report-truncation-and-sizes)

## FR-5: Create a specification with authored documents

The create intent SHALL accept the initial document contents, so a new specification is created once with real content instead of a scaffold that is overwritten by a second call. A specification created this way SHALL pass the same validation and elicitation gates as any other first write.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-create-with-authored-documents)

**Scenario:** `@feature5` / `SCEN-create-with-content`

**Task:** [TASK-5](TASKS.md#task-5-create-a-specification-with-authored-documents)
