# Specs are orphan branches of the project repository

Status: accepted  
Date: 2026-10-31  
Supersedes: the dedicated `stgmt/spec-database` repository

## Context

The 2.x registry stored every project under `<owner>/<project>/.specs/<slug>/`
in one operator-owned repository. That made the registry a second source of
truth next to the product repository, required a global git credential, and
could not express per-project ownership or branch-scoped work.

## Decision

- A canonical specification is an **orphan `spec-<slug>` branch of its project
  repository**.
- `.spec-kit.json` at the branch root binds `project`, `spec`, `repo`, and
  `branch`; the corpus is `.specs/<slug>/`.
- One repository may host specs of several projects; discovery reads metadata,
  not a path layout.
- `spec-<slug>--<topic>` holds unmerged work. It is not indexed, published, or
  projected; `spec_branch merge` merges it under the project write lock after
  checking that every changed path is `.spec-kit.json` or `.specs/<slug>/**`.
- There is no shared default repository. An unbound project refuses spec
  operations (`SETUP_REQUIRED` / `REPO_BINDING_REQUIRED`).
- The service keeps one bare mirror per repository credential and one lazy
  worktree per canonical branch; the kernel reads a materialised project corpus.

## Consequences

- Migration is `scripts/migrate-specs-to-branches.mjs`, one root commit per spec,
  idempotent.
- Repository rulesets protect `refs/heads/spec-*`; the service token must be an
  owner or an explicitly allowed bypass actor.
- Per-repository credentials replace `SPEC_REGISTRY_GIT_TOKEN`.
- The old `<owner>/<project>/.specs` layout and the shared repository are
  retired; historical artifacts remain readable/archived only.

## Links

- Plan: `docs/plans/spec-per-branch-3.0.0.md`
- Runbook: `docs/specs-repo-operations.md`
- Tests: `tests/unit/service/spec-branches.test.mjs`,
  `tests/unit/service/spec-migration.test.mjs`
