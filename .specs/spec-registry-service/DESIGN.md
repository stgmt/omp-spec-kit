# Design

Status: DRAFT

## Architecture

```
 humans ──YouTrack app──┐  (the app lives inside YouTrack, outside the stack;
 (people + non-dev      │   it is an MCP client like any other)
  agents)               │  calls POST /mcp (tools/call)
                        v
 AI agents ──MCP/Streamable HTTP──> spec-registryd (node)   [compose service]
                                      ├─ same JSON-RPC envelope as the MCP server
                                      ├─ kernel: compile → validate → commitDocuments
                                      ├─ mounts: owner/project → .specs root in specs-repo clone
                                      ├─ store: claims, publish ledger, access log
                                      └─ auth: service token / YT session (seam)
                                                 │ git push (bot)
                                                 v
                                  specs repo — owner/project/.specs only
```

## Specs repo layout

- **One dedicated specs repository** (a separate operator-owned GitHub repo — never a branch of a product repo), single canonical branch. Layout: `<owner>/<project>/.specs/<slug>/` — many users (owners), many projects per owner, many specs per project. Kernel semantics are preserved verbatim: per-project root = `<clone>/<owner>/<project>`, which contains `.specs/`.
- **Migration**: for a repo with existing `.specs/` history, extract via `git filter-branch --index-filter` keeping only `.specs/**` paths (full history + blame preserved — proven on omp-spec-kit, frozen branch `specs` is the ready extraction), then commit-prefix the tree into `<owner>/<project>/` and push to the specs repo. Fresh projects get their `owner/project/.specs/` skeleton created by the service on first mount.
- **Enforcement pair**:
  - specs repo (`stgmt/spec-database`, private): v1 perimeter = no collaborators + pushes only via the operator-issued service token — no other identity can push, rulesets become a plan-dependent hardening (TASK-2). Break-glass = operator token; detected via drift reporting (non-bot commit author).
  - product repos: `.specs/**` on code branches rejected by a required check — applied per-repo when that project migrates, not globally (omp-spec-kit itself migrates after the first working release).
- Effect: after migration, product checkouts never contain `.specs/`. The local access-gate problem mostly disappears; the plugin's job shrinks to routing calls to the remote service.

## Service internals

- **Reuse**: `ProposalCompiler` (ops → preview + proposalHash), `commitDocuments` (journal + rollback), `acquireLock` (per-project write serialization), kernel graph build/validation, `specificationDirectoryDigest`, `detectSecret`, the 9 read ops + `spec_patch` tool contracts.
- **New**: `src/service/` — HTTP transport, project mount manager, auth verifier, claim store, ledger store, drift reporter.
- The service keeps **one clone** of the specs repo; per-project kernel root = `<clone>/<owner>/<project>`. The file-lock lives at `<root>/.specs/.omp-spec-kit-write.lock` — it naturally becomes the per-project serializer since each project has its own `.specs` tree inside the shared clone.
- **Transaction artifacts must not be committed.** The existing lock (`.specs/.omp-spec-kit-write.lock`) and staging dir (`.specs/.omp-spec-kit-staging/`) live inside each tracked `.specs/` tree — in the specs repo they would land in git. The repo's root `.gitignore` must exclude `**/.omp-spec-kit-*` (root non-spec files allowed: `.gitignore` + `README.md` layout doc — both seeded in TASK-1); alternatively the paths relocate outside `.specs` (kernel change — decide in implementation).
- **Commit+push is part of the write.** `commitDocuments` only mutates the worktree; the service then runs `git add/commit/push`. A write call succeeds only after the push is confirmed — a caller-visible success means the change is on the remote, not merely staged locally. Push failure → error to the caller; the worktree stays ahead of remote and reconciles on retry/boot (documented in the journal + ledger pending state).
- Commit metadata: bot author + trailers `Spec-Author: <identity>`, `Spec-Request-Id: <requestId>` — git log stays the audit trail.

## Authority split (D1+D3)

- **Git owns**: spec content, `Status:`/`Version:` authored fields, history.
- **Service owns** (SQLite): slug allocation log, claims (spec → holder → TTL), publish ledger (slug → version → digest → commit), access events.
- Rule: fields git can express live in git; fields git cannot express live in the service. The service re-projects README/status into its index on every commit.

## Concurrency semantics

- Request → auth → claim check → compile with `expectedSha`/`repositoryRootFingerprint` → `commitDocuments` under per-project lock → push. Stale base → `CONFLICT` (retryable — existing protocol).
- `spec_claim(slug, ttl)` / `spec_release(slug)`: soft lease; expired lease auto-releases. Claims name the verified YouTrack login (FR-7). Non-holder writes without `force` are hard-denied (`CLAIM_HELD`); `force` is owner-only — a non-owner `force` is hard-denied, an owner `force` proceeds and is logged.

## Transports

- **MCP for all clients — one access point**: Streamable HTTP `POST /mcp`, served by the **official `@modelcontextprotocol/sdk`** (`StreamableHTTPServerTransport` in stateless mode per SDK docs — no session id, `GET` → 405). Same tool contracts and envelope; new optional envelope field `project` (call parameter; absent → token's default scope — see Caller context). `tools/list` is filtered by the caller's role: readers see the nine read tools plus `spec_registry`/`spec_drift`; writers add `spec_patch`, `spec_claim`, `spec_release`; owners see the full surface. KERNEL_SCHEMA_VERSION bumps to `spec-kernel@2`. The YouTrack app is just another MCP client: widget → `host.fetchApp()` → app HTTP handler → `http.Connection.postSync` → `POST /mcp` (`tools/call`) — a ~15-line JSON-RPC wrapper in the handler, no MCP client library needed. There is **no separate REST/RPC surface** to maintain.
- Local stdio MCP: retired for managed projects (`.mcp.json` → remote `type: "http"`). Kept buildable for unmanaged/offline use.

## Multi-tenant project model

Multi-project = namespaces inside the single specs repo, not separate repos or branches. The service's project registry maps `project` (composite `owner/project`) → `<clone>/<owner>/<project>`:

```jsonc
// compose env / config/projects.json
{ "specsRepo": "https://github.com/stgmt/spec-database.git", "branch": "main",
  "projects": [
    { "id": "stgmt/omp-spec-kit" },
    { "id": "stgmt/presentation-reels" },
    { "id": "acme/billing" }
]}
```

Boot: clone specs repo → for each configured project ensure `<owner>/<project>/.specs/` exists → build kernel graph per root → serve. One repo-level fetch/push loop; per-project write lock; slug scope = `owner/project`. Protocol carries `project` on every call; absent → caller's tenant default.

Rejected alternatives: per-repo `specs` branches (scatters the canonical store across N remotes — the service would manage N clones and code repos stay coupled to spec history — superseded by this model), per-user branches (the registry index would need N-branch aggregation; the service serializes writes anyway), one flat spec pool without namespaces (loses tenant boundary).

## Tenancy & access model

The registry is **operator-hosted**: specs exist only in the operator's git repositories. Consumers hold zero git credentials and never clone — the JSON-RPC envelope is the entire interface (no filesystem access, no corpus export, nothing).

| Consumer | Surface | Credential | When |
|---|---|---|---|
| Human in operator's YouTrack | app widgets → app backend → `POST /mcp` | YouTrack session → app bridge (app secret + verified user) | v1 |
| Dev's AI agent | MCP `type: "http"` → `https://<host>/mcp` | the user's YouTrack permanent token (header) | v1 |
| Human in **their own** YouTrack | same extension installed, bound to this backend | YouTrack session of the bound instance | post-v1 |

Onboarding is **automated, not an operator action**. The extension calls the service onboarding API: after YouTrack login, a user-facing action mints a YouTrack permanent token for the caller (via the YouTrack API, using the service's service token) and returns it for `.mcp.json` (agent use) or shows an install guide (binding their own YouTrack). External-YouTrack binding lands post-v1 but the flow is already shaped this way: log into the operator's YouTrack → guided binding → API auto-provisions the token — no manual token issuing ever.

Every request resolves `user → groups → tenant → allowed projects`; the `project` field is checked against that set (absent → default only when exactly one tenant matched). A leaked token compromises only the projects the user could reach, until revoked in YouTrack.

## Caller context (v1)

- Identity is **verified against the live YouTrack** on every uncached request: the app bridge re-verifies the asserted user (`GET /api/users/{login}`), direct tokens are verified as themselves (`GET /api/users/me`). The verified `login` is recorded in claims, commit trailers, and the access log; `X-Spec-Author`/envelope `identity` are retired.
- `project` is a call parameter — or the caller's default scope when absent; refused when ambiguous or outside the allowed set. `spec`/slug is always explicit on targeted ops. Exception: *listing* ops (`spec_registry`, `spec_drift`) treat absent `project` as "all scopes in my allowed set" — they exist to show the caller what they can see.
- **No repo binding in v1**: the service does not care which repo the caller sits in — scope comes from the verified groups, not the checkout. Repo-declared scope (a committed binding file) is a deferred safety rail against silent misrouting, not a v1 mechanism.
- **Onboarding can only grant scopes the operator already configured** in `projects.json` — creating a new project is an operator config step; onboarding mints tokens against existing scopes.

## Publish (R-9)

- Status transition to `ACTIVE` in the specs repo → service packs the spec dir (tar + generated manifest: slug, version, digest, commit, requires from inbound graph edges) → attaches to a `spec-<slug>-v<ver>` release + attestation (reuses `release.yml` pattern) → records ledger entry. Versioned reads resolve via the ledger; no consumer-side pin file exists.

## Failure modes

| Failure | Behavior |
|---|---|
| Service down | Consumers lose access entirely — by design they have no repo access; writes return `UNAVAILABLE`/retryable. The **operator** falls back to cloning the specs repo; break-glass admin push allowed, logged, drift-reported. |
| YouTrack down | Authentication cannot be verified → fail-closed: `UNAVAILABLE`/retryable (503), never an unverified pass. The 60 s verification cache softens blips; claims/ledger/audit stay in sqlite. |
| No auth configuration | The service refuses to start (fail fast at boot) — there is no unauthenticated mode. |
| Non-bot push to `specs` | Rejected by ruleset; if bypassed via admin, drift reporter flags it and the service re-validates/reprojects. |
| `.specs/` appears on code branch | Required check fails the PR. |
| Stale writer | `CONFLICT` + retryable — existing semantics. |
| Claim holder disappears | TTL expiry releases the lease. |
| Version regress (same version, new digest) | Publish step refuses: version must advance; digest mismatch on an existing version = reject + alert. |

## Auth seam (R-7) — implemented

`Authorization: Bearer <credential>` on `/mcp`; credentials are YouTrack-backed and the service stores no tokens of its own. Two verified paths, both re-checked against the live YouTrack:

- **App bridge (YouTrack UI)**: the app backend authenticates with its own secret (app setting, read by the HTTP handler) and asserts the caller it obtained from the verified YouTrack session (`ctx.currentUser.login`, YouTrack 2025.3+ exposes the user's groups in the same context). The service then re-verifies that user with its own service token: `GET /api/users/{login}?fields=id,login,name,banned,groups(id,name)`. The browser cannot set this assertion; the handler runs inside YouTrack and is reachable only through the app's REST endpoint, which YouTrack authenticates as the session user.
- **Direct (agents)**: a user's YouTrack permanent token presented as the bearer credential; the service verifies it via `GET /api/users/me` with the caller's token — 200 proves the token, 401 refuses.

Both paths resolve `user → groups → tenant → allowed scopes` (FR-8) and a role from configured role groups (owner/writer/reader). `banned` → 403. Successful verifications are cached per token hash for a short TTL (default 60 s, `SPEC_REGISTRY_AUTH_CACHE_MS`); negative results are never cached. YouTrack unreachable → fail-closed retryable `UNAVAILABLE`. Asserted identity fields (`X-Spec-Author` / envelope `identity`) are retired: ignored, logged as a warning. Seam realized — the tenant→projects model and call shape are unchanged.

## Why not the alternatives (summary; detail in RESEARCH.md)

- Local stdio MCP for managed projects: violates centralization — kills claim semantics, ledger, and one-source-of-truth.
- Specs on main alongside code: restores per-branch collisions and dual-writer problem.
- Service-owns-content (D2): kills git review/audit for spec content — rejected.
- Full bespoke auth in v1: duplicates YouTrack/GitHub identity; deferred by design, not by accident.
