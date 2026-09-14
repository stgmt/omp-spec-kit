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
- **Status:** done
- **Done When:** service boots with `projects.json`, clones the specs repo, resolves `project`→`<clone>/<owner>/<project>` (creating the `.specs` skeleton for new projects), builds kernel graph per project root.
- **Requirements:** R-4, FR-3, FR-16
- **Evidence:** `src/service/mounts.js` + `src/service/index.js` (boot: clone → skeleton as bot → `recoverInterruptedTransactions` per root → graphs); git CLI wrapper serialized per clone (`src/service/git.js`); tests `tests/unit/service/mounts.test.mjs`, `tests/service/integration.test.mjs` (bare-remote boot, idempotent second boot, stale-artifact recovery). Commit c52ab25.

## TASK-4 — HTTP transport: Streamable HTTP MCP endpoint `POST /mcp` — the single access point for all clients (agents + YouTrack app)
- **Status:** done
- **Done When:** all 10 existing tools reachable over HTTP with identical envelopes; `project` field honored.
- **Requirements:** R-5, FR-8, FR-13
- **Evidence:** `src/service/http.js` — official `@modelcontextprotocol/sdk` `StreamableHTTPServerTransport` (stateless, JSON responses, GET/DELETE → 405) on express; shared dispatcher (`src/service/dispatch.js`) reuses stdio contracts + alias normalization; `project` resolves param → default scope → refuse, out-of-scope refused; `KERNEL_SCHEMA_VERSION` → `spec-kernel@2` with `@1` accepted. Parity tests stdio-kernel ↔ `/mcp` on identical fixtures (`tests/service/http.test.mjs`). Commit 8e62fe4.

## TASK-5 — Write path wiring: tenant token check → claim check → ProposalCompiler → commitDocuments → push as bot with trailers
- **Status:** done
- **Done When:** a remote `spec_patch` lands as an attributed bot commit on the specs repo; `CONFLICT` semantics unchanged; every request resolves `token → tenant → allowed projects` and rejects `project` values outside the caller's set.
- **Note:** the tenant-token layer was superseded by TASK-12 (verified identity, no service-issued tokens); the write pipeline itself is unchanged.
- **Requirements:** R-2, R-3, R-7, FR-4, FR-5, FR-6
- **Evidence:** `src/service/tenants.js` (sha256-hashed seed tenants), `src/service/claims.js` + `src/service/ops/claim.js` (`spec_claim`/`spec_release`, TTL, CLAIM_HELD with holder/expiry), `src/service/writepath.js` (claim check → kernel apply → git add/commit/push as bot with `Spec-Author:`/`Spec-Request-Id:` trailers; success only after push confirmation; push failure → retryable `GIT_PUSH_FAILED`, clone ahead). E2E on bare remote incl. CONFLICT retryable, force-over-claim, push failure (`tests/service/writepath.test.mjs`). Commit 22b6cb3.

## TASK-6 — Store + index + sync loop (`node:sqlite`): tenants, claims (TTL), publish ledger, access log, projected `/registry` index, periodic fetch/reconcile
- **Status:** done
- **Done When:** tenant records with token→allowed-projects survive restart (issue/revoke works); claims survive restart and expire; ledger entries append-only; `/registry` serves the projected index rebuilt on every commit; fetch-on-interval + reconcile runs per project; `/drift` reports divergence incl. worktree-ahead-of-remote.
- **Requirements:** R-3, R-7, FR-7, FR-9, FR-10, FR-16
- **Evidence:** `src/service/ledger.js` (`node:sqlite` store with documented JSONL fallback: tenants/claims/ledger/access_log), `src/service/registry.js` + `spec_registry` op + bearer-gated `GET /registry` (authored status/version, directory digest, claim, published pointer), `src/service/drift.js` + `spec_drift` op + `GET /drift` (non-bot commits, clone-ahead-of-remote, fetched fresh), coalescing sync loop with fast-forward (`src/service/sync.js`). Persistence/across-restart and drift tests (`tests/service/task6.test.mjs`). Commit 15488b5.

## Phase 2 — Entry points

## TASK-12 — YouTrack-backed authN/Z (verified identity, reader/writer/owner roles) — pulled ahead of TASK-8
- **Status:** done
- **Done When:** per-user identity enforced against the live YouTrack (app bridge re-verifies `GET /api/users/{login}`; direct tokens via `GET /api/users/me`); claim `force` requires owner role (non-owner hard-denied); asserted-`identity` trust model retired (header ignored, verified login in trailers/audit); no auth config → service refuses to start; YouTrack unreachable → fail-closed.
- **Requirements:** R-7, NFR-5, FR-7, FR-8
- **Evidence:** `src/service/auth.js` (two verified paths; groups resolved with the service token because Hub field visibility hides a non-admin's group list from `users/me`; 60 s cache; fail-closed 503; banned → 403). Roles gate operations and filter `tools/list` (`dispatch.js`); claims/`Spec-Author` trailers carry the verified login (`claims.js`, `writepath.js`); `X-Spec-Author`/envelope `identity` retired; `ledger.js` stores no tokens (no `tenants` table). YouTrack app auth path: `tools/spec-graph-app/spec-handler.js` (ctx.currentUser → bridge, `connection.bearerAuth` for the secret setting) + `widgets/spec-service-panel`. Verified live end-to-end in the dedicated test compose (`tests/e2e/`, real YouTrack with browser login, real git daemon, real service — 12/12 scenarios: scoping, 403 NO_SCOPES, role gates, CLAIM_HELD, owner-only force, token revocation, ban, audit, restart, bridge header). Gates: `test:unit` 101/101, `test:service` 17/17 (live), `test:e2e:auth` 12/12, `check:spec-corpus`, `dogfood:mcp` green.

## TASK-7 — Plugin `.mcp.json` remote mode + retire local stdio for managed projects
- **Status:** todo
- **Done When:** plugin connects to the stack endpoint; local server only for `OMP_SPEC_KIT_ROOT` unmanaged checkouts.
- **Requirements:** R-5, FR-14

## TASK-8 — YouTrack app integration: spec view + proposal apply via `/mcp` + self-service token issuance
- **Status:** todo
- **Done When:** human can read spec and apply a proposal from the YT app; user identity lands in `Spec-Author:` (verified YouTrack login — the auth path and minimal service panel land with TASK-12, the full interactive UI is this task); a "connect agent" action in the app calls the onboarding API, which **mints a YouTrack permanent token for the caller via the YouTrack API** (the service issues no tokens of its own) and returns a ready `.mcp.json` token snippet (no manual token issuing anywhere).
- **Requirements:** R-6, FR-13, R-7

## Phase 3 — Publish, deploy

## TASK-9 — Publish pipeline: pack on ACTIVE transition → ledger → release asset + attestation
- **Status:** todo
- **Done When:** status flip to ACTIVE produces attested pack; version/digest rules enforced.
- **Requirements:** R-9, FR-11

## TASK-11 — docker-compose: service + volumes + optional youtrack-sync + proxy; documented env
- **Status:** done
- **Done When:** clean-host `docker compose up` passes AC-7.
- **Requirements:** R-8, FR-15
- **Evidence:** `deploy/Dockerfile` (node:22-slim + git CLI, non-root, healthcheck on `/health`), `deploy/docker-compose.yml` (named volume for clone+SQLite, bind-mounted operator config, loopback-only direct port; optional profiles: `git` — in-stack bare repo + git daemon for a fully self-contained host, `youtrack` — clean-host YouTrack, `proxy` — nginx TLS termination with operator certs), `deploy/git/Dockerfile`, `deploy/proxy/nginx.conf`, `.dockerignore`, `config/projects.example.json`. AC-7 verified live on this host: fresh bare specs-repo + config + token → `docker compose up` → clones, creates `stgmt/alpha/.specs` skeleton as bot, healthy; read call over `POST /mcp` → HTTP 200; write loop → `APPLIED` + bot commit on the remote. Boot-to-healthy: 7.8 s (includes image build check). Self-contained `git` profile verified live too: skeleton pushed to the in-stack daemon, read call ok. youtrack-sync joins the stack with TASK-8 (the sweep has no standalone entrypoint yet — the compose key is intentionally absent, not stubbed). Landed with this commit.

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
- **RISK-5 — Identity is verified (TASK-12); residual: token theft.** Non-holder writes are refused without `force:`; `force` is owner-only (hard-denied otherwise). Identity behind a claim is the verified YouTrack login (re-checked against YouTrack; `X-Spec-Author` retired). Residual: a stolen user token acts as that user until revoked in YouTrack — scope is limited to that user's projects.
- **RISK-6 — Ruleset availability.** Actor/path-restriction rulesets depend on the GitHub plan. For the specs repo the v1 perimeter is simpler: private repo + no collaborators + a single operator-issued token = only the service pushes. Product-repo `.specs/` guard stays a CI check (FR-2) applied per migrated repo.
- **RISK-7 — YouTrack is the authentication SPOF.** Every credential is verified against YouTrack (app bridge or direct token); YouTrack unreachable → fail-closed `UNAVAILABLE` (the 60 s cache softens blips). The service issues and stores no tokens; revocation/ban in YouTrack takes effect within the cache TTL. TLS is required since the endpoint serves external YouTrack instances.
