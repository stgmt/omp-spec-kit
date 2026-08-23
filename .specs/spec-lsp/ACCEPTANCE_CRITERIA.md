# Acceptance Criteria

## AC-1.1: LSP is a semantic-free read projection

While the LSP adapter is active, when any navigation, diagnostic, hover, completion, or symbol request is served, then every answer SHALL derive exclusively from `spec-kernel` query operations without introducing parsing, resolution, anchor, link, or verdict semantics of its own, and the public capability set SHALL contain no mutation, proposal, apply, repair, archive, status-transition, or write operation.

## AC-2.1: No mutation and code actions propose only

While the LSP adapter handles any request, when a code action is returned, then it SHALL contain only a descriptive title and optional edit preview, and the server SHALL NOT return an actionable `WorkspaceEdit` payload, invoke `workspace/applyEdit`, persist a proposal, or transition any status.

## AC-3.1: Diagnostics are kernel findings mapped one-to-one

While a `.specs/**` document is open and diagnostics are published, when the kernel produces conformance findings for that document, then each finding SHALL appear as exactly one LSP diagnostic with matching code, repository-relative file, 1-based line, and bounded message, and no adapter-specific diagnostic rule or severity override SHALL be introduced.

## AC-4.1: Definition and references use kernel anchor semantics

While a spec reference is under the cursor, when `textDocument/definition` is invoked, then an unambiguous reference SHALL resolve to exactly one location matching the kernel `getNode` answer, and an ambiguous bare ID SHALL return all candidates per `spec-kernel:FR-4`. When `textDocument/references` is invoked with `includeDeclaration: true`, then the result set SHALL match the kernel `getEdges` backlinks for the target canonical ID.

## AC-5.1: Completion and outline reflect kernel nodes

While the cursor is in a Markdown link destination, when `textDocument/completion` is invoked with a prefix, then the completion list SHALL contain only registered canonical IDs and aliases from the kernel node index matching that prefix. When `textDocument/documentSymbol` is invoked on a canonical spec document, then the symbol tree SHALL reflect the kernel's parsed node inventory for that document with correct ranges and nesting.

## AC-6.1: Hover returns kernel node body and scenario provenance

While hovering over a spec definition node, when `textDocument/hover` is invoked, then the content SHALL include the node body and status fields from the kernel graph. While hovering over a scenario `@id:SCEN-*` tag in a `.feature` file, then the content SHALL include result, provenance, and freshness fields from the graph. When the graph has no data for the position, then hover SHALL return empty content rather than fabricated information.

## AC-7.1: Step layer uses bundled libraries not external server

While a `.feature` file is open, when step diagnostics are published, then each step decision (defined, undefined, ambiguous) SHALL be derived from bundled `@cucumber/gherkin` and `@cucumber/cucumber-expressions` plus the kernel graph's step-binding edges, and the production plugin configuration SHALL NOT register the external `@cucumber/language-server` process. For pytest-bdd files, step diagnostics SHALL be served without silence.

## AC-8.1: Parity check proves LSP equals kernel on fixtures

While the CHK-FR8-01 parity harness runs on shared fixtures, when LSP definition, references, and diagnostics responses are compared to kernel query service responses, then every response SHALL match byte-for-byte on the declared corpus fingerprint, and any divergence SHALL fail closed with deterministic blockers.

## AC-9.1: Incremental re-evaluation meets budget

While a spec document is saved after modification, when incremental re-evaluation completes, then the elapsed time SHALL be at most 150 ms p95 over 20 samples after warm-up on the reference benchmark corpus. Full-corpus work SHALL occur only at startup or explicit reload. The server SHALL start lazily per OMP `lsp.lazy` default.

## AC-10.1: Scope is contained and absence is honest

While the server initializes, when a workspace root contains symlinks, junctions, reparse points, traversal sequences, or paths outside `.specs/**` and authored `.feature` files, then the server SHALL refuse the root before indexing. When the kernel graph is unavailable, then diagnostics SHALL explain why and no degraded fake resolution SHALL be returned.

## AC-11.1: Installed server is self-contained and binary-free

While the installed plugin artifact is deployed without source checkout or root `node_modules`, when the LSP server starts, then it SHALL execute using only bundled JS dependencies and Node/OMP builtins, and no third-party binary, post-install download, native addon, or ambient dependency SHALL be required. The Marksman binary supply chain DROP SHALL remain honored.

## AC-12.1: Oracle parity proves step verdict agreement

While the CHK-FR12-01 oracle harness runs on shared cucumber-runner fixtures, when the custom server's step defined/undefined/ambiguous verdicts are compared to `@cucumber/language-server` oracle verdicts, then every verdict SHALL match, and pytest-bdd fixtures SHALL receive step diagnostics of equivalent quality without silence.
