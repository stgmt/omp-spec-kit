@spec-mcp-operations @read-write @next
Feature: spec-mcp-operations use cases

  @case:UC-1 @story:US-1
  Rule: Build one deterministic graph
    Actor: Host adapter, pure core
    Boundary: Specification MCP and kernel
    Trigger: Build one deterministic graph
    Precondition: The caller supplies a contained, bounded canonical source snapshot.
    Success: Equivalent normalized inputs produce equivalent graph bytes and no writes occur.
    Covers: FR-1, FR-2, FR-3, FR-7
    Step: request | Validate source metadata and limits.
    Context:
      **Actors:** Host adapter, pure core

      **Preconditions:** The caller supplies a contained, bounded canonical source snapshot.

      **Main flow:**
      1. Validate source metadata and limits.
      2. Normalize bytes, paths, and parser inputs.
      3. Emit definition and reference occurrences before indexes.
      4. Qualify identities, conserve duplicates, resolve typed edges, and collect diagnostics.
      5. Compute the graph fingerprint and return the immutable graph.

      **Postconditions:** Equivalent normalized inputs produce equivalent graph bytes and no writes occur.

      **Related:** FR-1, FR-2, FR-3, FR-7

    @feature2 @AC-2.1 @id:SCEN-mcp-read-core-canonical-documents-and-qualified-ids
    Scenario: Canonical documents and qualified IDs
      Given the fifteen canonical document names and two specs with the same local ID
      When role-aware parsing runs
      Then owning-document definitions and spec-qualified identities are distinct
      And duplicate candidates are retained

    @feature7 @AC-7.1 @id:SCEN-mcp-read-core-deterministic-diagnostics-and-fingerprint
    Scenario: Deterministic diagnostics and fingerprint
      Given equivalent normalized source bytes in different orders and line endings
      When the graph is built
      Then canonical bytes diagnostics and fingerprint are identical
      And query availability does not affect the fingerprint

  @case:UC-2 @story:US-4
  Rule: Query through four primitives
    Actor: OMP/MCP compatibility adapter, query caller
    Boundary: Specification MCP and kernel
    Trigger: Query through four primitives
    Precondition: An immutable graph and effective limits exist.
    Success: Query state and repository bytes are unchanged.
    Covers: FR-4, FR-6
    Step: request | Select inventory, findNodes, traverse, or diagnostics.
    Context:
      **Actors:** OMP/MCP compatibility adapter, query caller

      **Preconditions:** An immutable graph and effective limits exist.

      **Main flow:**
      1. Select inventory, findNodes, traverse, or diagnostics.
      2. Validate filters, cursor, cancellation, and limits.
      3. Apply stable sorting and return one cursor/error envelope.
      4. Continue until next cursor is null or a typed error closes the request.

      **Postconditions:** Query state and repository bytes are unchanged.

      **Related:** FR-4, FR-6

    @feature4 @AC-4.1 @id:SCEN-mcp-read-core-four-bounded-core-primitives
    Scenario: Four bounded core primitives
      Given an immutable graph and a bounded cursor
      When inventory findNodes traverse and diagnostics are called
      Then one deterministic envelope returns stable pages or typed errors

  @case:UC-3 @story:US-2
  Rule: Reject an unsafe source snapshot
    Actor: Host adapter, repository owner
    Boundary: Specification MCP and kernel
    Trigger: Reject an unsafe source snapshot
    Precondition: A path escapes the explicit root, is link-like, non-regular, or exceeds a hard budget.
    Success: Reject an unsafe source snapshot
    Covers: FR-5
    Step: request | Inspect path segments before opening bytes.
    Context:
      **Actors:** Host adapter, repository owner

      **Preconditions:** A path escapes the explicit root, is link-like, non-regular, or exceeds a hard budget.

      **Main flow:**
      1. Inspect path segments before opening bytes.
      2. Refuse the source with a bounded sanitized error.
      3. Return no external bytes and write nothing.

      **Related:** FR-5

  @case:UC-4 @story:US-5
  Rule: Review real evidence
    Actor: Fixture reviewer, product release layer
    Boundary: Specification MCP and kernel
    Trigger: Review real evidence
    Precondition: The target-owned manifest, source hashes, oracle counts, artifact measurements, and historical receipts are available.
    Success: Evidence claims are bounded to the captured bytes and receipt references.
    Covers: FR-8
    Step: request | Verify bytes and provenance.
    Context:
      **Actors:** Fixture reviewer, product release layer

      **Preconditions:** The target-owned manifest, source hashes, oracle counts, artifact measurements, and historical receipts are available.

      **Main flow:**
      1. Verify bytes and provenance.
      2. Reconcile occurrence and diagnostic counts.
      3. Record package, memory, latency, cancellation, and response observations.
      4. Keep structural graph validity separate from product-layer release evaluation.

      **Postconditions:** Evidence claims are bounded to the captured bytes and receipt references.

      **Related:** FR-8

  @case:UC-5 @story:US-6
  Rule: Evaluate task evidence
    Actor: Product or task evidence consumer.
    Boundary: Specification MCP and kernel
    Trigger: Evaluate task evidence
    Precondition: The current kernel snapshot and trusted-capture envelopes are available.
    Success: Readiness is derived from actual captured bytes with all-not-any semantics.
    Covers: FR-12, FR-13, FR-14, FR-15, FR-16
    Step: request | 1. Parse and re-hash captured producer bytes.
    Context:
      **Actor:** Product or task evidence consumer.

      **Precondition:** The current kernel snapshot and trusted-capture envelopes are available.

      **Flow:**
      1. Parse and re-hash captured producer bytes.
      2. Join rows by qualified ID or verified canonical tag.
      3. Compare scenario content, applicable step binding, and tested implementation identity.
      4. For each current required scenario, elect a PASSED/FRESH/FULL evidence reference or emit a blocker.
      5. Return VERIFIED only when all required scenarios satisfy the rule; waived tasks remain WAIVED_OPEN.

      **Postcondition:** Readiness is derived from actual captured bytes with all-not-any semantics.

      **Related:** FR-12, FR-13, FR-14, FR-15, FR-16

    @feature12 @AC-12.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-stable-scenario-join
    Scenario: Stable identity is required for a join
      Given producer rows match current scenarios by qualified ID verified tag ambiguous tag name only or nothing
      When join runs
      Then only exact ID and uniquely verified tag rows are JOINED
      And every other row is AMBIGUOUS or UNMATCHED with name candidates diagnostic only

    @feature13 @AC-13.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-full-run-scope-authority
    Scenario: Partial runs never replace full-run authority
      Given the trusted adapter captured one unfiltered full run and one narrowed partial run
      When readiness is evaluated
      Then only the full run may satisfy readiness
      And the partial run remains queryable without replacing full evidence

  @case:UC-6 @story:US-7
  Rule: Diagnose stale or partial evidence
    Actor: Engineer or MCP query consumer.
    Boundary: Specification MCP and kernel
    Trigger: Diagnose stale or partial evidence
    Precondition: The caller has reached the relevant operation boundary
    Success: Result, freshness, blocker, and trace refer to one evidence identity without duplicated hashes or trace IDs.
    Covers: FR-14, FR-17, FR-22
    Step: request | 1. `get_test_result` resolves one elected `ScenarioEvidence`.
    Context:
      **Actor:** Engineer or MCP query consumer.

      **Flow:**
      1. `get_test_result` resolves one elected `ScenarioEvidence`.
      2. Freshness names scenario, step, or implementation mismatch; partial scope is explicit.
      3. The task blocker points to the same `EvidenceRef` when evidence exists.
      4. `get_scenario_trace` pages the exact producer trace addressed by that reference.

      **Postcondition:** Result, freshness, blocker, and trace refer to one evidence identity without duplicated hashes or trace IDs.

      **Related:** FR-14, FR-17, FR-22

    @feature14 @AC-14.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-freshness-staleness
    Scenario Outline: Current content bindings determine freshness
      Given captured and current scenario step and implementation bindings have "<condition>"
      When freshness is evaluated without graph or clock authority
      Then evidence is "<state>"

      Examples:
        | example_id | condition                         | state         |
        | row-1 | all applicable values equal       | FRESH         |
        | row-2 | one applicable value differs      | STALE         |
        | row-3 | one required value is missing     | INDETERMINATE |
        | row-4 | step binding is not applicable in both | FRESH     |

    @feature22 @AC-22.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-mcp-projection-of-run-results
    Scenario: Result and trace share one evidence reference
      Given one elected ScenarioEvidence has a trace
      When get_test_result resolves the scenario and get_scenario_trace receives its evidence reference
      Then the result returns that ScenarioEvidence
      And the trace returns only bounded steps and failure for the same evidence reference
      And neither tool changes the historical eight-tool v0.3.2 first slice

  # Proposal-first specification authoring
  # The future authoring capability exposes two MCP mutation tools.
  # These scenarios are specification text and are not claimed as executed evidence.

  @case:UC-7 @story:US-9
  Rule: Capture a real run
    Actor: Trusted local capture adapter.
    Boundary: Specification MCP and kernel
    Trigger: Capture a real run
    Precondition: A supported runner invocation and containment root are available.
    Success: The evaluator receives one trusted envelope rather than separately supplied artifact and sidecar claims.
    Covers: FR-10, FR-11, FR-19
    Step: request | 1. Execute or observe the actual invocation.
    Context:
      **Actor:** Trusted local capture adapter.

      **Precondition:** A supported runner invocation and containment root are available.

      **Flow:**
      1. Execute or observe the actual invocation.
      2. Capture exact producer bytes and compute their SHA-256.
      3. Capture tested implementation identity and current scenario/step bindings.
      4. Derive FULL or PARTIAL from the invocation and selected scenario set.
      5. Emit one immutable run envelope or a closed capture error.

      **Postcondition:** The evaluator receives one trusted envelope rather than separately supplied artifact and sidecar claims.

      **Related:** FR-10, FR-11, FR-19

    @feature10 @AC-10.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-supported-artifact-kinds
    Scenario: Only supported real producer artifacts are captured
      Given supported unsupported malformed absent and over-limit producer artifacts
      When trusted capture admits them
      Then only Cucumber Messages NDJSON 33.0.4 and pytest-bdd cucumber-json 1 are admitted
      And actual admitted bytes are retained and re-hashed while every refusal has a closed reason

    @feature19 @AC-19.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-real-fixture-provenance
    Scenario: Executable fixtures preserve real producer provenance
      Given captured fixtures from at least two identified real producers
      When fixture admission runs
      Then each fixture records capture method producer version source date hash bytes license trimming and reviewed outcomes
      And synthetic data is labeled and limited to scale or one-fault derivatives

  @case:UC-8 @story:US-6
  Rule: Contribute to product readiness
    Actor: Product release gate.
    Boundary: Specification MCP and kernel
    Trigger: Contribute to product readiness
    Precondition: Ordinary task and scenario evidence exists for the tested candidate.
    Success: Evidence is one normal all-not-any input to the product gate; no separate 14-record manifest or evidence fingerprint is produced.
    Covers: FR-21
    Step: request | 1. Consume the task evidence required by the capability.
    Context:
      **Actor:** Product release gate.

      **Precondition:** Ordinary task and scenario evidence exists for the tested candidate.

      **Flow:**
      1. Consume the task evidence required by the capability.
      2. Require every required task to be VERIFIED.
      3. Retain satisfying evidence references in the product evidence record.
      4. Refuse on any blocked or waived-open required task.

      **Postcondition:** Evidence is one normal all-not-any input to the product gate; no separate 14-record manifest or evidence fingerprint is produced.

      **Related:** FR-21, `@feature21`

    @feature21 @AC-21.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-release-contribution
    Scenario: Product release consumes ordinary task evidence
      Given one required task is BLOCKED and the others are VERIFIED for the tested candidate
      When the product gate consumes ordinary task and scenario evidence
      Then the evidence contribution fails with the blocked task named
      And no evidence-specific manifest or second fingerprint is created

  @case:UC-9 @story:US-10
  Rule: Propose one traced change
    Actor: Specification author
    Boundary: Specification MCP and kernel
    Trigger: Propose one traced change
    Precondition: The caller has reached the relevant operation boundary
    Success: 4. Repository document hashes remain unchanged.
    Step: request | Caller selects one repository and one spec slug.
    Context:
      1. Caller selects one repository and one spec slug.
      2. Internal helpers compile the requested domain intent into canonical edit operations.
      3. `propose_patch` resolves containment, applies edits in memory, validates the resulting spec, and returns a complete deterministic preview.
      4. Repository document hashes remain unchanged.

      **Failure:** invalid input, path, anchor, trace, or preview bound returns a structured refusal with no write.

  @case:UC-10 @story:US-10
  Rule: Apply the exact proposal
    Actor: Specification author
    Boundary: Specification MCP and kernel
    Trigger: Apply the exact proposal
    Precondition: The caller has reached the relevant operation boundary
    Success: 4. Caller receives a compact redacted receipt.
    Step: request | Caller submits the proposal identity/hash and expected hashes to `apply_proposed_patch`.
    Context:
      1. Caller submits the proposal identity/hash and expected hashes to `apply_proposed_patch`.
      2. The handler acquires the spec lock, re-resolves paths, checks CAS, rebuilds and revalidates the exact result.
      3. The writer stages on the same filesystem and installs one complete generation.
      4. Caller receives a compact redacted receipt.

      **Failure:** any mismatch or validation finding refuses before commit.

    @id:SCEN-mcp-write-authoring-apply-exact-proposal @feature26 @AC-26.1
    Scenario: Apply commits only the exact current proposal
      Given a complete proposal whose expected hashes and validation still match
      When spec_patch runs with dryRun false under the spec lock
      Then committed bytes equal every proposal after-hash
      And replay of the same request does not create another commit

  @case:UC-11 @story:US-11
  Rule: Resolve a concurrent edit
    Actor: Specification author
    Boundary: Specification MCP and kernel
    Trigger: Resolve a concurrent edit
    Precondition: The caller has reached the relevant operation boundary
    Success: Resolve a concurrent edit
    Step: request | Two callers propose from the same base. The first accepted apply commits. The second rechecks hashes under the lock, returns `CONFLICT` with current hashes, and creates a fresh proposal if still desired. No automatic rebase occurs.
    Context:
      Two callers propose from the same base. The first accepted apply commits. The second rechecks hashes under the lock, returns `CONFLICT` with current hashes, and creates a fresh proposal if still desired. No automatic rebase occurs.

  @case:UC-12 @story:US-13
  Rule: Reject an escaping or raw write
    Actor: Specification author
    Boundary: Specification MCP and kernel
    Trigger: Reject an escaping or raw write
    Precondition: The caller has reached the relevant operation boundary
    Success: Reject an escaping or raw write
    Covers: FR-23
    Step: request | The current-host `tool_call` policy first recognizes only the two authoring names. Every other mutating call whose resolved target is under `.specs/**` is denied. The authoring handler independently rejects traversal, absolute, device, linked, reparse, normalization-collision, and cross-spec targets.
    Context:
      The current-host `tool_call` policy first recognizes only the two authoring names. Every other mutating call whose resolved target is under `.specs/**` is denied. The authoring handler independently rejects traversal, absolute, device, linked, reparse, normalization-collision, and cross-spec targets.

    @id:SCEN-mcp-write-authoring-two-tool-inventory @feature23 @AC-23.1
    Scenario: Authoring inventory contains only one public mutation tool
      Given the installed omp-spec-kit MCP server
      When its public mutation inventory is listed
      Then the mutation names are exactly spec_patch
      And internal helper compilers are not registered

    @id:SCEN-mcp-write-authoring-path-policy-denies-raw-writer @feature23 @AC-23.2
    Scenario: Non-authoring raw writer is denied for canonical spec targets
      Given a mutating tool call that is not in the exact authoring allowlist
      And its resolved target is below canonical .specs
      When the current-host tool_call policy evaluates it
      Then execution is denied before the write

  @case:UC-13 @story:US-14
  Rule: Rename a heading safely
    Actor: Registry operator
    Boundary: Specification MCP and kernel
    Trigger: Rename a heading safely
    Precondition: The caller has reached the relevant operation boundary
    Success: Rename a heading safely
    Step: request | The internal compiler resolves one heading from the immutable kernel inventory, computes the canonical anchor, expands same-spec inbound link rewrites, and proposes the byte changes. Ambiguous headings, cross-spec inbound links, stale section hashes, or incomplete inventories refuse.
    Context:
      The internal compiler resolves one heading from the immutable kernel inventory, computes the canonical anchor, expands same-spec inbound link rewrites, and proposes the byte changes. Ambiguous headings, cross-spec inbound links, stale section hashes, or incomplete inventories refuse.

  @case:UC-14 @story:US-12
  Rule: Survive a writer fault
    Actor: Registry operator
    Boundary: Specification MCP and kernel
    Trigger: Survive a writer fault
    Precondition: The caller has reached the relevant operation boundary
    Success: Survive a writer fault
    Step: request | Faults before the generation swap preserve the old generation. A fault after an uncertain swap triggers internal hash-based old/new selection and rollback while the lock remains held. Readers observe only a complete generation.
    Context:
      Faults before the generation swap preserve the old generation. A fault after an uncertain swap triggers internal hash-based old/new selection and rollback while the lock remains held. Readers observe only a complete generation.

  @case:UC-15 @story:US-16
  Rule: Stop at unrecoverable storage
    Actor: Registry operator
    Boundary: Specification MCP and kernel
    Trigger: Stop at unrecoverable storage
    Precondition: The caller has reached the relevant operation boundary
    Success: Stop at unrecoverable storage
    Step: request | If neither complete old nor complete new generation can be proven, the handler returns `RECOVERY_REQUIRED`, performs no further mutation, preserves diagnostics, and instructs the operator to restore the named spec from normal VCS or backup. There is no public recovery, rebaseline, or overwrite operation.
    Context:
      If neither complete old nor complete new generation can be proven, the handler returns `RECOVERY_REQUIRED`, performs no further mutation, preserves diagnostics, and instructs the operator to restore the named spec from normal VCS or backup. There is no public recovery, rebaseline, or overwrite operation.

