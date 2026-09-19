@app-install-live
Feature: Operator installs the spec-graph-app through the YouTrack UI
  The complete operator path is exercised through real browser clicks in
  headless Chrome against the live compose stack: uploading the built ZIP
  through Administration → Apps, attaching the project, filling the service
  connection settings, and a user onboarding on the app's own Spec Service
  page (MAIN_MENU_ITEM) — not inside any issue (FR-17, TASK-16). The
  package, stack and service are the real artifacts — only the clicks are
  simulated.

  Scenario: Operator installs and connects the app entirely through the UI
    Given the live stack without the spec-graph-app installed
    And the built release zip
    When the admin signs in and opens the Apps administration page
    And uploads the zip through the Add app menu
    Then the app card opens for the uploaded app
    And the installed version equals the manifest version
    When the admin attaches the app to the Spec E2E project
    And the admin fills the service connection settings with an unreachable URL
    And alice opens the Spec Service app page
    Then the Spec Service page shows a connection error
    When the admin fills the service connection settings
    And alice reloads the Spec Service page
    Then the Spec Service page lists alpha-spec

  Scenario: A writer migrates the project specs to her own repository on the Spec Service page
    The page's repository section is the user-facing half of TASK-17: the
    writer points the project at her own specs repo, the service probes it,
    snapshots .specs across, and flips the binding — all through real browser
    clicks against the live stack.
    Given the spec-graph-app is installed with the service settings
    And a second specs repo exists in the stack
    And alice is on the Spec Service app page
    When alice tests the repository connection on the page
    Then the page reports the repository connection is ok
    When alice binds the project to her repository
    Then the page shows the bound repository state
    And the project specs landed in her repository
    When alice unbinds the project on the page
    Then the project uses the default repository again

  Scenario: A writer binds a customer's YouTrack and its app authenticates under the new tenant
    The page's IdP section is the user-facing half of TASK-13: the writer
    points the service at the customer's own YouTrack, the service probes it,
    mints a bridge secret, and the app installed on that YouTrack serves its
    users under the new tenant — all through real browser clicks against the
    live stack and a second real YouTrack instance.
    Given the spec-graph-app is installed with the service settings
    And a second YouTrack is provisioned for the external tenant
    And the tenant has its own specs repo in the stack
    And alice is on the Spec Service app page
    When alice binds the external YouTrack on the page
    Then the page shows the minted app settings for the external tenant
    And the tenant specs landed in the tenant repository
    When the app is installed on the external YouTrack with the minted settings
    Then mia sees her tenant specs on the external Spec Service page
    When alice unbinds the external YouTrack on the page
    Then the external tenant loses access

  Scenario: A member gets a working .mcp.json for her agent on the Spec Service page
    The page's "Connect your agent" step is the user-facing half of
    TASK-19: one click mints her YouTrack token and renders a ready
    .mcp.json. The test then calls the live service with the exact token
    the snippet carries — the artifact the user is told to copy is the
    artifact that is verified.
    Given the spec-graph-app is installed with the service settings
    And alice is on the Spec Service app page
    When alice requests her agent configuration on the page
    Then the page shows a ready .mcp.json for alice on her project
    And the generated token authenticates as alice against the live service

  Scenario: A tenant member onboards her own repository and agent on the Spec Service page
    The complete member journey for an external tenant: her project shows
    the repository as required, she binds her own repo on the page, sees
    the migration evidence, and copies a working .mcp.json pinned to her
    tenant — no curl, no operator involvement, no operator repo.
    Given the spec-graph-app is installed with the service settings
    And a second YouTrack is provisioned for the external tenant
    And the tenant has its own specs repo in the stack
    And the external tenant is bound and its app is installed
    And mia is on the Spec Service app page on the external YouTrack
    Then the page marks the tenant project repository as required
    When mia binds the tenant repository on the page
    Then the page shows the migration commit and document count
    And the tenant specs landed in the tenant repository
    When mia requests her agent configuration on the page
    Then the page shows a ready .mcp.json pinned to the acme tenant
    And the generated token authenticates as mia with only the acme scope
    And the tenant specs are served from the tenant repository

  Scenario: A user with no scope groups sees an honest no-access state on the page
    Given a second YouTrack is provisioned for the external tenant
    And the external tenant is bound and its app is installed
    And oda is on the Spec Service app page on the external YouTrack
    Then the page shows the no-access state and no onboarding controls

  Scenario: A reader sees specs but no bind controls on the page
    Given a second YouTrack is provisioned for the external tenant
    And the tenant has its own specs repo in the stack
    And the external tenant is bound and its app is installed
    And the tenant repository is bound for the tenant project
    And noa is on the Spec Service app page on the external YouTrack
    Then the Spec Service page lists gamma-spec for noa
    And the page shows no repository bind controls for the reader
    When noa requests her agent configuration on the page
    Then the page shows a ready .mcp.json pinned to the acme tenant

  Scenario: An issue carries only spec context and the door to the app page
    Installing the app must not turn tasks into configuration surfaces: the
    issue widget shows the linked spec and repo state, links to the Spec
    Service page, and renders no onboarding controls at all.
    Given the spec-graph-app is installed with the service settings
    And alice opens the SPEC anchor issue
    Then the issue shows the spec context card and no onboarding controls
    When alice follows the Spec Service link from the issue
    Then the Spec Service page renders its onboarding stepper
