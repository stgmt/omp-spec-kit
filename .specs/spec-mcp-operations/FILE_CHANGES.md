# FILE CHANGES

## Read / Core

Root source remains authoritative; the child plugin is built from it. Rows marked **NEXT** are implementation targets and do not claim delivery. This map names only root-source, built, test, and fixture paths.

## FC-1: Core graph and parser

**Requirements:** [FR-1](FR.md#fr-1-pure-occurrence-first-core), [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids), [FR-3](FR.md#fr-3-typed-graph-conservation)

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/types.js` | edit | **NEXT** core source and occurrence types |
| `src/kernel/normalize.js` | edit | **NEXT** source normalization and fingerprint inputs |
| `src/kernel/parsers/` | edit | **NEXT** role-aware occurrence parsers |
| `src/kernel/graph/` | edit | **NEXT** identity, typed edges, conservation |
| `src/kernel/diagnostics.js` | edit | **NEXT** deterministic structural diagnostics |
| `src/kernel/index.js` | edit | **NEXT** one core entry point |

## FC-2: Four primitives and adapters

**Requirements:** [FR-4](FR.md#fr-4-four-bounded-core-primitives), [FR-5](FR.md#fr-5-contained-inputs-and-budgets), [FR-6](FR.md#fr-6-historical-eight-name-compatibility)

| Path | Action | State / responsibility |
|---|---|---|
| `src/kernel/query/` | edit | **NEXT** inventory/findNodes/traverse/diagnostics and shared envelope |
| `src/kernel/adapters/fs.js` | edit | **NEXT** contained canonical source reader |
| `src/adapters/query-service.js` | edit | **SHIPPED** compatibility composition; adapt to one core |
| `src/adapters/omp/register-spec-tools.js` | edit | **SHIPPED** OMP compatibility projection |
| `src/mcp/server.js` | edit | **SHIPPED** eight-name MCP compatibility projection |
| `scripts/build-plugin.mjs` | edit | **SHIPPED** root-to-child packaging |

## FC-3: Fixtures and behavioral evidence

**Requirements:** [FR-6](FR.md#fr-6-historical-eight-name-compatibility), [FR-8](FR.md#fr-8-real-fixtures-and-measurable-budgets)

| Path | Action | State / responsibility |
|---|---|---|
| `tests/fixtures/kernel/real-corpus/` | edit | **SHIPPED** target-owned real corpus |
| `tests/fixtures/kernel/real-corpus-manifest.json` | edit | **SHIPPED** provenance, hashes, oracle counts |
| `tests/fixtures/kernel/v0.3.0/` | edit | **SHIPPED** prior-package fixture |
| `tests/features/spec-mcp-operations.feature` | edit | **NEXT** core behavior scenarios |
| `tests/features/spec-mcp.feature` | edit | **SHIPPED** compatibility behavior scenarios |
| `tests/helpers/kernel-world.mjs` | edit | **NEXT** core fixture harness |
| `tests/helpers/mcp-world.mjs` | edit | **SHIPPED** MCP compatibility harness |
| `docs/validation/release-status-v0.3.2.json` | edit | **SHIPPED** historical public receipt identity |

## Non-goals

No second runtime, parser fork, editor-anchor authority, capability grammar, JavaScript/Cucumber matcher, public release evaluator, persistence, watcher, mutation surface, or sibling/global file ownership is introduced.

## Read / Evidence

All paths are repository-relative and NEXT. Root `src/` is source; plugin `dist/` is generated. No runtime delivery is claimed.

| Path | Action | Reason |
|---|---|---|
| `src/evidence/evaluate.js` | create | Pure evaluation entry (FR-9, FR-17) |
| `src/evidence/capture.js` | create | Trusted run capture, containment, scope, hashes (FR-10, FR-11, FR-13, FR-18) |
| `src/evidence/ingest/cucumber-messages.js` | create | Real Cucumber Messages parser (FR-10) |
| `src/evidence/ingest/pytest-bdd.js` | create | Real pytest-bdd parser (FR-10) |
| `src/evidence/join.js` | create | Stable ID/tag join and name diagnostics (FR-12) |
| `src/evidence/freshness.js` | create | Scenario/step/implementation freshness (FR-14) |
| `src/evidence/readiness.js` | create | Required-scenario and waiver evidence states (FR-15, FR-16) |
| `src/evidence/mcp-projection.js` | create | ScenarioEvidence and EvidenceRef trace projection (FR-22) |
| `scripts/build-plugin.mjs` | edit | Add evidence sources to the closed build mapping when implemented (FR-9) |
| `tests/fixtures/spec-mcp-operations/` | create | Real producer captures and labeled derivatives (FR-19) |

Removed from the plan: overlay parser, binding sidecar, census module, custom invariant/release evaluators, evidence release receipt document, and standalone trace identity.

## Impact

Implementation adds one read-only evidence capability after the SHIPPED v0.3.2 baseline. It does not modify historical receipts or the existing eight-tool first slice. Product readiness consumes ordinary task/scenario evidence rather than a new evidence-specific release protocol.

## Write

**Status:** Future implementation map for the `NEXT` capability. No row claims current delivery.

| Planned path | Action | Requirements | Purpose |
|---|---|---|---|
| `src/authoring/operations.js` | create (planned) | FR-24, FR-25, FR-28 | Closed internal edit-operation compilers, deterministic hashing, byte/EOL preservation |
| `src/authoring/proposal.js` | create (planned) | FR-24, FR-25 | Pure in-memory proposal, bounded diff, kernel validation and anchor expansion |
| `src/authoring/transaction.js` | create (planned) | FR-26, FR-27, FR-28 | Spec lock, CAS, revalidation, same-filesystem stage, atomic swap, internal rollback, receipt |
| `src/authoring/index.js` | create (planned) | FR-23–FR-28 | One internal service surface consumed only by the existing MCP server |
| `src/mcp/server.js` | edit (planned) | FR-23, FR-26 | Register the exact two public mutation tools and delegate to the authoring core |
| `src/v0.1/extension.js` | edit (planned) | FR-23 | Current-host `tool_call` path policy: exact allowlist then deny raw `.specs/**` writers |
| `scripts/build-plugin.mjs` | edit (planned) | FR-23–FR-28 | Include root authoring source in generated installed payload and fail on missing wiring |
| `plugins/omp-spec-kit/dist/authoring/**` | create (generated) | FR-23–FR-28 | Dependency-safe installed output; never hand-edited authority |
| `tests/features/spec-mcp-operations.feature` | create (planned) | FR-23–FR-29 | Executable counterpart of the fourteen specification scenarios |
| `tests/step-definitions/spec-mcp-operations.steps.mjs` | create (planned) | FR-23–FR-29 | Real handler, policy, filesystem, concurrency, fault and redaction steps |
| `tests/fixtures/spec-authoring/real-corpus/` | create (planned capture) | FR-24, FR-25, FR-28, FR-29 | Provenance-recorded kernel/anchor/byte corpus |
| `tests/fixtures/spec-authoring/filesystem/` | create (planned capture) | FR-25–FR-29 | Real Windows/POSIX containment, race, crash and generation observations |

## Forbidden additions

- another plugin, extension writer, MCP server, or public helper tool;
- release eligibility evaluator, provider/server/schema/registry authority, or evidence tuple;
- durable review state, authoring-owned task lifecycle, audit ledger, database, cache, or hidden repository state;
- public transaction, recovery, rebaseline, overwrite, or replacement-bytes surface;
- a mutation-quality runtime gate or response field;
- direct `.specs/**` writer outside the atomic authoring core;
- hand-fabricated external producer fixtures.