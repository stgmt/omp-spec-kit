# Research

## Findings

RF-1. The repository specification kernel is authoritative. YouTrack issues, links, and the SPEC:SYNC-STATE payload are projections.

RF-2. No tracker projection existed in the repository: the sync composition root is introduced by this feature and is written against ports from the start, so it never becomes a second graph composition root.

RF-3. The raw-edge-to-tracker mapping lives in one pure adapter module (src/adapters/youtrack-projection.js) and is consumed by the application service; no copy of it lives in the composition root.

RF-4. The public MCP surface has ten tools and one mutating tool, spec_patch. The existing spec_graph read has edges and trace branches; the board branch is a required contract addition, not an extra public tool.

RF-5. A complete board projection is safer than reconstructing topology in the widget. It gives the adapter one source fingerprint, one identity set, bounded card-source content, and raw kernel edges while preserving tracker link semantics in the adapter.

RF-6. Fingerprint equality alone is insufficient: tracker drift can occur without a source change. The skip rule therefore requires a valid committed pointer and read-only parity of authoritative fields and links.

RF-7. A commit marker published after card and link reconciliation gives readers the last complete projection. It does not make YouTrack transactional, so retries and idempotent repair remain required.

RF-8. Staging evidence shows pointer updates need REST merge semantics; whole-issue replacement can erase fields. The production adapter must isolate that behavior in SyncStateStore.

## Decisions

D-1. Keep one spec_graph tool and add a strict view board discriminator. Do not create a board-only MCP tool.

D-2. Keep raw kernel edge types in BoardProjectionV1. Convert them to the nine tracker link types only in the YouTrack adapter.

D-3. Keep the board snapshot immutable per committed fingerprint. Task state changes produce a new authoritative source state and a new projection rather than a live tracker-topology overlay.

D-4. Introduce the port-based composition root after contract fixtures and fresh-process verification pass; no legacy script is retired because none existed.

## Rejected alternatives

A live widget graph assembled from issue links was rejected because links are a projection and can be incomplete during sync. A fingerprint-only skip was rejected because it hides tracker drift. An additional public board tool was rejected because the public surface is intentionally consolidated.
