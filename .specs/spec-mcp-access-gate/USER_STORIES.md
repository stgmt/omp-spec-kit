# User Stories

## US-1: Spec owner protected from direct writes

**Priority:** Must

As a spec owner, I want direct mutation of `.specs` blocked while the two proposal-first authoring operations remain available, so reviewed atomic changes are the only mutation route.

**Why:** A raw write can bypass proposal review and atomic application.

**Independent Test:** Call both exact allowlisted names, near-miss names, a direct mutator against `.specs`, and a direct mutator against a non-spec path; only exact authoring calls and proven non-spec writes pass.

**Acceptance Scenarios:** `@feature2`, `@feature4`

## US-2: User receiving an actionable block

**Priority:** Must

As an OMP user, I want an unsafe or unresolved target blocked with one short repository-relative reason, so I know which path was refused and which two operations to use instead.

**Why:** Absolute paths and raw filesystem errors are noisy and may disclose workstation details.

**Independent Test:** Exercise spec, unresolved, symlink, reparse, and new-target cases and compare the bounded result with reviewed ground truth.

**Acceptance Scenarios:** `@feature3`, `@feature5`

## US-3: Maintainer shipping one extension

**Priority:** Must

As a maintainer, I want the policy registered only on `tool_call` in the existing extension factory and bundled without ambient dependencies, so the installed artifact has one reachable enforcement path.

**Why:** A second factory or background component is needless and can drift from the product entrypoint.

**Independent Test:** Load the installed artifact without the source checkout or root `node_modules`; observe one handler registration and the same path decisions as source fixtures.

**Acceptance Scenarios:** `@feature1`, `@feature6`

## US-4: Operator with no hidden state

**Priority:** Must

As an operator, I want each decision derived from the current call and filesystem only, so enforcement leaves no logs, counters, caches, or private state.

**Why:** Hidden state is unnecessary for a pre-execution path decision.

**Independent Test:** Run repeated calls and verify byte-identical decisions and no created files, network access, subprocesses, or credential reads.

**Acceptance Scenarios:** `@feature5`

## US-5: Read specifications only through MCP

As a product owner, I want agent reads and writes of canonical specifications to pass only through MCP so that the MCP server remains the single auditable authority.

**Priority:** Must

**Why:** A registered MCP authority provides the only auditable specification-access boundary.

**Independent Test:** Replay registered-authority, same-name non-MCP, unknown-target, special-path, empty-target, and proven-outside calls and compare decisions with the closed matrix.

**Acceptance Scenarios:** @feature7, SCEN-mcp-access-gate-non-mcp-spec-access