# Requirements Summary

## Boundary

Distribution owns target selection, deterministic packaging, installed/lifecycle/public-safety checks, same-digest publication, one final public-archive attestation, and its compact status record. OMP, kernel, MRI, and product keep their own contracts. Historical v0.1–v0.3.2 receipts remain immutable evidence.

## Requirement index

| FR | Contract | AC | Scenario | Task |
|---|---|---|---|---|
| FR-1 | Contained target plugin identity | AC-1.1 | `@feature1` / `SCEN-select-contained-target-plugin` | TASK-1 |
| FR-2 | Deterministic child payload | AC-2.1 | `@feature2` / `SCEN-build-deterministic-child-payload` | TASK-2 |
| FR-3 | Installed canonical invocation | AC-3.1 | `@feature3` / `SCEN-invoke-installed-candidate` | TASK-3 |
| FR-4 | Fresh-session activation | AC-4.1 | `@feature4` / `SCEN-require-fresh-session-activation` | TASK-3 |
| FR-5 | Dependency-absent execution | AC-5.1 | `@feature5` / `SCEN-run-without-ambient-dependencies` | TASK-2 |
| FR-6 | Installed containment/read-only smoke | AC-6.1 | `@feature6` / `SCEN-contain-installed-invocation` | TASK-3 |
| FR-7 | Version consistency and upgrade | AC-7.1 | `@feature7` / `SCEN-upgrade-from-real-public-release` | TASK-4 |
| FR-8 | Uninstall/reinstall/rollback | AC-8.1 | `@feature8` / `SCEN-recover-with-exact-artifacts` | TASK-4 |
| FR-9 | Public-safety gates | AC-9.1 | `@feature9` / `SCEN-block-unsafe-public-artifact` | TASK-5 |
| FR-10 | Same-digest publication and final attestation | AC-10.1 | `@feature10` / `SCEN-publish-same-digest-with-final-attestation` | TASK-6 |
| FR-11 | Distribution-owned status record | AC-11.1 | `@feature11` / `SCEN-write-compact-distribution-status` | TASK-6 |
| FR-12 | Compact named-check decision | AC-12.1 | `@feature12` / `SCEN-block-on-named-check-failure` | TASK-6 |
| FR-13 | One practical release path | AC-13.1 | `@feature13` / `SCEN-use-one-practical-release-path` | TASK-7 |

## Contract cards

| FR | Trigger | Input | Observable output | Failure |
|---|---|---|---|---|
| FR-1 | Candidate selection | Catalog plus repository paths | One contained target identity | Duplicate target or escape blocks |
| FR-2 | Clean build | Tag commit | Stable package-tree/archive digests | Payload mismatch blocks |
| FR-3–FR-6 | Installed smoke | Exact archive, supported OMP pin, isolated project | Fresh candidate invocation, dependency absence, containment | Missing/stale/ambient/mutating behavior blocks |
| FR-7–FR-8 | Lifecycle smoke | Candidate and applicable real predecessor bytes | Fresh upgrade/reinstall/rollback observations plus preservation hashes | Wrong bytes/session/version or mutation blocks |
| FR-9 | Public-safety review | Source and child payload | PASS for six named safety checks | Any failed check blocks |
| FR-10–FR-13 | Tag release | One candidate identity and all named checks | Same-digest public asset, final attestation, compact status | Rebuild, replacement, failed check, or obsolete @2 path blocks |

## CHK traceability matrix

| CHK ID | Requirement | Trace | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | Target name/source/entrypoints are unique and contained; unrelated entries are ignored. | FR-1; AC-1.1; @feature1 | BDD scenario | Verified | `SCEN-select-contained-target-plugin`; TASK-1 |
| CHK-FR2-01 | Two clean builds yield the same package-tree and archive digests. | FR-2; AC-2.1; @feature2 | BDD scenario | Verified | `SCEN-build-deterministic-child-payload`; TASK-2 |
| CHK-FR3-01 | Fresh installed canonical invocation reports candidate identity and declared surface. | FR-3; AC-3.1; @feature3 | BDD scenario | Verified | `SCEN-invoke-installed-candidate`; TASK-3 |
| CHK-FR4-01 | Reload-only stays unproven; fresh invocation proves activation. | FR-4; AC-4.1; @feature4 | BDD scenario | Verified | `SCEN-require-fresh-session-activation`; TASK-3 |
| CHK-FR5-01 | Installed payload runs without checkout or ambient dependencies. | FR-5; AC-5.1; @feature5 | BDD scenario | Verified | `SCEN-run-without-ambient-dependencies`; TASK-2 |
| CHK-FR6-01 | Active-project invocation stays read-only and contained. | FR-6; AC-6.1; @feature6 | BDD scenario | Verified | `SCEN-contain-installed-invocation`; TASK-3 |
| CHK-FR7-01 | All versions agree and upgrade uses real public predecessor bytes. | FR-7; AC-7.1; @feature7 | BDD scenario | Verified | `SCEN-upgrade-from-real-public-release`; TASK-4 |
| CHK-FR8-01 | Uninstall/reinstall/rollback preserve project hashes and exact artifacts. | FR-8; AC-8.1; @feature8 | BDD scenario | Verified | `SCEN-recover-with-exact-artifacts`; TASK-4 |
| CHK-FR9-01 | Any provenance/license/secret/state/diff/payload failure blocks publication. | FR-9; AC-9.1; @feature9 | BDD scenario | Verified | `SCEN-block-unsafe-public-artifact`; TASK-5 |
| CHK-FR10-01 | Verified archive, public asset, and final attestation digests are equal. | FR-10; AC-10.1; @feature10 | BDD scenario | Verified | `SCEN-publish-same-digest-with-final-attestation`; TASK-6 |
| CHK-FR11-01 | Compact status includes distribution facts and excludes product decisions. | FR-11; AC-11.1; @feature11 | BDD scenario | Verified | `SCEN-write-compact-distribution-status`; TASK-6 |
| CHK-FR12-01 | Every named check is required; a failed name blocks with CI diagnostics. | FR-12; AC-12.1; @feature12 | BDD scenario | Draft | `SCEN-block-on-named-check-failure`; TASK-6 |
| CHK-FR13-01 | Next release uses only the practical forward path and emits no obsolete evaluator. | FR-13; AC-13.1; @feature13 | BDD scenario | Draft | `SCEN-use-one-practical-release-path`; TASK-7 |

## NFR traceability

| NFR | FR | Task | Verification |
|---|---|---|---|
| [NFR-SECURITY-1](NFR.md#nfr-security-1-least-privilege) | FR-5, FR-6, FR-9, FR-10 | TASK-2, TASK-3, TASK-5, TASK-6 | isolated read-only smoke and least-permission publish |
| [NFR-PERFORMANCE-1](NFR.md#nfr-performance-1-proportional-release-checks) | FR-2, FR-12 | TASK-2, TASK-6 | streaming hashes and one run per named check |
| [NFR-PORTABILITY-1](NFR.md#nfr-portability-1-installed-portability) | FR-3, FR-5 | TASK-2, TASK-3 | Windows/POSIX installed smoke |
| [NFR-RELIABILITY-1](NFR.md#nfr-reliability-1-reversible-lifecycle) | FR-4, FR-7, FR-8, FR-10 | TASK-3, TASK-4, TASK-6 | fresh sessions, exact digests, preservation hashes |
| [NFR-SUPPLYCHAIN-1](NFR.md#nfr-supplychain-1-reproducible-exact-bytes) | FR-2, FR-9, FR-10 | TASK-2, TASK-5, TASK-6 | build/public asset/attestation digest equality |
| [NFR-USABILITY-1](NFR.md#nfr-usability-1-actionable-diagnostics) | FR-11, FR-12 | TASK-6 | failed check name and bounded CI remediation |
| [NFR-MAINTAINABILITY-1](NFR.md#nfr-maintainability-1-owner-boundaries) | FR-1, FR-3, FR-11, FR-13 | TASK-1, TASK-3, TASK-6, TASK-7 | no copied host/runtime/product schema |

## Current evidence

v0.3.2 is SHIPPED at tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`. Exact digests and lifecycle/attestation identities are in `docs/validation/release-status-v0.3.2.json`. They prove that historical release, not the NEXT workflow implementation.
