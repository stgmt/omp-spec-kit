# Specs repository — operator runbook

The canonical specifications live in a dedicated private repository (default
`stgmt/spec-database`). `spec-registryd` is the only writer; consumers reach
the corpus exclusively through the service (MCP tools, `/registry`, `/drift`).

## Threat model

| Actor | Can write canonical? | How it is bounded |
|---|---|---|
| `spec-registryd` (bot identity) | Yes | The only legitimate writer. Commits carry `Spec-Author`/`Spec-Request-Id` trailers and are bot-authored. |
| YouTrack users / agents | No | No git access at all. Writes go through `spec_patch`; concurrency is serialized by the project write lock plus `expectedSha`/`repositoryRootFingerprint` guards — losers get a retryable `CONFLICT`. |
| Operators (humans with repo access) | Break-glass only | Any non-bot commit on the canonical branch is drift: it appears in `GET /drift` as `non-bot-commit` with author and paths, and the next sync reports it. |
| Foreign commits inside the service clone | Never published | The write path refuses to push any commit not authored by the bot identity (`FOREIGN_COMMITS`, non-retryable). |

## Verifying repository posture

```bash
SPEC_REGISTRY_GIT_TOKEN=<token with repo access> npm run check:specs-repo
```

Hard gates: the repository is private; collaborators are limited to the owner,
the service identity (resolved from the token), and any logins listed in
`SPEC_REPO_ALLOWED_ACTORS`. Branch protection / rulesets are reported but not
required (plan-dependent hardening).

## Break-glass procedure

Use only when the service is down and a spec change cannot wait.

1. Clone the specs repository with an operator credential.
2. Commit and push to the canonical branch.
3. Record what was done (commit SHA, reason) — the change is now drift.
4. On the next sync tick (or `spec_drift` tool / `GET /drift`), the service
   fetches the remote and reports a `non-bot-commit` event naming your author
   identity and the divergent paths. This is expected, not a failure.
5. Decide: keep the change (nothing to do — the service reconciles its clone
   on top of it) or revert it with a follow-up push. Do not force-push: the
   service's clone history is used for drift accounting.
6. Re-run `npm run check:specs-repo` if collaborator or token posture changed.

## Concurrency notes

Simultaneous writes to one project serialize on the write lock: one writer
lands, the rest receive `CONFLICT` with `retryable: true` and land on retry —
a linear, bot-only history. Different projects proceed independently. There is
no queue that users wait in; refusal-then-retry is the designed behaviour.

## Customer-owned repositories (TASK-17)

A project can leave the shared specs repository and live in its own. The
binding is server-side state (`repo_bindings`/`repo_credentials` in the store
file); clients never carry repo URLs or tokens in `.mcp.json`.

- `GET /me` — caller's scopes with the repo each resolves to (`bound`,
  `status`: `default`/`migrating`/`active`/`error`).
- `GET /repos/bindings` — binding rows visible in the caller's scopes.
- `POST /repos/probe` `{project, repoUrl, token, username?}` — reachability +
  credential check (`ls-remote`), persists nothing.
- `POST /repos/bind` `{project, repoUrl, branch?, token, migrate?}` —
  owner/writer only, project must be in the caller's scopes. `migrate`
  defaults to `true`: the project's `.specs` snapshot is copied into the
  target repo as a bot commit and the landed tree is verified byte-for-byte
  (git tree hash) against the source. `migrate: false` binds without copying —
  a pre-seeded target repo wins; an empty one gets a skeleton `.specs`.
  The response carries `migrated: {commit, documents}` — the pushed commit
  SHA and the landed file count — or `null` when nothing was migrated; the
  widget's verify step shows this as the proof of migration.
- `POST /repos/unbind` `{project}` — back to the default repo. The bound
  clone stays on disk because published ledger rows still reference it.

Semantics:

- Migration copies a **snapshot**, not git history — pushing refs would leak
  every other project's ancestors out of the shared repo. Published versions
  recorded before the move keep resolving from the previous clone (the ledger
  stores `repo_url`/`repo_branch` per row).
- While a binding is `migrating`, reads still hit the source repo and writes
  are refused with retryable `SPEC_MIGRATING`. Re-binding the same
  `(repoUrl, branch)` is an idempotent no-op.
- Credentials: `token` is sealed with AES-256-GCM (key from
  `SPEC_REGISTRY_SECRETS_KEY`, ≥16 chars) before it reaches the store. It is
  never logged, returned, or placed in config. A credential only
  authenticates the repo it was bound to — never reused across remotes.
- URL policy (`repoPolicy.allowedHosts`): https on public hosts; http/git
  only on private hosts (compose, on-prem); `file://` only when `"file"` is
  explicitly listed. An empty allowlist means any https public host.
- The same threat model applies per repo: the service is the only writer in
  the bound repo; non-bot commits there surface as `non-bot-commit` drift
  with the repo attached, and an unreachable bound repo surfaces as
  `repo-unreachable` without stalling sync for the others.

## Customer-owned YouTrack / external IdP (TASK-13)

A customer can point the service at their own YouTrack instance. One binding
= one tenant: users verified against that YouTrack get scopes, roles, and
their app-bridge traffic under the bound tenant only. Binding state lives in
`idp_bindings`/`idp_credentials` in the store file; `.mcp.json` never carries
IdP URLs or tokens.

- `GET /idp/bindings` — bindings the caller may see (binder sees their own,
  owners see all).
- `POST /idp/probe` `{youtrackUrl, serviceToken}` — reachability + capability
  check against the remote YouTrack (`users/me` + a `users` listing), persists
  nothing. The response reports `capabilities.mintTokens`: `false` when the
  service token cannot read another user's permanent tokens (the same rights
  minting needs) — such tenants still work, but members generate their own
  YouTrack tokens and paste them into the widget (see guided onboarding).
- `POST /idp/bind` `{tenant, youtrackUrl, serviceToken, projects, hubGroups,
  roleGroups, defaultProject?, repo?}` — any verified operator-YouTrack user
  may bind; external-IdP users cannot nest-bind. Probes first, then seals the
  service token with AES-256-GCM and mints an app-bridge secret that is
  returned **once** in `install.serviceBridgeToken` together with
  `install.serviceUrl` (`config.publicUrl`, else the request host).
  The optional `repo {url, token, branch?, username?, migrate?}` block binds
  every declared project to the customer's own specs repository in the same
  call — per-project results are reported under `repos`.
- `POST /idp/unbind` `{tenant}` — the binder or an owner. Revokes external
  access on the next auth check (the token cache expires in ≤ `SPEC_REGISTRY_AUTH_CACHE_MS`)
  and drops the tenant's repo bindings with it.

Semantics:

- Tenant self-service: projects registered through a binding count as
  configured — the customer needs no operator config entry, and their scopes
  never overlap operator tenants. A project may not be claimed by a binding
  when the operator config or another binding already owns it
  (`IDP_PROJECT_TAKEN`), and a tenant's binding can only be changed by its
  binder or an owner — never silently re-pointed by a stranger.
- **Tenant specs live in the tenant's repo, never the operator's.** An
  external-IdP project without a repo binding refuses every data operation
  with `REPO_BINDING_REQUIRED` until one is bound — through the `repo` block
  on `idp/bind` or `POST /repos/bind` by a tenant writer/owner. Operator
  projects keep the configured shared repo as their default.
- Re-binding rules: identical parameters are a no-op (`unchanged`); the same
  URL with different scope/group parameters is refused (`IDP_EXISTS`) —
  unbind first to change a tenant's shape.
- Group gating: `hubGroups` decides scope membership (a user outside all
  listed groups gets `NO_SCOPES`), `roleGroups` maps their YouTrack groups to
  `owner`/`writer`/`reader`.
- `serviceToken` is a permanent token able to enumerate users+groups on the
  customer's Hub (an admin token satisfies the probe). It is unsealed only
  inside the auth path, never returned or logged.
- `X-Spec-Idp: <tenant>` is a routing hint for direct tokens — it reorders
  which IdP verifies first, never grants or denies; a wrong hint still
  resolves through the remaining IdPs.
- Bridge auth: the minted `serviceBridgeToken` + `X-Spec-User` header let the
  customer's installed app backend assert its users; the service verifies the
  asserted login against the bound YouTrack, not the operator's.
- URL policy (`idpPolicy.allowedHosts`): https on public hosts; http only on
  private hosts (compose, on-prem). An empty allowlist means any https public
  host. Loopback/wildcard/link-local/metadata destinations
  (`::1`, `0.0.0.0`, `169.254.*`, v4-mapped v6) are never bindable, and
  credentials embedded in the URL (`user:pass@`) are stripped before the
  binding is stored.
- An unbound or unreachable external YouTrack degrades only its own tenant:
  auth fan-out skips a dead IdP instead of failing every caller, and binding
  deletion takes effect at the next cache miss. A token that no reachable IdP
  verifies is still refused — `UNAVAILABLE` (503) only when a dead IdP might
  have been its issuer.

## Guided onboarding (TASK-19)

The `spec-service-panel` widget is the member's whole journey — no REST calls
by hand:

1. **Specs repository** — each scoped project shows its repo and status
   (`active`/`default`/`required`). A `required` project has no repository
   (external tenant without a binding): owner/writer users get the bind form
   (URL, git token, branch), probe and bind+migrate run from the same panel.
2. **Verify it works** — after a bind the panel shows the migration evidence
   (`migrated.commit` SHA + `migrated.documents` count from the bind
   response), re-reads the spec list from the newly bound repo, and offers a
   patch test: dry-run first, real write opt-in. An empty repository shows an
   honest "no specs yet" instead of a fake success.
3. **Connect your agent** — `Get my .mcp.json` calls
   `POST /onboarding/token` through the app bridge and renders the exact
   snippet to paste into the project's `.mcp.json` (`Authorization`,
   `X-Spec-Project`, `X-Spec-Idp` where bound). Issuing again revokes the
   previous same-purpose token — the panel says so, and a Dismiss button
   clears the secret from the DOM.

Edge cases:

- `MINT_NOT_PERMITTED` — the bound IdP's service token cannot mint permanent
  tokens (`/idp/probe` and `/idp/bind` report `capabilities.mintTokens`).
  The panel then accepts a user-created YouTrack permanent token: the
  service verifies it resolves to the same caller (`TOKEN_INVALID` /
  `TOKEN_MISMATCH` otherwise) and returns the snippet built around it.
  The token is never persisted or logged either way.
- `NO_SCOPES` — a verified user with no matching scope group sees a
  no-access state and no bind/mint controls.
- Readers see specs and can mint their own read-only token, but never the
  repository bind/migrate controls.
- The clipboard in a sandboxed app iframe is unreliable: Copy falls back to
  selecting the snippet for manual Ctrl+C.

`POST /onboarding/token` accepts `{serviceUrl, project?, repo?, token?}`;
`repo{}` binds the caller's project to their own repository before issuing.
