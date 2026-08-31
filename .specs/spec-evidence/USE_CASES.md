# Use Cases

## UC-1: Evaluate task evidence

**Actor:** Product or task evidence consumer.

**Precondition:** The current kernel snapshot and trusted-capture envelopes are available.

**Flow:**
1. Parse and re-hash captured producer bytes.
2. Join rows by qualified ID or verified canonical tag.
3. Compare scenario content, applicable step binding, and tested implementation identity.
4. For each current required scenario, elect a PASSED/FRESH/FULL evidence reference or emit a blocker.
5. Return VERIFIED only when all required scenarios satisfy the rule; waived tasks remain WAIVED_OPEN.

**Postcondition:** Readiness is derived from actual captured bytes with all-not-any semantics.

**Related:** [FR-4](FR.md#fr-4-scenario-result-join), [FR-5](FR.md#fr-5-full-run-scope-authority), [FR-6](FR.md#fr-6-freshness-and-staleness), [FR-7](FR.md#fr-7-fail-closed-status-truth), [FR-8](FR.md#fr-8-waiver-honesty)

## UC-2: Diagnose stale or partial evidence

**Actor:** Engineer or MCP query consumer.

**Flow:**
1. `get_test_result` resolves one elected `ScenarioEvidence`.
2. Freshness names scenario, step, or implementation mismatch; partial scope is explicit.
3. The task blocker points to the same `EvidenceRef` when evidence exists.
4. `get_scenario_trace` pages the exact producer trace addressed by that reference.

**Postcondition:** Result, freshness, blocker, and trace refer to one evidence identity without duplicated hashes or trace IDs.

**Related:** [FR-6](FR.md#fr-6-freshness-and-staleness), [FR-9](FR.md#fr-9-internal-row-accounting), [FR-14](FR.md#fr-14-mcp-projection-of-gettestresult-and-getscenariotrace)

## UC-3: Capture a real run

**Actor:** Trusted local capture adapter.

**Precondition:** A supported runner invocation and containment root are available.

**Flow:**
1. Execute or observe the actual invocation.
2. Capture exact producer bytes and compute their SHA-256.
3. Capture tested implementation identity and current scenario/step bindings.
4. Derive FULL or PARTIAL from the invocation and selected scenario set.
5. Emit one immutable run envelope or a closed capture error.

**Postcondition:** The evaluator receives one trusted envelope rather than separately supplied artifact and sidecar claims.

**Related:** [FR-2](FR.md#fr-2-supported-execution-artifacts), [FR-3](FR.md#fr-3-trusted-capture-run-envelope), [FR-11](FR.md#fr-11-real-fixtures-per-spec-kernel-discipline)

## UC-4: Contribute to product readiness

**Actor:** Product release gate.

**Precondition:** Ordinary task and scenario evidence exists for the tested candidate.

**Flow:**
1. Consume the task evidence required by the capability.
2. Require every required task to be VERIFIED.
3. Retain satisfying evidence references in the product evidence record.
4. Refuse on any blocked or waived-open required task.

**Postcondition:** Evidence is one normal all-not-any input to the product gate; no separate 14-record manifest or evidence fingerprint is produced.

**Related:** [FR-13](FR.md#fr-13-release-eligibility-contribution), `@feature13`
