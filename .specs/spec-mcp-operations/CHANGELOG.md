# Changelog

## Read / Core

## Unreleased

- Replaced the split historical/future design with one occurrence-first graph/query core and four internal primitives: inventory, findNodes, traverse, and diagnostics.
- Preserved the exact released eight-name MCP compatibility adapters as the v0.3.2 first slice: `spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory`.
- Removed kernel ownership of editor anchor/link inventory, capability grammar, JavaScript/Cucumber parsing, operation-specific query catalogs, adapter preflight/version/lock state, release evaluation, and dormant activation machinery.
- Kept occurrence conservation, spec-qualified identity, typed resolved/unresolved edges, deterministic diagnostics, containment, cancellation, package/memory/latency budgets, dependency-absent smoke, v0.3.2 runtime receipts, and real-corpus provenance.

## Evidence boundary

The public v0.3.2 eight-tool runtime remains historical **SHIPPED** evidence. The simplified core contract is **NEXT**; speculative extensions are **LATER** or omitted. Historical decoders, serializers, and immutable fixture replay may read released formats, but they do not define the current core.

## Provenance

Real-corpus provenance remains tied to the existing target-owned manifest, its selected source commit, per-file hashes, independent count oracle, and public v0.3.2 receipt references already recorded in this spec. No released receipt is rewritten into a current implementation claim.

## Read / Evidence

## Unreleased

- Replaced the unshipped overlay/sidecar model with one trusted-capture run envelope built from an actual runner invocation.
- Made capture-derived FULL/PARTIAL scope authoritative; partial runs remain visible but never satisfy readiness.
- Restricted joins to qualified scenario ID or graph-verified canonical tag; names are diagnostics only.
- Removed whole-graph per-result freshness. Freshness now compares scenario content, applicable step binding, and tested implementation identity.
- Required fresh passed FULL-scope evidence for every current required scenario.
- Replaced duplicate result/trace identities with one `EvidenceRef`; `get_test_result` returns `ScenarioEvidence` and trace pages use its reference.
- Removed public conservation counters/equations, unused task/schema fields, deterministic output fingerprints, the 14-record evidence release manifest, and its second evidence fingerprint.
- Preserved the real-producer fixture/provenance discipline and the SHIPPED v0.3.2 historical evidence boundary. No runtime delivery is claimed.

The previous sidecar/fingerprint/release schema was a superseded specification draft and has no compatibility authority.

## 2026-08-23 — Specification init

- Created the evidence/honesty specification from the kernel boundary and upstream migration research.
- Recorded the stale-result false-green incident class and the requirement for real multi-producer fixtures.

## Write

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

## Consolidation

The former kernel, evidence, and authoring specifications now live as explicit Read/Core, Read/Evidence, and Write domains in this single MCP operations contract.