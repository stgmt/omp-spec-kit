# Changelog

## 2026-08-28 — adversarial review folded into this spec

GitHub issue #7 is owned here. Findings from adversarial review are now requirements, not a side note.

### Changed

- FR-1: LSP does not shrink the eight MCP query tools. The 46-tool door is upstream `dev-pomogator`, not this product.
- FR-2: this stage does not advertise `codeAction`.
- FR-6: hover uses only kernel-stored fields; run result/provenance/freshness are out of scope.
- FR-7 and FR-12: this stage forbids a step-binding layer; CHK-FR7-01 and CHK-FR12-01 are absence proofs. Oracle parity is not a release member.
- FR-9: didSave rebuilds through the existing kernel build; 150 ms p95 is not a pass/fail gate.
- FR-10: Markdown outside `.specs/**` is an empty no-op.
- FR-11: sources at `src/lsp/*.js`; no cucumber libraries in this stage.
- ROADMAP: sibling stage "one LSP adapter" after v0.2, owning spec `.specs/spec-lsp/`.

### Excluded (still)

- Deleting the eight MCP query tools (route cursor work through LSP instead).
- Adapter-side step matching before `spec-kernel:CHK-FR15-01`.
- Claiming 150 ms incremental rebuild.



## 2026-08-23 — initial specification draft

### Added

- Defined the LSP adapter as a second read-only projection of the `spec-kernel` query service, sibling to the v0.3 MCP adapter.
- Defined 12 functional requirements covering: semantic-free read projection (FR-1), read-only posture with proposal-only code actions (FR-2), spec-layer diagnostics mapped from kernel findings (FR-3), definition/references via kernel anchor registry (FR-4), completion and documentSymbol (FR-5), hover for node body and scenario provenance (FR-6), step layer centralization with bundled libraries (FR-7), adapter-to-service parity check (FR-8), incremental budget and lazy start (FR-9), scope containment and honest absence (FR-10), self-contained distribution (FR-11), oracle parity for cucumber-runner step verdicts (FR-12).
- Defined 12 acceptance criteria in EARS format.
- Defined 12 contract checks (CHK-FR1-01 through CHK-FR12-01) including fingerprint-bound parity and oracle-parity harnesses.
- Defined non-functional requirements for latency, bundle size, memory, containment, determinism, portability, and diagnostic bounds.
- Documented rejected alternatives: dual external server (divergence), Marksman adoption (binary DROP), MCP-wraps-LSP (nested protocol), LSP-only (loses domain queries).
- Established release boundary: sibling stage to v0.3 MCP adapter, requires kernel v0.2 accepted first, SHALL NOT loosen product:FR-6 cumulative gates.
- Added traceability from 12 functional requirements to 12 acceptance criteria and 12 stable-ID Gherkin scenarios.
- Added 8 user stories and 10 use cases.
- Defined fixture admission policy per `spec-kernel:FR-11` posture.
- Defined versioned schema contracts for diagnostic mapping, request-response shapes, and oracle-fixture contract.

### Excluded

- Mutation, proposal persistence, status transition, or any write operation through the LSP surface.
- External `@cucumber/language-server` registration in production configuration.
- Marksman or any third-party binary LSP distribution.
- Claims of implementation completion, executed scenarios, or release readiness.
- Arbitrary project Markdown indexing outside `.specs/**`.

### Provenance

The specification derives decisions from `MIGRATION_MATRIX.md`, `spec-kernel:FR-9` (MCP projection mirror), `spec-kernel:FR-14` (release gate model), `.dev-pomogator/issue7-current.md` (design brief), and OMP documentation (`docs/tools/lsp.md`, `docs/lsp-config.md`, `docs/settings.md`, `docs/marketplace.md`). It does not import implementation code.
