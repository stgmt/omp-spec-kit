# Tasks

## Board policy

All tasks are `todo`; the feature state is `NEXT`. Estimates are planning units, not delivery claims. Each task owns concrete checks and may move only through the repository's ordinary task status mechanism; authoring defines no second task lifecycle.

## TASK-1 — Register the two-tool boundary and host path policy — id: TASK-1

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** MCP maintainer
- **Depends on:** Existing MCP server and current-host `tool_call` policy hook
- **Traces:** FR-1; AC-1.1, AC-1.2; CHK-FR1-01, CHK-FR1-02; Scenarios: `SCEN-authoring-two-tool-inventory`, `SCEN-authoring-path-policy-denies-raw-writer`
- **Done When:** Installed tools/list exposes exactly the two public mutation names, internal helpers are absent, and real tool-call tests deny non-allowlisted `.specs/**` writes without blocking unrelated targets.

_Requirements: [FR-1](FR.md#fr-1-two-tool-public-boundary)_

## TASK-2 — Implement canonical operations and pure proposal — id: TASK-2

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Authoring maintainer
- **Depends on:** TASK-1; immutable kernel snapshot/query core
- **Traces:** FR-2; AC-2.1, AC-2.2; CHK-FR2-01, CHK-FR2-02; Scenarios: `SCEN-authoring-proposal-deterministic-no-write`, `SCEN-authoring-invalid-preview-refused`
- **Done When:** Internal helpers normalize to one operation union; equal real-corpus inputs yield equal complete Proposals with zero writes; mixed-spec, duplicate, invalid, and over-bound requests refuse.

_Requirements: [FR-2](FR.md#fr-2-pure-deterministic-proposal)_

## TASK-3 — Compose containment, anchors, and validation — id: TASK-3

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Kernel/security maintainer
- **Depends on:** TASK-2; current kernel validators and anchor inventory
- **Traces:** FR-3; AC-3.1, AC-3.2; CHK-FR3-01, CHK-FR3-02; Scenarios: `SCEN-authoring-containment-refuses-escape`, `SCEN-authoring-result-validation-refuses-drift`
- **Done When:** Real Windows/POSIX path fixtures refuse every named escape/link family before mutation, and planted form/ID/trace/anchor/validator defects return ordered findings with unchanged tree hashes.

_Requirements: [FR-3](FR.md#fr-3-containment-anchors-and-resulting-spec-validation)_

## TASK-4 — Implement CAS apply and concurrency — id: TASK-4

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Concurrency maintainer
- **Depends on:** TASK-2, TASK-3
- **Traces:** FR-4; AC-4.1, AC-4.2; CHK-FR4-01, CHK-FR4-02; Scenarios: `SCEN-authoring-apply-exact-proposal`, `SCEN-authoring-concurrent-apply-conflict`
- **Done When:** Apply accepts only exact Proposal identity plus complete expected hashes; replay is idempotent; real two-process, ABA, path-switch, and lock-timeout tests show one winner and no lost update or automatic rebase.

_Requirements: [FR-4](FR.md#fr-4-exact-proposal-apply-with-cas-and-revalidation)_

## TASK-5 — Implement atomic writer and internal rollback — id: TASK-5

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Filesystem maintainer
- **Depends on:** TASK-4
- **Traces:** FR-5; AC-5.1, AC-5.2; CHK-FR5-01, CHK-FR5-02; Scenarios: `SCEN-authoring-fault-preserves-generation`, `SCEN-authoring-unrecoverable-needs-manual-restore`
- **Done When:** Faults at every stage/sync/swap/cleanup boundary leave a fully hashed old or new generation; coordinated readers never see mixed bytes; the no-survivor fixture stops with `RECOVERY_REQUIRED` and bounded manual restore guidance.

_Requirements: [FR-5](FR.md#fr-5-atomic-one-spec-commit-and-internal-rollback)_

## TASK-6 — Enforce conservation and redacted results — id: TASK-6

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** API/security maintainer
- **Depends on:** TASK-2, TASK-5
- **Traces:** FR-6; AC-6.1, AC-6.2; CHK-FR6-01, CHK-FR6-02; Scenarios: `SCEN-authoring-byte-eol-conservation`, `SCEN-authoring-receipt-redaction`
- **Done When:** Captured byte/EOL fixtures reconcile before/after hashes and planted bodies, secrets, environment values, retained bytes, stack traces, and unrelated absolute paths are absent from every result/error.

_Requirements: [FR-6](FR.md#fr-6-byte-conservation-and-compact-redacted-outcomes)_

## TASK-7 — Capture real fixtures and executable correctness checks — id: TASK-7

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Test maintainer
- **Depends on:** TASK-1–TASK-6
- **Traces:** FR-7; AC-7.1, AC-7.2; CHK-FR7-01, CHK-FR7-02; Scenarios: `SCEN-authoring-real-fixture-provenance`, `SCEN-authoring-protected-check-omissions-fail`
- **Done When:** Provenance-complete real corpus/platform/race/fault captures reconcile with independent hashes, and disabling containment, CAS, validation, anchor closure, rollback, or redaction makes its behavioral check fail without creating a runtime quality gate.

_Requirements: [FR-7](FR.md#fr-7-real-correctness-evidence)_

## Task summary

| Task | Owner | Status | Checks |
|---|---|---|---|
| TASK-1 | MCP maintainer | todo | CHK-FR1-01, CHK-FR1-02 |
| TASK-2 | Authoring maintainer | todo | CHK-FR2-01, CHK-FR2-02 |
| TASK-3 | Kernel/security maintainer | todo | CHK-FR3-01, CHK-FR3-02 |
| TASK-4 | Concurrency maintainer | todo | CHK-FR4-01, CHK-FR4-02 |
| TASK-5 | Filesystem maintainer | todo | CHK-FR5-01, CHK-FR5-02 |
| TASK-6 | API/security maintainer | todo | CHK-FR6-01, CHK-FR6-02 |
| TASK-7 | Test maintainer | todo | CHK-FR7-01, CHK-FR7-02 |
