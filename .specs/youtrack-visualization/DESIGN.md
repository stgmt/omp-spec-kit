# Design

## Bounded contexts

The integration has four explicit contexts.

1. Spec Kernel / MCP owns parsing, canonical identities, graph validation, fingerprints, and the complete BoardProjectionV1 read model.
2. YouTrack Projection owns card fields, descriptions, nine link types, parity comparison, and the committed snapshot pointer.
3. Writeback owns the narrow TASK status command and calls spec_patch through the governed MCP boundary.
4. Board UX owns rendering and interaction over one immutable BoardSnapshotV1. It owns no graph semantics.

The sync composition root is scripts/spec-graph-sync.mjs. It orchestrates ports only; it does not import readRepositorySpecs, buildKernelGraph, or duplicate edge mapping.

## Ports and adapters

| Port | Responsibility | Infrastructure adapter |
|---|---|---|
| SpecGraphReader | read complete BoardProjectionV1 for a scope | MCP JSON-RPC spec_graph view board |
| TrackerProjectionStore | read cards and links; upsert cards; reconcile links | YouTrack REST |
| SyncStateStore | read and publish the committed pointer and snapshot | SPEC:SYNC-STATE issue |
| TaskStatusWriteback | request a validated TASK status change | spec_patch MCP operation |

The application service receives these ports. Card and link translators are pure functions. REST, MCP transport, authentication, locking, retries, JSON serialization, and YouTrack custom-field syntax remain outside the domain and application layers.

## BoardProjectionV1

The MCP DTO is a complete bounded object with schemaVersion, fingerprint, scope, complete=true, page=null, nodes, edges, and counts. A node contains canonicalId, specSlug, localId, kind, title, body, contentHash, source path and line, evidence, and taskStatus when applicable. An edge contains from, to, raw kernel type, and occurrenceCount. Only six board kinds are emitted; edges with an unselected endpoint are omitted.

The branch accepts view board and optional specSlugs. Omitted or empty scope means the whole corpus. No cursor or limit is accepted. The MCP layer returns RESPONSE_TOO_LARGE instead of truncating a successful response.

## Projection mapping

The one mapping table is the only source for tracker link semantics.

| Raw kernel edge | Endpoint guard | Tracker link |
|---|---|---|
| TESTED_BY | FR to SCENARIO | covers: SCENARIO to FR |
| TESTED_BY | NFR to SCENARIO | covers: SCENARIO to NFR |
| TESTED_BY | AC to SCENARIO | verifies: SCENARIO to AC |
| COVERS | SCENARIO to FR | covers: SCENARIO to FR |
| COVERS | AC to FR | covers: AC to FR |
| REFS | FR to AC | satisfies: FR to AC |
| REFS | AC to FR | satisfied-by: AC to FR |
| REFS | TASK to FR | implements: TASK to FR |
| REFS | FR to TASK | implemented-by: FR to TASK |
| REFS | TASK to NFR | constrains: NFR to TASK |
| IMPLEMENTS | TASK to FR | implements: TASK to FR |
| IMPLEMENTS | TASK to NFR | constrains: NFR to TASK |
| IMPLEMENTS | TASK to AC | implements: TASK to AC |
| DEPENDS_ON | TASK to TASK | depends-on: TASK to TASK |
| DECLARES | TASK to NFR | constrains: NFR to TASK |
| CONTAINS | ROADMAP to FR | contains: ROADMAP to FR |
| CONTAINS | ROADMAP to NFR | contains: ROADMAP to NFR |
| CONTAINS | ROADMAP to AC | contains: ROADMAP to AC |
| CONTAINS | ROADMAP to TASK | contains: ROADMAP to TASK |
| CONTAINS | ROADMAP to SCENARIO | contains: ROADMAP to SCENARIO |

Rows match on (edge type, source kind, target kind); the tracker link direction is the semantic direction, which may be the reverse of the kernel edge direction. Unsupported raw edges are skipped with a diagnostic and never guessed. The adapter canonicalizes inverse-named link types (satisfied-by, implemented-by) onto the canonical relation (satisfies, implements) so physical link direction is audited; the allowed tracker set remains exactly nine types, provisioned as directed link types.

The board emits one synthetic ROADMAP node per `roadmap-*` spec plus CONTAINS edges to that spec's member nodes; these edges exist only in the board projection, never in the canonical graph.

## Card translation

SpecId is specSlug:localId. The summary is the node title. The description includes the full bounded body, per-kind headings, relations grouped by tracker link type, source path and line, content hash, and evidence. Type maps TASK to Task, FR to Feature, AC to Criterion, SCENARIO to Scenario, NFR to Constraint, and ROADMAP to Roadmap. All interpolated values are escaped before rendering.

## Commit protocol

1. Read one complete BoardProjectionV1 and validate fingerprint, scope, identities, endpoint kinds, and size.
2. Read the current pointer and actual tracker cards and links.
3. If pointer is valid, fingerprint matches, and parity digest matches, return skipped with zero writes.
4. Otherwise translate and upsert cards, then reconcile the desired link set.
5. Serialize BoardSnapshotV1, compute snapshotHash and projectionDigest, sign the marker, and publish the snapshot plus commit marker last.

The pointer stores schemaVersion, source fingerprint, snapshotHash, projectionDigest, scope, nodeCount, edgeCount, and committedAt. The marker is the visibility boundary. A failure before publication leaves the previous marker and snapshot untouched. This is last-complete visibility, not a remote transaction; repair is idempotent on the next run.

Marker integrity and mutual exclusion live in the sync-state adapter:

- Every published marker carries an HMAC-SHA256 signature over its canonical form. The key is local to the sync host (SPEC_SYNC_MARKER_KEY or ~/.omp/spec-sync-marker-key, mode 0600). cardIds and the snapshot baseline are only honored from a marker whose signature verifies; a tracker member who edits or plants a pointer issue cannot forge ownership, and the next sync rewrites or deletes the forged pointer.
- Pointer issues are deduplicated deterministically — the lowest issue id is canonical and publish deletes the rest — so no permanent split brain can form.
- A same-host lock file (~/.omp/spec-graph-sync.lock, pid-stamped, broken only when the holder process is gone) prevents overlapping syncs from racing pointer creation.
- The pointer's SpecId custom field honors the project field's declared valueType, the same contract as card creation.

## Direction and status

All identity, text, evidence, native type, content hash, and graph fields flow from .specs to YouTrack. TASK status is the only reverse field. Approve maps Open to Fixed and requests done; Verify maps Fixed to Verified and does not alter the spec; Reopen maps a resolved card to Reopened and requests todo. The workflow rejects non-TASK identities and invalid transitions.

## Writeback delivery

The tracker State change is the durable intent. The workflow rule POSTs a hint to the listener; the listener re-reads the issue, requires SpecKind TASK plus a matching SpecId, and applies the tracker-held State through spec_patch — the event body is never trusted. Every writeback and sweep mutation is ownership-gated by the committed snapshot's cardIds map, so a hand-set SpecId on a foreign card cannot drive spec_patch or arm a confused-deputy delete. Both paths share one three-way merge of tracker State, live spec status, and the committed baseline: a divergence where the spec moved wins, a spec status the tracker cannot represent wins, and a tracker-side change on a spec-still-at-baseline task replays deterministically by specId. spec_patch honors every Status field form the kernel parses (plain `Status:`, `**Status:**`, and bulleted `- **Status:**`), rewriting the line in its authored shape. Chronological replay would need the activities API and is out of scope. The listener requires SPEC_WRITEBACK_TOKEN on every bind — loopback is not an authentication boundary on Docker Desktop — and serves only bounded status payloads without filesystem paths or upstream error detail. Liveness is not a bare 200: `/health?nonce=N` must answer an HMAC proof under the writeback token so a foreign process squatting the port cannot impersonate the listener, and `spec-listener-ensure` verifies that proof before reporting alive. Widgets select the committed pointer by its `SpecId` custom field — the same gate the sync uses — so a summary-matching lookalike issue cannot spoof the authoritative snapshot to viewers. The durable outbox lives under ~/.omp (a user-private directory, never the shared tmpdir) and refuses symlink paths.

## Board UX

V1 Flow uses lanes TASK, FR, AC, SCENARIO, and NFR; edges are rendered as Bezier paths and a card drawer shows source content and links. V2 Cluster renders kind-filterable islands with pan and zoom and no artificial slice. V3 Lineage provides searchable results, center-on-result, and separate outgoing and incoming relations. All views load the same snapshot, default to the whole corpus, escape text, and expose loading, error, empty, search, reset, and dark-theme states.

## Verification matrix

Contract tests cover complete MCP reads, scope, mapping, deterministic card output, parity skip, same-fingerprint drift, commit ordering, failure retention, duplicate identity, and size errors. Browser tests cover the panel and V1/V2/V3 interactions. A fresh-process integration test proves the MCP JSON-RPC call and sync composition root use the ports.
