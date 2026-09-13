# Functional Requirements

## FR-1: Roadmap kernel type

The kernel SHALL expose ROADMAP as a recognized entity kind in the type catalog (ENTITY_TYPE_DESCRIPTORS). A spec with slug prefix `roadmap-` is a roadmap spec. The kernel SHALL admit all standard entity kinds (FR, TASK, AC, SCENARIO) inside a roadmap spec and SHALL resolve cross-spec references from roadmap entities to feature spec entities through the existing edge types. As shipped, the kind exists as a descriptor plus the ROADMAP local-ID role and CONTAINS edge type; the aggregate's canonical identity is board-synthesized until FR-5 lands the ROADMAP.md document kind.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-roadmap-kernel-type)

**Scenario:** `@feature1` / `SCEN-roadmap-kernel-type`

**Task:** [TASK-1](TASKS.md#task-1-add-roadmap-entity-kind)

## FR-2: Roadmap-to-feature tracing

A roadmap FR SHALL describe one implementation phase. A roadmap TASK SHALL link to one or more feature spec FRs or ACs via the `Implements:` column in TASKS.md. The graph SHALL resolve these cross-spec `IMPLEMENTS` edges and SHALL make them visible through spec_graph traversal. An `IMPLEMENTS` edge from a roadmap TASK to a feature spec FR or AC SHALL create a traceable path from product intent to implementation detail.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-roadmap-to-feature-tracing)

**Scenario:** `@feature2` / `SCEN-roadmap-to-feature-tracing`

**Task:** [TASK-2](TASKS.md#task-2-define-roadmap-spec-template)

## FR-3: Roadmap lifecycle

A roadmap spec SHALL support lifecycle states declared in README.md profile: `draft`, `active`, `completed`, `superseded`. The product ROADMAP.md SHALL aggregate the SHIPPED/NEXT/LATER status of all active roadmap specs. A roadmap spec SHALL NOT enter SHIPPED in the product roadmap without real end-to-end proof per plugin-distribution:FR-16.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-roadmap-lifecycle)

**Scenario:** `@feature3` / `SCEN-roadmap-lifecycle`

**Task:** [TASK-3](TASKS.md#task-3-implement-roadmap-lifecycle)

## FR-4: Roadmap visualization

The YouTrack spec board SHALL display roadmap specs alongside feature specs, filterable by entity kind ROADMAP. Roadmap phases SHALL appear as FR nodes with edges to their implementing TASKs and to target feature spec FRs. The board SHALL support zooming from a roadmap phase into the linked feature spec subgraph.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-roadmap-visualization)

**Scenario:** `@feature4` / `SCEN-roadmap-visualization`

**Task:** [TASK-4](TASKS.md#task-4-extend-youtrack-board-for-roadmaps)

## FR-5: Canonical roadmap document

A `roadmap-*` spec SHALL contain `ROADMAP.md` as a canonical document. The kernel SHALL treat ROADMAP as a document kind that declares the aggregate node `<specSlug>:ROADMAP`, making the roadmap addressable by REFS/IMPLEMENTS edges from other specs. The document combines authored content with one generated region bounded by `<!-- roadmap:auto:start -->` and `<!-- roadmap:auto:end -->` markers; text outside the markers is authored and never rewritten by assembly.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-canonical-roadmap-document)

**Scenario:** `@feature5` / `SCEN-roadmap-canonical-document`

**Task:** [TASK-5](TASKS.md#task-5-canonical-roadmap-document)

## FR-6: Scope-derived deterministic assembly

The assembler SHALL derive the roadmap's scope from the distinct target spec slugs referenced by the roadmap spec's own `Implements:` and `Refs:` fields — no separate coverage declaration exists. The generated region SHALL list requirement-level entities (FUNCTIONAL_REQUIREMENT, USE_CASE, USER_STORY) of the covered specs grouped by spec and ordered by code-point comparison of canonical ID. TASK, DOCUMENT, and other lower-layer kinds SHALL NOT appear in the generated region. Equal canonical graphs SHALL produce byte-identical generated regions.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-scope-derived-assembly), [AC-6.2](ACCEPTANCE_CRITERIA.md#ac-62-deterministic-output)

**Scenario:** `@feature6` / `SCEN-roadmap-scope-assembly`

**Task:** [TASK-6](TASKS.md#task-6-deterministic-assembly)

## FR-7: Derived requirement status

Each generated item SHALL carry a status derived only from graph edges. For a FUNCTIONAL_REQUIREMENT: `done` when at least one implementing TASK exists and every one is `done`; `in progress` when at least one implementing TASK is `done` or `todo`; `planned` when no implementing TASK exists. For a USE_CASE or USER_STORY, the same rule applies over the statuses of the requirement-level entities it covers or references. The derived status SHALL be recomputed on every assembly; no status field is authored inside the generated region.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-derived-status)

**Scenario:** `@feature7` / `SCEN-roadmap-derived-status`

**Task:** [TASK-6](TASKS.md#task-6-deterministic-assembly)

## FR-8: Non-destructive re-assembly

Re-assembly SHALL rewrite only the marked generated region, merging items by canonical ID: existing items update title, status, and section placement; new items are inserted in deterministic order; items absent from the current graph are removed from the generated region. Authored content outside the markers — including notes that name generated canonical IDs — SHALL be preserved byte-for-byte. If a ROADMAP.md lacks markers or carries malformed marker pairs, assembly SHALL fail with a typed diagnostic instead of rewriting the document.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-merge-preserves-authored), [AC-8.2](ACCEPTANCE_CRITERIA.md#ac-82-vanished-items-removed), [AC-8.3](ACCEPTANCE_CRITERIA.md#ac-83-missing-markers-refused)

**Scenario:** `@feature8` / `SCEN-roadmap-reassembly`

**Task:** [TASK-7](TASKS.md#task-7-non-destructive-re-assembly)

## FR-9: Governed roadmap lifecycle via spec_patch

The roadmap lifecycle SHALL be exposed as `spec_patch` intents: create the roadmap spec with a skeleton ROADMAP.md (markers present), assemble or re-assemble its generated region, and report the derived view — all through the governed transactional write path with receipts, keeping the 10-tool surface unchanged. The `spec_patch` intent contract SHALL be updated in the same change.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-mcp-roadmap-lifecycle)

**Scenario:** `@feature9` / `SCEN-roadmap-mcp-lifecycle`

**Task:** [TASK-8](TASKS.md#task-8-mcp-roadmap-lifecycle)
