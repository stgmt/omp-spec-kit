# Planned File Changes

**Status:** Every row is a future planned change. None of these paths is claimed to exist or be implemented by this specification. Paths are repository-relative and remain inside the single plugin architecture.

| Planned path | Action | Requirements | Purpose |
|---|---|---|---|
| `src/authoring/contracts.js` | create (planned) | FR-2, FR-3, FR-6, FR-8, FR-9, FR-10, FR-13, FR-14 | Closed proposal/review/apply/recovery requests, results, errors, states, facade phases, evidence lineage, capability manifest and canonical serialization |
| `src/authoring/eligibility.js` | create (planned) | FR-1, FR-11, FR-12, FR-13 | Pure all-of evaluator usable during `DEFERRED`; controls registration/release rather than implementation start |
| `src/authoring/root.js` | create (planned) | FR-5 | Root grammar, canonical containment, collision and linked/reparse refusal before document read |
| `src/authoring/proposal.js` | create (planned) | FR-2, FR-4, FR-7 | Seven-operation normalization, complete preview, review binding, proposal hashing and lifecycle |
| `src/authoring/validation.js` | create (planned) | FR-4, FR-6, FR-8 | Kernel validator composition plus authoring/status/recovery containment, link and history checks |
| `src/authoring/anchors.js` | create (planned) | FR-7; `spec-kernel:FR-13` | Stable heading selection, byte/EOL conservation and complete inventory-driven inbound rewrite expansion |
| `src/authoring/lease.js` | create (planned) | FR-3, FR-6 | Root-scoped shared/exclusive coordination, liveness, timeout and idempotency |
| `src/authoring/transaction.js` | create (planned) | FR-2, FR-3, FR-5, FR-6 | Reviewed-proposal identity, CAS, same-filesystem staging, generation swap, rollback, rebaseline and history-safe cleanup |
| `src/authoring/recovery.js` | create (planned) | FR-6 | Retained selection, no-survivor assessment, authenticated dry-run rebaseline and fail-closed history preservation |
| `src/authoring/task-status.js` | create (planned) | FR-2, FR-8 | Exhaustive transition reducer producing review-required proposals and evidence guards |
| `src/authoring/audit.js` | create (planned) | FR-2, FR-6, FR-9 | Redacted proposal/review/recovery envelopes, append-only digest chain and explicit sink behavior |
| `src/authoring/service.js` | create (planned) | FR-1–FR-14 | Single shared authoring authority, implementable/testable while unregistered in `DEFERRED` |
| `src/authoring/index.js` | create (planned) | FR-10, FR-12 | Export the one service/compiler surface consumed by the MCP adapter; directory does not exist today |
| `src/kernel/snapshot-coordinator.js` | create (planned) | FR-3, FR-5, FR-6; `spec-kernel:FR-3`, `spec-kernel:FR-13`, `spec-kernel:FR-14` | Shared contained read/exclusive-write committed-generation boundary |
| `src/mcp/authoring-tools.js` | create (planned) | FR-2, FR-10, FR-12, FR-14 | Compile the seventeen registered v1 facades, including review-only/commit-only apply phases; publish seven unregistered `unsupportedLaterNames` |
| `src/mcp/server.js` | edit (planned) | FR-1, FR-10, FR-12, FR-13, FR-14 | Extend tools/list and tools/call with the gated authoring registry and delegate every facade to `src/authoring/service.js`; no direct writer |
| `src/v0.1/extension.js` | verify unchanged/read-only (planned proof) | FR-1, FR-12, FR-14 | Prove the existing OMP extension registers no authoring facade or writer; it is not the authoring adapter |
| `scripts/build-plugin.mjs` | edit (planned) | FR-10, FR-12, FR-14 | Copy/bundle `src/authoring/**`, rewrite its internal imports, include MCP registry wiring and fail if generated authoring payload is missing |
| `plugins/omp-spec-kit/dist/authoring/**` | create (planned, generated) | FR-1–FR-14 | Installed dependency-safe authoring service/compiler payload generated from root source |
| `plugins/omp-spec-kit/dist/mcp/server.js` | edit (planned, generated) | FR-14 | Installed MCP server exposing the gated seventeen-name registry over generated authoring payload |
| `tests/features/spec-authoring-workflow.feature` | create (planned) | FR-1–FR-14 | Executable counterpart after implementation; one-to-one with source scenarios |
| `tests/step-definitions/spec-authoring-workflow.steps.mjs` | create (planned) | FR-1–FR-14 | Real handler steps for deferred no-registration, proposal/review/commit, recovery, containment and eligibility |
| `tests/fixtures/spec-authoring/real-corpus/` | create (planned) | FR-2, FR-4, FR-7, FR-8 | Provenance-recorded real spec/recovery-candidate corpus with complete kernel anchor/trace ground truth |
| `tests/fixtures/spec-authoring/filesystem/` | create (planned) | FR-3, FR-5, FR-6 | Platform-generated linked-read refusal, race, crash, stage/recovery/rebaseline/history fixtures |
| `tests/fixtures/spec-authoring/audit/` | create (planned) | FR-2, FR-6, FR-9, FR-10 | Real redacted proposal/review/recovery/history-chain schema reconciliation envelopes |
| `tests/mutation/spec-authoring-critical.json` | create (planned) | FR-11 | Required critical mutant-family inventory and policy version |
| `scripts/run-authoring-mutation-gate.mjs` | create (planned) | FR-11 | Deterministic baseline/mutate/restore/reconcile producer invoked by the BDD release scenario; not a second non-BDD test suite |
| `.github/workflows/verify.yml` | edit (planned) | FR-11, FR-12, FR-13, FR-14 | Run mutation, single-authority, build inclusion, exact all-of eligibility and mandatory `authoring-mcp@1` registry/profile gates |

## Explicitly forbidden changes

The authoring feature SHALL NOT plan or create:

- another `.omp-plugin/marketplace.json` entry or another plugin directory;
- another `omp.extensions` entry;
- `.progress.json`, repository-local databases, ledgers, logs, caches, or persistent transaction state;
- advisor, backlog, dashboard, Claude hook, stop-gate, judge, repair-loop, watcher, or generic harness files;
- a direct filesystem writer outside `src/authoring/transaction.js`;
- executable scenarios before the implementation and step definitions are ready to produce honest evidence.
- any apply surface that accepts raw edits or combines proposal preview with commit;
- any retained-recovery surface that accepts replacement bytes, or any rebaseline surface that lacks operator authorization, exact current/journal/candidate hashes, no-write proposal, separate review, root containment, full validation, atomic install, or history preservation;
- any kernel or authoring read path that follows a linked spec directory.
