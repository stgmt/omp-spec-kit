# spec-capability

This specification defines a future kernel@2 capability layer: per-owning-spec CAPABILITY nodes, qualified DERIVES_FROM edges, graph-only queries, a separate evidence invalidation overlay, closed diagnostics and MCP-only projection.

## Status

SPEC_ONLY. `spec-capability@2` is the current implementable contract; all tasks are planned and scenario text is not execution evidence. No live CAPABILITIES.md is added to the historical 150-document kernel@1 corpus.

## Why a separate spec

The delivered kernel@1 model is closed. Capability functionality therefore uses a separately gated kernel@2 extension. Actual capability definitions belong to their owning spec (`product:CAP-N`, etc.), not to this meta-spec or a repository-root singleton. The graph core never consumes evidence; result invalidation is an explicit evidence overlay. Agent-facing operations are MCP-only.

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

Release requires delivered v0.3 baseline, accepted kernel@2 capability profile and exact graph 16-record or overlay 18-record `spec-capability-release@2` aggregate. Shipping invalidation additionally requires accepted evidence MCP and a bound `spec-evidence@2.deterministicFingerprint` snapshot with current kernel bindings. This capability never enters historical v0.3 or implies a sibling capability.
