# Plugin Distribution Specification

**SHIPPED:** v0.3.2 is the current public read-only plugin. Its bounded release record is `docs/validation/release-status-v0.3.2.json`.

This specification owns the practical path from a tagged commit to an installable `omp-spec-kit` archive: select the target catalog entry, build deterministic contained bytes once, exercise those installed bytes, prove lifecycle and public-safety checks, publish the same digest, and create one final GitHub Artifact Attestation for the public asset.

It does not own OMP's marketplace, extension, or MCP schemas; the kernel's request/result contracts; MRI; or product capability status. Historical v0.1 through v0.3.2 receipts remain historical evidence and are never reinterpreted as the forward release API.

## Product identity

- Catalog: `.omp-plugin/marketplace.json`
- Target entry: `omp-spec-kit`
- Contained source: `./plugins/omp-spec-kit`
- Installed identity: `omp-spec-kit@omp-spec-kit`
- Extension entry: `./dist/extension.js`
- MCP configuration: `plugins/omp-spec-kit/.mcp.json`
- Current version: `0.3.2`
- Supported release-smoke pin: OMP v17.3.7, commit `8500092296621a6826b7136e840f8a59ea338958`

Unrelated catalog entries or packages are outside this specification. The selected `omp-spec-kit` name must be unique in its catalog, and its source and entrypoints must remain inside the selected child.

## Public states

- **SHIPPED:** public v0.3.2 and its historical receipts.
- **NEXT:** use the single release path in this specification for the next candidate.
- **LATER:** capabilities owned by other specifications; they do not alter this release path until included in a tagged candidate.

## Documents

[Stories](USER_STORIES.md) · [Use cases](USE_CASES.md) · [Research](RESEARCH.md) · [Requirements](REQUIREMENTS.md) · [FR](FR.md) · [NFR](NFR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](plugin-distribution.feature) · [Fixtures](FIXTURES.md) · [Schemas](plugin-distribution_SCHEMA.md)

Local IDs become qualified outside this directory, for example `plugin-distribution:FR-10`.

## Current lifecycle contract

The current compatibility profile targets OMP 18.0.10. Future package updates require immutable runtime, install, reload, fresh-session, and rollback evidence.
