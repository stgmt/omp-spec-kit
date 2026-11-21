Feature: See requirements on the demonstration board

  @story:US-1
  Rule: Find the loaded requirements
    Actor: Demo board viewer
    Goal: Find the requirement cards for the loaded specification
    Benefit: Understand how a requirement appears on the board
    Covers: FR-1, FR-2
    Outcome: first-card | The first requirement card is visible
    ScenarioRef: first-card | SCEN-demo-one

    @feature1 @AC-1.1 @id:SCEN-demo-one
    Scenario: Demo requirement one is visible
      Given the demo specification is loaded
      When the board lists the first requirement
      Then the first requirement card is visible
