# Plugin Distribution Specification

**Contract status:** the v0.1 distribution contract has a delivered public descendant at v0.3.2. Current release identity and attestation receipts are summarized in `docs/validation/release-status-v0.3.2.json`; Gherkin remains specification text unless a cited producer receipt proves execution.

This specification owns one marketplace, one child package, one extension entry, one profile-gated MCP server identity, candidate packaging/lifecycle/safety receipts, and distribution-only eligibility. Historical v0.1.0 began with bounded `spec_inventory`; delivered v0.3.2 preserves the topology and adds its read-only kernel/MCP first slice.

## Scope

- Marketplace identity: `omp-spec-kit`
- Installed identity: `omp-spec-kit@omp-spec-kit`
- Catalog path: `.omp-plugin/marketplace.json`
- Child package: `plugins/omp-spec-kit`
- Extension artifact: `plugins/omp-spec-kit/dist/extension.js`
- MCP server identity from v0.3 profiles: `omp-spec-kit`
- First installable version: `0.1.0`; current delivered baseline: `0.3.2`
- Install scope proven by this specification: project

The repository root is the marketplace root. A nested marketplace, a nested plugin package, a second catalog entry, or a second `omp.extensions` entry is invalid.

## Readiness rule

A catalog/build/install/reload/job summary or self-authored receipt matrix is not distribution proof. Forward `distribution-release-eligibility@2` requires the complete FR-1..FR-12 matrix plus `gh attestation verify` over the exact evidence subject with repository `stgmt/omp-spec-kit`, signer workflow `stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml`, and source ref `refs/tags/<candidate>`; missing/wrong/unavailable verification fails closed. That result owns distribution eligibility only. MRI remains `mcp-release-integrity`; product baseline/capability/public delivery remains `product:FR-6`. Historical v0.3.2 composed receipts remain valid evidence.

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
- [File state and planned changes](FILE_CHANGES.md)
- [Specification changelog](CHANGELOG.md)
- [BDD specification](plugin-distribution.feature)
- [Fixture contract](FIXTURES.md)
- [Public schemas](plugin-distribution_SCHEMA.md)

## Normative identity

Document-local IDs such as `FR-1` are authored locally. Any runtime, report, or cross-spec reference MUST qualify them as `plugin-distribution:FR-1`, `plugin-distribution:AC-1.1`, or `plugin-distribution:@feature1`.
