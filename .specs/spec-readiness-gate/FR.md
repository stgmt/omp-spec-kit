# Functional requirements

Status: DRAFT

## FR-1 — Readiness verdict for a specification

The system SHALL compute, read-only, a readiness verdict for one specification from the
corpus graph: the level reached (L0 scaffold, L1 requirements, L2 criteria and design,
L3 execution evidence, L4 tasks) and the blockers that keep it from the next level. The
verdict SHALL be available through `spec_inspect` and through the preview of `spec_patch`,
so the preview and the write report the same blockers.

## FR-2 — Task admission

The system SHALL refuse to create a task unless the target specification has reached L2 and
the task names at least one requirement that exists in the same specification. The refusal
SHALL carry the code `SPEC_NOT_READY` (or `TASK_NOT_TRACEABLE` when only the link is
missing), the blockers in level order, and a `fix` list of concrete tool calls that would
satisfy them.

## FR-3 — No task without a document path

The system SHALL refuse any operation that inserts or replaces task definitions inside
`TASKS.md` through raw document operations, with the code `TASK_DOCUMENT_BYPASS`. The
backlog intents `addBacklogTask` and `registerIncidentBacklog` SHALL be refused with
`BACKLOG_FORBIDDEN`; a task that cannot be traced is not created at all.

## FR-4 — Scenario traceability

The system SHALL refuse to add a scenario that carries neither `@featureN` nor
`@AC-N.M`, with the code `SCENARIO_NOT_TRACEABLE`, naming the scenario and the two
accepted tag shapes. A scenario that carries a tag whose target does not exist SHALL be
refused by the existing reference resolution, not by this rule.

## FR-5 — One source for the rule text

The system SHALL keep the cycle description, every refusal message and every ordered `fix`
step in one contract constant, and SHALL render it into the MCP tool descriptions and into
the team briefing. A drift test SHALL fail when any prompt, description or hook message
carries a copy that differs from the generated block.

## FR-6 — One behaviour across transports

The system SHALL apply identical admission rules, codes and messages on the local stdio
transport and on the hosted HTTP transport, and the plugin hooks SHALL delegate to the same
readiness function rather than re-implementing a subset.
