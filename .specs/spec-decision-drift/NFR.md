# Non-Functional Requirements

## NFR-PERF-1: Drift scan is linear and bounded

A full drift scan SHALL be linear in the number of corpus bytes and SHALL complete within 2 s for 500 documents of 200 KB total. A decision whose declared pattern is absent from the corpus SHALL report `no-matches` rather than passing silently.

## NFR-COMPAT-1: Release gate is a conjunction

Shipping this capability SHALL require the accepted candidate gates of `plugin-distribution` and `spec-mcp-operations` to pass for the release candidate, plus the BDD and unit evidence recorded in this specification. This specification's own release conjunction adds to those gates and SHALL NOT loosen them.
