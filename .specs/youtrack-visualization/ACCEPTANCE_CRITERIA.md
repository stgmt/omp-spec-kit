# Acceptance Criteria

Every criterion verifies one functional requirement. The tracker is a projection; .specs remains authoritative.

## AC-1.1: Snapshot-backed views

Given a committed SPEC:SYNC-STATE snapshot, when either widget renders, then both widgets use that snapshot and never derive topology from tracker links.

Scenario: SCEN-panel-board

## AC-2.1: Stable card identity and fields

Given a full board projection, when sync creates or updates cards, then every card has unique SpecId, SpecKind, ContentHash, Evidence when available, and the native Type mapping.

Scenario: SCEN-project-fields

## AC-3.1: Exactly nine link types

Given the desired raw kernel edges, when links are reconciled, then only satisfies, satisfied-by, verifies, covers, implements, implemented-by, depends-on, constrains, and contains are present, with truthful directions.

Scenario: SCEN-link-types

## AC-4.1: Complete corpus projection

Given the corpus scope, when sync completes, then all six board kinds are present with no missing identity and the committed snapshot fingerprint equals the source fingerprint.

Scenario: SCEN-full-corpus

## AC-5.1: Safe idempotent skip

Given a valid committed pointer and equal source fingerprint, when actual cards and links are read and equal the desired projection, then no write call occurs and no duplicate SpecId exists. If parity differs, repair occurs.

Scenario: SCEN-fingerprint-skip

## AC-6.1: Explicit sync direction

Given changed spec text and a changed TASK state, when projection and writeback run, then text flows from .specs to tracker and only TASK status flows back through spec_patch.

Scenario: SCEN-sync-direction

## AC-7.1: Governed task actions

Given a TASK card, when Approve, Verify, or Reopen is used, then the transition is validated, the tracker state and spec TASK status converge, and no tracker-only completion is accepted.

Scenario: SCEN-buttons-write-back

## AC-8.1: Authoritative source and failure safety

Given a tracker/spec disagreement or a failed sync step, when reconciliation runs, then .specs wins and the previous committed snapshot remains intact on failure.

Scenario: SCEN-authoritative

## AC-9.1: Readable card content

Given any synced board kind, when its card opens, then the summary is human-readable and the description contains body, grouped relations, source, hash, and evidence without robot-only replacement text.

Scenario: SCEN-readable-card

## AC-10.1: Honest native type

Given any synced board kind, when its card opens, then Type is Task, Feature, Criterion, Scenario, Constraint, or Roadmap according to kind, never an accidental Bug default.

Scenario: SCEN-honest-type

## AC-11.1: Adapter isolation and atomic visibility

Given a valid BoardProjectionV1, when the sync composition root runs, then it uses one complete MCP board read, pure translators, tracker ports, and a last-step commit marker; direct kernel imports, UI topology rules, partial snapshots, and same-fingerprint blind skips are absent.

Scenario: SCEN-adapter-boundary

## AC-12.1: Three views, one snapshot

Given the committed snapshot, when users switch between V1, V2, and V3, then all views show the same full-corpus node and edge set, kind isolation remains correct, outgoing/incoming labels are truthful, search and focus work, and loading/error/empty/dark states render safely.

Scenario: SCEN-board-views

## AC-13.1: Signed, single pointer

Given a SPEC:SYNC-STATE pointer issue whose marker was edited or planted without the local signing key, when the sweep or the writeback listener reads committed state, then the marker is not honored and the spec corpus wins. Given duplicate pointer issues, when the sync publishes, then the lowest-id candidate becomes canonical and the rest are deleted.

Scenario: SCEN-marker-integrity
