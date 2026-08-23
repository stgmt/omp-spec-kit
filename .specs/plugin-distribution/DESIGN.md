# Design

## Architecture

```text
repository root / marketplace root
├── .omp-plugin/marketplace.json          (one catalog, one entry)
└── plugins/omp-spec-kit/                 (one child package)
    ├── package.json                      (one omp.extensions entry)
    ├── dist/extension.js                 (clean-built installed entry)
    └── approved guidance assets          (no second runtime)

fresh OMP session
  -> installed child manifest
  -> dist/extension.js default factory
  -> register spec_inventory
  -> execute with ctx.cwd
  -> bounded reads under <ctx.cwd>/.specs
  -> typed redacted result; zero writes
```

There is no nested marketplace, nested plugin, source-tree entry, v0.1.0 MCP adapter, hook, watcher, writer, or alternate control plane.

## Component responsibilities

| Component | Owns | Does not own |
|---|---|---|
| Root catalog | Marketplace identity, child source, explicit version, public metadata | Runtime commands, extension duplication, install scripts |
| Child manifest | Package identity, package allowlist, one built extension entry | Catalog discovery, nested plugins, user state |
| Extension factory | Registration of one tool | Inventory execution during load, runtime actions, side effects |
| Inventory executor | Root resolution, bounded enumeration, schema mapping, redaction | Graph semantics, authoring, repairs, claims of readiness |
| Distribution verifier | Cardinality, clean build, package/dependency proof, lifecycle receipts, FR-1..FR-12 evidence aggregation | Product behavior invention or status laundering |
| Release workflow | Candidate-aware aggregate eligibility and same-artifact gated GitHub release | Rebuilding after verification, publishing from PRs, inferring evidence from job summaries |

## Root and filesystem containment

The project root authority is the tool execution context `ctx.cwd`. The extension package path and process launch directory are not project-root authorities. The executor normalizes the `.specs` candidate, validates containment before and after link resolution, and reads only direct children required by the bounded profile. Unsafe links are diagnosed, never followed.

Read-only enforcement combines:

1. a deliberately read-only code surface;
2. package-boundary rejection of mutation/harness imports;
3. fixture filesystem monitoring and before/after hashes;
4. no network/process/model credentials in the runtime contract; and
5. release receipts bound to the artifact digest.

A returned `readOnly: true` field communicates contract intent but is not itself proof.

## Inventory algorithm

1. Validate `spec-inventory-request@1` before I/O.
2. Capture the OMP-provided project root and abort signal.
3. Resolve `<root>/.specs`; enforce lexical and real-path containment.
4. Return `absent` if missing and `invalid` if not a safe directory.
5. Read direct entries only, sort names lexically, and process no more than hard caps.
6. Accept canonical slug directories; diagnose unsafe/unreadable/invalid entries.
7. Optionally count only the 15 canonical direct document names without reading contents.
8. Construct bounded entries and diagnostics; set `truncated` when data was omitted.
9. Redact unexpected errors to `INTERNAL_ERROR_REDACTED` and keep the session usable.
10. Return both human text and schema-conformant structured details without absolute paths.

## Lifecycle state model

```text
catalog-added
  -> discovered
  -> installed-project
  -> reload-observed
  -> pre-install-session-ended
  -> fresh-session-started
  -> extension-loaded
  -> inventory-invoked
  -> preservation-proven
  -> uninstalled-project
  -> fresh-session-capability-absent
  -> reinstalled-candidate
  -> fresh-session-inventory-reinvoked
  -> aggregate-evidence-complete
  -> release-eligible

first subsequent release and later:
  released-prior-installed -> upgraded-candidate -> fresh-session-candidate-invoked
  candidate-installed -> rolled-back-prior -> fresh-session-prior-invoked
```

Each transition has its own receipt. `reload-observed` cannot skip to `extension-loaded`; only a fresh session can supply that proof. For `0.1.0`, uninstall and reinstall of the same verified artifact are mandatory while upgrade and rollback are inapplicable because no prior release exists. Beginning with the first subsequent release, upgrade-from-prior and rollback-to-prior reuse the state model with explicit from/to versions and become mandatory. Removing a marketplace is not an uninstall or rollback transition.

## Clean build and package boundary

The build starts from absent/isolated `dist/`, produces `dist/extension.js`, and fails on non-deterministic or forbidden imports. Package assembly uses a positive allowlist. The dependency-absent experiment installs from assembled bytes, hides the checkout and root dependencies, and invokes the extension in a pinned clean OMP fixture. The exact bytes invoked are the bytes later uploaded, identified by digest.

## GitHub Actions workflow design

Required jobs:

1. `public-safety`: provenance manifest, license disposition, secret scan, forbidden-path/public-diff checks.
2. `schema-cardinality`: catalog/manifest public profile, one catalog/plugin/package/extension, matching identities/versions.
3. `clean-build-package`: clean build, deterministic/allowlisted payload, artifact digest publication.
4. `deps-absent-smoke`: consume the artifact with source/root dependencies unavailable.
5. `distribution-lifecycle`: for `0.1.0`, isolated clean install, reload receipt, fresh-session invocation, negative inventory cases, uninstall absence, same-artifact reinstall/reinvocation, and preservation; beginning with the first subsequent release, also upgrade from and rollback to a real prior release.
6. `release-consistency`: validate receipt identity, tag/version/digest agreement, evidence freshness, and the candidate-aware FR-1..FR-12 mandatory evidence matrix.
7. `release`: require the FR-13 aggregate eligibility result, then run tag-only, environment-protected, and least-privilege; download the verified artifact by digest and create the release without rebuilding.

Pull requests and pushes run verification only. A `v*` tag does not bypass jobs. Concurrency groups serialize a version's release; an existing release with a different artifact fails rather than being overwritten. Individual passing jobs are evidence producers, not release gates by themselves; only the aggregate evaluator may declare eligibility after mapping complete receipts to every FR-1 through FR-12.

## Key decisions

### D-1 — Preferred OMP-only catalog path

**Decision:** Use only `.omp-plugin/marketplace.json`.

**Rationale:** OMP documents it as preferred for an OMP-only consumer and it eliminates fallback drift.

**Trade-off:** No implicit Claude marketplace compatibility in v0.1.0.

**Alternatives:** Dual catalogs were rejected because they create two public authorities.

### D-2 — Relative child source without `pluginRoot`

**Decision:** Use exact `./plugins/omp-spec-kit` and omit `metadata.pluginRoot`.

**Rationale:** The fully explicit root-relative path is inspectable and avoids double-prefix ambiguity.

**Trade-off:** Catalog paths are slightly longer.

**Alternatives:** A `pluginRoot` plus short source was rejected for the one-entry marketplace.

### D-3 — Built JavaScript entry only

**Decision:** Manifest points to `./dist/extension.js`.

**Rationale:** Installed behavior must not depend on source transpilation or checkout dependencies.

**Trade-off:** Build output must be regenerated and verified.

**Alternatives:** Direct TypeScript entry was rejected for release packaging.

### D-4 — Fresh-session activation as proof boundary

**Decision:** Record reload and session restart separately; accept only fresh-session tool invocation as extension activation.

**Rationale:** Official OMP guidance distinguishes reloadable surfaces from initialized tools/extensions.

**Trade-off:** Lifecycle verification is slower and needs process/session orchestration.

**Alternatives:** Treating install or `/reload-plugins` as sufficient was rejected as false-positive prone.

### D-5 — Closed v0.1 public schemas

**Decision:** Enumerate allowed fields and reject unknown properties at product gates.

**Rationale:** Upstream compatibility parsers may preserve fields that this product neither owns nor verifies.

**Trade-off:** Adding metadata requires an explicit schema/spec change.

**Alternatives:** Passing through arbitrary metadata was rejected for auditability and secret safety.

### D-6 — Complete aggregate evidence before claims

**Decision:** Bind every claim to same-commit, same-version, same-artifact receipts and make FR-13 the sole distribution release-eligibility result.

**Rationale:** Spec text, green structural checks, job summaries, and partial stage success do not prove the complete runtime and safety contract.

**Trade-off:** Release automation requires an explicit FR-1..FR-12 evidence matrix and candidate-aware applicability rules.

**Alternatives:** Trusting a tag, changelog, aggregate CI badge, or a subset of passing stages was rejected.

### D-7 — First release proves reinstall, not fictional history

**Decision:** Require `0.1.0` clean install, fresh-session invocation, uninstall, and exact-artifact reinstall; require upgrade-from-prior and rollback-to-prior only for subsequent releases.

**Rationale:** A first release has no legitimate predecessor, so demanding one would either make release impossible or incentivize fabricated history.

**Trade-off:** Lifecycle automation has two explicit applicability profiles.

**Alternatives:** Publishing an artificial `0.0.x` solely to satisfy the proof or silently skipping all removal/recovery evidence was rejected.

## Security review boundaries

Repository content is attacker-controlled input. Names/messages are escaped as data; nothing discovered is executed. Public results disclose no file content or host identity. Workflow scripts use pinned actions, explicit permissions, immutable artifact digests, and designated scanner-test fixtures so a real secret cannot be excused as test data.

## Deferred decisions

Graph/query services, MCP, authoring/mutation, compatibility catalogs, npm sources, multiple tools/extensions, telemetry, and central marketplace submission are excluded from v0.1.0. They require separate versioned specifications and may not weaken the one-package architecture.
