# Product research

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
