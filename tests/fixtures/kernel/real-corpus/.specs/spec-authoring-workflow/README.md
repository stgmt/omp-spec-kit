# Spec Authoring Workflow

**Specification status:** `DEFERRED / SPECIFICATION ONLY / NOT IMPLEMENTED`

This specification defines a future proposal-first authoring capability inside the single `omp-spec-kit` plugin. It is not part of the read-only initial release and no scenario in this directory is claimed to have executed or passed.

## Release gate

Registration and release eligibility remain `DEFERRED` until the aggregate gate [FR-13](FR.md#fr-13-aggregate-authoring-eligibility) proves current mandatory evidence for every FR-1 through FR-12, current accepted `plugin-distribution:FR-13`, and two separately identified accepted `spec-kernel:FR-14` results: v0.2/kernel-v0.2 artifact `A` and v0.3/kernel-v0.3 artifact `B` whose declared v0.2 parent is `A`. `A` and `B` may legitimately differ, but both results must be current, non-revoked, and bound to the same product revision/artifact lineage; current-stage evidence remains bound to the exact built release-candidate artifact, kernel snapshot, policy version, and supported host. FR-13 is an all-of gate: no partial set, count, inherited green state, source-tree-only result, unqualified/duplicate-stage kernel set, v0.3-for-v0.2 substitution, stale/revoked parent, or cross-lineage pair can register authoring.

The lifecycle is `DEFERRED → ELIGIBLE → IMPLEMENTED → PROVEN`. While `DEFERRED`, maintainers may implement and internally exercise the schema, shared service, recovery authority, real fixtures, tests, and pure evaluator to create candidate-bound evidence; authoring actions remain unregistered/unexposed and user specifications remain unchanged. FR-13 governs `DEFERRED→ELIGIBLE` registration/release consideration, not implementation start. The current state is still `DEFERRED / SPECIFICATION ONLY / NOT IMPLEMENTED`. MP-1 through MP-4 and safety-critical mutation evidence are mandatory FR-11 legs inside FR-13. Nothing here authorizes publication or overrides the remaining public-init validation gates or the fail-closed license policy for future or changed imports; the frozen snapshot's historical license gap is resolved.

## Product boundary

The capability will live in the existing `plugins/omp-spec-kit` package and existing extension entry. It must not create another marketplace entry, plugin package, extension control plane, or direct writer. Read-only kernel access precedes mutation only for ordinary unlinked roots. Every write begins with a read-only validated proposal, requires a separate authenticated review of the complete proposal ID/hash, uses current expected-hash compare-and-swap (CAS), and commits a same-spec multi-document transaction atomically. `apply_transaction` cannot accept raw edits or preview and commit in one call.

Included:

- read-only proposal, complete diff preview, and explicit proposal review;
- anchor-aware edits from the complete `spec-kernel:FR-13` heading/anchor/link-occurrence inventory;
- expected-hash CAS and concurrent-writer refusal;
- root containment that makes linked spec directories unsupported for both kernel reading and mutation;
- validation before any write;
- atomic same-spec multi-document commit, deterministic/retained recovery, and bounded authenticated proposal-before-write rebaseline when neither retained original nor retained result is complete and valid, even if corrupt or incomplete retained directories exist;
- exact blocked-current, journal/no-survivor-assessment, candidate, pre/post hash binding; fixed root-contained ordinary candidate sources; separate review; atomic `REBASELINED`; fail-closed mismatch/link/validation/concurrency handling; and no history erasure;
- guarded task status proposals and transitions;
- redacted provenance and audit evidence;
- mutation-resistance release gates.

Excluded:

- dev-pomogator advisor, backlog, dashboard, hooks, stop gates, ledgers, repair loops, and local runtime machinery;
- semantic auto-writing, backlog resolution, archival, planning, and cross-spec transactions;
- `.progress.json` or any equivalent hidden workflow-state file;
- direct filesystem mutation that bypasses the authoring transaction authority.
- raw-edit apply or same-call preview-and-commit;
- reading or mutating a linked spec directory.
- unauthenticated recovery overwrite, direct candidate-byte upload, rebaseline without a no-write proposal and separate review, or deletion/rewriting of failed-transaction history.

## Canonical documents

Requirements are in [FR.md](FR.md), acceptance in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md), architecture in [DESIGN.md](DESIGN.md), schemas in [spec-authoring-workflow_SCHEMA.md](spec-authoring-workflow_SCHEMA.md), and specification-only scenarios in [spec-authoring-workflow.feature](spec-authoring-workflow.feature).

Runtime identities use `<spec-slug>:<local-id>`, for example `spec-authoring-workflow:FR-3`. Markdown headings and anchors remain file-local.

## Evidence basis

- Product staging decision: [Read-only-first kernel](../../docs/decisions/omp-spec-kit-public-init.md#read-only-first-kernel), [Exact phase sequence](../../docs/decisions/omp-spec-kit-public-init.md#exact-phase-sequence), and [Authoring gate](../../docs/decisions/omp-spec-kit-public-init.md#authoring-gate).
- Migration staging decision: [Release boundary derived from the matrix](../../MIGRATION_MATRIX.md#release-boundary-derived-from-the-matrix).
- Immutable provenance snapshot: `docs/upstream/dev-pomogator/spec-generator-v4/`.
- OMP extension lifecycle: https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md
- OMP marketplace lifecycle: https://github.com/can1357/oh-my-pi/blob/main/docs/marketplace.md
