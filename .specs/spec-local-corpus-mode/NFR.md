# Non-Functional Requirements

## NFR-PERF-1: Bounded resolution and probe

A local resolution and the preflight report SHALL complete within 250 ms on a warm filesystem for a corpus of up to 500 documents, and the hosted report SHALL complete within 2 s, including a registry probe that is bounded by its own timeout. A probe that exceeds its bound SHALL report `registryReachable: false` with `probeTimedOut: true` and SHALL NOT fail the enclosing tool call.

## NFR-SEC-1: Local mode reads no credential

Local mode SHALL NOT read, require or forward a registry token, and SHALL NOT contact the registry. A corpus opened locally SHALL be served from the requested root only.

## NFR-COMPAT-1: Release gate is a conjunction

Shipping this capability SHALL require the accepted candidate gates of `plugin-distribution` and `spec-mcp-operations` to pass for the release candidate, plus the BDD and unit evidence recorded in this specification. This specification's own release conjunction adds to those gates and SHALL NOT loosen them. The capability SHALL NOT be claimed in a release whose candidate evidence is stale.
