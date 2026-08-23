# Functional Requirements

All IDs are local in source documents. Runtime and cross-spec identifiers MUST use the qualified form `plugin-distribution:<local-id>`.

## FR-1 — Single marketplace topology

The repository SHALL expose exactly one OMP marketplace catalog at `.omp-plugin/marketplace.json`. That catalog SHALL contain exactly one plugin entry named `omp-spec-kit` with `source: "./plugins/omp-spec-kit"`. The repository SHALL NOT contain another marketplace catalog, nested marketplace, second plugin entry, external source object, npm source, or path escaping the repository root.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-single-marketplace-topology)

**Scenario:** [`@feature1`](plugin-distribution.feature)

## FR-2 — Single child package and extension entry

The only installable plugin package SHALL be `plugins/omp-spec-kit`. Its `package.json` SHALL conform to the closed public profile in `plugin-distribution_SCHEMA.md`, identify version `0.1.0`, and contain exactly one `omp.extensions` entry: `./dist/extension.js`. It SHALL NOT declare legacy `pi.extensions`, nested plugin packages, a second extension, source-tree runtime entries, lifecycle install scripts, or an MCP server in v0.1.0.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-single-child-package-and-extension)

**Scenario:** [`@feature2`](plugin-distribution.feature)

## FR-3 — Root-relative bounded inventory

The installed extension SHALL register exactly one v0.1.0 tool, `spec_inventory`. On execution, the tool SHALL derive the active project root from OMP's tool context, resolve only `<project-root>/.specs`, reject root escape including symlink escape, enumerate direct spec directories in deterministic lexical order, apply both caller bounds and hard safety caps, and return the public schema defined in `plugin-distribution_SCHEMA.md`. It SHALL NOT infer the project from package location or process launch directory.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-bounded-root-relative-inventory)

**Scenario:** [`@feature3`](plugin-distribution.feature)

## FR-4 — Install, reload, and fresh-session activation

The documented v0.1.0 lifecycle SHALL separately prove marketplace add/discovery, project-scope install, installed-version observation, `/reload-plugins`, termination of the pre-install session, fresh-session startup, and successful `spec_inventory` invocation from the installed child package. Install success or reload success SHALL NOT be treated as extension/tool activation proof.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-fresh-session-activation), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42-reload-is-not-activation-proof)

**Scenario:** [`@feature4`](plugin-distribution.feature)

## FR-5 — Clean-build dependency-independent package

Release packaging SHALL delete or isolate prior build output, build deterministic runtime output into `plugins/omp-spec-kit/dist/`, and install only an allowlisted child payload. The installed `dist/extension.js` SHALL load and execute with repository-root and source-checkout dependencies absent. Any non-host runtime dependency SHALL be bundled or explicitly shipped inside the child package; ambient root `node_modules`, source files, absolute paths, and dev-pomogator modules are forbidden.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-dependency-absent-execution)

**Scenario:** [`@feature5`](plugin-distribution.feature)

## FR-6 — Read-only diagnostics and failure containment

`spec_inventory` and its factory SHALL perform zero repository writes, state creation, process spawning, network access, credential access, model calls, watchers, locks, database access, repair, mutation, or background work. Missing `.specs`, non-directory `.specs`, malformed entries, permission failures, aborts, and safety-cap truncation SHALL return bounded typed diagnostics and SHALL NOT terminate the OMP session or claim a healthy corpus.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-read-only-negative-cases)

**Scenario:** [`@feature6`](plugin-distribution.feature)

## FR-7 — Version authority and release-aware upgrade

The catalog plugin-entry version, child package version, embedded runtime version, installed tool version, artifact metadata, and GitHub tag SHALL agree (`0.1.0` and `v0.1.0` for the first release). Release `0.1.0` SHALL prove that consistency without requiring a nonexistent prior version. Beginning with the first subsequent release, upgrade proof SHALL start from an actually released lower version, refresh the catalog separately from plugin upgrade, install a strictly newer explicit semver at project scope, then start a fresh session and observe that exact version from the installed tool. Partial, mismatched, or stale-session observations SHALL fail the applicable proof.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-version-consistency), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72-subsequent-release-upgrade)

**Scenario:** [`@feature7`](plugin-distribution.feature)

## FR-8 — Release-aware uninstall, reinstall, and rollback preservation

Every release lifecycle SHALL prove project-scope uninstall followed by a fresh session in which the capability is absent, then explicit reinstall of the same verified candidate artifact followed by reload, a new fresh session, and successful invocation reporting that candidate version. This is the removal/recovery proof required for `0.1.0` without any prior-release dependency. Beginning with the first subsequent release, the lifecycle SHALL additionally prove rollback by reinstalling an explicitly selected prior released catalog version, reloading, starting a fresh session, and observing that prior version. Marketplace removal alone, cache deletion alone, or use of an old session SHALL NOT count. Every applicable transition SHALL preserve project and `.specs` hashes outside OMP-managed plugin state.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-candidate-uninstall-and-reinstall), [AC-8.2](ACCEPTANCE_CRITERIA.md#ac-82-subsequent-release-rollback)

**Scenario:** [`@feature8`](plugin-distribution.feature)

## FR-9 — Provenance, license, secret, and package gates

Before a public artifact or release is created, automation SHALL verify imported-file provenance against the immutable source commit and hashes, approved license disposition, zero secret findings, absence of local/user state and evidence leakage, a clean public diff, and an allowlisted packaged file set. Unknown license, provenance mismatch, credential-like material, `.env`, logs, local caches, OMP user state, or unapproved artifacts SHALL block publication.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-public-safety-gates)

**Scenario:** [`@feature9`](plugin-distribution.feature)

## FR-10 — GitHub Actions release transaction

GitHub Actions SHALL run independent verification jobs for public safety/provenance, schema/cardinality, clean build/package, dependency-absent load, lifecycle BDD, and version/release consistency. The release job SHALL require all jobs, build from the tagged immutable commit, download the verified artifact by digest, reject version/tag mismatch, and create the GitHub release exactly once. Pull requests and untagged pushes SHALL verify but SHALL NOT publish. Reruns SHALL not overwrite a different release artifact.

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

The release evaluator SHALL produce `distribution-release-eligibility@1` and mark a candidate eligible only when it has a complete mandatory evidence set for every requirement FR-1 through FR-12, with every receipt current, passed, mutually consistent, and bound to the same commit, OMP pin, platform fixture, catalog digest, artifact digest, and candidate version. For `0.1.0`, the mandatory lifecycle set SHALL include version consistency, clean installation, reload observation, fresh-session activation and `spec_inventory` invocation, project-scope uninstall with fresh-session absence, and reinstall of the same `0.1.0` artifact with fresh-session invocation; prior-version upgrade and rollback receipts SHALL be inapplicable rather than missing. Beginning with the first subsequent release, upgrade-from-prior and rollback-to-prior receipts SHALL also be mandatory. A passing job, stage, badge, partial receipt set, or aggregate status that lacks any mandatory FR-1..FR-12 evidence SHALL NOT make the release eligible.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-complete-candidate-aware-release-evidence)

**Scenario:** [`@feature13`](plugin-distribution.feature)
