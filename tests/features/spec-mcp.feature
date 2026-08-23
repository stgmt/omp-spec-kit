@spec-mcp @integration
Feature: The v0.3 MCP adapter and extension registry expose exactly eight read-only spec tools
  As the omp-spec-kit v0.3 distribution contract
  the stdio MCP server and the OMP extension registry must both surface the
  eight SCHEMA-11 read-only tools over one shared kernel query service,
  answer every call with exactly one canonical QueryEnvelope identical to a
  direct kernel query against the same corpus, refuse unknown tools and
  malformed requests fail-closed, mutate nothing, and run dependency-free
  against any repository root.

  Background:
    Given the repository's real corpus pinned by the fixture manifest with an identical in-process kernel graph

  @id:SCEN-mcp-parity @feature9
  Scenario: The stdio MCP server serves the SCHEMA-11 surface with kernel-identical envelopes
    Given a spawned stdio MCP server rooted at a byte-exact replica of the pinned corpus
    When the client initializes the session and requests the tool list
    Then initialize answers with exactly the omp-spec-kit identity
    And the tool list is exactly the eight SCHEMA-11 read-only tools
    When the client calls "spec_get_node" on "product:FR-1"
    Then the answer carries one canonical QueryEnvelope whose data deep-equals the direct kernel "getNode" answer
    When the client calls "spec_trace" from "product:FR-1" direction "out"
    Then the answer carries one canonical QueryEnvelope whose data deep-equals the direct kernel "trace" answer
    And the repository's pinned .specs tree is byte-for-byte unchanged

  @id:SCEN-extension-registry-cardinality @feature9
  Scenario: A fresh host process registers exactly the eight read-approved extension tools
    Given the built OMP extension entrypoint path
    When a fresh probe process registers the extension through a mock pi host from a foreign working directory
    Then exactly eight tools were registered under the SCHEMA-11 names
    And every registered tool is strict, executable, and approved for reading

  @id:SCEN-mcp-fail-closed @feature9
  Scenario Outline: The stdio server refuses unknown tools and malformed calls fail-closed
    Given a spawned stdio MCP server rooted at a byte-exact replica of the pinned corpus
    When the client sends the "<case>" request
    Then the refusal is exactly "<expected>"

    Examples:
      | case                | expected                                  |
      | unknown-tool        | JSON-RPC error -32602                     |
      | bad-schema-version  | envelope error UNSUPPORTED_SCHEMA_VERSION |
      | unknown-field       | envelope error UNKNOWN_FIELD              |

  @id:SCEN-dependency-absent-corpus @feature9
  Scenario: The dependency-free server answers from a bare foreign corpus copy
    Given a temporary repository holding only a copied product specification and no node_modules ancestry
    When a spawned stdio MCP server rooted there initializes and reads the overview
    Then the overview succeeds over exactly the copied product documents
