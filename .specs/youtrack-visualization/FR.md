# Functional Requirements

The integration is a projection adapter between the authoritative .specs graph, YouTrack, and the in-tracker views. The tracker never becomes a second graph authority.

## FR-1: In-tracker views use one committed snapshot

The app SHALL expose the issue panel and the dashboard board. Both SHALL read the committed BoardSnapshotV1 from the SPEC:SYNC-STATE pointer and SHALL NOT reconstruct topology from tracker issue links.

## FR-2: Project fields identify every projection card

Project SPEC SHALL provide SpecKind, SpecId, ContentHash, Evidence, and the native Type field. SpecId SHALL be <specSlug>:<localId> and SHALL be unique across the project.

## FR-3: The tracker projection has exactly nine link types

The adapter SHALL create only satisfies, satisfied-by, verifies, covers, implements, implemented-by, depends-on, constrains, and contains. Reverse directions are separate link types, not hidden aliases.

## FR-4: Sync reads one complete MCP board projection

The sync composition root SHALL call spec_graph with view board once for the requested scope. The response SHALL contain the complete bounded board projection, its fingerprint, card-source fields, and aggregated raw kernel edges. The sync root SHALL NOT import kernel readers or rebuild the graph.

## FR-5: Sync skips only after a read-only parity check

The adapter SHALL read the committed pointer and actual tracker projection. A matching fingerprint permits zero writes only when the pointer is valid and authoritative card fields and links equal the desired projection. Same-fingerprint drift SHALL be repaired idempotently.

## FR-6: Projection direction is explicit

Spec identity, titles, bodies, source metadata, evidence, content hashes, kinds, native types, and graph links flow from .specs to YouTrack. TASK status is the only bidirectional field: tracker actions call spec_patch, and the next projection reflects the resulting spec status.

## FR-7: Task actions write through the specification boundary

Approve, Verify, and Reopen SHALL be offered only for TASK cards. Approve SHALL request done, Verify SHALL preserve done while resolving the tracker card, and Reopen SHALL request todo. The workflow SHALL validate identity and transition, then call spec_patch; a tracker-only mutation is not accepted as completion.

## FR-8: Failed sync cannot publish a partial graph

The adapter SHALL validate the complete MCP response, upsert cards, reconcile links, and publish the snapshot plus commit marker last. If any step fails, the previous committed snapshot and pointer remain visible; no partial snapshot is committed.

## FR-9: Cards preserve human-readable work content

Each card summary SHALL be the human node title without a robot identifier. The description SHALL contain the full bounded node body, per-kind sections, relations grouped by link type, source path and line, content hash, and evidence when present.

## FR-10: Native issue types are truthful

TASK maps to Task, FR to Feature, AC to Criterion, SCENARIO to Scenario, NFR to Constraint, and ROADMAP to Roadmap. Documentation nodes SHALL NOT silently use Bug as a default.

## FR-11: The adapter has stable ports and pure translators

The application layer SHALL depend on SpecGraphReader, TrackerProjectionStore, SyncStateStore, and TaskStatusWriteback ports. BoardNode-to-card and BoardEdge-to-link translators SHALL be pure and deterministic. REST, MCP transport, locking, retry, and serialization SHALL stay in infrastructure adapters. The composition root MAY be a script, but it SHALL contain orchestration only.

## FR-12: All views share one predictable board UX

V1 Flow SHALL show TASK, FR, AC, SCENARIO, NFR, and ROADMAP lanes with lineage and a drawer. V2 Cluster SHALL show all nodes as isolated kind-filterable islands with pan and zoom. V3 Lineage SHALL provide search, center-on-result, and separate outgoing and incoming relations. All views SHALL default to the full corpus, escape rendered text, and expose loading, error, empty, search, reset, and dark-theme states.

## FR-13: The committed marker is authenticated and unique

Every published marker SHALL carry an HMAC-SHA256 signature over its canonical form, keyed by a secret stored outside the tracker (SPEC_SYNC_MARKER_KEY or ~/.omp/spec-sync-marker-key). Readers that drive writes — the sweep and the writeback listener — SHALL honor cardIds and the snapshot baseline only from a marker whose signature verifies. Duplicate SPEC:SYNC-STATE pointer issues SHALL be reconciled deterministically: the lowest-id candidate is canonical and the rest are deleted on publish. Overlapping sync runs on one host SHALL be serialized by a pid-stamped lock file.
