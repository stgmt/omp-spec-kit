# Non-Functional Requirements

Budgets are release gates for the installed artifact carrying the evidence evaluator. Measurements must identify artifact SHA-256, schema version, kernel graph version, OS, CPU, sample count, warm-up policy, and raw observations.

## NFR-PERF-1: Evaluation latency

- One complete evaluation run on a reference corpus (kernel graph with 30 specs, 200 scenarios, 5 artifacts totaling 4 MiB) SHALL complete in at most 2 s p95 over 20 samples on the reference machine.
- Artifact ingestion alone SHALL complete in at most 500 ms p95 per 1 MiB artifact.
- Scenario-result join over 200 results against 200 canonical scenarios SHALL complete in at most 200 ms p95.
- Freshness comparison over 200 joined results SHALL complete in at most 100 ms p95.
- Census computation SHALL complete in at most 50 ms p95 after joins are complete.

## NFR-SIZE-1: Artifact and result size

- A single PRESENT execution artifact SHALL be at most 16 MiB; larger input returns `LIMIT_EXCEEDED` before parsing.
- One MCP response SHALL be at most 1 MiB; larger pageable output uses explicit totals/cursor.
- Diagnostic state SHALL be at most 10,000 records and 512 KiB.
- Coverage census serialized form SHALL be at most 256 KiB.

## NFR-MEM-1: Memory bound

- Peak incremental resident memory for one evaluation run SHALL be at most 64 MiB above the idle baseline on the reference corpus.
- Artifact bytes over 16 MiB SHALL be refused before parsing.
- Aggregate artifact bytes across all artifacts in one evaluation SHALL stop at 64 MiB and refuse remaining artifacts.

## NFR-SEC-1: Containment and data minimization

- All artifact reads SHALL stay inside the caller-supplied containment root; every path SHALL be containment-checked (traversal, absolute, symlink/junction/reparse rejected) before opening.
- Diagnostics and evaluation output SHALL NOT contain absolute paths, environment values, credentials, stack traces, or arbitrary OS error text; repository-relative and artifact-relative paths only.
- The evaluator SHALL NOT read `.git`, `.env*`, user home, plugin cache, or non-canonical documents beyond supplied artifacts and the kernel graph.

## NFR-REL-1: Determinism and reproducibility

- Identical kernel bindings, artifact bytes, and limits SHALL produce byte-identical evaluation output across Windows and POSIX.
- Join outcomes SHALL be ordered by canonical scenario ID, producer result ID, then layer.
- Diagnostics SHALL be ordered by evaluation phase, artifact ID, scenario ID, then code.
- Unsupported kind/version produces `NOT_INGESTED/UNSUPPORTED_ARTIFACT_IDENTITY`; malformed bytes produce `NOT_INGESTED/MALFORMED_ARTIFACT`; neither path guesses.

## NFR-USE-1: Actionable diagnostics

Every diagnostic SHALL carry a closed code, a human message naming the violated invariant or failure, and sufficient context (artifact identifier, scenario ID, record index) to locate the issue without external tools. Census conservation violations SHALL name the specific equation that failed and the observed vs expected counts.

## Hard input limits

| Budget | Default | Hard maximum |
|---|---:|---:|
| Single artifact bytes | n/a | 16 MiB |
| Aggregate artifact bytes per evaluation | n/a | 64 MiB |
| Artifacts per evaluation | 16 | 64 |
| Parsed producer rows | n/a | 1,000,000 |
| Diagnostic records/bytes | 200 | 10,000 / 512 KiB |
| Census bytes | n/a | 256 KiB |
| MCP response bytes | n/a | 1 MiB |
| Trace failed-step/error bytes | n/a | 8 KiB complete or `RESPONSE_TOO_LARGE` |
| External evaluation deadline | n/a | 120 s |
