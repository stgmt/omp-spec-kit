# Acceptance Criteria

## AC-1.1: Phase 1 the registration path exists

**GIVEN** a repository whose project is not registered
**WHEN** an agent calls any specification tool for it
**THEN** the refusal SHALL name one registration action
**AND** after an authorized registration the first specification SHALL be creatable with no operator step
**AND** no tool SHALL serve the corpus locally in either state

## AC-2.1: Phase 2 one bundle one diff

**GIVEN** an authoring change touching four documents with two operations on one of them
**WHEN** one bundle is previewed and applied
**THEN** the preview SHALL be a unified diff with hunks and an explicit truncation flag and the apply SHALL be atomic

## AC-3.1: Phase 3 decisions and open questions

**GIVEN** a decided value and a second mention of the same key with another value
**WHEN** validation runs
**THEN** the drift SHALL be reported with both locations and an open question SHALL block the task it names

## AC-4.1: Phase 4 executable verification

**GIVEN** a task with a declared check and no recorded run for the current commit
**WHEN** the run executes and completion is attempted
**THEN** the run SHALL produce an evidence record and completion SHALL be refused without a green record or a written override

## AC-5.1: Phase 5 release hygiene

**GIVEN** the release candidate
**WHEN** the guard, the type catalog, the task listing, the first-write gate and the roadmap intents are exercised
**THEN** each item of FR-5 SHALL behave as stated, and reverting any single fix SHALL make its check fail

## AC-6.1: Phase 5b later waves declared and gated

**GIVEN** the coverage matrix and the zone guard
**WHEN** the release view is assembled
**THEN** both SHALL appear as planned with their acceptance headline and neither SHALL appear as shipped
