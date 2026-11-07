# Non-Functional Requirements

## NFR-SEC-1: No shell interpolation and no secret in evidence

A command SHALL be executed as an argument vector, never concatenated into a shell string. The executable SHALL be checked against an allowlist before the spawn, and the recorded log tail SHALL redact values that look like credentials. Evidence files SHALL live outside the specification corpus.

## NFR-PERF-1: Bounded execution and recording

A run SHALL be bounded by an explicit timeout, 900 s by default and never unbounded. Writing one evidence record SHALL take under 100 ms with a log tail of at most 16 KiB.

## NFR-COMPAT-1: Release gate is a conjunction

Shipping this capability SHALL require the accepted candidate gates of `plugin-distribution` and `spec-mcp-operations` to pass for the release candidate, plus the BDD and unit evidence recorded in this specification. This specification's own release conjunction adds to those gates and SHALL NOT loosen them.
