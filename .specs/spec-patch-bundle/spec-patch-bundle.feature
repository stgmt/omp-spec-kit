Feature: Patch bundle

  @feature1 @FR-1 @AC-1.1 @id:SCEN-unified-diff
  Scenario: Unified diff with hunks and context
    Given a bundle that changes three documents
    When the preview is requested
    Then each document SHALL carry a hunk header with line counts and three lines of context
    And applying the bundle SHALL reproduce exactly the previewed lines

  @feature2 @FR-2 @AC-2.1 @AC-2.2 @id:SCEN-section-operations
  Scenario: Section operations
    Given a document with a named section followed by another heading
    When text is appended to that section and the same keyed bullet is upserted twice
    Then the appended text SHALL land before the following heading
    And the second upsert SHALL leave the document byte-identical

  @feature3 @FR-3 @AC-3.1 @id:SCEN-ordered-operations
  Scenario: Ordered operations on one document
    Given a bundle with two operations on the same document
    When the bundle is applied
    Then both SHALL apply in array order in one transaction
    And a later operation missing its selector SHALL fail the bundle with the index named and no write

  @feature4 @FR-4 @AC-4.1 @id:SCEN-preview-truncation
  Scenario: Explicit preview truncation
    Given a document whose diff exceeds the per-document budget
    When the preview is requested
    Then the envelope SHALL report the truncation flag, the byte budget and the affected line ranges

  @feature5 @FR-5 @AC-5.1 @id:SCEN-create-with-content
  Scenario: Create with authored documents
    Given a create intent carrying initial document contents
    When the intent is applied
    Then the specification SHALL exist with those bytes and no second call SHALL be required
