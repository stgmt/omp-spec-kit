# Tasks

## TASK-1: Add ROADMAP entity kind

Status: done
Estimate: 0.5
Phase: Kernel
Implements: `roadmap-roadmaps:FR-1`, `spec-mcp-operations:FR-33`

Add ROADMAP to ENTITY_TYPE_DESCRIPTORS in src/kernel/types.js. As shipped, the kind also required a ROADMAP local-ID role (`LOCAL_ID_ROLES`, grammar `^ROADMAP$`) so the aggregate identity `<specSlug>:ROADMAP` passes canonical validation, and the CONTAINS edge type for board containment. ROADMAP labels the spec aggregate, not individual definitions.

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
- Required documents: README.md, ROADMAP.md, FR.md, TASKS.md, ACCEPTANCE_CRITERIA.md, `<slug>.feature`
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

## TASK-5: Canonical roadmap document

Status: todo
Estimate: 2
Phase: Kernel
Implements: `roadmap-roadmaps:FR-5`

Register ROADMAP.md as a canonical document kind for `roadmap-*` specs whose declaration yields the canonical aggregate node `<specSlug>:ROADMAP`. Update corpus document expectations and the board projection to consume the declared node instead of a synthesized one.

Done when:
- `.specs/roadmap-roadmaps/ROADMAP.md` exists and parses as a canonical document
- Canonical graph contains `roadmap-roadmaps:ROADMAP`
- Board projection shows the same identity without a synthetic node

## TASK-6: Deterministic assembly

Status: todo
Estimate: 3
Phase: Assembly
Implements: `roadmap-roadmaps:FR-6`, `roadmap-roadmaps:FR-7`

Implement the pure assembler: derive covered spec slugs from the roadmap spec's Implements/Refs targets, collect FUNCTIONAL_REQUIREMENT/USE_CASE/USER_STORY nodes of covered specs, derive per-item status from IMPLEMENTS-in TASK edges, group by spec, order by code-point canonical ID, and render the generated block deterministically.

Done when:
- Unit tests cover scope derivation, status derivation, ordering, and byte-identical output on an unchanged graph
- No TASK/DOCUMENT-kind items appear in generated output

## TASK-7: Non-destructive re-assembly

Status: todo
Estimate: 2
Phase: Assembly
Implements: `roadmap-roadmaps:FR-8`

Implement the marker-region merge: rewrite only the `roadmap:auto` region, merge items by canonical ID, drop vanished items, preserve authored bytes outside the markers, and refuse with a typed diagnostic when markers are missing or malformed.

Done when:
- Re-assembly on an unchanged graph produces a zero-byte diff
- Authored notes outside markers survive a re-assembly that removes generated items
- Missing/malformed markers produce a typed refusal

## TASK-8: MCP roadmap lifecycle

Status: done
Estimate: 3
Phase: Surface
Implements: `roadmap-roadmaps:FR-9`

Expose the roadmap lifecycle as `spec_patch` intents: create a roadmap spec with a skeleton ROADMAP.md, assemble/re-assemble the generated region through the governed write path, and report the derived view. Update the spec_patch intent contract in the same change; the 10-tool surface stays unchanged.

Done when:
- A live-MCP e2e scenario creates, assembles, and re-assembles a roadmap through spec_patch intents
- Every write emits a receipt
- Tool-surface verification passes unchanged (still 10 tools)
