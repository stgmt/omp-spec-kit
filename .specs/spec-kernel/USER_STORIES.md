# User Stories

## US-1: Maintainer graph

**Priority:** Must

As an `omp-spec-kit` maintainer, I want one pure occurrence-first graph core, so that host adapters cannot fork graph semantics.

**Independent Test:** Permute the same normalized source values and compare canonical graph bytes.

**Acceptance Scenarios:** `@feature1`, `@feature3`, `@feature7`

## US-2: Safe bounded reader

**Priority:** Must

As a repository owner, I want one explicit root, link rejection, cancellation, and hard limits, so that reads cannot escape or exhaust the host.

**Independent Test:** Exercise contained, traversal, link, and over-budget inputs.

**Acceptance Scenarios:** `@feature5`

## US-3: Honest graph consumer

**Priority:** Must

As a specification author, I want duplicates and broken references preserved as explicit outcomes, so that graph validity cannot hide input loss.

**Independent Test:** Plant duplicate, missing, ambiguous, and forbidden references.

**Acceptance Scenarios:** `@feature2`, `@feature3`, `@feature4`

## US-4: Compatibility user

**Priority:** Must

As an OMP/MCP user, I want the shipped eight names to project one bounded result, so that the runtime remains compatible while the core is simplified.

**Independent Test:** Compare adapter results after removing transport metadata.

**Acceptance Scenarios:** `@feature6`

## US-5: Evidence reviewer

**Priority:** Must

As a reviewer, I want real hashes, independent oracles, and measurable budgets, so that structural validity is not mistaken for release evidence.

**Independent Test:** Recompute fixture hashes and inspect retained receipt-bound measurements.

**Acceptance Scenarios:** `@feature8`
