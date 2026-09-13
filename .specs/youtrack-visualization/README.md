# Tracker spec-graph viewer

The integration projects the authoritative .specs corpus into YouTrack cards and three in-tracker views. YouTrack is never a second source of graph truth.

## Contract

1. The panel and board consume one committed BoardSnapshotV1 from SPEC:SYNC-STATE.
2. One complete MCP spec_graph board read supplies the desired source projection to sync.
3. Projected identity is SpecId=<specSlug>:<localId>; fields include SpecKind, ContentHash, Evidence, and native Type.
4. Exactly nine tracker link types are allowed: satisfies, satisfied-by, verifies, covers, implements, implemented-by, depends-on, constrains, contains.
5. Sync skips only after fingerprint and read-only parity match; same-fingerprint drift is repaired.
6. Only TASK status writes back through spec_patch.
7. V1 Flow, V2 Cluster, and V3 Lineage use the same full-corpus snapshot.

## Documents

- Requirements: REQUIREMENTS.md
- Functional requirements: FR.md
- Acceptance criteria: ACCEPTANCE_CRITERIA.md
- Schema: youtrack-visualization_SCHEMA.md
- Design and ports: DESIGN.md
- Scenarios: youtrack-visualization.feature
- Tasks: TASKS.md
- Research: RESEARCH.md
- Fixtures: FIXTURES.md
- File plan: FILE_CHANGES.md
