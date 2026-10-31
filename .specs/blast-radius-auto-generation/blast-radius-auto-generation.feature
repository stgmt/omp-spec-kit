Feature: Blast Radius Auto-Generation

  As a spec author
  I want BLAST_RADIUS.md to be automatically generated when I modify a specification
  So that I can see the impact of my changes across the codebase without manual analysis

  Background:
    Given omp-spec-kit MCP server is running
    And spec "blast-radius-auto-generation" exists

  @id:SCEN-1 @feature1 @AC-1.1
  Scenario: spec_patch recognizes generateBlastRadius intent
    When agent calls spec_patch with intent "generateBlastRadius"
    Then the intent is recognized
    And the response does not contain INVALID_REQUEST error
    And the intent schema includes optional baselineCommit field
    And the intent schema includes optional generateBlastRadius field

  @id:SCEN-2 @feature2 @AC-2.1
  Scenario: Generator produces BLAST_RADIUS.md with correct structure
    Given blast-radius-generator skill is available
    And repository has changes in src/authoring/
    When agent invokes blast-radius-generator with repository path
    Then generator returns BLAST_RADIUS.md content
    And the content includes 11 sections
    And each section includes pattern, occurrences count, files count
    And the format matches presentation-reels BLAST_RADIUS.md template

  @id:SCEN-3 @feature2 @AC-2.2
  Scenario: Generator handles missing FILE_CHANGES.md
    Given blast-radius-generator skill is available
    And spec does not have FILE_CHANGES.md
    When agent invokes blast-radius-generator with repository path
    Then generator uses git diff (HEAD~1 vs HEAD)
    And no error is thrown
    And BLAST_RADIUS.md content is generated

  @id:SCEN-4 @feature3 @AC-3.1
  Scenario: Reviewer validates completeness of blast radius
    Given blast-radius-reviewer skill is available
    And BLAST_RADIUS.md draft is generated
    And git diff shows changes in src/kernel/
    When BLAST_RADIUS.md does not mention src/kernel/
    Then reviewer returns NEEDS_REVISION verdict
    And comments include missing src/kernel/ with severity "blocking"

  @id:SCEN-5 @feature3 @AC-3.2
  Scenario: Reviewer validates accuracy of patterns
    Given blast-radius-generator produces BLAST_RADIUS.md with pattern "src"
    And pattern "src" matches 500 files across the repository
    When reviewer validates the draft
    Then reviewer returns NEEDS_REVISION verdict
    And comments suggest narrowing pattern with severity "warning"

  @id:SCEN-6 @feature4 @AC-4.1
  Scenario: Supervisor implements retry policy
    Given BlastRadiusWorkflow is running
    And reviewer returns NEEDS_REVISION
    And retryCount is 0
    When workflow routes to next step
    Then workflow routes back to generator
    And retryCount is incremented to 1
    When reviewer returns NEEDS_REVISION again
    And retryCount is 2
    Then workflow ends with failure
    And response includes reviewer comments

  @id:SCEN-7 @feature5 @AC-5.1
  Scenario: Automatic generation enabled by default
    Given agent calls spec_patch with intent "patch"
    And operations include document changes
    And generateBlastRadius parameter is not provided
    When patch is applied successfully
    Then BlastRadiusWorkflow is invoked
    And BLAST_RADIUS.md is generated for the spec

  @id:SCEN-8 @feature5 @AC-5.1
  Scenario: User can disable automatic generation
    Given agent calls spec_patch with intent "patch"
    And generateBlastRadius is false
    When patch is applied successfully
    Then BlastRadiusWorkflow is not invoked
    And BLAST_RADIUS.md is not generated

  @id:SCEN-9 @feature6 @AC-6.1
  Scenario: Hardcoded patterns for omp-spec-kit
    Given blast-radius-generator skill is invoked
    And no pattern config is provided
    When generator runs analysis
    Then generator uses hardcoded omp-spec-kit patterns
    And patterns include authoring surface
    And patterns include kernel surface
    And patterns include MCP contracts
    And patterns include service layer
    And patterns include test surface

  @id:SCEN-10 @feature7 @AC-7.1
  Scenario: BLAST_RADIUS.md tracked as separate document
    Given BlastRadiusWorkflow completes successfully
    And BLAST_RADIUS.md is saved via spec_patch
    When agent calls spec_documents with action "list"
    Then response includes BLAST_RADIUS.md in the document list
    And FILE_CHANGES.md includes BLAST_RADIUS.md
