# Non-Functional Requirements

Budgets are release gates for the installed child-plugin artifact carrying the enforcement hooks. Measurements must identify artifact SHA-256, hook schema version, OMP/runtime version, OS, CPU, sample count, warm-up policy, and raw observations.

## NFR-PERF-1: Hook handler latency

- One `tool_call` handler invocation for a non-matching tool call SHALL complete in at most 1 ms p95 over 20 samples; non-matching calls SHALL return without any kernel query or filesystem I/O.
- One `tool_call` handler invocation for a matching spec-write SHALL complete in at most 10 ms p95 (path normalization + gate status check + reason rendering).
- One `tool_result` diagnostic injection SHALL complete in at most 50 ms p95 including kernel query; kernel absence SHALL complete in at most 1 ms (immediate diagnostic message).
- One `context` census injection SHALL complete in at most 100 ms p95 including kernel overview query.
- The `session_start` initialization handler SHALL complete in at most 500 ms p95 including kernel initialization and corpus census computation.
- Total handler deadline per event SHALL be 5 s; deadline expiry is a fault and produces an explicit diagnostic per FR-4.

## NFR-SIZE-1: Artifact and message size

- The enforcement hook module plus bundled resources SHALL add at most 128 KiB uncompressed to the installed child artifact.
- One `tool_result` diagnostic addition SHALL be at most 2 KiB UTF-8.
- One `context` census message SHALL be at most 4 KiB UTF-8.
- One block reason SHALL be at most 4 KiB UTF-8 with actionable redirect text.
- One diagnostic record message SHALL be at most 1,024 Unicode scalar values; diagnostic state per session SHALL be at most 50 records or 64 KiB, whichever first, ring-evicting oldest.

## NFR-MEM-1: Memory bound

- Peak incremental resident memory for one hook handler invocation SHALL be at most 8 MiB above the idle plugin baseline.
- Corpus census data cached per session SHALL be at most 64 KiB.
- Kernel query results held during handler execution SHALL be released after content rendering.

## NFR-SEC-1: Containment and data minimization

- Path matching in `tool_call` handlers SHALL normalize separators to `/`, reject absolute paths outside the project root, reject traversal (`..`), and reject symbolic links before inspection.
- Diagnostic content, block reasons, and census summaries SHALL NOT contain absolute paths, environment values, credentials, stack traces, or arbitrary OS error text; repository-relative paths only.
- The hooks SHALL NOT read `.git`, `.env*`, user home, plugin cache, or non-spec documents.
- No network calls, subprocess spawns, or credential access SHALL occur from any handler.

## NFR-REL-1: Determinism and fail-honest results

- Identical tool call inputs, kernel state, and gate status SHALL produce byte-identical handler outputs (block/allow decision, diagnostic content, census summary) across repeated runs on Windows and POSIX.
- Diagnostic records SHALL be ordered by emission time within a session.
- Block reasons SHALL be deterministic for identical inputs; no timestamp or nonce SHALL appear in the reason text.
- Unknown kernel versions, malformed kernel responses, or unrecognizable gate status SHALL take the fail-honest path per FR-4 with a diagnostic, never silent pass-through.

## NFR-USE-1: Actionable block and diagnostic content

Every block reason SHALL name the matched tool, the target path, and the redirect destination (authoring door command or API). Every diagnostic injection SHALL name the source (kernel finding code or "kernel unavailable") and the affected spec slug. Census summaries SHALL include spec count, document counts, and top-level diagnostic severity.

## Hard input limits

| Budget | Default | Hard maximum |
|---|---:|---:|
| Tool result diagnostic addition bytes | n/a | 2 KiB |
| Context census message bytes | n/a | 4 KiB |
| Block reason bytes | n/a | 4 KiB |
| Diagnostic records per session | 50 | 50 |
| Diagnostic record message scalar values | 1,024 | 1,024 |
| Handler deadline per event | n/a | 5 s |
| Session-start initialization deadline | n/a | 500 ms |
| Corpus census cache bytes per session | n/a | 64 KiB |
