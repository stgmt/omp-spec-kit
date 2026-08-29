# Tasks

All tasks are planned future capability work. None changes the delivered v0.3 baseline.

## TASK-1: Define capability sources, identity, parser and edges

**Status:** Planned

**Estimate:** 5 days

**Owner:** Kernel capability maintainer

**Depends On:** accepted spec-kernel@2 source extension contract

**Requirements:** FR-1, FR-2, FR-7; AC-1.1, AC-2.1, AC-7.1, AC-7.2; CHK-FR1-01, CHK-FR2-01, CHK-FR7-01, CHK-NFR-MEM-01, CHK-NFR-REL-01

**Done When:**
- per-owning-spec CAPABILITIES documents produce qualified nodes/nesting; root singleton/frontmatter/bare forms reject;
- qualified Covers creates requirement→capability or child→parent DERIVES_FROM only;
- duplicate/permutation/property fixtures conserve candidates and use kernel `DUPLICATE_DEFINITION`.

## TASK-2: Implement capability conformance findings

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel capability maintainer

**Depends On:** TASK-1

**Requirements:** FR-3; AC-3.1; CHK-FR3-01, CHK-NFR-USE-01

**Done When:** Capability-specific diagnostics have exact severity/source/validity, duplicates use only kernel `DUPLICATE_DEFINITION`, and bounded golden messages pass.

## TASK-3: Implement capability graph queries

**Status:** Planned

**Estimate:** 4 days

**Owner:** Query maintainer

**Depends On:** TASK-1, TASK-2

**Requirements:** FR-4, FR-5; AC-4.1, AC-5.1; CHK-FR4-01, CHK-FR5-01, CHK-NFR-PERF-01

**Done When:** requirementsOf/capabilitiesOf implement the closed summary types, lifecycle filter, bounds/defaults/errors/order and fingerprint-bound cursor contracts.

## TASK-4: Implement graph impact and evidence invalidation overlay

**Status:** Planned

**Estimate:** 4 days

**Owner:** Capability + evidence maintainers

**Depends On:** TASK-3, accepted spec-evidence@2 contract

**Requirements:** FR-6; AC-6.1; CHK-FR6-01, CHK-FR6-02

**Done When:** Graph impact emits only typed canonical IDs; separate overlay consumes current/evidence graph/scenario/step/implementation bindings and returns stale/unaffected/indeterminate rows with proof.

## TASK-5: Project capability operations through MCP only

**Status:** Planned

**Estimate:** 2 days

**Owner:** MCP maintainer

**Depends On:** TASK-3, TASK-4

**Requirements:** FR-8; AC-8.1; CHK-FR8-01, CHK-FR8-02

**Done When:** Graph profile maps three MCP names; overlay profile additionally maps invalidate_evidence; no capability pi.registerTool/LSP agent surface exists and both parity matrices pass.

## TASK-6: Implement capability release conjunction

**Status:** Planned

**Estimate:** 3 days

**Owner:** Release maintainer

**Depends On:** TASK-1 through TASK-5, TASK-8

**Requirements:** FR-9; AC-9.1; CHK-FR9-01, CHK-NFR-PERF-01, CHK-NFR-SIZE-01, CHK-NFR-MEM-01, CHK-NFR-SEC-01, CHK-NFR-REL-01, CHK-NFR-USE-01

**Done When:** Graph (16 records) and overlay (18 records) profiles re-hash role-typed ProductStatus/kernel/evidence documents, enforce exact check/requirement memberships and deterministic fingerprints, return the self-binding result, and fail every one-fault variant.

## TASK-7: Audit the capability boundary

**Status:** Planned

**Estimate:** 1 day

**Owner:** Independent reviewer

**Depends On:** TASK-1 through TASK-6

**Requirements:** FR-10; AC-10.1; CHK-FR10-01, CHK-NFR-SEC-01

**Done When:** Schema/source/MCP inventories contain no forbidden control-plane concept and current product status stays unchanged.

## TASK-8: Measure capability release budgets

**Status:** Planned

**Estimate:** 2 days

**Owner:** Performance + security reviewer

**Depends On:** TASK-1 through TASK-5

**Requirements:** NFR-PERF-1, NFR-SIZE-1, NFR-MEM-1, NFR-SEC-1, NFR-REL-1, NFR-USE-1; CHK-NFR-PERF-01, CHK-NFR-SIZE-01, CHK-NFR-MEM-01, CHK-NFR-SEC-01, CHK-NFR-REL-01, CHK-NFR-USE-01

**Done When:** Candidate-bound raw latency/size/RSS/security/determinism/usability evidence satisfies every graph and overlay hard bound, including 64 MiB input, 100,000 inspected rows, 2,000 ms p95/5,000 ms hard deadline, 200-row pages and 1 MiB responses.

## Task summary

| Task | Status | Owner | Primary checks |
|---|---|---|---|
| TASK-1 | Planned | Kernel capability maintainer | CHK-FR1-01, CHK-FR2-01, CHK-FR7-01 |
| TASK-2 | Planned | Kernel capability maintainer | CHK-FR3-01, CHK-NFR-USE-01 |
| TASK-3 | Planned | Query maintainer | CHK-FR4-01, CHK-FR5-01, CHK-NFR-PERF-01 |
| TASK-4 | Planned | Capability + evidence maintainers | CHK-FR6-01, CHK-FR6-02 |
| TASK-5 | Planned | MCP maintainer | CHK-FR8-01, CHK-FR8-02 |
| TASK-6 | Planned | Release maintainer | CHK-FR9-01 plus all NFR checks |
| TASK-7 | Planned | Independent reviewer | CHK-FR10-01, CHK-NFR-SEC-01 |
| TASK-8 | Planned | Performance + security reviewer | all six CHK-NFR-* checks |
