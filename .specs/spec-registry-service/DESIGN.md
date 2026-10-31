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
                                      ├─ mirrors: repo -> bare mirror; spec -> worktree
                                      ├─ corpus: per-project materialised read root
                                      ├─ store: claims, publish ledger, access log
                                      └─ auth: YouTrack-verified principal
                                                 │ git push (bot)
                                                 v
                              spec-<slug> branch — .spec-kit.json + .specs/<slug>/
```

## Spec branch layout

- A canonical specification is an **orphan `spec-<slug>` branch of its project
  repository**. `.spec-kit.json` at the branch root is the binding record:
  `{schema, project, spec, repo, branch, createdAt, owner}`. The corpus lives
  under `.specs/<slug>/` at the branch root; no `<owner>/<project>` prefix.
- A repository may host specs of several projects. The branch name is not
  enough to identify the project: discovery reads `.spec-kit.json` from every
  `spec-*` branch and rejects a mismatch between metadata, ref, and repository
  with `SPEC_BINDING_INVALID`.
- A work branch `spec-<slug>--<topic>` is unmerged work. It is created from the
  canonical branch, never indexed, published, or projected. `spec_branch merge`
  verifies that every changed path is `.spec-kit.json` or `.specs/<slug>/**`,
  merges the work ref under the project write lock, pushes the canonical branch,
  and deletes the work branch.
- There is no shared default repository. A project without an active binding
  refuses spec operations with `SETUP_REQUIRED` / `REPO_BINDING_REQUIRED`.
- **Migration**: `scripts/migrate-specs-to-branches.mjs` converts the 2.x
  `<owner>/<project>/.specs/<slug>/` layout into one orphan branch per spec,
  idempotently and without rewriting existing branches.

## Service internals

- **Reuse**: `ProposalCompiler` (ops → preview + proposalHash),
  `commitDocuments` (journal + rollback), `acquireLock` (per-project write
  serialization), kernel graph build/validation, `specificationDirectoryDigest`,
  `detectSecret`, the read ops and `spec_patch` tool contracts.
- **New**: `src/service/` — HTTP transport, repository bindings, bare mirrors,
  lazy per-spec worktrees, a materialised project corpus, auth verifier, claim
  store, ledger store, drift reporter, `spec_branch`.
- **Storage**: one bare mirror per bound repository under `clones/<repoKey>/`;
  one worktree per canonical branch under `worktrees/<branch>/`; the kernel
  reads a project corpus assembled from each canonical branch's
  `.specs/<slug>/` tree under `projects/<owner>__<project>/`. The kernel rejects
  symlinked roots, and a project spans several branches, so the corpus is
  materialised instead of linked.
- **Write path**: `spec_patch` applies to the materialised corpus, copies the
  target spec tree into its worktree, commits as the bot, pushes
  `HEAD:refs/heads/spec-<slug>`, refreshes the corpus, then publishes. A write
  succeeds only after the push is confirmed; a failed push leaves the worktree
  ahead and reconciles on retry/boot.
- **Transaction artifacts must not be committed.** The lock
  (`.specs/.omp-spec-kit-write.lock`) and staging dir
  (`.specs/.omp-spec-kit-staging/`) live in the materialised corpus, not in a
  worktree; the worktree copy contains only the spec tree.
- Commit metadata: bot author + trailers `Spec-Author: <identity>`,
  `Spec-Request-Id: <requestId>` — git log stays the audit trail.

## Authority split (D1+D3)

- **Git owns**: spec content, `Status:`/`Version:` authored fields, history.
- **Service owns** (SQLite): bindings and sealed credentials, claims
  (spec → holder → TTL), publish ledger (spec → version → digest → commit),
  access events.
- Rule: fields git can express live in git; fields git cannot express live in
  the service. The service re-projects README/status into its index on every
  commit.

## Concurrency semantics

- Request → auth → claim check → compile with
  `expectedSha`/`repositoryRootFingerprint` → `commitDocuments` under the
  project write lock → copy into the spec worktree → push. Stale base →
  `CONFLICT` (retryable — existing protocol).
- `spec_claim(spec, ttl)` / `spec_release(spec)`: soft lease; expired lease
  auto-releases. Claims name the verified YouTrack login (FR-7). Non-holder
  writes without `force` are hard-denied (`CLAIM_HELD`); `force` is owner-only —
  a non-owner `force` is hard-denied, an owner `force` proceeds and is logged.
- `spec_branch` create/merge/delete and `spec_patch` share the same per-project
  write lock, so a merge never races a document write.

## Transports

- **MCP for all clients — one access point**: Streamable HTTP `POST /mcp`,
  served by the official `@modelcontextprotocol/sdk` in stateless mode. Same
  tool contracts and envelope. `tools/list` is filtered by role: readers see
  read tools plus `spec_registry`/`spec_drift`; writers add
  `spec_patch`/`spec_claim`/`spec_release`/`spec_branch`; owners additionally
  may `force`. The YouTrack app is another MCP client.
- Local stdio MCP remains for unmanaged/offline checkouts; the shipped
  `.mcp.json` uses the remote endpoint for managed projects.

## Multi-tenant project model

Each project is bound to its own repository. One repository may host specs of
several projects; each spec branch names its project in `.spec-kit.json`.

```jsonc
// config/projects.json
{
  "projects": [{ "id": "stgmt/omp-spec-kit" }],
  "bindings": [
    {
      "project": "stgmt/omp-spec-kit",
      "repoUrl": "https://github.com/stgmt/omp-spec-kit.git",
      "tokenEnv": "SPEC_REGISTRY_REPO_TOKEN"
    }
  ]
}
```

Boot: seed bindings → clone/fetch each mirror → discover canonical spec branches
→ materialise each project corpus → build the kernel graph per project. Sync
fetches every mirror on an interval and rebuilds only when a branch tip moved.
Protocol carries `project` on every call; absent → caller's tenant default.

Rejected alternatives: one shared specs repository (single point of failure and
a second source of truth next to the product), per-user branches (index would
need N-branch aggregation), one flat spec pool without project metadata (loses
the tenant boundary).

## Tenancy & access model

The registry is **operator-hosted**, but the canonical bytes live in each
project's own repository. Consumers hold zero git credentials and never clone —
the JSON-RPC envelope is the entire interface. An external tenant may bind its
own repositories; its specs never land in the operator's repositories.

| Consumer | Surface | Credential | When |
|---|---|---|---|
| Agent | `POST /mcp` | YouTrack permanent token (or app bridge assertion) | every read/write |
| YouTrack app | `POST /mcp` through the app backend | minted service bridge secret + asserted user | widget calls |
| Git host | `git push` from the service | per-repository sealed token | write path, publish tags |
