# Spec branches — operator runbook

Each project's specifications live on orphan `spec-<slug>` branches in the
project's own Git repository. `.spec-kit.json` at the branch root binds the
branch to its `project`, `spec`, `repo`, and `branch`; the corpus is
`.specs/<slug>/`. `spec-registryd` is the only writer; consumers reach the
corpus exclusively through the service (MCP tools, `/registry`, `/drift`).

There is no shared default repository and no single configured branch. A spec
branch contains only `.spec-kit.json` and `.specs/<slug>/**`; work branches
(`spec-<slug>--<topic>`) hold unmerged changes and are merged by
`spec_branch merge`, never indexed or projected.

## Threat model

| Actor | Can write canonical? | How it is bounded |
|---|---|---|
| `spec-registryd` (bot identity) | Yes | The only legitimate writer. Commits carry `Spec-Author`/`Spec-Request-Id` trailers and are bot-authored. |
| YouTrack users / agents | No | No git access at all. Writes go through `spec_patch`; concurrency is serialized by the project write lock plus `expectedSha`/`repositoryRootFingerprint` guards — losers get a retryable `CONFLICT`. |
| Operators (humans with repo access) | Break-glass only | Any non-bot commit on a canonical `spec-*` branch is drift: it appears in `GET /drift` as `non-bot-commit` with author and paths, and the next sync reports it. |
| Foreign commits inside the service worktree | Never published | The write path refuses to push any commit not authored by the bot identity (`FOREIGN_COMMITS`, non-retryable). |

## Verifying repository posture

Repository hardening is per bound project, not per stack. Apply a ruleset to
the project repository that restricts pushes to `refs/heads/spec-*` to the
service bot, and keep each repository private unless the project owner chooses
public specs. `GET /repos/bindings` and `GET /me` report the active binding;
`GET /status` reports whether a project still needs setup.

## Break-glass procedure

Use only when the service is down and a spec change cannot wait.

1. Clone the project repository with an operator credential.
2. Commit and push to the `spec-<slug>` branch (never `main`).
3. Record what was done (commit SHA, reason) — the change is now drift.
4. On the next sync tick (or `spec_drift` tool / `GET /drift`), the service
   fetches the remote and reports a `non-bot-commit` event naming your author
   identity and the divergent paths. This is expected, not a failure.
5. Decide: keep the change (nothing to do — the service reconciles its mirror
   on top of it) or revert it with a follow-up push. Do not force-push: the
   service's mirror history is used for drift accounting.
6. Re-apply the `spec-*` ruleset if collaborator or token posture changed.

## Concurrency notes

Simultaneous writes to one project serialize on the write lock: one writer
lands, the rest receive `CONFLICT` with `retryable: true` and land on retry —
a linear, bot-only history. Different projects proceed independently. There is
no queue that users wait in; refusal-then-retry is the designed behaviour.

## Project repositories (TASK-17)

Every project is bound to its own repository; the binding is server-side state
(`repo_bindings`/`repo_credentials` in the store file), and clients never carry
repo URLs or tokens in `.mcp.json`.

- `GET /me` — caller's scopes with the repo each resolves to (`bound`,
  `status`: `required`/`migrating`/`active`/`error`). An unbound project is
  `required`, never `default`.
- `GET /repos/bindings` — binding rows visible in the caller's scopes.
- `POST /repos/probe` `{project, repoUrl, token, username?}` — reachability +
  credential check (`ls-remote`), persists nothing.
- `POST /repos/bind` `{project, repoUrl, branch?, token}` — owner/writer only,
  project must be in the caller's scopes. The target repository must already
  contain canonical `spec-<slug>` branches with valid `.spec-kit.json`; the
  service attaches them and never copies a corpus or creates a skeleton on
  `main`. The response carries `migrated: null`.
- `POST /repos/unbind` `{project}` — the project returns to `required`. There
  is no default repository to fall back to; reads and writes refuse with
  `REPO_BINDING_REQUIRED` until a new binding exists. Published versions stay
  readable from the ledger's recorded repo/commit.

Semantics:

- Re-binding the same `(repoUrl, branch)` is an idempotent no-op. Re-binding a
  different repository makes it the new source of truth immediately; content
  that was not already on `spec-*` branches there is not copied.
- While a binding is `migrating`, reads still hit the previous repo and writes
  are refused with retryable `SPEC_MIGRATING`.
- Credentials: `token` is sealed with AES-256-GCM (key from
  `SPEC_REGISTRY_SECRETS_KEY`, ≥16 chars) before it reaches the store. It is
  never logged, returned, or placed in config. A credential only
  authenticates the repo it was bound to — never reused across remotes.
- URL policy (`repoPolicy.allowedHosts`): https on public hosts; http/git
  only on private hosts (compose, on-prem); `file://` only when `"file"` is
  explicitly listed. An empty allowlist means any https public host.
- The same threat model applies per repo: the service is the only writer on
  canonical `spec-*` branches; non-bot commits there surface as
  `non-bot-commit` drift with the repo attached, and an unreachable bound repo
  surfaces as `repo-unreachable` without stalling sync for the others.

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
  YouTrack tokens and paste them into the app page (see guided onboarding).
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
- **Tenant specs live in the tenant's repo, never the operator's.** Every
  external-IdP project needs a repo binding and refuses data operations with
  `REPO_BINDING_REQUIRED` until one is bound — through the `repo` block on
  `idp/bind` or `POST /repos/bind` by a tenant writer/owner. Operator
  projects follow the same rule: no binding, no spec access.
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

The app's own page — `spec-app`, an `ADMINISTRATION_MENU_ITEM` extension point — is the
member's whole journey: **Administration menu → Spec Service**. Installing the
ZIP creates nothing in the tracker; the page hosts the full stepper, and
`?step=agent` deep-links straight to the agent step. Discovery is the native
**System-wide banner** an administrator configures in Global Settings — the
apps API exposes no way to post user notifications, and none is fabricated.

1. **Specs repository** — each scoped project shows its repo and status
   (`active`/`required`/`migrating`/`error`). A `required` project has no
   repository binding: owner/writer users get the bind form (URL, git token),
   probe and bind run from the page against a repository whose canonical
   `spec-*` branches already exist.
2. **Verify it works** — after a bind the page re-reads the spec list from the
   newly bound repo and offers a patch test: dry-run first, real write opt-in.
   An empty repository shows an honest "no specs yet" instead of a fake
   success. A repository with an invalid `.spec-kit.json` reports
   `SPEC_BINDING_INVALID`.
3. **Connect your agent** — `Get my .mcp.json` calls
   `POST /onboarding/token` through the app bridge and renders the exact
   snippet to paste into the project's `.mcp.json` (`Authorization`,
   `X-Spec-Project`, `X-Spec-Idp` where bound). Issuing again revokes the
   previous same-purpose token — the page says so, and a Dismiss button
   clears the secret from the DOM.

The issue widget (`spec-service-panel`) is deliberately thin: an issue-aware
context card with the linked spec when `SpecId` is set, repo status chips, and
an **Open Spec Service** link to `/app/spec-graph-app/spec-app?step=agent`.
No onboarding forms, no `.mcp.json`, no bind controls live inside an issue —
a task is not a configuration surface.

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
