# Non-functional requirements

Status: DRAFT

### NFR-1 — Availability

Reads must not depend on service uptime: the `specs` branch is clonable at all times. Write availability target is "team hours"; there is no 24/7 requirement in v1.

### NFR-2 — Integrity

Every published spec version is digest-addressed and attested (existing release pipeline pattern). Any served spec can be re-verified against its digest from git alone — the service is not required to prove content.

### NFR-3 — Auditability

`git log` on `specs` + `Spec-Author:`/`Spec-Request-Id:` trailers must answer "who changed what when" without the service database. The SQLite store is a cache of claims/ledger, never the only record of content change.

### NFR-4 — Performance

Single-writer serialization per project is acceptable: spec write volume is human-scale. Read ops must not wait on an in-flight write transaction; they serve the last committed graph (stale-read allowed, `baseSnapshotSha256` disclosed in the envelope).

### NFR-5 — Security baseline (v1)

Service token on agent endpoints; bind inside compose network by default; no anonymous internet exposure without the auth seam implemented. `detectSecret` runs on every write (existing behavior, unchanged).

### NFR-6 — Operability

`docker compose up` from a clean host yields a working registry given only: repo credentials for the bot, project config, and the service token. Recovery from a dirty worktree is automatic (existing transaction recovery).

### NFR-7 — Backward compatibility

`spec-kernel@1` envelopes remain parseable; new `project` field is optional at the protocol level (server binds the caller's default project). Local stdio mode is kept for unmanaged checkouts.
