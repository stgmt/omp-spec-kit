# Tasks

Status: DRAFT

## Phase 0 — Specs branch model

## TASK-1 — Create `specs` orphan branch layout + migration of existing `.specs/` content
- **Status:** todo
- **Done When:** `specs` branch exists in this repo containing only `.specs/`; `main` no longer carries `.specs/`; CI check rejects `.specs/**` on non-specs branches.
- **Requirements:** R-1, FR-1, FR-2

## TASK-2 — Ruleset/protection for `specs` branch (bot-only pushes) + break-glass logging
- **Status:** todo
- **Done When:** non-bot push to `specs` is rejected; admin push still possible and produces a detectable event.
- **Requirements:** R-2, FR-2

## Phase 1 — Service core

## TASK-3 — `src/service/` skeleton: project mount manager (clone/worktree per project on `specs` branch)
- **Status:** todo
- **Done When:** service boots with `projects.json`, resolves `project`→worktree, builds kernel graph per project.
- **Requirements:** R-4, FR-3, FR-16

## TASK-4 — HTTP transport: `POST /rpc` (envelope passthrough) + Streamable HTTP MCP endpoint
- **Status:** todo
- **Done When:** all 10 existing tools reachable over HTTP with identical envelopes; `project` field honored.
- **Requirements:** R-5, FR-8, FR-13

## TASK-5 — Write path wiring: auth token check → claim check → ProposalCompiler → commitDocuments → push as bot with trailers
- **Status:** todo
- **Done When:** a remote `spec_patch` lands as an attributed bot commit on `specs`; `CONFLICT` semantics unchanged.
- **Requirements:** R-2, R-3, FR-4, FR-5, FR-6

## TASK-6 — SQLite store: claims (TTL) + publish ledger + access log; boot reconcile vs git log
- **Status:** todo
- **Done When:** claims survive restart and expire; ledger entries append-only; `/drift` reports divergence.
- **Requirements:** R-3, FR-7, FR-10, FR-16

## Phase 2 — Entry points

## TASK-7 — Plugin `.mcp.json` remote mode + retire local stdio for managed projects
- **Status:** todo
- **Done When:** plugin connects to the stack endpoint; local server only for `OMP_SPEC_KIT_ROOT` unmanaged checkouts.
- **Requirements:** R-5, FR-14

## TASK-8 — YouTrack app integration: spec view + proposal apply via `/rpc`
- **Status:** todo
- **Done When:** human can read spec and apply a proposal from the YT app; user identity lands in `Spec-Author:`.
- **Requirements:** R-6, FR-13, R-7

## Phase 3 — Publish, pins, deploy

## TASK-9 — Publish pipeline: pack on ACTIVE transition → ledger → release asset + attestation
- **Status:** todo
- **Done When:** status flip to ACTIVE produces attested pack; version/digest rules enforced.
- **Requirements:** R-9, FR-11

## TASK-10 — Consumer commands: `omp spec verify` / `outdated` against `spec-refs.json`
- **Status:** todo
- **Done When:** pin digest mismatch fails closed; outdated lists pins behind latest.
- **Requirements:** R-9, FR-12

## TASK-11 — docker-compose: service + volumes + optional youtrack-sync + proxy; documented env
- **Status:** todo
- **Done When:** clean-host `docker compose up` passes AC-7.
- **Requirements:** R-8, FR-15

## Backlog — Auth seam realization

## TASK-12 — YouTrack Hub authN/Z (token introspection, reader/writer/owner roles)
- **Status:** todo
- **Done When:** per-user identity enforced; claim `force` requires owner role; v1 shared token retired.
- **Requirements:** R-7

## Backlog — recorded risks (documented, no work scheduled)

- **RISK-1 — SPOF on writes.** Service outage blocks all spec mutation; reads degrade to `git clone -b specs`. Mitigation exists (break-glass admin push + drift report, AC-10) but no HA planned.
- **RISK-2 — Spec↔code decoupling.** Specs and code never land in one PR anymore; linkage is `spec-refs.json` discipline. If teams stop pinning, "which spec does this code implement" rots — accepted, monitored by `spec outdated`.
- **RISK-3 — Cross-project spec references.** Deferred entirely; the kernel has no cross-mount edge model. If needed later, likely via ledger entries (`project/slug@version`), not live graph edges.
- **RISK-4 — Specs-branch → specs-repo migration.** If a consumer outside the owning repo's access boundary appears, the per-repo branch model may need to become a dedicated specs repo. Recorded as a possible Option-C step; no migration tooling planned.
- **RISK-5 — Claim is advisory in v1.** Non-holder writes are possible with `force:` (logged). Hard denial waits on full auth (TASK-12); until then claims signal intent, they don't enforce it.
- **RISK-6 — Ruleset availability.** Path-restriction rulesets depend on the GitHub plan; fallback is the required CI check (FR-2). If neither exists on a repo, exclusivity is unenforced there — recorded, not blocked.
- **RISK-7 — Shared service token.** v1 auth is one token + trusted network; any leak = full write access to every project's specs. Acceptable inside a private network; not acceptable for public exposure — gated by the auth seam task.
