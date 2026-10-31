Feature: Teams task sync
  As a team operator
  I want every task to live in the spec corpus and be moved through spec-kit
  So that task state is versioned, traceable to requirements and recoverable

  Background:
    Given the omp-spec-kit registry endpoint is configured

  @id:SCEN-1 @feature11 @AC-11.2 @AC-8.2
  Scenario: Contract version mismatch stops synchronization
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the teams build carries contract version 1
    And the registry serves contract version 2
    When teams starts
    Then synchronization is disabled
    And the error code is CONTRACT_VERSION_MISMATCH
    And no task operation reaches the registry

  @id:SCEN-2 @feature11 @AC-11.1
  Scenario: Contract is the only mapping source
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the sync contract is generated
    When the teams build produces status constants
    Then the constants are generated from the contract
    And no hand-written status table exists in the repository

  @id:SCEN-3 @feature5 @AC-5.1 @AC-5.2
  Scenario: Deterministic identity survives projection loss
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And canonical task "tokenplan/teams-task-sync/TASK-3"
    When the projection is created twice, including after deleting the task directory
    Then both projections have the same id
    And the id equals UUIDv5 over "tokenplan/teams-task-sync/TASK-3"
    And no identifier mapping table is written

  @id:SCEN-4 @feature8 @AC-8.1
  Scenario: Registry outage fails closed
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the registry answers with a timeout
    When the user moves a task to in-progress
    Then the operation fails with REGISTRY_UNAVAILABLE
    And the projection keeps its previous status
    And no deferred queue or optimistic status is created

  @id:SCEN-5 @feature4 @AC-4.1 @AC-4.2
  Scenario: Status change is written to the corpus first
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And task "TASK-3" with status todo
    When the user moves the task to in-progress in the teams UI
    Then teams calls spec_patch replace_task_status with expectedStatus todo
    And the response carries a transition receipt with from, to, actor, at and requestId
    And the projection is updated only after the registry confirms
    And the corpus contains in-progress
    And historyEvents contains exactly one transition event
    And a direct task_set_status write is rejected

  @id:SCEN-6 @feature9 @AC-9.1 @AC-9.2
  Scenario: Triple divergence resolves to the corpus
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the baseline snapshot records todo
    And the corpus contains done
    And the projection contains in-progress
    When synchronization runs
    Then done wins
    And a task_sync.conflict event carries both values
    And the event is recorded before the change is applied

  @id:SCEN-7 @feature9 @AC-9.1
  Scenario: Owner conflict is visible
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the baseline records owner "BALANSER"
    And the corpus records owner "KASSA_BILLING_OWNER"
    And the projection records owner "TEAM_HARNESS"
    When synchronization runs
    Then the projection owner becomes KASSA_BILLING_OWNER
    And a task_sync.conflict event names the field owner

  @id:SCEN-8 @feature6 @AC-6.2 @AC-2.4
  Scenario: Dependency edges are derived, not stored twice
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the corpus task "TASK-5" declares Depends On "TASK-2"
    When the projection is rebuilt
    Then the projection blockedBy equals TASK-2
    And the projection blocks list is computed from inbound edges
    And the projection stores at most Depends On
    And replace_task_links writes Depends On TASK-2
    And editing blockedBy locally is rejected with FIELD_OWNED_BY_SPEC

  @id:SCEN-9 @feature6 @AC-6.1
  Scenario: Done When is read-only in teams
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And a canonical task with a Done When field
    When a member edits the acceptance text in the teams UI
    Then the edit is rejected with FIELD_OWNED_BY_SPEC
    And the corpus text is unchanged

  @id:SCEN-10 @feature3 @AC-3.1 @AC-2.1 @AC-2.3
  Scenario: Task creation goes through the registry
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the registry is available
    When a user creates a task in the teams UI with a link to FR-3
    Then teams calls spec_patch upsert_task
    And the corpus gains a TASK node implementing FR-3
    And the projection appears with the same local id
    And spec_query returns owner, tracking, contentHash, dependsOn, blocks and blockedBy

  @id:SCEN-11 @feature3 @AC-3.2
  Scenario: Creation without a requirement link is rejected
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the registry is available
    When a user creates a task without Implements
    Then the operation fails with TASK_REQUIREMENT_REQUIRED
    And no task node and no projection are created

  @id:SCEN-12 @feature3 @AC-3.1
  Scenario: Local task creation is impossible
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the registry is unavailable
    When any teams component attempts to create a task file directly
    Then the attempt is rejected with TASK_CREATE_REQUIRES_REGISTRY
    And no file appears under the task directory

  @id:SCEN-13 @feature7 @AC-7.1
  Scenario: Kanban column is derived from status
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And task "TASK-3" is moved to ready
    When the board is rendered
    Then the card is in the review column
    And kanban-state.json does not store a status-bearing column

  @id:SCEN-14 @feature7 @AC-7.2 @AC-6.3 @AC-7.3
  Scenario: Approval writes done
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And task "TASK-3" is in the review column
    And the reviewer has the writer role
    When a reviewer approves it
    Then the corpus status becomes done
    And the receipt carries the authenticated actor
    And the derived reviewState is approved
    And the corpus contains no reviewState field
    And request-changes writes in-progress
    And request-changes sets reviewState needsFix

  @id:SCEN-15 @feature10 @AC-10.1
  Scenario: Legacy tasks are archived and deleted
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the team task directory contains legacy task files
    When the first synchronization runs
    Then an archive userData/backups/teams-tasks-<timestamp>/ is written
    And the archive contains a manifest with path, sha256 and size
    And the task directory is removed
    And adoption of archived tasks is not offered

  @id:SCEN-16 @feature6 @AC-6.1 @AC-6.2
  Scenario: Every field has exactly one owner
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the field ownership table from the contract
    When any field is written by a component
    Then the component is the declared owner of the field
    And a write by a non-owner fails with FIELD_OWNED_BY_SPEC

  @id:SCEN-17 @feature1 @AC-1.1 @AC-1.2
  Scenario: Missing project binding blocks the board
    Given team "tokenplan-ops" has no registry project binding
    When the operator opens the task board
    Then the board shows the error state TEAM_PROJECT_BINDING_MISSING
    And no task directory is read or written

  @id:SCEN-18 @feature2 @AC-2.2
  Scenario: Free-form task markdown is rejected
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And a TASKS document with one canonical task
    When a client patches TASKS with insert_at_eof
    Then the operation fails with STRUCTURED_TASK_OP_REQUIRED
    And the document bytes are unchanged

  @id:SCEN-19 @feature11 @AC-8.3
  Scenario: Missing contract blocks startup
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the registry is reachable but serves no sync contract
    When teams starts
    Then synchronization is disabled
    And the error code is CONTRACT_UNAVAILABLE
    And no task operation reaches the registry

  @id:SCEN-20 @feature9 @AC-9.3
  Scenario: Pending projection survives a failed projection write
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the registry confirms task "TASK-3" moved from todo to ready
    When the projection write fails
    Then pending_projection is recorded before the projection update
    And a task_sync.projection_failed event is emitted
    And the board shows an error instead of a local status
    And no queue or optimistic status is created
    And retrying the canonical ready closes pending and clears it

  @id:SCEN-21 @feature4 @AC-4.3 @AC-4.4
  Scenario: Double submission is idempotent or conflicts
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And task "TASK-3" with status todo
    When the same replace_task_status request is submitted twice with requestId R1
    Then the second call returns the first receipt
    And historyEvents contains exactly one transition
    And a call with expectedStatus ready fails with STATUS_CONFLICT
    And the corpus still contains todo

  @id:SCEN-22 @feature10 @AC-10.2
  Scenario: Adoption is rejected by construction
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And an archive of legacy tasks exists
    When the operator looks for adopt in the UI or calls an adopt operation through MCP
    Then the UI has no adopt command
    And the MCP call returns ADOPTION_NOT_SUPPORTED or UNKNOWN_TOOL
    And no task is created in the corpus
    And the archive is not read by the application as a task source

  @id:SCEN-23 @feature12 @AC-12.1 @AC-12.2 @AC-12.3
  Scenario: Actor comes from the authenticated token
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And a writer token belongs to login alice
    When a client sends actorRef bob with replace_task_status
    Then the receipt actor is alice
    And actorRef does not replace the actor in history
    And a reader token calling replace_task_status receives FORBIDDEN_ROLE
    And the document is unchanged
    And assigning bob as reviewer does not grant a writer role

  @id:SCEN-24 @feature10 @AC-10.3
  Scenario: Legacy attachments are archived with tasks
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And a legacy task has an attachment under userData/attachments/tokenplan-ops
    When the first synchronization runs
    Then the archive contains the attachment file
    And the manifest contains its path, sha256 and size
    And a second run does not create a second archive or lose the attachment

  @id:SCEN-25 @feature13 @AC-13.1
  Scenario: Sync metrics are exposed by owner
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And a projection write failure is injected
    When synchronization processes a transition
    Then sync_pending_total and sync_pending_age_ms are recorded by teams
    And sync_conflict_total is recorded by teams
    And spec_patch_latency_ms is recorded by the registry
    And the aggregates are exposed through /metrics
    And no new MCP tool is added

  @id:SCEN-26 @feature11 @AC-11.3
  Scenario: Contract hash mismatch stops synchronization
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the contract version is 1 with hash A
    And the registry serves version 1 with hash B
    When teams starts
    Then synchronization is disabled
    And the error code is CONTRACT_VERSION_MISMATCH
    And mcp_preflight and spec_catalog return the same version and hash pair

  @id:SCEN-27 @feature12 @AC-12.1
  Scenario: Missing token is rejected before any mutation
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And the request carries no bearer token or an expired token
    When a client sends replace_task_status for task "TASK-3"
    Then the registry returns UNAUTHENTICATED
    And the document is unchanged
    And no transition is written to historyEvents

  @id:SCEN-28 @feature2 @AC-2.4
  Scenario: Free-form task links are rejected
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And task "TASK-5" exists with no dependencies
    When a client sends replace_task_links with free text instead of task identifiers
    Then the registry returns INVALID_REQUEST
    And TASKS.md is unchanged
    And no link edge is created

  @id:SCEN-29 @feature4 @AC-4.3
  Scenario: Reused request id with a different payload is rejected
    Given team "tokenplan-ops" is bound to registry project "tokenplan"
    And task "TASK-3" with status todo
    When requestId R1 is first applied for todo to in-progress
    And requestId R1 is reused for todo to ready
    Then the second call returns CONFLICT
    And the first receipt remains the stored response
    And historyEvents contains exactly one transition
