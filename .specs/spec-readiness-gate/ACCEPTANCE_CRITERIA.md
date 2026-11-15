# Acceptance criteria

Status: DRAFT

## AC-1.1 — Readiness is reported before any write

Covers: FR-1
Covers: NFR-PERF-1

Given a specification whose documents are all stubs,
when a caller previews any patch,
then the envelope reports readiness level L0 with the missing requirements as blockers, and nothing is written.

## AC-1.2 — Refusals are observable

Covers: NFR-OBS-1

Given a refused admission,
when the refusal is written,
then the durable log carries the specification slug, the code, the level and the blocker identities.

## AC-2.1 — A task on a scaffold is refused

Covers: FR-2

Given a specification with no FR and no AC,
when a caller asks for confirmTaskCreation,
then the call is refused with SPEC_NOT_READY, the blockers name the missing FR and AC,
and the fix list starts with the call that adds the first FR.

## AC-2.2 — A traced task on an assembled specification is accepted

Covers: FR-2

Given a specification at L2 with FR-1 and AC-1.1 and a non-stub DESIGN,
when a task is created with requirements ["FR-1"],
then the task is written and the graph reports no ORPHAN_TASK.

## AC-3.1 — Manual task insertion is refused

Covers: FR-3

Given any specification,
when a caller patches the task document with an operation that inserts a task heading,
then the call is refused with TASK_DOCUMENT_BYPASS and the fix list names create_task.

## AC-3.2 — Backlog intents are gone

Covers: FR-3

Given any specification,
when a caller invokes addBacklogTask or registerIncidentBacklog,
then the call is refused with BACKLOG_FORBIDDEN and the message explains that a task requires a requirement.

## AC-4.1 — An untagged scenario is refused

Covers: FR-4

Given a specification with an existing FR-1,
when a caller adds a scenario with an id tag but neither the feature tag nor the criterion tag,
then the call is refused with SCENARIO_NOT_TRACEABLE and the message shows both accepted tag shapes.

## AC-5.1 — Rule text drift fails the build

Covers: FR-5

Given the generated rule block,
when a prompt or hook message carries a hand-written copy that differs,
then the drift test fails and names the file that diverged.

## AC-6.1 — Both transports refuse identically

Covers: FR-6
Covers: NFR-COMPAT-1

Given the same refused request,
when it is issued through the local stdio server and through the hosted HTTP service,
then both answers carry the same code, the same blockers and the same fix list.
