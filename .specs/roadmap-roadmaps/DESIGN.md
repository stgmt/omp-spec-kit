# Design

## Model

A roadmap spec (`.specs/roadmap-<theme>/`) owns one canonical `ROADMAP.md` — a hybrid document: authored narrative plus exactly one generated region bounded by `<!-- roadmap:auto:start -->` / `<!-- roadmap:auto:end -->`. The kernel registers ROADMAP as a document kind whose declaration yields the canonical aggregate node `<specSlug>:ROADMAP`; the board projection's former synthetic node becomes a plain canonical node, and CONTAINS edges remain the board's top-down containment view.

## Assembly pipeline

1. **Scope derivation (pure).** Collect the distinct spec slugs targeted by `Implements:`/`Refs:` references inside the roadmap spec's own FR and TASK definitions. That set is the coverage scope; there is no separate coverage field.
2. **Item collection (pure).** From each covered spec take requirement-level nodes: FUNCTIONAL_REQUIREMENT, USE_CASE, USER_STORY. TASK, SCENARIO, DOCUMENT, and aggregate kinds are excluded — they are the lower, machine-facing layer.
3. **Status derivation (pure).** FR status: `done` when ≥1 IMPLEMENTS-in TASK exists and all are `done`; `in progress` when ≥1 implementing TASK is `done`/`todo`; `planned` otherwise. UC/US aggregate the derived statuses of the requirement-level entities they COVER/REFS to.
4. **Ordering (pure).** Items group by spec slug, then by canonical ID under code-point comparison — locale-independent, stable across machines.
5. **Region merge (pure text transform).** Parse ROADMAP.md; locate exactly one marker pair; emit the new generated block. Merge is by canonical ID: surviving items update, new insert in order, vanished items are dropped from the region. Any bytes outside the markers pass through unchanged. Missing or malformed markers → typed refusal.
6. **Governed emit.** The merged document is written through the receipted transactional path (spec_patch family), never by direct file write.

## MCP surface

The lifecycle rides on `spec_patch` intents (e.g. a roadmap assembly intent), so the 10-tool surface is unchanged: the intent contract gains roadmap operations while the manifest and blast budgets stay put. Reads reuse the existing `spec_graph` board view — the derived view is the same projection widgets consume.

## Board projection

With a canonical `<specSlug>:ROADMAP` node, `roadmapBoardNode` stops synthesizing identity and projects the declared node; CONTAINS edges from the aggregate to its spec members stay a board-level derivation.

## Boundaries

- The assembler never invents items: only graph nodes of covered specs appear.
- Authored prose is sovereign outside markers; the generated region is sovereign inside them.
- `.specs` stays authoritative; the roadmap file is itself corpus, so generated content must be deterministic or fingerprints flap.
