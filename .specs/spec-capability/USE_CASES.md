# Use Cases

## UC-1: Parse capabilities from the repository-level document

**Actors:** Pure kernel extension parser, graph builder

**Preconditions:** The repository contains `.specs/CAPABILITIES.md` with level-2 `## CAP-N: title` and optional level-3 `### CAP-N.M: title` headings.

**Main flow:**
1. The filesystem adapter discovers `.specs/CAPABILITIES.md` as a canonical capability document.
2. The capability parser extracts level-2 headings as top-level CAPABILITY nodes and level-3 headings as nested CAPABILITY nodes.
3. Each node receives a canonical ID using the repository-level slug convention (`CAP-N` or `CAP-N.M`).
4. Nested capabilities produce DERIVES_FROM edges from child to parent.
5. Duplicate CAP IDs fail closed per `spec-kernel:FR-4` discipline.

**Postconditions:** CAPABILITY nodes and nesting DERIVES_FROM edges exist in the immutable graph snapshot.

**Alternatives:** Malformed headings produce typed diagnostics. Missing `.specs/CAPABILITIES.md` produces zero capability nodes (valid empty set).

**Related:** [FR-1](FR.md#fr-1-capability-node-and-document), [FR-7](FR.md#fr-7-determinism-and-identity)

## UC-2: Declare requirement-to-capability derivation

**Actors:** Specification author, graph builder

**Preconditions:** A spec's FR.md contains `**Capability:** [CAP-N.M]` fields on FR headings; a spec's README.md contains `capabilities: [CAP-N]` frontmatter.

**Main flow:**
1. The Markdown parser recognizes `**Capability:** [CAP-X]` structured fields on FR/NFR headings.
2. The parser recognizes `capabilities: [CAP-X, ...]` in spec README frontmatter.
3. The builder resolves each target against known CAPABILITY nodes.
4. Valid targets produce DERIVES_FROM edges (FR/NFR → CAPABILITY).
5. Unknown targets produce CAPABILITY_DANGLING diagnostics.

**Postconditions:** DERIVES_FROM edges connect requirements to capabilities; broken declarations are diagnosed.

**Alternatives:** Ambiguous capability targets produce AMBIGUOUS_TARGET unresolved references. Unqualified cross-spec references produce UNQUALIFIED_CROSS_SPEC_REFERENCE.

**Related:** [FR-2](FR.md#fr-2-derives-from-edge-and-declaration-grammar), [FR-3](FR.md#fr-3-conformance-findings)

## UC-3: Query live requirements of a capability

**Actors:** OMP user, query service

**Preconditions:** The graph contains CAPABILITY nodes and DERIVES_FROM edges.

**Main flow:**
1. The caller supplies a canonical capability ID.
2. The service validates the ID exists and is a CAPABILITY node.
3. The service traverses incoming DERIVES_FROM edges to find deriving requirements.
4. Results are filtered to live (non-archived) requirements only.
5. Results are returned in deterministic order with bounded pagination.

**Postconditions:** The response contains exactly the live deriving requirements with stable ordering.

**Alternatives:** Unknown capability returns NOT_FOUND. Capability with no deriving requirements returns an empty result set (distinct from CAPABILITY_ORPHAN advisory).

**Related:** [FR-4](FR.md#fr-4-requirements-of-capability-query)

## UC-4: Assess change impact of a requirement modification

**Actors:** OMP agent, query service

**Preconditions:** The graph contains a target node with incident edges.

**Main flow:**
1. The caller supplies a canonical node ID.
2. The service validates the node exists.
3. The service computes structural impact: incoming COVERS (AC/Story/Decision), scenarios direct and via AC two-hop, tasks referencing the node, code files via IMPLEMENTS, dependent FRs via REFS, parent capabilities via DERIVES_FROM.
4. The service computes semantic-recheck list: scenarios and ACs whose meaning may drift.
5. The service computes invalidation set: scenario results that a change to the target would render stale.
6. The response envelope is versioned and deterministic.

**Postconditions:** The caller receives a complete impact assessment without evidence-freshness reimplementation.

**Alternatives:** Unknown node returns NOT_FOUND. Node with no incident edges returns empty sections.

**Related:** [FR-6](FR.md#fr-6-get-impact-query)

## UC-5: Evaluate capability-layer release eligibility

**Actors:** Release evaluator, pure eligibility function

**Preconditions:** Mandatory evidence manifest and evidence documents are supplied.

**Main flow:**
1. The evaluator validates stage/profile pair and candidate version.
2. The evaluator checks every mandatory check record for presence, status, hash validity, and artifact binding.
3. Missing, extra, duplicate, failed, stale, mismatched, or unbound records produce deterministic blockers.
4. All-not-any conjunction determines eligibility.

**Postconditions:** Eligibility is true only when every mandatory check passes with valid evidence.

**Alternatives:** Unknown stage/profile fails closed. Structural specification text does not satisfy evidence.

**Related:** [FR-9](FR.md#fr-9-release-eligibility-conjunction)
