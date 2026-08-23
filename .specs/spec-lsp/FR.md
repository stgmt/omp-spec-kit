# Functional Requirements

All runtime identities in this specification use `spec-lsp:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status. This adapter is a sibling projection of the `spec-kernel` query service, analogous to `spec-kernel:FR-9` (MCP projection).

## FR-1: One-server semantic-free read projection

The LSP adapter SHALL be a single bundled server that consumes the same `spec-kernel` query service used by the OMP extension and the v0.3 MCP adapter. It SHALL add no parsing, resolution, anchor, link, or verdict semantics of its own. Every navigation, diagnostic, hover, completion, and symbol answer SHALL derive from kernel query operations. Its public capability set SHALL contain no mutation, proposal, apply, repair, archive, status-transition, or write operation. LSP absence or failure SHALL NOT create a second graph implementation or weaken extension or MCP behavior.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-lsp-is-a-semantic-free-read-projection)

**Scenario:** `@feature1` / `SCEN-spec-lsp-read-projection-only`

**Sources:** `spec-kernel:FR-9` (MCP projection mirror wording); `MIGRATION_MATRIX.md` rows FR-4, FR-38, FR-82; `.dev-pomogator/issue7-current.md` architectural decision.

## FR-2: Read-only posture with proposal-only code actions

The server SHALL NOT use `workspace/applyEdit`. Code actions MAY propose repairs by returning descriptive titles and edit previews, but application of any edit SHALL belong to the future authoring door. The server SHALL perform no mutation, proposal persistence, or status transition. When the authoring door is not yet available, code actions SHALL return proposal descriptions only, without actionable `WorkspaceEdit` payloads.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-no-mutation-and-code-actions-propose-only)

**Scenario:** `@feature2` / `SCEN-spec-lsp-read-only-code-actions`

**Sources:** `spec-kernel:FR-1` (read-only boundary); RESEARCH RF-4, RISK-1.

## FR-3: Spec-layer diagnostics mapped from kernel conformance findings

LSP diagnostics for `.specs/**` Markdown documents SHALL be a 1:1 mapping of kernel conformance findings. Each diagnostic SHALL carry the kernel finding's code, repository-relative file path, 1-based line, and bounded message. The server SHALL NOT introduce diagnostic rules, severity overrides, or filtering beyond what the kernel produces. Diagnostic ordering SHALL be deterministic per `spec-kernel:FR-6`.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-diagnostics-are-kernel-findings-mapped-one-to-one)

**Scenario:** `@feature3` / `SCEN-spec-lsp-diagnostics-map-kernel-findings`

**Sources:** `spec-kernel:FR-6` (diagnostics); `.dev-pomogator/issue7-current.md` §Черновик требований item 3.

## FR-4: Definition and references through the kernel anchor registry

`textDocument/definition` SHALL resolve references through the kernel anchor registry with the same ambiguity semantics as `spec-kernel:FR-4`: an unambiguous reference returns one location; an ambiguous bare ID returns all candidates. `textDocument/references` SHALL return all backlinks from the kernel edge index for the target canonical ID, including the declaration when `includeDeclaration` is true. Cross-spec qualified references SHALL resolve across spec slugs. Unresolvable references SHALL produce no location and SHALL NOT fabricate targets.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-definition-and-references-use-kernel-anchor-semantics)

**Scenario:** `@feature4` / `SCEN-spec-lsp-definition-references-anchor-registry`

**Sources:** `spec-kernel:FR-4` (duplicate handling), `spec-kernel:FR-5` (edge resolution); `.dev-pomogator/issue7-current.md` §Черновик требований item 4.

## FR-5: Completion over registered aliases and documentSymbol outline

`textDocument/completion` SHALL offer completion items drawn from the kernel's registered canonical IDs and aliases, filtered by the typed prefix. `textDocument/documentSymbol` SHALL produce a hierarchical outline of spec nodes in the target document, reflecting the kernel's parsed node inventory with correct ranges and nesting. Both operations SHALL return empty results rather than fabricated entries when the kernel graph is unavailable.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-completion-and-outline-reflect-kernel-nodes)

**Scenario:** `@feature5` / `SCEN-spec-lsp-completion-and-document-symbol`

**Sources:** `spec-kernel:FR-2` (supported documents and entity IDs); `.dev-pomogator/issue7-current.md` tool migration table.

## FR-6: Hover surfaces node body and scenario provenance

`textDocument/hover` on a spec definition node SHALL return the node body and status fields from the kernel graph. On a scenario reference (`@id:SCEN-*` tag in `.feature` files), hover SHALL surface result, provenance, and freshness fields from the graph. Staleness SHALL surface as diagnostics per the evidence model by reference; the server SHALL NOT reimplement staleness logic. When the graph has no data for the hovered position, hover SHALL return empty rather than fabricated content.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-hover-returns-kernel-node-body-and-scenario-provenance)

**Scenario:** `@feature6` / `SCEN-spec-lsp-hover-node-and-scenario`

**Sources:** `spec-kernel:FR-8` (query service); `.dev-pomogator/issue7-current.md` tool migration table.

## FR-7: Step layer centralization with bundled libraries

The server SHALL serve `.feature` file navigation and diagnostics using `@cucumber/gherkin` and `@cucumber/cucumber-expressions` as bundled JS libraries plus the kernel graph's `StepBinding` nodes and `step-binding` edges. Step decisions (defined, undefined, ambiguous) SHALL be served for all supported runners including pytest-bdd. The external `@cucumber/language-server` process SHALL NEVER be registered in the production plugin configuration. Step diagnostics for cucumber-runner fixtures SHALL match the oracle verdicts per FR-10.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-step-layer-uses-bundled-libraries-not-external-server)

**Scenario:** `@feature7` / `SCEN-spec-lsp-step-layer-centralized`

**Sources:** `.dev-pomogator/issue7-current.md` §Слой степов; RESEARCH RF-3.

## FR-8: Adapter-to-service parity check

A release check `CHK-FR8-01` SHALL prove that LSP `textDocument/definition`, `textDocument/references`, and `publishDiagnostics` answers equal the corresponding kernel query service answers on shared fixtures. The check SHALL be fingerprint-bound to the declared corpus. Any divergence SHALL fail closed. This check is analogous to `spec-kernel:FR-14` / `CHK-FR9-01` for the MCP adapter.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-parity-check-proves-lsp-equals-kernel-on-fixtures)

**Scenario:** `@feature8` / `SCEN-spec-lsp-adapter-to-service-parity`

**Sources:** `spec-kernel:FR-14` (conjunctive release eligibility), `CHK-FR9-01` (MCP adapter parity); `.dev-pomogator/issue7-current.md` §Черновик требований item 1.

## FR-9: Incremental re-evaluation budget and lazy start

Incremental re-evaluation of a touched spec document SHALL complete in at most 150 ms p95 over 20 samples after warm-up. Full-corpus work SHALL occur only at startup or explicit `workspace/didChangeConfiguration` reload. The server SHALL be compatible with OMP `lsp.lazy` default (start on first use) and SHALL NOT require eager initialization. Cold-start full-corpus build latency SHALL respect `spec-kernel:NFR-PERF-1` budgets.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-incremental-re-evaluation-meets-budget)

**Scenario:** `@feature9` / `SCEN-spec-lsp-incremental-budget`

**Sources:** `.dev-pomogator/issue7-current.md` §Черновик требований item 5; `spec-kernel:NFR-PERF-1`; RESEARCH RF-5, RISK-2.

## FR-10: Scope containment and honest absence

The server SHALL operate on `.specs/**` canonical documents and the project's authored `.feature` files only. It SHALL refuse external workspace roots, symlinks, junctions, reparse points, and traversal per `spec-kernel:FR-7` posture. It SHALL NOT index arbitrary project Markdown outside `.specs/`. When the kernel graph is unavailable, diagnostics SHALL explain why; no degraded fake resolution SHALL be returned. This is the dead-integration-guard lineage: installed ≠ integrated.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-scope-is-contained-and-absence-is-honest)

**Scenario:** `@feature10` / `SCEN-spec-lsp-scope-containment-and-honest-absence`

**Sources:** `spec-kernel:FR-7` (bounded repository containment); RESEARCH RF-6; `.dev-pomogator/issue7-current.md` §Черновик требований items 6, 7.

## FR-11: Self-contained dependency-safe distribution

The server SHALL be registered through the plugin's `lspServers` manifest field, producing `.lsp.json` at install time. The runtime SHALL be a dependency-safe self-contained bundle per `spec-kernel:FR-10` posture: JS libraries (`@cucumber/gherkin`, `@cucumber/cucumber-expressions`, `vscode-languageserver`) are fully bundled; NO third-party binaries are included or required (the Marksman DROP stands). The server SHALL work with OMP `lsp.shared` broker semantics without holding locks of its own. It SHALL execute from the installed artifact with source checkout and root `node_modules` absent.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-installed-server-is-self-contained-and-binary-free)

**Scenario:** `@feature11` / `SCEN-spec-lsp-self-contained-distribution`

**Sources:** `spec-kernel:FR-10` (self-contained runtime); `MIGRATION_MATRIX.md` FR-7/FR-27 DROP; RESEARCH RF-3, RF-7; `.dev-pomogator/issue7-current.md` §Замечание по дистрибуции.

## FR-12: Oracle parity for cucumber-runner step verdicts

The official `@cucumber/language-server` SHALL be used ONLY in the test infrastructure as a decision oracle on shared fixtures for cucumber-runner step verdicts. A release check `CHK-FR12-01` SHALL prove that the custom server's step defined/undefined/ambiguous verdicts match the oracle's verdicts on the shared cucumber-runner fixture set. pytest-bdd fixtures SHALL receive step diagnostics of equivalent quality (no silence). The oracle process SHALL NOT appear in the production plugin configuration.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-oracle-parity-proves-step-verdict-agreement)

**Scenario:** `@feature12` / `SCEN-spec-lsp-oracle-parity`

**Sources:** `.dev-pomogator/issue7-current.md` §Официальный сервер как тестовый оракул; RESEARCH RF-3.
