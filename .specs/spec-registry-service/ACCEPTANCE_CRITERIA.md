# Acceptance criteria

Status: DRAFT

### AC-1 — Specs live only on `specs`

**Given** a managed repository, **when** a developer pushes `.specs/**` on `main` or any code branch, **then** the push/PR fails the required check; and pushes to `specs` from any identity other than the service bot are rejected.

### AC-2 — Write through service only

**Given** two agents hold edits to the same spec document, **when** both submit `spec_patch` with the same `expectedSha`, **then** exactly one commits; the loser receives `CONFLICT` with `retryable: true` and can retry against the new fingerprint.

### AC-3 — Claim discipline

**Given** a spec claimed by user A (lease active), **when** user B submits a write without `force`, **then** the service refuses with a claim-conflict error naming the holder and expiry; **when** the lease expires, **then** B may claim and write.

### AC-4 — Multi-project isolation

**Given** projects `a` and `b` mounted, **when** a request omits `project`, **then** it resolves against the caller's default project; **when** it names `project: "b"`, **then** no path or slug of project `a` is reachable from that call.

### AC-5 — Remote MCP parity

**Given** an agent connected to the remote endpoint, **when** it invokes each of the nine read ops and `spec_patch`, **then** envelopes match the stdio server's shape field-for-field (same contract tests, transport swapped).

### AC-6 — YouTrack proposal flow

**Given** a human edits a requirement in the YouTrack app, **when** the app calls `POST /rpc` with a proposal intent, **then** the response contains the same `documents` previews and `proposalHash` the MCP path returns, and apply without that hash is refused.

### AC-7 — Compose boot

**Given** a host with only repo credentials + project config + service token, **when** `docker compose up` runs, **then** the service mounts each project, creates missing `specs` branches, rebuilds the index, and serves reads within N seconds of readiness (N recorded at first run).

### AC-8 — Read survives outage

**Given** the service stopped, **when** a consumer clones the `specs` branch, **then** the `.specs/` tree is complete and self-consistent (kernel validation passes offline).

### AC-9 — Pin integrity

**Given** `spec-refs.json` pins `plugin-distribution@1.4.0`, **when** the ledger digest for that version differs from the pin, **then** `omp spec verify` fails closed and names the divergent spec.

### AC-10 — No silent drift

**Given** an admin break-glass pushes to `specs` directly, **when** the service next syncs, **then** the commit appears in `/drift` output and the index is reprojected rather than silently accepted.
