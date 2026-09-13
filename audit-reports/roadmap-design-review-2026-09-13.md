# Adversarial review: roadmap design vs intent vs implementation

Date: 2026-09-13. Scope: `.specs/roadmap-roadmaps/`, `src/kernel/types.js`, `src/kernel/query/service.js`, board projection, live YouTrack state. Method: direct corpus-graph queries, code reads, spec↔code cross-check.

## Verdict

Core works — cross-spec traceability is real and verified in the canonical graph. But the spec text has three stale/dishonest claims from the pre-review state, and the `ROADMAP` kind is projection-only fiction that mismatches the original intent ("roadmap = markdown document").

## Verified OK (reality matches claims)

- **Cross-spec IMPLEMENTS edges exist and resolve** — 8 canonical edges: `roadmap-roadmaps:TASK-{1..4}` → own FR + target feature FR (`spec-mcp-operations:FR-33/FR-2/FR-4/FR-39`). FR-2's "traceable path from product intent to implementation detail" is real.
- **Board projection is live and correct** — synthetic `roadmap-roadmaps:ROADMAP` node + 16 CONTAINS edges projected to tracker card SPEC-478 (type Roadmap, SpecKind=ROADMAP); sync parity confirmed.
- **Roadmap items are first-class canonical nodes** — TASK/FR/AC/SCENARIO under `roadmap-*` slug have real canonical IDs and statuses. This is actually *good* for the future goal of composing a release from items across roadmaps: items are individually addressable and traceable without any schema change.

## Findings (defects / neuroslop)

### F1. TASK-1 text contradicts shipped code (spec-fiction)

`.specs/roadmap-roadmaps/TASKS.md` TASK-1 says: "No new document kind, local ID role, or edge type needed." Shipped code does the opposite:

- `src/kernel/types.js` — `LOCAL_ID_ROLES.ROADMAP` added (`re: /^ROADMAP$/`), required so `roadmapBoardNode`'s canonicalId passes grammar validation (added during review-round fixes).
- `src/kernel/types.js` — `CONTAINS` edge type added to `EDGE_TYPE_DESCRIPTORS` + `EDGE_ENDPOINT_MATRIX` (`from: ["ROADMAP"]`).

The task is marked `Status: done` while describing a smaller diff than shipped. Either the task text must record the actual change, or the implementation is out of spec. The implementation is correct; the text is stale.

### F2. Convention `profile: roadmap` not followed by its own first instance

TASK-2 requires README profile field `profile: roadmap`. Actual `.specs/roadmap-roadmaps/README.md` declares `Profile: light`. Roadmap detection in `query/service.js` works by slug prefix `roadmap-` (`ROADMAP_SPEC_PREFIX`), so the corpus functions — but the documented convention is unimplemented: no spec actually sets `profile: roadmap`, and nothing validates it.

### F3. `ROADMAP` is a kind without canonical instances (duality)

`ENTITY_TYPE_DESCRIPTORS` and `NODE_KINDS` catalog `ROADMAP` as an entity kind, but the canonical graph contains **zero** ROADMAP nodes and zero CONTAINS edges — both exist only inside `runBoard`'s synthetic projection (`roadmapBoardNode`, lines ~731-830). Consequences:

- `spec_catalog(view:"types")` advertises a kind no graph query can return (except `board`).
- A future "release composition" spec **cannot canonically link to the roadmap aggregate** — `roadmap-roadmaps:ROADMAP` is not addressable via REFS/IMPLEMENTS because it has no canonical node. Linking to roadmap TASK/FR items works; linking to "the roadmap" does not.
- Any consumer assuming `entityKinds ⊆ canonical node kinds` (fingerprint checks, catalog diffs) sees a phantom kind.

This is the actual design gap vs the original intent: the roadmap exists *as a folder convention + board aggregate*, not as a document-level entity. If the intended model is "roadmap is an MD document whose items compose into releases", the current shape supports item-level composition but gives the roadmap itself no canonical identity.

### F4. Feature scenarios are declarative-only

`roadmap-roadmaps.feature` defines 4 `SCEN-roadmap-*` scenarios; no step definition executes them (`tests/features/` + step files contain no roadmap wiring). Consistent with corpus convention (spec `.feature` files are corpus artifacts, not test inputs) — but the AC "Done when" claims for visualization and tracing have no executable counterpart; their only evidence is the live board and this review's direct queries.

## Intent mismatch, honestly stated

Original intent (per user): roadmap = a markdown document; later, compose a release by picking items from different roadmaps, traceably.

Shipped model: roadmap = a *spec folder* (`roadmap-<theme>/`) whose own FR/TASK items are canonical nodes, plus a synthetic board aggregate. This is arguably **stronger** for the stated future goal — release composition can reference `roadmap-*:TASK-n`/`FR-n` directly with full IMPLEMENTS traceability — but it diverges from "roadmap is a document", and the divergence was never recorded in the spec. The honest description: roadmap is a reduced-profile *spec*, not a document.

## Recommended fixes (not applied)

1. TASK-1: rewrite to record the actual shipped change (LOCAL_ID_ROLES + CONTAINS added).
2. TASK-2/README: either set `profile: roadmap` and enforce it, or change the convention text to `profile: light` + slug-prefix detection (document that detection is slug-based).
3. DESIGN/FR: state explicitly that `ROADMAP`/`CONTAINS` are board-projection syntheses with no canonical instances — or, if the aggregate must be canonically addressable later, promote it to a real node (bigger change; defer until release-composition work needs it).
4. If executable evidence is wanted for SCEN-roadmap-*: wire them into `tests/features/` like the safe-authoring suite.

## Resolution (2026-09-13, same day)

Spec updated per validated model: ROADMAP.md becomes a canonical per-spec document (TASK-5), auto-assembled from graph scope derived from Implements/Refs links (FR-6), with derived requirement status (FR-7), non-destructive marker-region re-assembly (FR-8), and a governed MCP lifecycle surface (FR-9). F1/F2 text fixed in place; F3 resolved by design (canonical `<slug>:ROADMAP` node via ROADMAP.md declaration); F4 remains declarative until executable wiring is added in the implementation slice.
