# Planned File Changes

Every path below is a concrete future path and every action is **planned**, not present or implemented. All runtime code stays inside the repository's single `plugins/omp-spec-kit` child package. No second plugin or marketplace entry is introduced.

## FC-1: Capability schema and types

**Action:** create (planned)

**Requirements:** [FR-1](FR.md#fr-1-capability-node-and-document), [FR-7](FR.md#fr-7-determinism-and-identity), [FR-10](FR.md#fr-10-non-goals-enforcement)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/extensions/capability/types.ts` | Closed `spec-capability@1` types: CAPABILITY node kind, CAP-N/CAP-N.M grammar, DERIVES_FROM edge type, endpoint matrix, capability attributes, impact response envelope, conformance finding codes |
| `plugins/omp-spec-kit/src/kernel/extensions/capability/schema.ts` | Schema registration and version binding against `spec-kernel@1` |

## FC-2: Capability parser

**Action:** create (planned)

**Requirements:** [FR-1](FR.md#fr-1-capability-node-and-document), [FR-2](FR.md#fr-2-derives-from-edge-and-declaration-grammar)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/parsers/capability.ts` | CAPABILITIES.md level-2/3 heading parsing, CAP-N/CAP-N.M validation, nesting extraction |
| `plugins/omp-spec-kit/src/kernel/parsers/capability-field.ts` | `**Capability:** [CAP-N.M]` field recognition on FR/NFR headings and `capabilities:` frontmatter parsing |

## FC-3: Capability graph extension

**Action:** edit (planned)

**Requirements:** [FR-2](FR.md#fr-2-derives-from-edge-and-declaration-grammar), [FR-3](FR.md#fr-3-conformance-findings)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/graph/build.ts` | Extend to resolve DERIVES_FROM edges and build capability backlink indexes |
| `plugins/omp-spec-kit/src/kernel/graph/invariants.ts` | Extend to evaluate CAPABILITY_DANGLING, CAPABILITY_ORPHAN, SPEC_WITHOUT_CAPABILITY findings |

## FC-4: Capability query operations

**Action:** create (planned)

**Requirements:** [FR-4](FR.md#fr-4-requirements-of-capability-query), [FR-5](FR.md#fr-5-capabilities-of-spec-query), [FR-6](FR.md#fr-6-get-impact-query)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/query/capability-queries.ts` | `requirements_of` and `capabilities_of` operations with deterministic ordering and bounded pagination |
| `plugins/omp-spec-kit/src/kernel/query/impact.ts` | `get_impact` operation with structural, semantic_recheck, and invalidates sections; versioned response envelope |

## FC-5: Projection adapters

**Action:** edit (planned)

**Requirements:** [FR-8](FR.md#fr-8-parity-discipline)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/adapters/omp/register-spec-tools.ts` | Register capability query tools projecting canonical envelopes |
| `plugins/omp-spec-kit/src/adapters/mcp/server.ts` | Register capability MCP tools with one-to-one mapping |

## FC-6: Release eligibility

**Action:** create (planned)

**Requirements:** [FR-9](FR.md#fr-9-release-eligibility-conjunction)

| Planned path | Responsibility |
|---|---|
| `plugins/omp-spec-kit/src/kernel/release/capability-eligibility.ts` | `spec-capability-release@1` evaluator with closed conjunction over mandatory checks |
