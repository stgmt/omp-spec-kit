# Requirements

## Delivery status

All requirements are **planned** and the authoring lifecycle/registration is `DEFERRED`; no implementation or execution is claimed here. Schema, service, fixture, recovery, evaluator, and test implementation may proceed and create candidate-bound evidence while actions remain unregistered. FR-13 gates registration/release eligibility, not implementation start.

## Functional requirement index

| Qualified ID | Requirement | Priority | Depends on | Acceptance | Scenario |
|---|---|---:|---|---|---|
| `spec-authoring-workflow:FR-1` | Deferred registration with implementation/evidence permitted | P0 | `spec-kernel:FR-14`, `plugin-distribution:FR-13` | [AC-1.1–1.4](ACCEPTANCE_CRITERIA.md#ac-11) | `@feature1` |
| `spec-authoring-workflow:FR-2` | Proposal, explicit review, and bounded diff preview | P0 | FR-1 | [AC-2.1–2.4](ACCEPTANCE_CRITERIA.md#ac-21) | `@feature2` |
| `spec-authoring-workflow:FR-3` | Expected-hash CAS and concurrency | P0 | FR-2 | [AC-3.1–3.3](ACCEPTANCE_CRITERIA.md#ac-31) | `@feature3` |
| `spec-authoring-workflow:FR-4` | Validation before write | P0 | FR-2, `spec-kernel:FR-6` | [AC-4.1–4.3](ACCEPTANCE_CRITERIA.md#ac-41) | `@feature4` |
| `spec-authoring-workflow:FR-5` | Root containment and linked-path refusal | P0 | FR-1, `spec-kernel:FR-14` | [AC-5.1–5.4](ACCEPTANCE_CRITERIA.md#ac-51) | `@feature5` |
| `spec-authoring-workflow:FR-6` | Reviewed atomic transaction, retained recovery, and no-survivor rebaseline | P0 | FR-2, FR-3, FR-4, FR-5 | [AC-6.1–6.8](ACCEPTANCE_CRITERIA.md#ac-61) | `@feature6` |
| `spec-authoring-workflow:FR-7` | Anchor-safe edits from complete kernel inventory | P0 | FR-2, FR-4, `spec-kernel:FR-13` | [AC-7.1–7.3](ACCEPTANCE_CRITERIA.md#ac-71) | `@feature7` |
| `spec-authoring-workflow:FR-8` | Guarded task/status lifecycle | P1 | FR-2, FR-6, `spec-kernel:FR-6` | [AC-8.1–8.5](ACCEPTANCE_CRITERIA.md#ac-81) | `@feature8` |
| `spec-authoring-workflow:FR-9` | Provenance and audit evidence | P1 | FR-6 | [AC-9.1–9.3](ACCEPTANCE_CRITERIA.md#ac-91) | `@feature9` |
| `spec-authoring-workflow:FR-10` | Typed request/result/error contract | P0 | FR-2–FR-9 | [AC-10.1–10.3](ACCEPTANCE_CRITERIA.md#ac-101) | `@feature10` |
| `spec-authoring-workflow:FR-11` | Mutation-resistance release gate | P0 | FR-1–FR-10 | [AC-11.1–11.4](ACCEPTANCE_CRITERIA.md#ac-111) | `@feature11` |
| `spec-authoring-workflow:FR-12` | No bypass, hidden state, or dev-pomogator integration | P0 | FR-1, FR-2, FR-6 | [AC-12.1–12.3](ACCEPTANCE_CRITERIA.md#ac-121) | `@feature12` |
| `spec-authoring-workflow:FR-13` | Aggregate registration/release eligibility with distinct linked v0.2/v0.3 kernel profiles | P0 | FR-1–FR-12, `spec-kernel:FR-14` `targetStage: "v0.2"`, `spec-kernel:FR-14` `targetStage: "v0.3"`, `plugin-distribution:FR-13` | [AC-13.1–13.3](ACCEPTANCE_CRITERIA.md#ac-131) | `@feature13` |
| `spec-authoring-workflow:FR-14` | Generator-port mutation names as MCP v1 or later v2 | P0 | FR-10, FR-13, `docs/decisions/spec-generator-port.md` | [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141) | `@feature14` |

## Requirement invariants

1. While lifecycle is `DEFERRED`, implementation and isolated evidence production are permitted, but no authoring action may register or be exposed and no user specification may be mutated.
2. Proposal generation is read-only; review is an explicit separate transition; neither `apply_transaction` nor `apply_rebaseline_recovery` can accept raw edits or create and commit a preview in one call.
3. Every normal apply names one reviewed, unexpired proposal and current expected hashes for every target document and base snapshot.
4. Validation evaluates the in-memory resulting generation before staging and again before commit.
5. Every transaction targets exactly one ordinary, unlinked specification directory and exposes all-or-none state to coordinated readers.
6. Any stale hash, invalid anchor, validation error, containment failure, symlink/reparse component, or unresolved recovery state blocks mutation; linked spec directories and linked/reparse rebaseline candidate directories are unsupported.
7. `RECOVERY_REQUIRED` exits through deterministic/authorized retained-generation recovery when a complete retained original or result exists; only a hash-bound no-survivor assessment admits authenticated root-contained proposal-before-write rebaseline with expected current/journal/candidate hashes, separate review, full validation, atomic install, and append-only audit proof.
8. Any rebaseline authorization, proposal, hash, leak/link, validation, audit-history, or concurrency error remains `RECOVERY_REQUIRED`, exposes no candidate bytes/path, and erases no blocked-current, journal, recovery, candidate, or history bytes.
9. Task status is derived through guarded proposal/review/apply transitions; textual edits cannot bypass the state machine.
10. Success, refusal, review, rollback, retained recovery, and rebaseline produce redacted audit evidence.
11. FR-13 is an all-of registration/release gate over every mandatory FR-1..FR-12 envelope, one current distribution aggregate, and exactly two separately identified accepted kernel aggregates: v0.2 artifact `A` and v0.3 artifact `B` whose declared v0.2 parent is `A`. The linked hashes may differ, but an unqualified/duplicate-stage set, v0.3-for-v0.2 substitution, stale/revoked v0.2 result, non-eligible result, or parent mismatch is insufficient; this remains a release-registration gate, not a task-start gate.
12. Authoring eligibility does not independently authorize package publication; remaining public-init validation and fail-closed provenance/license checks for future or changed imports remain dependency-owned through `plugin-distribution:FR-13`.
13. No scenario text in this specification is executed evidence.
14. Runtime canonical identities are `<spec-slug>:<local-id>`; file-local anchors remain unqualified.
15. The agent-facing authoring API is MCP. Seventeen v1 facade names compile to the exact mapping table; each apply facade has one review-only call before a later commit-only call; seven v2 names are absent from v1 dispatch and listed in `unsupportedLaterNames`; `authoring-mcp@1` requires accepted FR-13 plus CHK-FR14-01.

## Verification matrix

| Check | Requirement | Trace | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | FR-1 | FR-1, AC-1.1, AC-1.2, AC-1.3, AC-1.4, `SCEN-authoring-deferred-missing-proof`, `SCEN-authoring-all-of-eligibility`, `SCEN-authoring-second-authority-refused`, `SCEN-authoring-implementation-while-deferred` | Integration test | Draft | Owner: TASK-1; deferred state permits isolated implementation but keeps MCP authoring unregistered and user bytes unchanged. |
| CHK-FR2-01 | FR-2 | FR-2, AC-2.1, AC-2.2, AC-2.3, AC-2.4, `SCEN-proposal-preview-no-write`, `SCEN-invalid-proposal-before-stage`, `SCEN-concurrent-proposals-read-only`, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused` | Integration test | Draft | Owner: TASK-4; deterministic complete proposal plus review-only and later commit-only apply calls. |
| CHK-FR2-02 | FR-2 | FR-2, AC-2.1, `@feature2`, NFR-DETERMINISM-1 | Integration test | Draft | Owner: TASK-2; canonical requests yield identical proposal/full-preview hashes and ordering. |
| CHK-FR2-03 | FR-2 | FR-2, AC-2.2, `@feature2`, NFR-PERFORMANCE-1 | Integration test | Draft | Owner: TASK-4; every document/operation/diff/finding bound reports exact excess and blocks review. |
| CHK-FR3-01 | FR-3 | FR-3, AC-3.1, AC-3.2, AC-3.3, `SCEN-concurrent-fresh-applies`, `SCEN-second-cas-detects-change`, `SCEN-terminal-request-replay` | Integration test | Draft | Owner: TASK-6; racing reviewed commits yield one winner and one stale/busy refusal without loss. |
| CHK-FR3-02 | FR-3 | FR-3, AC-3.2, `@feature3`, NFR-CONCURRENCY-1 | Integration test | Draft | Owner: TASK-6; lease timeout, liveness, reader visibility, replay and crash races are bounded. |
| CHK-FR4-01 | FR-4 | FR-4, AC-4.1, AC-4.2, AC-4.3, `SCEN-invalid-proposal-before-stage`, `SCEN-second-cas-detects-change`, `SCEN-validator-unavailable-fails-closed` | Integration test | Draft | Owner: TASK-4; planted form/anchor/trace error refuses before stage creation. |
| CHK-FR5-01 | FR-5 | FR-5, AC-5.1, AC-5.2, AC-5.3, AC-5.4, `SCEN-canonical-target-confined`, `SCEN-escaping-target-refused`, `SCEN-linked-spec-directory-unsupported`, `SCEN-path-component-switch-refused` | Integration test | Draft | Owner: TASK-3; traversal, absolute/UNC/device, collision and linked/reparse fixtures refuse before read. |
| CHK-FR5-02 | FR-5 | FR-5, AC-5.4, `@feature5`, NFR-PORTABILITY-1 | Integration test | Draft | Owner: TASK-3; Windows and POSIX containment/durability support is explicit and fail-closed. |
| CHK-FR6-01 | FR-6 | FR-6, AC-6.1, AC-6.2, AC-6.3, AC-6.4, AC-6.5, AC-6.6, AC-6.7, AC-6.8, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-atomic-visible-generation`, `SCEN-transaction-fault-complete-generation`, `SCEN-interrupted-commit-auto-recovery`, `SCEN-invalid-transaction-shape-refused`, `SCEN-manual-recovery-selects-complete-generation`, `SCEN-manual-recovery-invalid-selection-refused`, `SCEN-rebaseline-recovery-proposal-no-write`, `SCEN-rebaseline-recovery-atomic-or-refused` | Integration test | Draft | Owner: TASK-7; fault injection preserves one visible generation or blocks recovery/rebaseline without history erasure. |
| CHK-FR6-02 | FR-6 | FR-6, AC-6.4, `@feature6`, NFR-SAFETY-1 | Integration test | Draft | Owner: TASK-7; every uncertain identity/authorization/validation branch refuses and conserves blocked bytes. |
| CHK-FR6-03 | FR-6 | FR-6, AC-6.2, `@feature6`, NFR-DURABILITY-1 | Integration test | Draft | Owner: TASK-7; file/directory synchronization and generation visibility are proven per supported platform. |
| CHK-FR7-01 | FR-7 | FR-7, AC-7.1, AC-7.2, AC-7.3, `SCEN-section-edit-preserves-bytes`, `SCEN-heading-rename-rewrites-inbound-links`, `SCEN-heading-rename-ambiguity-refused` | Integration test | Draft | Owner: TASK-5; all seven edit operations preserve bytes/EOL and complete anchor/link closure. |
| CHK-FR7-02 | FR-7 | FR-7, AC-7.2, `@feature7`, NFR-COMPATIBILITY-1 | Integration test | Draft | Owner: TASK-5; untouched bytes, EOL/final-newline policy and incompatible-version refusals are exact. |
| CHK-FR8-01 | FR-8 | FR-8, AC-8.1, AC-8.2, AC-8.3, AC-8.4, AC-8.5, `SCEN-legal-task-status-transitions`, `SCEN-illegal-status-transition-refused`, `SCEN-status-guard-failure-refused`, `SCEN-concurrent-status-change-refused`, `SCEN-done-task-explicit-reopen` | Integration test | Draft | Owner: TASK-8; exhaustive task transitions and evidence guards require proposal review before commit. |
| CHK-FR9-01 | FR-9 | FR-9, AC-9.1, AC-9.2, AC-9.3, `SCEN-redacted-audit-every-outcome`, `SCEN-audit-digest-chain-order`, `SCEN-audit-sink-failure-boundary`, `SCEN-rebaseline-recovery-atomic-or-refused` | Integration test | Draft | Owner: TASK-9; audit envelopes reconcile hashes and contain no document body or secret. |
| CHK-FR9-02 | FR-9 | FR-9, AC-9.2, `@feature9`, NFR-PRIVACY-1 | Integration test | Draft | Owner: TASK-9; responses/audits exclude every forbidden credential/content/path/recovery field. |
| CHK-FR9-03 | FR-9 | FR-9, AC-9.3, `@feature9`, NFR-OBSERVABILITY-1 | Integration test | Draft | Owner: TASK-9; identifiers/hashes/next actions reconcile with no hidden repository state. |
| CHK-FR10-01 | FR-10 | FR-10, AC-10.1, AC-10.2, AC-10.3, `SCEN-closed-contract-unknown-input`, `SCEN-internal-error-redaction`, `SCEN-adapters-share-authority` | Integration test | Draft | Owner: TASK-2; every request/result/error/state and apply-facade phase round-trips through the closed schema. |
| CHK-FR11-01 | FR-11 | FR-11, AC-11.1, AC-11.2, AC-11.3, AC-11.4, `SCEN-critical-mutants-killed`, `SCEN-critical-mutant-or-policy-blocks` | Integration test | Draft | Owner: TASK-12; every critical mutant family is present and 100% killed; missing/timeout/error blocks. |
| CHK-FR11-02 | FR-11 | FR-11, AC-11.3, `@feature11`, NFR-TESTING-1 | Integration test | Draft | Owner: TASK-11 and TASK-12; real behavioral fixtures reject source-text/mock/zero-scenario false proof. |
| CHK-FR12-01 | FR-12 | FR-12, AC-12.1, AC-12.2, AC-12.3, `SCEN-authoring-all-of-eligibility`, `SCEN-excluded-integration-blocks`, `SCEN-deferred-uninstall-preserves-specs` | Integration test | Draft | Owner: TASK-10; package/runtime inventory has one MCP authoring authority, read-only extension and no excluded bypass. |
| CHK-FR12-02 | FR-12 | FR-12, AC-12.2, `@feature12`, NFR-MAINTAINABILITY-1 | Manual review | Draft | Owner: TASK-10; one schema/validator/root/transaction/status implementation has no shim or duplicate adapter. |
| CHK-FR13-01 | FR-13 | FR-13, AC-13.1, AC-13.2, AC-13.3, `SCEN-authoring-deferred-missing-proof`, `SCEN-authoring-all-of-eligibility`, `SCEN-aggregate-partial-proof-refused`, `SCEN-authoring-implementation-while-deferred` | Integration test | Draft | Owner: TASK-1; removing/substituting/staling any mandatory envelope keeps MCP authoring unregistered. |
| CHK-FR13-02 | FR-13 | FR-13, AC-13.3, `@feature13`, NFR-READINESS-1 | Integration test | Draft | Owner: TASK-1 and TASK-13; status separates DEFERRED/ELIGIBLE/IMPLEMENTED/PROVEN and exact artifact/evidence identities. |
| CHK-FR14-01 | FR-14 | FR-14, AC-14.1, `SCEN-generator-port-mutation-names` | Integration test | Draft | Owner: TASK-14; exact 17-name registry/mappings, two-call apply phases, seven manifest-only later names, build inclusion and no historical-v0.3 names. |

## Non-functional ownership

| NFR | Check | Task |
|---|---|---|
| [NFR-SAFETY-1](NFR.md#nfr-safety-1-safety-and-fail-closed-behavior) | CHK-FR6-02 | TASK-7 |
| [NFR-DURABILITY-1](NFR.md#nfr-durability-1-atomicity-and-durability) | CHK-FR6-03 | TASK-7 |
| [NFR-DETERMINISM-1](NFR.md#nfr-determinism-1-determinism) | CHK-FR2-02 | TASK-2 |
| [NFR-CONCURRENCY-1](NFR.md#nfr-concurrency-1-concurrency-and-bounded-waiting) | CHK-FR3-02 | TASK-6 |
| [NFR-PERFORMANCE-1](NFR.md#nfr-performance-1-performance-and-resource-bounds) | CHK-FR2-03 | TASK-4 |
| [NFR-PORTABILITY-1](NFR.md#nfr-portability-1-portability) | CHK-FR5-02 | TASK-3 |
| [NFR-PRIVACY-1](NFR.md#nfr-privacy-1-privacy-and-redaction) | CHK-FR9-02 | TASK-9 |
| [NFR-COMPATIBILITY-1](NFR.md#nfr-compatibility-1-compatibility-and-byte-conservation) | CHK-FR7-02 | TASK-5 |
| [NFR-OBSERVABILITY-1](NFR.md#nfr-observability-1-observability-without-hidden-state) | CHK-FR9-03 | TASK-9 |
| [NFR-TESTING-1](NFR.md#nfr-testing-1-test-strength) | CHK-FR11-02 | TASK-11, TASK-12 |
| [NFR-MAINTAINABILITY-1](NFR.md#nfr-maintainability-1-maintainability) | CHK-FR12-02 | TASK-10 |
| [NFR-READINESS-1](NFR.md#nfr-readiness-1-honest-readiness) | CHK-FR13-02 | TASK-1, TASK-13 |

## Assumptions

- The kernel exposes immutable, content-addressed snapshots, the complete FR-13 heading/anchor/link-occurrence query, and shared/exclusive snapshot coordination before authoring is implemented.
- The first mutation release supports one specification per transaction; cross-spec atomic mutation is explicitly unsupported.
- The repository uses the canonical 15-document set defined by the product specs.
- Selected repository and spec directory paths are ordinary unlinked paths; kernel containment rejects links before document reads and authoring applies the same policy.
- Callers provide an authenticated actor identity and non-empty reason; retained recovery and no-survivor rebaseline additionally require host-issued transaction/root/candidate/hash-bound authorizations. Rebaseline candidates are operator-provided under the fixed ordinary unlinked root-contained directory grammar and requests never embed their bytes.
