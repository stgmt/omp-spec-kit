# File changes

Status: DRAFT

> **Actualized 2026-09-14** after TASK-3..6, TASK-11, TASK-12 landed (live E2E green).
> Entries marked ✅ exist on `feat/spec-registry-service`; unmarked ones are still planned.

## New

- ✅ `src/service/index.js` — service entrypoint: config load, mount manager, store, transports, sync; direct-run guard; env overrides (`SPEC_REGISTRY_*`).
- ✅ `src/service/mounts.js` — single specs-repo clone lifecycle; resolves `owner/project` → project root, creates `.specs` skeletons for new projects; boot recovery.
- ✅ `src/service/git.js` — serialized git CLI wrapper (clone/fetch/add/commit/push), bot identity from env.
- ✅ `src/service/auth.js` — verified identity: app-bridge + direct YouTrack token paths, groups resolved with the service token, role map, in-memory cache, fail-closed errors (TASK-12).
- ✅ `src/service/tenants.js` — tenant definitions (`hubGroups`, `projects`, `defaultProject`) and pure scope resolution.
- ✅ `src/service/claims.js` — lease store (TTL, renew, expire) over the persistent store; holders are verified logins.
- ✅ `src/service/writepath.js` — claim check → kernel apply → git commit/push as bot with `Spec-Author`/`Spec-Request-Id` trailers.
- ✅ `src/service/ledger.js` — `node:sqlite` store (claims/ledger/access_log; JSONL fallback). **No `tenants` table** — the service stores no tokens.
- ✅ `src/service/registry.js` — projected registry index (authored status/version, digest, git-derived owner/updatedAt, claim, published pointer).
- ✅ `src/service/drift.js` + `src/service/sync.js` — divergence report (non-bot commits, clone-ahead) and the coalescing fetch/reconcile loop.
- ✅ `src/service/http.js` — MCP over Streamable HTTP via the official `@modelcontextprotocol/sdk` (stateless) on express; bearer gate; `/registry`, `/drift`, `/health`.
- ✅ `src/service/dispatch.js` — shared tool dispatch: contracts, transport-field stripping, project resolution, role gates, role-filtered `tools/list`.
- ✅ `src/service/ops/claim.js`, `ops/registry.js` — `spec_claim`/`spec_release`/`spec_registry`/`spec_drift` handlers and contracts.
- ✅ **New dependencies**: `@modelcontextprotocol/sdk@1.30.0`, `express@5.2.1` (pinned). Everything else built-in (`node:sqlite`, `node:child_process` git CLI).
- ✅ `tools/spec-graph-app/spec-handler.js` + `settings.json` — the auth-path HTTP handler (ctx.currentUser → bridge, `connection.bearerAuth` for the secret) and its settings schema (TASK-12; full UI is TASK-8).
- ✅ `tools/spec-graph-app/widgets/spec-service-panel/` — minimal service-backed widget (spec list + apply) used by the live E2E.
- ✅ `tests/e2e/` — live compose suite (`spec-auth-e2e`): wizard automation, fixture bootstrap, 12 auth scenarios; `tests/e2e/lib/live-fixture.mjs` feeds the service suite.
- ✅ `deploy/Dockerfile`, `deploy/docker-compose.yml`, `deploy/git/Dockerfile`, `deploy/proxy/nginx.conf`, `config/projects.example.json` — compose stack (TASK-11), profiles `git`/`youtrack`/`proxy`.
- ✅ `config/projects.example.json` — projects + tenants + auth block example.
- `src/service/onboarding.js` — self-service onboarding API (TASK-8): mints YouTrack permanent tokens for agents via the YouTrack API.
- `src/service/publish.js` + `deploy/docker-compose.yml` youtrack-sync — publish pipeline (TASK-9) and sweep runner (TASK-8).
- (deferred to TASK-15) `spec-refs.json` pin file + `omp spec verify|outdated|install` consumer commands — out of v1.

## Changed

- `plugins/omp-spec-kit/.mcp.json` — remote endpoint mode for managed projects (TASK-7). Verified against the pinned OMP schema (`mcp-schema.json` @ 33cc6b9): `{ "type": "http", "url": "<stack>/mcp", "headers": { "Authorization": "Bearer <token>" } }` is a legal config.
- ✅ `src/adapters/tool-contracts.js` — exported shared argument normalization (`TOOL_ARGUMENT_ALIASES`, `normalizeToolArguments`) for the HTTP dispatcher; kernel contracts unchanged.
- ✅ `src/authoring/transactions.js` — `recoverInterruptedTransactions` exported (boot recovery, FR-16).
- ✅ `src/authoring/service.js` — `WRITE_ERROR_CODES` gains `CLAIM_HELD`/`UNAVAILABLE`/`VERSION_EXISTS`; `isRetryable` treats `UNAVAILABLE` as retryable.
- ✅ `src/kernel/types.js` + `index.js` — `KERNEL_SCHEMA_VERSION = spec-kernel@2`; `@1` callers accepted.
- **Not needed** (actualized): `src/kernel/query/*` plumbing — `project` is a transport-level field stripped by the dispatcher before the kernel; the kernel never sees it.
- ✅ `src/service/*` tests — `tests/service/` runs against the live fixture; `tests/unit/service/` covers pure logic.
- YouTrack app — full spec view + proposal apply surface (TASK-8; the auth path and a minimal panel shipped with TASK-12).
- Repo tooling repoint on migration (TASK-14): `scripts/specs-root.mjs` resolver salvaged from closed PR #39 (`OMP_SPEC_KIT_ROOT` → `.specs` → specs-repo clone).
- Repo settings (out-of-band): dedicated specs repo + bot account + push protection (TASK-1/2 done for the repo itself).

## Deleted

- ✅ None. Local stdio MCP remains for unmanaged checkouts.
- ✅ Removed inside the service: the seed-tenant token directory and the `tenants` table (tokens are YouTrack's, TASK-12).
