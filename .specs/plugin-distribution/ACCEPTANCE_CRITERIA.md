# Acceptance Criteria

These criteria define observable release behavior; prose and Gherkin alone are not execution evidence.

## AC-1.1 — Target identity and containment

**WHEN** the candidate catalog is evaluated **THEN** exactly one entry named `omp-spec-kit` SHALL resolve from `./plugins/omp-spec-kit` beneath the repository root and its declared entrypoints SHALL remain beneath that child; duplicate target names or path escape SHALL fail, while unrelated entries SHALL not.

**Requirement:** [FR-1](FR.md#fr-1-target-plugin-identity-and-containment) · **Scenario:** `@feature1`.

## AC-2.1 — Deterministic child payload

**WHEN** the immutable tag commit is built twice from clean output **THEN** both package-tree and archive SHA-256 values SHALL match, and missing, unexpected, linked, non-regular, source, test, or evidence payload files SHALL fail.

**Requirement:** [FR-2](FR.md#fr-2-deterministic-child-payload) · **Scenario:** `@feature2`.

## AC-3.1 — Installed canonical invocation

**WHEN** the exact archive is installed project-scope and a fresh supported OMP session sends a canonical request **THEN** the installed candidate SHALL answer from the active project and report the candidate version and declared surface; distribution SHALL not revalidate the kernel's full request/result grammar.

**Requirement:** [FR-3](FR.md#fr-3-installed-canonical-invocation) · **Scenario:** `@feature3`.

## AC-4.1 — Fresh-session activation

**WHEN** discovery, install, and reload succeed but the old session has not ended **THEN** activation SHALL remain unproven; **AND WHEN** a new session invokes the installed candidate **THEN** activation SHALL pass.

**Requirement:** [FR-4](FR.md#fr-4-fresh-session-activation) · **Scenario:** `@feature4`.

## AC-5.1 — Dependency-absent execution

**WHEN** the checkout and ambient dependencies are unavailable **THEN** the installed extension and MCP launcher SHALL still complete the canonical invocation, or release SHALL fail.

**Requirement:** [FR-5](FR.md#fr-5-dependency-absent-execution) · **Scenario:** `@feature5`.

## AC-6.1 — Installed containment and read-only smoke

**WHEN** the installed candidate is invoked from a project distinct from the package directory **THEN** it SHALL use the active project, stay contained, and leave project hashes, credentials, network, model, and background state untouched.

**Requirement:** [FR-6](FR.md#fr-6-installed-containment-and-read-only-smoke) · **Scenario:** `@feature6`.

## AC-7.1 — Version consistency and upgrade

**WHEN** a post-first candidate is evaluated **THEN** all candidate authorities and the fresh installed observation SHALL agree, and an upgrade from exact public predecessor bytes SHALL reach the candidate; stale-session or catalog-only change SHALL fail.

**Requirement:** [FR-7](FR.md#fr-7-version-consistency-and-upgrade) · **Scenario:** `@feature7`.

## AC-8.1 — Uninstall, reinstall, and rollback

**WHEN** lifecycle recovery is exercised **THEN** uninstall SHALL yield fresh absence, reinstall SHALL invoke the same candidate digest, rollback SHALL invoke the exact public predecessor for post-first releases, and non-OMP-managed project hashes SHALL remain unchanged.

**Requirement:** [FR-8](FR.md#fr-8-uninstall-reinstall-and-rollback) · **Scenario:** `@feature8`.

## AC-9.1 — Public-safety gates

**WHEN** provenance, license, secret, local-state, public-diff, or payload-allowlist verification fails **THEN** no public release asset SHALL be created and diagnostics SHALL not disclose the protected value.

**Requirement:** [FR-9](FR.md#fr-9-public-safety-gates) · **Scenario:** `@feature9`.

## AC-10.1 — Build once, publish, and attest

**WHEN** a qualifying tag passes every named check **THEN** the public archive SHA-256 SHALL equal the verified build SHA-256 and the final GitHub Artifact Attestation subject SHA-256; a rebuild, different existing asset, PR, or untagged push SHALL not publish.

**Requirement:** [FR-10](FR.md#fr-10-build-once-publish-the-same-digest-attest-once) · **Scenario:** `@feature10`.

## AC-11.1 — Distribution-owned status record

**WHEN** publication and final attestation complete **THEN** one compact immutable distribution record SHALL contain the candidate identity, named checks, lifecycle, public asset, and attestation; it SHALL contain no product capability decision.

**Requirement:** [FR-11](FR.md#fr-11-distribution-owned-release-status) · **Scenario:** `@feature11`.

## AC-12.1 — Compact release decision

**WHEN** any named release check fails **THEN** the release SHALL stop and identify that check in CI diagnostics without requiring extra receipt envelopes, copied host/runtime schemas, arbitrary counters, or a repository-wide inventory.

**Requirement:** [FR-12](FR.md#fr-12-compact-release-decision) · **Scenario:** `@feature12`.

## AC-13.1 — Practical distribution release path

**WHEN** a next candidate is released **THEN** it SHALL follow only the contained-target → build-once → installed/lifecycle/safety checks → same-digest publish → final archive attestation → status-record path; an obsolete secondary evaluator or intermediate attestation SHALL neither be required nor emitted.

**Requirement:** [FR-13](FR.md#fr-13-practical-distribution-release-path) · **Scenario:** `@feature13`.
