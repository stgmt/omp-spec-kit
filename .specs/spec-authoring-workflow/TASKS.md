# Tasks

## Board policy

Every task is **Status: todo**. The product lifecycle and action registration remain `DEFERRED`, but implementation and isolated evidence work MAY begin in the acyclic dependency order below; FR-13 gates registration/release eligibility, not task start. Estimates are planning units, not completion claims. Owner names are accountable roles.

## TASK-1 — Authoring eligibility evaluator — id: TASK-1

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** Plugin maintainer
- **Depends on:** TASK-2; versioned evidence-envelope contract; current `plugin-distribution:FR-13`; separate accepted `spec-kernel:FR-14` v0.2 and v0.3 profile results
- **Traces:** FR-1, FR-12, FR-13; AC-1.1–1.4, AC-12.1, AC-13.1–13.3; CHK-FR1-01, CHK-FR13-01, CHK-FR13-02; Scenarios: `SCEN-authoring-deferred-missing-proof`, `SCEN-authoring-all-of-eligibility`, `SCEN-authoring-second-authority-refused`, `SCEN-authoring-implementation-while-deferred`, `SCEN-excluded-integration-blocks`, `SCEN-deferred-uninstall-preserves-specs`, `SCEN-aggregate-partial-proof-refused`
- **Done When:** The pure evaluator runs while lifecycle remains `DEFERRED`, reports all four lifecycle states from versioned evidence, and reaches `ELIGIBLE` only with all FR-1..FR-12/current-distribution evidence plus exactly one accepted v0.2 kernel result and one accepted v0.3 result whose parent hash equals the v0.2 artifact hash. It permits legitimate different predecessor/current hashes within one product revision/artifact lineage, keeps actions unregistered when any mandatory envelope is removed, and rejects any-of/count-only evidence, an unqualified singleton, duplicate stages, v0.3-for-v0.2 substitution, stale/revoked/non-eligible parent, wrong lineage, and a planted duplicate plugin/extension.

## TASK-2 — Contract schema and canonical hashing — id: TASK-2

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Kernel/API maintainer
- **Depends on:** None
- **Traces:** FR-2, FR-3, FR-6, FR-10, FR-13; AC-2.1–2.4, AC-3.1, AC-6.5–6.8, AC-10.1–10.3, AC-13.1–13.3; CHK-FR2-02, CHK-FR2-03, CHK-FR10-01; Scenarios: `SCEN-proposal-preview-no-write`, `SCEN-invalid-proposal-before-stage`, `SCEN-concurrent-proposals-read-only`, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-concurrent-fresh-applies`, `SCEN-second-cas-detects-change`, `SCEN-terminal-request-replay`, `SCEN-atomic-visible-generation`, `SCEN-transaction-fault-complete-generation`, `SCEN-interrupted-commit-auto-recovery`, `SCEN-invalid-transaction-shape-refused`, `SCEN-manual-recovery-selects-complete-generation`, `SCEN-manual-recovery-invalid-selection-refused`, `SCEN-rebaseline-recovery-proposal-no-write`, `SCEN-rebaseline-recovery-atomic-or-refused`, `SCEN-closed-contract-unknown-input`, `SCEN-internal-error-redaction`, `SCEN-adapters-share-authority`, `SCEN-authoring-deferred-missing-proof`, `SCEN-authoring-all-of-eligibility`, `SCEN-aggregate-partial-proof-refused`, `SCEN-authoring-implementation-while-deferred`
- **Done When:** Every request/result/error/state enum validates and round-trips; `MandatoryEvidenceEnvelope`, the exact fifteen-entry result multiset, separately identified v0.2/v0.3 kernel projection, and target-stage-specific `UnsatisfiedEvidence` errors round-trip without collapsing linked predecessor/current hashes. Canonical proposal/request hashes remain deterministic; normal review/apply, retained `recover_transaction`, and no-survivor `propose_rebaseline_recovery`/`apply_rebaseline_recovery` are closed unions; raw bytes, unauthenticated overwrite, unknown fields, incompatible versions, unqualified/duplicate kernel stages, v0.3 substitution, stale/revoked parent, and parent/lineage mismatch fail closed.

## TASK-3 — Root containment and reparse defense — id: TASK-3

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Security maintainer
- **Depends on:** TASK-2
- **Traces:** FR-5, FR-6; AC-5.1–5.4, AC-6.7–6.8; CHK-FR5-01, CHK-FR5-02; Scenarios: `SCEN-canonical-target-confined`, `SCEN-escaping-target-refused`, `SCEN-linked-spec-directory-unsupported`, `SCEN-path-component-switch-refused`, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-atomic-visible-generation`, `SCEN-transaction-fault-complete-generation`, `SCEN-interrupted-commit-auto-recovery`, `SCEN-invalid-transaction-shape-refused`, `SCEN-manual-recovery-selects-complete-generation`, `SCEN-manual-recovery-invalid-selection-refused`, `SCEN-rebaseline-recovery-proposal-no-write`, `SCEN-rebaseline-recovery-atomic-or-refused`
- **Done When:** Real Windows and POSIX fixtures reject every named escape/collision/link family before document-content read for kernel, authoring targets, and rebaseline candidates; concurrent component switching is detected; only ordinary unlinked canonical targets and fixed-grammar root-contained candidate sources may proceed.

## TASK-4 — Proposal and preview service — id: TASK-4

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Authoring service maintainer
- **Depends on:** TASK-2, TASK-3, kernel snapshots and `spec-kernel:FR-13` inventory proven
- **Traces:** FR-2, FR-4, FR-6, FR-7; AC-2.1–2.4, AC-4.1–4.3, AC-6.7, AC-7.1; CHK-FR2-01, CHK-FR2-03, CHK-FR4-01; Scenarios: `SCEN-proposal-preview-no-write`, `SCEN-invalid-proposal-before-stage`, `SCEN-concurrent-proposals-read-only`, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-second-cas-detects-change`, `SCEN-validator-unavailable-fails-closed`, `SCEN-atomic-visible-generation`, `SCEN-transaction-fault-complete-generation`, `SCEN-interrupted-commit-auto-recovery`, `SCEN-invalid-transaction-shape-refused`, `SCEN-manual-recovery-selects-complete-generation`, `SCEN-manual-recovery-invalid-selection-refused`, `SCEN-rebaseline-recovery-proposal-no-write`, `SCEN-rebaseline-recovery-atomic-or-refused`, `SCEN-section-edit-preserves-bytes`, `SCEN-heading-rename-rewrites-inbound-links`, `SCEN-heading-rename-ambiguity-refused`
- **Done When:** Valid normal edits and no-survivor candidates yield deterministic bounded complete diffs/findings/pre/post/current/journal/candidate hashes from one immutable snapshot with zero target writes; explicit review binds the full preview hash; invalid, unavailable-validator, truncated-preview, and same-call apply paths refuse.

## TASK-5 — Anchor-aware edit expansion — id: TASK-5

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Markdown/kernel maintainer
- **Depends on:** TASK-4, `spec-kernel:FR-13`
- **Traces:** FR-7; AC-7.1–7.3; CHK-FR7-01, CHK-FR7-02; Scenarios: `SCEN-section-edit-preserves-bytes`, `SCEN-heading-rename-rewrites-inbound-links`, `SCEN-heading-rename-ambiguity-refused`
- **Done When:** All seven edit operations preserve untouched bytes/EOL; the authoritative complete heading/anchor/link-occurrence query expands every same-spec rename rewrite; linked, ambiguous, external, colliding, drifted, incomplete, and rollback paths are proven.

## TASK-6 — Root lease, CAS, and idempotency — id: TASK-6

- **Status:** todo
- **Estimate:** 5 engineering days
- **Owner:** Concurrency maintainer
- **Depends on:** TASK-2, TASK-3
- **Traces:** FR-3, NFR-CONCURRENCY-1; AC-3.1–3.3; CHK-FR3-01, CHK-FR3-02; Scenarios: `SCEN-concurrent-fresh-applies`, `SCEN-second-cas-detects-change`, `SCEN-terminal-request-replay`
- **Done When:** Two-writer, ABA, lease-timeout, owner-liveness, replay, and request-ID-reuse behaviors match the contract without a lost update or duplicate commit.

## TASK-7 — Atomic generation writer and recovery — id: TASK-7

- **Status:** todo
- **Estimate:** 7 engineering days
- **Owner:** Filesystem maintainer
- **Depends on:** TASK-4, TASK-5, TASK-6
- **Traces:** FR-2, FR-6; AC-2.4, AC-6.1–6.8; CHK-FR6-01, CHK-FR6-02, CHK-FR6-03; Scenarios: `SCEN-proposal-preview-no-write`, `SCEN-invalid-proposal-before-stage`, `SCEN-concurrent-proposals-read-only`, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-atomic-visible-generation`, `SCEN-transaction-fault-complete-generation`, `SCEN-interrupted-commit-auto-recovery`, `SCEN-invalid-transaction-shape-refused`, `SCEN-manual-recovery-selects-complete-generation`, `SCEN-manual-recovery-invalid-selection-refused`, `SCEN-rebaseline-recovery-proposal-no-write`, `SCEN-rebaseline-recovery-atomic-or-refused`
- **Done When:** Only a reviewed unexpired proposal can enter staging; same-spec multi-document success is one visible generation; fault injection at every prepare/sync/swap/audit/cleanup/recovery boundary proves commit or rollback; complete retained original/result selection exits through `RECOVERING`; when neither retained original nor retained result is complete and valid, only an authenticated, hash-bound, root-contained, dry-run-validated and separately reviewed rebaseline exits through `REBASELINING→REBASELINED`; corrupt or incomplete retained directories may remain, while every mismatch/leak/link/validation/concurrency failure remains blocked and no transaction, journal, recovery, candidate, or audit history is erased.

## TASK-8 — Guarded task status reducer — id: TASK-8

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Spec workflow maintainer
- **Depends on:** TASK-4, TASK-7
- **Traces:** FR-2, FR-8; AC-2.4, AC-8.1–8.5; CHK-FR8-01; Scenarios: `SCEN-proposal-preview-no-write`, `SCEN-invalid-proposal-before-stage`, `SCEN-concurrent-proposals-read-only`, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-legal-task-status-transitions`, `SCEN-illegal-status-transition-refused`, `SCEN-status-guard-failure-refused`, `SCEN-concurrent-status-change-refused`, `SCEN-done-task-explicit-reopen`
- **Done When:** Exhaustive legal transitions produce read-only proposals and succeed only after explicit review with guards; illegal/stale/weak/concurrent/faulted paths preserve state; raw status-text and unreviewed apply bypasses are detected.

## TASK-9 — Redacted audit envelopes and sink contract — id: TASK-9

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Security maintainer
- **Depends on:** TASK-2, TASK-7
- **Traces:** FR-6, FR-9; AC-6.5–6.8, AC-9.1–9.3; CHK-FR9-01, CHK-FR9-02, CHK-FR9-03; Scenarios: `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-atomic-visible-generation`, `SCEN-transaction-fault-complete-generation`, `SCEN-interrupted-commit-auto-recovery`, `SCEN-invalid-transaction-shape-refused`, `SCEN-manual-recovery-selects-complete-generation`, `SCEN-manual-recovery-invalid-selection-refused`, `SCEN-rebaseline-recovery-proposal-no-write`, `SCEN-rebaseline-recovery-atomic-or-refused`, `SCEN-redacted-audit-every-outcome`, `SCEN-audit-digest-chain-order`, `SCEN-audit-sink-failure-boundary`
- **Done When:** All terminal/refusal/retained-recovery/rebaseline proposal/review/apply events produce hash-linked redacted envelopes; rebaseline records actor/reason and full fingerprints without candidate path/bytes, preserves failed-transaction history, concurrent order and replay reconcile, and pre/post-commit sink failures have distinct proven outcomes.

## TASK-10 — Shared service packaging and MCP integration — id: TASK-10

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** OMP plugin maintainer
- **Depends on:** TASK-1–TASK-9
- **Traces:** FR-1, FR-2, FR-10, FR-12, FR-13, FR-14; AC-1.3–1.4, AC-2.4, AC-10.3, AC-12.1–12.3, AC-13.1–13.3, AC-14.1; CHK-FR10-01, CHK-FR12-01, CHK-FR12-02, CHK-FR14-01; Scenarios: `SCEN-authoring-deferred-missing-proof`, `SCEN-authoring-all-of-eligibility`, `SCEN-authoring-second-authority-refused`, `SCEN-authoring-implementation-while-deferred`, `SCEN-proposal-preview-no-write`, `SCEN-invalid-proposal-before-stage`, `SCEN-concurrent-proposals-read-only`, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-closed-contract-unknown-input`, `SCEN-internal-error-redaction`, `SCEN-adapters-share-authority`, `SCEN-excluded-integration-blocks`, `SCEN-deferred-uninstall-preserves-specs`, `SCEN-aggregate-partial-proof-refused`, `SCEN-generator-port-mutation-names`
- **Done When:** The root source, build script and generated child package contain the shared authoring service; the MCP server is the only planned authoring adapter and stays unregistered while `DEFERRED`; the existing OMP extension remains read-only; no second authority, raw/same-call apply, excluded integration, hidden target state, unreachable registry or source-checkout dependency exists.

## TASK-11 — Real concurrency, rollback, and platform fixtures — id: TASK-11

- **Status:** todo
- **Estimate:** 5 engineering days
- **Owner:** Test maintainer
- **Depends on:** TASK-3–TASK-9
- **Traces:** FR-2–FR-10; all negative/rollback/concurrency/review/recovery ACs, including AC-6.7–6.8; CHK-FR2-01 through CHK-FR10-01; CHK-FR11-02; Scenarios: `SCEN-proposal-preview-no-write`, `SCEN-invalid-proposal-before-stage`, `SCEN-concurrent-proposals-read-only`, `SCEN-apply-reviewed-proposal`, `SCEN-apply-review-bypass-refused`, `SCEN-concurrent-fresh-applies`, `SCEN-second-cas-detects-change`, `SCEN-terminal-request-replay`, `SCEN-validator-unavailable-fails-closed`, `SCEN-canonical-target-confined`, `SCEN-escaping-target-refused`, `SCEN-linked-spec-directory-unsupported`, `SCEN-path-component-switch-refused`, `SCEN-atomic-visible-generation`, `SCEN-transaction-fault-complete-generation`, `SCEN-interrupted-commit-auto-recovery`, `SCEN-invalid-transaction-shape-refused`, `SCEN-manual-recovery-selects-complete-generation`, `SCEN-manual-recovery-invalid-selection-refused`, `SCEN-rebaseline-recovery-proposal-no-write`, `SCEN-rebaseline-recovery-atomic-or-refused`, `SCEN-section-edit-preserves-bytes`, `SCEN-heading-rename-rewrites-inbound-links`, `SCEN-heading-rename-ambiguity-refused`, `SCEN-legal-task-status-transitions`, `SCEN-illegal-status-transition-refused`, `SCEN-status-guard-failure-refused`, `SCEN-concurrent-status-change-refused`, `SCEN-done-task-explicit-reopen`, `SCEN-redacted-audit-every-outcome`, `SCEN-audit-digest-chain-order`, `SCEN-audit-sink-failure-boundary`, `SCEN-closed-contract-unknown-input`, `SCEN-internal-error-redaction`, `SCEN-adapters-share-authority`
- **Done When:** Provenance-recorded real producer fixtures exercise Windows/POSIX path and linked-directory semantics, simultaneous processes, crash points, authenticated retained recovery, no-survivor rebaseline proposal/apply/refusal, anchor corpus, and task evidence without hand-fabricated producer shapes; installed lifecycle remains TASK-13.

## TASK-12 — Mutation gate calibration and proof — id: TASK-12

- **Status:** todo
- **Estimate:** 5 engineering days after MP-1–MP-4 resolution
- **Owner:** Release owner
- **Depends on:** TASK-10, TASK-11, resolved MP-1–MP-4
- **Traces:** FR-11; AC-11.1–11.4; CHK-FR11-01, CHK-FR11-02; Scenarios: `SCEN-critical-mutants-killed`, `SCEN-critical-mutant-or-policy-blocks`
- **Done When:** Actual mutant inventory reconciles every critical family; 100% are killed with green baseline/restoration; engine/general threshold/timeout/equivalent authority policy is versioned; survivor, missing, timeout, skipped, nondeterministic, and runner-error paths block.

## TASK-13 — Installed lifecycle and uninstall preservation proof — id: TASK-13

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Release owner
- **Depends on:** TASK-10, TASK-11, TASK-12, TASK-14; an `ELIGIBLE` FR-13 verdict; current `plugin-distribution:FR-13`, and current accepted `spec-kernel:FR-14` results separately qualified for v0.2 and v0.3 with a valid parent/current artifact link
- **Traces:** FR-1, FR-12, FR-13, FR-14; AC-1.1–1.4, AC-12.3, AC-13.1–13.3, AC-14.1; CHK-FR1-01, CHK-FR12-01, CHK-FR13-01, CHK-FR13-02, CHK-FR14-01; Scenarios: `SCEN-authoring-deferred-missing-proof`, `SCEN-authoring-all-of-eligibility`, `SCEN-authoring-second-authority-refused`, `SCEN-authoring-implementation-while-deferred`, `SCEN-excluded-integration-blocks`, `SCEN-deferred-uninstall-preserves-specs`, `SCEN-aggregate-partial-proof-refused`, `SCEN-generator-port-mutation-names`
- **Done When:** After FR-13 permits registration from the complete linked v0.2→v0.3 kernel profile pair and all current authoring/distribution evidence, clean project install, reload, fresh-session mutation invocation, dependency isolation, one-version upgrade, uninstall, and user-spec hash preservation are proven for the exact release artifact; lifecycle moves only `ELIGIBLE→IMPLEMENTED→PROVEN`, while any evidence regression, parent revocation, or lineage break unregisters actions and returns it to `DEFERRED`.


## TASK-14 — MCP facade mapping and registry proof — id: TASK-14

- **Status:** todo
- **Estimate:** 4 engineering days
- **Owner:** Authoring + MCP maintainers
- **Depends on:** TASK-10–TASK-12, an `ELIGIBLE` FR-13 verdict
- **Traces:** FR-14; AC-14.1; CHK-FR14-01; `@feature14`; SCEN-generator-port-mutation-names; Scenarios: `SCEN-generator-port-mutation-names`
- **Done When:** Every one of seventeen v1 MCP facades compiles to the exact published proposal/EditOperation mapping; normal/rebaseline commits prove one review-only call then a later matching commit-only call; status/cancel/retained-recovery/rebaseline modes make every closed service request reachable; all seven v2 names are absent from tools/list and tools/call but present in `unsupportedLaterNames`; historical v0.3 contains none; build output and registry/profile proof bind accepted FR-13 and CHK-FR14-01.
