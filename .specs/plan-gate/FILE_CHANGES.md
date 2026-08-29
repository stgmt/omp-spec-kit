# File Changes

All runtime paths are future and repository-relative. Root `src/**` JavaScript is the source of truth; `scripts/build-plugin.mjs` copies/bundles accepted capability files into the single `plugins/omp-spec-kit/dist/**` payload. There is no supported `plugins/omp-spec-kit/src/**` source tree.

| Path | Action | Capability state | Reason |
|---|---|---|---|
| `src/gate/manual-adapter.js` | create | planned | Exact explicit request admission and bridge result (FR-1, FR-2) |
| `src/gate/io-resolver.js` | create | planned | Bounded declared reads and realpath/reparse/symlink containment (FR-5, FR-9) |
| `src/gate/validator/index.js` | create | planned | Pure phased validator entry (FR-4) |
| `src/gate/validator/identity.js` | create | planned | Closed schema/hash/mode/host checks (FR-1, FR-4) |
| `src/gate/validator/duplicate.js` | create | planned | Explicit-candidate duplicate validation (FR-5) |
| `src/gate/validator/structure.js` | create | planned | Structure/form checks (FR-4) |
| `src/gate/validator/grounding.js` | create | planned | Explicit prompt relevance and Extracted Requirements (FR-6, FR-8) |
| `src/gate/validator/crossref.js` | create | planned | File Changes/body consistency (FR-7) |
| `src/gate/validator/specref.js` | create | planned | Qualified IDs against complete supplied index (FR-9) |
| `src/gate/deny.js` | create | planned | Paged findings and bounded reason (FR-10) |
| `src/gate/resources/plan-template.md` | create | planned | Hash-inventoried template (FR-10, FR-11) |
| `src/gate/resources/section-model.json` | create | planned | Hash-inventoried skeleton/action model (FR-4, FR-11) |
| `src/gate/resources/guarded-paths.json` | create | planned | Exact four-pattern `plan-gate-guarded-paths@1` policy with hash inventory (FR-9, FR-11) |
| `src/gate/release.js` | create | planned | Manual/automatic profile evaluator (FR-13) |
| `src/gate/automatic-adapter.js` | create | `DEFERRED_HOST_ABI` | One-to-one future selected-plan event adapter (FR-1, FR-3) |
| `src/v0.1/extension.js` | edit | planned | Import the accepted gate capability into the existing single extension factory; no standalone extension |
| `scripts/build-plugin.mjs` | edit | planned | Extend the closed root-source/output allowlist only when a profile is accepted |
| `.specs/plan-gate/fixtures/**` | create | planned | Real plan/spec-tree/fault fixtures with provenance (FR-12) |
| `docs/validation/plan-gate-manual-release.json` | create | planned | Hash-bound manual profile receipts (FR-13) |
| `docs/validation/plan-gate-host-abi.json` | create | blocked | Exact supported-host source/behavior receipt for CHK-HOST-ABI-01 |
| `docs/omp-plan-approval-event-contract.md` | delivered | contract-only | Exact future host ABI; does not prove runtime support |
| `docs/omp-v17.3.7-contract.md` | delivered | contract-only | Current pin explicitly records selected-plan event absence |

## Impact analysis

No destructive action is planned. Manual validation is a separate post-v0.3 capability and performs bounded reads only. Automatic adapter/build inclusion is prohibited until TASK-11 proves an exact supported host pin. Neither profile mutates plan/spec/repository bytes or reinterprets historical v0.3 receipts.
