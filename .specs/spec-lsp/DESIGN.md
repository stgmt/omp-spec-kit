# Design

## Component overview

```
KERNEL (one graph, one query service)
 ├── OMP extension adapter        (v0.1–v0.2)
 ├── MCP adapter                  (v0.3)     ← domain queries + future authoring door
 └── LSP adapter                  (this spec) ← navigation + post-write diagnostics
      ├── spec layer:             conformance diagnostics, definition/references/completion/hover/documentSymbol via kernel anchors
      ├── scenario layer:         hover result/provenance, staleness diagnostics by reference
      └── step layer:             @cucumber/gherkin + cucumber-expressions as BUNDLED LIBRARIES
                                   + step-binding edges from graph → step↔code navigation
```

The LSP adapter is a single process communicating over stdio JSON-RPC using the `vscode-languageserver` library. It holds no independent graph state; every answer derives from the shared `spec-kernel` query service.

## Spec layer design

### Diagnostics pipeline

1. On `textDocument/didOpen` or `textDocument/didSave`, the server requests `diagnostics` from the kernel query service for the target document.
2. Each kernel `Finding` is mapped to an LSP `Diagnostic`: `code` ← finding code, `range` ← finding span (converted to 0-based LSP positions), `message` ← finding message, `severity` ← finding severity.
3. The diagnostic set is published via `textDocument/publishDiagnostics`.
4. No adapter-specific rules, filters, or severity overrides are applied.

### Definition and references

- `textDocument/definition`: Extract the reference text at the cursor position. Query `getNode` with the canonical or bare ID. If unambiguous, return the node's source location. If ambiguous, return all candidate locations. If unresolved, return empty.
- `textDocument/references`: Resolve the symbol at cursor to a canonical ID. Query `getEdges` with direction=inbound and type filter for `REFS`, `COVERS`, `TESTED_BY`, etc. Return all edge source locations. Include the declaration when `includeDeclaration` is true.

### Completion

- `textDocument/completion`: When triggered inside a Markdown link destination or qualified reference context, query `findNodes` with the typed prefix. Return matching canonical IDs as completion items with label, detail (node kind), and insert text.

### Document symbols

- `textDocument/documentSymbol`: Query `findNodes` scoped to the target document. Map each node to a `DocumentSymbol` with name (local ID), kind (mapped from node kind), range, and selectionRange. Nest children according to document structure.

### Hover

- On spec definition nodes: query `getNode`, render body + status fields as markdown.
- On scenario tags: query the scenario node, render result/provenance/freshness fields.
- Truncate to NFR-USE-1 bounds with explicit truncation marker.

## Step layer design

### Architecture

The step layer uses `@cucumber/gherkin` to parse `.feature` files and `@cucumber/cucumber-expressions` to match step text against step definitions. Step definitions come from the kernel graph's `StepBinding` nodes and `step-binding` edges — the same data the builder extracted during graph construction. This avoids maintaining a second index.

### Step verdict algorithm

For each step line in a parsed `.feature` file:
1. Extract the step text and keyword.
2. Query the kernel graph for `StepBinding` nodes matching the step's language and runner scope.
3. Use `@cucumber/cucumber-expressions` to test each candidate expression against the step text.
4. Zero matches → undefined diagnostic. One match → defined (no diagnostic). Two or more matches → ambiguous diagnostic with candidate list.
5. For pytest-bdd files, the same graph edges serve verdicts; the algorithm does not depend on runner-specific glue-code discovery.

### Oracle parity harness

In the test infrastructure only:
1. Start `@cucumber/language-server` as a separate process on the same fixture set.
2. Send identical step-diagnostic requests to both servers.
3. Compare verdicts (defined/undefined/ambiguous) per step line.
4. Record pass/fail per fixture as CHK-FR12-01 evidence.

The oracle process is never registered in production configuration.

## Rejected alternatives

### Alternative A: Second external LSP server (dual-index divergence)

Registering `@cucumber/language-server` alongside the custom spec server would create two indexes over the same `.feature` files. This repeats the upstream dual-anchor-registry lesson (graph aliases ≠ heading slugs) in a new domain. Configuration conflicts between the official server's glue-code discovery and the kernel builder's extraction would produce contradictory diagnostics. **Rejected.**

### Alternative B: Marksman adoption (binary supply chain dropped)

Marksman is an F# binary that understands only heading-slug wiki-links. It cannot serve typed spec nodes, composite IDs, or typed edges. Its binary supply chain was explicitly dropped in `MIGRATION_MATRIX.md` FR-7 and FR-27. Adopting it would reverse a settled migration decision and introduce a foreign-stack maintenance burden. **Rejected.**

### Alternative C: MCP-wraps-LSP (nested protocol)

Wrapping LSP operations inside MCP tool calls would add protocol overhead, defeat OMP's native `lsp.diagnosticsOnWrite` automatic diagnostic delivery, and prevent the agent from using its built-in `lsp` tool for spec navigation. The upstream DESIGN.md recorded "MCP and LSP as separate layers, not nested." **Rejected.**

### Alternative D: LSP-only (no MCP adapter)

Eliminating the MCP adapter in favor of LSP-only access would lose domain-specific query operations (`get_trace`, `get_spec_status`, etc.) that have no LSP primitive equivalent. The MCP adapter serves the agent's domain-query surface; the LSP adapter serves navigation and diagnostics. Both are needed. **Rejected.**

## Lifecycle and broker compatibility

The server is compatible with OMP `lsp.lazy` (start on first use) and `lsp.shared` (broker-managed per-project sharing). It holds no exclusive locks. Concurrent clients receive answers from the same immutable kernel graph snapshot. Future mutation locks belong to the kernel, not this adapter.

## Distribution shape

Registered through the plugin manifest's `lspServers` field:

```json
{
  "lspServers": {
    "omp-spec-lsp": {
      "command": "node",
      "args": ["dist/lsp-server.js"],
      "fileTypes": [".md", ".feature"],
      "rootMarkers": [".specs"]
    }
  }
}
```

This produces `.lsp.json` at install time per OMP marketplace conventions. All JS dependencies are bundled into `dist/lsp-server.js`. No binary, no post-install step, no native addon.
