# Tasks

All tasks are future implementation work. Status `Planned` means not started and does not imply runtime evidence; no current status is changed here. Mutation/authoring work is not a task in this specification.

## TASK-1: Define spec-capability@1 schema and extend document set

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** accepted `spec-kernel:FR-14` for v0.2

**Requirements:** [FR-1](FR.md#fr-1-capability-node-and-document), [FR-7](FR.md#fr-7-determinism-and-identity), [FR-10](FR.md#fr-10-non-goals-enforcement)

**Done When:**
- `spec-capability@1` types define CAPABILITY node kind, CAP-N/CAP-N.M ID grammar, DERIVES_FROM edge type, endpoint matrix, capability attributes, impact response envelope, and conformance finding codes.
- The extension's recognized document set includes CAPABILITIES.md without modifying `spec-kernel@1`.
- Non-goal absence is verified by schema inspection (no ontology, SHACL, SKOS, version, or federation types).
- Schema version bump is reviewed and registered.

## TASK-2: Implement capability parser and declaration field recognition

**Status:** Planned

**Estimate:** 3 days

**Owner:** Kernel maintainer

**Depends On:** TASK-1

**Requirements:** [FR-1](FR.md#fr-1-capability-node-and-document), [FR-2](FR.md#fr-2-derivesfrom-edge-and-declaration-grammar), [FR-7](FR.md#fr-7-determinism-and-identity)

**Done When:**
- `.specs/CAPABILITIES.md` level-2/3 headings produce CAPABILITY definition occurrences with correct nesting.
- `**Capability:** [CAP-N.M]` fields on FR/NFR headings produce DERIVES_FROM reference occurrences.
- `capabilities: [CAP-N]` frontmatter in spec README produces DERIVES_FROM reference occurrences.
- Duplicate CAP IDs fail closed per spec-kernel:FR-4 discipline.
- Equivalent inputs in different orders produce identical output.

## TASK-3: Implement DERIVES_FROM edge resolution and conformance findings

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** TASK-2

**Requirements:** [FR-2](FR.md#fr-2-derivesfrom-edge-and-declaration-grammar), [FR-3](FR.md#fr-3-conformance-findings)

**Done When:**
- DERIVES_FROM edges resolve against the closed endpoint matrix.
- Forbidden endpoints produce unresolved references.
- CAPABILITY_DANGLING (ERROR), CAPABILITY_ORPHAN (WARNING), and SPEC_WITHOUT_CAPABILITY (INFO) diagnostics are emitted with correct severity.
- CAPABILITY_DANGLING sets `graph.valid=false`; WARNING/INFO do not.
- Diagnostic messages include remediation hints.

## TASK-4: Implement requirements_of and capabilities_of queries

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** TASK-3

**Requirements:** [FR-4](FR.md#fr-4-requirements-of-capability-query), [FR-5](FR.md#fr-5-capabilities-of-spec-query)

**Done When:**
- `requirements_of(CAP-N)` returns live non-archived deriving requirements in deterministic order with bounded pagination.
- `capabilities_of(spec-slug)` returns deduplicated declared capabilities in deterministic order.
- Unknown IDs return NOT_FOUND.
- Empty result sets are valid.
- Operations are read-only and pure.

## TASK-5: Implement get_impact query

**Status:** Planned

**Estimate:** 3 days

**Owner:** Kernel maintainer

**Depends On:** TASK-3

**Requirements:** [FR-6](FR.md#fr-6-get-impact-query)

**Done When:**
- `get_impact(nodeId)` returns structural section (ACs, direct scenarios, two-hop scenarios via AC, tasks, code files, dependent FRs, parent capabilities).
- Semantic-recheck list contains impacted scenario and AC IDs.
- Invalidation set contains scenario result identifiers.
- Response envelope carries `schemaVersion: "spec-capability-impact@1"`.
- All lists are deterministically ordered and bounded.
- Operation is read-only and pure; no evidence freshness reimplementation.

## TASK-6: Implement projection parity and release eligibility

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** TASK-4, TASK-5

**Requirements:** [FR-8](FR.md#fr-8-parity-discipline), [FR-9](FR.md#fr-9-release-eligibility-conjunction)

**Done When:**
- Extension and MCP projections map one-to-one onto capability operations with canonical envelopes.
- Release evaluator produces `spec-capability-release@1` with closed conjunction over mandatory checks.
- Missing, extra, duplicate, failed, stale, mismatched records fail closed with deterministic blockers.
- Structural specification text does not satisfy evidence.

## TASK-7: Capture real fixtures and provenance

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel maintainer

**Depends On:** TASK-2, TASK-3

**Requirements:** [FR-1](FR.md#fr-1-capability-node-and-document), [FR-3](FR.md#fr-3-conformance-findings), [FR-7](FR.md#fr-7-determinism-and-identity)

**Done When:**
- Real CAPABILITIES.md fixtures with provenance, hashes, and reviewed ground truth are admitted.
- Fixtures cover nested capabilities, DERIVES_FROM declarations, dangling/orphan/no-capability variants.
- Fixture admission refuses missing provenance fields and mismatched bytes.
