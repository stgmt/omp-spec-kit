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

- On spec definition nodes: query `getNode`, render title, kind, body, and status attributes as markdown.
- On scenario tags: query the scenario node, render kernel `SCENARIO` attributes only (no run result, provenance, or freshness).
- Truncate to NFR-USE-1 bounds with explicit truncation marker.

## Step layer — not in this stage

Issue #7 proposed bundling `@cucumber/gherkin` and matching against kernel `StepBinding` nodes. The kernel has neither that node kind nor a reader for `tests/step-definitions/**`. This stage therefore emits **no** step defined/undefined/ambiguous diagnostics and does not bundle those libraries.

A later kernel spec may add a contained step-binding model. Only then may this adapter add a step layer without becoming a second index. Until that happens, CHK-FR7-01 and CHK-FR12-01 are **absence** proofs.

The official `@cucumber/language-server` remains forbidden in production configuration.

## Rejected alternatives

### Alternative A: Second external LSP server (dual-index divergence)

Registering `@cucumber/language-server` alongside the custom spec server would create two indexes over the same `.feature` files. **Rejected.** This stage also rejects a homegrown second index inside the adapter.

### Alternative B: Marksman adoption (binary supply chain dropped)

Marksman cannot serve typed spec nodes. `MIGRATION_MATRIX.md` FR-7 and FR-27 DROP. **Rejected.**

### Alternative C: Treat MCP consuming LSP as a nested agent API

Editor diagnostics stay on `lsp.diagnosticsOnWrite`. MCP MAY consume LSP or the kernel internally for definition, references, and diagnostics. The agent never calls host `lsp`. That is not a nested agent API and does not defeat editor diagnostics. Forbidding MCP from consuming LSP would be the wrong cut. **The nested-agent-API reading is rejected; MCP consuming LSP internally is allowed.**

### Alternative D: LSP-only (no MCP adapter)

Domain queries (`spec_trace`, `spec_get_node`, …) have no LSP primitive. **Rejected.**

### Alternative E: Cut MCP tools in this product to dodge a tool cliff

There is a 46-name generator door to grow; the canonical census is [`docs/decisions/spec-generator-port.md`](../../docs/decisions/spec-generator-port.md). Eight SCHEMA-11 tools are the v0.3 first slice, not a ceiling. Do not cut MCP tools. LSP does not replace MCP. **Rejected.**



## Lifecycle and broker compatibility

The server is compatible with OMP `lsp.lazy` (start on first use) and `lsp.shared` (broker-managed per-project sharing). It holds no exclusive locks. Concurrent clients receive answers from the same immutable kernel graph snapshot. Future mutation locks belong to the kernel, not this adapter.

## Distribution shape

Runtime sources live at repository-root `src/lsp/*.js` and are copied into `plugins/omp-spec-kit/dist/` by `scripts/build-plugin.mjs`. They SHALL NOT live under `plugins/omp-spec-kit/src/`.

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

Documents matching `.md` but outside `.specs/**` receive empty navigation/hover/completion/symbol results and no diagnostics. All JS dependencies for this stage (`vscode-languageserver` only) are bundled into `dist/lsp-server.js`. No cucumber libraries, no binary, no post-install step, no native addon.
