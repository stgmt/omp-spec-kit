Feature: Specification readiness gate
  Scenarios stay in the corpus only when the graph can explain them: a task needs an
  assembled specification and a requirement, a scenario needs a requirement or criterion tag.
  Every refusal carries the blockers in level order and the exact calls that clear them.

  @id:SCEN-readiness-preview
  @feature1
  Scenario: Preview reports the level before any write
    Given a specification whose documents are stubs
    When the caller previews a task creation
    Then the preview reports level L0
    And no document changes

  @id:SCEN-task-on-scaffold-refused
  @feature2
  @AC-2.1
  Scenario: A task on a scaffold is refused with a plan
    Given a specification with no requirement and no criterion
    When the caller creates a task
    Then the refusal code is SPEC_NOT_READY
    And the fix list starts with adding the first FR

  @id:SCEN-tasks-document-bypass
  @feature3
  @AC-3.1
  Scenario: Manual task insertion is refused
    Given any specification
    When the caller inserts a task heading into the task document
    Then the refusal code is TASK_DOCUMENT_BYPASS

  @id:SCEN-scenario-not-traceable
  @feature4
  @AC-4.1
  Scenario: A scenario without a requirement tag is refused
    Given a specification with an existing functional requirement
    When the caller adds a scenario with only an id tag
    Then the refusal code is SCENARIO_NOT_TRACEABLE

  @id:SCEN-transport-parity
  @feature6
  @AC-6.1
  Scenario: Both transports refuse identically
    Given the same refused request
    When it is sent through stdio and through the hosted service
    Then both answers carry the same code and the same fix list
