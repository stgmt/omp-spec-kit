# USE CASES

## Read / Core

## UC-1: Build one deterministic graph

**Actors:** Host adapter, pure core

**Preconditions:** The caller supplies a contained, bounded canonical source snapshot.

**Main flow:**
1. Validate source metadata and limits.
2. Normalize bytes, paths, and parser inputs.
3. Emit definition and reference occurrences before indexes.
4. Qualify identities, conserve duplicates, resolve typed edges, and collect diagnostics.
5. Compute the graph fingerprint and return the immutable graph.

**Postconditions:** Equivalent normalized inputs produce equivalent graph bytes and no writes occur.

**Related:** [FR-1](FR.md#fr-1-pure-occurrence-first-core), [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids), [FR-3](FR.md#fr-3-typed-graph-conservation), [FR-7](FR.md#fr-7-deterministic-diagnostics-and-fingerprint)

## UC-2: Query through four primitives

**Actors:** OMP/MCP compatibility adapter, query caller

**Preconditions:** An immutable graph and effective limits exist.

**Main flow:**
1. Select inventory, findNodes, traverse, or diagnostics.
2. Validate filters, cursor, cancellation, and limits.
3. Apply stable sorting and return one cursor/error envelope.
4. Continue until next cursor is null or a typed error closes the request.

**Postconditions:** Query state and repository bytes are unchanged.

**Related:** [FR-4](FR.md#fr-4-four-bounded-core-primitives), [FR-6](FR.md#fr-6-historical-eight-name-compatibility)

## UC-3: Reject an unsafe source snapshot

**Actors:** Host adapter, repository owner

**Preconditions:** A path escapes the explicit root, is link-like, non-regular, or exceeds a hard budget.

**Main flow:**
1. Inspect path segments before opening bytes.
2. Refuse the source with a bounded sanitized error.
3. Return no external bytes and write nothing.

**Related:** [FR-5](FR.md#fr-5-contained-inputs-and-budgets)

## UC-4: Review real evidence

**Actors:** Fixture reviewer, product release layer

**Preconditions:** The target-owned manifest, source hashes, oracle counts, artifact measurements, and historical receipts are available.

**Main flow:**
1. Verify bytes and provenance.
2. Reconcile occurrence and diagnostic counts.
3. Record package, memory, latency, cancellation, and response observations.
4. Keep structural graph validity separate from product-layer release evaluation.

**Postconditions:** Evidence claims are bounded to the captured bytes and receipt references.

**Related:** [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets)

## Read / Evidence

## UC-5: Evaluate task evidence

**Actor:** Product or task evidence consumer.

**Precondition:** The current kernel snapshot and trusted-capture envelopes are available.

**Flow:**
1. Parse and re-hash captured producer bytes.
2. Join rows by qualified ID or verified canonical tag.
3. Compare scenario content, applicable step binding, and tested implementation identity.
4. For each current required scenario, elect a PASSED/FRESH/FULL evidence reference or emit a blocker.
5. Return VERIFIED only when all required scenarios satisfy the rule; waived tasks remain WAIVED_OPEN.

**Postcondition:** Readiness is derived from actual captured bytes with all-not-any semantics.

**Related:** [FR-12](FR.md#fr-12-scenario-result-join), [FR-13](FR.md#fr-13-full-run-scope-authority), [FR-14](FR.md#fr-14-freshness-and-staleness), [FR-15](FR.md#fr-15-fail-closed-status-truth), [FR-16](FR.md#fr-16-waiver-honesty)

## UC-6: Diagnose stale or partial evidence

**Actor:** Engineer or MCP query consumer.

**Flow:**
1. `get_test_result` resolves one elected `ScenarioEvidence`.
2. Freshness names scenario, step, or implementation mismatch; partial scope is explicit.
3. The task blocker points to the same `EvidenceRef` when evidence exists.
4. `get_scenario_trace` pages the exact producer trace addressed by that reference.

**Postcondition:** Result, freshness, blocker, and trace refer to one evidence identity without duplicated hashes or trace IDs.

**Related:** [FR-14](FR.md#fr-14-freshness-and-staleness), [FR-17](FR.md#fr-17-internal-row-accounting), [FR-22](FR.md#fr-22-mcp-projection-of-gettestresult-and-getscenariotrace)

## UC-7: Capture a real run

**Actor:** Trusted local capture adapter.

**Precondition:** A supported runner invocation and containment root are available.

**Flow:**
1. Execute or observe the actual invocation.
2. Capture exact producer bytes and compute their SHA-256.
3. Capture tested implementation identity and current scenario/step bindings.
4. Derive FULL or PARTIAL from the invocation and selected scenario set.
5. Emit one immutable run envelope or a closed capture error.

**Postcondition:** The evaluator receives one trusted envelope rather than separately supplied artifact and sidecar claims.

**Related:** [FR-10](FR.md#fr-10-supported-execution-artifacts), [FR-11](FR.md#fr-11-trusted-capture-run-envelope), [FR-19](FR.md#fr-19-real-fixtures-per-read-core-discipline)

## UC-8: Contribute to product readiness

**Actor:** Product release gate.

**Precondition:** Ordinary task and scenario evidence exists for the tested candidate.

**Flow:**
1. Consume the task evidence required by the capability.
2. Require every required task to be VERIFIED.
3. Retain satisfying evidence references in the product evidence record.
4. Refuse on any blocked or waived-open required task.

**Postcondition:** Evidence is one normal all-not-any input to the product gate; no separate 14-record manifest or evidence fingerprint is produced.

**Related:** [FR-21](FR.md#fr-21-release-eligibility-contribution), `@feature21`

## Write

## UC-9: Propose one traced change

1. Caller selects one repository and one spec slug.
2. Internal helpers compile the requested domain intent into canonical edit operations.
3. `propose_patch` resolves containment, applies edits in memory, validates the resulting spec, and returns a complete deterministic preview.
4. Repository document hashes remain unchanged.

**Failure:** invalid input, path, anchor, trace, or preview bound returns a structured refusal with no write.

## UC-10: Apply the exact proposal

1. Caller submits the proposal identity/hash and expected hashes to `apply_proposed_patch`.
2. The handler acquires the spec lock, re-resolves paths, checks CAS, rebuilds and revalidates the exact result.
3. The writer stages on the same filesystem and installs one complete generation.
4. Caller receives a compact redacted receipt.

**Failure:** any mismatch or validation finding refuses before commit.

## UC-11: Resolve a concurrent edit

Two callers propose from the same base. The first accepted apply commits. The second rechecks hashes under the lock, returns `CONFLICT` with current hashes, and creates a fresh proposal if still desired. No automatic rebase occurs.

## UC-12: Reject an escaping or raw write

The current-host `tool_call` policy first recognizes only the two authoring names. Every other mutating call whose resolved target is under `.specs/**` is denied. The authoring handler independently rejects traversal, absolute, device, linked, reparse, normalization-collision, and cross-spec targets.

## UC-13: Rename a heading safely

The internal compiler resolves one heading from the immutable kernel inventory, computes the canonical anchor, expands same-spec inbound link rewrites, and proposes the byte changes. Ambiguous headings, cross-spec inbound links, stale section hashes, or incomplete inventories refuse.

## UC-14: Survive a writer fault

Faults before the generation swap preserve the old generation. A fault after an uncertain swap triggers internal hash-based old/new selection and rollback while the lock remains held. Readers observe only a complete generation.

## UC-15: Stop at unrecoverable storage

If neither complete old nor complete new generation can be proven, the handler returns `RECOVERY_REQUIRED`, performs no further mutation, preserves diagnostics, and instructs the operator to restore the named spec from normal VCS or backup. There is no public recovery, rebaseline, or overwrite operation.