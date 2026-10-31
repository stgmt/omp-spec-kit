# MCP operations

**Product state:** the read-only v0.3.2 baseline is "SHIPPED"; read-complete, evidence, and safe authoring extensions are "NEXT" or "LATER" according to their domain gates.  
**Scope:** one MCP operations contract with explicit Read and Write domains over one kernel, one evidence evaluator, and one proposal/apply path.  
**Agent-facing authority:** MCP. OMP LSP may be used internally but is not a second public registry.

## Read domain

The Read domain owns the consolidated ten-tool public surface, the deterministic kernel, read-complete destination operations, trusted test evidence, and the later get_test_result / get_scenario_trace projections.

## Write domain

The Write domain owns one public authoring tool, `spec_patch`, covering 15 authoring intents behind one proposal/apply path: preview is a pure in-memory Proposal, apply is transactional under an exclusive lock with internal rollback on failure (FR-23, FR-26, FR-27). The OMP non-MCP access boundary is owned by [MCP access gate](../spec-mcp-access-gate/README.md).

## Operation census

The public surface is exactly ten tools (FR-30); the v0.3.2 eight read names remain the shipped baseline; `spec_patch` is the single public authoring tool (FR-23) and superseded names are retired without shims (FR-35). No destination row is silently dropped.

## Shared invariants

One canonical root, one containment model, bounded deterministic envelopes, redacted results, real fixture provenance, and explicit SHIPPED/NEXT/LATER status apply across both domains. The kernel never claims test pass/fail; evidence never creates a second graph; write helpers never create a second writer.

## Documents

- [Requirements](REQUIREMENTS.md)
- [Functional requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Schema](spec-mcp-operations_SCHEMA.md)
- [Design](DESIGN.md)
- Scenarios: spec-mcp-operations.feature
- [Tasks](TASKS.md)
- [Real fixture contract](FIXTURES.md)

## Board projection contract

spec_graph view board is the single complete read for the YouTrack adapter. It returns BoardProjectionV1 for the full corpus or specSlugs scope, includes bounded card-source fields and aggregated raw kernel edges, rejects limit and cursor, and returns RESPONSE_TOO_LARGE instead of truncation. The downstream adapter owns YouTrack link names and snapshot commit.
