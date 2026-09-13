# Functional requirements

Status: DRAFT

## Branch and storage

### FR-1 — Specs branch provisioning

Given a managed repo without a `specs` branch, when the service first mounts the project, it creates an orphan `specs` branch containing only `.specs/` (with any imported content) and pushes it as the bot.

### FR-2 — Write-path exclusivity

Only the service bot can push to `specs`. Any push carrying `.specs/**` to a non-`specs` branch fails a required check. Break-glass pushes by repo admins are detected on the next service sync and recorded as drift events.

### FR-3 — Per-project worktrees

The service maintains one worktree per configured project, always on that project's `specs` branch. Kernel operations execute against `worktree(project)`; no operation may address a path outside the mounted worktree (existing `inspectAuthoringTarget` rules apply unchanged).

## Write path

### FR-4 — Serialized commits

All mutations for a project serialize through the existing transaction layer (journal, staging, rollback). One in-flight transaction per project.

### FR-5 — Optimistic concurrency

`spec_patch` accepts `expectedSha` per document and `repositoryRootFingerprint` per request (existing semantics). Mismatch → `CONFLICT`, `retryable: true`.

### FR-6 — Attributed commits

Every service commit carries bot authorship plus `Spec-Author:` (caller identity) and `Spec-Request-Id:` trailers.

### FR-7 — Claims

`spec_claim(project, slug)` grants the caller a lease (default TTL 30 min, renewable). `spec_release(project, slug)` drops it. Lease state lives in the service store, survives restart, and expires without manual action. In v1 a non-holder may write only with `force: true`; the event is logged.

## Read path

### FR-8 — Read ops over remote transport

All nine existing read operations are served over the remote transport with the same envelope; `project` selects the mount. Absent `project` → caller's configured default.

### FR-9 — Registry index

`GET /registry` returns the projected index: per project, per spec — slug, status, version, digest, owner, claim state, published pointer, updatedAt. The index is rebuilt from git on every commit; it is never authoritative for content.

### FR-10 — Drift report

`GET /drift` lists divergence between the `specs` branch and the service's projection (non-bot commits, unexpected mutations, projection rebuild failures).

## Publish and pins

### FR-11 — Publish on status transition

When a spec's authored `Status:` becomes `ACTIVE`, the service packs the spec directory, records a ledger entry (`slug, version, digest, commit`), and publishes the pack with attestation. Re-publishing an identical digest is a no-op; publishing different content under an existing version is rejected.

### FR-12 — Pin verification

`omp spec verify` (consumer side) resolves each `spec-refs.json` entry against the ledger: version must exist and digest must match. `omp spec outdated` reports pins behind `latest`.

## Entry points

### FR-13 — YouTrack app calls

The service exposes `POST /rpc` accepting the registry JSON-RPC envelope for the YouTrack app. Proposal-style calls return the existing proposal payload (previews + `proposalHash`); apply requires presenting that `proposalHash`.

### FR-14 — Retired local MCP for managed projects

The plugin `.mcp.json` for managed projects references the remote endpoint. The stdio server remains available only when `OMP_SPEC_KIT_ROOT` targets an unmanaged checkout.

## Deployment

### FR-15 — Compose stack

`docker compose up` starts: `spec-registryd` (service + mounted volume of worktrees + SQLite), optional `youtrack-sync` (existing projection), optional reverse proxy. Configuration is `config/projects.json` + env secrets.

### FR-16 — Boot recovery

On boot, the service replays `recoverInterruptedTransactions` semantics per project worktree, rebuilds graphs, reconciles ledger vs git log, and reports drift before accepting writes.
