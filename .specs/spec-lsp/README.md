# spec-lsp

One standalone specification for a custom LSP adapter as a second read-only projection of the `spec-kernel` query service: a single bundled LSP server that consumes the same kernel graph and query operations used by the OMP extension and the v0.3 MCP adapter, covering both `.specs/**` Markdown documents and `.feature` Gherkin files, with the Gherkin step layer centralized inside it.

## Status

SPEC_ONLY. All tasks are `Planned`; every Gherkin scenario is specification text with no executed status. The capability belongs to the roadmap stage class sibling to v0.3 (one MCP adapter): it is a second projection of the same kernel query service and requires the same evidence discipline before any release.

## Why a separate spec

`spec-kernel:FR-9` defines the v0.3 MCP projection as a semantic-free read-only adapter over the shared query service. The LSP adapter is an analogous projection onto a different protocol surface: LSP navigation, diagnostics, hover, completion, and document symbols. It is not an MCP wrapper, not a second graph, and not a replacement for the MCP adapter. The upstream `dev-pomogator` design recorded the decision "MCP and LSP as separate layers, not nested" (`docs/upstream/dev-pomogator/spec-generator-v4/DESIGN.md`, provenance); this specification rewrites that separation as two sibling adapters of one kernel.

The step layer centralization decision — bundling `@cucumber/gherkin` and `@cucumber/cucumber-expressions` as libraries inside this server rather than registering the external `@cucumber/language-server` process in production — avoids dual-index divergence, configuration conflicts, multi-runner silence, and lifecycle duplication. The official `@cucumber/language-server` remains available only as a test-infrastructure oracle on shared fixtures.

## Provenance and evidence

- OMP-side LSP contracts are cited from the installed `pi-coding-agent` source paths and pinned documentation (`docs/tools/lsp.md`, `docs/lsp-config.md`, `docs/settings.md`, `docs/marketplace.md`, `packages/coding-agent/src/prompts/tools/lsp.md`). These documents are mutable upstream references; every cited runtime contract must be re-proven live by TASK-1 probes before implementation.
- Upstream LSP design analysis in `E:\repos\.dev-pomogator\issue7-current.md` is research input only. Its tool-migration table, budget figures, and architectural decisions inform this specification but are not target authority.
- The upstream `dev-pomogator` DESIGN.md decision record ("MCP and LSP as separate layers") and RESEARCH.md Appendix C/G (push-diagnostics, tool cliff) are prior-art research input, not target architecture.
- `MIGRATION_MATRIX.md` DROP rows FR-7 (Marksman LSP plugin) and FR-27 (Marksman binary supply chain) stand: this specification does not resurrect Marksman or any third-party binary LSP distribution.
- `MIGRATION_MATRIX.md` DROP rows FR-5 and FR-6 (Claude hook families) stand: no hook-based diagnostic delivery is carried into this specification; OMP's native `lsp.diagnosticsOnWrite` provides automatic post-write diagnostics.

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

The LSP adapter may not ship in v0.1.0 or v0.2. It is a sibling stage to the v0.3 MCP adapter ("one LSP adapter"), requiring an explicit ROADMAP stage decision. Entry requires: accepted `spec-kernel:FR-14` for v0.2 (the kernel must exist first); TASK-1 live ABI probes against real OMP LSP infrastructure; the dependency-absent self-contained bundle proof per `spec-kernel:FR-10` posture; adapter-to-service parity evidence per FR-8 / CHK-FR8-01; oracle-parity evidence for cucumber-runner step verdicts per FR-6 / CHK-FR6-01; and an independent adversarial review. This spec SHALL NOT loosen the `product:FR-6` cumulative gates for the authoring/mutation stage class. Kernel v0.2 MUST be accepted before this adapter may enter any release candidate.
