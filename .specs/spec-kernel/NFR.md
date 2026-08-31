# Non-Functional Requirements

These budgets constrain the installed child artifact and the immutable graph. Measurements identify artifact hash, core schema, graph fingerprint, runtime, OS, CPU, memory, warm-up, sample count, and raw observations.

## NFR-PERFORMANCE-1: Latency and cancellation

On the retained reference shape of 30 specs, 450 canonical documents, 6,000 definitions, 18,000 references, and 10 MiB UTF-8:

- contained read plus graph build: at most 2,000 ms p95 over 20 samples after one warm-up;
- inventory and diagnostics: at most 25 ms p95 over 100 samples on a built graph;
- findNodes and traverse at default limits: at most 50 ms p95 over 100 samples;
- maximum permitted traversal or page: at most 250 ms p95 or an explicit cancellation/limit error;
- long loops observe cancellation at least every 1,024 items or 10 ms of monotonic adapter time.

## NFR-SIZE-1: Size and memory

- kernel plus OMP runtime: at most 1.5 MiB uncompressed and 500 KiB gzip;
- adding the MCP compatibility adapter: at most 2.0 MiB uncompressed and 700 KiB gzip;
- one serialized response: at most 1 MiB UTF-8, otherwise page at an item boundary or return `RESPONSE_TOO_LARGE`;
- peak incremental memory: at most 128 MiB above idle on the reference shape;
- a hard-limit corpus is rejected before 192 MiB above baseline.

## NFR-SECURITY-1: Containment and minimization

Only an explicit root and canonical document allowlist are read. Links, junctions, reparse points, mounts, traversal, non-regular files, `.git`, `.env*`, home, caches, logs, and state databases are excluded. Public paths are repository-relative NFC slash paths. Errors contain no absolute paths, environment values, stack traces, arbitrary OS prose, or bodies by default. Every operation writes zero bytes and creates zero state artifacts.

## NFR-RELIABILITY-1: Determinism and bounded errors

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
