# Non-Functional Requirements

Budgets are release gates for the installed artifact carrying the evidence evaluator. Measurements must identify artifact SHA-256, schema version, kernel graph version, OS, CPU, sample count, warm-up policy, and raw observations.

## NFR-PERF-1: Evaluation latency

- One complete evaluation run on a reference corpus (kernel graph with 30 specs, 200 scenarios, 5 artifacts totaling 4 MiB) SHALL complete in at most 2 s p95 over 20 samples on the reference machine.
- Artifact ingestion alone SHALL complete in at most 500 ms p95 per 1 MiB artifact.
- Scenario-result join over 200 results against 200 canonical scenarios SHALL complete in at most 200 ms p95.
- Freshness comparison over 200 joined results SHALL complete in at most 100 ms p95.
- Census computation SHALL complete in at most 50 ms p95 after joins are complete.

## NFR-SIZE-1: Artifact and result size

- A single execution artifact SHALL be at most 16 MiB; artifacts exceeding this limit SHALL produce `NOT_INGESTED` with reason `MALFORMED_ARTIFACT` before parsing.
- The evaluation output for one run SHALL be at most 4 MiB serialized.
- One diagnostic record message SHALL be at most 1,024 Unicode scalar values; diagnostic state per evaluation SHALL be at most 200 records or 512 KiB, whichever first.
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

- Identical kernel graph, artifact bytes, and limits SHALL produce byte-identical evaluation output (ingestion states, join outcomes, freshness verdicts, status truth, census) across repeated runs on Windows and POSIX.
- Join outcomes SHALL be ordered by qualified scenario ID, then tag, then name.
- Diagnostics SHALL be ordered by phase, then artifact, then code.
- Unknown schema versions, malformed artifact encodings, or unrecognized artifact kinds SHALL produce `NOT_INGESTED` with appropriate reason, never a guess.

## NFR-USE-1: Actionable diagnostics

Every diagnostic SHALL carry a closed code, a human message naming the violated invariant or failure, and sufficient context (artifact identifier, scenario ID, record index) to locate the issue without external tools. Census conservation violations SHALL name the specific equation that failed and the observed vs expected counts.

## Hard input limits

| Budget | Default | Hard maximum |
|---|---:|---:|
| Single artifact bytes | n/a | 16 MiB |
| Aggregate artifact bytes per evaluation | n/a | 64 MiB |
| Artifacts per evaluation | n/a | 50 |
| Canonical scenarios per evaluation | n/a | 10,000 |
| Diagnostic records per evaluation | 200 | 200 |
| Evaluation output bytes | n/a | 4 MiB |
| Evaluation run deadline | n/a | 120 s |
