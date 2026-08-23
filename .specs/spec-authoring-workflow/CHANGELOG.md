# Changelog

## Unreleased — specification-only public init

### Added

- Defined the deferred `spec-authoring-workflow` product boundary inside the single `omp-spec-kit` plugin.
- Added read-only proposal/diff preview followed by explicit authenticated full-preview review; `apply_transaction` now consumes only an unexpired reviewed proposal ID/hash and current expected hashes and rejects raw/same-call edits.
- Added canonical containment that makes linked roots/spec directories/targets unsupported for both kernel reads and mutation.
- Added anchor-safe section and heading operations driven by the complete `spec-kernel:FR-13` heading/anchor/link-occurrence inventory.
- Added exhaustive proposal, transaction, eligibility, task-status, retained-recovery, and no-survivor rebaseline transitions: `RECOVERY_REQUIRED→RECOVERING→COMMITTED|ROLLED_BACK` for a complete valid retained generation, or authenticated hash-bound dry-run/review/apply `RECOVERY_REQUIRED→REBASELINING→REBASELINED` when neither retained original nor retained result is complete and valid, even if corrupt or incomplete retained directories remain.
- Added versioned request/result/error schemas and redacted proposal-review/recovery/rebaseline provenance, full pre/post/current/journal/candidate hash evidence, and append-only history-preserving audit events.
- Added a hard 100%-killed mutation gate for enumerated safety-critical mutant families.
- Recorded MP-1 through MP-4 as explicit decision-required release blockers.
- Defined FR-13 as the all-of registration/release eligibility gate over mandatory FR-1..FR-12 evidence, current `plugin-distribution:FR-13`, and separately qualified accepted `spec-kernel:FR-14` v0.2 and v0.3 results whose predecessor/current artifact hashes are cryptographically linked within one product revision/artifact lineage; schema/service/fixture/evaluator implementation may proceed while lifecycle remains `DEFERRED` and actions remain unregistered.
- Added stable unique `@id:SCEN-*` and exact `@AC-N.M` trace tags to every specification scenario.

### Deferred

- Authoring action registration, exposure, user-spec mutation, and release eligibility until aggregate `spec-authoring-workflow:FR-13` is green for the exact built release-candidate artifact/snapshot/policy/host; implementation and isolated evidence production are not deferred by this gate.
- Any publication while required public-init validation remains incomplete; the frozen snapshot's historical license gap is resolved, while `plugin-distribution:FR-13` retains fail-closed provenance/license checks for future or changed imports.
- Mutation engine, non-critical threshold, timeout budget, and equivalent-mutant authority until measured baselines resolve MP-1–MP-4.

### Excluded

- dev-pomogator advisor, backlog, dashboard, hooks, stop gates, repair loops, SQLite, watcher, judge, and runtime harness machinery.
- Direct or raw-edit writes, same-call preview-and-commit, cross-spec atomic transactions, automatic CAS rebase, linked-spec reads/mutation, retained recovery with replacement bytes, unauthenticated or unreviewed rebaseline, out-of-root/linked candidate sources, recovery-history erasure, `.progress.json`, and hidden repository workflow state.

No runtime release, executed scenario, passing test, or implementation completion is claimed.
