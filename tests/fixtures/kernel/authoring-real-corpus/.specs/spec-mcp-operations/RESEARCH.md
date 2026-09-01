# RESEARCH

## Read / Core

## Scope

This concise record uses the existing migration decisions, pinned upstream snapshot, real-corpus manifest, and v0.3.2 public receipts as evidence. They inform the target but do not become implementation authority or compatibility claims.

## RF-1: Mixed historical machinery

**Finding:** Historical generator designs combine graph semantics with watchers, persistence, mutation, and broad transport concerns.

**Decision:** Keep one pure occurrence-first graph core. Host layers handle source reading and transport; editor navigation and product release evidence remain outside the kernel.

## RF-2: Qualified identity and conservation

**Finding:** Bare local IDs collide across a multi-spec corpus, and map-first parsing hides duplicates.

**Decision:** Form `<spec-slug>:<local-id>` identities and retain definition/reference occurrences before indexes. Ambiguous identities have no elected node.

## RF-3: Four primitives are sufficient

**Finding:** Inventory, typed lookup, bounded traversal, and deterministic diagnostics cover the graph/query boundary without an operation-specific catalog.

**Decision:** Expose exactly those four internal primitives through one cursor envelope. Historical MCP names remain adapters only.

## RF-4: Containment is a correctness boundary

**Finding:** A read-only graph can still disclose unrelated files or exhaust host resources without explicit root and hard limits.

**Decision:** Admit only caller-contained canonical documents, reject links and traversal, enforce cancellation and budgets, and return sanitized errors.

## RF-5: Historical evidence has a boundary

**Finding:** The v0.3.2 runtime receipt and target-owned real corpus prove released bytes and provenance, not the rewritten core.

**Decision:** Keep those receipts and hashes immutable; label the current core NEXT and never convert structural validity into release eligibility.

## Open implementation choices

1. Select or bundle a parser implementation that emits the exact occurrence types without widening the schema.
2. Keep producer-supplied normalized step-binding records optional; do not parse JavaScript or reproduce a runner matcher.
3. Extend the core only through a new reviewed contract, never through a second runtime or silent compatibility heuristic.

## Read / Evidence

## Scope

Sources are the target kernel contract, `MIGRATION_MATRIX.md`, and the preserved upstream snapshot under `docs/upstream/dev-pomogator/spec-generator-v4/`. Upstream text is provenance, never target authority or execution evidence.

## RF-11: Structural truth and execution truth are different

**Finding:** `the structural-truth contract` forbids converting structural parsing into readiness or a passing-test claim.

**Decision:** Evidence remains a separate layer that consumes the current graph plus captured execution bytes. The evaluator is pure; the capture adapter owns I/O.

## RF-12: Stale passing rows caused false green

**Finding:** The upstream incident class described stale passing results while the execution lane appeared green. A timestamp or previous pass cannot prove current behavior.

**Decision:** Freshness compares scenario content, applicable step binding, and tested implementation identity. Current task membership is read from the current snapshot. Every required scenario must have fresh passed full-scope evidence.

## RF-13: Caller-provided hashes do not authenticate caller data

**Finding:** Re-hashing a caller-provided artifact and caller-provided sidecar proves internal consistency, not producer origin. A `CANONICAL` label also does not prove an unfiltered run.

**Decision:** Trust one local capture adapter that observes the actual invocation and computes one run envelope. FULL/PARTIAL is derived by capture. Adversarial attestation is out of scope rather than simulated with more self-declared hashes.

## RF-14: Stable identity is required for evidence

**Finding:** Scenario names are mutable and may collide across features. Name fallback can bind a passing row to the wrong requirement.

**Decision:** Only exact qualified scenario ID or a graph-verified canonical tag joins. Name matches remain bounded diagnostic candidates.

## RF-15: Whole-graph freshness is broader than the result

**Finding:** Once scenario content, applicable steps, tested implementation, and current task membership are known, whole-graph equality adds unrelated invalidation but no missing user invariant.

**Decision:** Remove graph fingerprint from per-result freshness. A newly required scenario becomes missing through the current task definition; unrelated graph edits do not stale an unchanged test result.

## RF-16: Result and trace need one identity

**Finding:** The earlier draft repeated artifact, run, freshness, trace, output, and cursor fingerprints across two query results.

**Decision:** `ScenarioEvidence` owns one `EvidenceRef`. Trace paging accepts that reference and returns only steps/failure. Paging tokens stay opaque server implementation details.

## RF-17: Real producer bytes are necessary parser evidence

**Finding:** Synthetic fixtures can mirror the parser's assumptions and miss actual producer shapes.

**Decision:** Executable fixtures require real producer bytes, immutable hashes, full capture provenance, permitted trimming, and reviewed normalized outcomes. Synthetic data is limited to labeled scale or one-fault derivatives.

## Risks

- **Capture compromise:** trusted local capture is an explicit trust boundary, not cryptographic attestation. A future adversarial model needs a real external trust root.
- **Scope misclassification:** planted filtered invocations must prove they remain PARTIAL.
- **Tag drift:** canonical tag verification uses the current graph; unverifiable tags never join.
- **Fixture availability:** no target runtime claim is allowed until real captures from at least two identified producers are reviewed.

## Write

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

## Consolidation ledger

Source domains retained in this spec:

| Source | Target domain | Functional requirements | Acceptance criteria | Scenarios | Tasks |
|---|---|---:|---:|---:|---:|
| Read / Core | Read / Core | 8 | 8 | 8 | 8 |
| Read / Evidence | Read / Evidence | 14 | 14 | 14 | 6 |
| Write | Write | 7 | 14 | 14 | 7 |

The 46-row destination census remains external and is owned here: rows 1–22 Read, rows 23–46 Write. The shipped eight MCP names remain unchanged. Old qualified IDs are historical source identities; active IDs use this spec slug and domain ranges.