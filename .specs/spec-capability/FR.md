# Functional Requirements

All runtime identities in this specification use `spec-capability:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status. This spec extends the spec-kernel typed model via `spec-capability@1`; it references `spec-kernel@1` by dependency and never modifies kernel schemas.

## FR-1: Capability node and document

The parser SHALL recognize `.specs/CAPABILITIES.md` as a canonical capability document. Level-2 ATX headings `## CAP-N: <title>` SHALL produce top-level CAPABILITY nodes. Level-3 ATX headings `### CAP-N.M: <title>` SHALL produce nested CAPABILITY nodes whose parent is the enclosing level-2 CAP-N. The ID grammar SHALL be `CAP-[1-9][0-9]*` for top-level and `CAP-[1-9][0-9]*\.[1-9][0-9]*` for nested. Capability titles SHALL be product-wording obligations without implementation detail; structural validation checks heading grammar only — semantic quality assessment is out of scope. Each CAPABILITY node SHALL carry attributes `{ nestingDepth: integer, parentCapId: string|null }`. The CAPABILITIES.md document role SHALL be added to the extension's recognized document set without modifying `spec-kernel@1`.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-capability-nodes-are-parsed-from-capabilitiesmd)

**Scenario:** `@feature1` / `SCEN-capability-node-parsing`

**Sources:** design brief section "Предложение 1" items 1–2; `spec-kernel:FR-2` document-role pattern; `spec-kernel_SCHEMA.md` SCHEMA-2.

## FR-2: DERIVES_FROM edge and declaration grammar

The builder SHALL support a new typed edge `DERIVES_FROM` with the closed endpoint matrix: `FUNCTIONAL_REQUIREMENT → CAPABILITY`, `NON_FUNCTIONAL_REQUIREMENT → CAPABILITY`, and `CAPABILITY → CAPABILITY` (nesting only, child→parent). DERIVES_FROM edges SHALL be declared via two mechanisms: (a) structured field `**Capability:** [CAP-N.M]` on FR/NFR headings in `FR.md`, following the same parsing pattern as `**Requirement:**` fields the kernel already recognizes per `spec-kernel:FR-5`; (b) spec-level frontmatter `capabilities: [CAP-N, ...]` in spec README.md, which declares that all requirements in that spec derive from the listed capabilities. Each declaration SHALL produce one DERIVES_FROM reference occurrence resolved through the standard edge-resolution pipeline. Missing, malformed, ambiguous, or forbidden-endpoint targets SHALL produce typed unresolved references per `spec-kernel:FR-5`.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-derives-from-edges-follow-closed-endpoint-matrix)

**Scenario:** `@feature2` / `SCEN-derives-from-edge-resolution`

**Sources:** design brief section "Предложение 1" items 2–3; `spec-kernel:FR-5` typed edge resolution; `spec-kernel_SCHEMA.md` SCHEMA-5 endpoint matrix pattern.

## FR-3: Conformance findings

The graph build SHALL evaluate capability-specific conformance findings using closed diagnostic codes: (a) `CAPABILITY_DANGLING` (ERROR severity) — a `**Capability:**` or frontmatter declaration targets an unknown capability ID; (b) `CAPABILITY_ORPHAN` (WARNING severity) — a CAPABILITY node has zero live non-archived deriving requirements, serving as an advisory archival mirror analogous to upstream FR-45 proof-gated archival; (c) `SPEC_WITHOUT_CAPABILITY` (INFO severity) — a spec declares no capabilities in its README frontmatter and no FR/NFR contains a `**Capability:**` field. CAPABILITY_DANGLING SHALL fail closed like other broken references. CAPABILITY_ORPHAN and SPEC_WITHOUT_CAPABILITY SHALL NOT invalidate the graph (`valid` remains true when only these are present). All diagnostics SHALL follow `spec-kernel_SCHEMA.md` SCHEMA-6 format with repository-relative paths and bounded messages.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-conformance-findings-use-closed-codes-and-severities)

**Scenario:** `@feature3` / `SCEN-capability-conformance-findings`

**Sources:** design brief section "Предложение 1" item 4; `spec-kernel:FR-6` invariant/diagnostic pattern; `spec-kernel:FR-13` orphan detection (ADOPT in MIGRATION_MATRIX).

## FR-4: Requirements-of-capability query

The query service SHALL expose `requirements_of(capabilityId)` returning all live (non-archived) requirements that derive from the specified capability via DERIVES_FROM edges. Results SHALL include both direct derivers and transitive derivers through nested capabilities. Results SHALL be deterministically ordered by canonical ID ascending. Results SHALL be bounded by default and hard page limits. The operation SHALL be read-only and pure. An unknown capability ID SHALL return `NOT_FOUND`. An empty result set is valid and distinct from CAPABILITY_ORPHAN (which is a build-time diagnostic, not a query result).

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-requirements-of-returns-live-deterministic-bounded-results)

**Scenario:** `@feature4` / `SCEN-requirements-of-capability-query`

**Sources:** design brief section "Предложение 1" item 5; `spec-kernel:FR-8` bounded query service pattern.

## FR-5: Capabilities-of-spec query

The query service SHALL expose `capabilities_of(specSlug)` returning all capabilities declared by the specified spec via README frontmatter `capabilities:` field and FR/NFR `**Capability:**` fields. Results SHALL be deduplicated and deterministically ordered by capability canonical ID ascending. Results SHALL be bounded. The operation SHALL be read-only and pure. An unknown spec slug SHALL return `NOT_FOUND`. A spec with no capability declarations SHALL return an empty result set.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-capabilities-of-returns-declared-capabilities)

**Scenario:** `@feature5` / `SCEN-capabilities-of-spec-query`

**Sources:** design brief section "Предложение 1" item 5; `spec-kernel:FR-8` bounded query service pattern.

## FR-6: Get-impact query

The query service SHALL expose `get_impact(nodeId)` as a read-only pure query returning a versioned impact response envelope with three sections: (a) `structural` — covering AC/Story/Decision nodes via incoming COVERS edges, scenarios direct via TESTED_BY and via AC two-hop (FR→AC→scenario), tasks referencing the node via REFS, code files via IMPLEMENTS edges, dependent FRs via REFS, and parent capabilities via DERIVES_FROM; (b) `semantic_recheck` — a list of scenario and AC canonical IDs whose semantic meaning may drift when the target changes, serving as input for the future semantic judge (DEFER `spec-kernel:FR-8`); (c) `invalidates` — a list of scenario result identifiers that a change to the target would render stale. The invalidation set defines the CONTRACT only; actual invalidation semantics consume the future evidence layer's freshness model by reference and are never reimplemented in this spec. All lists SHALL be deterministically ordered and bounded. An unknown node ID SHALL return `NOT_FOUND`. The response envelope SHALL carry `schemaVersion: "spec-capability-impact@1"`.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-get-impact-returns-three-section-envelope)

**Scenario:** `@feature6` / `SCEN-get-impact-query`

**Sources:** design brief section "Предложение 2"; upstream `get_trace` provenance; `spec-kernel:FR-8` bounded query pattern.

## FR-7: Determinism and identity

CAPABILITY IDs SHALL follow `spec-kernel:FR-3` normalization: NFC Unicode, LF line endings, `/` path separators, and qualified form `<slug>:CAP-N` or `<slug>:CAP-N.M` for cross-referencing. Duplicate CAP definitions within `.specs/CAPABILITIES.md` SHALL fail closed per `spec-kernel:FR-4`: both candidates are preserved in `definitionCandidates`, no canonical node is elected, and `DUPLICATE_DEFINITION` is emitted. Cross-spec capability references SHALL use the qualified form; bare CAP IDs resolve only within the declaring document. Equivalent inputs in any arrival order SHALL produce identical serialized output.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-capability-identity-is-deterministic-and-fail-closed)

**Scenario:** `@feature7` / `SCEN-capability-determinism-and-identity`

**Sources:** `spec-kernel:FR-3` canonical identity; `spec-kernel:FR-4` lossless duplicate handling.

## FR-8: Parity discipline

Any future projection (extension tool, MCP server, LSP adapter) exposing capability or impact data SHALL map one-to-one onto the operations defined in this spec (`requirements_of`, `capabilities_of`, `get_impact`) with no added parsing, resolution, filtering, or verdict semantics. Projection responses SHALL return the canonical versioned envelope as structured content. No projection SHALL introduce mutation, proposal, repair, or state-transition operations for capabilities. This mirrors `spec-kernel:FR-9` / `FR-14` CHK-FR9-01 parity discipline applied to the capability extension surface.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-projections-map-one-to-one-without-added-semantics)

**Scenario:** `@feature8` / `SCEN-capability-projection-parity`

**Sources:** `spec-kernel:FR-9` MCP projection parity; `spec-kernel:FR-14` CHK-FR9-01 pattern.

## FR-9: Release eligibility conjunction

The release evaluator SHALL produce `spec-capability-release@1` and mark a candidate eligible only with: closed stage/profile match matching the ROADMAP-decided kernel-family extension stage; one passing hash-bound record per mandatory check for FR-1 through FR-8; dependency on accepted current-candidate `spec-kernel:FR-14` evidence; and the independent adversarial review record. Missing, extra, duplicate, failed, stale, mismatched, or unbound records SHALL fail closed with deterministic blockers. Structural specification text and unexecuted Gherkin SHALL NOT satisfy evidence. Eligibility SHALL NOT imply authorization to ship in v0.1.0, v0.2, or v0.3; the release stage decision is recorded separately in `ROADMAP.md`.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-release-gate-is-a-closed-conjunction)

**Scenario:** `@feature9` / `SCEN-capability-release-conjunction`

**Sources:** `spec-kernel:FR-14` conjunctive release pattern; [README.md](README.md) release boundary.

## FR-10: Non-goals enforcement

This specification SHALL NOT define, implement, or depend on: ontology vocabulary (OWL, RDF, RDFS), semantic contract languages (SHACL, ShEx), SKOS thesauri or taxonomy frameworks, capability versioning beyond ID stability (no version fields on CAPABILITY nodes), multi-repo capability federation, Explorer-style visualization UI, or semantic drift judging (consumed by reference from DEFER `spec-kernel:FR-8`). Any future proposal adding these concerns SHALL require a separate specification with its own schema version and release gate. The structural-check-only posture for capability content (FR-1) is invariant.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-non-goals-are-enforced-as-schema-absence)

**Scenario:** `@feature10` / `SCEN-non-goals-enforced`

**Sources:** design brief section "Не-цели (из анализа Reqvire)"; RESEARCH RF-1.
