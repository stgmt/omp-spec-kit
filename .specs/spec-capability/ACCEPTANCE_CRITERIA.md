# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1: Capability nodes are parsed from CAPABILITIES.md

**EARS:** WHEN `.specs/CAPABILITIES.md` contains level-2 `## CAP-N: <title>` and level-3 `### CAP-N.M: <title>` headings THEN the parser SHALL produce CAPABILITY nodes with correct nesting attributes AND nested capabilities SHALL produce DERIVES_FROM edges to their parent AND malformed headings SHALL produce typed diagnostics without creating nodes.

**Requirement:** [FR-1](FR.md#fr-1-capability-node-and-document)

**Scenario:** `@feature1`, `@id:SCEN-capability-node-parsing`

## AC-2.1: DERIVES_FROM edges follow closed endpoint matrix

**EARS:** WHEN FR/NFR headings contain `**Capability:** [CAP-N.M]` fields OR spec README frontmatter contains `capabilities: [CAP-N]` THEN the builder SHALL produce DERIVES_FROM edges only for permitted endpoint pairs (FR→CAPABILITY, NFR→CAPABILITY, CAPABILITY→CAPABILITY nesting) AND forbidden endpoints SHALL produce unresolved references AND unknown targets SHALL produce CAPABILITY_DANGLING diagnostics.

**Requirement:** [FR-2](FR.md#fr-2-derivesfrom-edge-and-declaration-grammar)

**Scenario:** `@feature2`, `@id:SCEN-derives-from-edge-resolution`

## AC-3.1: Conformance findings use closed codes and severities

**EARS:** WHEN a capability declaration targets an unknown ID THEN `CAPABILITY_DANGLING` (ERROR) SHALL be emitted AND graph validity SHALL be false; WHEN a capability has zero live non-archived derivers THEN `CAPABILITY_ORPHAN` (WARNING) SHALL be emitted AND graph validity SHALL remain true; WHEN a spec declares no capabilities THEN `SPEC_WITHOUT_CAPABILITY` (INFO) SHALL be emitted AND graph validity SHALL remain true.

**Requirement:** [FR-3](FR.md#fr-3-conformance-findings)

**Scenario:** `@feature3`, `@id:SCEN-capability-conformance-findings`

## AC-4.1: Requirements-of returns live deterministic bounded results

**EARS:** WHEN `requirements_of(CAP-N)` is called on a valid capability THEN the result SHALL contain exactly the live non-archived deriving requirements in canonical-ID ascending order AND SHALL respect page limits AND SHALL exclude archived requirements; WHEN the capability ID is unknown THEN `NOT_FOUND` SHALL be returned.

**Requirement:** [FR-4](FR.md#fr-4-requirements-of-capability-query)

**Scenario:** `@feature4`, `@id:SCEN-requirements-of-capability-query`

## AC-5.1: Capabilities-of returns declared capabilities

**EARS:** WHEN `capabilities_of(spec-slug)` is called on a valid spec THEN the result SHALL contain all deduplicated capabilities declared via frontmatter and FR/NFR fields in canonical-ID ascending order; WHEN the spec slug is unknown THEN `NOT_FOUND` SHALL be returned; WHEN the spec declares no capabilities THEN an empty result set SHALL be returned.

**Requirement:** [FR-5](FR.md#fr-5-capabilities-of-spec-query)

**Scenario:** `@feature5`, `@id:SCEN-capabilities-of-spec-query`

## AC-6.1: Get-impact returns three-section envelope

**EARS:** WHEN `get_impact(nodeId)` is called on a valid node THEN the response SHALL contain structural (ACs, direct scenarios, two-hop scenarios via AC, tasks, code files, dependent FRs, parent capabilities), semantic_recheck (scenario and AC IDs), and invalidates (scenario result identifiers) sections AND all lists SHALL be deterministically ordered and bounded AND the envelope SHALL carry `schemaVersion: "spec-capability-impact@1"`; WHEN the node ID is unknown THEN `NOT_FOUND` SHALL be returned.

**Requirement:** [FR-6](FR.md#fr-6-get-impact-query)

**Scenario:** `@feature6`, `@id:SCEN-get-impact-query`

## AC-7.1: Capability identity is deterministic and fail-closed

**EARS:** WHEN equivalent capability inputs are supplied in different orders or line-ending forms THEN the serialized output SHALL be byte-identical; WHEN duplicate CAP IDs exist in CAPABILITIES.md THEN both candidates SHALL be preserved AND no canonical node SHALL be elected AND `DUPLICATE_DEFINITION` SHALL be emitted per spec-kernel:FR-4 discipline.

**Requirement:** [FR-7](FR.md#fr-7-determinism-and-identity)

**Scenario:** `@feature7`, `@id:SCEN-capability-determinism-and-identity`

## AC-7.2 (FR-7): Canonical ID grammar and cross-reference resolution

**Requirement:** [FR-7](FR.md#fr-7-determinism-and-identity)

**EARS:** WHEN capability IDs are produced THEN they SHALL follow `spec-kernel:FR-3` normalization (NFC Unicode, LF line endings, `/` path separators) with the qualified cross-reference form `<slug>:CAP-N` / `<slug>:CAP-N.M`; AND bare CAP IDs SHALL resolve only within the declaring document while unknown or escaping targets SHALL produce unresolved-reference diagnostics.

**Scenario:** `@feature7`, `@id:SCEN-capability-determinism-and-identity`

## AC-8.1: Projections map one-to-one without added semantics

**EARS:** WHEN extension and MCP projections expose capability or impact operations THEN each projection SHALL return the canonical versioned envelope as structured content AND SHALL add no parsing resolution filtering or verdict semantics AND SHALL contain no mutation or state-transition operations.

**Requirement:** [FR-8](FR.md#fr-8-parity-discipline)

**Scenario:** `@feature8`, `@id:SCEN-capability-projection-parity`

## AC-9.1: Release gate is a closed conjunction

**EARS:** WHEN release eligibility is evaluated THEN every mandatory check for FR-1 through FR-8 SHALL have exactly one passing hash-bound record AND missing extra duplicate failed stale mismatched or unbound records SHALL fail closed with deterministic blockers AND structural specification text SHALL NOT satisfy evidence.

**Requirement:** [FR-9](FR.md#fr-9-release-eligibility-conjunction)

**Scenario:** `@feature9`, `@id:SCEN-capability-release-conjunction`

## AC-10.1: Non-goals are enforced as schema absence

**EARS:** WHEN the spec-capability@1 schema is inspected THEN it SHALL contain no ontology vocabulary fields no semantic contract language bindings no SKOS taxonomy references no capability version fields beyond ID stability and no multi-repo federation types; AND the structural-check-only posture for capability content SHALL be invariant.

**Requirement:** [FR-10](FR.md#fr-10-non-goals-enforcement)

**Scenario:** `@feature10`, `@id:SCEN-non-goals-enforced`
