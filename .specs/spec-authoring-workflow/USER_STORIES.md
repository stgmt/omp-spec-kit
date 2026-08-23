# User Stories

## US-1 — Review before mutation

**Priority:** P0
**Why:** A spec author must understand the exact effect of an edit before any repository byte changes.
**Independent Test:** Request a multi-document change and inspect the complete bounded diff, findings, affected nodes, and expected hashes while all document hashes remain unchanged; then prove `apply_transaction` refuses raw edits or the unreviewed proposal and accepts only the separately reviewed exact ID/hash while current hashes match.

**Acceptance scenarios:**

- A valid request yields a proposal and no disk write.
- Explicit review binds an authenticated caller to the complete proposal ID/hash in a separate step.
- Raw, invalid, unreviewed, truncated, expired, or mismatched input yields a named refusal and no transaction material.

## US-2 — Concurrent editing without lost updates

**Priority:** P0
**Why:** Agents and humans may edit the same specification concurrently; silent overwrite would destroy work.
**Independent Test:** Create two proposals from the same snapshot, apply one, and observe deterministic stale-CAS refusal of the other with no partial write.

**Acceptance scenarios:**

- Matching expected hashes permit apply.
- A changed target or transaction lock conflict refuses safely.

## US-3 — Atomic requirement updates

**Priority:** P0
**Why:** An FR change normally spans FR, AC, feature, task, and file-change documents and must never leave a half-updated corpus.
**Independent Test:** Inject a commit failure after staging and prove one complete generation remains; force `RECOVERY_REQUIRED`, then (a) select the complete valid original or result hashes with a bounded host authorization, or (b) prove neither retained original nor retained result is complete and valid even though corrupt or incomplete retained directories may exist, propose a root-contained candidate against exact current/journal hashes, separately review it, and atomically rebaseline. Prove invalid authorization, mixed/stale hashes, link/validation/concurrency failure, or history erasure stays blocked.

**Acceptance scenarios:**

- All reviewed and validated documents become visible together.
- Any staging, commit, audit, or deterministic recovery failure leaves the committed corpus at one complete generation or blocks access in `RECOVERY_REQUIRED`.
- Authenticated retained-generation recovery exposes exactly one retained validated generation.
- When neither retained generation is valid, authenticated proposal-before-write rebaseline installs exactly one fully validated root-contained candidate generation or remains `RECOVERY_REQUIRED` without deleting current bytes, journal, recovery material, candidate source, or history.

## US-4 — Repository owner controls the blast radius

**Priority:** P0
**Why:** Neither kernel reads nor authoring may escape the selected project, follow a link, or access arbitrary files.
**Independent Test:** Exercise traversal, absolute, UNC/device, Unicode/case collision, and symlink/junction/mount/reparse roots, spec directories, and targets and observe refusal before document-content read with zero writes.

**Acceptance scenarios:**

- Canonical supported documents below one ordinary unlinked `.specs/<slug>/` may proceed to later gates.
- Root escapes and linked/reparse paths are unsupported for both reading and mutation and are rejected before content read.

## US-5 — Safe anchor refactoring

**Priority:** P0
**Why:** Renaming a descriptive heading can silently break inbound Markdown links.
**Independent Test:** Query the complete `spec-kernel:FR-13` heading/anchor/link-occurrence inventory, rename a heading with same-spec inbound links, and prove the proposal includes every rewrite; plant an external, linked, ambiguous, or incomplete inventory case and prove refusal.

**Acceptance scenarios:**

- Safe heading changes based on the authoritative kernel inventory preserve link resolution.
- Linked, ambiguous, duplicate, external, colliding, or inventory-incomplete references block apply.

## US-6 — Honest task lifecycle

**Priority:** P1
**Why:** A task must not become in-progress or done merely because text was edited.
**Independent Test:** Attempt every legal and illegal status transition against current trace/evidence guards and prove the resulting status proposal requires separate explicit review before apply.

**Acceptance scenarios:**

- `ready` and `in-progress` require an assembled requirement chain.
- `done` requires current strong evidence; stale, missing, filtered-only, or weak evidence refuses.
- Reopening `done` is explicit and auditable.
- Raw status text and unreviewed status proposals cannot commit.

## US-7 — Auditable, private mutations

**Priority:** P1
**Why:** Maintainers need to reconstruct who proposed and applied a change without leaking document contents or secrets.
**Independent Test:** Apply and refuse operations, then inspect returned audit envelopes for actor, reason, hashes, findings, and transaction identity with no raw document body.

**Acceptance scenarios:**

- Success, refusal, rollback, and recovery all return provenance.
- Audit persistence is opt-in and redacted; no hidden workflow state is created.

## US-8 — Release owner trusts the safety tests

**Priority:** P0
**Why:** A green happy-path suite can miss a disabled CAS check, path check, or rollback branch.
**Independent Test:** Implement and internally exercise the schema, shared service, real fixtures, and pure evaluator while lifecycle remains `DEFERRED`, then run the selected mutation engine against the safety-critical inventory. Supply one current accepted v0.2 kernel result with artifact hash `A`, one current accepted v0.3 result with artifact hash `B` and parent `A`, current distribution evidence, and all FR-1..FR-12 evidence; prove the legitimate `A != B` pair can open eligibility. Then remove one mandatory envelope and plant unqualified-singleton, duplicate-stage, v0.3-for-v0.2, stale/revoked-parent, and wrong-parent variants; prove implementation evidence can accrue without registration, every required mutant is killed, and FR-13 stays closed for each fault.

**Acceptance scenarios:**

- Any surviving safety-critical mutant blocks release.
- General mutation threshold and timeout policy remain decision-required until measured baselines exist.
- Authoring registration/release becomes eligible only from exact all-of evidence for every FR-1..FR-12, current distribution, and separately identified accepted same-lineage v0.2→v0.3 kernel results; implementation work does not depend on FR-13 becoming green.
