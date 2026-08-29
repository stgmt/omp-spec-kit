# Acceptance Criteria

These criteria describe required future observations. They are not claims of execution.

## AC-1.1 — Single marketplace topology

**WHEN** the release validator scans the complete repository tree **THEN** it SHALL find exactly one marketplace catalog at `.omp-plugin/marketplace.json`, exactly one catalog plugin named `omp-spec-kit`, and exactly `source: "./plugins/omp-spec-kit"`; **AND WHEN** a duplicate catalog, plugin entry, nested marketplace, external source, or root-escaping source is planted **THEN** validation SHALL fail before build or release.

**Trace:** FR-1; `@feature1`.

## AC-2.1 — Single child package and extension

**WHEN** a candidate child manifest/tree is validated **THEN** it SHALL resolve one package and one extension entry `./dist/extension.js`, match the candidate version, and match its closed profile (historical v0.1.0 without MCP; delivered v0.3.2 with one `.mcp.json`, two launchers, and generated kernel/adapters/mcp trees); **AND** nested package/catalog, legacy entry, second extension/server/control plane, source/test/evidence file, install script, ambient dependency, or profile-mismatched MCP surface SHALL fail.

**Trace:** FR-2; `@feature2`.

## AC-3.1 — Bounded root-relative inventory

**WHEN** `spec_inventory` runs from a fresh session rooted at a fixture project **THEN** it SHALL inspect only `<project-root>/.specs`, return direct spec directories in lexical order, apply request bounds and hard caps, expose only normalized project-relative paths, and report truncation explicitly; **AND IF** current working directory, package location, or a link would escape the project **THEN** it SHALL not traverse the escape.

**Trace:** FR-3; `@feature3`.

## AC-4.1 — Fresh-session activation

**WHEN** the exact candidate is discovered and installed project-scope, `/reload-plugins` runs, the pre-install session ends, and a fresh session starts **THEN** the declared installed surface SHALL execute from `plugins/omp-spec-kit/dist/**` and report the exact candidate version; current v0.3.2 observations SHALL bind to `docs/validation/release-status-v0.3.2.json`.

**Trace:** FR-4; `@feature4`.

## AC-4.2 — Reload is not activation proof

**WHEN** installation and `/reload-plugins` complete but no fresh session has started **THEN** the evidence evaluator SHALL record reload completion separately and SHALL refuse an extension-activation or tool-availability claim.

**Trace:** FR-4; `@feature4`.

## AC-5.1 — Dependency-absent execution

**WHEN** a clean build creates only the candidate-profile allowlist, repository-root/external `node_modules` and the source checkout are unavailable, and the payload is installed **THEN** a fresh session SHALL load the extension and, for MCP-enabled profiles, launch the MCP server and invoke the declared first-slice surface without undeclared/ambient dependencies.

**Trace:** FR-5; `@feature5`.

## AC-6.1 — Read-only negative cases

**WHEN** the fixture presents missing `.specs`, non-directory `.specs`, malformed documents, unreadable entries, an abort signal, or more entries/diagnostics than allowed **THEN** the tool SHALL return the corresponding bounded status/diagnostic, write zero bytes, perform no network/model/process/background activity, and leave the session usable.

**Trace:** FR-6; `@feature6`.

## AC-7.1 — Version consistency

**WHEN** any candidate is evaluated **THEN** catalog entry, child package, embedded runtime, installed observation, artifact/evidence metadata, and GitHub tag SHALL identify the exact same semver/commit/digests; v0.1.0 has no lower-release prerequisite, while current v0.3.2 SHALL bind the real v0.3.0 predecessor and exact upgrade/rollback receipt digests.

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

**WHEN** a qualifying immutable tag is evaluated **THEN** `distribution-evidence.yml` SHALL build and attest the exact matrix subject, `release.yml` SHALL select only the successful peeled-tag-commit run, verify candidate identity and the fixed GitHub attestation trust contract, publish the already verified digest once, and attest the assets; **AND** PR/untagged events, failed jobs, wrong signer/repo/ref/subject, blocked distribution eligibility, broader-than-needed permissions, or an existing different artifact SHALL not publish/replace.

**Trace:** FR-10; `@feature10`.

## AC-11.1 — No claim before proof

**WHEN** any applicable lifecycle receipt is missing, stale, belongs to another commit/version/OMP pin, lacks artifact digest or project-hash evidence, or represents only feature text/structural validation **THEN** every public status surface SHALL remain `SPEC_ONLY/NOT_READY` and the release job SHALL be ineligible.

**Trace:** FR-11; `@feature11`.

## AC-12.1 — Schema and containment negative cases

**WHEN** a request has unknown properties, invalid limits, unsupported schema version, duplicate slug, unsafe path/link, oversized result, or a diagnostic containing a forbidden absolute path, stack, secret, environment value, or file content **THEN** the tool SHALL fail closed or sanitize to the defined public schema, return a bounded diagnostic, and disclose none of the forbidden data.

**Trace:** FR-12; `@feature12`.

## AC-13.1 — Complete candidate-aware release evidence

**WHEN** distribution eligibility is evaluated **THEN** it SHALL emit only `distribution-release-eligibility@2` for the complete canonical-contained FR-1..FR-12 producer matrix bound to one candidate/OMP/platform/applicability/lifecycle identity. Self-authored metadata SHALL block. Eligibility SHALL require `gh attestation verify` over the exact subject with pinned repository `stgmt/omp-spec-kit` (or exact trusted `GITHUB_REPOSITORY`), signer workflow `stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml`, and source ref `refs/tags/<candidate-tag>`. Missing verifier, unpinned/wrong repo, wrong workflow/ref, subject/hash mismatch, timeout/nonzero/spawn failure, incomplete/duplicate/foreign/stale/symlinked receipt, or passing-summary-only evidence SHALL block. MRI and public/product conjunctions SHALL remain owned by `mcp-release-integrity` and `product:FR-6`; predicate JSON is diagnostic only.

**Trace:** FR-13; `@feature13`.
