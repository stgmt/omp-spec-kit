# Acceptance Criteria

The criteria describe the standalone graph core and its compatibility boundary. Scenarios are specification text, not execution evidence.

## AC-1.1: Pure occurrence-first core

**EARS:** WHEN callers supply bounded source documents and limits THEN the core SHALL build graph values without filesystem, clock, environment, process, network, OMP, or MCP access; AND every source occurrence SHALL remain observable.

**Requirement:** [FR-1](FR.md#fr-1-pure-occurrence-first-core)

**Scenario:** `@feature1`, `@id:SCEN-pure-occurrence-first-core`

**Check:** CHK-FR1-01

## AC-2.1: Canonical documents and qualified IDs

**EARS:** WHEN the fifteen canonical document names are supplied THEN role-aware parsing SHALL emit only owning-document definitions, qualify every identity by spec slug, and preserve duplicate occurrences without cross-spec collision.

**Requirement:** [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids)

**Scenario:** `@feature2`, `@id:SCEN-canonical-documents-and-qualified-ids`

**Check:** CHK-FR2-01

## AC-3.1: Typed graph conservation

**EARS:** WHEN definitions and references are parsed THEN each definition SHALL be unique, ambiguous, or rejected and each reference SHALL be a resolved typed edge or typed unresolved record, with all conservation equations reconciling.

**Requirement:** [FR-3](FR.md#fr-3-typed-graph-conservation)

**Scenario:** `@feature3`, `@id:SCEN-typed-graph-conservation`

**Check:** CHK-FR3-01

## AC-4.1: Four bounded primitives

**EARS:** WHEN inventory, findNodes, traverse, or diagnostics is called THEN it SHALL use one deterministic cursor envelope, explicit limits, stable ordering, and a typed success or error without mutation.

**Requirement:** [FR-4](FR.md#fr-4-four-bounded-core-primitives)

**Scenario:** `@feature4`, `@id:SCEN-four-bounded-core-primitives`

**Check:** CHK-FR4-01

## AC-5.1: Contained bounded inputs

**EARS:** WHEN an adapter supplies a source snapshot THEN only canonical documents under the caller-selected root and configured budgets SHALL be admitted; cancellation and hard-limit failures SHALL be explicit and no bytes SHALL be written.

**Requirement:** [FR-5](FR.md#fr-5-contained-inputs-and-budgets)

**Scenario:** `@feature5`, `@id:SCEN-contained-inputs-and-budgets`

**Check:** CHK-FR5-01

## AC-6.1: Historical eight-name compatibility

**EARS:** WHEN the released v0.3.2 compatibility adapters are invoked THEN the exact eight historical MCP names SHALL project the same core result, while released-format decoders and fixture replay remain compatibility-only.

**Requirement:** [FR-6](FR.md#fr-6-historical-eight-name-compatibility)

**Scenario:** `@feature6`, `@id:SCEN-historical-eight-name-compatibility`

**Check:** CHK-FR6-01

## AC-7.1: Deterministic diagnostics and fingerprint

**EARS:** WHEN equivalent normalized source bytes, parser schema, and membership limits are supplied in different orders THEN graph serialization, diagnostics, and fingerprint SHALL be identical, while query availability SHALL not affect the fingerprint.

**Requirement:** [FR-7](FR.md#fr-7-deterministic-diagnostics-and-fingerprint)

**Scenario:** `@feature7`, `@id:SCEN-deterministic-diagnostics-and-fingerprint`

**Check:** CHK-FR7-01

## AC-8.1: Real evidence and measurable budgets

**EARS:** WHEN a real fixture or packaged benchmark is evaluated THEN provenance, hashes, oracle counts, package, memory, latency, and response budgets SHALL be visible; structural validity SHALL not be reported as release evidence.

**Requirement:** [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets)

**Scenario:** `@feature8`, `@id:SCEN-real-fixtures-and-measurable-budgets`

**Check:** CHK-FR8-01
