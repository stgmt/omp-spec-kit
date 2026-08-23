# File Changes

All entries are planned. No file has been created, modified, or deleted by this specification.

| Path | Action | Reason |
|---|---|---|
| `plugins/omp-spec-kit/dist/lsp-server.js` | create (planned) | Bundled LSP server entry point containing spec layer, scenario layer, step layer, and all bundled JS dependencies |
| `plugins/omp-spec-kit/package.json` | edit (planned) | Add `lspServers` manifest field registering `omp-spec-lsp` server with `command: node`, `args: ["dist/lsp-server.js"]`, `fileTypes: [".md", ".feature"]`, `rootMarkers: [".specs"]` |
| `plugins/omp-spec-kit/src/lsp/server.ts` | create (planned) | LSP server main module: initialize/shutdown lifecycle, request routing, kernel query service integration |
| `plugins/omp-spec-kit/src/lsp/spec-layer.ts` | create (planned) | Spec-layer handlers: diagnostics mapping, definition, references, completion, documentSymbol, hover |
| `plugins/omp-spec-kit/src/lsp/step-layer.ts` | create (planned) | Step-layer handlers: Gherkin parsing via bundled @cucumber/gherkin, step matching via bundled @cucumber/cucumber-expressions, verdict emission |
| `plugins/omp-spec-kit/src/lsp/scenario-layer.ts` | create (planned) | Scenario-layer handlers: hover result/provenance, staleness diagnostics by reference |
| `plugins/omp-spec-kit/src/lsp/oracle-harness.ts` | create (planned) | Test-infrastructure-only oracle parity harness for CHK-FR12-01 |
| `plugins/omp-spec-kit/src/lsp/parity-harness.ts` | create (planned) | Adapter-to-service parity harness for CHK-FR8-01 |
| `plugins/omp-spec-kit/test/fixtures/step-bindings/` | create (planned) | Real-producer step-binding fixtures with provenance manifests |
