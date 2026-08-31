# Tasks

All tasks are planned. A task is complete only with the stated executable evidence; specification prose and scenario text do not count.

## TASK-1: Implement request integrity and typed outcomes

**Status:** Planned

**Estimate:** 1 day

**Owner:** Plan validation maintainer

**Depends On:** none

**Requirements:** [FR-1](FR.md#fr-1-exact-manual-validation-contract), [FR-2](FR.md#fr-2-input-integrity-and-truthful-unavailability)

**Checks:** CHK-FR1-01, CHK-FR2-01

**Done When:**
- `validateExactPlan` implements the closed request/result schema and computes SHA-256 from original UTF-8 bytes.
- Shape, size, digest mismatch, and caught-failure vectors produce exact `UNAVAILABLE` diagnostics.
- Focused tests prove that inability to evaluate is never returned as `VALID` or `INVALID`.

## TASK-2: Implement semantic checks and bounded findings

**Status:** Planned

**Estimate:** 2 days

**Owner:** Plan validation maintainer

**Depends On:** TASK-1

**Requirements:** [FR-3](FR.md#fr-3-native-compatible-actionable-content), [FR-4](FR.md#fr-4-optional-request-alignment-is-advisory), [FR-5](FR.md#fr-5-bounded-deterministic-findings)

**Checks:** CHK-FR3-01, CHK-FR4-01, CHK-FR5-01

**Done When:**
- Accepted heading aliases in any order produce the documented semantic fields without rejecting unrelated sections.
- Every missing field, malformed file/action row, and destructive-impact branch has one-fault coverage with exact lines and hints.
- Alignment vectors, stable ordering, 50-row truncation, and exact omitted counts match the schema.

## TASK-3: Bundle and prove the pure installed module

**Status:** Planned

**Estimate:** 1 day

**Owner:** Plugin build maintainer

**Depends On:** TASK-2

**Requirements:** [FR-6](FR.md#fr-6-pure-and-self-contained-execution)

**Checks:** CHK-FR6-01

**Done When:**
- The normal build includes the root-source validator in the installed package without a second entry point.
- Installed-artifact smoke succeeds outside the checkout with external `node_modules` absent.
- Instrumentation records zero filesystem, directory, write, network, provider, credential, subprocess, or persistence operations and includes latency observations for NFR-PERF-1.

## TASK-4: Capture and reconcile real plan fixtures

**Status:** Planned

**Estimate:** 1 day

**Owner:** Test evidence maintainer

**Depends On:** TASK-2, TASK-3

**Requirements:** [FR-7](FR.md#fr-7-real-fixture-provenance)

**Checks:** CHK-FR7-01

**Done When:**
- At least one valid native-authored plan has complete manifest provenance, reviewed ground truth, SHA-256, and byte count.
- One-fault variants cover each content error while retaining derivation records from the real plan.
- Observed ordered results reconcile element-for-element, and synthetic boundary fixtures remain labeled and separate.

## Task summary

| Task | Status | Owner | Primary output |
|---|---|---|---|
| TASK-1 | Planned | Plan validation maintainer | Request integrity and typed outcomes |
| TASK-2 | Planned | Plan validation maintainer | Semantic validator and bounded findings |
| TASK-3 | Planned | Plugin build maintainer | Installed pure module proof |
| TASK-4 | Planned | Test evidence maintainer | Real fixture admission report |
