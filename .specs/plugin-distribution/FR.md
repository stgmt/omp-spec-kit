# Functional Requirements

All IDs are local in source documents. Runtime and cross-spec identifiers MUST use the qualified form `plugin-distribution:<local-id>`.

## FR-1 — Single marketplace topology

The repository SHALL expose exactly one OMP marketplace catalog at `.omp-plugin/marketplace.json`. That catalog SHALL contain exactly one plugin entry named `omp-spec-kit` with `source: "./plugins/omp-spec-kit"`. The repository SHALL NOT contain another marketplace catalog, nested marketplace, second plugin entry, external source object, npm source, or path escaping the repository root.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-single-marketplace-topology)

**Scenario:** [`@feature1`](plugin-distribution.feature)

## FR-2 — Single child package and extension entry

The only installable plugin package SHALL be `plugins/omp-spec-kit`, with one `omp.extensions` entry `./dist/extension.js` and a version equal to the evaluated candidate. The immutable v0.1.0 profile contained package/README/LICENSE/generated dist/one skill/one command and no MCP entry. The delivered v0.3.2 profile additionally contains exactly one `.mcp.json`, the cross-platform `bin/omp-spec-kit-mcp{,.cmd}` launchers, and generated `dist/{kernel,adapters,mcp}` trees inside the same child. Future capabilities MAY extend only this package through their accepted gates; they SHALL NOT add another package, marketplace, extension entry, MCP server identity, nested manifest/control plane, source/test/evidence files, install scripts, ambient runtime dependencies, or root escape.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-single-child-package-and-extension)

**Scenario:** [`@feature2`](plugin-distribution.feature)

## FR-3 — Root-relative bounded inventory

For historical v0.1.0, the installed extension registered only bounded read-only `spec_inventory`. Each later baseline profile SHALL preserve that contract and declare its additional read-only first-slice surface through the exact kernel/MRI manifest; distribution validates the candidate's declared surface and SHALL NOT turn the v0.3 eight-name first slice into a permanent ceiling. Every inventory execution derives the project root from OMP context, resolves only `<project-root>/.specs`, rejects lexical/link escape, orders deterministically, enforces caller/hard bounds, and returns the versioned public schema without inferring root from package/CWD.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-bounded-root-relative-inventory)

**Scenario:** [`@feature3`](plugin-distribution.feature)

## FR-4 — Install, reload, and fresh-session activation

Each release lifecycle SHALL separately prove marketplace discovery, project-scope install of the exact candidate, installed-version observation, `/reload-plugins`, termination of the pre-install session, fresh-session startup, and invocation of the declared candidate surface from the installed child. Install/reload alone is never activation proof. Current v0.3.2 status additionally binds these receipts to `docs/validation/release-status-v0.3.2.json`.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-fresh-session-activation), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42-reload-is-not-activation-proof)

**Scenario:** [`@feature4`](plugin-distribution.feature)

## FR-5 — Clean-build dependency-independent package

Release packaging SHALL delete prior `plugins/omp-spec-kit/dist/`, copy/rebase the exact root sources `src/v0.1/{extension,inventory}.js` plus closed `src/{kernel,adapters,mcp}` trees, emit a deterministic hash manifest, and reject missing, unexpected, non-regular, or symlink output. Because OMP recursively copies the child source, verification SHALL enforce the complete candidate-profile allowlist including `.mcp.json`/`bin` only for MCP-enabled profiles. Installed extension and MCP launcher SHALL execute with source checkout/root `node_modules` absent; ambient imports, absolute paths, source/build/test/evidence files, native addons, downloads, and undeclared dependencies are forbidden.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-dependency-absent-execution)

**Scenario:** [`@feature5`](plugin-distribution.feature)

## FR-6 — Read-only diagnostics and failure containment

`spec_inventory` and its factory SHALL perform zero repository writes, state creation, process spawning, network access, credential access, model calls, watchers, locks, database access, repair, mutation, or background work. Missing `.specs`, non-directory `.specs`, malformed entries, permission failures, aborts, and safety-cap truncation SHALL return bounded typed diagnostics and SHALL NOT terminate the OMP session or claim a healthy corpus.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-read-only-negative-cases)

**Scenario:** [`@feature6`](plugin-distribution.feature)

## FR-7 — Version authority and release-aware upgrade

Catalog entry version, child package version, embedded runtime version, installed observation, artifact metadata, evidence candidate, and GitHub tag SHALL agree. v0.1.0 requires no prior version; every subsequent profile SHALL prove upgrade from an actual public lower version after separate catalog refresh, exact explicit install, and fresh-session observation. Current v0.3.2 receipts SHALL identify v0.3.0 as the public predecessor and bind upgrade observations to the exact candidate/prior digests. Partial, mismatched, or stale-session observations fail.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-version-consistency), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72-subsequent-release-upgrade)

**Scenario:** [`@feature7`](plugin-distribution.feature)

## FR-8 — Release-aware uninstall, reinstall, and rollback preservation

Every candidate SHALL prove project-scope uninstall plus fresh-session absence, then exact-candidate reinstall/reload/fresh-session invocation with project and `.specs` preservation. Every post-first release SHALL additionally prove rollback to an explicit public prior artifact and fresh-session observation. Current v0.3.2 uses the real v0.3.0 predecessor and the upgrade/rollback receipt digests recorded in `docs/validation/release-status-v0.3.2.json`. Marketplace removal, cache deletion, old-session observation, or unbound prior bytes do not count.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-candidate-uninstall-and-reinstall), [AC-8.2](ACCEPTANCE_CRITERIA.md#ac-82-subsequent-release-rollback)

**Scenario:** [`@feature8`](plugin-distribution.feature)

## FR-9 — Provenance, license, secret, and package gates

Before a public artifact or release is created, automation SHALL verify imported-file provenance against the immutable source commit and hashes, approved license disposition, zero secret findings, absence of local/user state and evidence leakage, a clean public diff, and an allowlisted packaged file set. Unknown license, provenance mismatch, credential-like material, `.env`, logs, local caches, OMP user state, or unapproved artifacts SHALL block publication.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-public-safety-gates)

**Scenario:** [`@feature9`](plugin-distribution.feature)

## FR-10 — GitHub Actions release transaction

GitHub Actions SHALL verify public safety/provenance, schema/cardinality, clean package/dependency-absent execution, lifecycle BDD, version consistency, and the complete distribution evidence matrix. `distribution-evidence.yml` SHALL build and attest the exact evidence subject; `release.yml` SHALL download only a successful run for the peeled tag commit, revalidate candidate identity, verify the fixed GitHub Artifact Attestations trust contract before notes/upload, publish the already verified digest exactly once, and attest published assets. PRs/untagged pushes SHALL not publish; reruns SHALL not overwrite a different release artifact.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-github-actions-release-transaction)

**Scenario:** [`@feature10`](plugin-distribution.feature)

## FR-11 — Evidence-gated claims

No README, changelog, catalog, release notes, badge, tag, task status, or generated report SHALL claim installability, activation, passing scenarios, upgradeability, rollback, or release readiness before corresponding current receipts exist for the same commit, OMP pin, platform fixture, artifact digest, and version. `.feature` text and structural validation are specifications, not executed evidence. Missing, stale, foreign-commit, or internally inconsistent receipts SHALL yield `SPEC_ONLY/NOT_READY` and block release.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-no-claim-before-proof)

**Scenario:** [`@feature11`](plugin-distribution.feature)

## FR-12 — Public inventory contract and containment

The request, result, entry, diagnostic, and evidence receipt schemas SHALL be versioned and exhaustively defined in `plugin-distribution_SCHEMA.md`. Unknown request properties, invalid bounds, duplicate spec slugs, unsupported schema versions, non-relative paths, unsafe link targets, or result over hard limits SHALL fail closed with a typed diagnostic. Paths in public results SHALL be normalized project-relative paths; absolute paths, usernames, environment values, file contents, credentials, stack traces, and host state SHALL never be returned.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-schema-and-containment-negative-cases)

**Scenario:** [`@feature12`](plugin-distribution.feature)

## FR-13 — Aggregate release eligibility

The distribution evaluator SHALL compute only `distribution-release-eligibility@2` for the exact FR-1..FR-12 claim matrix. Every cell SHALL bind a canonical-contained producer receipt to candidate version/tag/commit/digests, OMP pin, platform fixture, applicability, lifecycle and observations. Self-authored metadata alone SHALL remain blocked. The current normative independent trust root is GitHub Artifact Attestations over the exact evidence subject, verified with repository `stgmt/omp-spec-kit` (or exact trusted `GITHUB_REPOSITORY`), fixed signer workflow `stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml`, and source ref `refs/tags/<candidate-tag>`; missing `gh`, unpinned repo, wrong signer workflow, wrong source ref, subject/hash mismatch, verifier timeout/nonzero/spawn error, or incomplete matrix SHALL fail closed. Predicate JSON is diagnostic, not trust authority. MRI eligibility remains owned by `mcp-release-integrity`; baseline/capability/public delivery conjunction remains owned by `product:FR-6`. Historical v0.3.2 `public-release-eligibility@1` receipts remain evidence but SHALL NOT define the forward distribution evaluator.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-complete-candidate-aware-release-evidence)

**Scenario:** [`@feature13`](plugin-distribution.feature)
