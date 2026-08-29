# Tasks

All tasks are planned future capability work. Current scenario text is not execution evidence.

## TASK-1: Prove pinned OMP LSP ABI

**Status:** Planned
**Estimate:** 2 days
**Owner:** OMP adapter maintainer
**Depends On:** pinned OMP v17.3.7 source
**Refs:** FR-1, FR-2, FR-9, FR-10, FR-11; CHK-FR1-01, CHK-FR2-01
**Done When:** Live receipts prove manifest registration, lazy/shared lifecycle, didSave timing, file routing, installed root and no agent-facing spec LSP path.

## TASK-2: Map kernel findings to diagnostics

**Status:** Planned
**Estimate:** 2 days
**Owner:** LSP maintainer
**Depends On:** TASK-1, delivered kernel baseline
**Refs:** FR-3; CHK-FR3-01
**Done When:** Every kernel finding maps one-to-one with exact code, closed severity mapping, path, non-BMP-safe converted range, message and complete related inventory; no adapter rule.

## TASK-3: Implement definition and references

**Status:** Planned
**Estimate:** 2 days
**Owner:** LSP maintainer
**Depends On:** TASK-1
**Refs:** FR-4; CHK-FR4-01
**Done When:** Definition/reference results equal kernel identity/occurrence answers including ambiguity.

## TASK-4: Implement completion and document symbols

**Status:** Planned
**Estimate:** 2 days
**Owner:** LSP maintainer
**Depends On:** TASK-1
**Refs:** FR-5; CHK-FR5-01
**Done When:** Completion is a bounded kernel alias subset and document symbols reproduce kernel nodes/headings.

## TASK-5: Implement kernel-only hover

**Status:** Planned
**Estimate:** 1 day
**Owner:** LSP maintainer
**Depends On:** TASK-1
**Refs:** FR-6; CHK-FR6-01
**Done When:** Hover exposes only schema-listed kernel fields; evidence/run/trace fields are absent.

## TASK-6: Prove current step-layer absence

**Status:** Planned
**Estimate:** 1 day
**Owner:** Release reviewer
**Depends On:** TASK-1
**Refs:** FR-7, FR-12; CHK-FR7-01, CHK-FR12-01
**Done When:** Current manifest has no cucumber server/library, no step diagnostics/navigation and no oracle requirement.

## TASK-7: Prove adapter-to-kernel parity

**Status:** Planned
**Estimate:** 2 days
**Owner:** Independent reviewer
**Depends On:** TASK-2, TASK-3, TASK-4, TASK-5
**Refs:** FR-8; CHK-FR8-01
**Done When:** Definition/reference/diagnostic semantics normalize to byte-identical `LspKernelProjectionV1` values on one fingerprint-bound admitted real corpus; only JSON-RPC ID, server name, timing and URI syntax are removed; related diagnostics and scalar ranges remain semantic.

## TASK-8: Build the self-contained LSP bundle

**Status:** Planned
**Estimate:** 2 days
**Owner:** Build maintainer
**Depends On:** TASK-2 through TASK-5
**Refs:** FR-11; CHK-FR11-01
**Done When:** Installed bundle runs source/dependency-absent with no native binary, cucumber package or undeclared import.

## TASK-9: Measure honest didSave rebuild

**Status:** Planned
**Estimate:** 1 day
**Owner:** Performance reviewer
**Depends On:** TASK-2 through TASK-5
**Refs:** FR-9; CHK-FR9-01
**Done When:** Lazy start/full rebuild p95 is recorded with environment/corpus identity and no 150 ms pass/fail claim.

## TASK-10: Prove containment and honest absence

**Status:** Planned
**Estimate:** 2 days
**Owner:** Security reviewer
**Depends On:** TASK-1
**Refs:** FR-10; CHK-FR10-01
**Done When:** repository-root containment accepts only safe `.specs/**` descendants, unsafe roots/descendants refuse, out-of-scope Markdown is empty, and absent graph yields empty LSP output plus `SpecLspAvailabilityStatusV1`.

## TASK-11: Evaluate the current read-profile release conjunction

**Status:** Planned
**Estimate:** 2 days
**Owner:** Release maintainer
**Depends On:** TASK-1 through TASK-10, TASK-13
**Refs:** FR-1 through FR-12; NFR-PERF-1, NFR-SIZE-1, NFR-MEM-1, NFR-SEC-1, NFR-REL-1, NFR-PORT-1, NFR-USE-1; CHK-FR1-01 through CHK-FR12-01; CHK-FR9-02, CHK-FR11-02, CHK-FR9-03, CHK-FR10-02, CHK-FR10-03, CHK-FR11-03, CHK-FR3-02
**Done When:** `spec-lsp-read@1` re-hashes evidence documents, proves one eligible/unrevoked kernel-v0.2 baseline, and requires exactly nineteen current bound checks (twelve FR checks plus seven NFR checks); every one-fault manifest fails; CHK-FR12-01 is an absence proof.

## TASK-12: Implement the separately gated step projection

**Status:** Blocked
**Estimate:** 2 days after kernel profile acceptance
**Owner:** LSP + kernel maintainers
**Depends On:** accepted `kernel-step-bindings@1`, TASK-2, TASK-3, TASK-11
**Refs:** FR-7, AC-7.2; CHK-FR7-02; future `spec-lsp-step@1`
**Done When:** A rehashed eligible read result plus candidate/kernel/corpus-bound accepted `spec-kernel:CHK-FR15-01` and local CHK-FR7-02 prove kernel STEP diagnostics and BINDS_STEP navigation map one-to-one; no adapter matcher exists; the separate step-profile eligibility result passes.

## TASK-13: Prove every non-functional release budget

**Status:** Planned
**Estimate:** 2 days
**Owner:** Independent performance, security and release reviewers
**Depends On:** TASK-1 through TASK-10
**Refs:** NFR-PERF-1, NFR-SIZE-1, NFR-MEM-1, NFR-SEC-1, NFR-REL-1, NFR-PORT-1, NFR-USE-1; CHK-FR9-02, CHK-FR11-02, CHK-FR9-03, CHK-FR10-02, CHK-FR10-03, CHK-FR11-03, CHK-FR3-02
**Done When:** Candidate-bound records prove every numeric bound and qualitative invariant on the required real/benchmark fixtures; missing, stale, duplicate or failed NFR records block `spec-lsp-read@1`.

## Task summary

| Task | Status | Owner | Checks |
|---|---|---|---|
| TASK-1 | Planned | OMP adapter maintainer | CHK-FR1-01, CHK-FR2-01 |
| TASK-2 | Planned | LSP maintainer | CHK-FR3-01 |
| TASK-3 | Planned | LSP maintainer | CHK-FR4-01 |
| TASK-4 | Planned | LSP maintainer | CHK-FR5-01 |
| TASK-5 | Planned | LSP maintainer | CHK-FR6-01 |
| TASK-6 | Planned | Release reviewer | CHK-FR7-01, CHK-FR12-01 |
| TASK-7 | Planned | Independent reviewer | CHK-FR8-01 |
| TASK-8 | Planned | Build maintainer | CHK-FR11-01 |
| TASK-9 | Planned | Performance reviewer | CHK-FR9-01 |
| TASK-10 | Planned | Security reviewer | CHK-FR10-01 |
| TASK-11 | Planned | Release maintainer | CHK-FR1-01..CHK-FR12-01 plus all seven NFR-bound checks |
| TASK-12 | Blocked | LSP + kernel maintainers | CHK-FR7-02 after `spec-kernel:CHK-FR15-01` |
| TASK-13 | Planned | Independent performance, security and release reviewers | CHK-FR9-02, CHK-FR11-02, CHK-FR9-03, CHK-FR10-02, CHK-FR10-03, CHK-FR11-03, CHK-FR3-02 |
