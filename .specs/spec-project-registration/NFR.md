# Non-Functional Requirements

## NFR-SEC-1: Authorization and secrets stay on the service side

A registration SHALL be refused unless the caller holds owner or writer role for the target project, and the role check SHALL happen before any remote probe. A credential supplied for the binding SHALL NOT be returned, echoed or written to a log or an audit record; the audit record SHALL name the actor, the project and the repository URL without the credential.

## NFR-PERF-1: Bounded registration

A registration SHALL report within 120 s or report progress, including the remote probe and the snapshot migration. A probe that hangs SHALL fail with a typed refusal inside its own bound rather than leave the caller waiting.

## NFR-COMPAT-1: Release gate is a conjunction

Shipping this capability SHALL require the accepted candidate gates of `plugin-distribution`, `spec-registry-service` and `spec-mcp-operations` for the release candidate, plus the BDD and unit evidence recorded in this specification. This specification's own release conjunction adds to those gates and SHALL NOT loosen them.
