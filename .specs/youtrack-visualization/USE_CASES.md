# Use Cases

## UC-1: Read a task neighborhood

An issue panel loads the committed snapshot, finds the task by SpecId, and shows its outgoing and incoming neighbors with click-through. It does not query tracker links to rebuild the graph.

## UC-2: Synchronize the corpus

The composition root asks MCP spec_graph view board for the full corpus once, validates the response, translates cards and links, compares actual tracker state, and commits a snapshot marker last. A valid equal projection returns skipped with zero writes.

## UC-3: Repair tracker drift

A source fingerprint is unchanged but a card or link differs. Read-only parity detects the difference, the adapter repairs the projection, and the marker is republished with the same source fingerprint and a new projection digest.

## UC-4: Write back task status

A user clicks Approve, Verify, or Reopen on a TASK card. The workflow validates the card identity and transition, changes the tracker state, and calls spec_patch for the corresponding TASK status when required.

## UC-5: Explore three board views

A user switches between V1 Flow, V2 Cluster, and V3 Lineage. Each view reads the same committed snapshot and full corpus. Filters change visibility only; they never change the source edge set. V3 labels outgoing and incoming relations separately.

## UC-6: Survive a failed sync

Card or link reconciliation fails. The adapter does not publish a new snapshot or marker. Readers continue to see the previous complete snapshot, and the next run can repair from the same source projection.
