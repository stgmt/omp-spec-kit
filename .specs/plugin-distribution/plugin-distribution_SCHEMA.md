# Plugin Distribution Public Schemas

This document is normative for v0.1.0. `additionalProperties` is false for every public object unless a table explicitly says otherwise. Strings are UTF-8. Public paths are normalized `/`-separated project-relative paths and never begin with `/`, a drive prefix, `..`, `~`, or a URI scheme.

## 1. Runtime canonical identifiers

| Kind | Format | Example |
|---|---|---|
| Requirement | `<spec-slug>:FR-<n>` | `plugin-distribution:FR-3` |
| Acceptance criterion | `<spec-slug>:AC-<n>.<m>` | `plugin-distribution:AC-3.1` |
| Feature trace tag | `<spec-slug>:@feature<n>` | `plugin-distribution:@feature3` |
| Stable scenario ID | `SCEN-<lower-kebab>` | `SCEN-require-complete-release-evidence` |

`spec-slug` matches `^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$`. Scenario IDs match `^SCEN-[a-z0-9]+(?:-[a-z0-9]+)*$` and are unique within the feature. Bare IDs are valid only inside their owning source documents.

## 2. Marketplace catalog profile

Path: `.omp-plugin/marketplace.json`. Exactly one such file exists in the repository. JSON duplicate keys are invalid.

### 2.1 Top-level fields

| Field | Type | Required | v0.1.0 value/policy |
|---|---|---:|---|
| `$schema` | string URI | yes | Exact marketplace schema URI selected and pinned during implementation; current docs illustrate `https://anthropic.com/claude-code/marketplace.schema.json`. |
| `name` | string | yes | Exact `omp-spec-kit`; OMP naming grammar applies. |
| `owner` | object | yes | Closed owner object below. |
| `metadata` | object | yes | Closed metadata object below. |
| `plugins` | array | yes | `minItems: 1`, `maxItems: 1`; one plugin-entry object. |

No fallback `.claude-plugin/marketplace.json`, top-level `description`, or unknown top-level field is permitted by the product profile even if an upstream parser preserves extra fields.

### 2.2 Owner object

| Field | Type | Required | v0.1.0 policy |
|---|---|---:|---|
| `name` | string | yes | Exact `stgmt`. |
| `email` | string email | no | Omitted unless a public, monitored project address is approved. Personal/local addresses are forbidden. |

### 2.3 Metadata object

| Field | Type | Required | v0.1.0 policy |
|---|---|---:|---|
| `description` | non-empty string | yes | Public description of the single OMP spec-kit plugin; no readiness claim without evidence. |
| `version` | semver string | yes | Exact `0.1.0`; informational marketplace version and checked for equality by this product. |
| `pluginRoot` | string | no | MUST be omitted because the entry already uses `./plugins/omp-spec-kit`; double-prefix ambiguity is forbidden. |

### 2.4 Catalog plugin-entry object — exhaustive upstream-documented fields

| Field | Documented type | Upstream required | v0.1.0 product policy |
|---|---|---:|---|
| `name` | string | yes | Required; exact `omp-spec-kit`. |
| `source` | string or source object | yes | Required; exact relative string `./plugins/omp-spec-kit`; all object forms forbidden. |
| `description` | string | no | Required by product; bounded public description. |
| `version` | string | no | Required by product; exact semver `0.1.0`. |
| `author` | object `{name, email?}` | no | Required by product; `name: "stgmt"`; approved public email optional. |
| `homepage` | URL string | no | Required by product; canonical public repository URL. |
| `repository` | URL/string | no | Required by product; canonical public Git repository URL. |
| `license` | string | no | Required by product; exact approved SPDX identifier after provenance/license gate. |
| `keywords` | string array | no | Optional; unique lowercase bounded public keywords. |
| `category` | string | no | Required by product; exact approved category such as `development`. |
| `tags` | string array | no | Optional; unique bounded public tags. |
| `strict` | boolean | no | Forbidden/omitted; upstream preserves but does not use it for install/runtime behavior. |
| `commands` | metadata | no | Forbidden/omitted; runtime commands are discovered from the installed tree and no catalog duplicate is allowed. |
| `agents` | metadata | no | Forbidden/omitted in v0.1.0. |
| `hooks` | metadata | no | Forbidden/omitted in v0.1.0. |
| `mcpServers` | metadata | no | Forbidden/omitted in v0.1.0. |
| `lspServers` | map or in-plugin path | no | Forbidden/omitted in v0.1.0. |
| `dapAdapters` | map or in-plugin JSON/YAML path | no | Forbidden/omitted in v0.1.0. |

Documented `source` variants are: relative string; `{source:"url",url,sha?}`; `{source:"github",repo,ref?,sha?}`; `{source:"git-subdir",url,path,ref?,sha?}`; and `{source:"npm",package,version?}`. The product accepts only the exact relative string. A direct catalog URL cannot support this relative source and is outside the release proof.

## 3. Child package manifest profile

Path: `plugins/omp-spec-kit/package.json`. No other `package.json` may occur beneath `plugins/omp-spec-kit/`.

| Field | Type | Required | v0.1.0 value/policy |
|---|---|---:|---|
| `name` | string | yes | Exact `omp-spec-kit`. |
| `version` | semver string | yes | Exact `0.1.0`. |
| `description` | non-empty string | yes | Evidence-honest plugin description. |
| `homepage` | URL string | yes | Canonical public repository URL. |
| `repository` | string or `{type,url,directory?}` | yes | Canonical repository; if object, `type` is `git` and `directory` is `plugins/omp-spec-kit`. |
| `license` | SPDX string | yes | Exact license approved by provenance gate. |
| `type` | string | yes | Exact `module`. |
| `files` | string array | yes | Closed package allowlist; includes `dist/` and approved user guidance only, excludes `src/`, tests, secrets, state, and evidence. |
| `scripts` | object string map | yes | Only deterministic build/package verification scripts; `preinstall`, `install`, `postinstall`, `prepare`, network fetch, and user-state mutation scripts are forbidden. |
| `engines` | object | yes | Exact supported OMP/Bun/Node constraints chosen after pinning; no wildcard. |
| `omp` | object | yes | Closed OMP object below. |
| `dependencies` | object semver map | no | Omitted if fully bundled/host-provided; otherwise every runtime dependency is bundled or shipped and proven dependency-absent. |
| `devDependencies` | object semver map | no | Build-only exact/ranged inputs; never required by installed runtime. |

Unknown fields are rejected by the product package-shape validator. Fields commonly used for npm publication (`main`, `module`, `exports`, `bin`, `publishConfig`) are forbidden unless a later specification expands the marketplace contract. `private` is forbidden for the installable release manifest because this package is a marketplace payload rather than an unpublished workspace marker.

### 3.1 `omp` object and extension entry

| Field | Type | Required | v0.1.0 value/policy |
|---|---|---:|---|
| `extensions` | string array | yes | `minItems: 1`, `maxItems: 1`, unique; sole value `./dist/extension.js`. |

No other `omp` property is accepted in v0.1.0. Legacy `pi.extensions` is forbidden. The resolved real path must be a regular file inside the installed child package, have `.js` suffix, and match the verified artifact digest. Directories, symlink escapes, `.ts`/source entries, `.mjs` alternatives, missing files, and duplicate normalized paths are invalid for this product profile.

## 4. Extension factory contract

The module exports one default `ExtensionFactory`. During load it may only:

1. obtain host-provided schema builders such as `pi.zod`;
2. set a stable extension label; and
3. call `pi.registerTool` once for `spec_inventory`.

It returns `void` or a resolved promise after registration. It does not scan, execute the tool, message, write, spawn, fetch, start timers, register events, commands, hooks, providers, MCP, LSP, DAP, or a second tool during v0.1.0 factory load.

### 4.1 Registered tool descriptor

| Field | Type | Required | Contract |
|---|---|---:|---|
| `name` | string | yes | Exact `spec_inventory`. |
| `label` | string | yes | Stable human label. |
| `description` | string | yes | States bounded read-only inventory and active project root. |
| `parameters` | host schema | yes | Validates `spec-inventory-request@1`; rejects unknown properties. |
| `execute` | async function | yes | Uses execution `ctx.cwd` as project root, honors abort signal, returns bounded content and `details`. |

## 5. `spec-inventory-request@1`

All fields are optional; omission selects documented defaults.

| Field | Type | Required | Default | Constraint |
|---|---|---:|---:|---|
| `schemaVersion` | literal string | no | `1` | If present, exact `1`; another value yields `UNSUPPORTED_SCHEMA_VERSION`. |
| `maxSpecs` | integer | no | 50 | Minimum 1, maximum hard cap 200. |
| `maxDiagnostics` | integer | no | 25 | Minimum 0, maximum hard cap 100. |
| `includeDocumentCounts` | boolean | no | `true` | Counts only regular direct files with canonical document names; never reads contents for this count. |

Unknown properties, non-integers, `NaN`, infinities, strings in numeric fields, or values outside ranges are rejected before filesystem access.

## 6. `spec-inventory-result@1`

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `schemaVersion` | literal `1` | yes | Public contract version. |
| `tool` | literal `spec_inventory` | yes | Tool identity. |
| `pluginVersion` | semver string | yes | Embedded build version; `0.1.0` for first release. |
| `status` | enum | yes | `ok`, `absent`, `invalid`, `partial`, `aborted`, or `error`. |
| `root` | literal `.specs` | yes | Never absolute. |
| `specs` | `spec-inventory-entry@1[]` | yes | Lexically sorted by `slug`; maximum requested/hard limit. |
| `diagnostics` | `spec-inventory-diagnostic@1[]` | yes | Maximum requested/hard limit. |
| `counts` | object | yes | Closed counts object below. |
| `truncated` | boolean | yes | True if any eligible spec/diagnostic was omitted by a bound. |
| `readOnly` | literal `true` | yes | Contract assertion backed by test instrumentation, not self-sufficient proof. |

### 6.1 Counts object

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `returnedSpecs` | integer | yes | `0..200`, equals `specs.length`. |
| `observedSpecs` | integer or null | yes | Non-negative count when known without exceeding safe scan; `null` when aborted/unsafe/unavailable. |
| `returnedDiagnostics` | integer | yes | `0..100`, equals `diagnostics.length`. |

No timing, hostname, username, package cache path, process path, environment, source contents, or unbounded observed list is public output.

## 7. `spec-inventory-entry@1`

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `slug` | string | yes | Directory basename matching the canonical slug grammar. |
| `path` | string | yes | Exact `.specs/<slug>` normalized relative path. |
| `status` | enum | yes | `recognized`, `incomplete`, `invalid`, or `unreadable`. Never `passing`/`ready`. |
| `documentCount` | integer or null | yes | `0..15` when requested/available; otherwise `null`. |
| `missingDocuments` | canonical-document-name array | yes | Bounded to 15 unique lexical names; empty does not claim semantic validity. |

Canonical document names are: `README.md`, `USER_STORIES.md`, `USE_CASES.md`, `RESEARCH.md`, `REQUIREMENTS.md`, `FR.md`, `NFR.md`, `ACCEPTANCE_CRITERIA.md`, `DESIGN.md`, `TASKS.md`, `FILE_CHANGES.md`, `CHANGELOG.md`, `<slug>.feature`, `FIXTURES.md`, and `<slug>_SCHEMA.md`.

## 8. `spec-inventory-diagnostic@1`

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `code` | enum | yes | One stable code from the list below. |
| `severity` | enum | yes | `info`, `warning`, or `error`. |
| `path` | string or null | yes | Safe project-relative path or `null`; never absolute/escaping. |
| `message` | string | yes | Non-empty, one-line, maximum 240 Unicode scalar values. |
| `remediation` | string or null | yes | One-line, maximum 240 values; no executable instruction from repo content. |

Codes are exhaustive for v0.1.0: `SPECS_ABSENT`, `SPECS_NOT_DIRECTORY`, `SPEC_SLUG_INVALID`, `SPEC_DUPLICATE_SLUG`, `SPEC_UNREADABLE`, `SPEC_INCOMPLETE`, `SPEC_ENTRY_INVALID`, `PATH_ESCAPE_BLOCKED`, `SYMLINK_ESCAPE_BLOCKED`, `LIMIT_REACHED`, `DIAGNOSTIC_LIMIT_REACHED`, `REQUEST_ABORTED`, `PERMISSION_DENIED`, `UNSUPPORTED_SCHEMA_VERSION`, `INVALID_REQUEST`, and `INTERNAL_ERROR_REDACTED`.

Errors are mapped to these codes; raw exception messages, stacks, absolute paths, environment values, and file contents are never returned.

## 9. `distribution-evidence-receipt@1`

Receipts are CI artifacts, never shipped in the plugin package and never inferred from `.feature` text.

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `schemaVersion` | literal `1` | yes | Receipt schema. |
| `requirement` | qualified requirement ID | yes | Exact owning ID from `plugin-distribution:FR-1` through `plugin-distribution:FR-12`; FR-13 is computed from these receipts and cannot attest itself. |
| `claim` | enum | yes | `marketplace-shape`, `package-shape`, `clean-build`, `deps-absent`, `install`, `reload`, `fresh-session-activation`, `inventory`, `inventory-containment`, `version-consistency`, `upgrade`, `uninstall-preservation`, `reinstall`, `rollback`, `public-safety`, `release-transaction`, `evidence-honesty`, `schema-containment`, or `release-consistency`. |
| `outcome` | enum | yes | `passed`, `failed`, or `blocked`; no `skipped` success. |
| `commit` | lowercase hex SHA | yes | Exact immutable target commit. |
| `ompRevision` | string | yes | Exact OMP version plus commit/image digest; mutable branch alone invalid. |
| `platform` | object | yes | Closed OS, architecture, and fixture-image digest fields. |
| `pluginVersion` | semver | yes | Exact candidate/installed version. |
| `catalogDigest` | `sha256:<64hex>` | yes | Catalog bytes. |
| `artifactDigest` | `sha256:<64hex>` | yes | Installed/published payload. |
| `fixtureDigest` | `sha256:<64hex>` | yes | Fixture input. |
| `startedAt` | RFC 3339 timestamp | yes | UTC. |
| `finishedAt` | RFC 3339 timestamp | yes | UTC and not earlier than start. |
| `observations` | bounded array | yes | Stable step id, outcome, bounded public summary, optional safe project-relative evidence path. |
| `projectHashesBefore` | object map | conditional | Required for install, upgrade, uninstall-preservation, reinstall, and rollback claims. |
| `projectHashesAfter` | object map | conditional | Same key set and digest values for preservation claims. |

A receipt is current only when all identity/digest fields match the release candidate and every required observation passed. Missing, foreign, stale, blocked, or failed receipts cannot support a public claim.

### 9.1 Mandatory evidence matrix

| Requirement | Mandatory claims for every release | Additional candidate-aware claims |
|---|---|---|
| FR-1 | `marketplace-shape` | none |
| FR-2 | `package-shape` | none |
| FR-3 | `inventory` | none |
| FR-4 | `install`, `reload`, `fresh-session-activation`, `inventory` | none |
| FR-5 | `clean-build`, `package-shape`, `deps-absent` | none |
| FR-6 | `inventory-containment` | none |
| FR-7 | `version-consistency` | `upgrade` only beginning with the first subsequent release |
| FR-8 | `uninstall-preservation`, `reinstall` | `rollback` only beginning with the first subsequent release |
| FR-9 | `public-safety` | none |
| FR-10 | `release-transaction` | none |
| FR-11 | `evidence-honesty` | none |
| FR-12 | `schema-containment` | none |

For `0.1.0`, `upgrade` and `rollback` are explicitly inapplicable, not absent failures. For every later candidate they are mandatory and must name real public from/to versions. Exact-candidate reinstall remains mandatory for every release; no other matrix cell may be marked inapplicable.

## 10. `distribution-release-eligibility@1`

This closed object is computed by the release evaluator after receipt validation. It is never accepted as a substitute receipt and is never inferred from workflow stage status.

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `schemaVersion` | literal `1` | yes | Eligibility schema. |
| `candidateVersion` | semver | yes | Exact candidate version. |
| `releasePosition` | enum | yes | `first` only for `0.1.0`; otherwise `subsequent`. |
| `commit` | lowercase hex SHA | yes | Same value on every supporting receipt. |
| `ompRevision` | string | yes | Same pinned value on every supporting receipt. |
| `platform` | object | yes | Same closed platform identity on every supporting receipt. |
| `catalogDigest` | `sha256:<64hex>` | yes | Same value on every supporting receipt. |
| `artifactDigest` | `sha256:<64hex>` | yes | Same value on every supporting receipt. |
| `mandatoryRequirements` | qualified requirement ID array | yes | Exactly the 12 unique IDs `plugin-distribution:FR-1` through `plugin-distribution:FR-12`. |
| `evidenceByRequirement` | closed object | yes | Exactly one key per mandatory requirement; each value is a non-empty unique array of supporting receipt digests satisfying the matrix. |
| `applicability` | closed object | yes | `upgrade` and `rollback` are `inapplicable` only for `0.1.0`; `reinstall` is always `mandatory`; upgrade and rollback are `mandatory` for subsequent releases. |
| `outcome` | enum | yes | `eligible` or `blocked`. |
| `blockingReasons` | bounded array | yes | Empty only when eligible; otherwise identifies every missing, failed, blocked, stale, mismatched, or inapplicable-without-authority matrix item. |

`outcome: eligible` is valid only when all 12 requirement keys are present, all mandatory claims for the candidate profile have current passed receipts, all shared identity fields are equal, and `blockingReasons` is empty. A partial object, an empty evidence array, a passed job/stage summary, or an aggregate object that cites itself is invalid and yields `blocked`.

## 11. Unresolved upstream compatibility questions


The following remain blocking implementation-time checks:

1. Which exact OMP release/commit and marketplace JSON Schema URI are pinned for v0.1.0?
2. Does that pin enforce or merely preserve unknown catalog fields, and does it accept the closed profile without compatibility translation?
3. Which exact `package.json#omp` properties exist at that pin beyond `extensions`, if any, and are they ignored or validated?
4. What stable structured tool-result `details` behavior is guaranteed to callers at that pin?
5. Which OMP versions/platforms form the supported compatibility matrix for release receipts?

Until answered against pinned source/runtime evidence, these are `[SINGLE_SOURCE]` uncertainties and the release remains `SPEC_ONLY/NOT_READY`.
