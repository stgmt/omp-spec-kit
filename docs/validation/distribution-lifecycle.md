# Installed Distribution Lifecycle Evidence — v0.1.0

- **Date:** 2026-08-23
- **Candidate commit:** `a959a1af3abeb1fc61eefda48b011a6470a6d621` (main, PR #2)
- **OMP runtime:** `omp/17.3.7`
- **Verdict:** PASS — clean install, fresh-session activation/invocation, uninstall absence, and exact-candidate reinstall all proven against the committed bytes.

## Method

1. A detached Git worktree was created at the candidate commit; the disposable fixture project contained a real `.specs/product` corpus (15 canonical documents).
2. User-owned fixture bytes were hashed before any OMP operation (15 files; digest `cb7ee7904d8243d6b3f9b23998049688484d655df67964e8421f986546060ceb`), excluding only OMP/plugin-managed `.omp` and `.dev-pomogator` state.
3. `omp plugin marketplace add <clean-worktree>` + `omp plugin install omp-spec-kit@omp-spec-kit --scope project` were run from the fixture.
4. The installed cache was hashed, then the source worktree was **deleted before invocation**, so the fresh session could only load the installed cache.

## Results

| Step | Evidence |
|---|---|
| Installed cache identity | 8 files, SHA-256 tree digest `abcf2be68e479ef6e552b2bc5c290b9bed0f9ca6f9ca2d7a605f574e135428d0` — byte-identical to the committed `plugins/omp-spec-kit` payload |
| Fresh-session activation (install) | Exactly 1 `spec_inventory` execution; tool result `pluginVersion: "0.1.0"`, `status: "ok"`, product spec `recognized` with `documentCount: 15` |
| User-owned preservation (install) | Digest unchanged: `cb7ee790…60ceb` |
| Uninstall absence | `omp plugin uninstall` removed the project entry; registry empty; a fresh session with `--tools spec_inventory` refused with `Unknown tool in --tools: spec_inventory` |
| Reinstall identity | Reinstalled from a recreated worktree at the same commit; cache digest again `abcf2be6…428d0`; worktree removed before invocation |
| Fresh-session activation (reinstall) | Exactly 1 `spec_inventory` execution; full structured details returned: `schemaVersion 1`, `pluginVersion 0.1.0`, `status ok`, `readOnly true`, zero diagnostics |
| User-owned preservation (final) | Digest unchanged: `cb7ee790…60ceb` |

## Boundary

- Upgrade-from-prior and rollback-to-prior are **inapplicable for `0.1.0`** (first release; no prior release exists). The candidate uninstall/reinstall profile above is the required first-release lifecycle proof per `plugin-distribution:FR-7/FR-8/FR-13`.
- This receipt is bound to commit `a959a1af3abeb1fc61eefda48b011a6470a6d621`. Any later payload change invalidates it until rerun.
- GitHub Actions release transaction, tag, and GitHub release are governed separately by `plugin-distribution:FR-10/FR-13`.
