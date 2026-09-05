# NFR

## Read / Core

These budgets constrain the installed child artifact and the immutable graph. Measurements identify artifact hash, core schema, graph fingerprint, runtime, OS, CPU, memory, warm-up, sample count, and raw observations.

## NFR-CORE-PERFORMANCE-1: Latency and cancellation

On the retained reference shape of 30 specs, 450 canonical documents, 6,000 definitions, 18,000 references, and 10 MiB UTF-8:

- contained read plus graph build: at most 2,000 ms p95 over 20 samples after one warm-up;
- inventory and diagnostics: at most 25 ms p95 over 100 samples on a built graph;
- findNodes and traverse at default limits: at most 50 ms p95 over 100 samples;
- maximum permitted traversal or page: at most 250 ms p95 or an explicit cancellation/limit error;
- long loops observe cancellation at least every 1,024 items or 10 ms of monotonic adapter time.

## NFR-CORE-SIZE-1: Size and memory

- kernel plus OMP runtime: at most 1.5 MiB uncompressed and 500 KiB gzip;
- adding the MCP compatibility adapter: at most 2.0 MiB uncompressed and 700 KiB gzip;
- one serialized response: at most 1 MiB UTF-8, otherwise page at an item boundary or return `RESPONSE_TOO_LARGE`;
- peak incremental memory: at most 128 MiB above idle on the reference shape;
- a hard-limit corpus is rejected before 192 MiB above baseline.

## NFR-CORE-SECURITY-1: Containment and minimization

Only an explicit root and canonical document allowlist are read. Links, junctions, reparse points, mounts, traversal, non-regular files, `.git`, `.env*`, home, caches, logs, and state databases are excluded. Public paths are repository-relative NFC slash paths. Errors contain no absolute paths, environment values, stack traces, arbitrary OS prose, or bodies by default. Every operation writes zero bytes and creates zero state artifacts.

## NFR-CORE-RELIABILITY-1: Determinism and bounded errors

Equivalent normalized sources and membership limits produce byte-identical graph serialization and fingerprint on supported platforms. Arrays and object keys use stable schema order. Unknown schema, primitive, node, edge, cursor, or required field returns a typed error. Any graph ERROR makes `valid=false`; diagnostics are not release evidence.

## NFR-LIMITS-1: Hard input and query limits

| Budget | Default | Hard maximum |
|---|---:|---:|
| Specs | all supplied | 100 |
| Canonical documents | all supplied | 2,000 |
| Bytes per document | n/a | 2 MiB |
| Aggregate source bytes | n/a | 50 MiB |
| Path bytes | n/a | 512 UTF-8 bytes |
| Lines per document | n/a | 100,000 |
| Definition occurrences | n/a | 100,000 |
| Reference occurrences | n/a | 500,000 |
| Diagnostics | 1,000 | 10,000 |
| Query page | 50 | 200 |
| Traversal depth | 2 | 8 |
| Traversal visited | 1,000 | 5,000 |
| Cursor bytes | n/a | 512 ASCII bytes |
| Serialized response | n/a | 1 MiB |

## Read / Evidence

Measurements identify the tested implementation identity, schema version, OS, CPU, sample count, warm-up policy, and raw observations. Measurements are future evidence, not claims in this document.

## NFR-EVIDENCE-PERF-1: Evaluation latency

- One complete evaluation of 200 scenarios and 5 runs totaling 4 MiB SHALL complete in at most 2 s p95 over 20 external samples.
- The pure evaluator SHALL read no clock; the caller records timing.

## NFR-EVIDENCE-SIZE-1: Artifact and response size

- One artifact SHALL be at most 16 MiB and one evaluation at most 64 MiB aggregate.
- One MCP response SHALL be at most 1 MiB.
- One complete failed-step/error value SHALL be at most 8 KiB; otherwise return `RESPONSE_TOO_LARGE` rather than truncate it.

## NFR-EVIDENCE-MEM-1: Memory bound

Peak incremental resident memory SHALL be at most 64 MiB above idle on the reference corpus. Inputs beyond hard limits SHALL be refused before full parsing.

## NFR-EVIDENCE-SEC-1: Containment and data minimization

- The capture adapter SHALL canonicalize its root and reject traversal, absolute escape, symlink, junction, and reparse escape before opening a file.
- Diagnostics SHALL contain repository-relative identifiers only, never credentials, environment values, absolute paths, stack traces, or arbitrary OS error text.
- The evaluator SHALL access only supplied values.

## NFR-EVIDENCE-REL-1: Determinism and reproducibility

- Identical current bindings, envelopes, and limits SHALL produce byte-identical evaluation output across Windows and POSIX.
- Output order SHALL be scenario ID, capture sequence, producer result ID; diagnostics SHALL use phase, capture ID, scenario ID, code.
- Unknown producer identity, malformed bytes, and invalid envelope fields fail closed rather than guess.

## NFR-EVIDENCE-USE-1: Actionable diagnostics

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

## Write

## NFR-SAFETY-1: Fail closed

A missing validator, unresolved target, incomplete preview, CAS mismatch, uncertain writer state, or malformed response SHALL never authorize a write. `RECOVERY_REQUIRED` allows only manual VCS/backup restoration outside the public tool surface.

## NFR-DURABILITY-1: Atomic visibility

On supported filesystems, staging SHALL be same-filesystem and file/directory synchronization SHALL occur where available. Coordinated readers SHALL observe a complete old or new generation only.

## NFR-DETERMINISM-1: Stable proposal identity

Equal canonical snapshot bytes, operations, policy, and bounds SHALL produce equal normalized operations, finding order, diffs, after-hashes, and Proposal hash.

## NFR-CONCURRENCY-1: Bounded locking

Lock acquisition SHALL have a documented finite bound. A timeout returns `CONFLICT` without changing bytes; every successful lock holder rechecks CAS and containment immediately before commit.

## NFR-PORTABILITY-1: Platform containment

Windows reparse/junction/device/ADS rules and POSIX symlink/mount rules SHALL be tested on their real platforms. Unsupported metadata or durability primitives fail closed with a bounded diagnostic.

## NFR-PRIVACY-1: Redaction

Errors and receipts SHALL use repository-relative document paths and hashes only. They SHALL contain no document body, secret, environment value, stack trace, absolute unrelated path, or retained generation bytes.

## NFR-COMPATIBILITY-1: Byte and EOL conservation

Untouched spans SHALL remain byte-identical. Existing encoding, EOL style, and final-newline state SHALL be preserved unless an explicit whole-document operation intentionally replaces them and the preview shows the exact result.

## NFR-WRITE-PERFORMANCE-1: Bounded work

Preview bytes, operation count, document count, findings, and diagnostic text SHALL have explicit implementation constants. Exceeding a bound returns `INVALID_REQUEST` with exact observed and allowed counts and no partial preview or write.

## NFR-MAINTAINABILITY-1: One core

Both public tools and all internal helpers SHALL use one operation normalizer, one validator composition, one containment resolver, and one writer. No parallel task lifecycle, review state, release evaluator, recovery API, or audit ledger is permitted.


## NFR-READ-EDIT-1: Read-modify-write integrity

Read-for-edit SHALL use one bounded read, preserve exact bytes and digest, and never disclose absolute paths. Optional root binding SHALL not weaken snapshot, preimage, lock, rollback, or atomicity guarantees.
