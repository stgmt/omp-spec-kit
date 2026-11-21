@mcp-release-integrity
Feature: Verify packaged OMP discovery

  @release-evidence @id:SCEN-mri-active-project-manager-receipt
  Scenario: OMP manager executes spec patch tool through packaged discovery
    Given a disposable real authoring corpus and live MCP server
    When the scenario "omp-manager-authoring" runs
    Then the scenario passes
