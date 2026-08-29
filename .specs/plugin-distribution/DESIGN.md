# Design

## Architecture

```text
repository / marketplace root
├── .omp-plugin/marketplace.json          one catalog / one entry / v0.3.2
├── src/v0.1/{extension,inventory}.js     preserved baseline entry sources
├── src/{kernel,adapters,mcp}/            root source trees added by later baseline profiles
├── scripts/                              build, verification, evidence, release
└── plugins/omp-spec-kit/                 complete recursively copied child
    ├── package.json                      one omp.extensions entry
    ├── .mcp.json                         one MCP server identity (v0.3+ profiles)
    ├── bin/omp-spec-kit-mcp{,.cmd}       cross-platform launchers
    ├── dist/                             generated extension/kernel/adapters/mcp + manifest
    ├── skills/spec-inventory/SKILL.md
    ├── commands/spec-inventory.md
    ├── README.md
    └── LICENSE
```

The topology invariant is one marketplace × one plugin package × one extension entry × one MCP server identity. Historical v0.1.0 had no MCP entry; delivered v0.3.2 extends the same child with its read-only kernel/MCP first slice. Later capabilities may add generated files only through accepted profile gates; they cannot add a second package, factory, server identity, writer control plane, or nested marketplace.

## Component responsibilities

| Component | Owns | Does not own |
|---|---|---|
| Root catalog | Product identity, child source, candidate version/public metadata | Runtime execution, second source/control plane |
| Child manifest/tree | Candidate profile allowlist, one extension, optional profile-gated MCP launcher | Build/test/source/evidence workspace |
| Existing extension factory | Candidate-declared OMP registrations | Product stage, public release, second factory |
| MCP launcher/server | Candidate-declared MCP first slice and future gated names | Distribution/public eligibility or alternate product |
| Root build | Clean generated dist tree and deterministic manifest | Runtime downloads or ambient dependencies |
| Distribution producer | Real topology/package/lifecycle/safety observations and content-addressed FR-1..FR-12 receipts | Trusting its own metadata |
| Distribution evaluator | Structural matrix + independent attestation -> distribution-only eligibility | MRI or product/public/capability composition |
| Product evaluator | Baseline/capability/public delivery conjunction | Re-running producer checks |

## Root and filesystem containment

Runtime project-root authority is OMP tool/MCP request context, never package location or process CWD. Inventory resolves `<project-root>/.specs`, checks lexical and link containment, and emits project-relative bounded data only. Packaging treats the entire child directory as public/installable because pinned OMP recursively copies relative marketplace sources.

Evidence containment is separate: root, every parent, and receipt leaf must be ordinary/non-linked; realpaths remain under the evidence root; byte digests match references. Copying evidence bytes does not attest them.

## Inventory algorithm

1. Validate `spec-inventory-request@1` before I/O.
2. Resolve project root from the request/tool context.
3. Inspect only direct `.specs` children under caller/hard bounds.
4. Reject lexical, symlink, reparse, realpath and root escapes.
5. Sort slugs lexically and return only versioned entries/diagnostics.
6. Preserve zero-write/network/process/model/credential behavior.

The v0.3 eight-name read-only MCP/kernel set is a first-slice candidate identity, not a permanent distribution ceiling. Later names are owned by the generator-port capability contracts and stay inside the one server/package.

## Lifecycle state model

```text
catalog discovered
  -> exact candidate installed project-scope
  -> reload recorded (not activation)
  -> pre-install session ended
  -> fresh-session declared surface invoked
  -> candidate uninstall + fresh-session absence
  -> exact candidate reinstall + fresh-session invocation
  -> post-first release: upgrade from and rollback to bound public predecessor
```

Every observation binds candidate/prior version, tag, commit, archive/package/candidate digests, OMP pin, platform fixture and project preservation hashes. Historical v0.1.0 legitimately had no predecessor. Current v0.3.2 binds the real v0.3.0 predecessor and receipt digests summarized in `docs/validation/release-status-v0.3.2.json`.

## Clean build and package boundary

The build removes previous dist output, emits `src/v0.1/{extension,inventory}.js` plus closed root `src/{kernel,adapters,mcp}` trees for the v0.3.2 profile, and writes a deterministic file hash manifest. Candidate-profile verification checks the entire child tree, including `.mcp.json` and launchers only where allowed. It rejects missing/unexpected/non-regular/linked files, source/test/evidence/build content, undeclared imports, downloads, native addons, install scripts and ambient runtime dependencies.

Dependency-absent proof exercises both the installed extension and MCP launcher with checkout/root/external `node_modules` unavailable. A successful build alone is not this proof.

## GitHub Actions workflow design

1. Verification jobs produce topology, package, safety, dependency-absent, lifecycle, BDD and version receipts.
2. `distribution-evidence.yml` builds the complete FR-1..FR-12 evidence subject for the peeled candidate tag commit and signs that exact file with `actions/attest`.
3. `release.yml` finds only a successful distribution-evidence run whose `headSha` equals the peeled tag commit, downloads the subject/receipts, and rechecks candidate identity.
4. The distribution evaluator structurally validates every receipt, then invokes `gh attestation verify` with:
   - repository `stgmt/omp-spec-kit` or exact equal trusted `GITHUB_REPOSITORY`;
   - signer workflow `stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml`;
   - source ref `refs/tags/<candidate-tag>`;
   - exact evidence subject hash.
5. Only `distribution-release-eligibility@2` is emitted. Self-authored workflow/runId/observations, predicate bytes, passing job summaries, or supplied JSON cannot select eligibility.
6. Product baseline/capability/public composition is evaluated by `product:FR-6`, not this evaluator.
7. The publish job consumes the already verified candidate, creates the release once, refuses a different existing artifact, and attests published archive/candidate/evidence assets through `release.yml`.

Missing `gh`, spawn/nonzero/timeout, unpinned/wrong repo, wrong workflow/ref, subject mismatch, incomplete matrix, stale/cross-candidate receipts, or containment failure blocks before notes/upload. PRs and untagged pushes remain verify-only.

## Key decisions

### D-1 — Preferred OMP-only catalog path

**Decision:** Use only `.omp-plugin/marketplace.json`.

**Rationale:** One product identity and no fallback marketplace ambiguity.

**Trade-off:** Other hosts need separate future adapters, not duplicate catalogs.

### D-2 — Relative child source without `pluginRoot`

**Decision:** Use exact `./plugins/omp-spec-kit` and omit `metadata.pluginRoot`.

**Rationale:** Matches the pinned OMP relative-source contract and containment.

**Trade-off:** The complete child tree is installable/public and needs a positive allowlist.

### D-3 — Built JavaScript entry only

**Decision:** Manifest points to `./dist/extension.js`; MCP uses generated dist plus fixed launchers.

**Rationale:** Installed behavior cannot depend on source transpilation/checkouts.

**Trade-off:** Every root-source change requires deterministic rebuild/manifest proof.

### D-4 — Fresh-session activation as proof boundary

**Decision:** Record install/reload separately; accept only fresh-session invocation as activation.

**Rationale:** Loader state can survive install/reload in an existing session.

**Trade-off:** Lifecycle fixtures must manage distinct sessions.

### D-5 — Closed candidate profiles, immutable history

**Decision:** Preserve historical v0.1.0 field/tree rules and add explicit later profiles such as delivered v0.3.2.

**Rationale:** Later MCP/kernel files cannot retroactively make v0.1 receipts false.

**Trade-off:** Validators select profile by exact candidate identity.

### D-6 — Distribution-only eligibility before product composition

**Decision:** `distribution-release-eligibility@2` evaluates FR-1..FR-12 only; MRI and product/public status have separate owners.

**Rationale:** One evaluator cannot both produce a component result and self-authorize the product conjunction.

**Trade-off:** Product release consumes multiple qualified aggregates.

### D-7 — First release proves reinstall, not fictional history

**Decision:** v0.1.0 has no upgrade/rollback prerequisite; every subsequent profile uses real public prior bytes.

**Rationale:** Applicability is candidate-aware.

**Trade-off:** Later release workflows preserve prior artifacts/receipts.

### D-8 — External sources, closed copied payload

**Decision:** Runtime source/build/test/evidence stay at root; only generated dist and closed runtime assets live in the child.

**Rationale:** OMP recursively copies the child.

**Trade-off:** Child cannot be a self-building workspace.

### D-9 — GitHub Artifact Attestations is the current trust root

**Decision:** Trust certificate identity/timestamps and exact subject binding from the fixed repository/workflow/ref; treat predicate bytes as diagnostics.

**Rationale:** Self-authored JSON cannot independently prove its producer.

**Trade-off:** Maintainer CI needs `gh`/Sigstore verification; unavailable verifier fails closed.

## Security review boundaries

Repository and receipt content are untrusted data. Nothing discovered is executed. Public output contains no file contents/host identity. Actions use least permissions, pinned workflow identity, OIDC attestations, digest handoff and tag/commit equality. Designated secret-scanner fixtures cannot whitelist arbitrary files.

## Deferred decisions

Generator-read growth, LSP, evidence, capability, authoring, enforcement and automatic plan-gate behavior use separate post-v0.3 capability gates. They may extend the same child/server only after acceptance and may not weaken one-product topology or reinterpret historical v0.3 first-slice receipts.
