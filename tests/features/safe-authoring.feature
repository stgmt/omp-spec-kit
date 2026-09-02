@safe-authoring @integration
Feature: v0.4.1 safe specification authoring
  The live packaged MCP server exposes two proposal-first mutation tools over the
  current three-spec, 45-document corpus and never permits raw .specs writes.

  Scenario: Exact ten-tool public inventory
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "inventory" runs
    Then the v0.4.1 scenario passes

  Scenario: Deterministic read-only proposals
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "proposal" runs
    Then the v0.4.1 scenario passes

  Scenario: Invalid previews are refused
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "invalid-preview" runs
    Then the v0.4.1 scenario passes

  Scenario: Non-MCP specification access is blocked
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "access-gate" runs
    Then the v0.4.1 scenario passes

  Scenario: Exact proposal apply is CAS protected
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "apply-cas" runs
    Then the v0.4.1 scenario passes

  Scenario: Concurrent stale apply conflicts
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "concurrent-conflict" runs
    Then the v0.4.1 scenario passes

  Scenario: Fault boundaries preserve a generation
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "fault-rollback" runs
    Then the v0.4.1 scenario passes

  Scenario: Receipts remain compact and redacted
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "redaction" runs
    Then the v0.4.1 scenario passes

  Scenario: Real corpus provenance is verified
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "provenance" runs
    Then the v0.4.1 scenario passes

  Scenario: Installed extension has one live factory
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "installed-factory" runs
    Then the v0.4.1 scenario passes

  Scenario: Unaccepted future authoring stays hidden
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "future-hidden" runs
    Then the v0.4.1 scenario passes

  Scenario: Same-spec multi-document mutation is atomic
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "multi-document" runs
    Then the v0.4.1 scenario passes

  Scenario: Mutation edge inputs are refused without writes
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "mutation-edges" runs
    Then the v0.4.1 scenario passes

  Scenario: Malformed and linked access targets fail closed
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "access-edges" runs
    Then the v0.4.1 scenario passes

  Scenario: OMP manager executes proposal and apply tools
    Given a disposable real authoring corpus and live v0.4.1 MCP server
    When the v0.4.1 scenario "omp-manager-authoring" runs
    Then the v0.4.1 scenario passes
