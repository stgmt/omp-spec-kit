# spec-lsp

LSP adapter for the OMP port of the spec-generator door. **The agent sees MCP only.** LSP is a bundled server the MCP adapter (and the editor) may consume. It is not an agent tool.

The eight MCP tools in `src/mcp/server.js` are the v0.3 **first slice**. Destination query reads belong to [spec-kernel FR-16](../spec-kernel/FR.md#fr-16-generator-port-read-operations-beyond-the-eight), document/preflight adapter I/O belongs to [spec-kernel FR-17](../spec-kernel/FR.md#fr-17-mcp-adapter-document-and-preflight-io-not-a-v02v03-release-member), scenario-result reads belong to `spec-evidence`, and mutations stay in `spec-authoring-workflow`.

GitHub issue [#7](https://github.com/stgmt/omp-spec-kit/issues/7) is owned here, with the correction that navigation stays on MCP (implementation may use LSP/kernel). The agent never calls OMP `lsp` for spec work.

## Status

SPECIFIED. Product capability `LSP_ADAPTER` is contract-complete but not implemented or release-evidenced. It remains a ROADMAP sibling stage after the delivered kernel baseline, does not replace v0.3 MCP, and does not unlock authoring.

## Why a separate spec

MCP is the generator door. LSP is not a second agent API and not a way to delete MCP tools. Kernel owns graph semantics (including FR-15 step bindings). LSP/MCP project those answers.


## Provenance and evidence

- OMP-side LSP contracts are cited from immutable commit `8500092296621a6826b7136e840f8a59ea338958` (the v17.3.7 implementation pin). Every cited runtime contract must be re-proven live by TASK-1 probes before implementation.
- GitHub issue [#7](https://github.com/stgmt/omp-spec-kit/issues/7) is research input. The canonical 46-name port census is [`docs/decisions/spec-generator-port.md`](../../docs/decisions/spec-generator-port.md), not an absent local issue copy. Eight SCHEMA-11 tools are the v0.3 first slice; destination growth is kernel FR-16/FR-17, evidence, and authoring.

- `MIGRATION_MATRIX.md` DROP rows FR-7 and FR-27 (Marksman) stand.
- `MIGRATION_MATRIX.md` DROP rows FR-5 and FR-6 (Claude hook families) stand; OMP `lsp.diagnosticsOnWrite` is the diagnostic path.

## Documents

| Document | Role |
|---|---|
| [USER_STORIES.md](USER_STORIES.md) | Personas and independent tests |
| [USE_CASES.md](USE_CASES.md) | Interaction flows |
| [RESEARCH.md](RESEARCH.md) | Findings, risks, evidence |
| [FR.md](FR.md) | Functional requirements |
| [NFR.md](NFR.md) | Budgets and non-functional requirements |
| [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | EARS criteria |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Traceability matrix, contract checks, invariants |
| [DESIGN.md](DESIGN.md) | Components, algorithms, decisions |
| [TASKS.md](TASKS.md) | Planned task DAG |
| [spec-lsp.feature](spec-lsp.feature) | Gherkin specification scenarios |
| [FILE_CHANGES.md](FILE_CHANGES.md) | Planned file surface |
| [FIXTURES.md](FIXTURES.md) | Fixture admission policy |
| [spec-lsp_SCHEMA.md](spec-lsp_SCHEMA.md) | Versioned public schemas |
| [CHANGELOG.md](CHANGELOG.md) | Specification change log |

## Release boundary

The LSP adapter may not ship in v0.1.0 or v0.2. It is the ROADMAP sibling stage "one LSP adapter" after accepted `spec-kernel:FR-14` for v0.2. It SHALL NOT claim to satisfy or replace v0.3 MCP evidence. It SHALL NOT loosen `product:FR-6` authoring gates.

Entry: TASK-1 live ABI probes; FR-11 / CHK-FR11-01 bundle proof; FR-8 / CHK-FR8-01 parity; FR-7 / CHK-FR7-01 and FR-12 / CHK-FR12-01 **absence** of a step layer; CHK-FR9-01 measured didSave rebuild without a 150 ms pass/fail. Kernel v0.2 MUST be accepted first.

