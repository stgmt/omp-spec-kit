# Installed Distribution Lifecycle Evidence — v0.3.0

- **Date:** 2026-08-23
- **Payload commit:** `0eccfb81044827b8f358954801bfc1520a7e8972` (main, PR #11 — the MCP/kernel-surface commit)
- **OMP runtime:** `omp/17.3.7`
- **Payload tree digest (SHA-256 over sorted path/length/file-hash rows of `plugins/omp-spec-kit/**`):** `69f0a10a0e2f3e42e8827c48919cb3a1afcc55743d05df37e184c02e51822e4e`
- **Verdict:** PASS — clean install, fresh-session activation/invocation, uninstall absence, and exact-candidate reinstall proven against the committed 0.3.0 bytes (extension + MCP server in one artifact).

## Method

Identical to the v0.2.0 procedure: detached worktree at the payload commit, disposable fixture with a real `.specs/product` corpus, project-scope marketplace install, source worktree removed before invocation (cache-only execution), uninstall absence proof, reinstall from a recreated worktree at the same commit.

## Results

| Step | Evidence |
|---|---|
| Install | `omp-spec-kit` `0.3.0` installed at project scope from the pinned worktree |
| Fresh-session invocation | `spec_inventory` executed; `pluginVersion: "0.3.0"`, `status: "ok"` |
| Uninstall absence | Fresh session refused: `Unknown tool in --tools: spec_inventory` |
| Reinstall identity | Same-commit reinstall; fresh-session invocation `pluginVersion: "0.3.0"`, `status: "ok"` again |
| MCP surface | `dist/mcp/server.js` + nested `.mcp.json` ship in the same artifact; Docker BDD MCP-parity suite (initialize / 8-tool tools-list / tools-call parity vs the in-process kernel oracle / fail-closed / dependency-absent) passed against these exact bytes (31 scenarios / 229 steps) |
| Payload digest | `69f0a10a0e2f3e42e8827c48919cb3a1afcc55743d05df37e184c02e51822e4e` — enforced by `scripts/verify-release.mjs` at the tagged commit |

## Boundary

Cross-version upgrade/rollback receipts (0.2.0 → 0.3.0 install-over with fresh-session version observation, then rollback to 0.2.0) are deferred to the next payload-changing release cycle; this cycle proves the candidate reinstall profile per `plugin-distribution:FR-7/FR-8`. No mutation APIs exist in this artifact.
