# Tasks

All tasks are NEXT implementation work. Planned status is not execution evidence.

## TASK-1: Implement the pure evaluation schema and entry point

**Status:** Planned

**Estimate:** 2 days

**Owner:** Evidence maintainer

**Depends On:** none

**Requirements:** [FR-1](FR.md#fr-1-pure-evaluation-boundary), [FR-9](FR.md#fr-9-internal-row-accounting)

**Checks:** CHK-FR1-01, CHK-FR9-01

**Done When:**
- `EvidenceEvaluationInputV2` and `EvidenceEvaluationOutputV2` match the closed schema.
- Identical inputs produce byte-identical outputs with no evaluator I/O.
- Every parsed row and current required scenario has one explicit outcome; display counts are derived.

## TASK-2: Implement trusted capture and producer parsers

**Status:** Planned

**Estimate:** 4 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1

**Requirements:** [FR-2](FR.md#fr-2-supported-execution-artifacts), [FR-3](FR.md#fr-3-trusted-capture-run-envelope), [FR-5](FR.md#fr-5-full-run-scope-authority), [FR-10](FR.md#fr-10-anti-false-green-invariants)

**Checks:** CHK-FR2-01, CHK-FR3-01, CHK-FR5-01, CHK-FR10-01

**Done When:**
- The adapter captures actual Cucumber Messages or pytest-bdd bytes and re-hashes them.
- One actual invocation produces one capture-owned envelope with tested implementation and bindings.
- FULL/PARTIAL is derived from the invocation; unsupported, malformed, absent, and over-limit cases fail closed.
- No overlay parser, sidecar hash, or caller-authenticated binding path exists.

## TASK-3: Implement join, freshness, and task evidence

**Status:** Planned

**Estimate:** 4 days

**Owner:** Evidence maintainer

**Depends On:** TASK-1, TASK-2

**Requirements:** [FR-4](FR.md#fr-4-scenario-result-join), [FR-6](FR.md#fr-6-freshness-and-staleness), [FR-7](FR.md#fr-7-fail-closed-status-truth), [FR-8](FR.md#fr-8-waiver-honesty), [FR-9](FR.md#fr-9-internal-row-accounting), [FR-10](FR.md#fr-10-anti-false-green-invariants)

**Checks:** CHK-FR4-01, CHK-FR5-01, CHK-FR6-01, CHK-FR7-01, CHK-FR8-01, CHK-FR9-01, CHK-FR10-01

**Done When:**
- Exact qualified ID and verified tag are the only successful joins; name matches are diagnostics.
- Freshness compares scenario, applicable step, and tested implementation identities only.
- Every required scenario needs PASSED/FRESH/FULL evidence; partial or stale evidence blocks.
- Waived tasks remain WAIVED_OPEN.

## TASK-4: Capture and review real producer fixtures

**Status:** Planned

**Estimate:** 3 days

**Owner:** Fixture reviewer

**Depends On:** TASK-2

**Requirements:** [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)

**Checks:** CHK-FR11-01

**Done When:**
- At least two identified real producers are captured.
- Every fixture records capture method, producer/version, source, date, hash, bytes, license, trimming, and reviewed normalized outcomes.
- Synthetic fixtures are labeled and limited to scale or one-fault derivatives.

## TASK-5: Enforce limits and product evidence contribution

**Status:** Planned

**Estimate:** 2 days

**Owner:** Evidence maintainer

**Depends On:** TASK-3, TASK-4

**Requirements:** [FR-12](FR.md#fr-12-budgets), [FR-13](FR.md#fr-13-release-eligibility-contribution)

**Checks:** CHK-FR12-01, CHK-FR13-01

**Done When:**
- Count/byte limits fail closed and latency measurements stay outside the evaluator.
- The product gate consumes ordinary task/scenario evidence for the tested candidate.
- Any required BLOCKED task refuses the contribution; no custom release manifest or second fingerprint exists.

## TASK-6: Project result and trace through MCP

**Status:** Planned

**Estimate:** 2 days

**Owner:** Evidence and MCP maintainer

**Depends On:** TASK-3, TASK-5

**Requirements:** [FR-14](FR.md#fr-14-mcp-projection-of-gettestresult-and-getscenariotrace)

**Checks:** CHK-FR14-01

**Done When:**
- `get_test_result` returns one elected `ScenarioEvidence` or null.
- `get_scenario_trace` accepts its `EvidenceRef` and returns only bounded trace steps and failure.
- Opaque cursors are server-owned; result and trace introduce no duplicate identity.
- The historical eight-tool v0.3.2 first slice is unchanged.
