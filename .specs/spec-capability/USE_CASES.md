# Use Cases

## UC-1: Parse capabilities from an owning specification

**Actors:** Kernel@2 parser and graph builder

**Preconditions:** `.specs/product/CAPABILITIES.md` contains `## CAP-N: title` and optional `### CAP-N.M: title` headings.

**Main flow:**
1. The V2 adapter admits the optional document under its owning spec.
2. Headings produce `product:CAP-N[.M]` nodes with `CAPABILITY_DOCUMENT` sources.
3. Nested child capability links to its same-prefix parent.
4. Duplicate candidates survive and emit kernel `DUPLICATE_DEFINITION` with no elected node.

**Postconditions:** Qualified capability nodes/parent edges enter the immutable V2 graph.

**Alternatives:** Malformed ID diagnoses; a spec without its document contributes no nodes and may receive `SPEC_WITHOUT_CAPABILITY`. Root `.specs/CAPABILITIES.md`, frontmatter and bare IDs reject.

**Related:** [FR-1](FR.md#fr-1-per-owning-spec-capability-nodes), [FR-7](FR.md#fr-7-determinism-and-canonical-identity)

## UC-2: Declare requirement-to-capability derivation

**Actors:** Specification author and graph builder

**Preconditions:** An FR/NFR uses qualified `**Covers:** [product:CAP-N](...)`.

**Main flow:**
1. The canonical structured-field parser reads Covers.
2. The builder resolves the qualified capability.
3. Requirement→capability produces DERIVES_FROM; child capability→parent is the only capability endpoint variant.
4. Unknown/forbidden targets produce closed diagnostics.

**Postconditions:** Typed derivation edges connect requirements to owned product meaning.

**Alternatives:** `**Requirement:**` remains REFS; unqualified cross-spec CAP is refused.

**Related:** [FR-2](FR.md#fr-2-derivesfrom-declarations-and-edge-grammar), [FR-3](FR.md#fr-3-capability-conformance-findings)

## UC-3: Query requirements and capabilities

**Actors:** MCP caller and pure query service

**Main flow:**
1. `requirements_of` receives a qualified capability ID and returns bounded typed requirement summaries over incoming DERIVES_FROM.
2. `capabilities_of` receives a spec slug, inheritance flag and capability lifecycle filter.
3. Both results use stable ordering, exact totals and fingerprint-bound cursors.

**Alternatives:** Invalid/missing IDs/specs/cursors return closed errors; a valid empty result is distinct from not found.

**Related:** [FR-4](FR.md#fr-4-requirements-of-capability-query), [FR-5](FR.md#fr-5-capabilities-of-spec-query)

## UC-4: Assess graph impact and evidence invalidation

**Actors:** MCP caller, graph service, optional evidence overlay

**Main flow:**
1. `get_impact` accepts a requirement ID and bounded depth/visited/page controls.
2. It returns only typed structural and semantic-recheck canonical IDs.
3. If producer invalidation is needed, `invalidate_evidence` separately receives that impact, current kernel bindings and the complete evidence evaluation snapshot.
4. It returns stale/unaffected/indeterminate producer IDs, changed dimensions and binding proof.

**Postconditions:** Structural impact is usable without evidence; producer verdicts are impossible without both snapshots.

**Alternatives:** Unknown/non-requirement start or limits return closed errors; no evidence input yields no producer IDs.

**Related:** [FR-6](FR.md#fr-6-graph-only-impact-and-evidence-overlay)

## UC-5: Evaluate profile-specific release eligibility

**Actors:** Pure release evaluator and product gate

**Preconditions:** Delivered v0.3/kernel@2 baseline, candidate manifest, evidence bytes and profile records are supplied.

**Main flow:**
1. Re-hash baseline and evidence documents.
2. Select graph or overlay exact FR-check membership and all six NFR checks.
3. Overlay additionally binds evidence MCP eligibility and the consumed deterministic evaluation fingerprint.
4. Return candidate-bound eligibility, required/passed IDs and closed blockers.

**Alternatives:** Missing/extra/duplicate/failed/stale/mismatched/unverifiable/unbound input blocks; graph profile rejects overlay records/fields; prose is not evidence.

**Related:** [FR-9](FR.md#fr-9-capability-release-eligibility)
