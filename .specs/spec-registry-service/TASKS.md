# Tasks

Status: DRAFT

## Phase 0 — Specs repo provisioning

## TASK-1 — Create the dedicated specs repo + seed the layout
- **Status:** done
- **Done When:** the operator-owned specs repo exists with a root `.gitignore` (`**/.omp-spec-kit-*`); service bot push protection is configured (or staged for TASK-2); repo accepts `<owner>/<project>/.specs/<slug>/` layout.
- **Requirements:** R-1, FR-1
- **Evidence:** `stgmt/spec-database` (private) created 2026-09-13; `main` seeded with root `.gitignore` (`**/.omp-spec-kit-*`) + README documenting the `owner/project/.specs` layout and service-only-write rule. Bot push protection staged for TASK-2.

## TASK-2 — Push protection on the specs repo + break-glass logging
- **Status:** todo
- **Done When:** non-service push path is closed: v1 enforcement = private repo with no collaborators + pushes only via the operator-issued service token (GitHub actor-restriction rulesets are a plan-dependent hardening — apply if available). Break-glass = operator's own token; detected via drift reporting (non-bot commit author).
- **Requirements:** R-2, FR-2

## Phase 1 — Service core

## TASK-3 — `src/service/` skeleton: project mount manager (one specs-repo clone; per-project roots)
- **Status:** todo
- **Done When:** service boots with `projects.json`, clones the specs repo, resolves `project`→`<clone>/<owner>/<project>` (creating the `.specs` skeleton for new projects), builds kernel graph per project root.
- **Requirements:** R-4, FR-3, FR-16

## TASK-4 — HTTP transport: `POST /rpc` (envelope passthrough) + Streamable HTTP MCP endpoint
- **Status:** todo
- **Done When:** all 10 existing tools reachable over HTTP with identical envelopes; `project` field honored.
- **Requirements:** R-5, FR-8, FR-13

## TASK-5 — Write path wiring: tenant token check → claim check → ProposalCompiler → commitDocuments → push as bot with trailers
- **Status:** todo
- **Done When:** a remote `spec_patch` lands as an attributed bot commit on `specs`; `CONFLICT` semantics unchanged; every request resolves `token → tenant → allowed projects` and rejects `project` values outside the caller's set.
- **Requirements:** R-2, R-3, R-7, FR-4, FR-5, FR-6

## TASK-6 — Store + index + sync loop (`node:sqlite`): tenants, claims (TTL), publish ledger, access log, projected `/registry` index, periodic fetch/reconcile
- **Status:** todo
- **Done When:** tenant records with token→allowed-projects survive restart (issue/revoke works); claims survive restart and expire; ledger entries append-only; `/registry` serves the projected index rebuilt on every commit; fetch-on-interval + reconcile runs per project; `/drift` reports divergence incl. worktree-ahead-of-remote.
- **Requirements:** R-3, R-7, FR-7, FR-9, FR-10, FR-16

## Phase 2 — Entry points

## TASK-7 — Plugin `.mcp.json` remote mode + retire local stdio for managed projects
- **Status:** todo
- **Done When:** plugin connects to the stack endpoint; local server only for `OMP_SPEC_KIT_ROOT` unmanaged checkouts.
- **Requirements:** R-5, FR-14

## TASK-8 — YouTrack app integration: spec view + proposal apply via `/rpc` + self-service token issuance
- **Status:** todo
- **Done When:** human can read spec and apply a proposal from the YT app; user identity lands in `Spec-Author:`; a "connect agent" action in the app calls the onboarding API and returns a ready `.mcp.json` token snippet (no manual token issuing anywhere).
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

## TASK-13 — External YouTrack binding (post-v1): guided onboarding flow
- **Status:** todo
- **Done When:** a user logged into the operator's YouTrack can bind their own YouTrack server through an in-app guide; the onboarding API auto-provisions tenant + token and emits the extension install bundle/guide; the bound instance's app traffic authenticates under that tenant.
- **Requirements:** R-6, R-7

## Backlog — deferred migrations

## TASK-14 — Import omp-spec-kit's `.specs/` corpus into the specs repo (post-first-release)
- **Status:** todo — deferred until the service runs; this repo's `.specs/` stays on code branches until then.
- **Done When:** corpus imported under `stgmt/omp-spec-kit/.specs/` with full history (source: the frozen `specs` branch on omp-spec-kit — already a filter-branch extraction of `.specs/**`); this repo's code branches stop carrying `.specs/`; its boundary CI check is enabled; repo tooling (corpus checks, dogfood, kernel scripts) resolves the corpus from a specs-repo clone (resolver salvaged from closed PR #39: `scripts/specs-root.mjs`).
- **Requirements:** R-1, FR-2

## Backlog — recorded risks (documented, no work scheduled)

- **RISK-1 — SPOF on reads and writes.** Consumers have no repo access by design, so service outage = total outage for them. Operator mitigations exist (`git clone -b specs` fallback, break-glass push + drift report, AC-10) but no HA planned.
- **RISK-2 — Spec↔code decoupling.** Specs and code never land in one PR anymore; linkage is `spec-refs.json` discipline. If teams stop pinning, "which spec does this code implement" rots — accepted, monitored by `spec outdated`.
- **RISK-3 — Cross-project spec references.** Deferred entirely; the kernel has no cross-mount edge model. If needed later, likely via ledger entries (`project/slug@version`), not live graph edges.
- **RISK-4 — Specs repo is one blast radius.** All projects share one repo: a bad global state (history rewrite, repo corruption) hits every tenant. Mitigations: git integrity + journal, operator-side mirror/backup of the specs repo. Per-user branches were considered and rejected (index aggregation).
- **RISK-5 — Claim is advisory in v1.** Non-holder writes are possible with `force:` (logged). Hard denial waits on full auth (TASK-12); until then claims signal intent, they don't enforce it.
- **RISK-6 — Ruleset availability.** Actor/path-restriction rulesets depend on the GitHub plan. For the specs repo the v1 perimeter is simpler: private repo + no collaborators + a single operator-issued token = only the service pushes. Product-repo `.specs/` guard stays a CI check (FR-2) applied per migrated repo.
- **RISK-7 — Token-only perimeter.** v1 auth is per-tenant bearer tokens; a leak compromises that tenant's allowed projects only, but identity assertions (`Spec-Author`) are spoofable and claims stay advisory until TASK-12 (YouTrack Hub authN/Z). TLS is required since the endpoint serves external YouTrack instances.
