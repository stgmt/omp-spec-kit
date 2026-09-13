# Functional requirements

Status: DRAFT

## Repo and storage

### FR-1 — Specs repo provisioning

The canonical store is one dedicated specs repository with layout `<owner>/<project>/.specs/<slug>/`. When the service first mounts a configured project whose `<owner>/<project>/.specs/` does not yet exist, it creates the skeleton and pushes it as the bot.

### FR-2 — Write-path exclusivity

Only the service bot can push to the specs repository — in v1 this is enforced by the repo being private, collaborator-free, and written only via the operator-issued service token (actor rulesets are plan-dependent hardening, TASK-2). Separately, a managed product repo rejects any push/PR carrying **repo-root** `.specs/**` on its code branches — the rule anchors at the repository root and must not match nested fixture paths such as `tests/fixtures/**/.specs/`; this guard is applied per-repo when that project migrates. Break-glass pushes by repo admins are detected on the next service sync and recorded as drift events.

### FR-3 — Per-project roots

The service maintains one clone of the specs repo; kernel operations execute against `root = <clone>/<owner>/<project>` (the dir containing `.specs/`). No operation may address a path outside the resolved project root (existing `inspectAuthoringTarget` rules apply unchanged).

## Write path

### FR-4 — Serialized commits

All mutations for a project serialize through the existing transaction layer (journal, staging, rollback). One in-flight transaction per project.

### FR-5 — Optimistic concurrency and publish confirmation

`spec_patch` accepts `expectedSha` per document and `repositoryRootFingerprint` per request (existing semantics). Mismatch → `CONFLICT`, `retryable: true`. A write reports success only after the git push to the specs repo is confirmed; push failure returns an error and leaves the clone ahead of remote (reconciled on retry/boot — never silently dropped).

### FR-6 — Attributed commits

Every service commit carries bot authorship plus `Spec-Author:` (caller identity) and `Spec-Request-Id:` trailers.

### FR-7 — Claims

`spec_claim(project, slug)` grants the caller a lease (default TTL 30 min, renewable). `spec_release(project, slug)` drops it. Lease state lives in the service store, survives restart, and expires without manual action. In v1 a non-holder may write only with `force: true`; the event is logged. **Caller identity in v1** is an asserted field (`identity` in the envelope / `X-Spec-Author` header): the tenant token authenticates *which tenant*, not *which user* — the asserted identity is spoofable but always recorded in the commit trailer and access log. Claims and attribution work mechanically; enforcement of *who may claim which identity* waits for the auth seam (R-7).

## Read path

### FR-8 — Read ops over remote transport + caller context

All nine existing read operations are served over the remote transport with the same envelope. Caller context is token-derived: `token → tenant → allowed scopes`. `project` is a call parameter (`owner/project`); absent → the token's default scope — refused when the token has none or several without a default. `spec`/slug is always an explicit parameter on targeted ops — no spec is ever inferred. A `project` outside the token's allowed set is refused outright.

### FR-9 — Registry index

`GET /registry` returns the projected index: per project, per spec — slug, status, version, digest, owner, claim state, published pointer, updatedAt. The index is rebuilt from git on every commit; it is never authoritative for content.

### FR-10 — Drift report and sync cadence

The service fetches the specs repo on a configured interval (default: every poll cycle; optionally triggered sooner by a repo webhook) and reconciles clone ↔ remote ↔ projection per project. `GET /drift` lists divergence: non-bot commits, unexpected mutations, projection rebuild failures, clone-ahead-of-remote states.

## Publish

### FR-11 — Publish on status transition

When a spec's authored `Status:` becomes `ACTIVE`, the service packs the spec directory, records a ledger entry (`slug, version, digest, commit`), and publishes the pack with attestation. Re-publishing an identical digest is a no-op; publishing different content under an existing version is rejected.

### FR-12 — Versioned reads

Read ops accept an optional `version`; when present, the ledger resolves `version → digest → commit` and immutable published content is returned, verifiable against its digest. Absent `version` → the current worktree state (unchanged existing semantics — a caller preparing a patch must see HEAD, not a published snapshot).

## Entry points

### FR-13 — YouTrack app calls

The service exposes `POST /rpc` accepting the registry JSON-RPC envelope for the YouTrack app. Proposal-style calls return the existing proposal payload (previews + `proposalHash`); the apply step re-verifies graph fingerprint and document preimages under the write lock exactly as the current `spec_patch` apply path does (`service.js` — proposal→apply drift check), so a stale proposal is refused rather than applied. Note: the YouTrack projection/sweep infrastructure exists; the interactive spec view + proposal UI inside the app is **new work** delivered by this feature (TASK-8), not pre-existing capability.

### FR-14 — Retired local MCP for managed projects

The plugin `.mcp.json` for managed projects references the remote endpoint. The stdio server remains available only when `OMP_SPEC_KIT_ROOT` targets an unmanaged checkout.

## Deployment

### FR-15 — Compose stack

`docker compose up` starts: `spec-registryd` (service + mounted volume holding the specs-repo clone + SQLite), optional `youtrack-sync` (existing projection), reverse proxy (TLS required — the endpoint is reachable beyond localhost). Configuration is `config/projects.json` + env secrets.

### FR-16 — Boot recovery

On boot, the service replays `recoverInterruptedTransactions` semantics per project root, rebuilds graphs, reconciles ledger vs git log, and reports drift before accepting writes.
