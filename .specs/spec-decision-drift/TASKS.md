# Tasks

## TASK-1 — Add the QUESTION entity kind

- **Status:** planned

**Implements:** FR-1

<!-- agent-teams-description:start -->
> Add QUESTION to the entity descriptors with a `Q-n` local identifier role authored in the design document, and parse askee, status and blocked targets.
> 
> Done when:
> - the type catalog reports the kind
> - a question with a blocked requirement parses with its fields readable
> - a question identifier cannot collide with a decision identifier
<!-- agent-teams-description:end -->

## TASK-2 — Parse decision metadata and evaluate drift

- **Status:** planned

**Implements:** FR-2, FR-3

<!-- agent-teams-description:start -->
> Parse the decision fields, reject a missing or unknown status with a named diagnostic, and evaluate each declared guard pattern across the corpus.
> 
> Done when:
> - fields are readable from the graph row
> - a missing status produces a diagnostic naming the field
> - a disagreeing mention produces a drift diagnostic naming both locations
> - a decision without a guard reports `no-guard`
<!-- agent-teams-description:end -->

## TASK-3 — Block work on open questions

- **Status:** planned

**Implements:** FR-4

<!-- agent-teams-description:start -->
> Report work blocked by an open question and refuse a completion transition while the blocking question stays open, with the finding clearing itself when the question is answered.
> 
> Done when:
> - each blocked target gets a finding naming the question
> - a completion attempt is refused while the question is open
> - answering or dropping the question removes the finding on the next read
<!-- agent-teams-description:end -->

## TASK-4 — Supersede decisions

- **Status:** planned

**Implements:** FR-5

<!-- agent-teams-description:start -->
> Emit a supersession edge, report the earlier decision as superseded, exclude it from drift evaluation and flag references that still point at it.
> 
> Done when:
> - a supersession edge is traversable
> - the drift report evaluates only decided decisions
> - a requirement referencing a superseded decision emits a stale reference finding
<!-- agent-teams-description:end -->
