# Non-Functional Requirements

Budgets are release gates for the installed child-plugin artifact. Measurements must identify artifact SHA-256, kernel schema version, graph fingerprint, OMP/runtime version, OS, CPU, logical core count, memory, warm-up policy, sample count, and raw observations. A faster developer checkout is not substitute evidence.

## NFR-PERF-1: Latency (honest for this stage)

- This stage SHALL NOT treat 150 ms p95 incremental re-evaluation as a pass/fail gate. That budget MAY join a later stage after `spec-kernel` accepts incremental rebuild evidence.
- Cold-start full-corpus graph build plus initial diagnostic publication SHALL complete within the `spec-kernel:NFR-PERF-1` cold-build budget (2,000 ms p95 on the reference benchmark).
- `textDocument/definition`, `textDocument/references`, `textDocument/completion`, `textDocument/documentSymbol`, and `textDocument/hover` SHALL each complete in at most 25 ms p95 over 100 samples on an already-built graph.
- CHK-FR9-01 SHALL record measured didSave rebuild p95 as an observation, not a hidden 150 ms pass.
- Cancellation SHALL be observed at least every 1,024 processed items or 10 ms of monotonic time, whichever occurs first.

## NFR-SIZE-1: Bundle size without cucumber libraries

- The complete installed runtime JavaScript for the LSP adapter (including bundled `vscode-languageserver`, excluding cucumber libraries) SHALL be at most 1.0 MiB uncompressed and 350 KiB gzip, measured in addition to the kernel bundle.
- Combined kernel + MCP + LSP installed runtime JavaScript SHALL be at most 3.0 MiB uncompressed and 1.0 MiB gzip.
- Runtime data and license notices for bundled libraries SHALL be counted in installed artifact size reporting.

## NFR-MEM-1: Memory bound

- Peak incremental resident memory above the idle installed plugin baseline SHALL remain within the `spec-kernel:NFR-MEM-1` bound (128 MiB) when the LSP adapter is active.
- The adapter SHALL NOT maintain a separate persistent copy of the kernel graph or a step-definition index.

## NFR-SEC-1: Containment and data minimization

- The server SHALL accept only workspace roots containing `.specs/` and SHALL refuse external roots, symlinks, junctions, reparse points, and traversal per `spec-kernel:FR-7` posture.
- Diagnostics and error responses SHALL contain only repository-relative paths; no absolute paths, environment values, stack traces, or arbitrary OS error text.
- Hover content SHALL be drawn only from accepted canonical documents and kernel graph nodes; no external network or process access.
- Zero operation writes bytes, creates directories, changes permissions, or spawns a subprocess beyond the server process itself.

## NFR-REL-1: Determinism and honest absence

- Equivalent normalized inputs SHALL produce identical diagnostic sets (including related rows), definition/reference results, completion lists, and hover content across all supported platforms and negotiated UTF-32/UTF-16 encodings; non-BMP fixtures SHALL reconcile to one Unicode-scalar projection.
- When the kernel graph is unavailable, the server SHALL return empty LSP results/diagnostics and a separate `SpecLspAvailabilityStatusV1` notification rather than fabricated results or adapter-specific diagnostics.
- All arrays SHALL use deterministic ordering consistent with kernel query result ordering.

## NFR-PORT-1: Portable installed runtime

- The server SHALL execute from the installed artifact with source checkout and root `node_modules` absent, per `spec-kernel:FR-10` posture.
- This stage's only non-OMP dependency (`vscode-languageserver`) SHALL be fully bundled; no cucumber libraries, post-install compilation, download, native addon, or binary dependency.
- The server SHALL be compatible with OMP `lsp.lazy` (default true) and `lsp.shared` broker semantics.


## NFR-USE-1: Actionable bounded diagnostics

- Each diagnostic message SHALL be at most 2,048 Unicode scalar values.
- Diagnostic codes SHALL map 1:1 to kernel finding codes; no adapter-specific codes.
- Hover content SHALL be at most 4,096 Unicode scalar values; longer node bodies SHALL be truncated with explicit indication.
- Completion lists SHALL be bounded to at most 200 items per request.
