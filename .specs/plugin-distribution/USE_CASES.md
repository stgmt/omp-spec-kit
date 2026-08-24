# Use Cases

## UC-1 — Validate the single-package shape

**Actor:** Release engineer

**Preconditions:** Planned catalog, child package, and built extension artifact are present.

**Main flow:**
1. Resolve `.omp-plugin/marketplace.json` from the repository root.
2. Validate the closed v0.1.0 catalog contract and exactly one plugin entry.
3. Resolve `source: "./plugins/omp-spec-kit"` inside the marketplace root.
4. Validate the child `package.json` and exactly one `omp.extensions` entry.
5. Resolve that entry to `./dist/extension.js` inside the child package.

**Alternates:** A second entry, nested catalog, path escape, missing artifact, mismatched version, or unsupported public field blocks packaging and release.

**Trace:** FR-1, FR-2; AC-1.1, AC-2.1; `@feature1`, `@feature2`.

## UC-2 — Clean project-scope install and activation

**Actor:** OMP user

**Preconditions:** Marketplace has been added; no ambient checkout or package dependencies are available.

**Main flow:**
1. Discover `omp-spec-kit@omp-spec-kit`.
2. Install it with project scope.
3. Confirm the exact installed version.
4. Run `/reload-plugins` to refresh reloadable plugin surfaces.
5. End the session and start a fresh OMP session rooted at the fixture project.
6. Invoke `spec_inventory` from the installed extension.
7. Confirm the response identifies version `0.1.0` and zero repository writes.

**Alternate:** Treating install or reload alone as extension proof is rejected as incomplete evidence.

**Trace:** FR-4, FR-5, FR-11; AC-4.1, AC-4.2, AC-5.1, AC-11.1; `@feature4`, `@feature5`, `@feature11`.

## UC-3 — Inventory repository specifications

**Actor:** Specification author

**Preconditions:** Fresh session is rooted at a disposable project.

**Main flow:**
1. Resolve the project root from the tool execution context, not process launch location.
2. Resolve only `<project-root>/.specs`.
3. Enumerate direct spec directories in deterministic lexical order.
4. Apply request bounds and hard safety caps.
5. Return the public result schema with qualified IDs and diagnostics.
6. Confirm no filesystem mutation, model call, process spawn, network access, or secret read occurred.

**Alternates:** Missing `.specs`, non-directory `.specs`, malformed spec, excessive entries, symlink escape, or aborted request returns a bounded typed result without crashing the session.

**Trace:** FR-3, FR-6, FR-12; AC-3.1, AC-6.1, AC-12.1; `@feature3`, `@feature6`, `@feature12`.

## UC-4 — Upgrade a subsequent release

**Actor:** Operator

**Preconditions:** The candidate is later than `0.1.0`, a lower version was actually released and is installed project-scope, and candidate release gates are complete. This use case is inapplicable to `0.1.0`.

**Main flow:**
1. Refresh the marketplace catalog.
2. Observe a strictly newer explicit catalog semver.
3. Upgrade `omp-spec-kit@omp-spec-kit` at project scope.
4. Reload plugin metadata, then start a fresh session.
5. Invoke the tool and observe the candidate version from the installed artifact.
6. Preserve project hashes throughout.

**Alternate:** Version mismatch, non-newer semver, relabeled local predecessor, partial upgrade, or stale-session observation does not count as proof.

**Trace:** FR-7; AC-7.2; `@feature7`.

## UC-5 — Uninstall, reinstall, or roll back

**Actor:** Operator

**Preconditions:** A candidate version is installed and baseline project hashes exist.

**Main flow:**
1. Uninstall the project-scoped plugin.
2. Confirm plugin registration/cache state no longer enables it for the project.
3. Start a fresh session and confirm the capability is absent.
4. Compare non-OMP-managed project hashes with the baseline.
5. For every candidate, explicitly reinstall the exact verified candidate artifact, reload, start another fresh session, invoke `spec_inventory`, and compare hashes again; this is the complete removal/recovery proof for `0.1.0` without a predecessor.
6. Beginning with the first subsequent release, additionally install the real previous released version for rollback, reload, start a fresh session, invoke the previous version, and compare hashes again.

**Alternate:** Marketplace removal alone is not uninstall; cache deletion alone is not rollback proof; a fabricated prior version cannot satisfy a subsequent-release rollback.

**Trace:** FR-8; AC-8.1, AC-8.2; `@feature8`.

## UC-6 — Publish v0.1.0

**Actor:** Release owner and GitHub Actions

**Preconditions:** Immutable provenance and public-safety inputs are present.

**Main flow:**
1. Run provenance, license, secret, public-path, schema, cardinality, build, package, dependency-absent, lifecycle, preservation, and evidence-honesty gates.
2. Verify catalog version, child package version, built runtime version, installed tool version, and requested tag are all `0.1.0`/`v0.1.0` as applicable.
3. Prove clean install, reload, fresh-session invocation, uninstall absence, and exact-artifact reinstall/reinvocation; mark prior-version upgrade/rollback inapplicable for `0.1.0`.
4. Map current passed receipts to every FR-1 through FR-12 under one commit/OMP/platform/catalog/artifact/version identity.
5. Upload only allowlisted clean-build artifacts and evidence receipts.
6. Create the GitHub release only when a future independently verifiable producer-attestation path allows FR-13 to report `eligible`.

**Alternates:** Any self-attested, missing, stale, mismatched, failed, blocked, partial, or stage-summary-only evidence blocks release creation; current self-authored producer metadata returns `distribution-producer-provenance-untrusted:no-independent-trust-root`, and workflows never mark BDD specification text as executed evidence.

**Trace:** FR-9, FR-10, FR-11, FR-13; AC-9.1, AC-10.1, AC-11.1, AC-13.1; `@feature9`, `@feature10`, `@feature11`, `@feature13`.
