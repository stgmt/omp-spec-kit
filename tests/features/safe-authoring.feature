@safe-authoring @integration
Feature: safe specification authoring
  The live packaged MCP server exposes one safe spec_patch mutation tool over the
  current three-spec, 45-document corpus and never permits raw .specs writes.

  Scenario: Exact single-surface public inventory
    Given a disposable real authoring corpus and live MCP server
    When the scenario "inventory" runs
    Then the scenario passes

  Scenario: Deterministic read-only spec patch preview with dryRun true or omitted
    Given a disposable real authoring corpus and live MCP server
    When the scenario "proposal" runs
    Then the scenario passes

  Scenario: Invalid previews and malformed parameters are refused
    Given a disposable real authoring corpus and live MCP server
    When the scenario "invalid-preview" runs
    Then the scenario passes

  Scenario: Non-MCP specification access is blocked
    Given a disposable real authoring corpus and live MCP server
    When the scenario "access-gate" runs
    Then the scenario passes

  Scenario: Exact spec patch apply with dryRun false is CAS protected
    Given a disposable real authoring corpus and live MCP server
    When the scenario "apply-cas" runs
    Then the scenario passes

  Scenario: Concurrent stale spec patch apply conflicts
    Given a disposable real authoring corpus and live MCP server
    When the scenario "concurrent-conflict" runs
    Then the scenario passes

  Scenario: Fault boundaries preserve a generation
    Given a disposable real authoring corpus and live MCP server
    When the scenario "fault-rollback" runs
    Then the scenario passes

  Scenario: Receipts remain compact and redacted
    Given a disposable real authoring corpus and live MCP server
    When the scenario "redaction" runs
    Then the scenario passes

  Scenario: Real corpus provenance is verified
    Given a disposable real authoring corpus and live MCP server
    When the scenario "provenance" runs
    Then the scenario passes

  Scenario: Installed extension has one live factory
    Given a disposable real authoring corpus and live MCP server
    When the scenario "installed-factory" runs
    Then the scenario passes

  Scenario: Removed tools stay unknown
    Given a disposable real authoring corpus and live MCP server
    When the scenario "future-hidden" runs
    Then the scenario passes

  Scenario: Same-spec multi-document mutation is atomic
    Given a disposable real authoring corpus and live MCP server
    When the scenario "multi-document" runs
    Then the scenario passes

  Scenario: Mutation edge inputs are refused without writes
    Given a disposable real authoring corpus and live MCP server
    When the scenario "mutation-edges" runs
    Then the scenario passes

  Scenario: Malformed and linked access targets fail closed
    Given a disposable real authoring corpus and live MCP server
    When the scenario "access-edges" runs
    Then the scenario passes

  Scenario: Read selectors preserve safe-path decisions
    Given a disposable real authoring corpus and live MCP server
    When the scenario "read-selectors" runs
    Then the scenario passes

  Scenario: Executable payloads fail closed on specification references
    Given a disposable real authoring corpus and live MCP server
    When the scenario "execution-edges" runs
    Then the scenario passes

  Scenario: OMP manager executes spec patch tool
    Given a disposable real authoring corpus and live MCP server
    When the scenario "omp-manager-authoring" runs
    Then the scenario passes
  Scenario: Internal devices and projects without a spec root stay usable
    Given a disposable real authoring corpus and live MCP server
    When the scenario "path-root-regressions" runs
    Then the scenario passes

  @safe-authoring @elicitation
  Scenario: Fresh missing specification first apply is refused once with elicitation guidance
    Given a disposable real authoring corpus and live MCP server
    When the scenario "elicitation-first-refusal" runs
    Then the scenario passes

  @safe-authoring @elicitation
  Scenario: Identical retry after elicitation refusal commits and later edits pass
    Given a disposable real authoring corpus and live MCP server
    When the scenario "elicitation-retry-and-later-edits" runs
    Then the scenario passes

  @safe-authoring @elicitation
  Scenario: Preview does not consume elicitation stop and existing documents are exempt
    Given a disposable real authoring corpus and live MCP server
    When the scenario "elicitation-preview-and-existing" runs
    Then the scenario passes

  @safe-authoring @elicitation
  Scenario: Refusal preserves zero bytes and handles multi-document targets in single stop
    Given a disposable real authoring corpus and live MCP server
    When the scenario "elicitation-preservation-and-multidoc" runs
    Then the scenario passes

  @safe-authoring @elicitation
  Scenario: Changed retry is accepted through the live MCP server
    Given a disposable real authoring corpus and live MCP server
    When the scenario "elicitation-changed-retry" runs
    Then the scenario passes

  @safe-authoring @elicitation
  Scenario: Real MCP server restart reissues one stop and then allows retry
    Given a disposable real authoring corpus and live MCP server
    When the scenario "elicitation-real-restart" runs
    Then the scenario passes

  @safe-authoring @elicitation
  Scenario: Single-document and noncanonical boundaries use public MCP outcomes
    Given a disposable real authoring corpus and live MCP server
    When the scenario "elicitation-single-document-boundaries" runs
    Then the scenario passes

  @safe-authoring @elicitation
  Scenario: Concurrent first applies resolve through the live MCP lock
    Given a disposable real authoring corpus and live MCP server
    When the scenario "elicitation-concurrent-first-applies" runs
    Then the scenario passes
