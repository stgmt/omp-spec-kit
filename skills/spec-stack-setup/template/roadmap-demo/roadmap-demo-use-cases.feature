Feature: Browse the demonstration board

  @case:UC-1 @story:US-1
  Rule: Open the loaded specification and find its requirements
    Actor: Demo board viewer
    Boundary: Spec Graph board
    Trigger: The viewer opens the loaded specification
    Precondition: The demonstration specification is loaded
    Success: Both requirement cards are visible
    Covers: FR-1, FR-2
    Step: list | List the requirements from the selected specification
    Branch: second-card | list | The list includes the second requirement | The second card is visible | end
    ScenarioRef: second-card | SCEN-demo-two

    @feature2 @AC-2.1 @id:SCEN-demo-two
    Scenario: Demo requirement two is visible
      Given the demo specification is loaded
      When the board lists the second requirement
      Then the second requirement card is visible
