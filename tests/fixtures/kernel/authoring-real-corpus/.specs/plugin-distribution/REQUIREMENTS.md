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

---

## Product lifecycle domain (merged)

## Status semantics

`Specified` means the contract is written. Public shipment uses only SHIPPED, NEXT, and LATER and follows `plugin-distribution:FR-16`.

## Requirement inventory

| ID | Title | Priority | Acceptance | Scenario | Task |
|---|---|---|---|---|---|
| [FR-14](FR.md#fr-14-current-shipped-baseline) | Current shipped baseline | Must | [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-current-release-proof) | `@feature14` | `plugin-distribution:TASK-8` |
| [FR-15](FR.md#fr-15-one-product-identity) | One-product identity | Must | [AC-15.1](ACCEPTANCE_CRITERIA.md#ac-151-single-product-identity) | `@feature15` | `plugin-distribution:TASK-9` |
| [FR-16](FR.md#fr-16-proof-before-shipped) | Proof before shipped | Must | [AC-16.1](ACCEPTANCE_CRITERIA.md#ac-161-missing-proof-is-not-shipped), [AC-16.2](ACCEPTANCE_CRITERIA.md#ac-162-unexecuted-text-is-not-proof) | `@feature16` | `plugin-distribution:TASK-10` |
| [FR-17](FR.md#fr-17-next-safe-authoring-outcome) | Next safe authoring outcome | Must | [AC-17.1](ACCEPTANCE_CRITERIA.md#ac-171-bounded-public-mutation-surface), [AC-17.2](ACCEPTANCE_CRITERIA.md#ac-172-direct-spec-write-policy) | `@feature17` | `plugin-distribution:TASK-11` |
| [FR-18](FR.md#fr-18-plain-later-outcomes) | Plain later outcomes | Should | [AC-18.1](ACCEPTANCE_CRITERIA.md#ac-181-three-bucket-roadmap) | `@feature18` | `plugin-distribution:TASK-12` |

## Contract cards

### FR-14

- **Rationale:** managers need one truthful statement of the installed baseline.
- **Risk if omitted:** old release steps look like separate current products.
- **Verification mode:** compare the row with the bounded release status record and installed identity.
- **Evidence demand:** `docs/validation/release-status-v0.3.2.json` for the exact v0.3.2 release.
- **Acceptance:** `plugin-distribution:AC-14.1`.
- **Scenario:** `SCEN-product-current-release-proof`.
- **Task:** `plugin-distribution:TASK-8`.

### FR-15

- **Rationale:** users should install and recognize one evolving product.
- **Risk if omitted:** packaging or authoring fragments into competing products.
- **Verification mode:** inspect marketplace, package, extension, and public mutation identity.
- **Evidence demand:** current distribution evidence for `omp-spec-kit@omp-spec-kit`.
- **Acceptance:** `plugin-distribution:AC-15.1`.
- **Scenario:** `SCEN-product-one-product-identity`.
- **Task:** `plugin-distribution:TASK-9`.

### FR-16

- **Rationale:** plans and prose must not become shipment claims.
- **Risk if omitted:** users depend on behavior that has not run.
- **Verification mode:** remove or mismatch the current proof and confirm the row is not SHIPPED.
- **Evidence demand:** a current observable proof naming the exact released identity.
- **Acceptance:** `plugin-distribution:AC-16.1`, `plugin-distribution:AC-16.2`.
- **Scenario:** `SCEN-product-missing-proof-is-not-shipped`, `SCEN-product-unexecuted-text-is-not-proof`.
- **Task:** `plugin-distribution:TASK-10`.

### FR-17

- **Rationale:** authoring needs one narrow mutation door and a practical direct-write refusal boundary.
- **Risk if omitted:** a raw writer can bypass atomic validation or escape repository containment.
- **Verification mode:** enumerate the public mutation tools, apply one real patch, and attempt one non-allowlisted direct `.specs/**` write plus one link escape.
- **Evidence demand:** real end-to-end receipts for successful atomic apply and both refusals.
- **Acceptance:** `plugin-distribution:AC-17.1`, `plugin-distribution:AC-17.2`.
- **Scenario:** `SCEN-product-authoring-tools-are-bounded`, `SCEN-product-direct-spec-write-is-refused`.
- **Task:** `plugin-distribution:TASK-11`.

### FR-18

- **Rationale:** a short roadmap is easier to keep honest than an internal state model.
- **Risk if omitted:** implementation details leak into public promises and drift.
- **Verification mode:** inspect the public status table and later list.
- **Evidence demand:** exact-content review of SHIPPED/NEXT/LATER wording.
- **Acceptance:** `plugin-distribution:AC-18.1`.
- **Scenario:** `SCEN-product-roadmap-has-three-buckets`.
- **Task:** `plugin-distribution:TASK-12`.

## CHK traceability matrix

| CHK ID | Check | FR | AC | Scenario | Task |
|---|---|---|---|---|---|
| CHK-FR14-01 | The single current SHIPPED row matches the v0.3.2 release proof and eight-tool read-only baseline. | FR-14 | AC-14.1 | `SCEN-product-current-release-proof` | plugin-distribution:TASK-8 |
| CHK-FR15-01 | The marketplace, package, extension, and mutation surface preserve one product identity. | FR-15 | AC-15.1 | `SCEN-product-one-product-identity` | plugin-distribution:TASK-9 |
| CHK-FR16-01 | Missing proof and unexecuted text never produce SHIPPED. | FR-16 | AC-16.1, AC-16.2 | `SCEN-product-missing-proof-is-not-shipped`, `SCEN-product-unexecuted-text-is-not-proof` | plugin-distribution:TASK-10 |
| CHK-FR17-01 | Only two public mutation tools exist, and non-allowlisted canonical `.specs/**` writes or escapes are refused. | FR-17 | AC-17.1, AC-17.2 | `SCEN-product-authoring-tools-are-bounded`, `SCEN-product-direct-spec-write-is-refused` | plugin-distribution:TASK-11 |
| CHK-FR18-01 | Public status contains only SHIPPED, NEXT, and LATER with one NEXT safe-authoring row and plain later outcomes. | FR-18 | AC-18.1 | `SCEN-product-roadmap-has-three-buckets` | plugin-distribution:TASK-12 |

## Canonical dependencies

| Product requirement | Owner | Product use |
|---|---|---|
| `plugin-distribution:FR-14`, `plugin-distribution:FR-15` | `plugin-distribution` | Current package identity and release proof. |
| `plugin-distribution:FR-17` | `spec-mcp-operations` | Read/write MCP operations, proposal, validation, and atomic apply behavior. |
| `plugin-distribution:FR-17` | `spec-mcp-access-gate` | OMP agent access gate and direct non-MCP specification access policy. |

---

## MCP release-integrity domain (merged)

## Traceability Matrix

| ID | Acceptance | Scenarios | Check | Task | Product state |
|---|---|---|---|---|---|
| [FR-19](FR.md#fr-19-active-project-installed-behavior) | [AC-19.1](ACCEPTANCE_CRITERIA.md#ac-191-active-project-and-contained-override) | `SCEN-mri-active-project-root` | CHK-FR19-01 | MRI001_01 | SHIPPED |
| [FR-20](FR.md#fr-20-terminal-protocol-errors-and-recovery) | [AC-20.1](ACCEPTANCE_CRITERIA.md#ac-201-one-error-and-process-recovery) | `SCEN-mri-terminal-json-rpc`, `SCEN-mri-malformed-json-recovery` | CHK-FR20-01 | MRI001_02 | SHIPPED |
| [FR-21](FR.md#fr-21-historical-eight-tool-installed-surface) | [AC-21.1](ACCEPTANCE_CRITERIA.md#ac-211-eight-installed-handlers-and-zero-writes) | `SCEN-mri-all-tool-parity` | CHK-FR21-01 | MRI001_01 | SHIPPED |
| [FR-22](FR.md#fr-22-one-real-candidate-run) | [AC-22.1](ACCEPTANCE_CRITERIA.md#ac-221-unfiltered-run-and-observed-lifecycle) | `SCEN-mri-public-eligibility-separation` | CHK-FR22-01 | MRI001_03 | NEXT |
| [FR-23](FR.md#fr-23-contained-deterministic-candidate-and-same-byte-publication) | [AC-23.1](ACCEPTANCE_CRITERIA.md#ac-231-publish-only-the-attested-candidate-bytes) | `SCEN-mri-artifact-mismatch-refusal`, `SCEN-mri-executable-launcher-archive`, `SCEN-mri-symlinked-evidence-refusal` | CHK-FR23-01 | MRI001_04 | NEXT |
| [FR-24](FR.md#fr-24-public-guidance-and-immutable-v032-evidence) | [AC-24.1](ACCEPTANCE_CRITERIA.md#ac-241-public-history-remains-honest) | `SCEN-mri-public-communication-proof` | CHK-FR24-01 | MRI001_05 | SHIPPED |
| [FR-25](FR.md#fr-25-response-source-identity-and-root-consistency) | [AC-25.1](ACCEPTANCE_CRITERIA.md#ac-251-response-source-identity-and-root-consistency) | `SCEN-mri-response-provenance`, `SCEN-mri-extension-root-consistency` | CHK-FR25-01 | MRI001_07 | NEXT |

## Verification Matrix

| CHK-ID | Requirement | Traces To | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR19-01 | Installed active-project selection and contained override | FR-19, AC-19.1, @feature19 | BDD scenario | Verified | SCEN-mri-active-project-root; MRI001_01 |
| CHK-FR20-01 | Terminal errors and same-process recovery | FR-20, AC-20.1, @feature20 | BDD scenario | Verified | SCEN-mri-terminal-json-rpc, SCEN-mri-malformed-json-recovery; MRI001_02 |
| CHK-FR21-01 | Exact historical eight installed handlers and zero writes | FR-21, AC-21.1, @feature21 | BDD scenario | Verified | SCEN-mri-all-tool-parity; MRI001_01 |
| CHK-FR22-01 | Successful unfiltered real-producer run plus observed install and lifecycle | FR-22, AC-22.1, @feature22 | Integration test | Draft | SCEN-mri-public-eligibility-separation; MRI001_03 |
| CHK-FR23-01 | Contained deterministic archive, attestation, and same-digest publication | FR-23, AC-23.1, @feature23 | Integration test | Draft | SCEN-mri-artifact-mismatch-refusal, SCEN-mri-executable-launcher-archive, SCEN-mri-symlinked-evidence-refusal; MRI001_04 |
| CHK-FR24-01 | Immutable v0.3.2 evidence and public guidance agree | FR-24, AC-24.1, @feature24 | Manual review | Verified | SCEN-mri-public-communication-proof; MRI001_05 |
| CHK-FR25-01 | Installed result provenance and one-root extension consistency | FR-25, AC-25.1, @feature25 | BDD scenario | Draft | SCEN-mri-response-provenance, SCEN-mri-extension-root-consistency; MRI001_07 |

Checks are evidence links, not a release counter. Candidate acceptance uses current run results and byte identities, never CHK status totals or `.progress.json`.