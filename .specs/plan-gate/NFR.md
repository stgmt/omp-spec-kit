# Non-Functional Requirements

Budgets are release gates for the installed child-plugin artifact carrying the gate. Measurements must identify artifact SHA-256, gate schema version, OMP/runtime version, OS, CPU, sample count, warm-up policy, and raw observations.

## NFR-PERF-1: Validation latency

- One complete gate run on a 256 KiB plan with full pipeline (duplicate scan over ≤20 sibling plans, structure, grounding over 10 cached prompts, cross-reference, spec-reference over ≤5 referenced specs) SHALL complete in at most 500 ms p95 over 20 samples on the reference machine, so that including OMP hook overhead the run stays far below any interactive deadline.
- The match predicate in the `tool_call` handler (target inspection only) SHALL complete in at most 1 ms p95; non-matching tool calls SHALL return without any plan-directory I/O.
- The `context` injection handler SHALL complete in at most 5 ms p95 and SHALL NOT read the plan directory.
- Loops over plan lines, table rows, and cached prompts SHALL observe a total deadline of 60 s per run; deadline expiry is a fault and allows per FR-2.

## NFR-SIZE-1: Artifact and message size

- The gate module plus bundled resources (template, section model, guarded-path list) SHALL add at most 256 KiB uncompressed to the installed child artifact.
- One blocking reason SHALL be at most 16 KiB UTF-8: errors first (complete entries), then template excerpt ≤8 KiB, then prompt excerpt; truncation is explicit.
- One diagnostic record message SHALL be at most 1,024 Unicode scalar values; diagnostic state per session SHALL be at most 100 records or 256 KiB, whichever first, ring-evicting oldest.
- The plan-mode injection message SHALL be at most 2 KiB.
- Prompt cache entries SHALL be stored trimmed to 4 KiB each; the cache file SHALL be at most 64 KiB.

## NFR-MEM-1: Memory bound

- Peak incremental resident memory for one gate run SHALL be at most 32 MiB above the idle plugin baseline on the reference plan corpus.
- Plan bytes over 2 MiB SHALL be refused before parsing (fault-allow path); aggregate sibling reads during duplicate scan SHALL stop at 8 MiB and skip remaining candidates.

## NFR-SEC-1: Containment and data minimization

- All reads SHALL stay inside the session-local plan directory and `<project-root>/.specs/`; every path SHALL be containment-checked (traversal, absolute, symlink/junction/reparse rejected) before opening.
- Diagnostics, deny reasons, and injection text SHALL NOT contain absolute paths, environment values, credentials, stack traces, or arbitrary OS error text; session-relative and repository-relative paths only.
- Prompt cache text SHALL remain inside the session-local directory and SHALL NOT be written to the repository, returned to other sessions, or transmitted.
- The gate SHALL NOT read `.git`, `.env*`, user home, plugin cache, or non-canonical documents beyond plan files and referenced spec documents.

## NFR-REL-1: Determinism and fail-open results

- Identical plan text, cache, and project tree SHALL produce byte-identical validation results (error list, lines, codes, ordering) across repeated runs on Windows and POSIX.
- Error lists SHALL be ordered by phase, then line, then code.
- Blocking SHALL occur only after a complete successful validation with one or more blocking errors; every other outcome allows.
- Unknown schema versions, malformed cache JSON, or unrecognizable plan encodings SHALL take the fault-allow path with a diagnostic, never a block and never a guess.

## NFR-USE-1: Actionable deny content

Every blocking error SHALL carry 1-based line number, a human message naming the violated rule, and a remediation hint stating the concrete fix. The deny reason SHALL include the template excerpt and the last five prompt excerpts per FR-10 so that the repairing agent has the contract and the task context in one artifact.

## Hard input limits

| Budget | Default | Hard maximum |
|---|---:|---:|
| Plan file bytes | n/a | 2 MiB |
| Sibling plan files scanned for duplicates | all in dir | 20 |
| Aggregate sibling bytes | n/a | 8 MiB |
| Cached prompts per session | 10 | 10 |
| Cache entry bytes | 4 KiB | 4 KiB |
| File Changes rows | n/a | 500 |
| Qualified spec references checked | n/a | 50 |
| Referenced spec documents read per run | n/a | 5 per spec |
| Bytes per referenced spec document | n/a | 512 KiB |
| Aggregate spec-document bytes per run | n/a | 2 MiB |
| Blocking reason bytes | n/a | 16 KiB |
| Diagnostic records per session | 100 | 100 |
| Total run deadline | n/a | 60 s |
