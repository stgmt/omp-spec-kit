# Specification Changelog

## Unreleased — Specification baseline

### Added

- Defined the invariant of one repository-root OMP marketplace, one `plugins/omp-spec-kit` child package, and one built extension entry.
- Defined the v0.1.0 `spec_inventory` request, result, entry, diagnostic, and evidence receipt contracts.
- Distinguished install, reload, fresh-session activation, invocation, uninstall, and exact-version reinstall for `0.1.0`, while deferring upgrade-from-prior and rollback-to-prior proof until the first subsequent release.
- Added dependency-absent packaging, provenance, license, secret, public-path, version, and GitHub Actions release gates.
- Added FR-13 aggregate release eligibility: complete current mandatory FR-1..FR-12 evidence is required, and partial stage/job success cannot publish.
- Added explicit negative cases for duplicate/nested topology, path/link escape, malformed/unbounded inputs, stale evidence, version mismatch, release overwrite, partial evidence sets, and project mutation.

### Readiness

`SPEC_ONLY/NOT_READY`. The BDD scenarios are specification text and have not been executed by this changelog. No installable plugin, passing lifecycle, version tag, or GitHub release is claimed here.

## Release-history policy

A future `0.1.0` entry may be added only after `plugin-distribution:FR-13` reports eligibility from the complete candidate-applicable FR-1..FR-12 evidence set for the same tagged commit and artifact digest. Planned features and partially proven stages never appear under a released version.
