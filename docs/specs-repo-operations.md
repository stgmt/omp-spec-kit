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
