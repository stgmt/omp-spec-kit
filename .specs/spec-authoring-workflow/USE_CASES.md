# Use Cases

## UC-1 — Inspect authoring readiness

**Actor:** Release owner or isolated build verifier
**Preconditions:** A built release-candidate artifact, its product revision/artifact-lineage identity, current FR-1..FR-12 and distribution evidence, and two kernel release results exist; authoring actions may still be unregistered in `DEFERRED`.
**Flow:** The actor calls registered `propose_patch` with `mode: "status"`, which invokes the pure eligibility evaluator without registering any other authoring action; the existing extension remains read-only. It reports lifecycle and registration separately; mandatory evidence for every FR-1..FR-12 and current `plugin-distribution:FR-13`; separately identified accepted `spec-kernel:FR-14` results for v0.2/kernel-v0.2 artifact `A` and v0.3/kernel-v0.3 artifact `B` whose parent hash is `A`; shared product revision/artifact lineage; current release-candidate artifact/snapshot/policy/host bindings; mutation-policy decisions; and next action. `A` and `B` may differ when the parent/current link is valid.
**Alternative:** If any envelope is absent, stale, red, ambiguous, revoked, or from another identity, or the kernel evidence is a singleton/unqualified result, duplicate stage, v0.3-for-v0.2 substitution, stale/revoked parent, or mismatched parent/current lineage, state and registration remain `DEFERRED`; a count or partial green set is insufficient, but maintainers may continue internal implementation and evidence production.
**Postcondition:** No authoring action is registered and no repository file is changed.

## UC-2 — Propose a traced multi-document change

**Actor:** Spec author
**Preconditions:** State is at least `ELIGIBLE`; a content-addressed kernel snapshot exists.
**Flow:** The actor submits anchor-addressed edits for one ordinary unlinked spec with expected document hashes. The service resolves the root, validates containment before document-content read, applies edits in memory, validates the resulting snapshot, and returns a bounded unified diff, findings, affected canonical IDs, proposal ID/hash, and expiry.
**Alternative:** Invalid schema, target, anchor, link, or result returns a typed refusal.
**Postcondition:** Target document hashes are unchanged.

## UC-3 — Apply a reviewed proposal

**Actor:** Authorized spec author
**Preconditions:** The caller separately retrieved and explicitly reviewed the complete untruncated proposal ID/hash; the proposal is `REVIEWED` and unexpired; all expected document and base hashes still match.
**Flow:** A prior `apply_spec_transaction` `phase: "review"` call performs only the review transition; a later `phase: "commit"` call maps to `apply_transaction`, which resolves the reviewed proposal without accepting raw edits, acquires the root-scoped mutation lease, revalidates proposal identity and current hashes, stages a full same-spec generation, validates it again, swaps it under the shared snapshot coordinator, emits a redacted audit envelope, and releases the lease.
**Alternative:** Any absent review, raw edits, mismatch, expiry, concurrent lease, validation failure, or write fault activates refusal or rollback.
**Postcondition:** All changed documents are visible at one committed generation or all originals remain visible; the apply call never synthesizes a preview.

## UC-4 — Refuse an unreviewed transaction

**Actor:** Authorized spec author
**Preconditions:** The request supplies raw edits, a merely `VALIDATED` proposal, a truncated preview, a mismatched ID/hash, or an expired proposal.
**Flow:** `apply_spec_transaction` `phase: "commit"` maps to `apply_transaction` and validates the reviewed proposal identity before acquiring mutation-capable state.
**Alternative:** None; the caller must create, fully retrieve, explicitly review, and then apply a fresh proposal.
**Postcondition:** The service returns the applicable proposal error and creates no stage, journal, audit-commit event, or repository change.

## UC-5 — Resolve a concurrent edit

**Actor:** Spec author
**Preconditions:** A proposal was created and another writer committed first.
**Flow:** Apply compares every current document hash with the proposal base. It marks the proposal `STALE`, returns changed targets plus fresh hashes, and requires a new proposal.
**Alternative:** No automatic rebase is performed in the first authoring release.
**Postcondition:** Neither writer's content is overwritten.

## UC-6 — Rename a heading safely

**Actor:** Spec author
**Preconditions:** The authoritative `spec-kernel:FR-13` query covers every heading definition, generated anchor, and link occurrence for the selected immutable unlinked repository snapshot.
**Flow:** A `rename_heading` edit addresses a unique stable heading. The proposal computes the new kernel slug and includes every same-spec inbound rewrite in the same proposal.
**Alternative:** A linked spec directory, duplicate heading, ambiguous/colliding slug, cross-spec inbound link, changed section hash, or incomplete inventory returns a refusal.
**Postcondition:** After separate review and atomic apply, every accepted inbound link resolves.

## UC-7 — Change a task status

**Actor:** Spec author
**Preconditions:** The task has a canonical identity and the expected `TASKS.md` hash matches.
**Flow:** The service checks the transition table and evidence guards and renders only the canonical status field into a read-only proposal. The actor retrieves and reviews that proposal before `apply_spec_transaction` `phase: "commit"` commits it atomically.
**Alternative:** Illegal transition, incomplete trace chain, stale evidence, weak test, concurrent edit, absent review, or raw status edit refuses and preserves the old status.
**Postcondition:** A legal reviewed transition is recorded with previous/new state and evidence references.

## UC-8 — Recover an interrupted commit

**Actor:** Next authoring invocation or startup recovery routine
**Preconditions:** A transaction marker identifies a staged or swapping generation.
**Flow:** Under the exclusive lease, deterministic recovery validates journal hashes and completes the result generation or restores the original generation, then removes transient transaction material only after proof.
**Alternative:** If one complete retained generation survives but cannot be selected automatically, the service returns `RECOVERY_REQUIRED`, blocks reads/writes, and preserves it for the bounded authenticated retained-selection process in UC-11. If the hash-bound assessment proves neither retained generation is complete and valid, the service preserves blocked current bytes, journal/recovery material, and history for the bounded proposal-before-write rebaseline in UC-12; it never guesses.
**Postcondition:** Normal access resumes only after a complete retained generation is proven or an authorized reviewed rebaseline reaches `REBASELINED`.

## UC-9 — Reject an escaping path

**Actor:** Malicious or mistaken caller
**Preconditions:** Request contains traversal, absolute/UNC/device path, unsupported document, normalized collision, or a symlink/junction/mount/reparse component in the root, spec directory, or target chain.
**Flow:** Shared kernel/authoring containment rejects the request before document-content read, proposal construction, or mutation. Linked spec directories have no read-only or mutation exception.
**Postcondition:** No target, proposal, or transaction material is created and the response names the rejected request-related component without exposing unrelated filesystem data.

## UC-10 — Gate an authoring release with mutation testing

**Actor:** Release owner
**Preconditions:** Runtime implementation and behavioral scenarios exist.
**Flow:** CI runs the chosen mutation engine over the enumerated safety-critical modules, reconciles actual mutants with the required family inventory, and requires all critical mutants killed.
**Alternative:** Missing coverage, timeout, engine error, skipped mutant, or survivor blocks release rather than being counted as success.
**Postcondition:** Evidence identifies artifact version, test run, mutant set, outcomes, and policy version.

## UC-11 — Manually resolve RECOVERY_REQUIRED

**Actor:** Authenticated recovery operator
**Preconditions:** A blocked transaction retains a provable complete original or result generation and hashes; the host issued an unexpired authorization bound to the actor, transaction, root, recovery mode `retained`, one selected generation, and at most 15 canonical documents.
**Flow:** The operator calls `apply_spec_transaction` with `phase: "recover-retained"`; the facade submits `recover_transaction` with no replacement bytes, selecting `original` or `result` and its complete snapshot/document hash inventory. Under the exclusive lease the service matches retained bytes, reruns containment and every mandatory validator, audits the action, and transitions through `RECOVERING` to `ROLLED_BACK` or `COMMITTED`.
**Alternative:** Missing/expired/mismatched authorization, over-bound or partial/mixed/unknown hashes, replacement bytes, containment failure, or validation failure returns a typed refusal, retains all recovery material, and returns to `RECOVERY_REQUIRED`. If neither retained generation is complete and valid, `recover_transaction` refuses and directs the operator to UC-12.
**Postcondition:** Normal reads/writes resume only for a proven selected complete generation; every failed request stays fail closed.

## UC-12 — Rebaseline when no retained generation survives

**Actor:** Authenticated recovery operator
**Preconditions:** The transaction is `RECOVERY_REQUIRED`; a hash-bound retained assessment proves neither original nor result is complete and valid, while corrupt or incomplete retained directories may still exist and their path presence is not disqualifying; the host issued an unexpired authorization bound to actor, transaction, canonical root, target spec, recovery mode `rebaseline`, an ordinary unlinked root-contained `recovery-candidates/<candidate-id>/<spec-slug>` source, complete candidate inventory, expected blocked-current snapshot/document hashes, retained journal or canonical missing-marker hash, retained-assessment hash, at most 15 documents, and expiry.
**Flow:** The operator calls `propose_patch` with `mode: "rebaseline-recovery"`, which maps to `propose_rebaseline_recovery`. Under the exclusive lease the service rechecks authorization and all current/journal/candidate hashes, containment, link closure, and mandatory validation, writes nothing, and returns a complete pre/post hash proposal. After `apply_spec_transaction` `phase: "review"` records the separate full-preview review, a later `phase: "commit-rebaseline"` maps to `apply_rebaseline_recovery` and reacquires the lease, repeats every identity and validation check, atomically installs exactly the proposed complete generation, appends a redacted audit event, preserves the failed transaction/journal/recovery history, and transitions `RECOVERY_REQUIRED→REBASELINING→REBASELINED`.
**Alternative:** If either retained original or retained result is complete and valid, retained recovery remains mandatory and rebaseline is forbidden. Any authorization, proposal, current/journal/candidate hash, traversal/link/reparse, link-closure, validation, audit-chain, or lease/concurrency failure returns a typed refusal, exposes no candidate bytes or path, erases no current/recovery/candidate/history bytes, and remains `RECOVERY_REQUIRED`.
**Postcondition:** Normal access resumes only at `REBASELINED` with complete pre/post hashes and history-preserving audit proof; otherwise it stays blocked.
