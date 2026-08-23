@spec-lsp @read-only
Feature: Custom LSP adapter as second read-only projection of the kernel query service
  The LSP adapter serves navigation diagnostics hover completion and document symbols
  for .specs/** Markdown and .feature Gherkin files from the same kernel query service
  used by the extension and MCP adapter. Step layer is centralized with bundled libraries.
  These scenarios specify required behavior and have no executed status here.

  @feature1 @AC-1.1 @id:SCEN-spec-lsp-read-projection-only
  Scenario: LSP adapter is a semantic-free read projection of the kernel
    Given the spec-kernel query service is available with a built graph
    When any navigation diagnostic hover completion or symbol request is served
    Then every answer derives exclusively from kernel query operations
    And no parsing resolution anchor link or verdict semantics are introduced by the adapter
    And the public capability set contains no mutation proposal apply repair archive status-transition or write operation

  @feature2 @AC-2.1 @id:SCEN-spec-lsp-read-only-code-actions
  Scenario: Code actions propose repairs without mutation
    Given a spec document has a conformance finding with a mechanical fix
    When textDocument/codeAction is invoked on the finding range
    Then the returned code action contains a descriptive title and optional edit preview
    And no actionable WorkspaceEdit payload is returned
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
  Scenario: Hover returns kernel node body and scenario provenance
    Given a spec definition node exists in the kernel graph with body and status fields
    When textDocument/hover is invoked on that definition
    Then the hover content includes the node body and status fields
    Given a scenario tag exists in a .feature file with result and provenance in the graph
    When textDocument/hover is invoked on that scenario tag
    Then the hover content includes result provenance and freshness fields
    Given a position with no corresponding kernel graph data
    When textDocument/hover is invoked on that position
    Then empty hover content is returned rather than fabricated information

  @feature7 @AC-7.1 @id:SCEN-spec-lsp-step-layer-centralized
  Scenario: Step layer uses bundled libraries and graph edges not external server
    Given a .feature file contains one defined one undefined and one ambiguous step
    And the kernel graph contains step-binding edges for the defined and ambiguous steps
    When diagnostics are published for the .feature file
    Then the undefined step produces a diagnostic
    And the ambiguous step produces a diagnostic with candidate list
    And the defined step produces no diagnostic
    And the production plugin configuration does not register @cucumber/language-server

  @feature8 @AC-8.1 @id:SCEN-spec-lsp-adapter-to-service-parity
  Scenario: Adapter-to-service parity check passes on fingerprint-bound fixtures
    Given shared fixtures with known kernel query service answers and a declared corpus fingerprint
    When the CHK-FR8-01 parity harness sends identical definition references and diagnostics requests to both the LSP adapter and kernel query service
    Then every response matches byte-for-byte on the declared fingerprint
    And any divergence fails closed with deterministic blockers

  @feature9 @AC-9.1 @id:SCEN-spec-lsp-incremental-budget
  Scenario: Incremental re-evaluation meets the 150ms p95 budget
    Given the reference benchmark corpus is loaded and the graph is built
    When a single spec document is modified and saved twenty times after warm-up
    Then incremental re-evaluation completes in at most 150 ms p95
    And full-corpus work occurs only at startup or explicit reload
    And the server starts lazily per OMP lsp.lazy default

  @feature10 @AC-10.1 @id:SCEN-spec-lsp-scope-containment-and-honest-absence
  Scenario: Scope containment refuses unsafe roots and honest absence explains missing graph
    Given a workspace root containing a symlink or traversal sequence
    When the server initializes with that root
    Then the root is refused before indexing occurs
    Given the kernel graph failed to build
    When a navigation or diagnostic request arrives
    Then diagnostics explain why the graph is unavailable
    And no degraded fake resolution is returned

  @feature11 @AC-11.1 @id:SCEN-spec-lsp-self-contained-distribution
  Scenario: Installed server executes without ambient dependencies or third-party binaries
    Given the installed plugin artifact is deployed without source checkout or root node_modules
    When the LSP server starts
    Then it executes using only bundled JS dependencies and Node/OMP builtins
    And no third-party binary post-install download native addon or ambient dependency is required
    And the Marksman binary supply chain DROP remains honored

  @feature12 @AC-12.1 @id:SCEN-spec-lsp-oracle-parity
  Scenario: Oracle parity proves step verdict agreement on cucumber-runner fixtures
    Given shared cucumber-runner fixtures with known step bindings
    When the CHK-FR12-01 oracle harness compares custom server verdicts to @cucumber/language-server oracle verdicts
    Then every step defined/undefined/ambiguous verdict matches
    Given pytest-bdd fixtures with known step decorators
    When the custom server produces step diagnostics
    Then diagnostics are served without silence and with equivalent quality to cucumber-runner fixtures
