@spec-mcp-operations @read-write @next
Feature: spec-mcp-operations user stories

  @story:US-1
  Rule: Maintainer graph
    Actor: `omp-spec-kit` maintainer
    Goal: one pure occurrence-first graph core
    Benefit: host adapters cannot fork graph semantics.
    Covers: FR-1, FR-3, FR-7
    Context:
      **Priority:** Must


      **Independent Test:** Permute the same normalized source values and compare canonical graph bytes.

      **Acceptance Scenarios:** `@feature1`, `@feature3`, `@feature7`

    @feature1 @AC-1.1 @id:SCEN-mcp-read-core-pure-occurrence-first-core
    Scenario: Pure occurrence-first core
      Given caller-supplied canonical source documents and limits
      When the core builds a graph
      Then it performs no ambient I/O and preserves source occurrences

  @story:US-2
  Rule: Safe bounded reader
    Actor: repository owner
    Goal: one explicit root, link rejection, cancellation, and hard limits
    Benefit: reads cannot escape or exhaust the host.
    Covers: FR-5
    Context:
      **Priority:** Must


      **Independent Test:** Exercise contained, traversal, link, and over-budget inputs.

      **Acceptance Scenarios:** `@feature5`

    @feature5 @AC-5.1 @id:SCEN-mcp-read-core-contained-inputs-and-budgets
    Scenario: Contained inputs and budgets
      Given contained canonical files and unsafe or oversized variants
      When the host adapter prepares sources
      Then unsafe bytes are refused before admission and no writes occur

  @story:US-3
  Rule: Honest graph consumer
    Actor: specification author
    Goal: duplicates and broken references preserved as explicit outcomes
    Benefit: graph validity cannot hide input loss.
    Covers: FR-2, FR-3, FR-4
    Context:
      **Priority:** Must


      **Independent Test:** Plant duplicate, missing, ambiguous, and forbidden references.

      **Acceptance Scenarios:** `@feature2`, `@feature3`, `@feature4`

    @feature3 @AC-3.1 @id:SCEN-mcp-read-core-typed-graph-conservation
    Scenario: Typed graph conservation
      Given valid, missing, ambiguous, malformed, and forbidden references
      When the graph resolves occurrences
      Then each reference has one typed edge outcome
      And all conservation equations reconcile

  @story:US-4
  Rule: Compatibility user
    Actor: OMP/MCP user
    Goal: the shipped eight names to project one bounded result
    Benefit: the runtime remains compatible while the core is simplified.
    Covers: FR-6
    Context:
      **Priority:** Must


      **Independent Test:** Compare adapter results after removing transport metadata.

      **Acceptance Scenarios:** `@feature6`

    @feature6 @AC-6.1 @id:SCEN-mcp-read-core-historical-eight-name-compatibility
    Scenario: Historical eight-name compatibility
      Given the released v0.3.2 compatibility adapters
      When each preserved MCP name projects a common request
      Then each result matches the shared core after transport metadata is removed

  @story:US-5
  Rule: Evidence reviewer
    Actor: reviewer
    Goal: real hashes, independent oracles, and measurable budgets
    Benefit: structural validity is not mistaken for release evidence.
    Covers: FR-8
    Context:
      **Priority:** Must


      **Independent Test:** Recompute fixture hashes and inspect retained receipt-bound measurements.

      **Acceptance Scenarios:** `@feature8`

    @feature8 @AC-8.1 @id:SCEN-mcp-read-core-real-fixtures-and-measurable-budgets
    Scenario: Real fixtures and measurable budgets
      Given the target-owned real-corpus manifest and retained receipt references
      When hashes oracles and package measurements are reviewed
      Then provenance and budgets are visible without a kernel release claim

  # Trusted execution evidence
  # A trusted capture adapter records one actual run and a pure evaluator decides
  # whether current scenarios and tasks have usable evidence. These scenarios are
  # specification text, not execution evidence.

  @story:US-6
  Rule: Release owner who trusts evidence
    Actor: release owner
    Goal: verification to require fresh passed FULL-scope evidence for every required scenario
    Benefit: one green row, a partial run, or stale bytes cannot approve a task.
    Covers: FR-11, FR-13, FR-14, FR-15, FR-18, FR-21
    Context:
      **Priority:** Must


      **Why:** A known upstream incident reported stale passing results while the execution lane appeared green.

      **Independent Test:** Require three scenarios; provide valid evidence for two; observe BLOCKED until all three satisfy PASSED/FRESH/FULL.

      **Acceptance Scenarios:** `@feature11`, `@feature13`, `@feature14`, `@feature15`, `@feature18`, `@feature21`

    @feature15 @AC-15.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-fail-closed-status-truth
    Scenario: Every required scenario needs fresh passed full evidence
      Given a task requires three current scenarios
      And only two have fresh passed full-scope evidence
      When task evidence is derived
      Then the task is BLOCKED with the missing scenario named
      And it becomes VERIFIED only after all three satisfy the rule

  @story:US-7
  Rule: Engineer diagnosing evidence
    Actor: engineer
    Goal: every producer row and required scenario to have one visible outcome and one evidence reference
    Benefit: unmatched, ambiguous, stale, failed, or partial evidence is easy to locate.
    Covers: FR-12, FR-14, FR-17, FR-20, FR-22
    Context:
      **Priority:** Must


      **Why:** Silent drops and duplicate result/trace identities hide the cause of a blocked task.

      **Independent Test:** Capture joined, unmatched, ambiguous, stale, and partial rows; observe one outcome per row and scenario-specific blockers with trace lookup by evidence reference.

      **Acceptance Scenarios:** `@feature12`, `@feature14`, `@feature17`, `@feature20`, `@feature22`

    @feature17 @AC-17.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-internal-row-accounting
    Scenario: Every row and required scenario is accounted for
      Given joined unmatched ambiguous and malformed producer rows and current required scenarios
      When evaluation completes
      Then every parsed row has one outcome
      And every required scenario has one elected evidence reference or one blocker
      And display counts are derived from those records

  @story:US-8
  Rule: Author whose waiver stays open
    Actor: specification author
    Goal: a waived task to remain visibly open even when passing evidence exists
    Benefit: waiver is never confused with completion.
    Covers: FR-16
    Context:
      **Priority:** Must


      **Why:** Waiver is a scope decision, not proof.

      **Independent Test:** Mark a task waived and provide fresh passed full evidence; observe WAIVED_OPEN and not VERIFIED.

      **Acceptance Scenarios:** `@feature16`

    @feature16 @AC-16.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-waiver-honesty
    Scenario: Waived tasks remain open
      Given a waived task has fresh passed full-scope evidence
      When task evidence is derived
      Then its state is WAIVED_OPEN and it is not verified

  @story:US-9
  Rule: Multi-runner team
    Actor: team using different BDD runners
    Goal: actual producer bytes captured into one common envelope
    Benefit: evaluation does not depend on a custom overlay or hand-built fixture shape.
    Covers: FR-10, FR-19
    Context:
      **Priority:** Must


      **Why:** Real producer fixtures catch parser assumptions that synthetic fixtures hide.

      **Independent Test:** Capture real outputs from two identified producers and observe the same normalized evidence model with preserved provenance.

      **Acceptance Scenarios:** `@feature10`, `@feature19`

    @feature11 @AC-11.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-trusted-capture-envelope
    Scenario: One actual run produces one trusted envelope
      Given the trusted adapter observes an actual runner invocation and tested implementation
      When it captures the run
      Then one envelope owns run identity scope artifact bytes and hash implementation identity and scenario bindings
      And a caller-supplied metadata and hash pair cannot authenticate evidence

  @story:US-10
  Rule: Review exact changes before mutation
    Actor: spec author
    Goal: a deterministic complete preview
    Benefit: I can inspect the exact resulting bytes and findings before any write.
    Context:
      **Priority:** P0  

      **Independent test:** Propose a valid multi-document edit and prove every target hash is unchanged.

    @id:SCEN-mcp-write-authoring-proposal-deterministic-no-write @feature24 @AC-24.1
    Scenario: Equal proposals are deterministic and read-only
      Given identical canonical spec bytes and one-spec operations
      When spec_patch runs twice with dryRun true
      Then normalized operations findings diffs hashes and proposal identity are equal
      And every repository document hash is unchanged

    @id:SCEN-mcp-write-authoring-invalid-preview-refused @feature24 @AC-24.2
    Scenario: Incomplete or invalid preview cannot be applied
      Given operations that mix specs duplicate a target or exceed a bound
      When spec_patch validates the request
      Then it returns INVALID_REQUEST or VALIDATION_FAILED
      And no repository or durable review state is created

  @story:US-11
  Rule: Reject stale edits
    Actor: concurrent editor
    Goal: expected-hash comparison
    Benefit: another accepted change is never overwritten.
    Context:
      **Priority:** P0  

      **Independent test:** Race two applies from the same base and observe one winner plus one `CONFLICT` without lost bytes.

    @id:SCEN-mcp-write-authoring-concurrent-apply-conflict @feature26 @AC-26.2 @concurrency
    Scenario: A stale concurrent apply cannot overwrite the winner
      Given two proposals share the same expected hashes
      When their applies race and one commits first
      Then the other returns CONFLICT after its under-lock CAS
      And the winner remains byte-identical

  @story:US-12
  Rule: Commit related documents together
    Actor: maintainer
    Goal: one-spec changes to become visible all at once
    Benefit: FR, AC, scenario, check, and task traces cannot be partially installed.
    Context:
      **Priority:** P0  

      **Independent test:** Inject a fault at each writer boundary and observe only a complete old or complete new generation.

    @id:SCEN-mcp-write-authoring-fault-preserves-generation @feature27 @AC-27.1 @rollback
    Scenario: Writer faults expose only a complete generation
      Given the real generation writer and coordinated reader
      When each staging sync swap and cleanup boundary faults in turn
      Then every observation is the fully hashed old or new generation
      And the final tree reconciles to one complete generation

  @story:US-13
  Rule: Contain the write boundary
    Actor: repository owner
    Goal: canonical path and reparse checks plus a host path policy
    Benefit: raw tools cannot mutate `.specs/**`.
    Context:
      **Priority:** P0  

      **Independent test:** Exercise traversal, absolute, UNC/device, symlink, junction, and non-allowlisted writer cases before content mutation.

    @id:SCEN-mcp-write-authoring-containment-refuses-escape @feature25 @AC-25.1
    Scenario: Escaping and linked targets are refused before mutation
      Given real traversal device symlink junction reparse and switched-component fixtures
      When either authoring tool resolves containment
      Then PATH_FORBIDDEN is returned with bounded relative diagnostics
      And target bytes are unchanged

    @id:SCEN-mcp-write-authoring-result-validation-refuses-drift @feature25 @AC-25.2
    Scenario: Broken form trace or anchor refuses the result
      Given an in-memory result with one planted form trace anchor or validator failure
      When the complete kernel validator set runs
      Then ordered VALIDATION_FAILED findings identify the defect
      And no repository byte changes

  @story:US-14
  Rule: Preserve anchors and bytes
    Actor: Markdown author
    Goal: anchor-aware edits that conserve untouched bytes and EOLs
    Benefit: links and unrelated text do not drift.
    Context:
      **Priority:** P0  

      **Independent test:** Rename a heading through the proposal compiler and reconcile all same-spec inbound links and hashes.

    @id:SCEN-mcp-write-authoring-byte-eol-conservation @feature28 @AC-28.1
    Scenario: Anchor edit preserves unrelated bytes and EOLs
      Given a captured mixed-content spec with known byte and EOL hashes
      When an anchor-addressed proposal is applied
      Then untouched spans encoding EOL style and final newline equal the preimage
      And changed documents equal the proposal after-hashes

  @story:US-15
  Rule: Receive a useful private receipt
    Actor: operator
    Goal: a compact outcome with document hashes, findings, and next action
    Benefit: I can reconcile a mutation without leaking content or credentials.
    Context:
      **Priority:** P1  

      **Independent test:** Plant secrets and document text, then prove neither appears in proposal errors or apply receipts.

    @id:SCEN-mcp-write-authoring-receipt-redaction @feature28 @AC-28.2
    Scenario: Outcomes are compact and redacted
      Given fixture content containing planted document text credentials and absolute paths
      When proposal and apply success and refusal outcomes are serialized
      Then only the compact schema fields hashes relative paths and bounded findings remain
      And planted sensitive values stack traces and retained bytes are absent

  @story:US-16
  Rule: Recover without another public repair API
    Actor: operator
    Goal: deterministic internal rollback and clear manual restore instructions if storage is unrecoverable
    Benefit: a failed commit does not invent a risky automated repair path.
    Context:
      **Priority:** P0  

      **Independent test:** Destroy the staged and retained recovery candidates in a fault fixture and observe `RECOVERY_REQUIRED`, no further writes, and a bounded VCS/backup restore instruction.

    @id:SCEN-mcp-write-authoring-unrecoverable-needs-manual-restore @feature27 @AC-27.2 @rollback
    Scenario: Unrecoverable storage fails closed to manual restore
      Given neither retained old nor new generation is complete and hash-valid
      When internal rollback assesses the state
      Then apply returns RECOVERY_REQUIRED and performs no further authoring write
      And the next action names bounded VCS or backup restoration for the spec

  @contract
  Rule: Release and implementation contracts

    @feature9 @AC-9.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-pure-evaluation-boundary
    Scenario: Pure evaluator has no side effects
      Given identical current bindings trusted run envelopes and limits
      When evaluation is repeated
      Then the output is identical without filesystem clock environment network process OMP or MCP access

    @feature18 @AC-18.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-anti-false-green-invariants
    Scenario: No green claim exists without trusted captured bytes
      Given a result claim has only a sidecar label self-declared hash name match or partial run
      When anti-false-green rules run
      Then readiness is refused with the exact reason
      And no result or trace is fabricated

    @feature20 @AC-20.1 @id:SCEN-mcp-read-evidence-spec-mcp-operations-budget-enforcement
    Scenario: Hard limits fail closed
      Given capture evaluation or trace output exceeds a configured hard limit
      When the operation runs
      Then it returns a closed limit error without partial failure text
      And latency measurement remains outside the evaluator

    @id:SCEN-mcp-write-authoring-real-fixture-provenance @feature29 @AC-29.1
    Scenario: Real fixture evidence reconciles with producers
      Given captured kernel platform race and fault producer outputs
      When fixture provenance and ground truth are verified
      Then producer version invocation platform source hash and trimming are present
      And producer summaries reconcile with independent hashes

    @id:SCEN-mcp-write-authoring-protected-check-omissions-fail @feature29 @AC-29.2
    Scenario Outline: Each critical omission is caught behaviorally
      Given the <guard> is disabled in an isolated implementation
      When the concrete authoring scenario for that guard runs
      Then the scenario fails before release evidence is accepted
      And runtime API availability and response schema remain unchanged

      Examples:
        | example_id | guard |
        | row-1 | containment |
        | row-2 | CAS |
        | row-3 | resulting-spec validation |
        | row-4 | anchor rewrite closure |
        | row-5 | atomic rollback |
        | row-6 | receipt redaction |


  @feature30 @FR-30 @AC-30.1 @id:SCEN-mcp-discovery-metadata
  Scenario: MCP discovery metadata is complete and bounded
    Given a real packaged MCP server
    When the client initializes and lists the tools
    Then the server returns 10 existing tools with titles, four annotations, bounded descriptions, and one instructions paragraph

  @feature31 @FR-31 @AC-31.1 @id:SCEN-mcp-envelope-and-recovery
  Scenario: MCP envelopes and recovery guidance are declared and mirrored
    Given a real staged MCP corpus and packaged server
    When MCP envelope recovery cases are exercised
    Then every result has one canonical envelope and actionable bounded recovery


  @feature32 @FR-32 @AC-32.1 @id:SCEN-mcp-discriminated-variants
  Scenario: Discriminated branches reject unexpected parameters
    Given a real packaged MCP server
    When a consolidated tool is called with cross-branch or unknown fields
    Then the call is rejected before query dispatch with INVALID_REQUEST

  @feature33 @FR-33 @AC-33.1 @id:SCEN-mcp-types-catalog
  Scenario: Spec catalog returns domain type dictionary
    Given a real packaged MCP server
    When spec_catalog is called with view "types"
    Then the response contains 15 entity kinds and 7 edge types

  @feature34 @FR-34 @AC-34.1 @id:SCEN-mcp-surface-blast-limits
  Scenario: Surface blast metrics stay within strict limits
    Given a candidate MCP server
    When measure-mcp-tool-blast evaluates the surface
    Then candidate has 10 tools, <= 25499 bytes, and 0 retired names

  @feature35 @FR-35 @AC-35.1 @id:SCEN-mcp-hard-retirement-no-shims
  Scenario: Retired tools return protocol not found errors
    Given a real packaged MCP server
    When any retired tool name is invoked
    Then the server returns protocol error -32602 without migration shims

  @feature36 @FR-36 @AC-36.1 @id:SCEN-mcp-mutation-testing-gate
  Scenario: Mutation testing gate eliminates all mutants
    Given the tool contract registry and mutation harness
    When check-tool-surface-mutations executes
    Then zero mutants survive

  @feature37 @FR-37 @AC-37.1 @id:SCEN-mcp-unified-validation
  Scenario: Unified validation inspection evaluates corpus and specifications
    Given a real packaged MCP server
    When spec_inspect is called with check "validation"
    Then the response returns unified validation verdict counts and filtered items
    And retired check branches specValidation and diagnostics are rejected with INVALID_REQUEST
