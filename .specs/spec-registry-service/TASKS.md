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

## TASK-4 — HTTP transport: Streamable HTTP MCP endpoint `POST /mcp` — the single access point for all clients (agents + YouTrack app)
- **Status:** todo
- **Done When:** all 10 existing tools reachable over HTTP with identical envelopes; `project` field honored.
- **Requirements:** R-5, FR-8, FR-13

## TASK-5 — Write path wiring: tenant token check → claim check → ProposalCompiler → commitDocuments → push as bot with trailers
- **Status:** todo
- **Done When:** a remote `spec_patch` lands as an attributed bot commit on the specs repo; `CONFLICT` semantics unchanged; every request resolves `token → tenant → allowed projects` and rejects `project` values outside the caller's set.
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

## TASK-8 — YouTrack app integration: spec view + proposal apply via `/mcp` + self-service token issuance
- **Status:** todo
- **Done When:** human can read spec and apply a proposal from the YT app; user identity lands in `Spec-Author:`; a "connect agent" action in the app calls the onboarding API and returns a ready `.mcp.json` token snippet (no manual token issuing anywhere).
- **Requirements:** R-6, FR-13, R-7

## Phase 3 — Publish, deploy

## TASK-9 — Publish pipeline: pack on ACTIVE transition → ledger → release asset + attestation
- **Status:** todo
- **Done When:** status flip to ACTIVE produces attested pack; version/digest rules enforced.
- **Requirements:** R-9, FR-11

## TASK-11 — docker-compose: service + volumes + optional youtrack-sync + proxy; documented env
- **Status:** todo
- **Done When:** clean-host `docker compose up` passes AC-7.
- **Requirements:** R-8, FR-15

## Backlog — Auth seam realization

## TASK-12 — YouTrack Hub authN/Z (token introspection, reader/writer/owner roles)
- **Status:** todo
- **Done When:** per-user identity enforced (Hub token introspection); claim `force` requires owner role; asserted-`identity` trust model retired.
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

## TASK-15 — Consumer pin file + `omp spec verify`/`outdated`/`install` (LATER — only if external consumers appear)
- **Status:** deferred — dropped from v1: with the service as the only read path, a committed `spec-refs.json` pin has nothing to resolve against offline and duplicates ledger knowledge online; it returns as an export artifact when consumers exist outside the stack.
- **Done When:** pin file schema + verify/outdated/install commands land against the ledger.
- **Requirements:** R-9, FR-12

## Backlog — recorded risks (documented, no work scheduled)

- **RISK-1 — SPOF on reads and writes.** Consumers have no repo access by design, so service outage = total outage for them. Operator mitigations exist (`git clone -b specs` fallback, break-glass push + drift report, AC-10) but no HA planned.
- **RISK-2 — Spec↔code decoupling.** Specs and code never land in one PR anymore; linkage lives in the ledger + registry view (which spec a project touched, which version is published). There is no committed pin keeping the two in lockstep — drift between claimed and actual implementation is invisible until queried; accepted for v1, revisitable via TASK-15 if consumers need pins.
- **RISK-3 — Cross-project spec references.** Deferred entirely; the kernel has no cross-mount edge model. If needed later, likely via ledger entries (`project/slug@version`), not live graph edges.
- **RISK-4 — Specs repo is one blast radius.** All projects share one repo: a bad global state (history rewrite, repo corruption) hits every tenant. Mitigations: git integrity + journal, operator-side mirror/backup of the specs repo. Per-user branches were considered and rejected (index aggregation).
- **RISK-5 — Claim enforcement is real but identity is weak in v1.** Non-holder writes are refused without `force:` — mechanically enforced. What's weak is *who is behind a claim*: the token proves tenant, `Spec-Author` is asserted/spoofable until TASK-12 (YouTrack Hub authN/Z).
- **RISK-6 — Ruleset availability.** Actor/path-restriction rulesets depend on the GitHub plan. For the specs repo the v1 perimeter is simpler: private repo + no collaborators + a single operator-issued token = only the service pushes. Product-repo `.specs/` guard stays a CI check (FR-2) applied per migrated repo.
- **RISK-7 — Token-only perimeter.** v1 auth is per-tenant bearer tokens; a leak compromises that tenant's allowed projects only, but identity assertions (`Spec-Author`) are spoofable and claims stay advisory until TASK-12 (YouTrack Hub authN/Z). TLS is required since the endpoint serves external YouTrack instances.
