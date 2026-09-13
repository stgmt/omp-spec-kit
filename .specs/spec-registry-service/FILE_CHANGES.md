# File changes (planned)

Status: DRAFT

## New

- `src/service/index.js` — service entrypoint: config load, mount manager, transports.
- `src/service/mounts.js` — per-project clone/worktree lifecycle on `specs` branch.
- `src/service/http.js` — `POST /rpc` + Streamable HTTP MCP transport.
- `src/service/auth.js` — v1 token verifier + identity attribution; YouTrack Hub seam.
- `src/service/claims.js` — lease store + expiry sweeper.
- `src/service/ledger.js` — publish ledger + access log (SQLite, node:sqlite or plain file — decide in implementation).
- `src/service/drift.js` — worktree↔projection divergence reporter.
- `src/service/publish.js` — spec-pack builder + release/attestation wiring.
- `src/service/ops/registry.js`, `drift.js`, `claim.js`, `release.js` — new MCP op handlers.
- `deploy/docker-compose.yml`, `deploy/Dockerfile`, `deploy/config/projects.example.json`.
- `spec-refs.json` schema + `omp spec verify|outdated|install` consumer commands (plugin side).

## Changed

- `plugins/omp-spec-kit/.mcp.json` — remote endpoint mode for managed projects.
- `src/mcp/server.js` — transport split: keep stdio for unmanaged roots; share tool dispatch with HTTP path.
- `src/adapters/tool-contracts.js` — `project` field + new op contracts; KERNEL_SCHEMA_VERSION → `spec-kernel@2`.
- `.github/workflows/verify.yml` — add "no `.specs/` on non-specs branches" check (self-dogfooding after migration).
- Repo settings (out-of-band): `specs` branch ruleset, bot account, path restrictions.

## Deleted

- None. Local stdio MCP remains for unmanaged checkouts.
