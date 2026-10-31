# Requirements

## Scope

Provide a durable YouTrack projection of the .specs corpus and three in-tracker views. This specification covers the adapter, synchronisation, writeback, and board UX. The repository specification kernel is the sole source of truth.

## REQ-1: Projection identity

Every projected node has one SpecId equal to <specSlug>:<localId>. The project exposes SpecKind, SpecId, ContentHash, Evidence, and native Type.

## REQ-2: Graph projection

The adapter projects exactly nine tracker link types from one centralized raw-kernel-edge mapping. It never reconstructs the desired graph from tracker links.

## REQ-3: Complete read model

spec_graph view board returns one complete BoardProjectionV1 for the requested corpus or specification scope. It includes source fingerprint, selected board nodes, card-source fields, and aggregated raw kernel edges. It has no cursor and no silently truncated success response.

## REQ-4: Safe synchronization

A sync compares the desired projection with actual tracker state before skipping. It writes cards and links idempotently, then publishes the snapshot and commit marker last. A failed run leaves the prior committed read model visible.

## REQ-5: Adapter design

The application layer uses SpecGraphReader, TrackerProjectionStore, SyncStateStore, and TaskStatusWriteback ports. Pure mapping code has no network, filesystem, tracker, or MCP side effects. Infrastructure owns transport and locking.

## REQ-6: View contract

The panel and V1 Flow, V2 Cluster, and V3 Lineage board views consume the same immutable committed snapshot. All views support full-corpus default, kind filtering, safe search/focus, truthful directions, and explicit loading/error/empty states.

## REQ-7: Writeback boundary

Only TASK status crosses from YouTrack to .specs, through the governed spec_patch operation. Text, identity, evidence, type, and graph relations remain one-way from .specs.

## Traceability

| Requirement | Functional requirements | Acceptance criteria |
|---|---|---|
| REQ-1 | FR-2, FR-10 | AC-2.1, AC-10.1 |
| REQ-2 | FR-3, FR-4 | AC-3.1 |
| REQ-3 | FR-4, FR-8 | AC-4.1, AC-11.1 |
| REQ-4 | FR-5, FR-8 | AC-5.1, AC-8.1 |
| REQ-5 | FR-11 | AC-11.1 |
| REQ-6 | FR-1, FR-12 | AC-1.1, AC-12.1 |
| REQ-7 | FR-6, FR-7 | AC-6.1, AC-7.1 |
