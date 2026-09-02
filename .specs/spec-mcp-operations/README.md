# MCP operations

**Product state:** the read-only v0.3.2 baseline is "SHIPPED"; read-complete, evidence, and safe authoring extensions are "NEXT" or "LATER" according to their domain gates.  
**Scope:** one MCP operations contract with explicit Read and Write domains over one kernel, one evidence evaluator, and one proposal/apply path.  
**Agent-facing authority:** MCP. OMP LSP may be used internally but is not a second public registry.

## Read domain

The Read domain owns the shipped eight-tool compatibility surface, the deterministic kernel, read-complete destination operations, trusted test evidence, and the later get_test_result / get_scenario_trace projections.

## Write domain

The Write domain owns all 24 authoring operations as public MCP tools under v0.6.0: 20 dry-run proposal operations that do not modify disk bytes and return a unified Proposal schema, and 4 transactional apply operations that commit changes atomically under write lock with rollback on failure. The OMP non-MCP access boundary is owned by [MCP access gate](../spec-mcp-access-gate/README.md).

## Operation census

The accepted destination map remains complete: operations 1–22 are Read-domain destinations; operations 23–46 are Write-domain destinations. Only the eight v0.3.2 read names are currently shipped, and only the two write names are public in the future authoring profile. No destination row is silently dropped.

## Shared invariants

One canonical root, one containment model, bounded deterministic envelopes, redacted results, real fixture provenance, and explicit SHIPPED/NEXT/LATER status apply across both domains. The kernel never claims test pass/fail; evidence never creates a second graph; write helpers never create a second writer.

## Documents

- [Requirements](REQUIREMENTS.md)
- [Functional requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Schema](spec-mcp-operations_SCHEMA.md)
- [Design](DESIGN.md)
- [Scenarios](spec-mcp-operations.feature)
- [Tasks](TASKS.md)
- [Real fixture contract](FIXTURES.md)