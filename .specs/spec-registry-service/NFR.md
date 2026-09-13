# Non-functional requirements

Status: DRAFT

### NFR-1 — Availability

Consumers have no repository access, so their read availability **is** service uptime — a service outage is a full read+write outage for consumers (accepted in v1; target "team hours", no 24/7). The operator retains the ultimate fallback: the specs repo is clonable at all times.

### NFR-2 — Integrity

Every published spec version is digest-addressed and attested (existing release pipeline pattern). Any served spec can be re-verified against its digest from git alone — the service is not required to prove content.

### NFR-3 — Auditability

`git log` on `specs` + `Spec-Author:`/`Spec-Request-Id:` trailers must answer "who changed what when" without the service database. The SQLite store is a cache of claims/ledger, never the only record of content change.

### NFR-4 — Performance and read consistency

Single-writer serialization per project is acceptable: spec write volume is human-scale. Read ops must not wait on an in-flight write transaction **and must never observe mid-transaction files**: the service serves a cached graph snapshot rebuilt after each committed transaction (stale-read allowed, `baseSnapshotSha256` disclosed in the envelope). Serving straight from the worktree during a commit is a defect, not a tolerated race.

### NFR-5 — Security baseline (v1)

The endpoint is reachable beyond localhost (agents and third-party YouTrack instances) — TLS via the compose reverse proxy is required, not optional. Per-tenant bearer tokens on all endpoints; every token resolves to a tenant→allowed-projects set. No anonymous access. `detectSecret` runs on every write (existing behavior, unchanged).

### NFR-6 — Operability

`docker compose up` from a clean host yields a working registry given only: repo credentials for the bot, project config, and the service token. Recovery from a dirty worktree is automatic (existing transaction recovery).

### NFR-7 — Backward compatibility

`spec-kernel@1` envelopes remain parseable; new `project` field is optional at the protocol level (server binds the caller's default project). Local stdio mode is kept for unmanaged checkouts.
