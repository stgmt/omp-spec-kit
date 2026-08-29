# Changelog

## Unreleased

- Closed explicit requirement lifecycle/includeArchived semantics, evidence-output byte revalidation, paged overlay envelopes/budgets, and role-typed baseline/check release evidence with exact 16/18 memberships. — specification-only

### Added

- Defined `spec-capability@2` over separately gated `spec-kernel@2`; historical kernel@1 remains unchanged.
- Defined per-owning-spec CAPABILITIES documents and qualified `<slug>:CAP-N[.M]`; root singleton/frontmatter/bare IDs reject.
- Defined qualified `Covers` requirement→capability and child→parent DERIVES_FROM endpoints; `Requirement` remains REFS.
- Reused kernel `DUPLICATE_DEFINITION` and closed capability-specific diagnostics.
- Closed `requirements_of`, `capabilities_of`, and requirement-only `get_impact` args/data/errors/bounds/cursors.
- Separated graph impact from an evidence overlay carrying current/evidence graph/scenario/step/implementation bindings and deterministic evidence snapshot identity.
- Defined graph MCP profile with three names and overlay profile adding `invalidate_evidence`; no OMP/LSP agent surface.
- Defined graph/overlay release manifests, caller-supplied evidence bytes, closed eligibility/blockers, delivered baseline binding and six mandatory NFR checks.
- Added 10 FR, 11 AC, 10 stable scenarios, 18 CHK rows and 8 planned tasks with bidirectional ownership.
- Preserved ontology/federation/mutation/status/control-plane non-goals and specification-only status.

### Excluded

- Ontology vocabulary (OWL, RDF, RDFS), semantic contract languages (SHACL, ShEx), SKOS thesauri.
- Capability versioning beyond ID stability, multi-repo capability federation.
- Explorer-style visualization UI, semantic drift judging.
- Evidence freshness reimplementation (consumed by reference from future evidence layer).
- Mutation, proposal, CAS, repair, archival, or status-transition APIs.
- Claims of implementation completion, executed scenarios, or release readiness.

### Provenance

The specification derives concepts from Reqvire (<https://github.com/reqvire-org/reqvire>) as prior-art research only, upstream dogfood FR-43 ABSORBED pain as motivation, and the design brief at `E:\repos\.dev-pomogator\issue-capability-layer.md`. It does not import implementation code.
