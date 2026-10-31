Feature: YouTrack Spec Graph delivery and setup

  The release delivers the app, the shared Spec Stack dashboard, and setup help.
  Fresh installs are empty; upgrades preserve existing specs; the demo is opt-in and deletable.

  @installation @placement @id:SCEN-delivery-placement
  Scenario: Fresh install keeps the main navigation clean
    Given the spec-graph-app ZIP is installed through Administration -> Apps
    When an administrator opens Administration -> Integrations
    Then Spec Service is listed there
    And no widget declares MAIN_MENU_ITEM
    And the main left navigation contains no Spec Graph item
    And the issue view contains no Open Spec Service link

  @setup @health @id:SCEN-delivery-health
  Scenario: The setup page explains what is missing before settings exist
    Given the app is installed without serviceUrl and serviceBridgeToken
    When the administrator opens the Spec Service page
    Then the Health panel renders before any service call
    And it names the missing settings and the next action
    And it offers Provision dashboard

  @dashboard @second-user @id:SCEN-delivery-second-user
  Scenario: A second user sees the shared Spec Stack dashboard
    Given the Spec Stack dashboard is provisioned with one spec-board widget
    And readSharingSettings includes All Users
    When a non-admin user signs in and opens Spec Stack
    Then the Spec Board renders committed snapshot nodes

  @upgrade @id:SCEN-delivery-upgrade
  Scenario: Reinstalling the app preserves specs and the dashboard
    Given an existing corpus and a provisioned Spec Stack dashboard
    When the same app ZIP is installed again
    Then the app id and version are unchanged
    And the spec catalog is unchanged
    And the dashboard keeps its spec-board widget without a duplicate

  @demo @delete @id:SCEN-delivery-demo
  Scenario: The opt-in demo can be loaded and deleted
    Given the explicit demo action runs
    Then one demo spec contains 1-2 instances of every entity kind
    When the owner deletes the demo spec
    Then all demo cards and snapshot nodes are removed
    And the other specs are untouched

  @agent @warning @id:SCEN-delivery-agent-warning
  Scenario: The coding agent warns once when the plugin is unconfigured
    Given the plugin is installed without a corpus or MCP configuration
    When a session starts
    Then one bounded warning names the next action
    And it does not block and contains no secrets
    And a configured project stays silent
