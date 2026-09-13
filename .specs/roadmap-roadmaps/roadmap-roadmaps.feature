Feature: Roadmap: Roadmap Management

  @feature1 @FR-1 @AC-1.1 @id:SCEN-roadmap-kernel-type
  Scenario: Roadmap kernel type
    Given a spec catalog
    When types are queried
    Then ROADMAP SHALL appear in entityKinds

  @feature2 @FR-2 @AC-2.1 @id:SCEN-roadmap-to-feature-tracing
  Scenario: Roadmap-to-feature tracing
    Given a roadmap spec with TASKs linking to feature FRs
    When the graph is traversed from a roadmap TASK
    Then the target feature FR SHALL be reachable via IMPLEMENTS

  @feature3 @FR-3 @AC-3.1 @id:SCEN-roadmap-lifecycle
  Scenario: Roadmap lifecycle
    Given a roadmap spec with status active
    When product ROADMAP.md is read
    Then it SHALL reference the roadmap spec

  @feature4 @FR-4 @AC-4.1 @id:SCEN-roadmap-visualization
  Scenario: Roadmap visualization
    Given a YouTrack spec board
    When filtered by ROADMAP kind
    Then roadmap phases and cross-spec edges SHALL be visible

  @feature5 @FR-5 @AC-5.1 @id:SCEN-roadmap-canonical-document
  Scenario: Canonical roadmap document
    Given a roadmap spec containing ROADMAP.md
    When the kernel graph is built
    Then the canonical node <specSlug>:ROADMAP SHALL exist

  @feature6 @FR-6 @AC-6.1 @AC-6.2 @id:SCEN-roadmap-scope-assembly
  Scenario: Scope-derived deterministic assembly
    Given a roadmap spec implementing entities of two feature specs
    When the generated region is assembled twice on an unchanged graph
    Then only requirement-level items of those specs SHALL appear, byte-identical

  @feature7 @FR-7 @AC-7.1 @id:SCEN-roadmap-derived-status
  Scenario: Derived requirement status
    Given a covered requirement with implementing tasks
    When the generated region is assembled
    Then its status SHALL reflect the aggregate of implementing task statuses

  @feature8 @FR-8 @AC-8.1 @AC-8.2 @AC-8.3 @id:SCEN-roadmap-reassembly
  Scenario: Non-destructive re-assembly
    Given a ROADMAP.md with authored notes outside the markers
    When re-assembly runs against a graph where one item vanished
    Then the item is removed from the generated region and authored bytes are preserved

  @feature9 @FR-9 @AC-9.1 @id:SCEN-roadmap-mcp-lifecycle
  Scenario: MCP roadmap lifecycle
    Given a live MCP server
    When a roadmap spec is created, assembled, and re-assembled via spec_patch intents
    Then every write SHALL carry a receipt and the document matches kernel assembly
