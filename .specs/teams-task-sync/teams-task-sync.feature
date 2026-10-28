Feature: Teams task sync
  As a team operator
  I want every task to live in the spec corpus and be moved through spec-kit
  So that task state is versioned, traceable to requirements and recoverable

  Background:
    Given omp-spec-kit registry is running with the team sync contract
    And team "tokenplan-ops" is bound to registry project "tokenplan"

  Scenario: Contract version mismatch stops synchronization
    @id:SCEN-1
    Given the teams build carries contract version 1
    And the registry serves contract version 2
    When teams starts
    Then synchronization is disabled
    And the error code is CONTRACT_VERSION_MISMATCH
    And no task operation reaches the registry

  Scenario: Contract is the only mapping source
    @id:SCEN-2
    Given the sync contract is generated
    When the teams build produces status constants
    Then the constants are generated from the contract
    And no hand-written status table exists in the repository

  Scenario: Deterministic identity survives projection loss
    @id:SCEN-3
    Given canonical task "tokenplan/teams-task-sync/TASK-3"
    When the projection is created twice, including after deleting the task directory
    Then both projections have the same id
    And the id equals UUIDv5 over "tokenplan/teams-task-sync/TASK-3"
    And no identifier mapping table is written

  Scenario: Registry outage fails closed
    @id:SCEN-4
    Given the registry answers with a timeout
    When the user moves a task to in-progress
    Then the operation fails with REGISTRY_UNAVAILABLE
    And the projection keeps its previous status
    And no deferred queue or optimistic status is created

  Scenario: Status change is written to the corpus first
    @id:SCEN-5
    Given task "TASK-3" with status todo
    When the user moves the task to in-progress in the teams UI
    Then teams calls spec_patch replace_task_status
    And the projection is updated only after the registry confirms
    And the corpus contains in-progress

  Scenario: Triple divergence resolves to the corpus
    @id:SCEN-6
    Given the baseline snapshot records todo
    And the corpus contains done
    And the projection contains in-progress
    When synchronization runs
    Then done wins
    And a task_sync.conflict event carries both values
    And the event is recorded before the change is applied

  Scenario: Owner conflict is visible
    @id:SCEN-7
    Given the baseline records owner "BALANSER"
    And the corpus records owner "KASSA_BILLING_OWNER"
    And the projection records owner "TEAM_HARNESS"
    When synchronization runs
    Then the projection owner becomes KASSA_BILLING_OWNER
    And a task_sync.conflict event names the field owner

  Scenario: Dependency edges are derived, not stored twice
    @id:SCEN-8
    Given the corpus task "TASK-5" declares Depends On "TASK-2"
    When the projection is rebuilt
    Then the projection blockedBy equals TASK-2
    And the projection blocks list is computed from inbound edges
    And editing blockedBy locally is rejected with FIELD_OWNED_BY_SPEC

  Scenario: Done When is read-only in teams
    @id:SCEN-9
    Given a canonical task with a Done When field
    When a member edits the acceptance text in the teams UI
    Then the edit is rejected with FIELD_OWNED_BY_SPEC
    And the corpus text is unchanged

  Scenario: Task creation goes through the registry
    @id:SCEN-10
    Given the registry is available
    When a user creates a task in the teams UI with a link to FR-3
    Then teams calls spec_patch upsert_task
    And the corpus gains a TASK node implementing FR-3
    And the projection appears with the same local id

  Scenario: Creation without a requirement link is rejected
    @id:SCEN-11
    Given the registry is available
    When a user creates a task without Implements
    Then the operation fails with TASK_REQUIREMENT_REQUIRED
    And no task node and no projection are created

  Scenario: Local task creation is impossible
    @id:SCEN-12
    Given the registry is unavailable
    When any teams component attempts to create a task file directly
    Then the attempt is rejected with TASK_CREATE_REQUIRES_REGISTRY
    And no file appears under the task directory

  Scenario: Kanban column is derived from status
    @id:SCEN-13
    Given task "TASK-3" is moved to ready
    When the board is rendered
    Then the card is in the review column
    And kanban-state.json does not store a status-bearing column

  Scenario: Approval writes done
    @id:SCEN-14
    Given task "TASK-3" is in the review column
    When a reviewer approves it
    Then the corpus status becomes done
    And the derived reviewState is approved
    And request-changes writes in-progress

  Scenario: Legacy tasks are archived and deleted
    @id:SCEN-15
    Given the team task directory contains legacy task files
    When the first synchronization runs
    Then an archive userData/backups/teams-tasks-<timestamp>.tar is written
    And the task directory is removed
    And adoption of archived tasks is not offered

  Scenario: Every field has exactly one owner
    @id:SCEN-16
    Given the field ownership table from the contract
    When any field is written by a component
    Then the component is the declared owner of the field
    And a write by a non-owner fails with FIELD_OWNED_BY_SPEC
