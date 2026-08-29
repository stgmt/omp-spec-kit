# Changelog


## Unreleased

- Closed binding provenance with hash-verified canonical sidecars, defined canonical evaluation/release fingerprint formulas, and made ambiguous-result/trace cursors consumable and fingerprint-bound.
- Reconciled every ingestion state/reason across FR, schema, checks and tasks.

- Replaced the unimplementable @1 draft with `spec-evidence@2`: content-hash freshness, split authored/producer conservation, constructible artifact absence/skip/unknown variants, complete result/trace records, byte/count limits, exact FR-1..FR-14 release records and MCP projections. No runtime delivery is claimed.

## 2026-08-23 — Specification init

- Created the `spec-evidence` specification: 13 functional requirements, 13 acceptance criteria, 13 scenarios, 13 contract checks, 10 planned tasks.
- Scope: evidence and honesty evaluation layer; pure function of kernel graph + immutable execution-artifact bytes + limits producing ingestion state, scenario-result joins, freshness/staleness verdicts, fail-closed task status truth, waiver honesty, coverage census with conservation equations, and release-eligibility contributions.
- Upstream dispositions: FR-32 (REWRITE), FR-56 (ADOPT), FR-35 (ADOPT), FR-9 (ADOPT), FR-31 (ADOPT), FR-46 (ADOPT), FR-50 (ADOPT) from MIGRATION_MATRIX.md.
- Research grounded in spec-kernel graph contract and upstream spec-generator-v4 provenance; no upstream byte imported without manifest/hash/license decision.
- Release boundary: SPEC_ONLY; belongs to a stage after kernel v0.2, requires explicit release-stage decision in ROADMAP.md, SHALL NOT loosen product:FR-6 cumulative gate.
- Current traceability is 14 FR / 14 AC / 14 scenarios / 14 CHKs / 11 planned tasks.
