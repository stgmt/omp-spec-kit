# Functional requirements

Status: DRAFT

## Repo and storage

### FR-1 — Spec branches

A spec is an orphan branch `spec-<slug>` in its project repository. `.spec-kit.json` at the branch root binds it to `project`, `spec`, `repo`, and `branch`; the corpus lives under `.specs/<slug>/`. Detection is by metadata, not branch name alone: one repository may host specs of several projects. A work branch `spec-<slug>--<topic>` is unmerged work — it is not indexed, published, or projected. There is no shared default repository: an unbound project refuses spec operations with `REPO_BINDING_REQUIRED`, and a branch/metadata mismatch fails with `SPEC_BINDING_INVALID`.

### FR-2 — Write-path exclusivity

Only the service bot can push to canonical spec branches — enforced by repository rulesets on `spec-*` refs and per-repository credentials (actor rulesets are plan-dependent hardening, TASK-2). Separately, a managed product repo rejects any push/PR carrying **repo-root** `.specs/**` on its code branches — the rule anchors at the repository root and must not match nested fixture paths such as `tests/fixtures/**/.specs/`; this guard is applied per-repo when that project migrates. Break-glass pushes by repo admins are detected on the next service sync and recorded as drift events.

### FR-3 — Per-spec roots

The service keeps one bare mirror per bound repository and one lazy worktree per canonical spec branch. The kernel reads a materialised project corpus assembled from the `.specs/<slug>/` trees of that project's canonical branches; writes are applied to that corpus and copied back into the target spec worktree. No operation may address a path outside the resolved spec root (existing `inspectAuthoringTarget` rules apply unchanged).

## Write path

### FR-4 — Serialized commits

All mutations for a project serialize through the existing transaction layer (journal, staging, rollback). One in-flight transaction per project.

### FR-5 — Optimistic concurrency and publish confirmation

`spec_patch` accepts `expectedSha` per document and `repositoryRootFingerprint` per request (existing semantics). Mismatch → `CONFLICT`, `retryable: true`. A write reports success only after the git push to the specs repo is confirmed; push failure returns an error and leaves the clone ahead of remote (reconciled on retry/boot — never silently dropped).

### FR-6 — Attributed commits

Every service commit carries bot authorship plus `Spec-Author:` (caller identity) and `Spec-Request-Id:` trailers.

### FR-7 — Claims

`spec_claim(project, slug)` grants the caller a lease (default TTL 30 min, renewable). `spec_release(project, slug)` drops it. Lease state lives in the service store, survives restart, and expires without manual action. **Caller identity is the verified YouTrack login** (see FR-8): claims name a real user, the commit trailer and access log carry that login, and `X-Spec-Author`/envelope `identity` are retired — any such value is ignored and logged as a warning. A non-holder may write only with `force: true`, and `force` is an **owner-role** operation: a non-owner `force` is hard-denied (`INVALID_REQUEST`, "force requires owner role"); an owner `force` proceeds and is logged (holder, project, spec, login).

## Read path

### FR-8 — Read ops over remote transport + caller context

All nine existing read operations are served over the remote transport with the same envelope. Caller context is verified, not asserted: a request authenticates either as the app bridge (YouTrack app backend secret + asserted user, re-verified against `GET /api/users/{login}`) or with a user's YouTrack permanent token (`GET /api/users/me`) — both resolve `token → user → groups → tenant → allowed scopes`. `spec`/slug is always an explicit parameter on targeted ops — no spec is ever inferred. `project` is a call parameter (`owner/project`); absent → the caller's default scope, which exists only when exactly one tenant matched the user's groups — otherwise the call is refused and `project` must be explicit. Multiple tenant matches union their scopes. A `project` outside the union is refused outright. A user matching no tenant group is refused (`no scopes matched`); a user with no role group is refused (`no role group`). The caller's role (owner > writer > reader, from configured role groups) gates operations and filters `tools/list`: readers see only read tools, writers add `spec_patch`/`spec_claim`/`spec_release`, owners additionally may `force`.

### FR-9 — Registry index

`GET /registry` returns the projected index: per project, per spec — slug, status, version, digest, owner, claim state, published pointer, updatedAt. The index is rebuilt from git on every commit; it is never authoritative for content.

### FR-10 — Drift report and sync cadence

The service keeps every bound mirror reconciled with its remote, but pays for that work only when the remote moved. Each cycle first asks the cheap ref probe — one `GET /repos/{owner}/{repo}/git/matching-refs/heads/spec-` on a keep-alive connection, compared with the mirror's `refs/remotes/origin/spec-*` tips. Equal tips mean no fetch, no `.spec-kit.json` read and no drift walk. An unavailable probe (not GitHub, no credential, API error) is never treated as "unchanged": the cycle then takes the ordinary path.

The interval is operator-configured (`SPEC_REGISTRY_SYNC_MS`, default 5 minutes; `0` disables the timer). A repository push webhook (`POST /webhook/github`, HMAC-SHA256 over the raw body, `SPEC_REGISTRY_WEBHOOK_SECRET`) marks the matching projects stale and reconciles immediately — the low-latency trigger this requirement allows. Reads fetch lazily: a mirror younger than `SPEC_REGISTRY_FETCH_TTL_MS` (default 15 s) serves reads without touching the network; writes and the sync cycle always fetch.

Reconcile fast-forwards a clone when only its remote moved and replays local commits over the remote when both sides moved. Work branches are not reconciled as canonical. `GET /drift` lists divergence per branch: non-bot commits, unexpected mutations, and projection rebuild failures.

## Publish

### FR-11 — Publish on status transition

When a spec's authored `Status:` becomes `ACTIVE`, the service publishes an immutable annotated git tag `spec/<project>/<slug>/<version>` at the publishing commit and records a ledger entry (`slug, version, tree digest, commit`). The tree hash of the spec directory at that commit is the digest — git's own content-addressed integrity proof; the annotated tagger identity is the attestation. Re-publishing an identical digest is a no-op; publishing different content under an existing version is rejected. (Pack archives for external consumers without repository access are deferred with the pin file — `git archive <tag>` produces them on demand.)

### FR-12 — Versioned reads

Read ops accept an optional `version`; when present, the ledger resolves `version → digest → commit` and immutable published content is returned, verifiable against its digest. Absent `version` → the current worktree state (unchanged existing semantics — a caller preparing a patch must see HEAD, not a published snapshot).

## Entry points

### FR-13 — YouTrack app calls

The YouTrack app is an MCP client: widget → `host.fetchApp()` → app HTTP handler → `http.Connection.postSync` → `POST /mcp` (`tools/call`) with the same envelope as agents — there is no separate REST/RPC surface, and the service runs stateless so no session handshake is required. Proposal-style calls return the existing proposal payload (previews + `proposalHash`); the apply step re-verifies graph fingerprint and document preimages under the write lock exactly as the current `spec_patch` apply path does (`service.js` — proposal→apply drift check), so a stale proposal is refused rather than applied. Note: the YouTrack projection/sweep infrastructure exists; the interactive spec view + proposal UI inside the app is **new work** delivered by this feature (TASK-8), not pre-existing capability.

### FR-14 — Retired local MCP for managed projects
Managed projects reach the registry through an **OMP-native MCP definition** named `omp-spec-kit` — in the project's `.omp/mcp.json` (committed, so every checkout is managed) or the active profile's user config — carrying `type: "http"`, the endpoint URL, and the caller's token through environment indirection. OMP resolves native config ahead of the plugin's own declaration (extension packages) and the first definition wins, so the local server is retired for the project without touching the shipped payload. The plugin's `.mcp.json` keeps the stdio server for **unmanaged** checkouts (an explicit `OMP_SPEC_KIT_ROOT` outside the stack, offline work). `config/omp-managed.mcp.json.example` is the template, and `scripts/probe-managed-remote.mjs` asserts the resolution and proves the call reaches the endpoint.

## Deployment

### FR-15 — Compose stack

`docker compose up` starts: `spec-registryd` (service + mounted volume holding the specs-repo clone + SQLite), optional `youtrack-sync` (existing projection), reverse proxy (TLS required — the endpoint is reachable beyond localhost). Configuration is `config/projects.json` + env secrets.

### FR-16 — Boot recovery

On boot, the service replays `recoverInterruptedTransactions` semantics per project root, rebuilds graphs, reconciles ledger vs git log, and reports drift before accepting writes.

### FR-17 — App distribution and installation

The YouTrack app is a distributable package built reproducibly from `tools/spec-graph-app/` and versioned with the repository, shipped as a release artifact (ZIP) whose contents are checked against the sources. Installation uses the paths JetBrains documents:

- **JetBrains Marketplace** (the convenient default once published): Administration → Apps → Add app… → Browse JetBrains Marketplace. The marketplace app page takes the YouTrack base URL and opens the install dialog on the site, and the app stays linked to the Marketplace, so updates are installed from YouTrack. Requires internet access to the Marketplace and the **Low-level Admin Write** permission.
- **ZIP upload** (private/self-hosted path, and the only path until the app is listed): Add app… → Upload ZIP file with the release artifact; requires the global **Update Project** permission or Low-level Admin Write.

The operator-facing documentation presents installation as a short, link-first flow (the app page plus the site URL), not as a build exercise. Publishing to the Marketplace is an operator/vendor action outside the service; until it is done the ZIP artifact is the supported path. Installation is verified, not assumed: the app appears on the Apps page with its settings applied, and a read call from its widget answers — the same check the live E2E performs after deploy.

## Branch model

## FR-18 — Spec branch discovery and metadata

The branch list is the index: every `spec-<slug>` branch is a candidate, and `.spec-kit.json` at its root is the binding record. Discovery validates `schema`, `project`, `spec`, `repo`, and `branch` against the ref and repository, rejects duplicate slugs in one repository, and surfaces every invalid branch as `SPEC_BINDING_INVALID` — a spec is never silently dropped. Work branches (`spec-<slug>--<topic>`) are not canonical and never appear in the catalog.

## FR-19 — Work branch lifecycle

`spec_branch create` makes an orphan canonical branch with metadata and a minimal spec skeleton, or forks `spec-<slug>--<topic>` from an existing canonical branch. `merge` accepts only changes to `.spec-kit.json` and `.specs/<slug>/**`, serializes on the project write lock, pushes the canonical branch, and deletes the work branch; conflicts return `MERGE_CONFLICT` without auto-resolution. `delete` refuses canonical branches with `BRANCH_PROTECTED`. Both actions are audited with the verified caller login.
