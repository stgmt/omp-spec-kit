# Installed Distribution Lifecycle Evidence — v0.2.0

- **Date:** 2026-08-23
- **Payload commit:** `b40db2e57f0b4c093a8a0e96e591d9109e3335be` (main, PR #8 — the kernel payload commit)
- **OMP runtime:** `omp/17.3.7`
- **Payload tree digest (SHA-256 over sorted path/length/file-hash rows of `plugins/omp-spec-kit/**`):** `e71067472e60d926bd73177c97b05df156e9e5b70b6def6bc70fa920e6c3dc1e`
- **Verdict:** PASS — clean install, fresh-session activation/invocation, uninstall absence, and exact-candidate reinstall proven against the committed 0.2.0 bytes.

## Method

Identical to the v0.1.0 procedure (`distribution-lifecycle.md`): a detached worktree at the payload commit, a disposable fixture with a real `.specs/product` corpus, project-scope marketplace install, source worktree removed before invocation (cache-only execution), uninstall absence proof, then reinstall from a recreated worktree at the same commit.

## Results

| Step | Evidence |
|---|---|
| Install | `omp-spec-kit` `0.2.0` installed at project scope from the pinned worktree |
| Fresh-session invocation | `spec_inventory` executed; tool result `pluginVersion: "0.2.0"`, `status: "ok"` |
| Uninstall absence | Fresh session with `--tools spec_inventory` refused: `Unknown tool in --tools: spec_inventory` |
| Reinstall identity | Same-commit worktree reinstall; fresh-session invocation `pluginVersion: "0.2.0"`, `status: "ok"` again |
| Payload digest | `e71067472e60d926bd73177c97b05df156e9e5b70b6def6bc70fa920e6c3dc1e` — enforced by `scripts/verify-release.mjs` at the tagged commit |

## Release gating

`scripts/verify-release.mjs` pins `EXPECTED_PAYLOAD_DIGEST` to the digest above: any payload byte drift after this evidence invalidates the release gate. The tag `v0.2.0` triggers the GitHub Actions `release` workflow, whose verify job re-runs build, both verifiers, the Docker BDD suite (25 scenarios / 174 steps), and this consistency gate before the publish job creates the release.

## Boundary

Prior-version upgrade/rollback from 0.1.0: 0.1.0 was released and installed at project scope in evidence runs, but the upgrade path (install-over → fresh-session version observation) is first exercised in this cycle's reinstall proof only as same-candidate reinstall. Full cross-version upgrade/rollback receipts are deferred to the next release that changes the payload (per `plugin-distribution:FR-7/FR-8` candidate-aware profiles). MCP remains absent by contract until v0.3.
