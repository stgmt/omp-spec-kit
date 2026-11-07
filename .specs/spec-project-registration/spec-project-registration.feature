Feature: Project registration

  @feature1 @FR-1 @AC-1.1 @id:SCEN-unknown-project-diagnosis
  Scenario: An unknown project is diagnosed
    Given a call targeting a project the registry does not know
    When the refusal is produced
    Then it SHALL name the project, state that it is unregistered, list the caller's allowed projects and give exactly one next action

  @feature2 @FR-2 @AC-2.1 @AC-2.2 @id:SCEN-registration
  Scenario: Registration by an authorized principal
    Given an owner principal and a repository URL
    When registration is requested twice with the same repository and branch
    Then the role SHALL be checked before any remote access and the binding SHALL be reported
    And the second request SHALL report unchanged with no re-migration

  @feature3 @FR-3 @AC-3.1 @id:SCEN-first-spec-bootstrap
  Scenario: First specification bootstrap
    Given a freshly registered project
    When the first specification is created through the tool
    Then the branch SHALL be created and the scaffold written
    And the response SHALL name the created branch with no operator step

  @feature4 @FR-4 @AC-4.1 @id:SCEN-credential-diagnosis
  Scenario: Credential diagnosis names the repair
    Given a credential the service does not accept for the project
    When registration or preflight is read
    Then the response SHALL name the repair to run
    And no field, log or audit record SHALL contain the credential value

  @feature5 @FR-5 @AC-5.1 @id:SCEN-no-local-fallback
  Scenario: No registry-less fallback
    Given an unregistered project whose corpus is present on disk
    When any specification tool is called for it
    Then the call SHALL be refused with a registration requirement and one action
    And no tool SHALL serve that corpus locally
