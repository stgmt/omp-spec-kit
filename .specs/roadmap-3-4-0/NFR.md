# Non-Functional Requirements

## NFR-SCOPE-1: One source of truth per fact

Every in-scope item of this release SHALL trace to issue #51 or to one of the wave specifications linked from this document. A capability SHALL NOT be reported as shipped unless its wave specification reports its acceptance criteria green with recorded evidence; a status written by hand in prose SHALL NOT count.

## NFR-COMPAT-1: Release gate is a conjunction

The release SHALL require the accepted candidate gates of `plugin-distribution`, `spec-mcp-operations` and `spec-registry-service` for the release candidate, plus the evidence of all four wave specifications. This roadmap adds to those gates and SHALL NOT loosen them.
