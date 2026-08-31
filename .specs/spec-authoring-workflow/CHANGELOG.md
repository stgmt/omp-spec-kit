# Changelog

## Unreleased — contract simplification

### Changed

- Reduced the future public mutation surface to `propose_patch` and `apply_proposed_patch`.
- Made helper intents internal compilers over one edit-operation union.
- Replaced runtime release/evidence eligibility machinery with the product's ordinary `NEXT` state; distribution and product evaluators retain their own authority.
- Replaced durable server-side review with caller inspection of one immutable Proposal and exact-hash apply.
- Reduced public results to Proposal, ApplyResult, compact MutationReceipt, and seven error families.
- Kept filesystem containment, full kernel validation, anchor/link closure, CAS, one-spec atomicity, byte/EOL conservation, redaction, real concurrency, and deterministic fault verification.
- Limited recovery to internal complete-old/complete-new selection; unrecoverable storage now fails closed to manual VCS/backup restore.
- Removed separate task lifecycle, audit digest chain, public repair/recovery surfaces, registry taxonomy, and runtime mutation-quality gate.

## Historical baseline — v0.3.2

- v0.3.2 shipped the real read-only baseline with eight working MCP tools and no authoring mutation surface.
- Historical reconciliation identities remain: tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`, package-tree digest `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`, archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5b15c7e3bb363a0cbea9`.
- Those receipts remain historical evidence and do not gate authoring requests at runtime.

## Historical design record

Earlier drafts explored broader facade, review, recovery, audit, lifecycle, and quality authorities. The current contract supersedes those designs before runtime implementation; no compatibility aliases are retained because no authoring API was shipped.
