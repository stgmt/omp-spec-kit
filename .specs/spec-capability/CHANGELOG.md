# Changelog

## Unreleased — specification-only

### Added

- Defined the capability layer extension schema `spec-capability@1` depending on `spec-kernel@1`.
- Defined CAPABILITY node kind with CAP-N / CAP-N.M ID grammar and nesting attributes.
- Defined DERIVES_FROM typed edge with closed endpoint matrix (FR/NFR → CAPABILITY, CAPABILITY → CAPABILITY nesting).
- Defined two declaration mechanisms: `**Capability:** [CAP-N.M]` structured fields on FR/NFR headings and `capabilities: [CAP-N]` spec README frontmatter.
- Defined conformance findings: CAPABILITY_DANGLING (ERROR), CAPABILITY_ORPHAN (WARNING), SPEC_WITHOUT_CAPABILITY (INFO).
- Defined three bounded read-only queries: `requirements_of`, `capabilities_of`, `get_impact`.
- Defined `get_impact` response envelope with structural, semantic_recheck, and invalidates sections under `spec-capability-impact@1`.
- Defined determinism and identity rules following spec-kernel:FR-3 normalization and spec-kernel:FR-4 duplicate discipline.
- Defined projection parity discipline mirroring spec-kernel:FR-9 / FR-14 CHK-FR9-01.
- Defined release eligibility conjunction `spec-capability-release@1` for a ROADMAP-decided kernel-family extension stage after v0.2.
- Defined explicit non-goals: no ontology vocabulary, semantic contracts, capability versioning beyond ID stability, or multi-repo federation.
- Added traceability from 10 functional requirements to 10 acceptance criteria and 10 stable-ID Gherkin scenarios.

### Excluded

- Ontology vocabulary (OWL, RDF, RDFS), semantic contract languages (SHACL, ShEx), SKOS thesauri.
- Capability versioning beyond ID stability, multi-repo capability federation.
- Explorer-style visualization UI, semantic drift judging.
- Evidence freshness reimplementation (consumed by reference from future evidence layer).
- Mutation, proposal, CAS, repair, archival, or status-transition APIs.
- Claims of implementation completion, executed scenarios, or release readiness.

### Provenance

The specification derives concepts from Reqvire (<https://github.com/reqvire-org/reqvire>) as prior-art research only, upstream dogfood FR-43 ABSORBED pain as motivation, and the design brief at `E:\repos\.dev-pomogator\issue-capability-layer.md`. It does not import implementation code.
