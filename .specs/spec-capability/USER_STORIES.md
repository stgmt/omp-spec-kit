# User Stories

## US-1: Product-meaning anchor above specs

**Priority:** Must

As a specification maintainer, I want stable product-wording capability nodes that outlive individual specs, so that when a spec is absorbed, archived, or restructured the product meaning survives as a typed graph anchor rather than a human-readable marker.

**Why:** Upstream dogfood shows that ABSORBED specs lose requirement destinations because absorption targets are prose, not graph edges. New agents face flat spec lists with no semantic grouping. Capabilities provide the missing product-level anchor.

**Independent Test:** Parse a corpus with capabilities declared in `.specs/CAPABILITIES.md`, derive requirements via `**Capability:**` fields and spec-level frontmatter, then verify CAPABILITY nodes and DERIVES_FROM edges exist in the graph with correct endpoints.

**Acceptance Scenarios:** `@feature1`, `@feature2`

## US-2: Capability conformance consumer

**Priority:** Must

As a specification author, I want dangling capability declarations and orphan capabilities reported as typed diagnostics, so that broken links between requirements and capabilities fail closed and empty capabilities surface as advisory archival mirrors.

**Why:** Silent acceptance of broken capability references creates false readiness. Orphan capabilities signal product meaning that has lost all live requirements — the archival mirror of upstream FR-45 proof-gated archival.

**Independent Test:** Plant a `**Capability:** [CAP-99]` referencing a nonexistent ID and verify `CAPABILITY_DANGLING`. Remove all deriving requirements from a capability and verify `CAPABILITY_ORPHAN`. Verify specs without capability declarations produce an advisory hint, not an error.

**Acceptance Scenarios:** `@feature3`

## US-3: Change-impact analyst

**Priority:** Must

As an OMP user or agent, I want a read-only impact query that returns structural dependents, semantic-recheck candidates, and invalidation sets for any node, so that I can assess what breaks or goes stale when a requirement changes without reimplementing evidence freshness logic.

**Why:** The kernel's `trace` provides one-hop star queries but does not traverse AC→scenario two-hop paths, enumerate backlink-driven structural impact, or define an invalidation contract. Agents need a bounded, deterministic impact envelope.

**Independent Test:** Call `get_impact` on an FR node with known ACs, scenarios (direct and via AC), tasks, code files, dependent FRs, and parent capabilities; verify the response envelope contains all three sections with deterministic ordering.

**Acceptance Scenarios:** `@feature6`

## US-4: Derivation query user

**Priority:** Must

As an OMP user, I want to query which live requirements derive from a capability and which capabilities a spec declares, so that navigation is grouped by product meaning rather than flat spec slug lists.

**Why:** Flat spec lists give agents no semantic entry point. Derivation queries enable capability-first navigation and spec-to-capability mapping.

**Independent Test:** Call `requirements_of(CAP-N)` and verify deterministic ordering, bounded results, and exclusion of archived/non-live requirements. Call `capabilities_of(spec-slug)` and verify declared capabilities match frontmatter and field declarations.

**Acceptance Scenarios:** `@feature4`, `@feature5`

## US-5: Kernel-extension parity reviewer

**Priority:** Must

As a release owner, I want every future projection (extension, MCP, LSP) that exposes capability or impact data to map one-to-one onto this spec's operations with no added semantics, so that no projection forks product behavior.

**Why:** The kernel enforces parity between extension and MCP adapters via `spec-kernel:FR-9` / `FR-14` CHK-FR9-01. This spec extends that discipline to its own operations.

**Independent Test:** Compare structured responses from extension and MCP projections of `requirements_of`, `capabilities_of`, and `get_impact` after removing transport metadata; verify byte-identical canonical envelopes.

**Acceptance Scenarios:** `@feature8`

## US-6: Release gate evaluator

**Priority:** Must

As a release owner, I want capability-layer release eligibility to be a closed conjunction over mandatory evidence records, so that partial or mismatched evidence fails closed with deterministic blockers.

**Why:** The kernel's conjunctive release gate (`spec-kernel:FR-14`) is the house standard. This spec plugs into that pattern with its own check set.

**Independent Test:** Submit eligibility evaluations with missing, extra, duplicate, failed, stale, and wrong-profile records; verify each produces a deterministic blocker.

**Acceptance Scenarios:** `@feature9`
