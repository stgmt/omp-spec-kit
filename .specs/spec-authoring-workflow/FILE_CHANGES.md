# Planned File Changes

**Status:** Future implementation map for the `NEXT` capability. No row claims current delivery.

| Planned path | Action | Requirements | Purpose |
|---|---|---|---|
| `src/authoring/operations.js` | create (planned) | FR-2, FR-3, FR-6 | Closed internal edit-operation compilers, deterministic hashing, byte/EOL preservation |
| `src/authoring/proposal.js` | create (planned) | FR-2, FR-3 | Pure in-memory proposal, bounded diff, kernel validation and anchor expansion |
| `src/authoring/transaction.js` | create (planned) | FR-4, FR-5, FR-6 | Spec lock, CAS, revalidation, same-filesystem stage, atomic swap, internal rollback, receipt |
| `src/authoring/index.js` | create (planned) | FR-1–FR-6 | One internal service surface consumed only by the existing MCP server |
| `src/mcp/server.js` | edit (planned) | FR-1, FR-4 | Register the exact two public mutation tools and delegate to the authoring core |
| `src/v0.1/extension.js` | edit (planned) | FR-1 | Current-host `tool_call` path policy: exact allowlist then deny raw `.specs/**` writers |
| `scripts/build-plugin.mjs` | edit (planned) | FR-1–FR-6 | Include root authoring source in generated installed payload and fail on missing wiring |
| `plugins/omp-spec-kit/dist/authoring/**` | create (generated) | FR-1–FR-6 | Dependency-safe installed output; never hand-edited authority |
| `tests/features/spec-authoring-workflow.feature` | create (planned) | FR-1–FR-7 | Executable counterpart of the fourteen specification scenarios |
| `tests/step-definitions/spec-authoring-workflow.steps.mjs` | create (planned) | FR-1–FR-7 | Real handler, policy, filesystem, concurrency, fault and redaction steps |
| `tests/fixtures/spec-authoring/real-corpus/` | create (planned capture) | FR-2, FR-3, FR-6, FR-7 | Provenance-recorded kernel/anchor/byte corpus |
| `tests/fixtures/spec-authoring/filesystem/` | create (planned capture) | FR-3–FR-7 | Real Windows/POSIX containment, race, crash and generation observations |

## Forbidden additions

- another plugin, extension writer, MCP server, or public helper tool;
- release eligibility evaluator, provider/server/schema/registry authority, or evidence tuple;
- durable review state, authoring-owned task lifecycle, audit ledger, database, cache, or hidden repository state;
- public transaction, recovery, rebaseline, overwrite, or replacement-bytes surface;
- a mutation-quality runtime gate or response field;
- direct `.specs/**` writer outside the atomic authoring core;
- hand-fabricated external producer fixtures.
