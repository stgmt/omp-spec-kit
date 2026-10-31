# Non-Functional Requirements

## NFR-IDEMPOTENCE-1: Idempotent delivery

Re-running install, dashboard provisioning, demo load, or delete SHALL converge without duplicate dashboards, widgets, cards, or branch artifacts.

## NFR-SECURITY-1: Permissions and secrets

Install/attach/dashboard share SHALL require the documented YouTrack permissions. Delete SHALL require owner or writer. Tokens, bridge secrets, and absolute user paths SHALL NOT appear in warnings, logs, or rendered errors.

## NFR-BOUNDS-1: Bounded warnings

The agent warning SHALL be bounded, emitted at most once per session, and SHALL never block a tool call or the session.

## NFR-COMPAT-1: Compatibility

The package SHALL declare its minimum YouTrack version and SHALL fail closed on an incompatible host or service contract.

## NFR-AUDIT-1: Auditability

Spec/entity deletion, dashboard sharing, and demo load SHALL produce an audit record with the verified caller and the affected spec/entity.

## NFR-OFFLINE-1: Self-hosted operation

The ZIP/CLI path SHALL work on a self-hosted YouTrack without Marketplace access. No default service URL or host SHALL be baked into the package.
