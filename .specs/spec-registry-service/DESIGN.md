# Design

Status: DRAFT

## Architecture

```
 humans ──YouTrack app──┐  (the app lives inside YouTrack, outside the stack)
 (people + non-dev      │  calls POST /rpc
  agents)               │
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
- `spec_claim(slug, ttl)` / `spec_release(slug)`: soft lease; expired lease auto-releases. Claims are advisory-except-for-owner policy: non-holder writes require `force: true` and are logged (v1) — hard denial lands with full auth (R-7 seam).

## Transports

- **MCP for agents**: Streamable HTTP. Same tool contracts and envelope; new optional envelope field `project` (call parameter; absent → token's default scope — see Caller context). KERNEL_SCHEMA_VERSION bumps to `spec-kernel@2`.
- **HTTP JSON-RPC for the YouTrack app**: `POST /rpc` accepts the same message shape — no separate REST surface to maintain.
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
| Human in operator's YouTrack | app widgets → `POST /rpc` | YouTrack session → service-side identity | v1 |
| Dev's AI agent | MCP `type: "http"` → `https://<host>/mcp` | per-tenant bearer token (header) | v1 |
| Human in **their own** YouTrack | same extension installed, bound to this backend | per-tenant bearer token | post-v1 |

Onboarding is **automated, not an operator action**. The extension calls the service onboarding API: after YouTrack login, a user-facing action issues a tenant record + token bound to the caller's allowed `project` set and returns it for `.mcp.json` (agent use) or shows an install guide (binding their own YouTrack). External-YouTrack binding lands post-v1 but the flow is already shaped this way: log into the operator's YouTrack → guided binding → API auto-provisions the tenant + token — no manual token issuing ever.

Every request resolves `token → tenant → allowed projects`; the `project` field is checked against that set (absent → tenant default). A leaked token compromises only that tenant's allowed projects.

## Caller context (v1)

- Token is the only credential a caller holds: it resolves to a **tenant** and an allowed `owner/project` scope set. It does **not** resolve to a user — per-user identity is asserted (`identity` field / `X-Spec-Author` header), recorded everywhere, spoofable until TASK-12. (Tokens are issued per onboarding event; whether an operator issues one per user or one per tenant is an ops choice, not a protocol difference.)
- `project` is a call parameter — or the token's default scope when absent; refused when ambiguous or outside the allowed set. `spec`/slug is always explicit on targeted ops. Exception: *listing* ops (`spec_registry`, `spec_drift`) treat absent `project` as "all scopes in my allowed set" — they exist to show the caller what they can see.
- **No repo binding in v1**: the service does not care which repo the caller sits in — scope comes from the token, not the checkout. Repo-declared scope (a committed binding file) is a deferred safety rail against silent misrouting, not a v1 mechanism.
- **Onboarding can only grant scopes the operator already configured** in `projects.json` — creating a new project is an operator config step; onboarding issues tokens against existing scopes.

## Publish (R-9)

- Status transition to `ACTIVE` in the specs repo → service packs the spec dir (tar + generated manifest: slug, version, digest, commit, requires from inbound graph edges) → attaches to a `spec-<slug>-v<ver>` release + attestation (reuses `release.yml` pattern) → records ledger entry. Versioned reads resolve via the ledger; no consumer-side pin file exists.

## Failure modes

| Failure | Behavior |
|---|---|
| Service down | Consumers lose access entirely — by design they have no repo access; writes return `UNAVAILABLE`/retryable. The **operator** falls back to cloning the specs repo; break-glass admin push allowed, logged, drift-reported. |
| Non-bot push to `specs` | Rejected by ruleset; if bypassed via admin, drift reporter flags it and the service re-validates/reprojects. |
| `.specs/` appears on code branch | Required check fails the PR. |
| Stale writer | `CONFLICT` + retryable — existing semantics. |
| Claim holder disappears | TTL expiry releases the lease. |
| Version regress (same version, new digest) | Publish step refuses: version must advance; digest mismatch on an existing version = reject + alert. |

## Auth seam (R-7)

v1: `Authorization: Bearer <tenant-token>` on `/mcp`+`/rpc`; each token maps to a tenant and its allowed `project` set (required — external YouTrack bindings can't share one token). Asserted caller identity (`Spec-Author` header / envelope field) is logged on every write but not cryptographically verified. Seam: replace the verifier with YouTrack Hub token introspection + role map (reader/writer/owner) — call shape and the tenant→projects model unchanged.

## Why not the alternatives (summary; detail in RESEARCH.md)

- Local stdio MCP for managed projects: violates centralization — kills claim semantics, ledger, and one-source-of-truth.
- Specs on main alongside code: restores per-branch collisions and dual-writer problem.
- Service-owns-content (D2): kills git review/audit for spec content — rejected.
- Full bespoke auth in v1: duplicates YouTrack/GitHub identity; deferred by design, not by accident.
