Feature: Blast Radius Auto-Generation

  As a spec author
  I want BLAST_RADIUS.md to be automatically generated when I modify a specification
  So that I can see the impact of my changes across the codebase without manual analysis

  Background:
    Given omp-spec-kit MCP server is running
    And spec "blast-radius-auto-generation" exists

  Scenario: spec_patch recognizes generateBlastRadius intent
    @id:SCEN-1
    When agent calls spec_patch with intent "generateBlastRadius"
    Then the intent is recognized
    And the response does not contain INVALID_REQUEST error
    And the intent schema includes optional baselineCommit field
    And the intent schema includes optional generateBlastRadius field

  Scenario: Generator produces BLAST_RADIUS.md with correct structure
    @id:SCEN-2
    Given blast-radius-generator skill is available
    And repository has changes in src/authoring/
    When agent invokes blast-radius-generator with repository path
    Then generator returns BLAST_RADIUS.md content
    And the content includes 11 sections
    And each section includes pattern, occurrences count, files count
    And the format matches presentation-reels BLAST_RADIUS.md template

  Scenario: Generator handles missing FILE_CHANGES.md
    @id:SCEN-3
    Given blast-radius-generator skill is available
    And spec does not have FILE_CHANGES.md
    When agent invokes blast-radius-generator with repository path
    Then generator uses git diff (HEAD~1 vs HEAD)
    And no error is thrown
    And BLAST_RADIUS.md content is generated

  Scenario: Reviewer validates completeness of blast radius
    @id:SCEN-4
    Given blast-radius-reviewer skill is available
    And BLAST_RADIUS.md draft is generated
    And git diff shows changes in src/kernel/
    When BLAST_RADIUS.md does not mention src/kernel/
    Then reviewer returns NEEDS_REVISION verdict
    And comments include missing src/kernel/ with severity "blocking"

  Scenario: Reviewer validates accuracy of patterns
    @id:SCEN-5
    Given blast-radius-generator produces BLAST_RADIUS.md with pattern "src"
    And pattern "src" matches 500 files across the repository
    When reviewer validates the draft
    Then reviewer returns NEEDS_REVISION verdict
    And comments suggest narrowing pattern with severity "warning"

  Scenario: Supervisor implements retry policy
    @id:SCEN-6
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

  Scenario: Automatic generation enabled by default
    @id:SCEN-7
    Given agent calls spec_patch with intent "patch"
    And operations include document changes
    And generateBlastRadius parameter is not provided
    When patch is applied successfully
    Then BlastRadiusWorkflow is invoked
    And BLAST_RADIUS.md is generated for the spec

  Scenario: User can disable automatic generation
    @id:SCEN-8
    Given agent calls spec_patch with intent "patch"
    And generateBlastRadius is false
    When patch is applied successfully
    Then BlastRadiusWorkflow is not invoked
    And BLAST_RADIUS.md is not generated

  Scenario: Hardcoded patterns for omp-spec-kit
    @id:SCEN-9
    Given blast-radius-generator skill is invoked
    And no pattern config is provided
    When generator runs analysis
    Then generator uses hardcoded omp-spec-kit patterns
    And patterns include authoring surface
    And patterns include kernel surface
    And patterns include MCP contracts
    And patterns include service layer
    And patterns include test surface

  Scenario: BLAST_RADIUS.md tracked as separate document
    @id:SCEN-10
    Given BlastRadiusWorkflow completes successfully
    And BLAST_RADIUS.md is saved via spec_patch
    When agent calls spec_documents with action "list"
    Then response includes BLAST_RADIUS.md in the document list
    And FILE_CHANGES.md includes BLAST_RADIUS.md
