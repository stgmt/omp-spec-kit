@agent-ux-elicitation-guard
Feature: First creation of each missing Markdown document stops once
  An agent never performs the first real apply to a missing canonical Markdown document silently.
  Later edits, existing documents, previews, and canonical feature files are not stopped.

  @feature1 @FR-1 @AC-1.1 @id:SCEN-skill-canonical
  Scenario: Memo is canonical
    Given the built plugin skills
    When the elicitation memo is listed
    Then exactly one memo owns the question steps
    And no second file repeats its body

  @feature2 @FR-2 @AC-2.1 @id:SCEN-hint-constant
  Scenario: Hint is single-sourced
    Given the contract module exports
    When instructions and stop error are read
    Then both use one shared hint constant
    And no full-text copy exists

  @feature3 @FR-3 @AC-3.1 @id:SCEN-first-write-nudge
  Scenario: Missing canonical Markdown first creation is refused once
    Given a missing canonical Markdown document
    When an apply patch is executed
    Then the result is ELICITATION_REQUIRED
    And the file bytes are unchanged
    And a preview would not consume the stop
    And a multi-document request would receive one sorted target list
    And canonical feature files and non-candidates would be exempt

  @feature4 @FR-4 @AC-4.1 @id:SCEN-nudge-error-content
  Scenario: Error carries memo and retry rule
    Given the refused write
    When the error is read
    Then it names the memo path and targets
    And it states that a retry passes

  @feature5 @FR-5 @AC-5.1 @id:SCEN-no-second-nudge
  Scenario: Retry and later edits pass
    Given the recorded ticket
    When the operation is repeated with a valid retry payload
    Then it commits
    When any further edit arrives
    Then it commits with no check

  @feature6 @FR-6 @AC-6.1 @id:SCEN-backwards-compat
  Scenario: Existing documents, boundaries, and corpus stay green
    Given an existing document on disk, a feature file, and the validated corpus
    When edits and the corpus gate run
    Then no elicitation stop occurs for the existing or feature document
    And the new specification is listed and the corpus check passes

  @feature7 @FR-7 @AC-7.1 @id:SCEN-verification
  Scenario: Verification is observable
    Given the finished change
    When inspection, corpus check, and replays run
    Then all pass
    And qualitative question quality remains outside automated assertions
