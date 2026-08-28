# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1 (FR-1): LSP is a semantic-free read projection

**Requirement:** [FR-1](FR.md#fr-1-one-server-semantic-free-read-projection-that-does-not-shrink-mcp)

**EARS:** WHILE the LSP adapter is active **WHEN** any navigation, diagnostic, hover, completion, or symbol request is served **THEN** every answer SHALL derive exclusively from `spec-kernel` query operations without introducing parsing, resolution, anchor, link, or verdict semantics of its own; **AND** the public capability set SHALL contain no mutation, proposal, apply, repair, archive, status-transition, or write operation; **AND** the eight MCP query tools SHALL remain registered and served.

**Scenario:** `@feature1` / `SCEN-spec-lsp-read-projection-only`

## AC-2.1 (FR-2): No mutation and no codeAction capability in this stage

**Requirement:** [FR-2](FR.md#fr-2-read-only-posture-no-codeaction-capability-in-this-stage)

**EARS:** WHILE this stage's server initializes **WHEN** `initialize` returns capabilities **THEN** `codeAction` SHALL be absent from `ServerCapabilities`; **AND WHEN** `textDocument/codeAction` is invoked **THEN** the result SHALL be an empty list; **AND** the server SHALL NOT return a `WorkspaceEdit`, invoke `workspace/applyEdit`, persist a proposal, or transition any status.

**Scenario:** `@feature2` / `SCEN-spec-lsp-read-only-code-actions`

## AC-3.1 (FR-3): Diagnostics are kernel findings mapped one-to-one

**Requirement:** [FR-3](FR.md#fr-3-spec-layer-diagnostics-mapped-from-kernel-conformance-findings)

**EARS:** WHILE a `.specs/**` document is open and diagnostics are published **WHEN** the kernel produces conformance findings for that document **THEN** each finding SHALL appear as exactly one LSP diagnostic with matching code, repository-relative file, 1-based line, and bounded message; **AND** no adapter-specific diagnostic rule or severity override SHALL be introduced.

**Scenario:** `@feature3` / `SCEN-spec-lsp-diagnostics-map-kernel-findings`

## AC-4.1 (FR-4): Definition and references use kernel anchor semantics

**Requirement:** [FR-4](FR.md#fr-4-definition-and-references-through-the-kernel-anchor-registry)

**EARS:** WHILE a spec reference is under the cursor **WHEN** `textDocument/definition` is invoked **THEN** an unambiguous reference SHALL resolve to exactly one location matching the kernel answer and an ambiguous bare ID SHALL return all candidates per `spec-kernel:FR-4`; **AND WHEN** `textDocument/references` is invoked with `includeDeclaration: true` **THEN** the result set SHALL match the kernel backlinks for the target canonical ID.

**Scenario:** `@feature4` / `SCEN-spec-lsp-definition-references-anchor-registry`

## AC-5.1 (FR-5): Completion and outline reflect kernel nodes

**Requirement:** [FR-5](FR.md#fr-5-completion-over-registered-aliases-and-documentsymbol-outline)

**EARS:** WHILE the cursor is in a Markdown link destination **WHEN** `textDocument/completion` is invoked with a prefix **THEN** the completion list SHALL contain only registered canonical IDs and aliases from the kernel node index matching that prefix; **AND WHEN** `textDocument/documentSymbol` is invoked on a canonical spec document **THEN** the symbol tree SHALL reflect the kernel's parsed node inventory for that document with correct ranges and nesting.

**Scenario:** `@feature5` / `SCEN-spec-lsp-completion-and-document-symbol`

## AC-6.1 (FR-6): Hover returns only kernel-stored fields

**Requirement:** [FR-6](FR.md#fr-6-hover-surfaces-only-fields-the-kernel-actually-stores)

**EARS:** WHILE hovering over a spec definition node **WHEN** `textDocument/hover` is invoked **THEN** the content SHALL include only kernel-stored fields (title, kind, body, and status attributes when present); **AND WHEN** hovering over a scenario `@id:SCEN-*` tag **THEN** the content SHALL include kernel `SCENARIO` attributes only and SHALL NOT include run result, provenance, or freshness; **AND WHEN** the graph has no data for the position **THEN** hover SHALL return empty content rather than fabricated information.

**Scenario:** `@feature6` / `SCEN-spec-lsp-hover-node-and-scenario`

## AC-7.1 (FR-7): This stage ships no step-binding diagnostics

**Requirement:** [FR-7](FR.md#fr-7-this-stage-forbids-a-step-binding-layer)

**EARS:** WHILE a `.feature` file is open **WHEN** diagnostics are published **THEN** no defined/undefined/ambiguous step diagnostic SHALL be emitted; **AND** the production plugin configuration SHALL NOT register `@cucumber/language-server`; **AND** the adapter SHALL NOT scan `tests/step-definitions/**` or any path outside `.specs/` for step bindings.

**Scenario:** `@feature7` / `SCEN-spec-lsp-step-layer-centralized`

## AC-8.1 (FR-8): Parity check proves LSP equals kernel on fixtures

**Requirement:** [FR-8](FR.md#fr-8-adapter-to-service-parity-check)

**EARS:** WHILE the CHK-FR8-01 parity harness runs on shared fixtures **WHEN** LSP definition, references, and diagnostics responses are compared to kernel query service responses **THEN** every response SHALL match byte-for-byte on the declared corpus fingerprint; **AND** any divergence SHALL fail closed with deterministic blockers.

**Scenario:** `@feature8` / `SCEN-spec-lsp-adapter-to-service-parity`

## AC-9.1 (FR-9): Lazy start and honest didSave rebuild; 150 ms is not a gate

**Requirement:** [FR-9](FR.md#fr-9-honest-rebuild-on-save-150-ms-incremental-is-not-this-stages-gate)

**EARS:** WHILE the server is registered with OMP **WHEN** the first in-scope document is used **THEN** the server SHALL start lazily per `lsp.lazy`; **AND WHEN** an in-scope document is saved **THEN** the adapter SHALL rebuild through the kernel filesystem adapter and kernel build; **AND** CHK-FR9-01 SHALL record measured didSave p95 without treating 150 ms as pass/fail for this stage.

**Scenario:** `@feature9` / `SCEN-spec-lsp-incremental-budget`

## AC-10.1 (FR-10): Scope is contained, out-of-scope is a no-op, absence is honest

**Requirement:** [FR-10](FR.md#fr-10-scope-containment-out-of-scope-no-op-and-honest-absence)

**EARS:** WHILE the server initializes **WHEN** a workspace root contains symlinks, junctions, reparse points, or traversal sequences **THEN** the server SHALL refuse the root before indexing; **AND WHEN** a `.md` document outside `.specs/**` is opened **THEN** navigation, hover, completion, and symbols SHALL be empty and no diagnostics SHALL be published for that document; **AND WHEN** the kernel graph is unavailable **THEN** diagnostics SHALL explain why and no degraded fake resolution SHALL be returned.

**Scenario:** `@feature10` / `SCEN-spec-lsp-scope-containment-and-honest-absence`

## AC-11.1 (FR-11): Installed server is self-contained and binary-free

**Requirement:** [FR-11](FR.md#fr-11-self-contained-dependency-safe-distribution)

**EARS:** WHILE the installed plugin artifact is deployed without source checkout or root `node_modules` **WHEN** the LSP server starts **THEN** it SHALL execute using only bundled `vscode-languageserver` and Node/OMP builtins; **AND** no `@cucumber/gherkin`, `@cucumber/cucumber-expressions`, third-party binary, post-install download, native addon, or ambient dependency SHALL be required; **AND** the Marksman binary supply chain DROP SHALL remain honored.

**Scenario:** `@feature11` / `SCEN-spec-lsp-self-contained-distribution`

## AC-12.1 (FR-12): Release proves step-layer absence

**Requirement:** [FR-12](FR.md#fr-12-this-stages-release-proves-step-layer-absence-not-oracle-parity)

**EARS:** WHILE CHK-FR12-01 runs against the production plugin configuration and a `.feature` file with unbound steps **WHEN** the adapter is inspected **THEN** `@cucumber/language-server` SHALL be absent from production `lspServers`; **AND** no step defined/undefined/ambiguous diagnostic SHALL be published; **AND** oracle parity SHALL NOT be a required member of this stage's release conjunction.

**Scenario:** `@feature12` / `SCEN-spec-lsp-oracle-parity`
