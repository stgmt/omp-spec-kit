# Fixtures

Status: DRAFT

## Landed (live-first)

- `tests/e2e/` — the live auth suite (TASK-12): compose project `spec-auth-e2e` with a real YouTrack (Configuration Wizard completed automatically via the system Chrome), the real git daemon, and the real service. The bootstrap provisions groups/users (passwords via the credentials API), scoped permanent tokens, the project team, the app import with settings, and a seeded specs repo — all through live admin APIs, no mocks. 12 scenarios in `run-live.mjs`.
- `tests/service/` — the service suite runs against the same live fixture (`tests/e2e/lib/live-fixture.mjs`): transport parity, project resolution, write path with verified logins, store persistence, registry index, drift, sync.
- `tests/unit/service/` — pure units (mount resolution, tenant/auth-config parsing, claim store).
- Compose smoke for AC-7: the live E2E's `spec-registryd` boot (TASK-11 evidence) replaces a separate compose fixture.

## Planned (not yet)

- `tests/fixtures/registry/ledger/` — publish records incl. version-regress and digest-mismatch reject cases (TASK-9).
- `tests/fixtures/registry/pushes/` — recorded push scenarios for the product-repo `.specs/` boundary check (applied per-repo at TASK-14).

## Rules

- No fixture may contain real credentials in git: live tokens/configs live under `tests/e2e/artifacts/` (gitignored) and are minted at run time.
- Corpus fixtures reuse existing kernel fixture conventions (`tests/fixtures/kernel/`).
