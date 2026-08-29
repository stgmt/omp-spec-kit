# User Stories

## US-1: Product meaning owned by each specification

**Priority:** Must

As a maintainer, I want each behavior-owning spec to define qualified capability nodes in its own optional `CAPABILITIES.md`, so product meaning survives restructuring without a repository singleton or bare ID.

**Why:** Typed owning-spec anchors preserve meaning while keeping identity/authority local and collision-safe.

**Independent Test:** Parse `.specs/product/CAPABILITIES.md` with `product:CAP-1`/child nodes and qualified `**Covers:**` fields; verify CAPABILITY nodes and permitted DERIVES_FROM edges, while root singleton/frontmatter/bare forms reject.

**Acceptance Scenarios:** `@feature1`, `@feature2`

## US-2: Capability conformance consumer

**Priority:** Must

As a specification author, I want dangling capability declarations and orphan capabilities reported as typed diagnostics, so that broken links between requirements and capabilities fail closed and empty capabilities surface as advisory archival mirrors.

**Why:** Silent acceptance of broken capability references creates false readiness. Orphan capabilities signal product meaning that has lost all live requirements — the archival mirror of upstream FR-45 proof-gated archival.

**Independent Test:** Plant `**Covers:** [product:CAP-99](...)` and verify `CAPABILITY_DANGLING`; remove all deriving requirements and verify `CAPABILITY_ORPHAN`; a spec lacking its owning capability document receives the bounded advisory hint.

**Acceptance Scenarios:** `@feature3`

## US-3: Change-impact analyst

**Priority:** Must

As an OMP user, I want graph-only `get_impact` plus a separately invoked evidence overlay, so I can distinguish structural dependents from stale result records without reimplementing freshness.

**Why:** Graph impact is computable without evidence; producer invalidation requires the evidence snapshot and current kernel bindings.

**Independent Test:** Call graph impact on a requirement and assert typed structural/semantic IDs with no producer IDs; then call `invalidate_evidence` with complete current/evidence bindings and assert stale/unaffected/indeterminate partitions.

**Acceptance Scenarios:** `@feature6`

## US-4: Derivation query user

**Priority:** Must

As an OMP user, I want to query which live requirements derive from a capability and which capabilities a spec declares, so that navigation is grouped by product meaning rather than flat spec slug lists.

**Why:** Flat spec lists give agents no semantic entry point. Derivation queries enable capability-first navigation and spec-to-capability mapping.

**Independent Test:** Call `requirements_of(product:CAP-1)` and verify bounded deterministic requirement summaries. Call `capabilities_of(product)` with lifecycle filters and verify declarations from the owning CAPABILITIES document; no frontmatter/bare ID is consulted.

**Acceptance Scenarios:** `@feature4`, `@feature5`

## US-5: Kernel-extension parity reviewer

**Priority:** Must

As a release owner, I want graph and optional evidence-overlay operations exposed only through MCP and mapped one-to-one, so no second agent surface forks behavior.

**Why:** The single projection follows `spec-kernel:FR-9`, `spec-kernel:FR-14`, and `spec-kernel:CHK-FR9-01`; OMP/LSP capability tools are forbidden.

**Independent Test:** Verify graph profile exposes exactly three MCP names, overlay profile adds `invalidate_evidence`, canonical envelopes survive transport stripping, and no capability `pi.registerTool`/agent LSP surface exists.

**Acceptance Scenarios:** `@feature8`

## US-6: Release gate evaluator

**Priority:** Must

As a release owner, I want capability-layer release eligibility to be a closed conjunction over mandatory evidence records, so that partial or mismatched evidence fails closed with deterministic blockers.

**Why:** The kernel's conjunctive release gate (`spec-kernel:FR-14`) is the house standard. This spec plugs into that pattern with its own check set.

**Independent Test:** Evaluate graph and overlay manifests with real evidence bytes, all profile FR/NFR checks and baseline bindings; every missing/extra/duplicate/failed/stale/wrong-profile/unbound variant returns the exact closed blocker.

**Acceptance Scenarios:** `@feature9`
