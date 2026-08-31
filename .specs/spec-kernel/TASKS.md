# Tasks

Tasks own the eight FR/AC/scenario/check traces. `done` means evidence-backed historical work; `planned` means NEXT implementation work.

## TASK-1: Define the pure core boundary

**Status:** planned

**Estimate:** 1 day

**Requirements:** [FR-1](FR.md#fr-1-pure-occurrence-first-core)

**Checks:** CHK-FR1-01

**Scenario:** `@feature1` / `@id:SCEN-pure-occurrence-first-core`

**Done When:** Source values, occurrence-first parsing, cancellation, and zero-side-effect boundaries are explicit in the core entry point.

## TASK-2: Implement canonical inventory and identity

**Status:** planned

**Estimate:** 2 days

**Requirements:** [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids)

**Checks:** CHK-FR2-01

**Scenario:** `@feature2` / `@id:SCEN-canonical-documents-and-qualified-ids`

**Done When:** The fifteen-name allowlist, role-aware definitions, qualified IDs, and duplicate candidates match the schema.

## TASK-3: Build typed conserved graph

**Status:** planned

**Estimate:** 3 days

**Requirements:** [FR-3](FR.md#fr-3-typed-graph-conservation)

**Checks:** CHK-FR3-01

**Scenario:** `@feature3` / `@id:SCEN-typed-graph-conservation`

**Done When:** Nodes, typed edges, unresolved references, endpoint checks, and conservation counters fail closed on planted faults.

## TASK-4: Implement four primitives and cursors

**Status:** planned

**Estimate:** 3 days

**Requirements:** [FR-4](FR.md#fr-4-four-bounded-core-primitives)

**Checks:** CHK-FR4-01

**Scenario:** `@feature4` / `@id:SCEN-four-bounded-core-primitives`

**Done When:** inventory, findNodes, traverse, and diagnostics share one bounded envelope, deterministic sort, cursor validation, and typed errors.

## TASK-5: Enforce containment cancellation and budgets

**Status:** planned

**Estimate:** 2 days

**Requirements:** [FR-5](FR.md#fr-5-contained-inputs-and-budgets)

**Checks:** CHK-FR5-01

**Scenario:** `@feature5` / `@id:SCEN-contained-inputs-and-budgets`

**Done When:** Root containment, link rejection, cancellation, hard limits, sanitized errors, and zero writes are proven on supported hosts.

## TASK-6: Preserve eight compatibility adapters

**Status:** done

**Estimate:** historical receipt

**Requirements:** [FR-6](FR.md#fr-6-historical-eight-name-compatibility)

**Checks:** CHK-FR6-01

**Scenario:** `@feature6` / `@id:SCEN-historical-eight-name-compatibility`

**Done When:** The immutable v0.3.2 receipt identifies the shipped eight names and adapter parity; no new implementation claim is inferred.

## TASK-7: Prove deterministic diagnostics and fingerprint

**Status:** planned

**Estimate:** 2 days

**Requirements:** [FR-7](FR.md#fr-7-deterministic-diagnostics-and-fingerprint)

**Checks:** CHK-FR7-01

**Scenario:** `@feature7` / `@id:SCEN-deterministic-diagnostics-and-fingerprint`

**Done When:** Normalized source permutations produce equal canonical bytes/fingerprints and stable bounded diagnostics; query availability is excluded.

## TASK-8: Retain real fixture and budget evidence

**Status:** planned

**Estimate:** 2 days

**Requirements:** [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets)

**Checks:** CHK-FR8-01

**Scenario:** `@feature8` / `@id:SCEN-real-fixtures-and-measurable-budgets`

**Done When:** Real-corpus provenance, hashes, independent oracles, package/memory/latency measurements, and historical receipts remain linked without a kernel release gate.
