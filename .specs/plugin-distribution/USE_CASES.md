# Use Cases

## UC-1 — Validate the target package

**Actor:** Release maintainer.

**Precondition:** A tagged candidate and marketplace metadata exist.

**Flow:** Read the marketplace, select the unique omp-spec-kit entry, and verify the source and entrypoints stay inside the selected child.

**Postcondition:** Candidate identity and child containment satisfy FR-1 and FR-2.

**Related:** [FR-1](FR.md#fr-1-target-plugin-identity-and-containment), [FR-2](FR.md#fr-2-deterministic-child-payload), @feature1, @feature2


## UC-2 — Build and invoke once

**Actor:** Release maintainer.

**Precondition:** The selected tag and clean build environment are fixed.

**Flow:** Build once, record package/archive hashes, invoke the installed bytes from a foreign working directory, and verify dependency absence.

**Postcondition:** Installed candidate satisfies FR-3 through FR-6 without source-checkout or ambient-dependency fallback.

**Related:** [FR-3](FR.md#fr-3-installed-canonical-invocation), [FR-4](FR.md#fr-4-fresh-session-activation), [FR-5](FR.md#fr-5-dependency-absent-execution), [FR-6](FR.md#fr-6-installed-containment-and-read-only-smoke), @feature3, @feature4, @feature5, @feature6


## UC-3 — Exercise lifecycle recovery

**Actor:** Release owner.

**Precondition:** A verified candidate and a preserved project baseline exist.

**Flow:** Install, uninstall, reinstall, upgrade, and rollback the candidate while comparing project hashes and fresh-session behavior.

**Postcondition:** Lifecycle transitions are reversible and satisfy FR-7 and FR-8.

**Related:** [FR-7](FR.md#fr-7-version-consistency-and-upgrade), [FR-8](FR.md#fr-8-uninstall-reinstall-and-rollback), @feature7, @feature8


## UC-4 — Apply public-safety checks

**Actor:** Release owner.

**Precondition:** A candidate archive and its provenance are available.

**Flow:** Verify provenance, licenses, secret scanning, user-state exclusion, payload allowlist, exact digest publication, and attestation.

**Postcondition:** Public safety and same-byte publication satisfy FR-9 and FR-10.

**Related:** [FR-9](FR.md#fr-9-public-safety-gates), [FR-10](FR.md#fr-10-build-once-publish-the-same-digest-attest-once), @feature9, @feature10


## UC-5 — Publish verified status

**Actor:** Maintainer.

**Precondition:** Candidate checks and public-safety evidence are complete.

**Flow:** Evaluate the distribution-owned status, compact release decision, and practical release path against the immutable candidate record.

**Postcondition:** Only the documented release state is communicated, satisfying FR-11 through FR-13.

**Related:** [FR-11](FR.md#fr-11-distribution-owned-release-status), [FR-12](FR.md#fr-12-compact-release-decision), [FR-13](FR.md#fr-13-practical-distribution-release-path), @feature11, @feature12, @feature13



## UC-11: Launch from the active project

**Actor:** Project user.

**Precondition:** The installed plugin is invoked from a project whose active root differs from package CWD.

**Flow:** Resolve the active project, apply a contained override when present, and compare the response root with the active project identity.

**Postcondition:** The installed invocation uses the active project and cannot escape the contained override.

**Related:** [FR-19](FR.md#fr-19-active-project-installed-behavior), [AC-19.1](ACCEPTANCE_CRITERIA.md#ac-191-active-project-and-contained-override)

## UC-12: Recover after an invalid protocol frame

**Actor:** MCP client.

**Precondition:** The stdio adapter receives an invalid protocol frame.

**Flow:** Emit one typed error, preserve process liveness where the contract permits, and accept the next valid request without spawning a second server.

**Postcondition:** The client receives bounded recovery behavior and the adapter does not silently corrupt the stream.

**Related:** [FR-20](FR.md#fr-20-terminal-protocol-errors-and-recovery), [AC-20.1](ACCEPTANCE_CRITERIA.md#ac-201-one-error-and-process-recovery)

## UC-13: Exercise the historical v0.3.2 surface

**Actor:** Release verifier.

**Precondition:** The immutable v0.3.2 candidate is installed.

**Flow:** Enumerate the declared eight read-only handlers, invoke them through the installed adapter, and observe that no repository writes occur.

**Postcondition:** The historical surface remains readable as historical evidence without being promoted to a current release claim.

**Related:** [FR-21](FR.md#fr-21-historical-eight-tool-installed-surface), [AC-21.1](ACCEPTANCE_CRITERIA.md#ac-211-eight-installed-handlers-and-zero-writes)

## UC-14: Run a future candidate journey

**Actor:** Release verifier.

**Precondition:** A future candidate has an immutable tag, build, installation, and lifecycle profile.

**Flow:** Run the unfiltered candidate journey and record installed invocation, lifecycle, and public-safety observations.

**Postcondition:** Candidate evidence is observed end to end without treating a plan or static text as execution proof.

**Related:** [FR-22](FR.md#fr-22-one-real-candidate-run), [AC-22.1](ACCEPTANCE_CRITERIA.md#ac-221-unfiltered-run-and-observed-lifecycle)

## UC-15: Publish the verified archive

**Actor:** Release owner.

**Precondition:** The contained candidate archive has passed its named checks.

**Flow:** Reconcile the package-tree digest, archive digest, public asset, and final attestation subject, then publish only the same bytes.

**Postcondition:** No rebuild or replacement asset can enter the published release.

**Related:** [FR-23](FR.md#fr-23-contained-deterministic-candidate-and-same-byte-publication), [AC-23.1](ACCEPTANCE_CRITERIA.md#ac-231-publish-only-the-attested-candidate-bytes)

## UC-16: Read immutable v0.3.2 evidence

**Actor:** Maintainer.

**Precondition:** Historical v0.3.2 status and validation records are available.

**Flow:** Read the immutable records, distinguish historical evidence from current status, and retain public guidance without rewriting the past.

**Postcondition:** Public history remains honest and historical proof is not used as current execution evidence.

**Related:** [FR-24](FR.md#fr-24-public-guidance-and-immutable-v032-evidence), [AC-24.1](ACCEPTANCE_CRITERIA.md#ac-241-public-history-remains-honest)

## UC-17: Distinguish the active and overridden project

**Actor:** Plugin consumer.

**Precondition:** An active project and a project-root override are both supplied.

**Flow:** Resolve both roots canonically, compare their opaque identities, and report the selected source without exposing absolute paths.

**Postcondition:** Response source identity and root consistency are explicit and deterministic.

**Related:** [FR-25](FR.md#fr-25-response-source-identity-and-root-consistency), [AC-25.1](ACCEPTANCE_CRITERIA.md#ac-251-response-source-identity-and-root-consistency)


## UC-18 — Discover consolidated 11-tool surface

- **Actor:** Plugin user / MCP client
- **Preconditions:** Server initialized
- **Trigger:** tools/list requested
- **Main Success Scenario:** Exactly 11 consolidated tools are returned with valid schemas and annotations.
- **Postconditions:** Client invokes consolidated operations via discriminated variants.
