# Functional Requirements

## FR-1: Open questions as entities

The kernel SHALL expose QUESTION as an entity kind with local identifiers `Q-n`, authored in the design document. A question SHALL carry `Askee` (owner or agent), `Status` (`open`, `answered`, `dropped`) and an optional `Blocks` list of qualified requirement or task identifiers. A question identifier SHALL NOT collide with a decision identifier.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-open-questions-as-entities)

**Scenario:** `@feature1` / `SCEN-question-entity`

**Task:** [TASK-1](TASKS.md#task-1-add-the-question-entity-kind)

## FR-2: Structured decision metadata

A decision SHALL be parsed into `Date`, `Scope`, `Key`, `Value`, optional `Guard`, `Status` (`decided`, `open`, `superseded`) and optional `Supersedes`. A decision whose `Status` is missing or outside that set SHALL produce a diagnostic naming the field instead of being silently accepted as prose.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-structured-decision-metadata)

**Scenario:** `@feature2` / `SCEN-decision-metadata`

**Task:** [TASK-2](TASKS.md#task-2-parse-decision-metadata-and-evaluate-drift)

## FR-3: Decision drift diagnostic

For every decision in `decided` status that declares a `Guard` pattern, the kernel SHALL match that pattern across the corpus and SHALL require every captured value to equal the decision's `Value`. A mismatch SHALL emit `DECISION_DRIFT` naming the decision identifier, its value, and the location and text of the disagreeing mention. A decision that declares no guard SHALL be reported as `no-guard` in the drift report rather than passing silently.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-decision-drift-diagnostic), [AC-3.2](ACCEPTANCE_CRITERIA.md#ac-32-drift-names-both-locations)

**Scenario:** `@feature3` / `SCEN-decision-drift`

**Task:** [TASK-2](TASKS.md#task-2-parse-decision-metadata-and-evaluate-drift)

## FR-4: Open questions block work

An `open` question that lists `Blocks` targets SHALL produce a `BLOCKED_BY_OPEN_QUESTION` finding for each target, and a completion transition of a blocked task SHALL be refused with that finding until the question is answered or dropped. Answering or dropping a question SHALL remove the finding on the next read, with no separate cleanup step.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-open-questions-block-work)

**Scenario:** `@feature4` / `SCEN-open-question-blocks`

**Task:** [TASK-3](TASKS.md#task-3-block-work-on-open-questions)

## FR-5: Superseded decisions

A decision SHALL be able to supersede an earlier one through `Supersedes`, which SHALL produce a `SUPERSEDES` edge and SHALL set the superseded decision's status to `superseded` in the report. The drift check SHALL evaluate only `decided` decisions, and a requirement or criterion that references a superseded decision SHALL emit `STALE_DECISION_REFERENCE`.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-superseded-decisions)

**Scenario:** `@feature5` / `SCEN-supersession`

**Task:** [TASK-4](TASKS.md#task-4-supersede-decisions)
