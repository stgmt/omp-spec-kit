# Changelog


## Unreleased

- Added FR-14 / AC-14.1 / CHK-FR14-01: MCP projection of read-only `get_test_result` and `get_scenario_trace` from evaluator output. The evaluator stays pure (FR-1; no MCP calls inside). This is not a v0.2/v0.3 kernel required check and is absent from the v0.3 first-slice read registry. `spec-kernel:FR-6` remains forbidden from pass/fail claims. `spec-lsp` hover still must not invent run results before this FR.

## 2026-08-23 — Specification init

- Created the `spec-evidence` specification: 13 functional requirements, 13 acceptance criteria, 13 scenarios, 13 contract checks, 10 planned tasks.
- Scope: evidence and honesty evaluation layer; pure function of kernel graph + immutable execution-artifact bytes + limits producing ingestion state, scenario-result joins, freshness/staleness verdicts, fail-closed task status truth, waiver honesty, coverage census with conservation equations, and release-eligibility contributions.
- Upstream dispositions: FR-32 (REWRITE), FR-56 (ADOPT), FR-35 (ADOPT), FR-9 (ADOPT), FR-31 (ADOPT), FR-46 (ADOPT), FR-50 (ADOPT) from MIGRATION_MATRIX.md.
- Research grounded in spec-kernel graph contract and upstream spec-generator-v4 provenance; no upstream byte imported without manifest/hash/license decision.
- Release boundary: SPEC_ONLY; belongs to a stage after kernel v0.2, requires explicit release-stage decision in ROADMAP.md, SHALL NOT loosen product:FR-6 cumulative gate.
