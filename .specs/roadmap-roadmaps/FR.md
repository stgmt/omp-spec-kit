# Functional Requirements

## FR-1: Roadmap kernel type

The kernel SHALL expose ROADMAP as a recognized entity kind in the type catalog (ENTITY_TYPE_DESCRIPTORS). A spec with slug prefix `roadmap-` is a roadmap spec. The kernel SHALL admit all standard entity kinds (FR, TASK, AC, SCENARIO) inside a roadmap spec and SHALL resolve cross-spec references from roadmap entities to feature spec entities through the existing edge types.

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
