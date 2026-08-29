# Specification Changelog

## Unreleased — Specification baseline

- Added representable inventory result-byte bounds, the exact commit-pinned `.mcp.json` schema URI, and exact bidirectional FR/CHK/NFR task ownership.

### Added

- Defined the invariant of one repository-root OMP marketplace, one `plugins/omp-spec-kit` child package, and one built extension entry.
- Defined the v0.1.0 `spec_inventory` request, result, entry, diagnostic, and evidence receipt contracts.
- Distinguished install, reload, fresh-session activation, invocation, uninstall, and exact-version reinstall for `0.1.0`, while deferring upgrade-from-prior and rollback-to-prior proof until the first subsequent release.
- Added dependency-absent packaging, provenance, license, secret, public-path, version, and GitHub Actions release gates.
- Added FR-13 aggregate release eligibility: complete current mandatory FR-1..FR-12 evidence is required, and partial stage/job success cannot publish.
- Added explicit negative cases for duplicate/nested topology, path/link escape, malformed/unbounded inputs, stale evidence, version mismatch, release overwrite, partial evidence sets, and project mutation.

### Current delivered descendant

- The one-marketplace/one-plugin/one-extension topology is publicly delivered at v0.3.2.
- Public tag commit, candidate/package/archive digests, lifecycle receipt identities and GitHub release attestation are recorded in `docs/validation/release-status-v0.3.2.json`.
- This changelog records the specification's evolution; scenario text is not execution evidence unless tied to those producer receipts.

### Contract repair

- Made GitHub Artifact Attestations the current normative producer trust root with exact repository, signer-workflow, source-ref and subject binding plus closed verifier failures.
- Defined forward `distribution-release-eligibility@2` as distribution-only; MRI stays with `mcp-release-integrity` and product/public composition stays with `product:FR-6`.
- Reconciled historical v0.1.0 and delivered v0.3.2 child/build/lifecycle profiles, current file existence and task statuses.
- Preserved historical v0.3.2 `public-release-eligibility@1` receipts without making that composed shape the forward distribution API.

## Release-history policy

Historical v0.1/v0.2/v0.3 contracts and receipts remain immutable. New capability releases must preserve the same single-product topology and satisfy their current product aggregate; a new release entry is added only after the exact tagged candidate and trust-root evidence pass.
