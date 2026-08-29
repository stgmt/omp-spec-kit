@spec-capability @specification-only
Feature: Capability graph and impact as independently gated MCP functionality
  Capability definitions belong to their owning specs. Graph-only impact and evidence
  invalidation are separate. These scenarios are specification text, not execution evidence.

  @feature1 @AC-1.1 @id:SCEN-capability-node-parsing
  Scenario: Per-owning-spec capability documents produce canonical nodes
    Given kernel at 2 receives product/CAPABILITIES.md with CAP-1 and nested CAP-1.1 headings
    When capability parsing runs
    Then nodes product:CAP-1 and product:CAP-1.1 use CAPABILITY_DOCUMENT sources and deterministic parent linkage
    And a root .specs/CAPABILITIES.md or bare canonical CAP ID is rejected

  @feature2 @AC-2.1 @id:SCEN-derives-from-edge-resolution
  Scenario: Qualified Covers declarations produce only permitted derivation edges
    Given requirements declare qualified product capability IDs through Covers fields
    When edge resolution runs
    Then each valid declaration produces one allowed DERIVES_FROM edge
    And Requirement links remain REFS
    And missing ambiguous unqualified or forbidden targets produce diagnostics without edges

  @feature3 @AC-3.1 @id:SCEN-capability-conformance-findings
  Scenario: Capability conformance uses closed codes and explicit lifecycle
    Given invalid dangling duplicate orphan and undeclared capability variants
    When conformance runs
    Then error warning and info severities match the closed schema
    And archive state is read only from the lifecycle field

  @feature4 @AC-4.1 @id:SCEN-requirements-of-capability-query
  Scenario: requirementsOf returns bounded live derivations
    Given one live and one archived requirement derive from product:CAP-1
    When requirementsOf is called without archived rows
    Then only the live requirement appears in stable cursor order
    And invalid IDs limits or cursors return closed errors

  @feature5 @AC-5.1 @id:SCEN-capabilities-of-spec-query
  Scenario: capabilitiesOf returns declared and inherited capabilities deterministically
    Given a valid spec declares direct and nested capabilities
    When capabilitiesOf is called with inheritance enabled
    Then canonical capability IDs are deduplicated and stably ordered

  @feature6 @AC-6.1 @id:SCEN-get-impact-query
  Scenario: Graph impact and evidence invalidation are separate
    Given a changed requirement reaches ACs scenarios tasks code files and capabilities
    When getImpact runs without evidence input
    Then it returns structural and semantic-recheck IDs and no producer result IDs
    When invalidateEvidence receives that impact current kernel bindings and a complete spec-evidence evaluation snapshot
    Then it returns stale unaffected and indeterminate producer IDs with per-dimension reasons and two-snapshot binding proof

  @feature7 @AC-7.1 @AC-7.2 @id:SCEN-capability-determinism-and-identity
  Scenario: Capability identity is qualified deterministic and duplicate-safe
    Given equivalent owning-spec capability inputs in different orders and line endings
    When they are parsed and serialized
    Then outputs are byte-identical and IDs use owning-spec qualification
    And duplicate IDs preserve candidates with no elected node

  @feature8 @AC-8.1 @id:SCEN-capability-projection-parity
  Scenario Outline: MCP is the only agent-facing capability projection
    Given capability profile "<profile>" exposes "<names>"
    When projection parity is inspected
    Then canonical envelopes are unchanged after transport metadata removal
    And no capability pi.registerTool or agent LSP surface exists

    Examples:
      | profile                              | names                                                         |
      | spec-capability-graph@1              | requirements_of capabilities_of get_impact                    |
      | spec-capability-evidence-overlay@1   | requirements_of capabilities_of get_impact invalidate_evidence|

  @feature9 @AC-9.1 @id:SCEN-capability-release-conjunction
  Scenario Outline: Capability release requires its exact profile aggregate
    Given delivered v0.3 baseline profile "<profile>" and candidate evidence bytes
    When one "<membership>" record or any six NFR records is missing extra duplicate failed stale mismatched or unbound
    Then eligibility is false with a closed deterministic blocker

    Examples:
      | profile                            | membership                                      |
      | spec-capability-graph@1            | graph-only FR checks                            |
      | spec-capability-evidence-overlay@1 | graph checks plus overlay checks and fingerprints |

  @feature10 @AC-10.1 @id:SCEN-capability-non-goals-enforced
  Scenario: Schema contains no forbidden control-plane concepts
    Given the complete spec-capability at 2 schema
    When public types and operations are enumerated
    Then ontology federation mutation direct filesystem and second-agent-tool concepts are absent
