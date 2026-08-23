# Research

## Scope and method

This is specification research, not runtime evidence. Target decisions were derived from the validated public-init plan, the repository migration matrix, the immutable upstream snapshot, and current official OMP documentation cited below. Upstream claims are inputs to rewrite, not target implementation proof.

## Findings

### R-1 — Authoring must follow a proven read-only kernel

**Status:** `[VERIFIED_FROM_LOCAL_PROVENANCE]`

The repository decision explicitly sequences a read-only kernel before mutation in [Read-only-first kernel](../../docs/decisions/omp-spec-kit-public-init.md#read-only-first-kernel), keeps phases strictly ordered in [Exact phase sequence](../../docs/decisions/omp-spec-kit-public-init.md#exact-phase-sequence), and requires complete containment/authorization/proposal/CAS/atomicity/rollback/concurrency/audit/privacy/recovery evidence in the [Authoring gate](../../docs/decisions/omp-spec-kit-public-init.md#authoring-gate). The [Release boundary derived from the matrix](../../MIGRATION_MATRIX.md#release-boundary-derived-from-the-matrix) places the read-only kernel before later mutation work; the functional/source tables classify validated mutation, status transitions, high-level authoring, recovery, and mutation verification as `DEFER` while retaining portable anchors, identity, containment, and evidence concepts.

**Decision:** `spec-authoring-workflow` actions and release remain `DEFERRED` until FR-13 proves mandatory FR-1..FR-12 evidence, current `plugin-distribution:FR-13`, and two distinct accepted `spec-kernel:FR-14` results: v0.2/kernel-v0.2 artifact `A` and v0.3/kernel-v0.3 artifact `B` with `v02ParentArtifactSha256: A`. The legitimate predecessor/current hashes may differ, but both results must remain current, non-revoked, and bound to the same product revision/artifact lineage, with current-stage evidence bound to the exact built release-candidate artifact/snapshot/policy/host. `DEFERRED` does not prohibit schema/service/fixture/evaluator implementation or isolated evidence production; it prohibits registration, exposure, user-spec mutation, and release claims.

### R-2 — OMP extension load is registration-only

**Status:** `[VERIFIED_OFFICIAL_SOURCE]`

OMP's extension contract uses a default extension factory and registration APIs, and forbids performing runtime actions during factory load: https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md

**Decision:** authoring registers through the existing extension only after the release gate opens; proposal or mutation work occurs only on explicit runtime invocation. No second extension entry or load-time mutation is allowed.

### R-3 — Distribution proof is not inferred from source code

**Status:** `[VERIFIED_OFFICIAL_AND_LOCAL_PLAN]`

OMP marketplace installation, update, and plugin lifecycle are documented at https://github.com/can1357/oh-my-pi/blob/main/docs/marketplace.md. The validated plan requires clean project-scope install, reload, fresh-session activation, dependency isolation, uninstall preservation, and upgrade evidence.

**Decision:** eligibility consumes current accepted `plugin-distribution:FR-13` evidence for the current built release candidate in addition to, not instead of, the separately qualified linked v0.2 and v0.3 kernel aggregates. A source-tree test, subset, aggregate count, unqualified kernel singleton, duplicate target stage, stale/revoked predecessor, or cross-lineage parent/current pair cannot substitute for installed-artifact proof.

### R-4 — Proposal/apply and CAS solve observed authoring failures

**Status:** `[VERIFIED_FROM_IMMUTABLE_UPSTREAM]`

`docs/upstream/dev-pomogator/spec-generator-v4/FR.md` sections FR-40 and FR-60 record validation-before-write, proposal preview, expected hashes, anchor operations, and all-or-none multi-document changes. The migration matrix defers these behaviors rather than adopting the source harness.

**Decision:** retain the safety properties, require a read-only proposal followed by a separate authenticated full-preview review before `apply_transaction`, and define new standalone contracts without MCP-only assumptions, watcher state, dev-pomogator logs, Claude hooks, or backlog APIs. A same-call synthesized preview and commit is not review.

### R-5 — Heading identity and node identity are different concerns

**Status:** `[VERIFIED_FROM_IMMUTABLE_UPSTREAM]`

The upstream FR-34 and FR-36 distinguish file-local Markdown anchors from spec-qualified graph identities. Renaming descriptive headings changes generated slugs and can break inbound links.

**Decision:** requests use canonical `<spec-slug>:<local-id>` for nodes and stable heading selectors for edits. Safe rename consumes the authoritative `spec-kernel:FR-13` query containing complete heading definitions, generated anchors, and link occurrences over one immutable snapshot; accepted renames rewrite all provable same-spec inbound links in the reviewed transaction. External, linked, ambiguous, colliding, or incomplete inventory blocks.

### R-6 — Path safety requires canonical containment and reparse-point refusal

**Status:** `[VERIFIED_FROM_IMMUTABLE_UPSTREAM]`

The upstream FR-62 and FR-74 require deterministic target root selection, realpath confinement, and rejection of traversal, absolute/UNC paths, normalization collision, and symlink/junction escape.

**Decision:** the first authoring release adopts one deny policy shared with kernel containment: the selected root and every component through the spec directory and target must not be a symlink, junction, mount point, or other reparse point. Linked spec directories are unsupported for both document reads and mutation, containment refuses before content read, and no allowlisted-link exception exists.

### R-7 — Task status is guarded state, not free-form text

**Status:** `[VERIFIED_FROM_IMMUTABLE_UPSTREAM]`

The upstream FR-48 defines a centralized `todo`, `ready`, `in-progress`, `blocked`, `done` lifecycle and guards starting and completing work. FR-35 and FR-77 require current, task-owned, strong evidence rather than green plumbing.

**Decision:** status changes are typed read-only proposals using the same validation path, followed by explicit review and `apply_transaction`. No raw status edit, `.progress.json`, phase stop, prompt gate, watcher, or dashboard behavior transfers.

### R-8 — Mutation testing is necessary but policy must be calibrated

**Status:** `[PARTIALLY_DECIDED]`

The immutable upstream FR-53 and FR-85 require deterministic mutation resistance and restoration after fault injection. They do not establish a portable target engine, timeout, or representative general-code threshold for this greenfield repository.

**Decision fixed now:** every safety-critical mutant family listed in FR-11 must achieve 100% killed, with `NO_COVERAGE`, `TIMED_OUT`, `SKIPPED`, and engine errors treated as blocking rather than killed.

### R-9 — RECOVERY_REQUIRED needs a bounded operator exit

**Status:** `[DESIGN_DECISION]`

Deterministic recovery can prove a retained original or result generation, but corrupt or incomplete transaction material can leave neither byte set complete. Permanent terminal blocking provides no operational exit; accepting request-embedded replacement bytes would create a privileged writer outside proposal review.

**Decision:** recovery is two-path and mutually exclusive. A host-authenticated `recover_transaction` selects a complete retained original/result by hashes. Only a hash-bound no-survivor assessment admits `propose_rebaseline_recovery`: an unexpired operator authorization binds actor/reason, transaction/root/target, fixed root-contained ordinary candidate source, complete candidate inventory, expected blocked-current snapshot/documents, exact journal or missing-marker hash, no-survivor assessment, bounds, and expiry. Dry-run containment/link/full validation returns complete pre/post hashes without writing; separately reviewed `apply_rebaseline_recovery` repeats all hashes, audit-chain, and lease/concurrency checks before atomic `REBASELINED`. Every failure remains `RECOVERY_REQUIRED`, leaks no candidate path/bytes, and erases no current, journal, recovery, candidate, or audit history.

## Open mutation policy decisions

These are explicit `DECISION_REQUIRED` items, not implementation placeholders. They keep the feature deferred until measured evidence exists.

| Decision | Fixed constraints | Remaining alternatives | Owner | Resolution evidence |
|---|---|---|---|---|
| MP-1 — mutation engine | Must run against the built plugin code and emit machine-readable per-mutant outcomes | Select the engine after the implementation language, bundling, and BDD runner are pinned; candidate engines must support deterministic targeted runs | Release owner | Repeated identical runs over the same artifact yield the same mutant inventory and outcomes |
| MP-2 — non-critical threshold | Critical families remain 100%; equivalent mutants require reviewed classification, never silent exclusion | Choose a measured global percentage or per-module floor after the first full baseline | Test owner | Baseline distribution, survivor review, and false-block analysis committed with policy version |
| MP-3 — timeout and performance budget | Timeout/engine errors block and may not be counted as killed | Set per-mutant and suite budgets from CI observations rather than invented numbers | Release owner | At least three clean CI baselines with artifact and runner versions |
| MP-4 — equivalent-mutant authority | No author may self-waive a safety-critical mutant | Choose one independent reviewer or two-person approval for non-critical equivalent classification | Maintainer | Auditable decision record names mutant, rationale, reviewers, and expiry/revisit trigger |

## Provenance sources

- [Read-only-first kernel](../../docs/decisions/omp-spec-kit-public-init.md#read-only-first-kernel), [Exact phase sequence](../../docs/decisions/omp-spec-kit-public-init.md#exact-phase-sequence), and [Authoring gate](../../docs/decisions/omp-spec-kit-public-init.md#authoring-gate)
- [Release boundary derived from the matrix](../../MIGRATION_MATRIX.md#release-boundary-derived-from-the-matrix)
- `docs/upstream/dev-pomogator/spec-generator-v4/FR.md` — especially FR-34, FR-35, FR-40, FR-48, FR-53, FR-60, FR-62, FR-74, FR-77, FR-84, and FR-85
- `docs/upstream/dev-pomogator/spec-generator-v4/ACCEPTANCE_CRITERIA.md`
- `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4.feature`
- https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md
- https://github.com/can1357/oh-my-pi/blob/main/docs/marketplace.md
