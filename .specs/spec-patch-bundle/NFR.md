# Non-Functional Requirements

## NFR-PERF-1: Bounded preview

A preview SHALL be produced within 5 s for a bundle touching 20 documents of 200 KB total on a warm filesystem, and each document's diff SHALL be capped at 64 KiB with an explicit truncation flag. A truncated diff SHALL still report the affected line ranges.

## NFR-COMPAT-1: Release gate is a conjunction

Shipping this capability SHALL require the accepted candidate gates of `plugin-distribution` and `spec-mcp-operations` to pass for the release candidate, plus the BDD and unit evidence recorded in this specification. This specification's own release conjunction adds to those gates and SHALL NOT loosen them.
