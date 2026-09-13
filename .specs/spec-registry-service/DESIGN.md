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
                                      ├─ mounts: project → worktree on `specs` branch
                                      ├─ store: claims, publish ledger, access log
                                      └─ auth: service token / YT session (seam)
                                                 │ git push (bot)
                                                 v
                                  repo `specs` branch — .specs/ only
```

## Branch model

- For repos with existing `.specs/` history, `specs` is produced by `git subtree split --prefix=.specs` — the branch contains only `.specs/` **and preserves its full history** (blame, prior commits). For fresh repos, an orphan branch is created instead. Either way the branch carries only the `.specs/` tree.
- The `specs` branch is never merged into code branches; merges of `specs` into code branches would smuggle `.specs/` onto the wrong side of the boundary and are prohibited by the same enforcement pair below.
- Enforcement pair:
  - `specs` branch: push restricted to the service bot (GitHub ruleset / branch protection; fallback: server-side `pre-receive` or a required check that fails non-bot pushes).
  - all other branches: `.specs/**` rejected — ruleset path restriction where available, otherwise a required CI job (`check: no .specs in diff`) that fails the PR/push.
- Effect: product checkouts never contain `.specs/`. The local access-gate problem mostly disappears; the plugin's job shrinks to routing calls to the remote service.

## Service internals

- **Reuse**: `ProposalCompiler` (ops → preview + proposalHash), `commitDocuments` (journal + rollback), `acquireLock` (per-project write serialization), kernel graph build/validation, `specificationDirectoryDigest`, `detectSecret`, the 9 read ops + `spec_patch` tool contracts.
- **New**: `src/service/` — HTTP transport, project mount manager, auth verifier, claim store, ledger store, drift reporter.
- Per project the service keeps a persistent worktree checked out on `specs`. All kernel calls run with `root = worktree(project)`. The file-lock naturally becomes the per-project serializer — the service is the only process in the worktree.
- **Transaction artifacts must not be committed.** The existing lock (`.specs/.omp-spec-kit-write.lock`) and staging dir (`.specs/.omp-spec-kit-staging/`) live inside the tracked `.specs/` tree — on the `specs` branch they would land in git. The branch's `.gitignore` (committed there as its only non-spec file) must exclude `**/.omp-spec-kit-*`; alternatively the paths relocate outside `.specs` (kernel change — decide in implementation).
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

- **MCP for agents**: Streamable HTTP. Same tool contracts and envelope; new optional envelope field `project` (absent → caller's bound default project; the plugin config pins it). KERNEL_SCHEMA_VERSION bumps to `spec-kernel@2`.
- **HTTP JSON-RPC for the YouTrack app**: `POST /rpc` accepts the same message shape — no separate REST surface to maintain.
- Local stdio MCP: retired for managed projects (`.mcp.json` → remote `type: "http"`). Kept buildable for unmanaged/offline use.

## Multi-project model

Multi-project = the dedicated-`specs`-branch pattern applied per repository. Each managed project keeps its specs on its **own repo's own `specs` orphan branch**; the service is a registry of mounts, not a merged spec pool:

```jsonc
// compose env / config/projects.json
{ "projects": [
  { "id": "omp-spec-kit", "repo": "git@github.com:stgmt/omp-spec-kit.git", "branch": "specs" },
  { "id": "presentation-reels", "repo": "git@github.com:stgmt/presentation-reels.git", "branch": "specs" }
]}
```

Boot: for each project, clone (or reuse volume) → `git checkout specs` (create orphan if absent) → build kernel graph → serve. One worktree per project; per-project write lock; slug scope = project. Protocol carries `project` on every call; a caller without it resolves to its configured default.

Explicitly rejected for v1: one global specs repo for all projects (loses per-repo permissions and lifecycle, couples unrelated teams' write availability — recorded as a backlog alternative if a consumer ever needs org-wide specs), and cross-project spec references (deferred — see Backlog risks).

## Tenancy & access model

The registry is **operator-hosted**: specs exist only in the operator's git repositories. Consumers hold zero git credentials and never clone — the JSON-RPC envelope is the entire interface (no filesystem access, no corpus export, nothing).

| Consumer | Surface | Credential | When |
|---|---|---|---|
| Human in operator's YouTrack | app widgets → `POST /rpc` | YouTrack session → service-side identity | v1 |
| Dev's AI agent | MCP `type: "http"` → `https://<host>/mcp` | per-tenant bearer token (header) | v1 |
| Human in **their own** YouTrack | same extension installed, bound to this backend | per-tenant bearer token | post-v1 |

Onboarding is **automated, not an operator action**. The extension calls the service onboarding API: after YouTrack login, a user-facing action issues a tenant record + token bound to the caller's allowed `project` set and returns it for `.mcp.json` (agent use) or shows an install guide (binding their own YouTrack). External-YouTrack binding lands post-v1 but the flow is already shaped this way: log into the operator's YouTrack → guided binding → API auto-provisions the tenant + token — no manual token issuing ever.

Every request resolves `token → tenant → allowed projects`; the `project` field is checked against that set (absent → tenant default). A leaked token compromises only that tenant's allowed projects.

## Publish + pins (R-9)

- Status transition to `ACTIVE` on the `specs` branch → service packs the spec dir (tar + generated manifest: slug, version, digest, commit, requires from inbound graph edges) → attaches to a `spec-<slug>-v<ver>` release + attestation (reuses `release.yml` pattern).
- Product repos commit `spec-refs.json` (`{slug: {version, digest}}`); `omp spec verify` checks pins resolve to published digests; `omp spec outdated` diffs pins vs ledger.

## Failure modes

| Failure | Behavior |
|---|---|
| Service down | Consumers lose access entirely — by design they have no repo access; writes return `UNAVAILABLE`/retryable. The **operator** falls back to `git clone -b specs`; break-glass admin push allowed, logged, drift-reported. |
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
