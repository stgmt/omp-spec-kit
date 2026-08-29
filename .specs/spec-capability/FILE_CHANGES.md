# File Changes

Every row is planned future work under the repository-root JavaScript build convention. The delivered v0.3 payload is unchanged until the capability aggregate passes.

| Path | Action | Requirements | Responsibility |
|---|---|---|---|
| `src/kernel/extensions/capability/schema.js` | create | FR-1, FR-2, FR-3, FR-7 | Register CAPABILITY nodes, DERIVES_FROM edges, lifecycle and diagnostics for kernel@2. |
| `src/kernel/parsers/capability.js` | create | FR-1, FR-7 | Parse optional owning-spec CAPABILITIES.md and qualified IDs. |
| `src/kernel/graph/capability-edges.js` | create | FR-2, FR-3 | Resolve qualified Covers declarations under the closed endpoint matrix. |
| `src/kernel/query/capability.js` | create | FR-4, FR-5, FR-6 | Implement requirementsOf, capabilitiesOf and graph-only getImpact. |
| `src/evidence/capability-invalidation.js` | create | FR-6 | Join graph impact to an explicit evidence snapshot and return binding proof. |
| `src/mcp/capability-tools.js` | create | FR-8 | Register MCP-only one-to-one capability projections. |
| `src/kernel/release/capability-eligibility.js` | create | FR-9 | Evaluate delivered baseline, kernel profile and exact 16-record graph or 18-record overlay aggregate with role-typed baseline/evidence bytes. |
| `scripts/build-plugin.mjs` | edit | FR-8, FR-9 | Add capability sources to the generated payload only at capability release. |
| `tests/fixtures/spec-capability/` | create | FR-1 through FR-7 | Real owning-spec/graph/evidence fixtures plus minimal one-fault variants. |
| `docs/validation/spec-capability-release.md` | create | FR-9, FR-10 | Record candidate-bound aggregate, MCP parity and independent boundary review. |

No `src/adapters/omp/register-spec-tools.*`, child `plugins/omp-spec-kit/src/**`, mutation API, direct filesystem query or second graph is permitted.
