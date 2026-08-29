# File Changes

All entries are planned. No file has been created, modified, or deleted by this specification. Runtime sources follow the house convention: repository-root `src/lsp/*.js`, copied into `plugins/omp-spec-kit/dist/` by `scripts/build-plugin.mjs`. Paths under `plugins/omp-spec-kit/src/` are forbidden.

| Path | Action | Reason |
|---|---|---|
| `src/lsp/server.js` | create (planned) | LSP server main module: initialize/shutdown, request routing, kernel query service integration |
| `src/lsp/spec-layer.js` | create (planned) | Spec-layer handlers: diagnostics mapping, definition, references, completion, documentSymbol, hover |
| `src/lsp/parity-harness.js` | create (planned) | Real-corpus adapter-to-service parity through `LspKernelProjectionV1` for CHK-FR8-01 |
| `scripts/build-plugin.mjs` | edit (planned) | Allowlist `src/lsp/*.js` into `dist/lsp-server.js` |
| `plugins/omp-spec-kit/package.json` | edit (planned) | Add `lspServers` registering `omp-spec-lsp` with `command: node`, `args: ["dist/lsp-server.js"]`, `fileTypes: [".md", ".feature"]`, `rootMarkers: [".specs"]` |
| `plugins/omp-spec-kit/dist/lsp-server.js` | create (planned, generated) | Bundled LSP server (`vscode-languageserver` only; no cucumber libraries in this stage) |

Deferred until a separately accepted kernel `StepBinding` change exists (not this stage):

| Path | Action | Reason |
|---|---|---|
| `src/lsp/step-projection.js` | deferred | Future one-to-one projection only after `kernel-step-bindings@1` and `spec-kernel:CHK-FR15-01` pass; never a second index |
| `tests/fixtures/spec-lsp-step/` | deferred | Real future kernel/LSP step-projection capture for CHK-FR7-02; external oracle parity remains excluded |
| `src/lsp/scenario-run-hover.js` | deferred | Run result/provenance/freshness are `spec-evidence` fields, not kernel `SCENARIO` attributes |
