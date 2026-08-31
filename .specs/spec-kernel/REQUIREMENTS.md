# Requirements Matrix

Each row is a complete FR ↔ AC ↔ scenario ↔ check ↔ task trace. Status describes the specification contract, not executed evidence.

## Functional traceability

| Requirement | Acceptance | Scenario tag | Check | Owning task |
|---|---|---|---|---|
| [FR-1](FR.md#fr-1-pure-occurrence-first-core) | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-occurrence-first-core) | `@feature1` / `@id:SCEN-pure-occurrence-first-core` | CHK-FR1-01 | [TASK-1](TASKS.md#task-1-define-the-pure-core-boundary) |
| [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids) | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-canonical-documents-and-qualified-ids) | `@feature2` / `@id:SCEN-canonical-documents-and-qualified-ids` | CHK-FR2-01 | [TASK-2](TASKS.md#task-2-implement-canonical-inventory-and-identity) |
| [FR-3](FR.md#fr-3-typed-graph-conservation) | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-typed-graph-conservation) | `@feature3` / `@id:SCEN-typed-graph-conservation` | CHK-FR3-01 | [TASK-3](TASKS.md#task-3-build-typed-conserved-graph) |
| [FR-4](FR.md#fr-4-four-bounded-core-primitives) | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-four-bounded-primitives) | `@feature4` / `@id:SCEN-four-bounded-core-primitives` | CHK-FR4-01 | [TASK-4](TASKS.md#task-4-implement-four-primitives-and-cursors) |
| [FR-5](FR.md#fr-5-contained-inputs-and-budgets) | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-contained-bounded-inputs) | `@feature5` / `@id:SCEN-contained-inputs-and-budgets` | CHK-FR5-01 | [TASK-5](TASKS.md#task-5-enforce-containment-cancellation-and-budgets) |
| [FR-6](FR.md#fr-6-historical-eight-name-compatibility) | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-historical-eight-name-compatibility) | `@feature6` / `@id:SCEN-historical-eight-name-compatibility` | CHK-FR6-01 | [TASK-6](TASKS.md#task-6-preserve-eight-compatibility-adapters) |
| [FR-7](FR.md#fr-7-deterministic-diagnostics-and-fingerprint) | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-deterministic-diagnostics-and-fingerprint) | `@feature7` / `@id:SCEN-deterministic-diagnostics-and-fingerprint` | CHK-FR7-01 | [TASK-7](TASKS.md#task-7-prove-deterministic-diagnostics-and-fingerprint) |
| [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets) | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-real-evidence-and-measurable-budgets) | `@feature8` / `@id:SCEN-real-fixtures-and-measurable-budgets` | CHK-FR8-01 | [TASK-8](TASKS.md#task-8-retain-real-fixture-and-budget-evidence) |

## Contract checks

| Check | Observable contract | Trace | Verification Method | State | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | Pure occurrence-first core has no ambient I/O | FR-1, AC-1.1, `@feature1` | BDD scenario | Draft | boundary inspection and source-occurrence conservation |
| CHK-FR2-01 | Canonical role grammar and qualified identity are exact | FR-2, AC-2.1, `@feature2` | BDD scenario | Draft | document census and duplicate/spec collision controls |
| CHK-FR3-01 | Typed edges and unresolved references conserve occurrences | FR-3, AC-3.1, `@feature3` | BDD scenario | Draft | duplicate, missing, ambiguous, and endpoint cases |
| CHK-FR4-01 | Four primitives share bounded deterministic pagination | FR-4, AC-4.1, `@feature4` | BDD scenario | Draft | primitive envelope and cursor cases |
| CHK-FR5-01 | Containment, cancellation, and hard budgets fail closed | FR-5, AC-5.1, `@feature5` | BDD scenario | Draft | traversal/link/limit variants |
| CHK-FR6-01 | Eight historical names project one shared result | FR-6, AC-6.1, `@feature6` | Integration test | Draft | v0.3.2 compatibility receipt and adapter parity |
| CHK-FR7-01 | Fingerprint excludes query availability and remains stable | FR-7, AC-7.1, `@feature7` | Unit test | Draft | normalized permutation and diagnostic ordering |
| CHK-FR8-01 | Real provenance and package/memory/latency budgets remain visible | FR-8, AC-8.1, `@feature8` | Manual review | Draft | manifest oracle and retained receipts |

## Invariants

1. A definition occurrence is exactly unique, ambiguous, or rejected.
2. A reference occurrence is exactly resolved or unresolved.
3. Resolved edges have existing permitted endpoints.
4. Spec-qualified IDs prevent cross-spec collision.
5. Four primitives read one immutable graph and mutate no repository or state.
6. Fingerprint inputs exclude query/MCP availability.
7. Structural validity and product release evidence are separate.
