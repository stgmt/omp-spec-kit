# Roadmap: Roadmap Specs

> **Profile: roadmap** — human-facing convention; the kernel identifies this
> spec by the `roadmap-` slug prefix.

This roadmap tracks the implementation of canonical ROADMAP.md support and
governed auto-assembly for roadmap specs.

## Authored narrative

The roadmap spec itself is the first consumer of the canonical ROADMAP.md
document kind. The generated region below is assembled from the graph
entities of the scope implied by this spec's own `Implements:` and `Refs:`
links — no explicit `Covers:` declaration is needed.

## Auto-assembled items

<!-- roadmap:auto:start -->
### roadmap-roadmaps
- [done] FR-1 — Roadmap kernel type (FR)
- [done] FR-2 — Roadmap-to-feature tracing (FR)
- [done] FR-3 — Roadmap lifecycle (FR)
- [done] FR-4 — Roadmap visualization (FR)
- [in progress] FR-5 — Canonical roadmap document (FR)
- [in progress] FR-6 — Scope-derived deterministic assembly (FR)
- [in progress] FR-7 — Derived requirement status (FR)
- [in progress] FR-8 — Non-destructive re-assembly (FR)
- [in progress] FR-9 — Governed roadmap lifecycle via spec_patch (FR)

### spec-mcp-operations
- [planned] FR-1 — Pure occurrence-first core (FR)
- [planned] FR-10 — Supported execution artifacts (FR)
- [planned] FR-11 — Trusted-capture run envelope (FR)
- [planned] FR-12 — Scenario result join (FR)
- [planned] FR-13 — Full-run scope authority (FR)
- [planned] FR-14 — Freshness and staleness (FR)
- [planned] FR-15 — Fail-closed status truth (FR)
- [planned] FR-16 — Waiver honesty (FR)
- [planned] FR-17 — Internal row accounting (FR)
- [planned] FR-18 — Anti-false-green invariants (FR)
- [planned] FR-19 — Real fixtures per read-core discipline (FR)
- [done] FR-2 — Canonical documents and qualified IDs (FR)
- [planned] FR-20 — Budgets (FR)
- [planned] FR-21 — Release-eligibility contribution (FR)
- [planned] FR-22 — MCP projection of get_test_result and get_scenario_trace (FR)
- [planned] FR-23 — Single-tool public boundary (FR)
- [planned] FR-24 — Pure deterministic proposal (FR)
- [planned] FR-25 — Containment, anchors, and resulting-spec validation (FR)
- [planned] FR-26 — Exact-proposal apply with CAS and revalidation (FR)
- [planned] FR-27 — Atomic one-spec commit and internal rollback (FR)
- [planned] FR-28 — Byte conservation and compact redacted outcomes (FR)
- [planned] FR-29 — Real correctness evidence (FR)
- [planned] FR-3 — Typed graph conservation (FR)
- [planned] FR-30 — MCP discovery metadata and handshake (FR)
- [planned] FR-31 — Declared result envelope and actionable recovery (FR)
- [planned] FR-32 — Discriminated branch schemas and strict argument validation (FR)
- [done] FR-33 — Domain type dictionary catalog (FR)
- [planned] FR-34 — Surface blast limits and fail-closed measurement (FR)
- [planned] FR-35 — Hard tool retirement without backward-compatibility shims (FR)
- [planned] FR-36 — Deterministic mutation testing gate (FR)
- [planned] FR-37 — Unified specification and corpus validation inspection (FR)
- [planned] FR-38 — Read-for-edit and optional root binding (FR)
- [done] FR-39 — Spec graph board view (FR)
- [done] FR-4 — Four bounded core primitives (FR)
- [planned] FR-5 — Contained inputs and budgets (FR)
- [planned] FR-6 — Historical eight-name compatibility (FR)
- [planned] FR-7 — Deterministic diagnostics and fingerprint (FR)
- [planned] FR-8 — Real fixtures and measurable budgets (FR)
- [planned] FR-9 — Pure evaluation boundary (FR)
- [in progress] UC-1 — Build one deterministic graph (UC)
- [planned] UC-10 — Apply the exact proposal (UC)
- [planned] UC-11 — Resolve a concurrent edit (UC)
- [planned] UC-12 — Reject an escaping or raw write (UC)
- [planned] UC-13 — Rename a heading safely (UC)
- [planned] UC-14 — Survive a writer fault (UC)
- [planned] UC-15 — Stop at unrecoverable storage (UC)
- [planned] UC-16 — Read a complete board projection (UC)
- [planned] UC-17 — Keep tracker semantics downstream (UC)
- [in progress] UC-2 — Query through four primitives (UC)
- [planned] UC-3 — Reject an unsafe source snapshot (UC)
- [planned] UC-4 — Review real evidence (UC)
- [planned] UC-5 — Evaluate task evidence (UC)
- [planned] UC-6 — Diagnose stale or partial evidence (UC)
- [planned] UC-7 — Capture a real run (UC)
- [planned] UC-8 — Contribute to product readiness (UC)
- [planned] UC-9 — Propose one traced change (UC)
- [planned] US-1 — Maintainer graph (US)
- [planned] US-10 — Review exact changes before mutation (US)
- [planned] US-11 — Reject stale edits (US)
- [planned] US-12 — Commit related documents together (US)
- [planned] US-13 — Contain the write boundary (US)
- [planned] US-14 — Preserve anchors and bytes (US)
- [planned] US-15 — Receive a useful private receipt (US)
- [planned] US-16 — Recover without another public repair API (US)
- [planned] US-18 — Consume one complete board projection (US)
- [planned] US-19 — Understand tool branches (US)
- [planned] US-2 — Safe bounded reader (US)
- [planned] US-3 — Honest graph consumer (US)
- [planned] US-4 — Compatibility user (US)
- [planned] US-5 — Evidence reviewer (US)
- [planned] US-6 — Release owner who trusts evidence (US)
- [planned] US-7 — Engineer diagnosing evidence (US)
- [planned] US-8 — Author whose waiver stays open (US)
- [planned] US-9 — Multi-runner team (US)
<!-- roadmap:auto:end -->

## Notes

Reassembly merges by canonical ID and never touches authored bytes outside
the `roadmap:auto` markers. When the graph is unchanged, the generated
region is byte-for-byte identical (idempotent).
