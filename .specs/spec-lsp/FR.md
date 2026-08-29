# Functional Requirements

All runtime identities in this specification use `spec-lsp:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status.

**Agent-facing spec API is MCP only.** OMP may expose its generic native `lsp` host tool, but this capability SHALL register no new spec-specific agent tool and product guidance SHALL route every spec-domain agent action through MCP. LSP serves the editor or MCP internally; the agent SHALL NOT be instructed to use native `lsp` for spec work.

The eight tools in `src/mcp/server.js` are the **current v0.3 first slice**, not the destination registry. Additional graph queries belong to [spec-kernel FR-16](../spec-kernel/FR.md#fr-16-generator-port-read-operations-beyond-the-eight), document/preflight adapter I/O belongs to [spec-kernel FR-17](../spec-kernel/FR.md#fr-17-mcp-adapter-document-and-preflight-io-not-a-v02v03-release-member), scenario-result reads belong to `spec-evidence`, and mutations stay in `spec-authoring-workflow`.

## FR-1: Semantic-free LSP used by MCP, invisible to the agent

The adapter SHALL be one bundled semantic-free consumer of the shared kernel service. It SHALL add no parser/verdict semantics or new agent tool. MCP remains the only agent-facing spec API; the pre-existing generic host `lsp` tool is outside this capability and MUST NOT be advertised as a spec route.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-lsp-is-a-semantic-free-read-projection)

**Scenario:** `@feature1` / `SCEN-spec-lsp-read-projection-only`

**Sources:** product port of spec-generator; RESEARCH RF-8, RF-16, RF-17.

## FR-2: Read-only posture; no agent-visible codeAction

The server SHALL NOT use `workspace/applyEdit`. This stage SHALL NOT advertise `codeAction` in `ServerCapabilities` (the agent does not call LSP; advertising codeAction would still leak a mutation-shaped host API). `textDocument/codeAction` SHALL return an empty list. Authoring remains the MCP door in `spec-authoring-workflow`.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-no-mutation-and-no-codeaction-capability-in-this-stage)

**Scenario:** `@feature2` / `SCEN-spec-lsp-read-only-code-actions`

**Sources:** `spec-kernel:FR-1`; RESEARCH RF-4, RF-8.


## FR-3: Spec-layer diagnostics mapped from kernel conformance findings

LSP diagnostics for `.specs/**` Markdown documents SHALL be a 1:1 mapping of kernel conformance findings. Each diagnostic SHALL carry the kernel finding's code, repository-relative file path, converted span, bounded message, and complete bounded related inventory. Kernel ERROR/WARNING/INFO map exactly to LSP 1/2/3; scalar columns convert through negotiated UTF-32 or UTF-16 without non-BMP drift. The server SHALL NOT introduce diagnostic rules, severity overrides, or filtering beyond what the kernel produces. Diagnostic ordering SHALL be deterministic per `spec-kernel:FR-6`.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-diagnostics-are-kernel-findings-mapped-one-to-one)

**Scenario:** `@feature3` / `SCEN-spec-lsp-diagnostics-map-kernel-findings`

**Sources:** `spec-kernel:FR-6` (diagnostics); GitHub issue #7 §Черновик требований item 3.

## FR-4: Definition and references through the kernel anchor registry

`textDocument/definition` SHALL resolve references through the kernel anchor registry with the same ambiguity semantics as `spec-kernel:FR-4`: an unambiguous reference returns one location; an ambiguous bare ID returns all candidates. `textDocument/references` SHALL return all backlinks from the kernel edge index for the target canonical ID, including the declaration when `includeDeclaration` is true. Cross-spec qualified references SHALL resolve across spec slugs. Unresolvable references SHALL produce no location and SHALL NOT fabricate targets.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-definition-and-references-use-kernel-anchor-semantics)

**Scenario:** `@feature4` / `SCEN-spec-lsp-definition-references-anchor-registry`

**Sources:** `spec-kernel:FR-4` (duplicate handling), `spec-kernel:FR-5` (edge resolution); GitHub issue #7 §Черновик требований item 4.

## FR-5: Completion over registered aliases and documentSymbol outline

`textDocument/completion` SHALL offer completion items drawn from the kernel's registered canonical IDs and aliases, filtered by the typed prefix. `textDocument/documentSymbol` SHALL produce a hierarchical outline of spec nodes in the target document, reflecting the kernel's parsed node inventory with correct ranges and nesting. Both operations SHALL return empty results rather than fabricated entries when the kernel graph is unavailable.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-completion-and-outline-reflect-kernel-nodes)

**Scenario:** `@feature5` / `SCEN-spec-lsp-completion-and-document-symbol`

**Sources:** `spec-kernel:FR-2` (supported documents and entity IDs).

## FR-6: Hover surfaces only fields the kernel actually stores

`textDocument/hover` on a spec definition node SHALL return fields that exist on the kernel node (title, kind, body, and task/status attributes when present). On a scenario tag (`@id:SCEN-*` in a `.feature` file), hover SHALL return kernel `SCENARIO` attributes (`featureName`, `scenarioKeyword`, `tags`, step texts). Hover SHALL NOT claim run result, provenance, or freshness: `spec-kernel` `SCENARIO` attributes do not include those fields, and `spec-evidence` is a later spec. When the graph has no data for the hovered position, hover SHALL return empty rather than fabricated content.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-hover-returns-only-kernel-stored-fields)

**Scenario:** `@feature6` / `SCEN-spec-lsp-hover-node-and-scenario`

**Sources:** `spec-kernel:FR-8` (query service); `spec-kernel_SCHEMA.md` SCHEMA-4 `SCENARIO` attributes; RESEARCH RF-13.

## FR-7: Current step absence and future step profile

`spec-lsp-read@1` SHALL emit no step defined/undefined/ambiguous diagnostics, parse no step-definition source and register no cucumber language server. CHK-FR7-01 proves that current-profile absence.

Future `spec-lsp-step@1` MAY ship only after `kernel-step-bindings@1` passes. It SHALL project kernel STEP diagnostics/BINDS_STEP one-to-one, never parse patterns, and release through local `CHK-FR7-02`.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-this-stage-ships-no-step-binding-diagnostics), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72-future-step-profile-is-separately-gated)

**Scenarios:** `@feature7` / `SCEN-spec-lsp-step-layer-centralized`; `@feature7` / `SCEN-spec-lsp-future-step-profile`

**Sources:** [spec-kernel:FR-15](../spec-kernel/FR.md#fr-15-contained-step-binding-index-not-a-v02v03-release-member); `spec-kernel:CHK-FR15-01`.


## FR-8: Adapter-to-service parity check

`CHK-FR8-01` SHALL compare versioned normalized projections including complete related diagnostics and scalar-coordinate spans: kernel diagnostics/source spans/canonical IDs are mapped to `LspKernelProjectionV1`, and LSP responses are normalized to that same carrier after transport metadata removal. Raw `Location[]` and QueryEnvelope bytes are never compared directly; any normalized divergence fails closed.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-parity-check-proves-lsp-equals-kernel-on-fixtures)

**Scenario:** `@feature8` / `SCEN-spec-lsp-adapter-to-service-parity`

**Sources:** `spec-kernel:FR-14`, `spec-kernel:CHK-FR9-01`.

## FR-9: Honest rebuild on save; 150 ms incremental is not this stage's gate

The server SHALL be compatible with OMP `lsp.lazy` default (start on first use) and SHALL NOT require eager initialization. On `textDocument/didSave` of an in-scope document, the adapter SHALL re-read through the kernel filesystem adapter and rebuild the graph with the existing kernel build (full snapshot). Full-corpus work at process start or explicit reload is allowed.

`spec-kernel` v0.2 has no incremental rebuild API and forbids watchers inside the pure kernel. This stage SHALL NOT claim a 150 ms p95 incremental budget. That budget MAY become a release member only after `spec-kernel` accepts an incremental rebuild check. CHK-FR9-01 for this stage SHALL prove lazy start and SHALL record the measured didSave rebuild p95 without treating 150 ms as a pass/fail gate.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-lazy-start-and-honest-didsave-rebuild-150-ms-is-not-a-gate)

**Scenario:** `@feature9` / `SCEN-spec-lsp-incremental-budget`

**Sources:** `spec-kernel:FR-1` (no watchers/clock in the pure kernel); RESEARCH RF-5, RISK-2, RF-12.

## FR-10: Scope containment, out-of-scope no-op, and honest absence

The server SHALL accept the explicit repository root containing `.specs`, then inspect only contained canonical spec documents/authored features. External roots and unsafe descendants refuse. Out-of-scope documents return empty results/no diagnostics. If the graph is unavailable, LSP diagnostics remain empty and a separate `SpecLspAvailabilityStatusV1` initialization/status notification explains unavailability; no adapter-specific LSP diagnostic or fake resolution is emitted.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-scope-is-contained-out-of-scope-is-a-no-op-absence-is-honest)

**Scenario:** `@feature10` / `SCEN-spec-lsp-scope-containment-and-honest-absence`

**Sources:** `spec-kernel:FR-7`; RESEARCH RF-6, RF-15.

## FR-11: Self-contained dependency-safe distribution

The server SHALL be registered through the plugin's `lspServers` manifest field, producing `.lsp.json` at install time. The runtime SHALL be a dependency-safe self-contained bundle per `spec-kernel:FR-10` posture. This stage bundles `vscode-languageserver` only; it SHALL NOT bundle `@cucumber/gherkin` or `@cucumber/cucumber-expressions` until FR-7 is unblocked by a kernel change. NO third-party binaries are included (the Marksman DROP stands). The server SHALL work with OMP `lsp.shared` broker semantics without holding locks of its own. It SHALL execute from the installed artifact with source checkout and root `node_modules` absent. Runtime sources live at repository-root `src/lsp/*.js` and are copied into `plugins/omp-spec-kit/dist/` by `scripts/build-plugin.mjs`; they SHALL NOT live under `plugins/omp-spec-kit/src/`.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-installed-server-is-self-contained-and-binary-free)

**Scenario:** `@feature11` / `SCEN-spec-lsp-self-contained-distribution`

**Sources:** `spec-kernel:FR-10`; `MIGRATION_MATRIX.md` FR-7/FR-27 DROP; house build convention in `omp-spec-kit-spec-authoring`; RESEARCH RF-7.

## FR-12: Current release proves step-layer absence

`CHK-FR12-01` SHALL be an absence proof for `spec-lsp-read@1`: no cucumber language server, no step diagnostics, no oracle fixture or parity requirement. Future step behavior belongs only to `spec-lsp-step@1` after the kernel step profile passes.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-release-proves-step-layer-absence)

**Scenario:** `@feature12` / `SCEN-spec-lsp-step-layer-absence`

**Sources:** FR-7; `spec-kernel:FR-15`.
