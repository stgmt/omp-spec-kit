Feature: Decision drift

  @feature1 @FR-1 @AC-1.1 @id:SCEN-question-entity
  Scenario: Open questions as entities
    Given a design document containing a question with an askee and an open status
    When the graph is built
    Then a QUESTION node SHALL exist with a Q-n identifier and readable fields
    And no question identifier SHALL collide with a decision identifier

  @feature2 @FR-2 @AC-2.1 @id:SCEN-decision-metadata
  Scenario: Structured decision metadata
    Given a decision whose status field is missing
    When the graph is built
    Then a diagnostic SHALL name the missing field and the decision identifier

  @feature3 @FR-3 @AC-3.1 @AC-3.2 @id:SCEN-decision-drift
  Scenario: Decision drift diagnostic
    Given a decided decision with a declared value and a guard pattern
    When another document states the same key with a different value
    Then the drift diagnostic SHALL name the decision, the declared value and the disagreeing location
    And a decision without a guard SHALL report as no-guard rather than passing silently

  @feature4 @FR-4 @AC-4.1 @id:SCEN-open-question-blocks
  Scenario: Open questions block work
    Given an open question that lists a task as blocked
    When the task completion is attempted and findings are read
    Then the completion SHALL be refused with a finding naming the question
    And answering the question SHALL remove the finding with no separate step

  @feature5 @FR-5 @AC-5.1 @id:SCEN-supersession
  Scenario: Superseded decisions
    Given a decision that supersedes an earlier one
    When the graph and the drift report are read
    Then a supersession edge SHALL exist and the earlier decision SHALL report as superseded
    And a requirement still referencing it SHALL emit a stale reference finding
