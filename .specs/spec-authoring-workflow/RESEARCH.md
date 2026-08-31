# Research

## R-1: Read-only baseline is historical product truth

**Status:** `[VERIFIED_FROM_RELEASE_PROVENANCE]`

The published v0.3.2 baseline exposes eight working read-only MCP tools and no authoring mutation surface. This specification therefore uses public state `NEXT` and does not reinterpret historical release evidence as a live API eligibility input.

Bounded v0.3.2 identities retained for reconciliation:

- tag commit: `2938389e34e2d06bdd497291ed01e0a2d89146c9`;
- candidate digest: `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`;
- package-tree digest: `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`;
- release archive SHA-256: `26a2ebadd7d1888c10dc9bdbdc25e11fecf5b15c7e3bb363a0cbea9`.

These values are historical receipts only. Distribution and product release evaluators own current attestation and delivery decisions.

## R-2: OMP provides one MCP boundary

**Status:** `[VERIFIED_FROM_PINNED_SOURCE]`

OMP marketplace and MCP integration are grounded in pinned host commit `8500092296621a6826b7136e840f8a59ea338958`, including:

- `https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md`
- `https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/mcp.md`

**Decision:** extend the existing MCP server only. Do not create a second plugin, extension writer, registry authority, or agent-facing helper surface.

## R-3: Proposal plus CAS protects the observable failure modes

**Status:** `[VERIFIED_FROM_LOCAL_DESIGN_AND_FIXTURES]`

A pure preview prevents surprise writes. Expected content hashes and a second under-lock comparison prevent stale overwrite and ABA changes. Reusing the kernel validators prevents a second definition of valid FR, AC, scenario, task, anchor, or trace forms.

**Decision:** one immutable Proposal value and one Apply operation; caller review is behavior around the preview, not a durable server state.

## R-4: Containment needs filesystem evidence

**Status:** `[VERIFIED_FROM_PLATFORM_BEHAVIOR_REQUIREMENT]`

Lexical normalization alone cannot prove Windows junction/reparse or POSIX symlink containment. The authoring handler must use platform filesystem metadata and recheck before swap. The host path policy is an additional boundary for non-authoring tools, not a replacement for handler containment.

## R-5: Generation commit keeps the proof small

**Status:** `[DECISION]`

One-spec staging on the same filesystem permits all-or-none generation replacement and bounded internal rollback. A public catastrophic-repair protocol would add authorization and state without improving the normal contract.

**Decision:** recover internally only while a complete hashed old or new generation exists. Otherwise stop with `RECOVERY_REQUIRED` and manual VCS/backup restore instructions.

## R-6: Quality checks are verification, not runtime authority

**Status:** `[DECISION]`

Real corpus, platform filesystem, race, crash, redaction, and anchor fixtures directly defend the observable contract. Mutation/fault injection may strengthen CI but does not create another product lifecycle or eligibility gate.

## Provenance sources

- [Public-init decision](../../docs/decisions/omp-spec-kit-public-init.md)
- [Migration matrix](../../MIGRATION_MATRIX.md)
- Existing v0.3.2 distribution and release-integrity receipts referenced by the product corpus
- Real fixture capture obligations in [FIXTURES.md](FIXTURES.md)
