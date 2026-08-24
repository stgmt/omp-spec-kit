# Spec Review: mcp-release-integrity

**Phase:** corrective post-implementation review

## Verdict

**NOT READY for merge or public release.** Docker/package behavior is stronger than before, but the real pinned OMP discovery path has a proven gap.

## Confirmed fixes

- Docker BDD now covers malformed raw JSON: one `-32700` response with null id, then successful recovery.
- Candidate evidence parser rejects non-NDJSON, meta-only streams, duplicate `testRunFinished`, retried-without-terminal attempts, missing chain members, and non-passing terminal steps.
- `tests/fixtures/release-candidate/cucumber-messages.ndjson` is captured real Cucumber 13.2.1 output with provenance documentation.
- Corrective Docker suite: 43 scenarios / 353 steps passed.
- Tasks and CHKs were reopened: 0 verified, 9 in progress, 2 blocked.

## Blocking finding

| Code | Severity | Evidence | Required resolution |
|------|----------|----------|---------------------|
| `PINNED_OMP_MCP_DISCOVERY_MISSING` | P0 | A fresh pinned `@oh-my-pi/pi-coding-agent@17.3.7` session lists `omp-spec-kit@0.3.1` under `/plugins list`, but `/mcp list` omits it and `/mcp test omp-spec-kit` returns `Server "omp-spec-kit" not found.` | Establish and automate a package registration mechanism that makes v17.3.7 load the plugin `.mcp.json`, then prove `/mcp list`, connection, and a real tool call from the active project. |

## Release boundary

No v0.3.1 tag, GitHub release, upgrade proof, rollback proof, or live release asset was created. The release workflow is intentionally fail-closed until those receipts exist.
