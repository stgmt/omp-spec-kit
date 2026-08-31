# File Changes

The root JavaScript tree is the source of truth. Generated package output is produced only by the normal build.

| Path | Action | State | Reason |
|---|---|---|---|
| `src/gate/validate-exact-plan.js` | create | planned | One pure `validateExactPlan` implementation for FR-1 through FR-6 |
| `scripts/build-plugin.mjs` | edit | planned | Include the validator in the existing installed package build |
| `tests/plan-gate/validate-exact-plan.test.js` | create | planned | Focused behavior, boundary, determinism, and side-effect checks |
| `tests/fixtures/plan-gate/**` | create | planned | Real captured plans, derivation records, manifests, and labeled synthetic boundaries for FR-7 |

## Impact analysis

No destructive repository action is planned. The capability adds one library module and test evidence. It does not change OMP approval, add an agent-facing tool, mutate specifications, or reinterpret historical v0.3.2 receipts.
