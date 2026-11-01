@demo
Feature: Spec Graph Demo

  @feature1 @AC-1.1 @id:SCEN-demo-one
  Scenario: Demo requirement one is visible
    Given the demo specification is loaded
    When the board lists the first requirement
    Then the first requirement card is visible

  @feature2 @AC-2.1 @id:SCEN-demo-two
  Scenario: Demo requirement two is visible
    Given the demo specification is loaded
    When the board lists the second requirement
    Then the second requirement card is visible
