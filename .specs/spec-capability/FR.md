# Functional Requirements

All runtime identities use `spec-capability:<local-id>` for this specification's own nodes. Product capability definitions use the owning product/spec slug, for example `product:CAP-1`. Scenarios are specification text and carry no executed status.

## FR-1: Per-owning-spec capability nodes

Kernel@2 SHALL recognize optional `.specs/<owning-spec>/CAPABILITIES.md` through the capability extension. Level-2 `CAP-N` and nested level-3 `CAP-N.M` headings SHALL produce `CAPABILITY` nodes with canonical IDs `<owning-spec>:CAP-N[.M]`, `NodeSourceV2.kind="CAPABILITY_DOCUMENT"`, content hash, explicit lifecycle, and deterministic parent linkage. Bare repository-level CAP canonical IDs and `.specs/CAPABILITIES.md` SHALL be rejected.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-capability-nodes-are-parsed-from-capabilitiesmd)

**Scenario:** `@feature1` / `SCEN-capability-node-parsing`

## FR-2: DERIVES_FROM declarations and edge grammar

FR/NFR definitions SHALL declare capability ownership with a qualified `**Covers:** [<spec>:CAP-N]` field. The extension SHALL emit `DERIVES_FROM` only for requirement→capability and child-capability→parent-capability endpoints. `**Requirement:**` links remain `REFS`, never implicit derivation. The same section SHALL author `**Capability lifecycle:** LIVE|ARCHIVED`; the extension parses it from canonical bytes and missing lifecycle is an ERROR. Missing, ambiguous, unqualified or forbidden targets SHALL produce typed unresolved diagnostics without an edge.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-derivesfrom-edges-follow-the-closed-endpoint-matrix)

**Scenario:** `@feature2` / `SCEN-derives-from-edge-resolution`

## FR-3: Capability conformance findings

The graph SHALL emit the closed diagnostics in `spec-capability_SCHEMA.md`: invalid/dangling/duplicate/forbidden endpoints are ERROR; live capability with no deriving requirement is `CAPABILITY_ORPHAN` WARNING; an owning spec with no capability declaration is `SPEC_WITHOUT_CAPABILITY` INFO. Lifecycle is explicit; file location SHALL NOT imply archival state.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-conformance-findings-use-closed-codes-and-severities)

**Scenario:** `@feature3` / `SCEN-capability-conformance-findings`

## FR-4: Requirements-of capability query

`requirementsOf` SHALL return deterministic, bounded, cursor-paged deriving requirements for one qualified capability ID. Requirement lifecycle is explicit `LIVE|ARCHIVED`; `includeArchived:false` returns LIVE only and `true` includes both. Missing/ambiguous IDs and invalid limits/cursors fail with the closed errors.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-requirementsof-returns-live-deterministic-bounded-results)

**Scenario:** `@feature4` / `SCEN-requirements-of-capability-query`

## FR-5: Capabilities-of spec query

`capabilitiesOf` SHALL return capabilities declared by one valid spec slug, optionally including inherited parent capabilities and explicit archived rows. Results deduplicate by canonical ID and use stable ordering/cursors.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-capabilitiesof-returns-declared-capabilities)

**Scenario:** `@feature5` / `SCEN-capabilities-of-spec-query`

## FR-6: Graph-only impact and evidence overlay

`getImpact` SHALL consume only the immutable graph and return structural/semantic-recheck canonical IDs, never producer IDs or evidence verdicts. Separate `invalidateEvidence` SHALL consume and re-hash exact bytes of one complete `EvidenceEvaluationOutputV2`, recompute its `spec-evidence@2.deterministicFingerprint`, and compare parsed producer/freshness bindings with current kernel bindings; it SHALL return a closed paged success/error envelope of stale, unaffected and indeterminate rows with closed *_CHANGED/*_MISSING per-dimension reasons and precedence and a two-snapshot binding proof.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-graph-impact-and-evidence-invalidation-are-separated)

**Scenario:** `@feature6` / `SCEN-get-impact-query`

## FR-7: Determinism and canonical identity

Capability IDs SHALL normalize through kernel@2 as `<owning-spec>:CAP-N[.M]`; nested nodes share parent slug/prefix. Equivalent bytes in any arrival order serialize identically. Duplicate definitions preserve candidates, elect no node and emit `DUPLICATE_DEFINITION`. Bare IDs resolve only inside their owning spec; cross-spec references require qualification.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-capability-identity-is-deterministic-and-fail-closed), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72-canonical-id-grammar-and-cross-reference-resolution)

**Scenario:** `@feature7` / `SCEN-capability-determinism-and-identity`

## FR-8: MCP-only parity discipline

Agent-facing capability operations SHALL exist only through MCP. Graph profile maps `requirements_of`, `capabilities_of`, `get_impact`; overlay profile additionally maps `invalidate_evidence`. Each is one-to-one with shared envelopes. No capability `pi.registerTool`, agent LSP API, mutation, second graph or adapter semantic logic is permitted.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-mcp-projections-map-one-to-one-without-added-semantics)

**Scenario:** `@feature8` / `SCEN-capability-projection-parity`

## FR-9: Capability release eligibility

The release evaluator SHALL consume role-typed evidence bytes for a delivered ProductStatus baseline and eligible kernel-anchor-migration@1 candidate plus check evidence, re-hash and parse them, and enforce the exact graph or overlay FR-check membership plus all six NFR checks in the schema. Overlay additionally requires accepted evidence MCP and the bound evaluation `deterministicFingerprint`. It SHALL return closed eligibility/blockers; every missing/extra/duplicate/failed/stale/mismatched/unverifiable/unbound input fails.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-release-gate-is-a-closed-conjunction)

**Scenario:** `@feature9` / `SCEN-capability-release-conjunction`

## FR-10: Boundary enforcement

The schema SHALL contain no ontology, SHACL, SKOS, version/federation, mutation, proposal, repair, status-transition, direct filesystem or second agent-tool concepts. Future widening requires a new schema/profile and product decision.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-non-goals-are-enforced-as-schema-absence)

**Scenario:** `@feature10` / `SCEN-capability-non-goals-enforced`
