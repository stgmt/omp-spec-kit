@spec-capability @kernel-extension
Feature: Product-level capability layer above requirements
  This specification extends the spec-kernel typed model with CAPABILITY nodes,
  DERIVES_FROM edges, conformance findings, and impact queries.
  These scenarios specify required behavior and have no executed status here.

  @feature1 @AC-1.1 @id:SCEN-capability-node-parsing
  Scenario: Capability nodes are parsed from CAPABILITIES.md with correct nesting
    Given a repository contains .specs/CAPABILITIES.md with level-2 CAP-N and level-3 CAP-N.M headings
    When the capability parser processes the document
    Then top-level CAPABILITY nodes are created for each level-2 heading
    And nested CAPABILITY nodes are created for each level-3 heading with parent references
    And malformed headings produce typed diagnostics without creating nodes

  @feature2 @AC-2.1 @id:SCEN-derives-from-edge-resolution
  Scenario: DERIVES_FROM edges follow closed endpoint matrix
    Given FR headings contain Capability fields referencing valid CAP-N.M IDs
    And spec README frontmatter declares capabilities
    And one FR references an unknown CAP-99 ID
    And one declaration targets a forbidden endpoint pair
    When the graph builder resolves DERIVES_FROM references
    Then valid declarations produce DERIVES_FROM edges with permitted endpoints
    And the unknown target produces a CAPABILITY_DANGLING diagnostic
    And the forbidden endpoint produces an unresolved reference

  @feature3 @AC-3.1 @id:SCEN-capability-conformance-findings
  Scenario: Conformance findings use closed codes and correct severities
    Given a capability declaration targets an unknown ID
    And a capability has zero live non-archived deriving requirements
    And a spec declares no capabilities
    When the graph build evaluates conformance
    Then CAPABILITY_DANGLING is emitted with ERROR severity and graph valid is false
    And CAPABILITY_ORPHAN is emitted with WARNING severity and graph valid remains true
    And SPEC_WITHOUT_CAPABILITY is emitted with INFO severity and graph valid remains true

  @feature4 @AC-4.1 @id:SCEN-requirements-of-capability-query
  Scenario: Requirements-of returns live deterministic bounded results
    Given a capability CAP-1 has three deriving requirements including one archived
    When requirements_of is called with CAP-1
    Then the result contains exactly the two live non-archived requirements
    And results are ordered by canonical ID ascending
    And the result respects page limits

  @feature5 @AC-5.1 @id:SCEN-capabilities-of-spec-query
  Scenario: Capabilities-of returns declared capabilities for a spec
    Given a spec declares CAP-1 in frontmatter and CAP-2 via an FR Capability field
    When capabilities_of is called with that spec slug
    Then the result contains both CAP-1 and CAP-2 deduplicated and ordered by canonical ID
    And a spec with no declarations returns an empty result set

  @feature6 @AC-6.1 @id:SCEN-get-impact-query
  Scenario: Get-impact returns three-section envelope with structural semantic and invalidation data
    Given an FR node has incoming COVERS from two ACs and one Story
    And those ACs have TESTED_BY edges to scenarios
    And tasks reference the FR via REFS
    And code files connect via IMPLEMENTS
    And the FR derives from a parent capability
    When get_impact is called on the FR node
    Then the structural section lists ACs direct scenarios two-hop scenarios tasks code files dependent FRs and parent capabilities
    And the semantic_recheck section lists impacted scenario and AC IDs
    And the invalidates section lists scenario result identifiers
    And the envelope carries schemaVersion spec-capability-impact@1

  @feature7 @AC-7.1 @id:SCEN-capability-determinism-and-identity
  Scenario: Capability identity is deterministic and duplicates fail closed
    Given equivalent CAPABILITIES.md inputs are supplied in different orders and line endings
    When both are parsed and serialized
    Then the outputs are byte-identical
    And duplicate CAP-1 definitions preserve both candidates with no elected node and emit DUPLICATE_DEFINITION

  @feature8 @AC-8.1 @id:SCEN-capability-projection-parity
  Scenario: Extension and MCP projections return identical canonical envelopes
    Given the extension and MCP adapters both expose requirements_of capabilities_of and get_impact
    When both are called with the same arguments on the same graph
    Then the canonical envelopes are byte-identical after removing transport metadata
    And neither projection adds parsing resolution filtering or verdict semantics

  @feature9 @AC-9.1 @id:SCEN-capability-release-conjunction
  Scenario: Release eligibility requires all mandatory evidence and fails closed
    Given a release candidate with missing and failed check records
    When eligibility is evaluated
    Then eligible is false
    And blocking lists each missing and failed record deterministically
    And structural specification text does not satisfy evidence

  @feature10 @AC-10.1 @id:SCEN-non-goals-enforced
  Scenario: Schema contains no ontology SHACL SKOS version or federation types
    Given the spec-capability@1 schema definition
    When the schema is inspected
    Then no ontology vocabulary fields exist
    And no semantic contract language bindings exist
    And no SKOS taxonomy references exist
    And no capability version fields beyond ID stability exist
    And no multi-repo federation types exist
