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
