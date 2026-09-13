# Tasks

## TASK-1: Add ROADMAP entity kind

Status: done
Estimate: 0.5
Phase: Kernel
Implements: `roadmap-roadmaps:FR-1`, `spec-mcp-operations:FR-33`

Add ROADMAP to ENTITY_TYPE_DESCRIPTORS in src/kernel/types.js. No new document kind, local ID role, or edge type needed. ROADMAP is a descriptor kind (like DOCUMENT) — it labels the spec aggregate, not individual definitions.

Done when:
- `spec_catalog(view: "types")` returns ROADMAP in entityKinds
- Existing roadmap-roadmaps spec is valid (no new diagnostics)
- All existing specs remain valid (fingerprint unchanged)

## TASK-2: Define roadmap spec template

Status: done
Estimate: 1
Phase: Template
Implements: `roadmap-roadmaps:FR-2`, `spec-mcp-operations:FR-2`

Document the roadmap spec convention:
- Slug prefix `roadmap-`
- Required documents: README.md, FR.md, TASKS.md, ACCEPTANCE_CRITERIA.md, `<slug>.feature`
- README profile field `profile: roadmap`
- FR.md uses standard FR definitions for implementation phases
- TASKS.md `Implements:` column traces to feature spec FRs/ACs

Done when:
- Convention documented in the first roadmap spec README
- `spec_inspect(check: "validation")` validates roadmap specs without errors

## TASK-3: Implement roadmap lifecycle

Status: done
Estimate: 2
Phase: Lifecycle
Implements: `roadmap-roadmaps:FR-3`, `spec-mcp-operations:FR-4`

Support lifecycle states in roadmap README profile (`status: draft|active|completed|superseded`). Add product ROADMAP.md aggregation from all roadmap specs via spec_catalog.

Done when:
- roadmap-roadmaps README declares a lifecycle state
- Product ROADMAP.md references the roadmap spec

## TASK-4: Extend YouTrack board for roadmaps

Status: done
Estimate: 3
Phase: Visualization
Implements: `roadmap-roadmaps:FR-4`, `spec-mcp-operations:FR-39`

Update the YouTrack spec-board widget to filter by entity kind ROADMAP and show cross-spec IMPLEMENTS edges from roadmap phases to feature spec nodes.

Done when:
- Spec board has a ROADMAP filter
- Cross-spec edges from roadmap to feature specs are visible
