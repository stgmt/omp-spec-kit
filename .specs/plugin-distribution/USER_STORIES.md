# User Stories

## US-1 — Install one product

**Priority:** Must

**Story:** As an OMP user, I want one marketplace identity and one plugin identity so that installation has no component-selection ambiguity.

**Why:** Multiple catalogs or extension control planes would make activation and support outcomes inconsistent.

**Independent Test:** Inspect the catalog and child manifest, then plant a duplicate in each and observe deterministic rejection.

**Acceptance Scenarios:** `@feature1`, `@feature2`

## US-2 — Receive first value after a clean install

**Priority:** Must

**Story:** As a specification author, I want to inventory `.specs` from a fresh OMP session so that I can see bounded repository diagnostics without changing my work.

**Why:** Installation is not useful proof unless the installed extension exposes a real capability.

**Independent Test:** Install project-scope in an isolated project, reload plugin metadata, start a fresh session, invoke `spec_inventory`, and compare project hashes before and after.

**Acceptance Scenarios:** `@feature3`, `@feature4`, `@feature6`

## US-3 — Install without a source checkout

**Priority:** Must

**Story:** As an OMP user, I want the installed package to run from `dist/` without repository-root dependencies so that the marketplace payload is portable.

**Why:** A developer checkout can hide missing bundle inputs and undeclared dependencies.

**Independent Test:** Build from clean sources, install the packaged child directory, make repository-root `node_modules` unavailable, and invoke the tool from a fresh session.

**Acceptance Scenarios:** `@feature5`

## US-4 — Change or remove versions safely

**Priority:** Must

**Story:** As an operator, I want explicit uninstall/reinstall procedures for the first release and upgrade/rollback procedures once a prior release exists so that a bad installation can be recovered without changing `.specs`.

**Why:** Marketplace catalog refresh and plugin activation are separate lifecycle steps, and the first release cannot truthfully depend on nonexistent version history.

**Independent Test:** For `0.1.0`, exercise install, fresh-session invocation, uninstall, fresh-session absence, exact-artifact reinstall, reinvocation, and hash preservation; for the first subsequent release, additionally exercise real prior-version upgrade and rollback.

**Acceptance Scenarios:** `@feature7`, `@feature8`

## US-5 — Publish only proven releases

**Priority:** Must

**Story:** As a release owner, I want provenance, secret, package, lifecycle, version, and aggregate evidence gates in GitHub Actions so that a tag or partial green stage cannot launder an unproven artifact into a release claim.

**Why:** Public metadata is durable and must describe delivered behavior only.

**Independent Test:** Attempt release with a provenance mismatch, planted secret, cardinality violation, version mismatch, one missing FR receipt, a stage-summary-only input, and then a complete candidate-aware FR-1..FR-12 evidence set.

**Acceptance Scenarios:** `@feature9`, `@feature10`, `@feature11`, `@feature13`

## US-6 — Fail boundedly

**Priority:** Must

**Story:** As an OMP user, I want absent, malformed, excessive, and out-of-root inputs to return bounded diagnostics so that inventory cannot mutate or escape my project.

**Why:** Read-only does not imply safe if traversal or output is unbounded.

**Independent Test:** Drive absent `.specs`, malformed documents, symlink escape, excess entries, and explicit bounds while tracking reads, writes, result size, and session continuity.

**Acceptance Scenarios:** `@feature3`, `@feature6`, `@feature12`
