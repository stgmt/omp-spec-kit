# File Changes

Root JavaScript is source of truth and `scripts/build-plugin.mjs` copies it into the single child `dist/**`. Delivered baseline rows exist now; planned V2 rows do not imply delivery. No `plugins/omp-spec-kit/src/**` or child test workspace is supported.

## FC-1: Delivered V1 kernel core

**Requirements:** FR-1 through FR-8, FR-10 through FR-13

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/types.js` | edit | delivered immutable `spec-kernel@1`/`glfm-anchor@1` unions and limits |
| `src/kernel/identity.js` | edit | delivered V1 identity validation |
| `src/kernel/normalize.js` | edit | delivered normalization/hash/canonical JSON |
| `src/kernel/limits.js` | edit | delivered V1 bounds |
| `src/kernel/parsers/` | edit | delivered Markdown/Gherkin canonical occurrences |
| `src/kernel/graph/` | edit | delivered lossless graph/edges/invariants |
| `src/kernel/query/` | edit | delivered eight-operation QueryEnvelope@1 service |
| `src/kernel/diagnostics.js` | edit | delivered closed V1 diagnostics |
| `src/kernel/adapters/fs.js` | edit | delivered contained canonical-document reader |
| `src/kernel/index.js` | edit | delivered V1 public build/query entry |

## FC-2: Delivered extension and v0.3 first-slice projection

**Requirements:** FR-8, FR-9, FR-10

| Path | Action | State / responsibility |
|---|---|---|
| `src/v0.1/extension.js` | edit | existing single extension factory |
| `src/adapters/query-service.js` | edit | shared reader/graph/query composition |
| `src/adapters/tool-contracts.js` | edit | V1 first-slice transport contracts |
| `src/adapters/omp/register-spec-tools.js` | edit | delivered read-only historical OMP projection |
| `src/mcp/server.js` | edit | delivered one MCP server and eight-name v0.3 first slice |
| `plugins/omp-spec-kit/.mcp.json` | edit | delivered one pinned-schema MCP config |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp` | edit | delivered POSIX launcher |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp.cmd` | edit | delivered Windows launcher |
| `scripts/build-plugin.mjs` | edit | delivered closed root-to-dist build/manifest |

## FC-3: Delivered real fixtures and BDD

**Requirements:** FR-4, FR-6, FR-7, FR-10, FR-11, FR-12

| Path | Action | State / responsibility |
|---|---|---|
| `tests/fixtures/kernel/real-corpus/` | edit | delivered frozen real corpus and manifest |
| `tests/fixtures/kernel/v0.3.0/` | edit | delivered real prior-package fixture |
| `tests/features/spec-kernel.feature` | edit | delivered behavioral kernel suite |
| `tests/step-definitions/spec-kernel.steps.mjs` | edit | delivered real graph/query/containment bindings |
| `tests/features/spec-mcp.feature` | edit | delivered v0.3 first-slice parity suite |
| `tests/step-definitions/spec-mcp.steps.mjs` | edit | delivered MCP/extension/dependency bindings |
| `tests/helpers/kernel-world.mjs` | edit | delivered kernel integration fixture |
| `tests/helpers/mcp-world.mjs` | edit | delivered MCP integration fixture |
| `tests/distribution/Dockerfile` | edit | delivered dependency-absent pinned container |
| `docs/validation/release-status-v0.3.2.json` | edit | delivered public baseline identity; not per-CHK evidence by itself |

## FC-4: Planned V1 release-evidence evaluator

**Requirements:** FR-14

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/release/evaluate-kernel-eligibility.js` | create | planned pure historical v0.2/v0.3 evaluator |
| `src/kernel/release/evidence-schema.js` | create | planned exact V1 stage/profile/check validation |
| `tests/features/kernel-release-eligibility.feature` | create | planned all-not-any/lineage/profile behavior |
| `tests/step-definitions/kernel-release-eligibility.steps.mjs` | create | planned real evidence-byte evaluator bindings |

## FC-15: Planned contained step-binding profile

**Requirements:** FR-15

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/v2/step-definition.js` | create | parse contained cucumber-js patterns into StepDefinitionDocumentV2 |
| `src/kernel/v2/bind-steps.js` | create | STEP_BINDING/BINDS_STEP/diagnostics conservation |
| `src/kernel/adapters/fs.js` | edit | add optional contained step-definition source set only in V2 adapter profile |
| `tests/features/kernel-step-bindings.feature` | create | real pattern/undefined/ambiguous/containment matrix |
| `tests/step-definitions/kernel-step-bindings.steps.mjs` | create | profile evidence producer |

## FC-16: Planned generator-port read profile

**Requirements:** FR-16

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/v2/query-contracts.js` | create | closed QueryEnvelopeV2 and 11 operations |
| `src/kernel/v2/query-service.js` | create | implement exact V2 args/data/errors/bounds/cursors |
| `src/mcp/server.js` | edit | build dormant mapped names beside the preserved first slice before evidence; public tools/list activates them only after profile acceptance without rebuilding |
| `tests/features/kernel-generator-reads.feature` | create | exhaustive operation/negative/cursor/profile matrix |
| `tests/step-definitions/kernel-generator-reads.steps.mjs` | create | profile evidence producer |

## FC-17: Planned adapter-I/O profile

**Requirements:** FR-17

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/v2/adapter-contracts.js` | create | closed AdapterEnvelopeV2 requests/results/errors |
| `src/kernel/adapters/fs.js` | edit | document/attachment containment and bounds |
| `src/mcp/server.js` | edit | build four dormant non-query I/O mappings before evidence; activate the same artifact only after profile acceptance |
| `tests/features/kernel-adapter-io.feature` | create | preflight/document/attachment/containment matrix |
| `tests/step-definitions/kernel-adapter-io.steps.mjs` | create | profile evidence producer |

## FC-18: Planned Marksman anchor migration profile

**Requirements:** FR-13

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/v2/anchors.js` | create | marksman-anchor@2 slug/allocation/migration rows |
| `src/kernel/v2/graph.js` | create | GraphSnapshotV2 carriers/fingerprint |
| `tests/features/kernel-anchor-migration.feature` | create | pinned slug golden, 150-document migration, cursor refusal |
| `tests/step-definitions/kernel-anchor-migration.steps.mjs` | create | CHK-FR13-02 evidence producer |

## FC-19: Planned capability eligibility evaluator

**Requirements:** FR-13, FR-15, FR-16, FR-17

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/v2/evaluate-capability-eligibility.js` | create | closed four-profile baseline/evidence/result evaluator |
| `src/kernel/v2/capability-evidence-schema.js` | create | exact manifests, evidence documents and blockers |
| `scripts/build-plugin.mjs` | edit | include dormant pre-registration profile code/mappings in the candidate before proof; activation consumes eligibility without changing artifact bytes |

## Excluded changes

No watcher, database, lock, progress/state writeback, hook/advisor/dashboard, mutation/CAS writer, second plugin, second extension factory or second MCP server identity is permitted.
