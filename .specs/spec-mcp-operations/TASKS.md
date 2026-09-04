# TASKS

## Read / Core

Tasks own the read and write FR/AC/scenario/check traces. `done` means evidence-backed historical work; `planned` means NEXT implementation work.

## TASK-1: Define the pure core boundary

**Status:** planned

**Estimate:** 1 day

**Requirements:** [FR-1](FR.md#fr-1-pure-occurrence-first-core)

**Checks:** CHK-READ-CORE-FR1-01

**Scenario:** `@feature1` / `@id:SCEN-mcp-read-core-pure-occurrence-first-core`

**Done When:** Source values, occurrence-first parsing, cancellation, and zero-side-effect boundaries are explicit in the core entry point.

## TASK-2: Implement canonical inventory and identity

**Status:** planned

**Estimate:** 2 days

**Requirements:** [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids)

**Checks:** CHK-READ-CORE-FR2-01

**Scenario:** `@feature2` / `@id:SCEN-mcp-read-core-canonical-documents-and-qualified-ids`

**Done When:** The fifteen-name allowlist, role-aware definitions, qualified IDs, and duplicate candidates match the schema.

## TASK-3: Build typed conserved graph

**Status:** planned

**Estimate:** 3 days

**Requirements:** [FR-3](FR.md#fr-3-typed-graph-conservation)

**Checks:** CHK-READ-CORE-FR3-01

**Scenario:** `@feature3` / `@id:SCEN-mcp-read-core-typed-graph-conservation`

**Done When:** Nodes, typed edges, unresolved references, endpoint checks, and conservation counters fail closed on planted faults.

## TASK-4: Implement four primitives and cursors

**Status:** planned

**Estimate:** 3 days

**Requirements:** [FR-4](FR.md#fr-4-four-bounded-core-primitives)

**Checks:** CHK-READ-CORE-FR4-01

**Scenario:** `@feature4` / `@id:SCEN-mcp-read-core-four-bounded-core-primitives`

**Done When:** inventory, findNodes, traverse, and diagnostics share one bounded envelope, deterministic sort, cursor validation, and typed errors.

## TASK-5: Enforce containment cancellation and budgets

**Status:** planned

**Estimate:** 2 days

**Requirements:** [FR-5](FR.md#fr-5-contained-inputs-and-budgets)

**Checks:** CHK-READ-CORE-FR5-01

**Scenario:** `@feature5` / `@id:SCEN-mcp-read-core-contained-inputs-and-budgets`

**Done When:** Root containment, link rejection, cancellation, hard limits, sanitized errors, and zero writes are proven on supported hosts.

## TASK-6: Preserve eight compatibility adapters

**Status:** done

**Estimate:** historical receipt

**Requirements:** [FR-6](FR.md#fr-6-historical-eight-name-compatibility)

**Checks:** CHK-READ-CORE-FR6-01

**Scenario:** `@feature6` / `@id:SCEN-mcp-read-core-historical-eight-name-compatibility`

**Done When:** The immutable v0.3.2 receipt identifies the shipped eight names and adapter parity; no new implementation claim is inferred.

## TASK-7: Prove deterministic diagnostics and fingerprint

**Status:** planned

**Estimate:** 2 days

**Requirements:** [FR-7](FR.md#fr-7-deterministic-diagnostics-and-fingerprint)

**Checks:** CHK-READ-CORE-FR7-01

**Scenario:** `@feature7` / `@id:SCEN-mcp-read-core-deterministic-diagnostics-and-fingerprint`

**Done When:** Normalized source permutations produce equal canonical bytes/fingerprints and stable bounded diagnostics; query availability is excluded.

## TASK-8: Retain real fixture and budget evidence

**Status:** planned

**Estimate:** 2 days

**Requirements:** [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets)

**Checks:** CHK-READ-CORE-FR8-01

**Scenario:** `@feature8` / `@id:SCEN-mcp-read-core-real-fixtures-and-measurable-budgets`

**Done When:** Real-corpus provenance, hashes, independent oracles, package/memory/latency measurements, and historical receipts remain linked without a kernel release gate.

## Read / Evidence

All tasks are NEXT implementation work. Planned status is not execution evidence.

## TASK-9: Implement the pure evaluation schema and entry point

**Status:** Planned

**Estimate:** 2 days

**Owner:** Evidence maintainer

**Depends On:** none

**Requirements:** [FR-9](FR.md#fr-9-pure-evaluation-boundary), [FR-17](FR.md#fr-17-internal-row-accounting)

**Checks:** CHK-READ-EVIDENCE-FR1-01, CHK-READ-EVIDENCE-FR9-01

**Done When:**
- `EvidenceEvaluationInputV2` and `EvidenceEvaluationOutputV2` match the closed schema.
- Identical inputs produce byte-identical outputs with no evaluator I/O.
- Every parsed row and current required scenario has one explicit outcome; display counts are derived.

## TASK-10: Implement trusted capture and producer parsers

**Status:** Planned

**Estimate:** 4 days

**Owner:** Evidence maintainer

**Depends On:** TASK-9

**Requirements:** [FR-10](FR.md#fr-10-supported-execution-artifacts), [FR-11](FR.md#fr-11-trusted-capture-run-envelope), [FR-13](FR.md#fr-13-full-run-scope-authority), [FR-18](FR.md#fr-18-anti-false-green-invariants)

**Checks:** CHK-READ-EVIDENCE-FR2-01, CHK-READ-EVIDENCE-FR3-01, CHK-READ-EVIDENCE-FR5-01, CHK-READ-EVIDENCE-FR10-01

**Done When:**
- The adapter captures actual Cucumber Messages or pytest-bdd bytes and re-hashes them.
- One actual invocation produces one capture-owned envelope with tested implementation and bindings.
- FULL/PARTIAL is derived from the invocation; unsupported, malformed, absent, and over-limit cases fail closed.
- No overlay parser, sidecar hash, or caller-authenticated binding path exists.

## TASK-11: Implement join, freshness, and task evidence

**Status:** Planned

**Estimate:** 4 days

**Owner:** Evidence maintainer

**Depends On:** TASK-9, TASK-10

**Requirements:** [FR-12](FR.md#fr-12-scenario-result-join), [FR-14](FR.md#fr-14-freshness-and-staleness), [FR-15](FR.md#fr-15-fail-closed-status-truth), [FR-16](FR.md#fr-16-waiver-honesty), [FR-17](FR.md#fr-17-internal-row-accounting), [FR-18](FR.md#fr-18-anti-false-green-invariants)

**Checks:** CHK-READ-EVIDENCE-FR4-01, CHK-READ-EVIDENCE-FR5-01, CHK-READ-EVIDENCE-FR6-01, CHK-READ-EVIDENCE-FR7-01, CHK-READ-EVIDENCE-FR8-01, CHK-READ-EVIDENCE-FR9-01, CHK-READ-EVIDENCE-FR10-01

**Done When:**
- Exact qualified ID and verified tag are the only successful joins; name matches are diagnostics.
- Freshness compares scenario, applicable step, and tested implementation identities only.
- Every required scenario needs PASSED/FRESH/FULL evidence; partial or stale evidence blocks.
- Waived tasks remain WAIVED_OPEN.

## TASK-12: Capture and review real producer fixtures

**Status:** Planned

**Estimate:** 3 days

**Owner:** Fixture reviewer

**Depends On:** TASK-10

**Requirements:** [FR-19](FR.md#fr-19-real-fixtures-per-read-core-discipline)

**Checks:** CHK-READ-EVIDENCE-FR11-01

**Done When:**
- At least two identified real producers are captured.
- Every fixture records capture method, producer/version, source, date, hash, bytes, license, trimming, and reviewed normalized outcomes.
- Synthetic fixtures are labeled and limited to scale or one-fault derivatives.

## TASK-13: Enforce limits and product evidence contribution

**Status:** Planned

**Estimate:** 2 days

**Owner:** Evidence maintainer

**Depends On:** TASK-11, TASK-12

**Requirements:** [FR-20](FR.md#fr-20-budgets), [FR-21](FR.md#fr-21-release-eligibility-contribution)

**Checks:** CHK-READ-EVIDENCE-FR12-01, CHK-READ-EVIDENCE-FR13-01

**Done When:**
- Count/byte limits fail closed and latency measurements stay outside the evaluator.
- The product gate consumes ordinary task/scenario evidence for the tested candidate.
- Any required BLOCKED task refuses the contribution; no custom release manifest or second fingerprint exists.

## TASK-14: Project result and trace through MCP

**Status:** Planned

**Estimate:** 2 days

**Owner:** Evidence and MCP maintainer

**Depends On:** TASK-11, TASK-13

**Requirements:** [FR-22](FR.md#fr-22-mcp-projection-of-gettestresult-and-getscenariotrace)

**Checks:** CHK-READ-EVIDENCE-FR14-01

**Done When:**
- `get_test_result` returns one elected `ScenarioEvidence` or null.
- `get_scenario_trace` accepts its `EvidenceRef` and returns only bounded trace steps and failure.
- Opaque cursors are server-owned; result and trace introduce no duplicate identity.
- The historical eight-tool v0.3.2 first slice is unchanged.

## Write

## Board policy

All tasks are `todo`; the feature state is `NEXT`. Estimates are planning units, not delivery claims. Each task owns concrete checks and may move only through the repository's ordinary task status mechanism; authoring defines no second task lifecycle.

## TASK-15 — Register the two-tool boundary and host path policy — id: TASK-15

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** MCP maintainer
- **Depends on:** Existing MCP server and current-host `tool_call` policy hook
- **Traces:** FR-23; AC-23.1, AC-23.2; CHK-WRITE-FR1-01, CHK-WRITE-FR1-02; Scenarios: `SCEN-mcp-write-authoring-two-tool-inventory`, `SCEN-mcp-write-authoring-path-policy-denies-raw-writer`
- **Done When:** Installed tools/list exposes exactly the two public mutation names, internal helpers are absent, and real tool-call tests deny non-allowlisted `.specs/**` writes without blocking unrelated targets.

_Requirements: [FR-23](FR.md#fr-23-two-tool-public-boundary)_

## TASK-16 — Implement canonical operations and pure proposal — id: TASK-16

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Authoring maintainer
- **Depends on:** TASK-15; immutable kernel snapshot/query core
- **Traces:** FR-24; AC-24.1, AC-24.2; CHK-WRITE-FR2-01, CHK-WRITE-FR2-02; Scenarios: `SCEN-mcp-write-authoring-proposal-deterministic-no-write`, `SCEN-mcp-write-authoring-invalid-preview-refused`
- **Done When:** Internal helpers normalize to one operation union; equal real-corpus inputs yield equal complete Proposals with zero writes; mixed-spec, duplicate, invalid, and over-bound requests refuse.

_Requirements: [FR-24](FR.md#fr-24-pure-deterministic-proposal)_

## TASK-17 — Compose containment, anchors, and validation — id: TASK-17

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Kernel/security maintainer
- **Depends on:** TASK-16; current kernel validators and anchor inventory
- **Traces:** FR-25; AC-25.1, AC-25.2; CHK-WRITE-FR3-01, CHK-WRITE-FR3-02; Scenarios: `SCEN-mcp-write-authoring-containment-refuses-escape`, `SCEN-mcp-write-authoring-result-validation-refuses-drift`
- **Done When:** Real Windows/POSIX path fixtures refuse every named escape/link family before mutation, and planted form/ID/trace/anchor/validator defects return ordered findings with unchanged tree hashes.

_Requirements: [FR-25](FR.md#fr-25-containment-anchors-and-resulting-spec-validation)_

## TASK-18 — Implement CAS apply and concurrency — id: TASK-18

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Concurrency maintainer
- **Depends on:** TASK-16, TASK-17
- **Traces:** FR-26; AC-26.1, AC-26.2; CHK-WRITE-FR4-01, CHK-WRITE-FR4-02; Scenarios: `SCEN-mcp-write-authoring-apply-exact-proposal`, `SCEN-mcp-write-authoring-concurrent-apply-conflict`
- **Done When:** Apply accepts only exact Proposal identity plus complete expected hashes; replay is idempotent; real two-process, ABA, path-switch, and lock-timeout tests show one winner and no lost update or automatic rebase.

_Requirements: [FR-26](FR.md#fr-26-exact-proposal-apply-with-cas-and-revalidation)_

## TASK-19 — Implement atomic writer and internal rollback — id: TASK-19

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Filesystem maintainer
- **Depends on:** TASK-18
- **Traces:** FR-27; AC-27.1, AC-27.2; CHK-WRITE-FR5-01, CHK-WRITE-FR5-02; Scenarios: `SCEN-mcp-write-authoring-fault-preserves-generation`, `SCEN-mcp-write-authoring-unrecoverable-needs-manual-restore`
- **Done When:** Faults at every stage/sync/swap/cleanup boundary leave a fully hashed old or new generation; coordinated readers never see mixed bytes; the no-survivor fixture stops with `RECOVERY_REQUIRED` and bounded manual restore guidance.

_Requirements: [FR-27](FR.md#fr-27-atomic-one-spec-commit-and-internal-rollback)_

## Write task index

| Task | Requirements | Checks |
|---|---|---|
| TASK-15 | FR-23 | CHK-WRITE-FR1-01, CHK-WRITE-FR1-02 |
| TASK-16 | FR-24 | CHK-WRITE-FR2-01, CHK-WRITE-FR2-02 |
| TASK-17 | FR-25 | CHK-WRITE-FR3-01, CHK-WRITE-FR3-02 |
| TASK-18 | FR-26 | CHK-WRITE-FR4-01, CHK-WRITE-FR4-02 |
| TASK-19 | FR-27 | CHK-WRITE-FR5-01, CHK-WRITE-FR5-02 |
| TASK-20 | FR-28 | CHK-WRITE-FR6-01, CHK-WRITE-FR6-02 |
| TASK-21 | FR-29 | CHK-WRITE-FR7-01, CHK-WRITE-FR7-02 |

## TASK-20 — Preserve bytes and redact outcomes — id: TASK-20

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** Compatibility/security maintainer
- **Depends on:** TASK-16, TASK-19
- **Traces:** FR-28; AC-28.1, AC-28.2; CHK-WRITE-FR6-01, CHK-WRITE-FR6-02; Scenarios: SCEN-mcp-write-authoring-byte-eol-conservation, SCEN-mcp-write-authoring-receipt-redaction
- **Done When:** Proposal retains bounded exact diffs and before/after hashes; apply returns only the compact result or redacted MutationReceipt; body text, credentials, environment values, stacks, retained bytes, and unrelated paths are absent.

_Requirements: [FR-28](FR.md#fr-28-byte-conservation-and-compact-redacted-outcomes)_

## TASK-21 — Prove real correctness and protected checks — id: TASK-21

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Verification maintainer
- **Depends on:** TASK-17, TASK-18, TASK-19, TASK-20
- **Traces:** FR-29; AC-29.1, AC-29.2; CHK-WRITE-FR7-01, CHK-WRITE-FR7-02; Scenarios: SCEN-mcp-write-authoring-real-fixture-provenance, SCEN-mcp-write-authoring-protected-check-omissions-fail
- **Done When:** Provenance-recorded Windows/POSIX, race, fault, anchor-rewrite, validation, rollback, and redaction runs execute; each protected-check omission causes a failing verification; no zero-scenario or source-text-only result is accepted.

_Requirements: [FR-29](FR.md#fr-29-real-correctness-evidence)_


## TASK-22: Publish bounded MCP discovery metadata

Implement the four-hint annotation matrix, contract-label titles, initialize instructions, and first-line description cap. Extend direct JSON-RPC and staged BDD checks for the consolidated 11 entries.

- [ ] Implement and verify the declared MCP result envelope, discovery metadata, and actionable recovery boundary for FR-31.


## TASK-23 — Implement discriminated branch schemas and argument validation — id: TASK-23

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** Adapter maintainer
- **Depends on:** TASK-22
- **Traces:** FR-32; AC-32.1; Scenarios: SCEN-mcp-discriminated-variants
- **Done When:** Every consolidated tool validates discriminated branches with `additionalProperties: false` and rejects malformed or cross-branch parameters.

_Requirements: [FR-32](FR.md#fr-32-discriminated-branch-schemas-and-strict-argument-validation)_

## TASK-24 — Implement domain types catalog in kernel and query service — id: TASK-24

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** Kernel maintainer
- **Depends on:** TASK-23
- **Traces:** FR-33; AC-33.1; Scenarios: SCEN-mcp-types-catalog
- **Done When:** `spec_catalog(view: "types")` returns 15 entity kinds and 7 edge types from the kernel types module.

_Requirements: [FR-33](FR.md#fr-33-domain-type-dictionary-catalog)_

## TASK-25 — Enforce surface blast limits and blast measurement script — id: TASK-25

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** Verification maintainer
- **Depends on:** TASK-22, TASK-23
- **Traces:** FR-34; AC-34.1; Scenarios: SCEN-mcp-surface-blast-limits
- **Done When:** `scripts/measure-mcp-tool-blast.mjs` verifies 11 tools, <= 25,499 catalog bytes, <= 2,000 description characters, and 0 retired names.

_Requirements: [FR-34](FR.md#fr-34-surface-blast-limits-and-fail-closed-measurement)_

## TASK-26 — Hard-cut retired tools without backward compatibility shims — id: TASK-26

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** Adapter maintainer
- **Depends on:** TASK-22, TASK-25
- **Traces:** FR-35; AC-35.1; Scenarios: SCEN-mcp-hard-retirement-no-shims
- **Done When:** Calling any retired tool returns protocol -32602 without custom hints or aliases.

_Requirements: [FR-35](FR.md#fr-35-hard-tool-retirement-without-backward-compatibility-shims)_

## TASK-27 — Implement deterministic mutation testing gate with zero survivors — id: TASK-27

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** Testing maintainer
- **Depends on:** TASK-23, TASK-26
- **Traces:** FR-36; AC-36.1; Scenarios: SCEN-mcp-mutation-testing-gate
- **Done When:** `scripts/check-tool-surface-mutations.mjs` executes synthetic mutants against invariants and reports `survivors: 0`.

_Requirements: [FR-36](FR.md#fr-36-deterministic-mutation-testing-gate)_

## TASK-28 — Implement unified validation inspection in kernel and MCP adapter — id: TASK-28

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** Adapter/kernel maintainer
- **Depends on:** TASK-23
- **Traces:** FR-37; AC-37.1; Scenarios: SCEN-mcp-unified-validation
- **Done When:** `spec_inspect` supports `check: "validation"`, computes pre-filter verdict/totals, filters items, rejects unknown/malformed slugs, and removes `specValidation` and `diagnostics` branches.

_Requirements: [FR-37](FR.md#fr-37-unified-specification-and-corpus-validation-inspection)_
