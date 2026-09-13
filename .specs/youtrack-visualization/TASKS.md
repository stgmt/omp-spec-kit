# Tasks

Tasks are implementation work for the adapter and tracker application. Statuses are planned until verified by the corresponding acceptance scenario.

## TASK-1: Provision SPEC project fields

Status: done
Done when: SpecKind, SpecId, ContentHash, Evidence, and required native Type values exist in project SPEC.

## TASK-2: Provision nine link types

Status: done
Done when: only the nine named tracker link types exist and reverse directions are distinct.

## TASK-3: Implement the adapter composition root

Status: done
Done when: scripts/spec-graph-sync.mjs orchestrates ports and calls one complete spec_graph board projection without importing kernel readers or rebuilding the graph.

## TASK-4: Implement card translation

Status: done
Done when: pure translation produces human summaries, full per-kind descriptions, source provenance, truthful native Type, and stable fields.

## TASK-5: Implement link translation and reconciliation

Status: done
Done when: one centralized raw-kernel-edge map produces exactly nine allowed tracker link types and idempotent repair.

## TASK-6: Implement committed snapshot storage

Status: done
Done when: BoardSnapshotV1 and its pointer are written after cards and links, with hash and fingerprint validation and previous-snapshot retention on failure.

## TASK-7: Implement governed task writeback

Status: todo
Done when: Approve, Verify, and Reopen validate TASK identity and call spec_patch; state mapping is tested in both directions.

## TASK-8: Keep issue panel readable

Status: done
Done when: the panel shows task, requirement, and criterion neighbors with click-through and safe escaped text.

## TASK-9: Publish the board application

Status: done
Done when: V1 Flow, V2 Cluster, and V3 Lineage all consume the committed snapshot and pass the browser acceptance scenarios.

## TASK-10: Keep a single graph composition root

Status: done
Done when: the shipped code contains no direct kernel imports in the sync composition root, no duplicate edge mapping, no tracker-link graph reads, and no stale board writers; adapter tests pass.

## TASK-11: Add adapter contract fixtures

Status: todo
Done when: complete board response, empty scope, size failure, drift, partial failure, duplicate identity, and link-direction fixtures cover the ports and translators.

## TASK-12: Verify fresh-process integration

Status: done
Done when: real MCP JSON-RPC board read, sync dry run, tracker snapshot parity, and all three board views are verified from a fresh process.
