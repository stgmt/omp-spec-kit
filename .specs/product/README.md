# Product specification

This specification defines the public product boundary and repository lifecycle for `omp-spec-kit`. It governs what the project may claim, when it may become public, and how one product advances through evidence-gated release stages. It does not define plugin packaging internals, graph implementation, or authoring mutation mechanics.

## Current product status

**Status authority:** `DELIVERED / CURRENT_BASELINE` (public v0.3.2).

**The current public baseline is v0.3.2.** It is a public, project-installable `omp-spec-kit@omp-spec-kit` plugin containing the v0.2 read-only kernel and the eight-tool v0.3 MCP first slice. Its tag, release assets, digests, lifecycle receipts and GitHub attestation identity are bound by [`release-status-v0.3.2.json`](../../docs/validation/release-status-v0.3.2.json). Gherkin scenarios remain specification text unless a cited producer receipt proves execution.

| Stage / capability | Exact state | Role / next gate |
|---|---|---|
| Public specification init | `DELIVERED` | Historical provenance/publication baseline. |
| v0.1.0 inventory | `DELIVERED` | Historical bounded inventory baseline. |
| v0.2 kernel | `DELIVERED` | Historical read-only graph/query baseline. |
| v0.3.2 MCP first slice | `DELIVERED` | Current baseline; eight SCHEMA-11 names are not a ceiling. |
| `GENERATOR_READS` | `SPECIFIED` | Requires `spec-kernel:CHK-FR16-01` and `spec-kernel:CHK-FR17-01` over the v0.3 baseline. |
| `LSP_ADAPTER` | `SPECIFIED` | Requires complete `spec-lsp:FR-12` profile over the v0.3 baseline. |
| `EVIDENCE_MCP` | `SPECIFIED` | Requires `spec-evidence:FR-13` and `spec-evidence:FR-14`. |
| `CAPABILITY_GRAPH` | `SPECIFIED` | Requires `spec-capability:FR-9`. |
| `AUTHORING_MCP` | `DEFERRED_HOST_ABI` | Joint tuple includes authenticated tool-call provider/server/schema ABI; no mutation ships independently. |
| `SPEC_ENFORCEMENT` | `DEFERRED_HOST_ABI` | Same joint tuple plus authenticated tool-call provider/server/schema ABI; v17.3.7 lacks it. |
| `AUTOMATIC_PLAN_GATE` | `DEFERRED_HOST_ABI` | Requires `plan-gate:FR-13` and `plan-gate:CHK-HOST-ABI-01`. |

## Product identity

- Repository/product: `omp-spec-kit`.
- Current installed identity: `omp-spec-kit@omp-spec-kit`.
- Architecture: one standalone OMP marketplace containing exactly one plugin package and exactly one extension entry.
- Canonical runtime identifiers: `<spec-slug>:<local-id>`, for example `product:FR-1`.
- Upstream snapshot: provenance reference only, never the target product source of truth or delivery evidence.

## Scope ownership

This specification owns:

- specification-first public initialization;
- immutable source provenance and redistribution-license gates;
- clean export, secret scanning, and public-tree eligibility;
- one-product identity across release stages;
- roadmap and public/non-public claims;
- evidence-derived honest status.

It delegates without duplicating internals:

- marketplace/package/install/activation/release mechanics to `plugin-distribution`, whose `FR-13` supplies the distribution aggregate required cumulatively by `product:FR-6`;
- read-only inventory and graph/query behavior to `spec-kernel`, whose stage-targeted `FR-14` results supply the cumulative kernel gates required by `product:FR-6`;
- editor/LSP diagnostics to `spec-lsp` as a sibling adapter, not the agent API;
- evidence evaluation to `spec-evidence`;
- authoring guidance and later safe mutation to `spec-authoring-workflow`, whose `FR-13` is additional to every earlier cumulative gate required by `product:FR-6`;
- the agent-facing MCP destination and 46-name census to [spec-generator-port.md](../../docs/decisions/spec-generator-port.md), constrained by `product:FR-9`.

## Documents

- [Users and needs](USER_STORIES.md)
- [Product journeys](USE_CASES.md)
- [Risk-led evidence](RESEARCH.md)
- [Requirement index](REQUIREMENTS.md)
- [Functional requirements](FR.md)
- [Non-functional requirements](NFR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Product design](DESIGN.md)
- [Delivery tasks](TASKS.md)
- [Planned file changes](FILE_CHANGES.md)
- [Specification changelog](CHANGELOG.md)
- [BDD specification text](product.feature)
- [Evidence fixtures](FIXTURES.md)
- [Identity and status schema](product_SCHEMA.md)

## Authorities and evidence

- `IMPORT_MANIFEST.yaml` is the source-freeze and per-file provenance authority.
- `MIGRATION_MATRIX.md` is the adoption/disposition authority.
- `ROADMAP.md` is the repository-stage policy; this spec constrains its honesty. v0.3 is the first slice of the generator-port MCP door.
- `docs/upstream/dev-pomogator/spec-generator-v4/` is immutable reference material only.
- Executed, current gate artifacts are required before a status can move beyond planned/spec-only. Document presence or a structurally valid scenario never proves delivery.
