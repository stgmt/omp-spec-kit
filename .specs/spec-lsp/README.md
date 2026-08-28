# spec-lsp

One standalone specification for a custom LSP adapter as a second read-only projection of the `spec-kernel` query service: a single bundled LSP server that consumes the same kernel graph and query operations used by the OMP extension and the v0.3 MCP adapter.

This specification is the home for GitHub issue [#7](https://github.com/stgmt/omp-spec-kit/issues/7). Adversarial review (2026-08-28) is folded in: this product's MCP surface is eight query tools, not a 46-tool door to prune; this stage has no step-binding layer; 150 ms incremental is not a gate; hover shows only kernel-stored fields; `codeAction` is not advertised.

## Status

SPEC_ONLY. Gherkin scenarios are specification text with no executed status. The capability is the ROADMAP sibling stage "one LSP adapter" after accepted kernel v0.2. It does not replace v0.3 MCP and does not unlock authoring.

## Why a separate spec

`spec-kernel:FR-9` defines the v0.3 MCP projection as a semantic-free read-only adapter over the shared query service (exactly eight tools). The LSP adapter is an analogous projection onto a different protocol surface: LSP navigation, diagnostics, hover, completion, and document symbols. It is not an MCP wrapper, not a second graph, not a replacement for those eight MCP tools, and not a cut of upstream `dev-pomogator` spec-MCP.

Marksman and an external `@cucumber/language-server` stay rejected. A Gherkin step-binding layer is **deferred**: the kernel has no `StepBinding` node kind and cannot read `tests/step-definitions/**`. Shipping step diagnostics here would be a second index.

## Provenance and evidence

- OMP-side LSP contracts are cited from pinned documentation. Every cited runtime contract must be re-proven live by TASK-1 probes before implementation.
- GitHub issue #7 and `.dev-pomogator/issue7-current.md` are research input. Their 46-tool table is not this product's MCP registry.
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

