# User Stories

## US-1: Portable maintainer-facing graph

**Priority:** Must

As an `omp-spec-kit` maintainer, I want a pure graph kernel that consumes explicit bytes and produces deterministic values, so that OMP and MCP adapters cannot fork product semantics.

**Why:** The upstream server mixed graph logic with watcher, persistence, hooks, repair, and other harness concerns. The standalone product needs a small, reviewable boundary.

**Independent Test:** Feed the same normalized source set in different input orders and compare serialized graph snapshots byte-for-byte.

**Acceptance Scenarios:** `@feature1`, `@feature3`

## US-2: Safe repository reader

**Priority:** Must

As a repository owner, I want inventory and graph queries to stay inside my selected repository and reject links or paths that escape it, so that a read-only operation cannot inspect unrelated files.

**Why:** “Read-only” is insufficient if path traversal, junctions, or unbounded discovery can expose host data.

**Independent Test:** Exercise normal contained files plus parent traversal, absolute external paths, symlinks, Windows junctions/reparse points, and an over-budget corpus.

**Acceptance Scenarios:** `@feature7`

## US-3: Honest specification consumer

**Priority:** Must

As a specification author, I want duplicates, broken references, malformed documents, and ambiguous targets reported without dropping source occurrences, so that a plausible graph cannot hide input loss.

**Why:** Last-writer-wins maps and silent parser recovery create false readiness.

**Independent Test:** Parse a captured corpus with planted duplicate and broken reference variants and verify candidate/reference conservation.

**Acceptance Scenarios:** `@feature4`, `@feature5`, `@feature6`

## US-4: Bounded query user

**Priority:** Must

As an OMP user, I want inventory, node, edge, trace, overview, diagnostics, and complete Markdown heading/link queries with stable pagination and explicit errors, so that large or malformed repositories and rename planning remain usable without writes.

**Why:** The first graph release must provide useful, predictable reads rather than copying the upstream mixed registry.

**Independent Test:** Call every operation at boundary limits, enumerate an ordinary heading’s complete inbound/outbound link set, and compare the extension and MCP envelopes after removing transport metadata.

**Acceptance Scenarios:** `@feature8`, `@feature9`, `@feature13`

## US-5: Release owner

**Priority:** Must

As a release owner, I want a self-contained installed artifact with measured size/performance budgets and one conjunctive evidence gate, so that the kernel cannot release with an ambient dependency or any missing mandatory requirement proof.

**Why:** Marketplace installation only proves distribution when the child plugin can load by itself.

**Independent Test:** Run the built v0.2 child artifact with external dependencies hidden, execute the benchmark corpus and one query, and prove its complete FR-1..FR-8 plus FR-10..FR-13 profile passes without MCP evidence and fails if any required record is removed or FR-9 is added. Then prove v0.3 cannot pass without the same-lineage accepted v0.2 input, FR-9 parity/registry evidence, and fresh MCP-inclusive package/budget records.

**Acceptance Scenarios:** `@feature10`, `@feature12`, `@feature14`

## US-6: Fixture reviewer

**Priority:** Must

As a reviewer, I want real fixture bytes tied to a producer/source, immutable hash, license disposition, and declared ground truth, so that parser tests do not validate invented input shapes.

**Why:** The pinned upstream fixture inventory is evidence of prior shapes, but the new repository must recapture target-owned fixtures and must not claim upstream test parity.

**Independent Test:** Recompute every fixture hash, verify provenance fields, and reconcile expected occurrence counts against the parser result.

**Acceptance Scenarios:** `@feature11`

## US-7: Spec corpus integrator

**Priority:** Should

As a maintainer of multiple specs, I want local IDs to remain readable while runtime identity is spec-qualified, so that `FR-1` in two specs never collides and cross-spec references remain explicit.

**Why:** Composite identity is required for lossless corpus-wide graphs.

**Independent Test:** Parse two specs that each define `FR-1`, then resolve a local reference and a qualified cross-spec reference.

**Acceptance Scenarios:** `@feature2`, `@feature3`
