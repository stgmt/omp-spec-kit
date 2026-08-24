# Acceptance Criteria

These criteria describe required future observations. They are not claims of execution.

## AC-1.1 — Single marketplace topology

**WHEN** the release validator scans the complete repository tree **THEN** it SHALL find exactly one marketplace catalog at `.omp-plugin/marketplace.json`, exactly one catalog plugin named `omp-spec-kit`, and exactly `source: "./plugins/omp-spec-kit"`; **AND WHEN** a duplicate catalog, plugin entry, nested marketplace, external source, or root-escaping source is planted **THEN** validation SHALL fail before build or release.

**Trace:** FR-1; `@feature1`.

## AC-2.1 — Single child package and extension

**WHEN** the child manifest is validated **THEN** it SHALL resolve exactly one package at `plugins/omp-spec-kit` and one extension entry `./dist/extension.js`; **AND WHEN** a nested package, legacy `pi.extensions`, second extension, source entry, install script, or v0.1.0 MCP entry is planted **THEN** validation SHALL fail.

**Trace:** FR-2; `@feature2`.

## AC-3.1 — Bounded root-relative inventory

**WHEN** `spec_inventory` runs from a fresh session rooted at a fixture project **THEN** it SHALL inspect only `<project-root>/.specs`, return direct spec directories in lexical order, apply request bounds and hard caps, expose only normalized project-relative paths, and report truncation explicitly; **AND IF** current working directory, package location, or a link would escape the project **THEN** it SHALL not traverse the escape.

**Trace:** FR-3; `@feature3`.

## AC-4.1 — Fresh-session activation

**WHEN** the marketplace is added, the plugin is discovered and installed with project scope, `/reload-plugins` runs, the pre-install session ends, and a fresh session starts **THEN** `spec_inventory` SHALL execute from the installed `plugins/omp-spec-kit/dist/extension.js` and report version `0.1.0`.

**Trace:** FR-4; `@feature4`.

## AC-4.2 — Reload is not activation proof

**WHEN** installation and `/reload-plugins` complete but no fresh session has started **THEN** the evidence evaluator SHALL record reload completion separately and SHALL refuse an extension-activation or tool-availability claim.

**Trace:** FR-4; `@feature4`.

## AC-5.1 — Dependency-absent execution

**WHEN** previous `dist/` output is absent, a clean build creates the allowlisted child payload, repository-root `node_modules` and the source checkout are unavailable, and that payload is installed **THEN** a fresh session SHALL load the extension and execute `spec_inventory` without resolving an undeclared or ambient dependency.

**Trace:** FR-5; `@feature5`.

## AC-6.1 — Read-only negative cases

**WHEN** the fixture presents missing `.specs`, non-directory `.specs`, malformed documents, unreadable entries, an abort signal, or more entries/diagnostics than allowed **THEN** the tool SHALL return the corresponding bounded status/diagnostic, write zero bytes, perform no network/model/process/background activity, and leave the session usable.

**Trace:** FR-6; `@feature6`.

## AC-7.1 — Version consistency

**WHEN** any release candidate is evaluated **THEN** the catalog entry, child package, embedded runtime, installed tool, artifact metadata, and GitHub tag SHALL identify the exact same candidate semver; for the first release that SHALL be `0.1.0`/`v0.1.0`, with no lower-release prerequisite.

**Trace:** FR-7; `@feature7`.

## AC-7.2 — Subsequent-release upgrade

**GIVEN** the candidate is later than `0.1.0` and a lower version was actually released, **WHEN** that lower release is installed project-scope, the catalog is updated, the plugin is upgraded to the strictly newer candidate, plugin metadata is reloaded, and a fresh session starts **THEN** the installed tool SHALL report the candidate version matching catalog, package, artifact, and tag; catalog refresh alone, a relabeled local candidate, or observation from the old session SHALL not satisfy the criterion.

**Trace:** FR-7; `@feature7`.

## AC-8.1 — Candidate uninstall and reinstall

**GIVEN** the verified candidate artifact is installed project-scope, including candidate `0.1.0`, **WHEN** it is uninstalled **THEN** a fresh project session SHALL not expose its tool and all non-OMP-managed project hashes SHALL equal baseline; **AND WHEN** the exact same candidate artifact is explicitly reinstalled, plugin metadata is reloaded, and another fresh session invokes `spec_inventory` **THEN** the tool SHALL report the candidate version with the same project-hash preservation.

**Trace:** FR-8; `@feature8`.

## AC-8.2 — Subsequent-release rollback

**GIVEN** a release later than `0.1.0` is installed and its immediately applicable prior version was actually released, **WHEN** that prior version is explicitly installed for rollback, reloaded, and started fresh **THEN** the tool SHALL report the prior version and all non-OMP-managed project hashes SHALL equal baseline.

**Trace:** FR-8; `@feature8`.

## AC-9.1 — Public-safety gates

**WHEN** a provenance hash or source commit differs, a license is unknown, a secret-like fixture is outside the designated scanner test fixture, a local-state path is packaged, the public diff is dirty, or the packaged-path allowlist is exceeded **THEN** the public artifact and release jobs SHALL stop without publishing.

**Trace:** FR-9; `@feature9`.

## AC-10.1 — GitHub Actions release transaction

**WHEN** a `v0.1.0` tag targets an immutable commit **THEN** GitHub Actions SHALL publish only after every required verification job succeeds, all version authorities match, FR-13 reports aggregate eligibility, and the release job consumes the verified artifact digest; **AND IF** the event is a pull request/untagged push, a required job fails, aggregate eligibility is blocked, the release exists with a different digest, or permissions are broader than required **THEN** no release SHALL be created or replaced.

**Trace:** FR-10; `@feature10`.

## AC-11.1 — No claim before proof

**WHEN** any applicable lifecycle receipt is missing, stale, belongs to another commit/version/OMP pin, lacks artifact digest or project-hash evidence, or represents only feature text/structural validation **THEN** every public status surface SHALL remain `SPEC_ONLY/NOT_READY` and the release job SHALL be ineligible.

**Trace:** FR-11; `@feature11`.

## AC-12.1 — Schema and containment negative cases

**WHEN** a request has unknown properties, invalid limits, unsupported schema version, duplicate slug, unsafe path/link, oversized result, or a diagnostic containing a forbidden absolute path, stack, secret, environment value, or file content **THEN** the tool SHALL fail closed or sanitize to the defined public schema, return a bounded diagnostic, and disclose none of the forbidden data.

**Trace:** FR-12; `@feature12`.

## AC-13.1 — Complete candidate-aware release evidence

**WHEN** release eligibility is evaluated **THEN** it SHALL emit independently named `mri-release-eligibility@1`, `distribution-release-eligibility@1`, and composed `public-release-eligibility@1`; MRI SHALL contain only `mcp-release-integrity:FR-1..FR-6` and the pinned manager receipt, while distribution SHALL validate every exact per-FR claim-matrix cell as a regular, canonical-contained, content-addressed producer receipt. Every producer receipt SHALL agree on candidate version, commit, OMP pin, platform fixture and fixture digest, catalog/package/archive digest, applicability, lifecycle, and passed observations. **IF** any matrix cell or receipt is missing, duplicate, foreign, placeholder, symlinked, failed, stale, mismatched, or only a passing job summary, public eligibility SHALL be blocked. **AND IF** structurally complete receipts provide only self-authored `workflow`/`runId` metadata and observations, public eligibility SHALL remain blocked with `distribution-producer-provenance-untrusted:no-independent-trust-root`; no current optional JSON input is release authority. Eligibility is reserved for a future separately implemented independently verifiable producer-attestation path.

**Trace:** FR-13; `@feature13`.
