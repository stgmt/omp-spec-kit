# Product specification

This specification defines the public product boundary and repository lifecycle for `omp-spec-kit`. It governs what the project may claim, when it may become public, and how one product advances through evidence-gated release stages. It does not define plugin packaging internals, graph implementation, or authoring mutation mechanics.

## Current product status

**The current public-init candidate is local, specification-only, and has no installable plugin, marketplace catalog, package, release, public remote, or runtime capability.** The Gherkin scenarios in this directory are specification text only. They have not been executed and are not evidence that any capability is delivered.

| Stage | State | Public claim permitted now |
|---|---|---|
| Public init | `SPEC_ONLY / LICENSE_RESOLVED / PUBLIC_INIT_VALIDATED / PUBLIC_SPECIFICATION_INIT` | Reviewed initial commit `fe70b10caaed888daf7c48dfc8f1bad9caf45598` is public with matching local/remote/tree evidence. No marketplace, plugin payload, runtime, tag, or release exists. |
| v0.1.0 | `PLANNED` | No install or runtime claim is permitted until `plugin-distribution:FR-13` accepts complete mandatory evidence bound to the current candidate revision, artifact, and lineage. |
| v0.2 | `PLANNED` | No graph/query claim is permitted until distribution and `spec-kernel:FR-14` `targetStage: "v0.2"` are accepted and both bind to the current v0.2 candidate artifact/revision/lineage. |
| v0.3 | `PLANNED` | No MCP claim is permitted until distribution and `spec-kernel:FR-14` `targetStage: "v0.3"` bind to current candidate B and a separate active v0.2 result is linked as predecessor A by the v0.3 result's exact `v02ParentArtifactSha256`; both kernel results must share revision/lineage in strict stage order. A and B may differ. |
| Later authoring/mutation | `DEFERRED` | No write, proposal, CAS, repair, backlog, or mutation claim is permitted until current-candidate distribution, v0.3 kernel, and `spec-authoring-workflow:FR-13` plus the same linked non-stale/non-revoked v0.2 predecessor satisfy every cumulative gate. |

## Product identity

- Repository/product: `omp-spec-kit`.
- Intended future installed identity: `omp-spec-kit@omp-spec-kit`.
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
