@spec-lsp @read-only
Feature: Custom LSP adapter as second read-only projection of the kernel query service
  The LSP adapter serves navigation diagnostics hover completion and document symbols
  for .specs/** Markdown from the same kernel query service used by the extension
  and MCP adapter. It does not remove the eight MCP query tools. This stage has
  no step-binding layer because the kernel has no StepBinding nodes.
  These scenarios specify required behavior and have no executed status here.
  @feature1 @AC-1.1 @id:SCEN-spec-lsp-read-projection-only
  Scenario: Agent sees MCP only; LSP is consumed by MCP not by the agent
    Given the plugin is installed in an OMP session
    When the agent lists tools
    Then the spec API is the MCP server
    And no LSP tool is in the agent inventory
    When MCP answers a navigation or diagnostic request
    Then the answer derives from the kernel and MCP may call LSP internally
    And LSP adds no graph semantics of its own


  @feature2 @AC-2.1 @id:SCEN-spec-lsp-read-only-code-actions
  Scenario: This stage advertises no codeAction capability
    Given the LSP server has completed initialize
    Then ServerCapabilities do not include codeAction
    When textDocument/codeAction is invoked on any range
    Then the result is an empty list
    And workspace/applyEdit is not invoked
    And no proposal is persisted and no status is transitioned

  @feature3 @AC-3.1 @id:SCEN-spec-lsp-diagnostics-map-kernel-findings
  Scenario: Diagnostics are kernel conformance findings mapped one-to-one
    Given a spec document has three kernel conformance findings with distinct codes lines and messages
    When textDocument/didSave triggers diagnostic publication
    Then exactly three LSP diagnostics are published
    And each diagnostic carries the matching kernel finding code file line and message
    And no adapter-specific diagnostic rule or severity override is applied

  @feature4 @AC-4.1 @id:SCEN-spec-lsp-definition-references-anchor-registry
  Scenario: Definition and references use kernel anchor registry with ambiguity semantics
    Given a spec document contains an unambiguous qualified reference and an ambiguous bare ID reference
    When textDocument/definition is invoked on the unambiguous reference
    Then exactly one location is returned matching the kernel getNode answer
    When textDocument/definition is invoked on the ambiguous bare ID
    Then all candidate locations are returned per spec-kernel FR-4 semantics
    When textDocument/references is invoked with includeDeclaration true
    Then the result set matches the kernel getEdges backlinks for the target canonical ID

  @feature5 @AC-5.1 @id:SCEN-spec-lsp-completion-and-document-symbol
  Scenario: Completion offers registered aliases and documentSymbol reflects kernel nodes
    Given a spec document contains FR definitions and the cursor is in a Markdown link destination
    When textDocument/completion is invoked with a partial alias prefix
    Then the completion list contains only registered canonical IDs matching the prefix
    When textDocument/documentSymbol is invoked on the same document
    Then the symbol tree reflects the kernel parsed node inventory with correct ranges and nesting

  @feature6 @AC-6.1 @id:SCEN-spec-lsp-hover-node-and-scenario
  Scenario: Hover returns only kernel-stored fields
    Given a spec definition node exists in the kernel graph with body and status fields
    When textDocument/hover is invoked on that definition
    Then the hover content includes the node title kind body and status fields when present
    Given a scenario tag exists in a .feature file
    When textDocument/hover is invoked on that scenario tag
    Then the hover content includes kernel SCENARIO attributes only
    And the hover content does not include run result provenance or freshness
    Given a position with no corresponding kernel graph data
    When textDocument/hover is invoked on that position
    Then empty hover content is returned rather than fabricated information

  @feature7 @AC-7.1 @id:SCEN-spec-lsp-step-layer-centralized
  Scenario: This stage emits no step-binding diagnostics
    Given a .feature file contains one defined one undefined and one ambiguous step
    When diagnostics are published for the .feature file
    Then no defined undefined or ambiguous step diagnostic is emitted
    And the production plugin configuration does not register @cucumber/language-server
    And the adapter does not scan tests/step-definitions or paths outside .specs for step bindings

  @feature8 @AC-8.1 @id:SCEN-spec-lsp-adapter-to-service-parity
  Scenario: Adapter-to-service parity check passes on fingerprint-bound fixtures
    Given shared fixtures with known kernel query service answers and a declared corpus fingerprint
    When the CHK-FR8-01 parity harness sends identical definition references and diagnostics requests to both the LSP adapter and kernel query service
    Then every response matches byte-for-byte on the declared fingerprint
    And any divergence fails closed with deterministic blockers

  @feature9 @AC-9.1 @id:SCEN-spec-lsp-incremental-budget
  Scenario: didSave rebuilds through the kernel; 150 ms is not this stage's gate
    Given the reference benchmark corpus is loaded
    When the first in-scope document is used
    Then the server starts lazily per OMP lsp.lazy default
    When a single spec document is modified and saved
    Then the adapter rebuilds through the kernel filesystem adapter and kernel build
    And CHK-FR9-01 records measured didSave p95 without treating 150 ms as pass or fail

  @feature10 @AC-10.1 @id:SCEN-spec-lsp-scope-containment-and-honest-absence
  Scenario: Scope containment refuses unsafe roots and ignores Markdown outside specs
    Given a workspace root containing a symlink or traversal sequence
    When the server initializes with that root
    Then the root is refused before indexing occurs
    Given a Markdown file outside .specs is opened
    When navigation hover completion or diagnostics are requested
    Then results are empty and no diagnostics are published for that file
    Given the kernel graph failed to build
    When a navigation or diagnostic request arrives
    Then diagnostics explain why the graph is unavailable
    And no degraded fake resolution is returned

  @feature11 @AC-11.1 @id:SCEN-spec-lsp-self-contained-distribution
  Scenario: Installed server executes without ambient dependencies or third-party binaries
    Given the installed plugin artifact is deployed without source checkout or root node_modules
    When the LSP server starts
    Then it executes using only bundled vscode-languageserver and Node/OMP builtins
    And no cucumber gherkin cucumber-expressions third-party binary post-install download native addon or ambient dependency is required
    And the Marksman binary supply chain DROP remains honored

  @feature12 @AC-12.1 @id:SCEN-spec-lsp-oracle-parity
  Scenario: Release proves step-layer absence not oracle parity
    Given the production plugin configuration and a .feature file with unbound steps
    When CHK-FR12-01 inspects the adapter
    Then @cucumber/language-server is absent from production lspServers
    And no step defined undefined or ambiguous diagnostic is published
    And oracle parity is not a required member of this stage's release conjunction
