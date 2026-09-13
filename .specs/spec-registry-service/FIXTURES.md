# Fixtures

Status: DRAFT

## Planned fixtures

- `tests/fixtures/registry/specs-repo/` — bare specs repo + working clone pair with `stgmt/a/.specs/` + `acme/b/.specs/` namespaces (reuses existing spec fixture shapes).
- `tests/fixtures/registry/repo-b/` — second namespace for scope isolation (AC-4, SCEN-multi-project-routing).
- `tests/fixtures/registry/pushes/` — recorded push scenarios: bot push, non-bot push (reject), break-glass admin push (drift), `.specs/` on code branch (reject).
- `tests/fixtures/registry/claims/` — lease lifecycle: claim → held write → force write → expiry.
- `tests/fixtures/registry/ledger/` — publish records incl. version-regress and digest-mismatch reject cases.
- Envelope fixture set for remote transport: identical inputs/outputs replayed against stdio and HTTP transports (parity check, SCEN-remote-mcp-parity).
- Compose fixture: minimal `projects.json` + fake bot credentials for `docker compose up` smoke (AC-7).

## Rules

- No fixture may contain real credentials; bot identity is a fixture user.
- Corpus fixtures reuse existing kernel fixture conventions (`tests/fixtures/kernel/`).
