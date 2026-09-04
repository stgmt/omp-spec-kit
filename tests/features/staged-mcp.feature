@staged-mcp @integration
Feature: Exercise the single-surface MCP server through the packaged server
  Every entry is driven through the real JSON-RPC server on a real specification corpus.

  Scenario: Single registry has live bounded handlers
    Given a real staged MCP corpus and packaged server
    When the registry and every handler are called
    Then the registry has exactly 10 names and every call has a bounded envelope

  Scenario: Authoring applies spec patch without duplicating documents
    Given a real staged MCP corpus and packaged server
    When an authoring spec patch is executed with dryRun false
    Then the applied spec patch changes the temporary document, section edits preserve it, and direct spec writes are refused

  Scenario: Authoring refuses linked and existing specification targets
    Given a real staged MCP corpus and packaged server
    When authoring safety guards are exercised
    Then linked and existing specification mutations are refused without external writes

  Scenario: MCP closes inputs and gates future authoring
    Given a real staged MCP corpus and packaged server
    When the read server receives alias and unknown-field calls
    Then aliases work, unknown fields fail, and removed tools stay unknown

  Scenario: Evidence requires a complete producer chain
    Given a real staged MCP corpus and packaged server
    When an incomplete evidence stream is queried
    Then the evidence result is unknown and stale

  Scenario: Archive moves only a proven specification
    Given a real staged MCP corpus and packaged server
    When a new specification is created and archived through the spec patch door
    Then the archive move is committed and the original directory is absent

  Scenario: OMP marks only spec patch as mutating write tool
    Given a real staged MCP corpus and packaged server
    When the staged OMP extension registry is inspected
    Then spec patch is marked as mutating and 9 tools remain read-only

  Scenario: Single surface keeps safe authoring and binds producer evidence
    Given a real staged MCP corpus and packaged server
    When the additive registry, evidence states, and safe authoring are exercised
    Then the surface exposes 10 bounded tools, preserves authoring, and refuses stale evidence

  @tool-e2e
  Scenario: MCP results expose actionable recovery and exact mirrors
    Given a real staged MCP corpus and packaged server
    When MCP envelope recovery cases are exercised
    Then stale cursor, conflict, and target indeterminate recoveries are bounded and actionable

  @tool-e2e
  Scenario: v0.5 exposes the exact tool inventory and schemas
    Given a real staged MCP corpus and packaged server
    When the tool inventory matrix is exercised
    Then the inventory contains the exact 10-tool surface

  @tool-e2e
  Scenario: v0.5 tools return semantic success results
    Given a real staged MCP corpus and packaged server
    When the semantic success matrix is exercised
    Then every tool returns its semantic success contract

  @tool-e2e
  Scenario: v0.5 tools reject invalid and contained-boundary inputs
    Given a real staged MCP corpus and packaged server
    When the invalid and containment matrix is exercised
    Then every tool rejects closed-schema and boundary violations

  @tool-e2e
  Scenario: v0.5 tools detect stale corpus and evidence mutations
    Given a real staged MCP corpus and packaged server
    When the mutation and freshness matrix is exercised
    Then every evidence and corpus mutation is detected

  @tool-e2e
  Scenario: v0.5 read-only calls preserve project bytes
    Given a real staged MCP corpus and packaged server
    When the read-only matrix is exercised
    Then every read-only call preserves the project byte snapshot

  @tool-e2e @bnd-matrix
  Scenario: Hard retirement matrix verifies all 38 superseded tools return protocol -32602
    Given a real staged MCP corpus and packaged server
    When all 38 superseded tool names are invoked individually
    Then every superseded tool returns JSON-RPC error -32602 without fallback shims

  @tool-e2e @bnd-matrix
  Scenario: Comprehensive coverage of every consolidated tool branch and intent
    Given a real staged MCP corpus and packaged server
    When all consolidated branches and all 13 spec patch intents are exercised
    Then every branch returns its declared operation, data kind, and valid envelope

  @tool-e2e @bnd-matrix
  Scenario Outline: Strict boundary validation rejects invalid and conflicting parameters
    Given a real staged MCP corpus and packaged server
    When tool "<tool>" is called with arguments '<args>'
    Then the call fails with error code "<expected_code>"

    Examples:
      | tool               | args                                                                                                          | expected_code     |
      | spec_catalog       | {}                                                                                                            | INVALID_REQUEST   |
      | spec_catalog       | {"view": "unknown_view"}                                                                                      | INVALID_REQUEST   |
      | spec_catalog       | {"view": "specs", "specSlugs": []}                                                                            | INVALID_REQUEST   |
      | spec_catalog       | {"view": "types", "includeDocuments": true}                                                                  | INVALID_REQUEST   |
      | spec_catalog       | {"view": "specs", "unexpectedProp": 123}                                                                      | UNKNOWN_FIELD     |
      | spec_entities      | {}                                                                                                            | INVALID_REQUEST   |
      | spec_entities      | {"mode": "get"}                                                                                               | INVALID_REQUEST   |
      | spec_entities      | {"mode": "get", "canonicalId": "product:FR-1", "specSlugs": []}                                               | INVALID_REQUEST   |
      | spec_entities      | {"mode": "find", "kinds": ["BOGUS_KIND"]}                                                                     | INVALID_REQUEST   |
      | spec_entities      | {"mode": "find", "kinds": ["DOCUMENT", "DOCUMENT"]}                                                           | INVALID_REQUEST   |
      | spec_graph         | {}                                                                                                            | INVALID_REQUEST   |
      | spec_graph         | {"view": "edges"}                                                                                             | INVALID_REQUEST   |
      | spec_graph         | {"view": "edges", "canonicalId": "product:FR-1", "maxDepth": 5}                                               | INVALID_REQUEST   |
      | spec_graph         | {"view": "trace", "canonicalId": "product:FR-1", "aggregate": true}                                           | INVALID_REQUEST   |
      | spec_documents     | {}                                                                                                            | INVALID_REQUEST   |
      | spec_documents     | {"action": "list"}                                                                                            | INVALID_REQUEST   |
      | spec_documents     | {"action": "read", "spec": "product"}                                                                         | INVALID_REQUEST   |
      | spec_documents     | {"action": "read", "spec": "product", "doc": "FR.md", "offset": 0}                                            | INVALID_REQUEST   |
      | spec_documents     | {"action": "read", "spec": "product", "doc": "FR.md", "offset": -1}                                           | INVALID_REQUEST   |
      | spec_documents     | {"action": "attachment", "spec": "product"}                                                                   | INVALID_REQUEST   |
      | spec_documents     | {"action": "attachment", "spec": "product", "path": "../outside.bin"}                                         | PATH_FORBIDDEN    |
      | spec_inspect       | {}                                                                                                            | INVALID_REQUEST   |
      | spec_inspect       | {"check": "anchor"}                                                                                           | INVALID_REQUEST   |
      | spec_inspect       | {"check": "scenariosByTags"}                                                                                  | INVALID_REQUEST   |
      | spec_inspect       | {"check": "scenariosByTags", "tags": ["@a", "@a"]}                                                           | INVALID_REQUEST   |
      | spec_inspect       | {"check": "archivalProof"}                                                                                    | INVALID_REQUEST   |
      | spec_inspect       | {"check": "orphans", "limit": 10}                                                                             | INVALID_REQUEST   |
      | spec_inspect       | {"check": "specValidation", "spec": "product"}                                                                | INVALID_REQUEST   |
      | spec_inspect       | {"check": "diagnostics"}                                                                                      | INVALID_REQUEST   |
      | spec_inspect       | {"check": "validation", "spec": "product"}                                                                    | INVALID_REQUEST   |
      | spec_inspect       | {"check": "validation", "specSlugs": ["bad!"]}                                                                | INVALID_PARAMETER |
      | spec_inspect       | {"check": "validation", "specSlugs": ["unknown-spec"]}                                                        | NOT_FOUND         |
      | spec_tasks         | {}                                                                                                            | INVALID_REQUEST   |
      | spec_tasks         | {"spec": "product", "limit": 0}                                                                               | INVALID_REQUEST   |
      | spec_tasks         | {"spec": "product", "statuses": ["todo", "todo"]}                                                            | INVALID_REQUEST   |
      | spec_evidence      | {}                                                                                                            | INVALID_REQUEST   |
      | spec_evidence      | {"view": "result"}                                                                                            | INVALID_REQUEST   |
      | spec_evidence      | {"view": "trace"}                                                                                             | INVALID_REQUEST   |
      | spec_evidence      | {"view": "result", "scenarioId": 123}                                                                         | INVALID_REQUEST   |
      | spec_patch         | {}                                                                                                            | INVALID_REQUEST   |
      | spec_patch         | {"intent": "patch"}                                                                                           | INVALID_REQUEST   |
      | spec_patch         | {"intent": "patch", "spec": "product", "reason": "r", "requestId": "q", "operations": []}                   | INVALID_REQUEST   |
      | spec_patch         | {"intent": "amendRequirement", "spec": "product", "reason": "r", "requestId": "q"}                           | INVALID_REQUEST   |
      | spec_patch         | {"intent": "patch", "spec": "product", "reason": "r", "requestId": "q", "dryRun": "not-a-boolean"}           | INVALID_REQUEST   |
      | spec_patch         | {"intent": "patch", "spec": "product", "reason": "r", "requestId": "q", "approval": "approve"}               | UNKNOWN_FIELD     |
      | spec_patch         | {"intent": "patch", "spec": "product", "reason": "r", "requestId": "q", "proposalId": "p"}                   | UNKNOWN_FIELD     |
      | spec_patch         | {"intent": "patch", "spec": "product", "reason": "r", "requestId": "q", "proposalSha256": "h"}               | UNKNOWN_FIELD     |
      | spec_patch         | {"intent": "patch", "spec": "product", "reason": "r", "requestId": "q", "expectedDocuments": []}             | UNKNOWN_FIELD     |
