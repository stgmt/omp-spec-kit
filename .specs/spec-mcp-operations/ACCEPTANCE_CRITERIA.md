# ACCEPTANCE CRITERIA

## Read / Core

The criteria describe the standalone graph core and its compatibility boundary. Scenarios are specification text, not execution evidence.

## AC-1.1: Pure occurrence-first core

**EARS:** WHEN callers supply bounded source documents and limits THEN the core SHALL build graph values without filesystem, clock, environment, process, network, OMP, or MCP access; AND every source occurrence SHALL remain observable.

**Requirement:** [FR-1](FR.md#fr-1-pure-occurrence-first-core)

**Scenario:** `@feature1`, `@id:SCEN-mcp-read-core-pure-occurrence-first-core`

**Check:** CHK-READ-CORE-FR1-01

## AC-2.1: Canonical documents and qualified IDs

**EARS:** WHEN the fifteen canonical document names are supplied THEN role-aware parsing SHALL emit only owning-document definitions, qualify every identity by spec slug, and preserve duplicate occurrences without cross-spec collision.

**Requirement:** [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids)

**Scenario:** `@feature2`, `@id:SCEN-mcp-read-core-canonical-documents-and-qualified-ids`

**Check:** CHK-READ-CORE-FR2-01

## AC-3.1: Typed graph conservation

**EARS:** WHEN definitions and references are parsed THEN each definition SHALL be unique, ambiguous, or rejected and each reference SHALL be a resolved typed edge or typed unresolved record, with all conservation equations reconciling.

**Requirement:** [FR-3](FR.md#fr-3-typed-graph-conservation)

**Scenario:** `@feature3`, `@id:SCEN-mcp-read-core-typed-graph-conservation`

**Check:** CHK-READ-CORE-FR3-01

## AC-4.1: Four bounded primitives

**EARS:** WHEN inventory, findNodes, traverse, or diagnostics is called THEN it SHALL use one deterministic cursor envelope, explicit limits, stable ordering, and a typed success or error without mutation.

**Requirement:** [FR-4](FR.md#fr-4-four-bounded-core-primitives)

**Scenario:** `@feature4`, `@id:SCEN-mcp-read-core-four-bounded-core-primitives`

**Check:** CHK-READ-CORE-FR4-01

## AC-5.1: Contained bounded inputs

**EARS:** WHEN an adapter supplies a source snapshot THEN only canonical documents under the caller-selected root and configured budgets SHALL be admitted; cancellation and hard-limit failures SHALL be explicit and no bytes SHALL be written.

**Requirement:** [FR-5](FR.md#fr-5-contained-inputs-and-budgets)

**Scenario:** `@feature5`, `@id:SCEN-mcp-read-core-contained-inputs-and-budgets`

**Check:** CHK-READ-CORE-FR5-01

## AC-6.1: Historical eight-name compatibility

**EARS:** WHEN historical v0.3.2 release verification runs THEN the eight historical MCP names SHALL remain immutable in released package receipts and fixture replay, but SHALL NOT be required in the active runtime tool registry.

**Requirement:** [FR-6](FR.md#fr-6-historical-eight-name-compatibility)

**Scenario:** `@feature6`, `@id:SCEN-mcp-read-core-historical-eight-name-compatibility`

**Check:** CHK-READ-CORE-FR6-01

## AC-7.1: Deterministic diagnostics and fingerprint

**EARS:** WHEN equivalent normalized source bytes, parser schema, and membership limits are supplied in different orders THEN graph serialization, diagnostics, and fingerprint SHALL be identical, while query availability SHALL not affect the fingerprint.

**Requirement:** [FR-7](FR.md#fr-7-deterministic-diagnostics-and-fingerprint)

**Scenario:** `@feature7`, `@id:SCEN-mcp-read-core-deterministic-diagnostics-and-fingerprint`

**Check:** CHK-READ-CORE-FR7-01

## AC-8.1: Real evidence and measurable budgets

**EARS:** WHEN a real fixture or packaged benchmark is evaluated THEN provenance, hashes, oracle counts, package, memory, latency, and response budgets SHALL be visible; structural validity SHALL not be reported as release evidence.

**Requirement:** [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets)

**Scenario:** `@feature8`, `@id:SCEN-mcp-read-core-real-fixtures-and-measurable-budgets`

**Check:** CHK-READ-CORE-FR8-01

## Read / Evidence

These criteria specify NEXT behavior. Their scenarios are not execution evidence.

## AC-9.1: Pure evaluator has no side effects

**EARS:** WHEN the evaluator receives a current snapshot, run envelopes, and limits THEN it SHALL return the same output for the same input without filesystem, clock, environment, network, process, OMP, or MCP access.

**Requirement:** [FR-9](FR.md#fr-9-pure-evaluation-boundary)

**Scenario:** `@feature9`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-pure-evaluation-boundary`

## AC-10.1: Closed producer artifact set

**EARS:** WHEN trusted capture receives supported, unsupported, malformed, absent, and over-limit producer artifacts THEN it SHALL accept only Cucumber Messages NDJSON 33.0.4 and pytest-bdd cucumber-json 1, preserve and re-hash actual bytes, and return the exact closed error for every other case.

**Requirement:** [FR-10](FR.md#fr-10-supported-execution-artifacts)

**Scenario:** `@feature10`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-supported-artifact-kinds`

## AC-11.1: One run has one capture-owned envelope

**EARS:** WHEN the trusted adapter captures an actual run THEN it SHALL emit one immutable envelope containing capture-owned run identity, scope, artifact bytes/hash, tested implementation identity, and scenario bindings; AND caller-supplied metadata/hash pairs SHALL NOT authenticate evidence.

**Requirement:** [FR-11](FR.md#fr-11-trusted-capture-run-envelope)

**Scenario:** `@feature11`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-trusted-capture-envelope`

## AC-12.1: Only stable identity can join

**EARS:** WHEN producer rows are joined THEN only an exact qualified ID or graph-verified canonical tag SHALL yield `JOINED`; ambiguous and unmatched rows SHALL remain non-authoritative; AND name matches SHALL appear only as diagnostics.

**Requirement:** [FR-12](FR.md#fr-12-scenario-result-join)

**Scenario:** `@feature12`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-stable-scenario-join`

## AC-13.1: Only capture-owned full scope is authoritative

**EARS:** WHEN full and partial runs exist THEN only a run whose trusted capture proves `FULL` scope over its expected scenario set SHALL be eligible for readiness; partial evidence SHALL remain visible but SHALL NOT replace or satisfy full evidence.

**Requirement:** [FR-13](FR.md#fr-13-full-run-scope-authority)

**Scenario:** `@feature13`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-full-run-scope-authority`

## AC-14.1: Current content bindings determine freshness

**EARS:** WHEN scenario content, applicable step binding, and tested implementation identity equal current values THEN evidence SHALL be `FRESH`; any mismatch SHALL be `STALE`; any required missing binding SHALL be `INDETERMINATE`; AND graph fingerprints and timestamps SHALL not affect the verdict.

**Requirement:** [FR-14](FR.md#fr-14-freshness-and-staleness)

**Scenario:** `@feature14`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-freshness-staleness`

## AC-15.1: Every required scenario needs fresh passed full evidence

**EARS:** WHEN task evidence is derived THEN the task SHALL be `VERIFIED` only if every current required scenario has `PASSED`, `FRESH`, `FULL` evidence; otherwise it SHALL be `BLOCKED` with the exact missing, failed, stale, indeterminate, ambiguous, or partial reason.

**Requirement:** [FR-15](FR.md#fr-15-fail-closed-status-truth)

**Scenario:** `@feature15`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-fail-closed-status-truth`

## AC-16.1: Waived tasks remain open

**EARS:** WHEN a task is waived THEN its evidence state SHALL be `WAIVED_OPEN` regardless of matching passed evidence and SHALL NOT count as verified.

**Requirement:** [FR-16](FR.md#fr-16-waiver-honesty)

**Scenario:** `@feature16`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-waiver-honesty`

## AC-17.1: No row or required scenario is silently lost

**EARS:** WHEN evaluation completes THEN every parsed producer row SHALL have one join outcome and every current required scenario SHALL have either one elected satisfying evidence reference or a blocker; display counts SHALL be derived rather than persisted as authority.

**Requirement:** [FR-17](FR.md#fr-17-internal-row-accounting)

**Scenario:** `@feature17`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-internal-row-accounting`

## AC-18.1: No verdict without trusted captured bytes

**EARS:** WHEN result, freshness, readiness, or trace is returned THEN it SHALL resolve to re-hashed producer bytes in one trusted-capture envelope; sidecars, labels, structural parsing, name-only matches, and partial scope SHALL NOT establish green authority.

**Requirement:** [FR-18](FR.md#fr-18-anti-false-green-invariants)

**Scenario:** `@feature18`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-anti-false-green-invariants`

## AC-19.1: Fixtures are real hashed and reviewed

**EARS:** WHEN an executable fixture is admitted THEN it SHALL contain real producer bytes and the required provenance, hash, trimming, and reviewed normalized outcomes; synthetic fixtures SHALL be limited to labeled scale or one-fault derivatives.

**Requirement:** [FR-19](FR.md#fr-19-real-fixtures-per-read-core-discipline)

**Scenario:** `@feature19`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-real-fixture-provenance`

## AC-20.1: Budgets are enforced

**EARS:** WHEN capture, evaluation, or trace paging exceeds a hard count/byte limit THEN it SHALL return a closed limit error without partial failure text; AND latency SHALL be measured outside the pure evaluator.

**Requirement:** [FR-20](FR.md#fr-20-budgets)

**Scenario:** `@feature20`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-budget-enforcement`

## AC-21.1: Release uses ordinary fresh full evidence

**EARS:** WHEN the product gate evaluates this capability THEN every required task SHALL be `VERIFIED` by ordinary scenario evidence bound to the tested candidate; one missing or blocked task SHALL fail the contribution; AND no evidence-specific manifest or second fingerprint SHALL be required.

**Requirement:** [FR-21](FR.md#fr-21-release-eligibility-contribution)

**Scenario:** `@feature21`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-release-contribution`

## AC-22.1: Result returns evidence and trace uses its reference

**EARS:** WHEN `get_test_result` resolves a scenario THEN it SHALL return one `ScenarioEvidence` or null; WHEN `get_scenario_trace` receives that evidence reference THEN it SHALL return only the corresponding bounded trace page and failure; AND no duplicate evidence identity SHALL appear.

**Requirement:** [FR-22](FR.md#fr-22-mcp-projection-of-gettestresult-and-getscenariotrace)

**Scenario:** `@feature22`, `@id:SCEN-mcp-read-evidence-spec-mcp-operations-mcp-projection-of-run-results`

## Write

These EARS criteria are specification text, not execution evidence.

## AC-23.1

**Requirement:** [FR-23](FR.md#fr-23-two-tool-public-boundary)

**WHEN** the installed MCP inventory is listed **THEN** its public mutation names SHALL be exactly `propose_patch` and `apply_proposed_patch`, internal helpers SHALL be absent, and the historical v0.3.2 read-only inventory SHALL remain historical evidence rather than a mutable authoring registry.

## AC-23.2

**Requirement:** [FR-23](FR.md#fr-23-two-tool-public-boundary)

**WHEN** a current-host tool call can write and its resolved target is under canonical `.specs/**` **THEN** the path policy SHALL allow it only when the tool name is in the exact authoring allowlist and SHALL deny every non-allowlisted writer before execution.

## AC-24.1

**Requirement:** [FR-24](FR.md#fr-24-pure-deterministic-proposal)

**WHEN** a valid one-spec request is proposed twice against identical bytes **THEN** both complete Proposals SHALL have equal normalized operations, finding order, diffs, before/after hashes, and Proposal hash, while all repository hashes remain unchanged.

## AC-24.2

**Requirement:** [FR-24](FR.md#fr-24-pure-deterministic-proposal)

**IF** operations target multiple specs or duplicate documents, violate a bound, or produce an invalid or incomplete preview **THEN** proposal SHALL return `INVALID_REQUEST` or `VALIDATION_FAILED`, SHALL be unappliable, and SHALL create no repository or durable review/transaction state.

## AC-25.1

**Requirement:** [FR-25](FR.md#fr-25-containment-anchors-and-resulting-spec-validation)

**IF** any root, spec, ancestor, or target is escaping, linked, reparse-backed, ambiguous, unsupported, normalization-colliding, or switched during resolution **THEN** both tools SHALL return `PATH_FORBIDDEN` before target mutation and SHALL report only bounded repository-relative diagnostics.

## AC-25.2

**Requirement:** [FR-25](FR.md#fr-25-containment-anchors-and-resulting-spec-validation)

**WHEN** the resulting in-memory spec has a broken canonical form, duplicate ID, missing FR↔AC↔Scenario↔CHK↔TASK edge, unresolved anchor, incomplete inbound rewrite, or unavailable validator **THEN** the operation SHALL return ordered `VALIDATION_FAILED` findings and zero changed bytes.

## AC-26.1

**Requirement:** [FR-26](FR.md#fr-26-exact-proposal-apply-with-cas-and-revalidation)

**WHEN** Proposal identity, every expected document hash, containment, and full resulting-spec validation still match under the lock **THEN** apply SHALL commit bytes exactly equal to the Proposal after-hashes and return one receipt; equal request replay SHALL not commit again.

## AC-26.2

**Requirement:** [FR-26](FR.md#fr-26-exact-proposal-apply-with-cas-and-revalidation)

**IF** any expected hash, Proposal hash, document set, path identity, or validation result changes before swap **THEN** apply SHALL return `CONFLICT` or `VALIDATION_FAILED`, SHALL not auto-rebase, and SHALL preserve the concurrently committed generation.

## AC-27.1

**Requirement:** [FR-27](FR.md#fr-27-atomic-one-spec-commit-and-internal-rollback)

**WHEN** deterministic faults occur before staging, during write/sync, immediately before swap, during swap, or during cleanup **THEN** every coordinated reader SHALL observe only a fully hashed old or fully hashed new generation and the final tree SHALL reconcile to one of them.

## AC-27.2

**Requirement:** [FR-27](FR.md#fr-27-atomic-one-spec-commit-and-internal-rollback)

**IF** internal rollback cannot prove a complete old or new generation **THEN** apply SHALL return `RECOVERY_REQUIRED`, perform no further authoring write, preserve bounded hashes/findings, and instruct manual restoration of the named spec from VCS or backup without exposing another public mutation operation.

## AC-28.1

**Requirement:** [FR-28](FR.md#fr-28-byte-conservation-and-compact-redacted-outcomes)

**WHEN** a section or anchor edit commits **THEN** untouched spans, encoding, EOL style, and final-newline state SHALL equal the captured preimage and every changed document SHALL equal its Proposal after-hash byte-for-byte.

## AC-28.2

**Requirement:** [FR-28](FR.md#fr-28-byte-conservation-and-compact-redacted-outcomes)

**WHEN** proposal or apply succeeds or refuses **THEN** the response SHALL match the compact Proposal, ApplyResult, MutationReceipt, or Error shape; planted document bodies, secrets, environment values, stack traces, retained bytes, and unrelated absolute paths SHALL be absent.

## AC-29.1

**Requirement:** [FR-29](FR.md#fr-29-real-correctness-evidence)

**WHEN** authoring verification runs **THEN** corpus, anchor, filesystem, concurrency, and fault fixtures SHALL identify their real producer/version/invocation/platform/source hash/trimming/ground truth and SHALL reconcile producer summaries with independent document or tree hashes.

## AC-29.2

**Requirement:** [FR-29](FR.md#fr-29-real-correctness-evidence)

**WHEN** containment, CAS, resulting-spec validation, anchor rewrite, atomic rollback, or redaction is deliberately disabled one at a time **THEN** at least one concrete behavioral test SHALL fail for each omission; these checks SHALL remain CI evidence and SHALL NOT alter runtime availability or response shape.


## AC-30.1: MCP discovery metadata and handshake

Given the packaged MCP server, when a client initializes and lists tools, the response SHALL contain exactly 11 names in contract order. Every entry SHALL have a top-level title matching its contract label, exactly four boolean annotation keys with the specified 10/1 semantic matrix, and a non-empty first description line of at most 200 characters. The initialize result SHALL contain the single approved instructions paragraph.

**Scenario:** `@feature30 @FR-30 @AC-30.1 @id:SCEN-mcp-discovery-metadata`
**Verification:** direct JSON-RPC and staged BDD.

## AC-31.1: Envelope schema and recovery are machine-actionable

Given a real MCP server, tools/list declares the stable result schema and discovery metadata; a successful call mirrors one canonical envelope in structured and text content; stale cursor and conflict responses declare actionable recovery; and target-indeterminate enforcement returns a bounded relative-target recovery without an absolute path.


## AC-32.1: Discriminated branch schemas and strict argument validation

**EARS:** WHEN an MCP call is received for a consolidated tool THEN the input arguments SHALL be validated against the exact discriminator branch schema with `additionalProperties: false`; ANY unknown field, cross-branch field, or invalid enum SHALL return `INVALID_REQUEST` before backend execution.

**Requirement:** [FR-32](FR.md#fr-32-discriminated-branch-schemas-and-strict-argument-validation)

**Scenario:** `@feature32 @FR-32 @AC-32.1 @id:SCEN-mcp-discriminated-variants`

## AC-33.1: Domain type dictionary catalog

**EARS:** WHEN `spec_catalog` is invoked with `view: "types"` THEN the response SHALL return exactly 15 entity kind descriptors and 7 edge type descriptors derived directly from the immutable kernel dictionary.

**Requirement:** [FR-33](FR.md#fr-33-domain-type-dictionary-catalog)

**Scenario:** `@feature33 @FR-33 @AC-33.1 @id:SCEN-mcp-types-catalog`

## AC-34.1: Surface blast limits and fail-closed measurement

**EARS:** WHEN `scripts/measure-mcp-tool-blast.mjs` evaluates the candidate MCP server THEN candidate tool count SHALL be 11, catalog bytes SHALL be <= 25,499, description characters SHALL be <= 2,000, and retired tool names SHALL be 0; OTHERWISE the measurement script SHALL exit with a fail-closed error.

**Requirement:** [FR-34](FR.md#fr-34-surface-blast-limits-and-fail-closed-measurement)

**Scenario:** `@feature34 @FR-34 @AC-34.1 @id:SCEN-mcp-surface-blast-limits`

## AC-35.1: Hard tool retirement without backward-compatibility shims

**EARS:** WHEN any of the 27 retired MCP tool names is called THEN the server SHALL return protocol error `-32602` without custom deprecation hints or alias delegation.

**Requirement:** [FR-35](FR.md#fr-35-hard-tool-retirement-without-backward-compatibility-shims)

**Scenario:** `@feature35 @FR-35 @AC-35.1 @id:SCEN-mcp-hard-retirement-no-shims`

## AC-36.1: Deterministic mutation testing gate

**EARS:** WHEN `scripts/check-tool-surface-mutations.mjs` runs against tool contracts and invariants THEN all synthetic mutants SHALL be eliminated resulting in `survivors: 0`.

**Requirement:** [FR-36](FR.md#fr-36-deterministic-mutation-testing-gate)

**Scenario:** `@feature36 @FR-36 @AC-36.1 @id:SCEN-mcp-mutation-testing-gate`
