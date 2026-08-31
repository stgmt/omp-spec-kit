# Non-Functional Requirements

Measurements identify the tested implementation identity, schema version, OS, CPU, sample count, warm-up policy, and raw observations. Measurements are future evidence, not claims in this document.

## NFR-PERF-1: Evaluation latency

- One complete evaluation of 200 scenarios and 5 runs totaling 4 MiB SHALL complete in at most 2 s p95 over 20 external samples.
- The pure evaluator SHALL read no clock; the caller records timing.

## NFR-SIZE-1: Artifact and response size

- One artifact SHALL be at most 16 MiB and one evaluation at most 64 MiB aggregate.
- One MCP response SHALL be at most 1 MiB.
- One complete failed-step/error value SHALL be at most 8 KiB; otherwise return `RESPONSE_TOO_LARGE` rather than truncate it.

## NFR-MEM-1: Memory bound

Peak incremental resident memory SHALL be at most 64 MiB above idle on the reference corpus. Inputs beyond hard limits SHALL be refused before full parsing.

## NFR-SEC-1: Containment and data minimization

- The capture adapter SHALL canonicalize its root and reject traversal, absolute escape, symlink, junction, and reparse escape before opening a file.
- Diagnostics SHALL contain repository-relative identifiers only, never credentials, environment values, absolute paths, stack traces, or arbitrary OS error text.
- The evaluator SHALL access only supplied values.

## NFR-REL-1: Determinism and reproducibility

- Identical current bindings, envelopes, and limits SHALL produce byte-identical evaluation output across Windows and POSIX.
- Output order SHALL be scenario ID, capture sequence, producer result ID; diagnostics SHALL use phase, capture ID, scenario ID, code.
- Unknown producer identity, malformed bytes, and invalid envelope fields fail closed rather than guess.

## NFR-USE-1: Actionable diagnostics

Every diagnostic SHALL use a closed code, name the affected capture/scenario when known, and state the repair: recapture full scope, rerun changed scenario, fix stable identity, or inspect the referenced trace. Name-match candidates SHALL be explicitly non-authoritative.

## Hard limits

| Budget | Hard maximum |
|---|---:|
| Single artifact | 16 MiB |
| Aggregate artifacts | 64 MiB |
| Runs per evaluation | 64 |
| Parsed producer rows | 1,000,000 |
| Diagnostics | 10,000 / 512 KiB |
| MCP response | 1 MiB |
| Failed-step/error | 8 KiB complete |
