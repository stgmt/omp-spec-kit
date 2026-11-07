Feature: Local corpus mode

  @feature1 @FR-1 @AC-1.1 @id:SCEN-local-corpus-resolution
  Scenario: Local corpus resolution without a registry
    Given a working tree whose corpus is present and whose project the registry does not know
    When the stdio transport serves a catalog request for that root
    Then the request SHALL succeed and report the local transport with no project source

  @feature2 @FR-2 @AC-2.1 @AC-2.2 @id:SCEN-preflight-report
  Scenario: Preflight reports the resolution state
    Given a root that cannot be served
    When the preflight report is requested and a tool call for that root is refused
    Then the report SHALL name transport, project source, resolved root, registry reachability, guard mode, writability and one next action
    And the refusal SHALL carry the same report and no credential

  @feature3 @FR-3 @AC-3.1 @id:SCEN-registry-probe
  Scenario: Registry reachability probe
    Given a hosted transport and a registry that does not answer within its timeout
    When the preflight report is requested
    Then registryReachable SHALL be false with probeTimedOut true
    And the enclosing call SHALL still return its own result

  @feature4 @FR-4 @AC-4.1 @AC-4.2 @id:SCEN-internal-uri
  Scenario: Internal URI schemes are not filesystem targets
    Given a read of proc:// and a direct read of a corpus document by path
    When the guard classifies both calls
    Then the internal URI SHALL continue and the corpus path SHALL be refused with the corpus access tool named

  @feature5 @FR-5 @AC-5.1 @id:SCEN-project-refusal
  Scenario: Refusals explain and offer one next action
    Given a call whose project is outside the caller's allowed set
    When the refusal is produced
    Then it SHALL name the offending project, the allowed projects and exactly one next action

  @feature6 @FR-6 @AC-6.1 @id:SCEN-local-write
  Scenario: Local writes are transactional
    Given a local transport and a patch that touches several documents
    When the patch is applied and a later patch fails
    Then the applied receipt SHALL name every changed document
    And the failed patch SHALL leave no partial document
