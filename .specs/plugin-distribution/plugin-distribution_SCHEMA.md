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
| `$schema` | string URI | yes | Exact `https://anthropic.com/claude-code/marketplace.schema.json`, as referenced by the pinned OMP v17.3.7 marketplace documentation. |
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

Path: `plugins/omp-spec-kit/package.json`. No other `package.json` may occur beneath `plugins/omp-spec-kit/`. Pinned OMP v17.3.7 recursively copies this entire directory with `fs.cp`; `package.json#files` does not filter installation.

| Field | Type | Required | v0.1.0 value/policy |
|---|---|---:|---|
| `name` | string | yes | Exact `omp-spec-kit`. |
| `version` | semver string | yes | Exact `0.1.0`. |
| `description` | non-empty string | yes | Evidence-honest plugin description. |
| `homepage` | URL string | yes | Canonical public repository URL. |
| `repository` | string or `{type,url,directory?}` | yes | Canonical repository; if object, `type` is `git` and `directory` is `plugins/omp-spec-kit`. |
| `license` | SPDX string | yes | Exact license approved by provenance gate. |
| `type` | string | yes | Exact `module`. |
| `files` | string array | yes | Exact ordered values: `package.json`, `README.md`, `LICENSE`, `dist/`, `skills/`, `commands/`. |
| `engines` | object | yes | Closed object `{ "omp": "17.3.7" }`. |
| `omp` | object | yes | Closed OMP object below. |
| `scripts` | object | no | Forbidden; build and verification scripts live at repository root and are not copied into the payload. |
| `dependencies` | object | no | Forbidden; v0.1.0 has no non-host runtime dependency. |
| `devDependencies` | object | no | Forbidden; the installed child is not a build workspace. |

Unknown fields are rejected by the product package-shape validator. The complete child tree is exactly `package.json`, `README.md`, `LICENSE`, `dist/{extension.js,inventory.js,manifest.json}`, `skills/spec-inventory/SKILL.md`, and `commands/spec-inventory.md`; every entry is a real directory or regular file, never a symlink. `dist/manifest.json` is canonical deterministic JSON with schema `omp-spec-kit-dist-manifest@1`, plugin version `0.1.0`, and SHA-256 values for the two JavaScript files. Fields commonly used for npm publication (`main`, `module`, `exports`, `bin`, `publishConfig`), lifecycle/build scripts, dependencies, and `private` are forbidden.

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

## 9. Distribution producer receipt and claim matrix

Distribution evidence is a bundle of content-addressed producer receipts used for structural diagnostics. It is never inferred from a stage name, a free-form `claims` list, `.feature` text, or an aggregate eligibility object, and it is not current release authority.

`omp-spec-kit-distribution-evidence@1` has the exact candidate identity fields,
`ompRevision`, closed `platform { os, architecture, fixtureDigest }`,
`applicability`, `mriDiscoveryDigest`, and `records`. Each record has exactly
`requirement`, `claim`, and `receipt`; `receipt` is `{ status: "present", path,
digest }` and binds a copied regular producer artifact below the evidence root.

Each bound artifact is `omp-spec-kit-distribution-producer-receipt@1` with exact
candidate identity, `requirement`, one `claim`, `fixtureDigest`, `ompRevision`,
`platform`, `applicability`, `lifecycle`, `producer { workflow:
"distribution-lifecycle", runId }`, and a non-empty unique `observations` list.
Every observation has exact `id`, `outcome: "passed"`, bounded public `summary`,
and the same `fixtureDigest` as `platform.fixtureDigest`. The evaluator reads the
artifact only through canonical containment: the evidence root, every parent, and
the leaf must be non-symlinks; the leaf's realpath must remain under the root; and
its SHA-256 must equal the record reference.

`workflow`, `runId`, and `observations` remain self-authored JSON metadata:
their bytes are diagnostics, never attacker-proof authority. Two trust roots
exist for the closed input `{ schema:
omp-spec-kit-distribution-evidence-input@1, trust, receipt }`. With
`trust: "untrusted-self-attested"` the evaluator always emits
`distribution-producer-provenance-untrusted:no-independent-trust-root`.
With `trust: "github-artifact-attestation"` the evaluator additionally spawns
the independent verifier
`gh attestation verify <evidence.json> --repo OWNER/REPO --signer-workflow
OWNER/REPO/.github/workflows/distribution-evidence.yml --source-ref
refs/tags/<candidate tag>` after full structural matrix validation; the
signer-workflow path `.github/workflows/distribution-evidence.yml` is a fixed
constant and the source ref is always the candidate tag. Any missing `gh`,
spawn failure, non-zero exit, or timeout yields
`distribution-producer-attestation-unverified:<short reason>` (fail closed).
The certificate identity (Fulcio signer bound to that workflow) and its
timestamps are the trustworthy parts of an attestation; predicate contents are
not attacker-proof and are treated as bounded diagnostics. `gh` availability is
a maintainer CI context obligation, never a plugin-payload dependency.
No supplied JSON can select eligibility by itself; only a verifier-passing
attestation over structurally complete evidence can.

### 9.1 Mandatory evidence matrix

| Requirement | Mandatory claims for every release | Additional candidate-aware claims |
|---|---|---|
| FR-1 | `marketplace-shape` | none |
| FR-2 | `package-shape` | none |
| FR-3 | `inventory` | none |
| FR-4 | `install`, `reload`, `fresh-session-activation`, `inventory` | none |
| FR-5 | `clean-build`, `package-shape`, `deps-absent` | none |
| FR-6 | `inventory-containment` | none |
| FR-7 | `version-consistency` | `upgrade` after the first release |
| FR-8 | `uninstall-preservation`, `reinstall` | `rollback` after the first release |
| FR-9 | `public-safety` | none |
| FR-10 | `release-transaction` | none |
| FR-11 | `evidence-honesty` | none |
| FR-12 | `schema-containment` | none |

For `0.1.0`, upgrade and rollback lifecycle values are `inapplicable`; later
candidates require passed upgrade and rollback receipts. Reinstall is always
passed. A missing, duplicate, foreign, unexpected, non-passed, fixture-mismatched,
unprovenanced, invalid-observation, or self-attested record is blocked.

## 10. `distribution-release-eligibility@1`

This is a closed computed result, never a receipt. `evidenceByRequirement` has
every FR-1 through FR-12 and lists the unique digest of each matrix producer
artifact. Structural validation checks the complete matrix, matching candidate and
platform identity, and verified artifact digests. While the input trust is
`untrusted-self-attested`, or `github-artifact-attestation` without a
verifier-passing attestation, the implementation emits `outcome: "blocked"`
(with `distribution-producer-provenance-untrusted:no-independent-trust-root`
or `distribution-producer-attestation-unverified:<reason>` respectively). The
eligible outcome is reachable only when the input trust is
`github-artifact-attestation`, the full FR-1..FR-12 structural matrix passes,
and the Sigstore attestation from the fixed signer workflow at tag
`refs/tags/<candidate>` verifies; a supplied JSON cannot select that outcome.

## 11. Pinned compatibility boundary

The v0.1.0 implementation authority is OMP v17.3.7 at commit `8500092296621a6826b7136e840f8a59ea338958`; the catalog schema URI is `https://anthropic.com/claude-code/marketplace.schema.json`. Repository validators deliberately enforce the narrower closed product profile regardless of whether the upstream parser preserves additional fields. The child declares no `omp` property beyond `extensions`, and the only supported OMP compatibility row is exact v17.3.7.

Pinned source establishes recursive relative-source copying and extension discovery, but source inspection alone is not fresh-session runtime evidence. Structured `details` behavior and closed-profile loader acceptance remain release-proof obligations for the pinned lifecycle fixture; absence of those receipts keeps release eligibility blocked without weakening the schemas above.

## 12. Executable v0.3.1 evidence envelopes

`omp-spec-kit-release-evidence@3` is the closed assembler output. Its exact fields are
`schema`, candidate identity (`version`, `tag`, `commit`, `candidateDigest`,
`packageTreeDigest`, `archiveSha256`, `catalogDigest`), `mri`, and `distribution`.
It replaces the unqualified v2 `frReceipts` object; no bare `FR-N` key is valid at
this boundary.

`mri` is `omp-spec-kit-mri-evidence@1`: exact fields `schema`, `checks`,
`frReceipts`, and `discovery`. Its six receipt keys are exactly
`mcp-release-integrity:FR-1` through `mcp-release-integrity:FR-6`. `discovery` is a
content-addressed copy of `docs/validation/omp-discovery-v17.3.7.md`; it must prove
the pinned v17.3.7 manager connection and eight-tool handoff. MRI produces only
`mri-release-eligibility@1`; it does not attest `plugin-distribution:FR-13`.

`distribution` is the closed assembler input `{ schema:
"omp-spec-kit-distribution-evidence-input@1", trust, receipt }`, where `trust`
is exactly `untrusted-self-attested` or `github-artifact-attestation`, and
`receipt` is either `{ status: "missing" }` or a content-addressed
`omp-spec-kit-distribution-evidence@1` manifest. The assembler copies
referenced producer receipts into `receipts/distribution/`, rewrites their
references to copied paths, and preserves their digests only for inspection;
copying does not attest them. The verifier rejects a symlinked root, parent,
or leaf; a realpath escape; a non-regular file; a digest mismatch; or any
missing matrix cell. With `untrusted-self-attested` the input remains blocked
with `distribution-producer-provenance-untrusted:no-independent-trust-root`.
With `github-artifact-attestation` and a structurally complete matrix, the
verifier spawns `gh attestation verify` against the copied evidence subject,
the fixed signer workflow `.github/workflows/distribution-evidence.yml`, and
source ref `refs/tags/<candidate tag>`; any failure adds
`distribution-producer-attestation-unverified:<short reason>` without echoing
subject bytes. Certificate identity and timestamps are the trusted parts of
the attestation; predicate bytes remain diagnostics.

The composed evaluator result is `public-release-eligibility@1` with the candidate
identity, `mri`, `distribution`, `eligible`, and namespaced `blocking`. A
supplied distribution bundle alone never produces eligibility: an eligible
result requires eligible MRI, a structurally complete FR-1..FR-12 matrix, and a
verifier-passing `github-artifact-attestation` trust root over the exact
evidence subject.
