# Changelog

## 2026-08-29 — corpus contract closure

### Changed

- Product capability state is `SPECIFIED`; runtime and release evidence remain absent.
- Added AC-7.2 / SCEN-spec-lsp-future-step-profile / CHK-FR7-02 for the separately gated future step projection.
- Added seven explicit NFR checks and TASK-13; the current read-profile gate now requires twelve FR checks plus seven NFR checks.
- Closed hover, availability, normalized parity, release-record, blocker, containment and numeric-bound schemas.
- Preserved related diagnostics in parity; closed severity and UTF-32/UTF-16 coordinate conversion; added rehashed baseline/current/step eligibility evidence with self-binding results and deterministic fingerprints.
- Replaced synthetic parity input with a pending real current-corpus dual-producer capture; retained the 30/450 generator only for performance.
- Pinned all OMP LSP citations to commit `8500092296621a6826b7136e840f8a59ea338958` and removed the nonexistent local issue-copy reference.

## 2026-08-28 — adversarial review folded into this spec

GitHub issue #7 is owned here. Adversarial review is folded in.

### Changed

- Agent-facing spec API is MCP only. LSP is not an agent tool; MCP may consume LSP internally.
- Eight MCP tools are the v0.3 first slice. Destination reads are spec-kernel FR-16/FR-17 plus evidence plus authoring. Mutations stay in spec-authoring-workflow.
- FR-1: LSP does not shrink the eight first-slice MCP query tools.
- US-2/US-3/US-4 and UC-2/UC-3/UC-4: editor or MCP adapter uses LSP primitives; the agent calls first-slice MCP `spec_get_node` / `spec_get_edges` / `spec_find_nodes`.
- RF-16 points at `docs/decisions/spec-generator-port.md` as the canonical census; `list_specs` and full `get_spec_status` are later FR-16, not the first-slice `spec_inventory` / `spec_overview`.


- FR-2: this stage does not advertise `codeAction`.
- FR-6: hover uses only kernel-stored fields; run result/provenance/freshness are out of scope.
- FR-7 and FR-12: this stage forbids a step-binding layer; CHK-FR7-01 and CHK-FR12-01 are absence proofs. Oracle parity is not a release member.
- FR-9: didSave rebuilds through the existing kernel build; 150 ms p95 is not a pass/fail gate.
- FR-10: Markdown outside `.specs/**` is an empty no-op.
- FR-11: sources at `src/lsp/*.js`; no cucumber libraries in this stage.
- ROADMAP: sibling stage "one LSP adapter" after v0.2, owning spec `.specs/spec-lsp/`.

### Excluded (still)

- Deleting the eight first-slice MCP query tools (route cursor work through LSP instead).

- Adapter-side step matching before `spec-kernel:CHK-FR15-01`.
- Claiming 150 ms incremental rebuild.



## 2026-08-23 — initial specification draft (historical, superseded)

The bullets below record the original draft and are not current contract authority; the 2026-08-28 and 2026-08-29 entries supersede proposal code actions, scenario evidence hover, adapter-side step matching, oracle parity, and the 150 ms gate.

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

The initial design brief was GitHub issue [#7](https://github.com/stgmt/omp-spec-kit/issues/7). Current OMP authority is the immutable v17.3.7 pin: [LSP tool](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/tools/lsp.md), [LSP config](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/lsp-config.md), [settings](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/settings.md), and [marketplace](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md). The spec imports no implementation code.
