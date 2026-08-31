# Functional Requirements

IDs are local here and qualified as `plugin-distribution:<id>` outside this specification.

## FR-1 — Target plugin identity and containment

A release SHALL select exactly one catalog entry named `omp-spec-kit`, require source `./plugins/omp-spec-kit`, and prove that source resolves beneath the repository root. The child version plus declared extension and MCP entrypoints SHALL resolve beneath that child. Unrelated catalog entries, packages, or servers are outside this requirement.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-target-identity-and-containment)

**Scenario:** `@feature1` / `SCEN-select-contained-target-plugin`.

## FR-2 — Deterministic child payload

A clean build from the immutable tag commit SHALL create the complete installable child, reject missing, unexpected, linked, or non-regular payload files, and record deterministic package-tree and archive SHA-256 values. Generated `dist/**` SHALL not depend on source/test/evidence files inside the child.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-deterministic-child-payload)

**Scenario:** `@feature2` / `SCEN-build-deterministic-child-payload`.

## FR-3 — Installed canonical invocation

The release check SHALL install the exact candidate project-scope in an isolated OMP environment and invoke a canonical read-only request from a fresh session. It SHALL compare the observed candidate version and declared surface with the candidate manifest, while leaving request/result/error semantics to the kernel/runtime owner. For historical v0.3.2, the declared MCP surface is the eight shipped read-only names.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-installed-canonical-invocation)

**Scenario:** `@feature3` / `SCEN-invoke-installed-candidate`.

## FR-4 — Fresh-session activation

Discovery, project-scope install, installed-version observation, `/reload-plugins`, old-session termination, fresh-session startup, and invocation SHALL be separate observations. Install or reload without fresh invocation SHALL not prove activation.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-fresh-session-activation)

**Scenario:** `@feature4` / `SCEN-require-fresh-session-activation`.

## FR-5 — Dependency-absent execution

The installed extension and MCP launcher SHALL load and serve the canonical invocation when the source checkout, repository-root `node_modules`, and unrelated external dependencies are unavailable. Absolute workstation paths, install-time downloads, native addons, and undeclared runtime dependencies SHALL block release.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-dependency-absent-execution)

**Scenario:** `@feature5` / `SCEN-run-without-ambient-dependencies`.

## FR-6 — Installed containment and read-only smoke

The installed smoke SHALL prove that the candidate resolves the active project rather than package CWD, does not escape the project/package boundaries, and performs no repository mutation, credential access, network access, model call, or background work. Detailed runtime diagnostics remain owned by the runtime contracts.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-containment-and-read-only-smoke)

**Scenario:** `@feature6` / `SCEN-contain-installed-invocation`.

## FR-7 — Version consistency and upgrade

Catalog version, child version, embedded version, tag, commit, archive digest, and fresh installed observation SHALL identify one candidate. Every release after the first SHALL upgrade from exact bytes of a real lower public release. Catalog refresh or an old-session observation SHALL not count as upgrade proof.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-version-consistency-and-upgrade)

**Scenario:** `@feature7` / `SCEN-upgrade-from-real-public-release`.

## FR-8 — Uninstall, reinstall, and rollback

Every candidate SHALL prove uninstall plus fresh-session absence and reinstall of the same candidate digest plus fresh invocation. Every release after the first SHALL also roll back to exact bytes of a real public predecessor. Non-OMP-managed project bytes SHALL remain unchanged across all transitions.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-uninstall-reinstall-and-rollback)

**Scenario:** `@feature8` / `SCEN-recover-with-exact-artifacts`.

## FR-9 — Public-safety gates

Before publication, automation SHALL verify source provenance and license disposition, secret scanning, absence of local/user state, a clean public diff, and an allowlisted child payload. A failed check SHALL stop publication and SHALL not leak the triggering secret or host path.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-public-safety-gates)

**Scenario:** `@feature9` / `SCEN-block-unsafe-public-artifact`.

## FR-10 — Build once, publish the same digest, attest once

The tag workflow SHALL build the candidate once, pass its archive SHA-256 through the named release checks, and publish those exact bytes without rebuilding. It SHALL refuse replacement of an existing different asset and SHALL create one final GitHub Artifact Attestation whose subject is the public archive. PRs and untagged pushes SHALL remain verify-only.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-build-once-publish-and-attest)

**Scenario:** `@feature10` / `SCEN-publish-same-digest-with-final-attestation`.

## FR-11 — Distribution-owned release status

After publication, distribution SHALL write one immutable status record containing version, tag, commit, package-tree and archive SHA-256 values, supported OMP/platform identity, named check outcomes, lifecycle observations, public asset identity, and final attestation identity. It SHALL not decide global badges, task states, capabilities, MRI, or product delivery.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-distribution-owned-status-record)

**Scenario:** `@feature11` / `SCEN-write-compact-distribution-status`.

## FR-12 — Compact release decision

The release job SHALL decide from the named checks `target`, `build`, `install`, `invoke`, `dependencyAbsent`, `lifecycle`, and `publicSafety`. It SHALL report failed check names with bounded human diagnostics in CI logs; no public per-FR receipts, exhaustive host/runtime schemas, serialized-byte counters, or global repository inventory are part of the decision contract.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-compact-release-decision)

**Scenario:** `@feature12` / `SCEN-block-on-named-check-failure`.

## FR-13 — Practical distribution release path

A candidate is distribution-ready only when FR-1 through FR-12 are satisfied for one tag/commit/archive identity. The only forward path is: validate the contained target, build once, run installed and lifecycle/public-safety checks, publish the same digest, create the final archive attestation, and record the result. Historical eligibility and internal evidence-attestation formats SHALL remain readable historical evidence but SHALL NOT be required or emitted as the forward API.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-practical-distribution-release-path)

**Scenario:** `@feature13` / `SCEN-use-one-practical-release-path`.
