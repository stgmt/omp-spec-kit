# Acceptance Criteria

## AC-1.1: Open questions as entities

**GIVEN** a design document containing a question with an askee, an open status and a blocked requirement
**WHEN** the graph is built
**THEN** a QUESTION node SHALL exist with a `Q-n` identifier, its fields SHALL be readable, and no identifier SHALL collide with a decision

## AC-2.1: Structured decision metadata

**GIVEN** a decision whose status field is missing
**WHEN** the graph is built
**THEN** a diagnostic SHALL name the missing field and the decision identifier

## AC-3.1: Decision drift diagnostic

**GIVEN** a decided decision with value 11 and a guard pattern
**WHEN** another document states the same key with a different value
**THEN** `DECISION_DRIFT` SHALL be emitted and validation SHALL not report the specification as clean

## AC-3.2: Drift names both locations

**GIVEN** a drift between a decision and one disagreeing mention
**WHEN** the diagnostic is read
**THEN** it SHALL name the decision identifier, the declared value, and the location and text of the disagreeing mention
**AND** a decision without a guard SHALL be reported as `no-guard`, not omitted

## AC-4.1: Open questions block work

**GIVEN** an open question blocking a task
**WHEN** the task completion is attempted and the orphan findings are read
**THEN** the completion SHALL be refused and the finding SHALL name the question
**AND** answering the question SHALL remove the finding with no separate step

## AC-5.1: Superseded decisions

**GIVEN** a decision that supersedes an earlier one
**WHEN** the graph and the drift report are read
**THEN** a supersession edge SHALL exist, the earlier decision SHALL report as superseded, and a requirement still referencing it SHALL emit a stale reference finding
