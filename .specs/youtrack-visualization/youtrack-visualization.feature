@youtrack-visualization
Feature: Tracker shows one governed spec projection
  Cards and views mirror the authoritative specification graph.
  Only TASK status flows back through spec_patch.

  @feature1 @FR-1 @AC-1.1 @id:SCEN-panel-board
  Scenario: Panel and board use the committed snapshot
    Given a committed SPEC:SYNC-STATE snapshot
    When the panel or board renders
    Then both views use the snapshot
    And neither view rebuilds topology from tracker links

  @feature2 @FR-2 @AC-2.1 @id:SCEN-project-fields
  Scenario: Cards have stable identity and fields
    Given a complete board projection
    When sync creates or updates a card
    Then SpecId, SpecKind, ContentHash, Evidence when available, and native Type are present

  @feature3 @FR-3 @AC-3.1 @id:SCEN-link-types
  Scenario: The projection has exactly nine link types
    Given desired raw kernel edges
    When links are reconciled
    Then only the nine allowed tracker link types are present
    And forward and reverse labels remain truthful

  @feature4 @FR-4 @AC-4.1 @id:SCEN-full-corpus
  Scenario: One board read transfers the full corpus
    Given the full corpus scope
    When sync calls spec_graph view board
    Then one complete response supplies all six board kinds and the source fingerprint
    And the committed snapshot has the same fingerprint

  @feature5 @FR-5 @AC-5.1 @id:SCEN-fingerprint-skip
  Scenario: Equal projection skips writes
    Given a valid marker and equal source fingerprint
    When actual cards and links equal the desired projection
    Then sync performs zero writes
    When a card or link drifts at the same fingerprint
    Then sync repairs the drift

  @feature6 @FR-6 @AC-6.1 @id:SCEN-sync-direction
  Scenario: Text is one way and task status is bidirectional
    Given changed specification text and changed TASK state
    When projection and writeback run
    Then specification text flows to YouTrack
    And only TASK status flows back through spec_patch

  @feature7 @FR-7 @AC-7.1 @id:SCEN-buttons-write-back
  Scenario: Task actions are governed
    Given a TASK card
    When Approve is used
    Then the tracker reaches Fixed and spec_patch requests done
    When Verify is used
    Then the tracker reaches Verified and the spec remains done
    When Reopen is used
    Then the tracker reaches Reopened and spec_patch requests todo

  @feature8 @FR-8 @AC-8.1 @id:SCEN-authoritative
  Scenario: Failure keeps the previous committed read model
    Given a previous valid marker and snapshot
    When card, link, or snapshot publication fails
    Then no partial marker is published
    And the previous snapshot remains visible

  @feature9 @FR-9 @AC-9.1 @id:SCEN-readable-card
  Scenario: A card preserves source content
    Given any board kind
    When its card is opened
    Then the summary is the human title
    And the description contains body, grouped relations, provenance, hash, and evidence

  @feature10 @FR-10 @AC-10.1 @id:SCEN-honest-type
  Scenario: Native type matches node kind
    Given any board kind
    When its card is opened
    Then Type is Task, Feature, Criterion, Scenario, Constraint, or Roadmap according to kind

  @feature11 @FR-11 @AC-11.1 @id:SCEN-adapter-boundary
  Scenario: The composition root uses ports
    Given a valid BoardProjectionV1
    When sync runs in a fresh process
    Then it performs one complete MCP board read
    And pure translators and tracker ports produce the projection
    And direct kernel imports and duplicate edge maps are absent

  @feature12 @FR-12 @AC-12.1 @id:SCEN-board-views
  Scenario: Three views show one graph
    Given a committed full-corpus snapshot
    When the user switches between Flow, Cluster, and Lineage
    Then all views show the same nodes and edges
    And kind filters, search, focus, directions, and safe empty states work

  @feature13 @FR-13 @AC-13.1 @id:SCEN-marker-integrity
  Scenario: Only signed markers drive writeback
    Given a pointer issue whose marker was edited or planted without the local signing key
    When the sweep or writeback listener reads committed state
    Then the marker is not honored and the spec corpus wins
    And publishing keeps exactly one canonical pointer issue
