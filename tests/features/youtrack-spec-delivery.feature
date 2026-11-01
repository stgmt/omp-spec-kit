@delivery-live
Feature: YouTrack Spec Graph delivery and setup

  The release delivers the app, the shared Spec Stack dashboard, and setup help.
  Fresh installs are empty; upgrades preserve existing specs; the demo is
  opt-in and deletable. Runs against the live compose stack after the operator
  install journey (`app-install-live.feature`).

  @id:SCEN-delivery-placement
  Scenario: Fresh install keeps the main navigation clean
    Given the app was installed through Administration -> Apps
    When an administrator opens the Spec Service page
    Then Spec Service is listed under Administration -> Integrations
    And no widget declares MAIN_MENU_ITEM
    And the main left navigation contains no Spec Graph item
    And the issue view contains no Open Spec Service link

  @id:SCEN-delivery-health
  Scenario: The setup page explains what is missing before settings exist
    Given the app is installed without serviceUrl and serviceBridgeToken
    Then the health probe names the missing settings and the next action
    When the administrator sets an unreachable service URL
    And an administrator opens the Spec Service page
    Then the Health panel renders six checks and the next action
    And it offers Provision dashboard

  @id:SCEN-delivery-second-user
  Scenario: A second user sees the shared Spec Stack dashboard
    Given the app settings are restored and a committed snapshot exists
    When an administrator provisions the Spec Stack dashboard on the page
    Then the dashboard has one full-width spec-board widget shared with All Users
    When a non-admin reader signs in and opens Spec Stack
    Then the Spec Board renders committed snapshot nodes

  @id:SCEN-delivery-upgrade
  Scenario: Reinstalling the app preserves specs and the dashboard
    Given an existing corpus and the provisioned Spec Stack dashboard
    When the same app ZIP is installed again
    Then the app id and version are unchanged
    And the spec catalog is unchanged
    And the dashboard keeps one spec-board widget

  @id:SCEN-delivery-demo
  Scenario: The opt-in demo can be loaded and deleted
    Given an explicit demo spec is created through MCP
    Then the demo spec contains representative entity kinds
    When the owner deletes the demo spec
    Then all demo cards and snapshot nodes are removed
    And the other specs are untouched

  @id:SCEN-delivery-agent-warning
  Scenario: The coding agent warns once when the plugin is unconfigured
    Given the plugin is installed without a corpus or MCP configuration
    When a session starts
    Then one bounded warning names the next action
    And it does not block and contains no secrets
    And a configured project stays silent
