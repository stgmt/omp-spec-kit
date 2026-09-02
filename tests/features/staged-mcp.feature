@staged-mcp @integration
Feature: Exercise staged MCP releases through the packaged server
  Each staged registry keeps the eight compatibility tools and every additional
  entry is driven through the real JSON-RPC server on a real specification corpus.

  Scenario: Read-complete registry has live bounded handlers
    Given a real staged MCP corpus and packaged server
    When the read-complete registry and every staged handler are called
    Then the read-complete registry has exactly 23 names and every call has a bounded envelope

  Scenario: Authoring applies approved proposals without duplicating documents
    Given a real staged MCP corpus and packaged server
    When an authoring proposal is created and explicitly approved
    Then the approved proposal changes the temporary document, section edits preserve it, and direct spec writes are refused

  Scenario: Authoring refuses linked and existing specification targets
    Given a real staged MCP corpus and packaged server
    When authoring safety guards are exercised
    Then linked and existing specification mutations are refused without external writes

  Scenario: MCP closes inputs and gates future authoring
    Given a real staged MCP corpus and packaged server
    When the read server receives alias and unknown-field calls
    Then aliases work, unknown fields fail, and unaccepted authoring stays hidden

  Scenario: Evidence requires a complete producer chain
    Given a real staged MCP corpus and packaged server
    When an incomplete evidence stream is queried
    Then the evidence result is unknown and stale

  Scenario: Archive moves only a proven specification
    Given a real staged MCP corpus and packaged server
    When a new specification is created and archived through the proposal door
    Then the archive move is committed and the original directory is absent

  Scenario: OMP marks only applied mutations as writes
    Given a real staged MCP corpus and packaged server
    When the staged OMP extension registry is inspected
    Then applied authoring tools require write approval and proposals remain read-only
  Scenario: v0.5 keeps safe authoring and binds producer evidence
    Given a real staged MCP corpus and packaged server
    When the v0.5 additive registry, evidence states, and safe authoring are exercised
    Then v0.5 exposes 27 bounded tools, preserves authoring, and refuses stale evidence

  @tool-e2e
  Scenario: v0.5 exposes the exact tool inventory and schemas
    Given a real staged MCP corpus and packaged server
    When the v0.5 tool inventory matrix is exercised
    Then the v0.5 inventory contains the exact 27-tool surface

  @tool-e2e
  Scenario: v0.5 tools return semantic success results
    Given a real staged MCP corpus and packaged server
    When the v0.5 semantic success matrix is exercised
    Then every v0.5 tool returns its semantic success contract

  @tool-e2e
  Scenario: v0.5 tools reject invalid and contained-boundary inputs
    Given a real staged MCP corpus and packaged server
    When the v0.5 invalid and containment matrix is exercised
    Then every v0.5 tool rejects closed-schema and boundary violations

  @tool-e2e
  Scenario: v0.5 tools detect stale corpus and evidence mutations
    Given a real staged MCP corpus and packaged server
    When the v0.5 mutation and freshness matrix is exercised
    Then every v0.5 evidence and corpus mutation is detected

  @tool-e2e
  Scenario: v0.5 read-only calls preserve project bytes
    Given a real staged MCP corpus and packaged server
    When the v0.5 read-only matrix is exercised
    Then every v0.5 read-only call preserves the project byte snapshot