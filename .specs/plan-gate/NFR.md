# Non-Functional Requirements

Budgets are release gates for the installed child-plugin artifact carrying the gate. Measurements must identify artifact SHA-256, gate schema version, OMP/runtime version, OS, CPU, sample count, warm-up policy, and raw observations.

## NFR-PERF-1: Validation latency

- One complete validation over a 256 KiB explicit plan, 20 supplied duplicate candidates, five prompt excerpts and five referenced specs SHALL complete in at most 500 ms p95 over 20 samples.
- Admission/hash/mode checks SHALL complete in at most 1 ms p95.
- Preventive contract rendering SHALL complete in at most 5 ms p95 and read no filesystem.
- Every loop observes an internal deadline no greater than 20 s, below the 30 s host outer timeout.

## NFR-SIZE-1: Artifact and message size

- The gate module plus bundled resources (`plan-template.md`, `section-model.json`, `guarded-paths.json`) SHALL add at most 256 KiB uncompressed; all three contents/hashes appear in the resource inventory.
- One rendered host reason SHALL be at most 16 KiB and contain only complete error+hint rows, exact omitted count/cursor, then bounded excerpts.
- The full result MAY exceed one reason page only through explicit cursor paging; total counts never truncate silently.
- One diagnostic message SHALL be at most 1,024 Unicode scalars; diagnostic state per session SHALL be at most 100 records or 256 KiB.
- Preventive contract output SHALL be at most 2 KiB; prompt excerpts are at most 4 KiB each and 64 KiB aggregate.

## NFR-MEM-1: Memory bound

- Peak incremental resident memory for one gate run SHALL be at most 32 MiB above the idle plugin baseline on the reference plan corpus.
- Plan content over 1 MiB or duplicate candidates over 20 / 8 MiB aggregate SHALL refuse admission before parsing.

## NFR-SEC-1: Containment and data minimization

- MANUAL plan bytes and duplicate candidates are caller-supplied and hash-checked; the validator scans no plan directory.
- Spec-reference adapter reads only contained `<project-root>/.specs/` canonical documents and rejects traversal/symlink/reparse before read.
- Diagnostics/reasons SHALL contain no absolute paths, environment, credentials, stack or arbitrary OS text.
- Prompt excerpts remain input-only and are never written to repository/session state.

## NFR-REL-1: Determinism and fail-open results

- Identical closed validation input (plan, session transition, candidates, prompt excerpts, complete spec index, resources and limits) SHALL produce byte-identical results on Windows and POSIX.
- Error lists SHALL be ordered by phase, then line, then code.
- Blocking SHALL occur only after complete successful validation with one or more errors; every bridge fault allows.
- Unknown/extra schema fields and invalid closed values are `PLAN_SCHEMA_INVALID` validation errors. Malformed/over-budget cache before input construction returns `PROMPT_CACHE_UNAVAILABLE`; unreadable/non-UTF-8 plan source before exact content returns `PLAN_INPUT_UNAVAILABLE`. No path guesses.

## NFR-USE-1: Actionable deny content

Every blocking error SHALL carry a 1-based line when applicable, a violated-rule message and a concrete remediation hint. The bounded reason SHALL include complete findings and overflow cursor first; template and up to five prompt excerpts are appended only while complete bytes fit. The structured cursor pages are the completeness authority.

## Hard input limits

| Budget | Default | Hard maximum |
|---|---:|---:|
| Plan bytes | n/a | 1 MiB |
| Explicit duplicate candidates | 0 | 20 |
| Aggregate duplicate bytes | n/a | 8 MiB |
| Prompt excerpts | 5 | 5 |
| Prompt excerpt bytes | 4 KiB | 4 KiB |
| Prompt aggregate bytes | n/a | 64 KiB |
| File Changes rows | n/a | 500 |
| Qualified spec references | n/a | 50 |
| Referenced spec documents | n/a | 5 per spec |
| Bytes per referenced document | n/a | 512 KiB |
| Aggregate spec bytes | n/a | 2 MiB |
| Errors per result page | n/a | 200 |
| Template excerpt bytes | n/a | 8 KiB |
| Host reason bytes | n/a | 16 KiB |
| Diagnostic records | 100 | 100 |
| Diagnostic message | n/a | 1,024 Unicode scalars |
| Diagnostic state bytes | n/a | 256 KiB |
| Internal deadline | n/a | 20 s |
