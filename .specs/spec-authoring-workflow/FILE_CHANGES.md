# Planned File Changes

**Status:** Every row is a future planned change. None of these paths is claimed to exist or be implemented by this specification. Paths are repository-relative and remain inside the single plugin architecture.

| Planned path | Action | Requirements | Purpose |
|---|---|---|---|
| `plugins/omp-spec-kit/src/authoring/contracts.ts` | create (planned) | FR-2, FR-3, FR-6, FR-8, FR-9, FR-10, FR-13 | Closed proposal/review/apply/retained-recovery/rebaseline request, result, error, state, authorization-reference, mandatory-evidence/kernel-profile lineage, and canonical serialization types |
| `plugins/omp-spec-kit/src/authoring/eligibility.ts` | create (planned) | FR-1, FR-11, FR-12, FR-13 | Pure exact-release-candidate all-of evaluator usable during `DEFERRED`; requires one accepted linked v0.2/v0.3 kernel pair plus current distribution and FR-1..FR-12 evidence, and controls registration/release eligibility rather than implementation start |
| `plugins/omp-spec-kit/src/authoring/root.ts` | create (planned) | FR-5 | Root grammar, canonical containment, collision, and linked/reparse refusal before document read |
| `plugins/omp-spec-kit/src/authoring/proposal.ts` | create (planned) | FR-2, FR-4, FR-7 | In-memory edit normalization, preview, full-preview review binding, proposal hashing and lifecycle |
| `plugins/omp-spec-kit/src/authoring/validation.ts` | create (planned) | FR-4, FR-6, FR-8 | Composition of kernel validators plus authoring/status/retained-recovery/rebaseline containment-link-history checks |
| `plugins/omp-spec-kit/src/authoring/anchors.ts` | create (planned) | FR-7; `spec-kernel:FR-13` | Stable heading selection, byte/EOL conservation, and complete inventory-driven inbound rewrite expansion |
| `plugins/omp-spec-kit/src/authoring/lease.ts` | create (planned) | FR-3, FR-6 | Root-scoped shared/exclusive coordination, liveness, timeout, idempotency |
| `plugins/omp-spec-kit/src/authoring/transaction.ts` | create (planned) | FR-2, FR-3, FR-5, FR-6 | Reviewed-proposal identity, CAS, same-filesystem staging, generation swap, rollback, atomic rebaseline install, and cleanup that cannot erase recovery history |
| `plugins/omp-spec-kit/src/authoring/recovery.ts` | create (planned) | FR-6 | Deterministic recovery, retained-generation selection, no-survivor assessment, authenticated root-contained dry-run rebaseline, and fail-closed history preservation |
| `plugins/omp-spec-kit/src/authoring/task-status.ts` | create (planned) | FR-2, FR-8 | Exhaustive transition reducer producing review-required proposals and evidence guards |
| `plugins/omp-spec-kit/src/authoring/audit.ts` | create (planned) | FR-2, FR-6, FR-9 | Redacted proposal/recovery/rebaseline envelopes, append-only digest chain, and explicit sink behavior |
| `plugins/omp-spec-kit/src/authoring/service.ts` | create (planned) | FR-1–FR-13 | Single shared authoring authority implementable/testable while unregistered in `DEFERRED` |
| `plugins/omp-spec-kit/src/extension.ts` | edit (planned) | FR-1, FR-10, FR-12, FR-13 | Register the already implemented shared service only after exact FR-13 eligibility; no new entry or deferred exposure |
| `plugins/omp-spec-kit/src/kernel/snapshot-coordinator.ts` | create (planned) | FR-3, FR-5, FR-6; `spec-kernel:FR-3`, `spec-kernel:FR-13`, `spec-kernel:FR-14` | Shared containment and read/exclusive-write committed-generation boundary for ordinary unlinked specs |
| `plugins/omp-spec-kit/src/index.ts` | edit (planned) | FR-10, FR-12 | Export only the shared service contract required by the existing adapter |
| `tests/features/spec-authoring-workflow.feature` | create (planned) | FR-1–FR-13 | Executable counterpart to source specification scenarios after implementation |
| `tests/steps/spec-authoring-workflow.steps.ts` | create (planned) | FR-1–FR-13 | Real handler steps for deferred implementation/no-registration, proposal review, retained recovery, no-survivor rebaseline, containment, and eligibility; no direct internal-state injection |
| `tests/fixtures/spec-authoring/real-corpus/` | create (planned) | FR-2, FR-4, FR-7, FR-8 | Trimmed, provenance-recorded real spec and recovery-candidate documents with complete kernel heading/anchor/link/trace cases |
| `tests/fixtures/spec-authoring/filesystem/` | create (planned) | FR-3, FR-5, FR-6 | Platform-generated linked read refusal, race, crash, stage, deterministic/retained recovery, current-journal-bound rebaseline, and history-retention fixtures |
| `tests/fixtures/spec-authoring/audit/` | create (planned) | FR-2, FR-6, FR-9, FR-10 | Real redacted proposal/review, retained recovery, rebaseline proposal/success/refusal, history-chain, and schema reconciliation envelopes |
| `tests/mutation/spec-authoring-critical.json` | create (planned) | FR-11 | Required critical mutant-family inventory and policy version |
| `tests/mutation/spec-authoring-workflow.mutation.ts` | create (planned) | FR-11 | Deterministic baseline/mutate/restore/reconcile gate using selected engine |
| `.github/workflows/verify.yml` | edit (planned) | FR-11, FR-12, FR-13 | Run critical mutation, single-authority, and exact all-of eligibility gates, including distinct linked v0.2/v0.3 kernel profile variants, after policy resolution |

## Explicitly forbidden changes

The authoring feature SHALL NOT plan or create:

- another `.omp-plugin/marketplace.json` entry or another plugin directory;
- another `omp.extensions` entry;
- `.progress.json`, repository-local databases, ledgers, logs, caches, or persistent transaction state;
- advisor, backlog, dashboard, Claude hook, stop-gate, judge, repair-loop, watcher, or generic harness files;
- a direct filesystem writer outside `plugins/omp-spec-kit/src/authoring/transaction.ts`;
- executable scenarios before the implementation and step definitions are ready to produce honest evidence.
- any apply surface that accepts raw edits or combines proposal preview with commit;
- any retained-recovery surface that accepts replacement bytes, or any rebaseline surface that lacks operator authorization, exact current/journal/candidate hashes, no-write proposal, separate review, root containment, full validation, atomic install, or history preservation;
- any kernel or authoring read path that follows a linked spec directory.
