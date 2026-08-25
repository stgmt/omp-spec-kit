# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1 (FR-1): LSP is a semantic-free read projection

**Requirement:** [FR-1](FR.md#fr-1-one-server-semantic-free-read-projection)

**EARS:** WHILE the LSP adapter is active **WHEN** any navigation, diagnostic, hover, completion, or symbol request is served **THEN** every answer SHALL derive exclusively from `spec-kernel` query operations without introducing parsing, resolution, anchor, link, or verdict semantics of its own; **AND** the public capability set SHALL contain no mutation, proposal, apply, repair, archive, status-transition, or write operation.

**Scenario:** `@feature1` / `SCEN-spec-lsp-read-projection-only`

## AC-2.1 (FR-2): No mutation and code actions propose only

**Requirement:** [FR-2](FR.md#fr-2-read-only-posture-with-proposal-only-code-actions)

**EARS:** WHILE the LSP adapter handles any request **WHEN** a code action is returned **THEN** it SHALL contain only a descriptive title and optional edit preview; **AND** the server SHALL NOT return an actionable `WorkspaceEdit` payload, invoke `workspace/applyEdit`, persist a proposal, or transition any status.

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

## AC-6.1 (FR-6): Hover returns kernel node body and scenario provenance

**Requirement:** [FR-6](FR.md#fr-6-hover-surfaces-node-body-and-scenario-provenance)

**EARS:** WHILE hovering over a spec definition node **WHEN** `textDocument/hover` is invoked **THEN** the content SHALL include the node body and status fields from the kernel graph; **AND WHEN** hovering over a scenario `@id:SCEN-*` tag in a `.feature` file **THEN** the content SHALL include result, provenance, and freshness fields from the graph; **AND WHEN** the graph has no data for the position **THEN** hover SHALL return empty content rather than fabricated information.

**Scenario:** `@feature6` / `SCEN-spec-lsp-hover-node-and-scenario`

## AC-7.1 (FR-7): Step layer uses bundled libraries not external server

**Requirement:** [FR-7](FR.md#fr-7-step-layer-centralization-with-bundled-libraries)

**EARS:** WHILE a `.feature` file is open **WHEN** step diagnostics are published **THEN** each step decision (defined, undefined, ambiguous) SHALL be derived from bundled `@cucumber/gherkin` and `@cucumber/cucumber-expressions` plus the kernel graph's step-binding edges; **AND** the production plugin configuration SHALL NOT register the external `@cucumber/language-server` process; **AND** pytest-bdd files SHALL receive step diagnostics without silence.

**Scenario:** `@feature7` / `SCEN-spec-lsp-step-layer-centralized`

## AC-8.1 (FR-8): Parity check proves LSP equals kernel on fixtures

**Requirement:** [FR-8](FR.md#fr-8-adapter-to-service-parity-check)

**EARS:** WHILE the CHK-FR8-01 parity harness runs on shared fixtures **WHEN** LSP definition, references, and diagnostics responses are compared to kernel query service responses **THEN** every response SHALL match byte-for-byte on the declared corpus fingerprint; **AND** any divergence SHALL fail closed with deterministic blockers.

**Scenario:** `@feature8` / `SCEN-spec-lsp-adapter-to-service-parity`

## AC-9.1 (FR-9): Incremental re-evaluation meets budget

**Requirement:** [FR-9](FR.md#fr-9-incremental-re-evaluation-budget-and-lazy-start)

**EARS:** WHILE a spec document is saved after modification **WHEN** incremental re-evaluation completes **THEN** the elapsed time SHALL be at most 150 ms p95 over 20 samples after warm-up on the reference benchmark corpus; **AND** full-corpus work SHALL occur only at startup or explicit reload; **AND** the server SHALL start lazily per OMP `lsp.lazy` default.

**Scenario:** `@feature9` / `SCEN-spec-lsp-incremental-budget`

## AC-10.1 (FR-10): Scope is contained and absence is honest

**Requirement:** [FR-10](FR.md#fr-10-scope-containment-and-honest-absence)

**EARS:** WHILE the server initializes **WHEN** a workspace root contains symlinks, junctions, reparse points, traversal sequences, or paths outside `.specs/**` and authored `.feature` files **THEN** the server SHALL refuse the root before indexing; **AND WHEN** the kernel graph is unavailable **THEN** diagnostics SHALL explain why and no degraded fake resolution SHALL be returned.

**Scenario:** `@feature10` / `SCEN-spec-lsp-scope-containment-and-honest-absence`

## AC-11.1 (FR-11): Installed server is self-contained and binary-free

**Requirement:** [FR-11](FR.md#fr-11-self-contained-dependency-safe-distribution)

**EARS:** WHILE the installed plugin artifact is deployed without source checkout or root `node_modules` **WHEN** the LSP server starts **THEN** it SHALL execute using only bundled JS dependencies and Node/OMP builtins; **AND** no third-party binary, post-install download, native addon, or ambient dependency SHALL be required; **AND** the Marksman binary supply chain DROP SHALL remain honored.

**Scenario:** `@feature11` / `SCEN-spec-lsp-self-contained-distribution`

## AC-12.1 (FR-12): Oracle parity proves step verdict agreement

**Requirement:** [FR-12](FR.md#fr-12-oracle-parity-for-cucumber-runner-step-verdicts)

**EARS:** WHILE the CHK-FR12-01 oracle harness runs on shared cucumber-runner fixtures **WHEN** the custom server's step defined/undefined/ambiguous verdicts are compared to `@cucumber/language-server` oracle verdicts **THEN** every verdict SHALL match; **AND** pytest-bdd fixtures SHALL receive step diagnostics of equivalent quality without silence.

**Scenario:** `@feature12` / `SCEN-spec-lsp-oracle-parity`
