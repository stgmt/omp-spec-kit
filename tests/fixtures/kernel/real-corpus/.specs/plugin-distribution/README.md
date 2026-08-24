# Plugin Distribution Specification

**Status:** Specification text only; no implementation or executed lifecycle evidence is claimed.

This specification defines the `v0.1.0` distribution boundary for `omp-spec-kit`: one repository-root OMP marketplace catalog, one child plugin package at `plugins/omp-spec-kit`, and one built extension entry. The first installed capability is a bounded, root-relative, read-only `spec_inventory` tool.

## Scope

- Marketplace identity: `omp-spec-kit`
- Installed identity: `omp-spec-kit@omp-spec-kit`
- Catalog path: `.omp-plugin/marketplace.json`
- Child package: `plugins/omp-spec-kit`
- Extension artifact: `plugins/omp-spec-kit/dist/extension.js`
- First installable version: `0.1.0`
- Install scope proven by this specification: project

The repository root is the marketplace root. A nested marketplace, a nested plugin package, a second catalog entry, or a second `omp.extensions` entry is invalid.

## Readiness rule

A catalog file, a successful build, plugin installation, `/reload-plugins`, or an individual passing job is not release proof. `v0.1.0` may be claimed only when [FR-13](FR.md#fr-13-aggregate-release-eligibility) has complete current mandatory FR-1..FR-12 evidence for one candidate identity, including version consistency, dependency-absent clean install, fresh-session `spec_inventory` activation/invocation, uninstall with fresh-session absence, exact `0.1.0` reinstall with fresh-session invocation, preservation, and release/provenance/security gates. Upgrade-from-prior and rollback-to-prior are not `0.1.0` prerequisites; they become mandatory beginning with the first subsequent release.

## Documents

- [User stories](USER_STORIES.md)
- [Use cases](USE_CASES.md)
- [Research](RESEARCH.md)
- [Requirements summary](REQUIREMENTS.md)
- [Functional requirements](FR.md)
- [Non-functional requirements](NFR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Design](DESIGN.md)
- [Tasks](TASKS.md)
- [Planned file changes](FILE_CHANGES.md)
- [Specification changelog](CHANGELOG.md)
- [BDD specification](plugin-distribution.feature)
- [Fixture contract](FIXTURES.md)
- [Public schemas](plugin-distribution_SCHEMA.md)

## Normative identity

Document-local IDs such as `FR-1` are authored locally. Any runtime, report, or cross-spec reference MUST qualify them as `plugin-distribution:FR-1`, `plugin-distribution:AC-1.1`, or `plugin-distribution:@feature1`.
