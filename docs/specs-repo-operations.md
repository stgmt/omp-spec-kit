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
