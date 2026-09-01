# Research

## Findings used by this contract

### R-1 — Relative marketplace children are supported

`[VERIFIED: pinned OMP marketplace guide + mini-marketplace example]`

OMP locates a catalog at `.omp-plugin/marketplace.json` and supports relative child sources beginning with `./`. This product selects `omp-spec-kit` at `./plugins/omp-spec-kit`; OMP remains the authority for other accepted catalog fields.

### R-2 — Installed extensions come from the child manifest

`[VERIFIED: pinned marketplace guide + extension-loading guide + example package]`

Installed plugin entries are resolved from the child package's `omp.extensions`. This product checks only its candidate version and contained `./dist/extension.js`; it does not copy OMP's complete manifest grammar into this specification.

### R-3 — Reload is not activation

`[VERIFIED: pinned marketplace lifecycle + extension-loading guide]`

Catalog update, plugin installation, `/reload-plugins`, and extension activation are distinct. A fresh session invoking the installed candidate is the release proof boundary.

### R-4 — Relative child sources are recursively copied

`[VERIFIED: pinned marketplace guide + cache implementation]`

OMP v17.3.7 recursively copies the selected child. Therefore the child is a closed public payload, and source/test/evidence files or links must not enter it.

### R-5 — Host and runtime schemas have separate owners

`[VERIFIED for the v17.3.7 smoke; compatibility beyond the pin is not assumed]`

OMP owns marketplace, extension, and MCP parsing. The kernel owns read-only request/result/error semantics. Distribution validates compatibility by installing and invoking the tagged bytes against the supported OMP pin, not by maintaining parallel exhaustive schemas.

## Pinned sources

1. https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md
2. https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extensions.md
3. https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extension-loading.md
4. https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/extensibility/plugins/marketplace/cache.ts
5. https://github.com/can1357/oh-my-pi/tree/8500092296621a6826b7136e840f8a59ea338958/docs/skills/examples/mini-marketplace
6. `docs/omp-v17.3.7-contract.md`
7. `IMPORT_MANIFEST.yaml`, `MIGRATION_MATRIX.md`, and `docs/upstream/dev-pomogator/`

Re-run the installed smoke when the OMP pin, catalog loader, extension loader, MCP manager, child entrypoints, or release workflow changes.

---

## Product lifecycle domain (merged)

## Boundary

This research supports public product identity, shipment truth, and roadmap clarity. Detailed packaging, authoring, enforcement, editor, evidence, and plan behavior remains in owner contracts.

## Sources

| Source | What it establishes |
|---|---|
| [`IMPORT_MANIFEST.yaml`](../../IMPORT_MANIFEST.yaml) and [`source-freeze.md`](../../docs/validation/source-freeze.md) | Historical public-init import provenance: immutable source commit, copied paths, exclusions, and byte checks. |
| [`LICENSE-ATTESTATION.md`](../../docs/upstream/dev-pomogator/LICENSE-ATTESTATION.md) | Historical source-owner license coverage for the imported snapshot. |
| [`publication-receipt.md`](../../docs/validation/publication-receipt.md) | Historical public repository/tree readback. |
| [`release-status-v0.3.2.json`](../../docs/validation/release-status-v0.3.2.json) | Current public/installable v0.3.2 identity, artifact digests, release workflow, and attestation receipts. |
| [OMP marketplace documentation](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md) | Installed `name@marketplace` identity and project-scoped plugin lifecycle. |

## Verified conclusions

1. Public init began without runtime proof; that is history, not current status.
2. The imported source and license decision have durable historical provenance.
3. v0.3.2 is public and project-installable with one bounded current release proof.
4. One marketplace/plugin/extension identity is a deliberate product invariant.
5. Specification text, task state, and Gherkin do not prove shipment.
6. Safe authoring is useful only when atomic application and direct-write protection ship together.
7. A manager needs SHIPPED, NEXT, and LATER; owner-specific readiness details do not belong in product status.

## Risks and treatment

| Risk | Treatment |
|---|---|
| A future row inherits the v0.3.2 proof | Require a current proof naming the exact new release identity. |
| Product identity fragments | Refuse a second marketplace, package, extension, or writer. |
| Direct writes bypass safe authoring | Check the exact authoring-name allowlist first, then refuse other canonical `.specs/**` writes with real containment. |
| Roadmap prose becomes a promise | Keep one NEXT row, plain LATER outcomes, and proof-before-SHIPPED. |
| Fixture drift hides false proof | Capture real producer output, retain provenance and digests, and trim only with reconciled ground truth. |

## Re-research triggers

Re-check the relevant owner contract when the installed identity, OMP pin, authoring tool names, containment behavior, or current release proof changes.

---

## MCP release-integrity domain (merged)

## Verified runtime boundary

historical OMP v17.3.7 resolves a path-like MCP command relative to the installed package and uses the active project when `cwd` is omitted:

- [`omp-plugins.ts`](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/discovery/omp-plugins.ts#L274-L344)
- [`stdio.ts`](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/mcp/transports/stdio.ts#L578-L609)
- [`mcp-config.md`](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/mcp-config.md#L377-L425)

The observable contract is active-project behavior. OMP manager classes, provider names, server-registration cardinality, and private launcher environment variables are implementation details.

## Verified shipped behavior

The installed v0.3.2 package launches from the active project, returns terminal JSON-RPC errors, recovers on the same process, and exposes the eight read-only historical eight-tool contract names. MRI checks the installed boundary. Full graph/query semantics remain kernel-owned.

## Real producer evidence

`tests/fixtures/release-candidate/cucumber-messages.ndjson` came from the real Docker Cucumber 13.2.1 producer. Its stream hash, image digest, command, capture date, and source-input manifest are closed provenance. Historical scenario and step counts are descriptive only. A source change requires a newly captured successful unfiltered run; the old stream must never be relabeled.

The forward MRI contract checks parseability, a successful unfiltered terminal run, source/feature/step binding, and one bounded negative showing that meta-only or failed output cannot become trusted. Detailed Cucumber envelope error codes belong to the producer adapter, not release policy.

## Root provenance and cross-surface consistency

The repository runtime audit found two distinct risks. The stdio query envelope and legacy inventory result expose content and graph identity but no physical project identity; the same server name can therefore serve two roots without a client-visible source marker. Separately, the OMP extension inventory used `ctx.cwd` while the seven query tools honored `OMP_SPEC_KIT_ROOT`, so a cwd plus absolute override could split one extension across two projects.

The bounded fix is adapter-owned rather than kernel-owned: the pure kernel continues to exclude transport and host state from its content fingerprint, while the shared adapter root context adds `serverName`, opaque canonical-root IDs, `rootMode`, and `matchesActiveProject` to every result. The explicit absolute override remains a diagnostic capability, but its mismatch is visible in both structured output and one-line text. No absolute path or environment value is returned.

Evidence inputs are the current source/test inspection, the built-artifact two-root smoke, and the installed extension mixed-cwd/override smoke. The required regression scenarios are `SCEN-mri-response-provenance` and `SCEN-mri-extension-root-consistency`; a changed source input requires a fresh unfiltered Cucumber capture before a run can become trusted evidence.

## Candidate and publication facts

Candidate bytes are assembled once from a clean peeled tag in lexical order with regular contained paths and preserved executable mode. Publication downloads and re-hashes the same archive. Native GitHub Artifact Attestation verification binds the exact subject to repository, signer workflow, and tag ref. MRI does not revalidate a distribution producer's internal claim matrix.

## Historical v0.3.2 evidence

[`release-status-v0.3.2.json`](../../docs/validation/release-status-v0.3.2.json) is immutable readback evidence for tag `v0.3.2`, commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`, package-tree digest `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`, and archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`. Its evidence@3 and attestation fields remain readable historical bytes; they are not the schema for future candidates.

## Decision

Future MRI produces one compact candidate run result. The release workflow may compose that result with native artifact-attestation output, but MRI defines no nested MRI/distribution/public eligibility lattice and no custom blocker taxonomy.