---
name: tool-e2e
description: Require complete real-server JSON-RPC E2E and BDD mutation coverage before any omp-spec-kit MCP tool, contract, handler, evidence parser, launcher, registry, packaging, or release change is complete.
---

# MCP tool E2E gate

Load this skill before changing, adding, renaming, removing, staging, packaging, or releasing any public MCP tool or the contract, handler, evidence parser, launcher, or registry that serves it.

A tool change is not complete until every affected public tool has a row in the executable matrix and the matrix passes against both the built server and the extracted release archive.

## Mandatory matrix row

For each affected tool, the row MUST:

1. start the real built or packaged server as a subprocess;
2. perform JSON-RPC `initialize`, `tools/list`, and `tools/call`; direct handler imports are not E2E evidence;
3. assert the exact registered name and closed input schema;
4. assert a semantic success result, one invalid type/data/unknown-field request, an operation-specific boundary or limit, and the exact typed error code;
5. snapshot the temporary project before and after every read-only call and require byte-for-byte equality, including files, directories, symlinks, and link targets;
6. deliberately mutate the relevant copied corpus, cursor binding, evidence file, proposal precondition, or containing path and assert stale/conflict/containment behavior;
7. assert bounded output, request identity, operation identity, provenance where present, and no absolute project/package paths or secrets.

Evidence fixtures MUST come from repository-owned `tests/fixtures/evidence/` and the pinned real corpus. Runtime evidence belongs only in the temporary project. Do not use external project caches, mocks, no-op fixtures, skipped rows, or envelope-only assertions.

## BDD and archive proof

Keep the matrix as explicit `@tool-e2e` BDD behavior with named rows for every changed tool. Run the same reusable matrix against:

- `plugins/omp-spec-kit/dist/mcp/server.js`;
- the launcher extracted from the release archive.

Archive inventory or one happy-path call is insufficient. A failure must be fixed in the owning contract/handler/caller, followed by the focused BDD scenario and the complete suite. Never weaken the assertion to match accidental fixture output.

## Required commands

```text
npm run build
npm run test:tool-e2e
npm run test:staged
npm test
npm run verify
```

For a release candidate, run the archive matrix and the separate `--stage safe-authoring` compatibility smoke. Record repository-owned evidence paths only:

- `.omp-spec-kit/evidence/last-test-run.ndjson`
- `.omp-spec-kit/evidence/bdd-results/run.ndjson`
- `tests/fixtures/release-candidate/cucumber-messages.ndjson`

A missing, skipped, stale, malformed, partial, or mutation-unproven row blocks completion.