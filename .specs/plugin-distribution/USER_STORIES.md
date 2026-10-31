# User Stories

## US-1 — Install the intended plugin

As a user, I want the omp-spec-kit catalog entry to install from its contained child, so that unrelated repository packages cannot change what I receive.

**Priority:** Must

**Why:** Child containment prevents unrelated package bytes from entering the installed product.

**Independent Test:** Build the tagged candidate and verify catalog selection, child containment, and package-tree identity.

**Acceptance Scenarios:** @feature1, @feature2

**Requirements:** [FR-1](FR.md#fr-1-target-plugin-identity-and-containment), [FR-2](FR.md#fr-2-deterministic-child-payload)


## US-2 — Invoke installed bytes

As a user, I want a fresh session to invoke the installed candidate without the checkout or ambient dependencies, so that a green build is not mistaken for a usable release.

**Priority:** Must

**Why:** Runtime proof must exercise the shipped bytes rather than a source checkout.

**Independent Test:** Invoke the installed artifact from a foreign working directory with no source checkout or ambient node_modules.

**Acceptance Scenarios:** @feature3, @feature4, @feature5, @feature6

**Requirements:** [FR-3](FR.md#fr-3-installed-canonical-invocation), [FR-4](FR.md#fr-4-fresh-session-activation), [FR-5](FR.md#fr-5-dependency-absent-execution), [FR-6](FR.md#fr-6-installed-containment-and-read-only-smoke)


## US-3 — Recover safely

As a user, I want uninstall/reinstall plus upgrade/rollback to preserve my project, so that a bad release is reversible.

**Priority:** Must

**Why:** Lifecycle recovery must not damage the project or leave stale activation state.

**Independent Test:** Execute install, fresh-session uninstall, reinstall, upgrade, and rollback and compare project hashes.

**Acceptance Scenarios:** @feature7, @feature8

**Requirements:** [FR-7](FR.md#fr-7-version-consistency-and-upgrade), [FR-8](FR.md#fr-8-uninstall-reinstall-and-rollback)


## US-4 — Trust the published archive

As a release consumer, I want the public archive to be the exact verified build with a GitHub Artifact Attestation, so that publication cannot substitute new bytes.

**Priority:** Must

**Why:** Publication is trustworthy only when identity, digest, and attestation remain bound to one candidate.

**Independent Test:** Reconcile the candidate, archive, publication record, and attestation digests and reject any mismatch.

**Acceptance Scenarios:** @feature9, @feature10

**Requirements:** [FR-9](FR.md#fr-9-public-safety-gates), [FR-10](FR.md#fr-10-build-once-publish-the-same-digest-attest-once)


## US-5 — Understand status

As a maintainer, I want one compact distribution record, so that I can distinguish SHIPPED release evidence from NEXT design without reading per-requirement receipts.

**Priority:** Must

**Why:** A single status decision prevents stale or partial evidence from becoming a public release claim.

**Independent Test:** Evaluate the status record with missing, stale, partial, and complete evidence and compare the result with the documented gate.

**Acceptance Scenarios:** @feature11, @feature12, @feature13

**Requirements:** [FR-11](FR.md#fr-11-distribution-owned-release-status), [FR-12](FR.md#fr-12-compact-release-decision), [FR-13](FR.md#fr-13-practical-distribution-release-path)

