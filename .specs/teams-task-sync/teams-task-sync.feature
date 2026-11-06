Feature: Teams task sync
  As a team operator
  I want every shared team task to live in the spec corpus and be moved through spec-kit
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
    And the board shows an error and does not persist a local canonical status
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
    And no local copy of Depends On is stored
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
    And the team task directory is verified to contain only legacy shared task files
    When the first synchronization runs
    Then an archive userData/backups/teams-tasks-<timestamp>/ is written
    And the archive contains a manifest with path, sha256 and size
    And the verified archive matches the removed shared task directory
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
    When the same replace_task_status request from todo to in-progress is submitted twice with requestId R1
    Then the second call returns the first receipt
    And historyEvents contains exactly one transition
    And a call with expectedStatus ready fails with STATUS_CONFLICT
    And the corpus still contains in-progress

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


  @id:SCEN-30 @feature14 @AC-14.1
  Scenario: Personal agent tasks remain available and separate
    Given a team lead and a member each have a personal native task
    When both use their native personal task tools
    Then their personal tasks remain available without a specification link
    And no personal task appears as a shared board task

  @id:SCEN-31 @feature14 @AC-14.2
  Scenario: Migration cannot remove personal agent tasks
    Given legacy shared task data cannot be separated safely from personal agent tasks
    When the shared task migration attempts cleanup
    Then cleanup stops with a visible error
    And the personal tasks remain available and unchanged

  @id:SCEN-32 @feature15 @AC-15.1
  Scenario: One team board distinguishes identical local ids in different specifications
    Given the same team is linked to specifications A and B in an authorized project
    And both specifications contain TASK-1 with different descriptions
    When the team opens its board and reads both tasks
    Then both tasks are visible with their own project, specification and local id
    And edits, comments and attachments remain associated with the correct task

  @id:SCEN-33 @feature15 @AC-15.2
  Scenario: Lead creates a specification for its team
    Given a team lead has write access to the team's registry project
    When the lead creates a specification through spec-kit MCP in its team context
    And a linked shared task is created in the new specification
    Then the new specification is linked to that team
    And the task appears on that team's board without linking another team

  @id:SCEN-34 @feature15 @AC-15.3
  Scenario: Shared task created through spec-kit appears on the same board
    Given a team is linked to a specification with requirement FR-1
    When an authorized participant creates TASK-8 through spec-kit MCP linked to FR-1
    Then the same task appears through the team MCP and on its board
    And its project, specification, task id and requirement link are unchanged
    And the registry contains exactly one such task

  @id:SCEN-35 @feature16 @AC-16.1
  Scenario: Lead can author a specification through spec-kit
    Given a team lead is authorized to create a specification in the team project
    When the lead creates a supported specification and authors a requirement through spec-kit MCP
    Then the specification and requirement can be read back from that project
    And an empty scaffold is not reported as an accepted specification

  @id:SCEN-36 @feature16 @AC-16.2
  Scenario: Shared task without a valid same-spec requirement is refused
    Given an authorized caller uses the board, team MCP or spec-kit MCP
    When the caller creates a shared task without an existing requirement of its specification
    Then the operation is rejected with an explicit error
    And neither a registry task nor a local shared task is created

  @id:SCEN-37 @feature16 @AC-16.3
  Scenario: Previewing a new specification does not create its branch
    Given a test repository has no branch for a new specification
    When the client previews specification creation
    Then the preview is returned without creating a branch, document or commit

  @id:SCEN-38 @feature17 @AC-17.1
  Scenario: Lead and member read complete shared task details
    Given a shared task has a multiline description, status, owner, requirement, completion criterion and dependencies
    And the team lead and member both have read access
    When both read task details through their available MCP tools
    Then both receive the same untruncated canonical fields and team execution data
    And the task keeps its original project and specification identity

  @id:SCEN-39 @feature17 @AC-17.2
  Scenario: Reading a shared task does not grant write permission
    Given a team member can read a shared task but has no registry write permission
    When the member reads the task and then attempts to update it
    Then the full permitted details are returned
    And the write is rejected without changing the specification

  @id:SCEN-40 @feature18 @AC-18.1
  Scenario: A real lead and member work on the same registry-backed task
    Given an installed application and registry use an isolated test project and team
    When the real lead creates a requirement and shared task through MCP
    And a real member reads the same task and performs the sandbox work
    Then the board, the registry and both participants agree on the task identity and fields
    And changes from each permitted entry point are visible without duplication

  @id:SCEN-41 @feature18 @AC-18.2
  Scenario: Failure of the registry does not change a personal task or create a duplicate
    Given a shared task and a separate personal task exist in an isolated team
    When the registry is unavailable or a task creation response is lost
    Then the shared operation reports an error or an unknown outcome without a false success or duplicate
    And the personal task remains available and separate


  @id:SCEN-42 @feature15 @AC-15.4
  Scenario: A created specification can be linked after a partial failure
    Given the lead created a specification in a verified team context
    When the team association fails or its result is unknown
    Then the partial result identifies the created specification
    And retrying the association neither creates a second specification nor links another team

  @id:SCEN-43 @feature15 @AC-15.5
  Scenario: Explicitly shared specification keeps team execution data separate
    Given two authorized teams are explicitly linked to the same specification
    When one team adds a comment to a shared canonical task
    Then the other team's execution data is not overwritten or substituted
    And Tracking is not used as the team association or as authorization

  @id:SCEN-44 @feature17 @AC-17.3
  Scenario: Team task detail combines canonical and team-owned data
    Given a task has a canonical completion criterion and a team-owned comment and attachment
    When a team member reads canonical details through spec-kit MCP and full details through teams MCP
    Then the canonical details and the team's own execution data are available without truncation
    And unavailable or over-limit details return an explicit error
