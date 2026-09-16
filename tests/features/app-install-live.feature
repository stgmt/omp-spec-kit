@app-install-live
Feature: Operator installs the spec-graph-app through the YouTrack UI
  The complete operator path is exercised through real browser clicks in
  headless Chrome against the live compose stack: uploading the built ZIP
  through Administration → Apps, attaching the project, filling the service
  connection settings, and a user seeing remote specs in the issue widget
  (FR-17, TASK-16). The package, stack and service are the real artifacts —
  only the clicks are simulated.

  Scenario: Operator installs and connects the app entirely through the UI
    Given the live stack without the spec-graph-app installed
    And the built release zip
    When the admin signs in and opens the Apps administration page
    And uploads the zip through the Add app menu
    Then the app card opens for the uploaded app
    And the installed version equals the manifest version
    When the admin attaches the app to the Spec E2E project
    And the admin fills the service connection settings with an unreachable URL
    And alice opens the SPEC anchor issue
    Then the service widget shows a connection error
    When the admin fills the service connection settings
    And alice reloads the anchor issue
    Then the service widget lists alpha-spec

  Scenario: A writer migrates the project specs to her own repository through the widget
    The widget's repository section is the user-facing half of TASK-17: the
    writer points the project at her own specs repo, the service probes it,
    snapshots .specs across, and flips the binding — all through real browser
    clicks against the live stack.
    Given the spec-graph-app is installed with the service settings
    And a second specs repo exists in the stack
    And alice is viewing the SPEC anchor issue
    When alice tests the repository connection in the widget
    Then the widget reports the repository connection is ok
    When alice binds the project to her repository
    Then the widget shows the bound repository state
    And the project specs landed in her repository
    When alice unbinds the project in the widget
    Then the project uses the default repository again
