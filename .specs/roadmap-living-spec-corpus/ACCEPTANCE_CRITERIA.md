# Acceptance Criteria

## AC-1.1: Phase 1 a corpus opens without a registry

**GIVEN** a consumer repository whose project the registry does not know
**WHEN** the local transport serves a catalog, a read and a patch
**THEN** all three SHALL succeed, preflight SHALL explain the resolution, and an internal URI SHALL not be refused as a path

## AC-2.1: Phase 2 one bundle one diff

**GIVEN** an authoring change touching four documents with two operations on one of them
**WHEN** one bundle is previewed and applied
**THEN** the preview SHALL be a unified diff with hunks and an explicit truncation flag, and the apply SHALL be atomic

## AC-3.1: Phase 3 decisions and open questions

**GIVEN** a decided value and a second mention of the same key with another value
**WHEN** validation runs
**THEN** the drift SHALL be reported with both locations, and an open question SHALL block the task it names

## AC-4.1: Phase 4 executable verification

**GIVEN** a task with a declared check and no recorded run for the current commit
**WHEN** the run is executed and the task is completed
**THEN** the run SHALL produce an evidence record and the completion SHALL be refused without a green record or a written override

## AC-5.1: Phase 5 later waves declared and gated

**GIVEN** the two later-wave capabilities
**WHEN** the roadmap view is assembled
**THEN** both SHALL appear as planned with their acceptance headline and SHALL NOT appear as shipped
