# Tasks

Status: DRAFT

## TASK-1 — Readiness function in the kernel

Status: in-progress
Done When: the acceptance criteria for this task pass on the fixture corpus.
Requirements: FR-1
Implements: FR-1

- **Comment (implementer, 2026-11-15 03:04):** src/kernel/readiness.js + tests/readiness-gate.test.mjs (verdict, L0/L2, blockers)

- **Comment (implementer, 2026-11-16 00:49):** 2026-11-16 release audit: FR-1 requires L0-L4, but candidate c28aa174 caps the graph at L2. Focused regression fails ERR_ASSERTION: nextLevel null !== L3. TASK-1 reopened; publication blocked pending genuine execution-evidence integration and L3/L4 transport/preview coverage. Full preflight and archive safe-authoring passed but do not cover this requirement.

- **Comment (implementer, 2026-11-16 02:40):** FR-1 implemented in 8fb001c102bfb92f72b4665113721fe8a1b16f4e: canonical L0–L4, source-bound complete execution and inspect/preview parity. Review PASS; full local preflight PASS; 57 tool-E2E scenarios, 44 focused checks and four guard mutants killed. OMP and Claude installed server matrices PASS; Codex installed guard behavior PASS. GitHub release/attestation workflow remains in progress; separately, deployed registry remains 3.3.0 by current delivery scope.

## TASK-2 — Task admission in the compiler

Status: done
Done When: the acceptance criteria for this task pass on the fixture corpus.
Requirements: FR-1
Implements: FR-1

- **Comment (implementer, 2026-11-15 03:04):** src/authoring/proposals.js admission gate (SPEC_NOT_READY/TASK_NOT_TRACEABLE) + tests

## TASK-3 — Close the document and backlog bypasses

Status: done
Done When: the acceptance criteria for this task pass on the fixture corpus.
Requirements: FR-3
Implements: FR-3

- **Comment (implementer, 2026-11-15 03:05):** TASK_DOCUMENT_BYPASS and BACKLOG_FORBIDDEN gates + tests; tool-e2e and staged BDD updated

## TASK-4 — Scenario traceability

Status: done
Done When: the acceptance criteria for this task pass on the fixture corpus.
Requirements: FR-4
Implements: FR-4

- **Comment (implementer, 2026-11-15 03:05):** SCENARIO_NOT_TRACEABLE gate over Gherkin traceRefs + tests

## TASK-5 — Generated rule text and drift test

Status: done
Done When: the acceptance criteria for this task pass on the fixture corpus.
Requirements: FR-5
Implements: FR-5

- **Comment (implementer, 2026-11-15 03:06):** READINESS_RULE_TEXT rendered into contracts and MCP instructions; tests/readiness-drift.test.mjs

## TASK-6 — Transport parity

Status: done
Done When: the acceptance criteria for this task pass on the fixture corpus.
Requirements: FR-6
Implements: FR-6

- **Comment (implementer, 2026-11-15 03:06):** single ProposalCompiler admission point; stdio-vs-dispatch parity test
