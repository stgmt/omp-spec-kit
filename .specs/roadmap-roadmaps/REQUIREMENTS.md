# Requirements

## Scope

Provide per-spec roadmap documents that are auto-assembled from the specification graph and safe to re-assemble. A roadmap is a human-facing, requirement-level view: it shows which functional requirements, use cases, and user stories a theme covers and how far along each is. Task-level detail stays in the lower, machine-facing layer and never appears on the roadmap.

## REQ-1: Roadmap document kind and detection

`ROADMAP.md` is a canonical document of a `roadmap-*` spec. It declares the canonical aggregate node `<specSlug>:ROADMAP` in the graph, so the roadmap itself is addressable and traceable like any other entity. A spec is a roadmap spec if and only if its slug starts with `roadmap-`; the README `Profile: roadmap` field is a human-facing convention mirroring that rule and carries no detection semantics.

## REQ-2: Scope derived from existing links

A roadmap spec declares no separate coverage field. The assembly scope is derived from the roadmap spec's own `Implements:`/`Refs:` references: the set of distinct target spec slugs appearing in roadmap FR and TASK definitions defines which specs feed the generated region.

## REQ-3: Deterministic assembly

The generated region is a pure function of the canonical graph: requirement-level entities (FUNCTIONAL_REQUIREMENT, USE_CASE, USER_STORY) of the covered specs, ordered by code-point comparison of canonical ID, grouped by their spec and document of origin. Equal graphs produce byte-identical generated regions.

## REQ-4: Derived requirement status

Each generated item carries a status derived only from graph edges: `done` when at least one implementing TASK exists and all of them are `done`; `in progress` when at least one implementing TASK is `done` or `todo`; `planned` when no implementing TASK exists. USE_CASE/USER_STORY derive through the requirement-level entities they cover or reference. Derived status is never authored.

## REQ-5: Non-destructive re-assembly

Generated content lives between `<!-- roadmap:auto:start -->` and `<!-- roadmap:auto:end -->` markers. Re-assembly rewrites only that region: items merge by canonical ID, items absent from the graph are removed from the generated region, and authored text anywhere outside the markers — including notes that reference generated items — is preserved verbatim.

## REQ-6: Governed write path

Assembly and re-assembly write through the governed transactional path — `spec_patch`. A generated-region write produces a receipt; direct file mutation is not an assembly interface.

## REQ-7: Lifecycle through spec_patch

The roadmap lifecycle — create the spec with a skeleton ROADMAP.md, assemble the generated region, re-assemble on graph change, and report the derived view — is exposed as `spec_patch` intents, keeping the 10-tool surface unchanged. The `spec_patch` intent contract is updated in the same change.

## REQ-8: Roadmap-to-feature tracing

Roadmap FRs describe implementation waves. Roadmap TASKs link to feature spec FRs and ACs via `Implements:`; the graph resolves these cross-spec edges so product intent traces to implementation detail.

## REQ-9: Roadmap lifecycle state

A roadmap spec declares a lifecycle state in its README profile (`draft`, `active`, `completed`, `superseded`). The product ROADMAP.md aggregates the status of all active roadmap specs. A roadmap spec does not enter a shipped state without end-to-end proof.

## REQ-10: Board aggregate

The board projection exposes one ROADMAP node per `roadmap-*` spec with CONTAINS edges to its members, backed by the canonical `<specSlug>:ROADMAP` identity.

## Traceability

| Requirement | Functional requirements | Acceptance criteria |
|---|---|---|
| REQ-1 | FR-5 | AC-5.1 |
| REQ-2 | FR-6 | AC-6.1 |
| REQ-3 | FR-6 | AC-6.2 |
| REQ-4 | FR-7 | AC-7.1 |
| REQ-5 | FR-8 | AC-8.1, AC-8.2, AC-8.3 |
| REQ-6 | FR-9 | AC-9.1 |
| REQ-7 | FR-9 | AC-9.1 |
| REQ-8 | FR-2 | AC-2.1 |
| REQ-9 | FR-3 | AC-3.1 |
| REQ-10 | FR-4 | AC-4.1 |
