# spec-evidence

This specification defines one trusted-capture run envelope, one pure evidence evaluator, and two later read-only MCP projections. It does not add execution truth to the kernel.

## Status

**NEXT.** No evidence runtime or evidence MCP capability is shipped. Public v0.3.2 and its eight working read-only MCP tools remain SHIPPED historical truth; this contract does not reinterpret those receipts.

## Contract in one paragraph

A trusted local adapter captures the actual runner invocation, producer bytes, run scope, tested implementation identity, and capture-time scenario bindings. The pure evaluator re-hashes the bytes, joins only by qualified ID or verified canonical tag, and compares current scenario content, applicable step binding, and implementation identity. A task is verified only when every required scenario has fresh passed FULL-scope evidence. Names are diagnostics, partial runs are non-authoritative, and timestamps are display-only.

## Boundaries

- The kernel owns definitions and current task/scenario relationships; it never claims pass/fail.
- The trusted capture adapter owns I/O, containment, runner observation, and run scope.
- The evaluator owns join, freshness, and all-not-any task evidence.
- `get_test_result` returns one `ScenarioEvidence`; `get_scenario_trace` pages the trace addressed by its `EvidenceRef`.
- There is no overlay format, binding sidecar authentication, per-result graph fingerprint, public conservation census, 14-record release manifest, or second evidence fingerprint.
- A future product gate consumes ordinary task/scenario evidence for the tested candidate.

## Evidence discipline

Executable fixtures use real producer bytes with immutable hashes, producer/version, capture method, source, date, license disposition, permitted trimming, and reviewed expected normalized outcomes. Synthetic data is limited to labeled scale or one-fault derivatives.

## Documents

| Document | Role |
|---|---|
| [USER_STORIES.md](USER_STORIES.md) | User outcomes |
| [USE_CASES.md](USE_CASES.md) | Main flows |
| [RESEARCH.md](RESEARCH.md) | Findings and risks |
| [FR.md](FR.md) | Functional contracts |
| [NFR.md](NFR.md) | Budgets and safety |
| [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | EARS criteria |
| [REQUIREMENTS.md](REQUIREMENTS.md) | FR/AC/scenario/check/task trace |
| [DESIGN.md](DESIGN.md) | Component and algorithm decisions |
| [TASKS.md](TASKS.md) | NEXT implementation work |
| [spec-evidence.feature](spec-evidence.feature) | Behavioral specification |
| [FILE_CHANGES.md](FILE_CHANGES.md) | Planned implementation surface |
| [FIXTURES.md](FIXTURES.md) | Real-fixture policy |
| [spec-evidence_SCHEMA.md](spec-evidence_SCHEMA.md) | Public data contracts |
| [CHANGELOG.md](CHANGELOG.md) | Specification history |

## Current lifecycle contract

The evidence stage adds hash-bound scenario result and trace reads. Producer result rows remain separate from authored graph nodes and stale or missing evidence is reported explicitly.
