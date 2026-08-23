# spec-capability

One standalone specification for a product-level capability layer above requirements: typed `CAPABILITY` nodes, a `DERIVES_FROM` typed edge, conformance findings for dangling and orphan capabilities, bounded read-only impact and derivation queries, and deterministic identity rules. This specification extends the spec-kernel typed node/edge model via its own schema version bump; it never modifies the kernel schema or loosens kernel contracts.

## Status

SPEC_ONLY. All tasks are `Planned`; every Gherkin scenario is specification text with no executed status. The capability belongs to a kernel-family extension stage AFTER v0.2: it extends the closed node/edge sets defined in `spec-kernel@1` and requires an explicit ROADMAP decision before any release registration.

## Why a separate spec

The spec-kernel defines a closed set of node kinds, edge types, and diagnostic codes in `spec-kernel@1`. Adding a new node kind (`CAPABILITY`), a new edge type (`DERIVES_FROM`), new diagnostic codes (`CAPABILITY_DANGLING`, `CAPABILITY_ORPHAN`), and new query operations (`requirements_of`, `capabilities_of`, `get_impact`) constitutes a typed-model extension that must be versioned and reviewed independently. Placing this work in its own spec directory preserves the kernel's closed-set discipline: the kernel schema remains unchanged, and this spec declares its own extension schema version (`spec-capability@1`) that references the kernel by dependency. The capability layer provides two things the kernel alone cannot: (1) stable product-wording anchors that outlive individual specs, solving the upstream dogfood pain where ABSORBED specs lose requirement destinations because they are human markers rather than graph edges; and (2) an explicit change-impact query contract that defines structural, semantic-recheck, and invalidation sets without reimplementing evidence freshness.

## Provenance and evidence

- Reqvire (<https://github.com/reqvire-org/reqvire>) is prior-art research only. Its ontology→capabilities→requirements→contracts→verification stack informed the capability-anchor concept; this spec adopts ONLY the capability anchor and typed change impact. Ontologies, OWL, SHACL, SKOS, semantic contracts, and Explorer UI are explicit non-goals.
- Upstream dogfood FR-43 (`ABSORBED` state) documents the pain: absorbed specs lose requirement destinations because absorption targets are human-readable markers, not graph edges. This spec makes those destinations first-class typed edges.
- Upstream `get_trace` provides provenance for the single-hop star query; this spec's `get_impact` extends that concept with two-hop AC→scenario traversal, backlink-driven structural enumeration, and an explicit invalidation contract.
- The design brief at `E:\repos\.dev-pomogator\issue-capability-layer.md` is the originating requirements draft.

## Documents

| Document | Role |
|---|---|
| [USER_STORIES.md](USER_STORIES.md) | Personas and independent tests |
| [USE_CASES.md](USE_CASES.md) | Interaction flows |
| [RESEARCH.md](RESEARCH.md) | Findings, risks, evidence |
| [FR.md](FR.md) | Functional requirements |
| [NFR.md](NFR.md) | Budgets and non-functional requirements |
| [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | EARS criteria |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Traceability matrix, contract checks, invariants |
| [DESIGN.md](DESIGN.md) | Components, algorithms, decisions |
| [TASKS.md](TASKS.md) | Planned task DAG |
| [spec-capability.feature](spec-capability.feature) | Gherkin specification scenarios |
| [FILE_CHANGES.md](FILE_CHANGES.md) | Planned file surface |
| [FIXTURES.md](FIXTURES.md) | Fixture admission policy |
| [spec-capability_SCHEMA.md](spec-capability_SCHEMA.md) | Versioned public schemas |
| [CHANGELOG.md](CHANGELOG.md) | Specification change log |

## Release boundary

This spec extends the kernel typed model and belongs to a kernel-family extension stage AFTER v0.2. Entry requires: an explicit release-stage decision recorded in `ROADMAP.md`; accepted current-candidate `spec-kernel:FR-14` for both `v0.2` and `v0.3` with the typed predecessor linkage; the kernel-family extension schema version bump reviewed and registered; and all mandatory evidence for this spec's own FR-1 through FR-10 conjunction. This spec SHALL NOT ship in v0.1.0, v0.2, or v0.3. It SHALL NOT loosen `product:FR-6` cumulative gates. Capability checks plug a future stage conjunction in the `spec-kernel:FR-14` style; the exact stage is decided in `ROADMAP.md`.
