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
- ✅ `config/omp-managed.mcp.json.example` — managed-mode template: a native `omp-spec-kit` http definition with the token through `${OMP_SPEC_REGISTRY_TOKEN}` (TASK-7).
- ✅ `scripts/probe-managed-remote.mjs` — TASK-7 live probe: asserts that OMP resolves the native http definition for `omp-spec-kit` and proves the endpoint is reached (the registry access log records the call).
- (planned, TASK-16) `scripts/build-youtrack-app.mjs` — reproducible packaging of `tools/spec-graph-app/` into the installable ZIP, with a check that the committed `spec-graph-app.zip` matches the sources.
- (planned, TASK-16) release flow — attach the app ZIP as an artifact so the operator path is "one link + ZIP upload" until the Marketplace listing exists.
- `src/service/onboarding.js` — self-service onboarding API (TASK-8): mints YouTrack permanent tokens for agents via the YouTrack API.
- `src/service/publish.js` + `deploy/docker-compose.yml` youtrack-sync — publish pipeline (TASK-9) and sweep runner (TASK-8).
- (deferred to TASK-15) `spec-refs.json` pin file + `omp spec verify|outdated|install` consumer commands — out of v1.
- ✅ `scripts/app-package.mjs` — manifest-derived package set + deterministic zip build (TASK-16).
- ✅ `scripts/build-youtrack-app.mjs` — the one build entrypoint (`dist/spec-graph-app/` + `dist/spec-graph-app-<version>.zip`).
- ✅ `tests/app-package.test.mjs`, `tests/features/app-install.feature`, `tests/step-definitions/app-install.steps.mjs` — TDD + BDD coverage for the package contract and the JetBrains launch checklist.
- ✅ `tools/spec-graph-app/README.md` — operator install doc: UI ZIP path, one-command CLI path, required permissions.
- ✅ `tests/e2e/lib/browser.mjs` — shared headless-Chrome helpers (`browserLogin` with password rotation, `widgetFrame`) extracted from `run-live.mjs` (TASK-16 follow-up).
- ✅ `tests/e2e/lib/app-admin-ui.mjs` — UI-path helpers verified live on 2025.3.161254: `Add app… → Upload ZIP file…` native filechooser, app-card tabs, dirty-state Save, Manage-projects dialog.
- ✅ `tests/features/app-install-live.feature` + `tests/step-definitions/app-install-live.steps.mjs` — the UI-driven operator-path BDD (`test:app-install-live`, 16/16).

## Changed

- `plugins/omp-spec-kit/.mcp.json` — remote endpoint mode for managed projects (TASK-7). Verified against the pinned OMP schema (`mcp-schema.json` @ 33cc6b9): `{ "type": "http", "url": "<stack>/mcp", "headers": { "Authorization": "Bearer <token>" } }` is a legal config.
- ✅ `src/adapters/tool-contracts.js` — exported shared argument normalization (`TOOL_ARGUMENT_ALIASES`, `normalizeToolArguments`) for the HTTP dispatcher; kernel contracts unchanged.
- ✅ `src/authoring/transactions.js` — `recoverInterruptedTransactions` exported (boot recovery, FR-16).
- ✅ `src/authoring/service.js` — `WRITE_ERROR_CODES` gains `CLAIM_HELD`/`UNAVAILABLE`/`VERSION_EXISTS`; `isRetryable` treats `UNAVAILABLE` as retryable.
- ✅ `src/kernel/types.js` + `index.js` — `KERNEL_SCHEMA_VERSION = spec-kernel@2`; `@1` callers accepted.
- **Not needed** (actualized): `src/kernel/query/*` plumbing — `project` is a transport-level field stripped by the dispatcher before the kernel; the kernel never sees it.
- ✅ `src/service/*` tests — `tests/service/` runs against the live fixture; `tests/unit/service/` covers pure logic.
- YouTrack app — full spec view + proposal apply surface (TASK-8; the auth path and a minimal panel shipped with TASK-12).
- ✅ Repo tooling after the TASK-14 migration: code gates resolve the corpus through `scripts/corpus-root.mjs` (frozen fixture by default, `OMP_SPEC_KIT_ROOT` override) instead of a checkout; the live corpus is checked through the registry (`scripts/check-corpus-via-mcp.mjs`); `scripts/check-no-root-specs.mjs` enforces the FR-2 boundary in `verify`. The PR #39 resolver is superseded — no consumer clones the specs repository.
- ✅ `src/service/git.js` — server-side credential for the private specs repo: `SPEC_REGISTRY_GIT_TOKEN` becomes a URL-scoped `http.extraheader` in the git child environment, never in argv or config files, and redacted from error output.
- ✅ `deploy/Dockerfile` — `ca-certificates` added: HTTPS clones of the specs repo failed certificate verification without it.
- ✅ `src/authoring/secrets.js` — documented header placeholders (`Bearer <credential>`, `${TOKEN}`, `{{token}}`) are no longer misreported as secret-like content; real credentials are still refused.
- Repo settings (out-of-band): dedicated specs repo + bot account + push protection (TASK-1/2 done for the repo itself).
- ✅ `package.json` — `build` now also builds the app package; `verify` runs `check:youtrack-app` (official `app validate`); `test:app-install` added; dev deps `yazl`/`yauzl`.
- ✅ `.github/workflows/verify.yml` — uploads the built app package as a workflow artifact.
- ✅ `.github/workflows/release.yml` — attaches the app zip to the GitHub Release, verifies it on re-run, and attests it.
- ✅ `scripts/create-release-candidate.mjs` + `release-candidate-utils.mjs` — candidate schema @2 with `youtrackApp {file, sha256, bytes, version}`; the zip is built inside the candidate step from the tagged checkout.
- ✅ `scripts/verify-release.mjs` — preflight verifies the app zip digest beside the candidate.
- ✅ `scripts/render-release-notes.mjs` — release notes carry the app zip name + digest and the upload path.
- ✅ `tests/e2e/lib/bootstrap.mjs` — `deployApp` builds the same package and uploads it through the official CLI with the service token, then asserts the installed version equals the manifest version.
- ✅ `tests/e2e/lib/youtrack.mjs` — `appByName` resolves the installed app (paginated list, `$top=500`); `uninstallApp` deletes by id for the UI-suite precondition.
- ✅ `tests/e2e/run-live.mjs` — browser helpers moved to `lib/browser.mjs`; `--bootstrap-only` stops after stack bring-up, `--skip-app` leaves the app uninstalled for the UI suite.
- ✅ `tests/e2e/lib/bootstrap.mjs` — `bootstrapFixture({deployApp})` skips deploy/settings/attach when the UI suite drives the operator path itself.
- ✅ `package.json` — `test:app-install-live` added (outside the `test` aggregate; needs the live stack).
- ✅ `CONTRIBUTING.md` — live-stack prerequisite for `test:e2e:auth` / `test:app-install-live`.

## Deleted

- ✅ None. Local stdio MCP remains for unmanaged checkouts.
- ✅ Removed inside the service: the seed-tenant token directory and the `tenants` table (tokens are YouTrack's, TASK-12).
- ✅ `tools/spec-graph-app/spec-graph-app.zip` — the hand-made committed artifact; the package is now CI-built.
- ✅ `scripts/youtrack-app-deploy.mjs` — PowerShell `Compress-Archive` + hand-written file list + custom HTTP upload; superseded by the build step + official CLI.

## spec-registry-service — 2026-09-16

| Path | Change |
|---|---|
| `scripts/check-specs-repo-protection.mjs` | NEW — GitHub posture gate: private repo + collaborators ⊆ {owner, service, allowed}; rulesets report-only |
| `docs/specs-repo-operations.md` | NEW — operator runbook: threat model, break-glass procedure, concurrency notes |
| `tests/service/writepath.test.mjs` | CHANGED — concurrent-write test: N parallel spec_patch serialize; losers retryable CONFLICT; retries land; linear bot-only history |
| `package.json` | CHANGED — `check:specs-repo` script |

## spec-registry-service — 2026-09-16 (TASK-9)

| Path | Change |
|---|---|
| `src/service/publish.js` | NEW — publish pipeline: ACTIVE → annotated tag `spec/<project>/<slug>/<version>` + insert-only ledger; VERSION_EXISTS reject; per-spec mutex; idempotent remote-tag handling |
| `src/service/versioned.js` | NEW — FR-12 versioned reads: ledger → `git show <commit>:<path>` + digest re-verify |
| `src/service/git.js` | CHANGED — `show`, `objectId` (tree digest), annotated `tag`, `lsRemote` |
| `src/service/ledger.js` | CHANGED — `insertLedgerIfAbsent` (publish rows immutable) + `listAccess` |
| `src/service/writepath.js` | CHANGED — post-push publish hook |
| `src/service/sync.js` | CHANGED — `afterReconcile` publish hook |
| `src/service/index.js` | CHANGED — publisher wiring, boot publish pass, publish-rejected events in /drift, documents wrapper |
| `src/service/registry.js` | CHANGED — `authoredField` exported |
| `src/adapters/tool-contracts.js` | CHANGED — `version` optional field on spec_documents read |
| `tests/service/publish.test.mjs` | NEW — 7 scenarios: publish/noop/bump/reject+drift/versioned/concurrent/out-of-band |

## spec-registry-service — 2026-09-16 (TASK-9)

| Path | Change |
|---|---|
| `src/service/publish.js` | NEW — publish pipeline: ACTIVE → annotated tag `spec/<project>/<slug>/<version>` + insert-only ledger; VERSION_EXISTS reject; per-spec mutex; idempotent remote-tag handling (peeled sha, adopt/reject, heal, crashed-push recovery) |
| `src/service/versioned.js` | NEW — FR-12 versioned reads: ledger → `git show <commit>:<path>` + digest re-verify + path containment + blob-only |
| `src/service/git.js` | CHANGED — `show`, `objectId`, `objectType`, annotated `tag`, `lsRemote` |
| `src/service/ledger.js` | CHANGED — `insertLedgerIfAbsent` (publish rows immutable) |
| `src/service/writepath.js` | CHANGED — post-push publish hook |
| `src/service/sync.js` | CHANGED — `afterReconcile` publish hook |
| `src/service/index.js` | CHANGED — publisher wiring, boot publish pass, publish-rejected events in /drift, documents wrapper |
| `src/service/registry.js` | CHANGED — `authoredField` exported |
| `src/adapters/tool-contracts.js` | CHANGED — `version` optional field on spec_documents read |
| `tests/service/publish.test.mjs` | NEW — 13 scenarios |
