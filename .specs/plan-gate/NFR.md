# Non-Functional Requirements

## NFR-PERF-1: Bounded latency

A 1 MiB admitted plan SHALL complete in at most 500 ms p95 over 20 measured runs on the recorded reference environment. Measurements SHALL record artifact SHA-256, runtime, OS, CPU, warm-up policy, sample count, and raw observations.

## NFR-SIZE-1: Bounded input and output

Plan content SHALL be at most 1 MiB UTF-8, `requestText` at most 64 KiB UTF-8, and `sourceUri` at most 2,048 UTF-8 bytes. A result SHALL contain at most 50 findings; each code at most 64 bytes, message at most 240 bytes, and hint at most 240 bytes. `omittedCount` SHALL remain exact.

## NFR-REL-1: Cross-platform determinism

Identical requests SHALL produce byte-identical status, digest, ordered findings, and omitted count on supported Windows and POSIX runtimes. Newline normalization SHALL affect line parsing only; the digest SHALL always cover original bytes.

## NFR-SEC-1: Data minimization

The function SHALL use only supplied strings, SHALL not dereference `sourceUri`, and SHALL not include absolute local paths, request text, or plan excerpts in findings. Unexpected exceptions SHALL be converted to the closed `VALIDATOR_FAILURE` diagnostic.

## NFR-USE-1: Actionable diagnostics

Every error SHALL identify the violated semantic field or malformed file/action row and provide one concrete repair hint. A line SHALL be present when the issue maps to supplied plan text and omitted only for request-level diagnostics.
