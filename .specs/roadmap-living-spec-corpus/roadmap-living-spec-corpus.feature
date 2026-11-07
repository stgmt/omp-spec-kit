Feature: Living specification corpus release

  @feature1 @FR-1 @AC-1.1 @id:SCEN-phase-local-mode
  Scenario: Phase 1 a corpus opens without a registry
    Given a consumer repository whose project the registry does not know
    When the local transport serves a catalog, a read and a patch
    Then all three SHALL succeed and preflight SHALL explain the resolution
    And an internal URI SHALL not be refused as a path

  @feature2 @FR-2 @AC-2.1 @id:SCEN-phase-patch-bundle
  Scenario: Phase 2 one bundle one diff
    Given an authoring change touching four documents with two operations on one of them
    When one bundle is previewed and applied
    Then the preview SHALL be a unified diff with hunks and an explicit truncation flag
    And the apply SHALL be atomic

  @feature3 @FR-3 @AC-3.1 @id:SCEN-phase-decision-drift
  Scenario: Phase 3 decisions and open questions
    Given a decided value and a second mention of the same key with another value
    When validation runs
    Then the drift SHALL be reported with both locations
    And an open question SHALL block the task it names

  @feature4 @FR-4 @AC-4.1 @id:SCEN-phase-verify-runner
  Scenario: Phase 4 executable verification
    Given a task with a declared check and no recorded run for the current commit
    When the run is executed and completion is attempted
    Then the run SHALL produce an evidence record
    And completion SHALL be refused without a green record or a written override

  @feature5 @FR-5 @AC-5.1 @id:SCEN-phase-later-waves
  Scenario: Phase 5 later waves declared and gated
    Given the coverage matrix and the zone guard
    When the roadmap view is assembled
    Then both SHALL appear as planned with their acceptance headline
    And neither SHALL appear as shipped
