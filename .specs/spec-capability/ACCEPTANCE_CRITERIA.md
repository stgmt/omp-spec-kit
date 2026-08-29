# Acceptance Criteria

These are future verification obligations. Scenario text is not execution evidence.

## AC-1.1: Capability nodes are parsed from CAPABILITIES.md

**EARS:** WHEN kernel@2 receives `.specs/<owning-spec>/CAPABILITIES.md` THEN valid CAP headings SHALL produce `<owning-spec>:CAP-N[.M]` nodes with CAPABILITY_DOCUMENT source, deterministic nesting and explicit lifecycle; AND a root `.specs/CAPABILITIES.md` or bare canonical CAP ID SHALL be rejected.

**Requirement:** [FR-1](FR.md#fr-1-per-owning-spec-capability-nodes)

**Scenario:** `@feature1`, `@id:SCEN-capability-node-parsing`

## AC-2.1: DERIVES_FROM edges follow the closed endpoint matrix

**EARS:** WHEN a qualified `Covers` declaration and explicit `Capability lifecycle: LIVE|ARCHIVED` parse from the same canonical requirement section THEN exactly one allowed DERIVES_FROM edge and one lifecycle-bearing requirement summary SHALL be emitted; missing lifecycle SHALL be an ERROR; AND Requirement links SHALL remain REFS; AND missing ambiguous unqualified or forbidden targets SHALL yield typed unresolved diagnostics and no edge.

**Requirement:** [FR-2](FR.md#fr-2-derivesfrom-declarations-and-edge-grammar)

**Scenario:** `@feature2`, `@id:SCEN-derives-from-edge-resolution`

## AC-3.1: Conformance findings use closed codes and severities

**EARS:** WHEN capability conformance runs THEN invalid dangling duplicate or forbidden definitions SHALL be ERROR; a live capability with no deriving requirement SHALL be CAPABILITY_ORPHAN WARNING; a spec without declarations SHALL be SPEC_WITHOUT_CAPABILITY INFO; AND lifecycle SHALL come only from explicit attributes.

**Requirement:** [FR-3](FR.md#fr-3-capability-conformance-findings)

**Scenario:** `@feature3`, `@id:SCEN-capability-conformance-findings`

## AC-4.1: requirementsOf returns live deterministic bounded results

**EARS:** WHEN requirementsOf is called with a valid capability ID THEN it SHALL return stable cursor-paged deriving requirements, excluding archived rows by default; invalid ID limit cursor or missing capability SHALL return its closed error.

**Requirement:** [FR-4](FR.md#fr-4-requirements-of-capability-query)

**Scenario:** `@feature4`, `@id:SCEN-requirements-of-capability-query`

## AC-5.1: capabilitiesOf returns declared capabilities

**EARS:** WHEN capabilitiesOf is called with a valid spec slug THEN it SHALL return deduplicated canonical capabilities in stable order with explicit inherited/archive controls; unsafe or unknown slugs SHALL fail closed.

**Requirement:** [FR-5](FR.md#fr-5-capabilities-of-spec-query)

**Scenario:** `@feature5`, `@id:SCEN-capabilities-of-spec-query`

## AC-6.1: Graph impact and evidence invalidation are separated

**EARS:** WHEN `getImpact` runs without evidence THEN it SHALL return only graph IDs; WHEN `invalidateEvidence` runs THEN it SHALL re-hash complete evidence output bytes, recompute the deterministic fingerprint, enforce 64 MiB/100000-row/200-page/1 MiB/2000-ms-p95/5000-ms-hard bounds, and return stale/unaffected/indeterminate rows with closed changed-vs-missing precedence and binding proof; graph-only output SHALL never fabricate producer IDs.

**Requirement:** [FR-6](FR.md#fr-6-graph-only-impact-and-evidence-overlay)

**Scenario:** `@feature6`, `@id:SCEN-get-impact-query`

## AC-7.1: Capability identity is deterministic and fail-closed

**EARS:** WHEN equivalent capability inputs differ only by arrival order or line endings THEN output SHALL be byte-identical; WHEN duplicate capability IDs exist THEN candidates SHALL be preserved, no node elected, and DUPLICATE_DEFINITION emitted.

**Requirement:** [FR-7](FR.md#fr-7-determinism-and-canonical-identity)

**Scenario:** `@feature7`, `@id:SCEN-capability-determinism-and-identity`

## AC-7.2: Canonical ID grammar and cross-reference resolution

**EARS:** WHEN capability IDs are produced THEN they SHALL use `<owning-spec>:CAP-N[.M]`; bare IDs resolve only in the owning spec; cross-spec references require qualification; unknown or escaping targets produce unresolved diagnostics.

**Requirement:** [FR-7](FR.md#fr-7-determinism-and-canonical-identity)

**Scenario:** `@feature7`, `@id:SCEN-capability-determinism-and-identity`

## AC-8.1: MCP projections map one-to-one without added semantics

**EARS:** WHEN graph profile is exposed THEN MCP SHALL map exactly three graph envelopes; WHEN overlay profile is exposed THEN it SHALL additionally map `invalidate_evidence`; no OMP/LSP agent surface adapter semantic logic mutation or second graph SHALL exist.

**Requirement:** [FR-8](FR.md#fr-8-mcp-only-parity-discipline)

**Scenario:** `@feature8`, `@id:SCEN-capability-projection-parity`

## AC-9.1: Release gate is a closed conjunction

**EARS:** WHEN eligibility is evaluated THEN delivered baseline/kernel evidence, exact profile FR checks, all six NFR checks, hash-valid evidence bytes and candidate bindings SHALL be required; overlay also requires accepted evidence MCP plus the consumed `deterministicFingerprint`; every one-fault variant returns a closed blocker.

**Requirement:** [FR-9](FR.md#fr-9-capability-release-eligibility)

**Scenario:** `@feature9`, `@id:SCEN-capability-release-conjunction`

## AC-10.1: Non-goals are enforced as schema absence

**EARS:** WHEN the public schema is inspected THEN ontology SHACL SKOS federation mutation proposal repair status-transition direct filesystem and second-agent-tool concepts SHALL be absent; unknown fields fail closed.

**Requirement:** [FR-10](FR.md#fr-10-boundary-enforcement)

**Scenario:** `@feature10`, `@id:SCEN-capability-non-goals-enforced`
