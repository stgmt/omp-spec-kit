# Requirements

## Delivery status

`spec-authoring-workflow` is `NEXT`. The shipped v0.3.2 product remains the eight-tool read-only baseline; this specification defines future implementation and verification only.

## Functional requirement index

| Qualified ID | Requirement | Priority | Depends on | Acceptance | Scenario |
|---|---|---:|---|---|---|
| `spec-authoring-workflow:FR-1` | Two-tool public boundary and host path policy | P0 | `product:FR-4`, existing MCP server | [AC-1.1–1.2](ACCEPTANCE_CRITERIA.md#ac-11) | `@feature1` |
| `spec-authoring-workflow:FR-2` | Pure deterministic proposal | P0 | FR-1, `spec-kernel` snapshot/query core | [AC-2.1–2.2](ACCEPTANCE_CRITERIA.md#ac-21) | `@feature2` |
| `spec-authoring-workflow:FR-3` | Containment, anchors, and resulting-spec validation | P0 | FR-2, `spec-kernel` validators | [AC-3.1–3.2](ACCEPTANCE_CRITERIA.md#ac-31) | `@feature3` |
| `spec-authoring-workflow:FR-4` | Exact-proposal apply with CAS and revalidation | P0 | FR-2, FR-3 | [AC-4.1–4.2](ACCEPTANCE_CRITERIA.md#ac-41) | `@feature4` |
| `spec-authoring-workflow:FR-5` | Atomic commit and internal rollback | P0 | FR-4 | [AC-5.1–5.2](ACCEPTANCE_CRITERIA.md#ac-51) | `@feature5` |
| `spec-authoring-workflow:FR-6` | Byte conservation and redacted outcomes | P0 | FR-2, FR-5 | [AC-6.1–6.2](ACCEPTANCE_CRITERIA.md#ac-61) | `@feature6` |
| `spec-authoring-workflow:FR-7` | Real correctness evidence | P0 | FR-1–FR-6 | [AC-7.1–7.2](ACCEPTANCE_CRITERIA.md#ac-71) | `@feature7` |

## Invariants

1. Public mutation names are exactly `propose_patch` and `apply_proposed_patch`.
2. Helpers compile internally; apply accepts Proposal identity and hashes, never raw edits.
3. Every request targets exactly one ordinary contained spec.
4. Proposal is pure and complete; a truncated preview is not valid.
5. Apply re-resolves, CAS-checks, rebuilds, and revalidates under the lock without automatic rebase.
6. Commit visibility is one complete old or new generation.
7. Internal rollback never invents replacement bytes; unrecoverable state stops at manual VCS/backup restore.
8. Untouched bytes/EOLs and changed after-hashes are conserved.
9. Receipts are compact and redacted; no authoring-owned ledger or durable review lifecycle exists.
10. Quality checks produce verification evidence only; they do not govern runtime availability.

## Verification matrix

| CHK-ID | Requirement | Traces To | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | FR-1 | FR-1, AC-1.1, @feature1 | Integration test | Draft | SCEN-authoring-two-tool-inventory; TASK-1 |
| CHK-FR1-02 | FR-1 | FR-1, AC-1.2, @feature1 | Integration test | Draft | SCEN-authoring-path-policy-denies-raw-writer; TASK-1 |
| CHK-FR2-01 | FR-2 | FR-2, AC-2.1, @feature2 | BDD scenario | Draft | SCEN-authoring-proposal-deterministic-no-write; TASK-2 |
| CHK-FR2-02 | FR-2 | FR-2, AC-2.2, @feature2 | Unit test | Draft | SCEN-authoring-invalid-preview-refused; TASK-2 |
| CHK-FR3-01 | FR-3 | FR-3, AC-3.1, @feature3 | Integration test | Draft | SCEN-authoring-containment-refuses-escape; TASK-3 |
| CHK-FR3-02 | FR-3 | FR-3, AC-3.2, @feature3 | Integration test | Draft | SCEN-authoring-result-validation-refuses-drift; TASK-3 |
| CHK-FR4-01 | FR-4 | FR-4, AC-4.1, @feature4 | Integration test | Draft | SCEN-authoring-apply-exact-proposal; TASK-4 |
| CHK-FR4-02 | FR-4 | FR-4, AC-4.2, @feature4 | Integration test | Draft | SCEN-authoring-concurrent-apply-conflict; TASK-4 |
| CHK-FR5-01 | FR-5 | FR-5, AC-5.1, @feature5 | Integration test | Draft | SCEN-authoring-fault-preserves-generation; TASK-5 |
| CHK-FR5-02 | FR-5 | FR-5, AC-5.2, @feature5 | Manual review | Draft | SCEN-authoring-unrecoverable-needs-manual-restore; TASK-5 |
| CHK-FR6-01 | FR-6 | FR-6, AC-6.1, @feature6 | Integration test | Draft | SCEN-authoring-byte-eol-conservation; TASK-6 |
| CHK-FR6-02 | FR-6 | FR-6, AC-6.2, @feature6 | Unit test | Draft | SCEN-authoring-receipt-redaction; TASK-6 |
| CHK-FR7-01 | FR-7 | FR-7, AC-7.1, @feature7 | Manual review | Draft | SCEN-authoring-real-fixture-provenance; TASK-7 |
| CHK-FR7-02 | FR-7 | FR-7, AC-7.2, @feature7 | Unit test | Draft | SCEN-authoring-protected-check-omissions-fail; TASK-7 |
## Non-functional ownership

| NFR | Check | Task |
|---|---|---|
| [NFR-SAFETY-1](NFR.md#nfr-safety-1-fail-closed) | CHK-FR5-02 | TASK-5 |
| [NFR-DURABILITY-1](NFR.md#nfr-durability-1-atomic-visibility) | CHK-FR5-01 | TASK-5 |
| [NFR-DETERMINISM-1](NFR.md#nfr-determinism-1-stable-proposal-identity) | CHK-FR2-01 | TASK-2 |
| [NFR-CONCURRENCY-1](NFR.md#nfr-concurrency-1-bounded-locking) | CHK-FR4-02 | TASK-4 |
| [NFR-PORTABILITY-1](NFR.md#nfr-portability-1-platform-containment) | CHK-FR3-01 | TASK-3 |
| [NFR-PRIVACY-1](NFR.md#nfr-privacy-1-redaction) | CHK-FR6-02 | TASK-6 |
| [NFR-COMPATIBILITY-1](NFR.md#nfr-compatibility-1-byte-and-eol-conservation) | CHK-FR6-01 | TASK-6 |
| [NFR-PERFORMANCE-1](NFR.md#nfr-performance-1-bounded-work) | CHK-FR2-02 | TASK-2 |
| [NFR-MAINTAINABILITY-1](NFR.md#nfr-maintainability-1-one-core) | CHK-FR1-01 | TASK-1 |

## Assumptions

- The current kernel supplies immutable graph/query data plus canonical form, trace, and anchor validation.
- The first authoring capability supports exactly one spec per Proposal and commit.
- Canonical spec documents remain ordinary unlinked files under one selected repository root.
- VCS or backup is available to an operator for the explicitly unrecoverable storage case.
