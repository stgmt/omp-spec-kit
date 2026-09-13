# File changes (planned)

Status: DRAFT

## New

- `src/service/index.js` — service entrypoint: config load, mount manager, transports.
- `src/service/mounts.js` — single specs-repo clone lifecycle; resolves `owner/project` → project root, creates `.specs` skeletons for new projects.
- `src/service/http.js` — `POST /rpc` + Streamable HTTP MCP transport.
- `src/service/auth.js` — v1 token verifier + identity attribution; YouTrack Hub seam.
- `src/service/claims.js` — lease store + expiry sweeper.
- `src/service/tenants.js` — tenant records, token→tenant→allowed-projects resolution.
- `src/service/onboarding.js` — self-service onboarding API: after YouTrack login, issues tenant + token (agent `.mcp.json` snippet); post-v1 also emits the external-YouTrack install bundle (TASK-13).
- `src/service/ledger.js` — tenants (token→tenant→allowed projects), publish ledger, access log. Store: **`node:sqlite`** (decided); the compose service runs Node with `--experimental-sqlite` (experimental on the pinned Node 22 baseline). JSONL stays the documented fallback if the flag is ever blocked.
- `src/service/drift.js` — clone↔projection divergence reporter.
- `src/service/publish.js` — spec-pack builder + release/attestation wiring.
- `src/service/ops/registry.js`, `drift.js`, `claim.js`, `release.js` — new MCP op handlers.
- `deploy/docker-compose.yml`, `deploy/Dockerfile`, `deploy/config/projects.example.json`.
- `spec-refs.json` schema + `omp spec verify|outdated|install` consumer commands (plugin side).
- `tests/fixtures/registry/**` — fixture set per FIXTURES.md.
- specs-repo root `.gitignore` — excludes `**/.omp-spec-kit-*` transaction artifacts (or a kernel change relocating lock/staging outside `.specs/`).

## Changed

- `plugins/omp-spec-kit/.mcp.json` — remote endpoint mode for managed projects. **Verified** against the pinned OMP schema (`mcp-schema.json` @ 33cc6b9): `serverConfig` accepts `type: "http"` with `url` + `headers` (Streamable HTTP transport), and an `auth` block (`oauth`/`apikey`). No shim needed: `{ "type": "http", "url": "<stack>/mcp", "headers": { "Authorization": "Bearer <token>" } }` is a legal config.
- `src/mcp/server.js` — transport split: keep stdio for unmanaged roots; share tool dispatch with HTTP path.
- `src/adapters/tool-contracts.js` — `project` field + new op contracts.
- `src/kernel/types.js` + `src/kernel/index.js` — `KERNEL_SCHEMA_VERSION` → `spec-kernel@2`; register new error codes (`CLAIM_HELD`, `UNAVAILABLE`, `VERSION_EXISTS`) in the code tables and `WRITE_ERROR_CODES` (with `retryable` classification consistent with `isRetryable`).
- `src/kernel/query/*` — optional `project` plumbed through envelope validation.
- Per-product-repo boundary check (applied when that repo migrates — TASK-14 for this repo): "no root-level `.specs/` on code branches" CI job, anchored at repo root so `tests/fixtures/**/.specs/` stays legal.
- Repo tooling repoint on migration (TASK-14): `scripts/specs-root.mjs` resolver salvaged from closed PR #39 (`OMP_SPEC_KIT_ROOT` → `.specs` → specs-repo clone); corpus checks/dogfood/kernel scripts consume it.
- YouTrack app — new spec view + proposal apply surface (builds on existing `youtrack-projection`/`youtrack-status-sweep` adapters; the interactive UI is new code, coordinated with the owning spec).
- Repo settings (out-of-band): dedicated specs repo + bot account + push ruleset; per-product-repo path checks as each migrates.

## Deleted

- None. Local stdio MCP remains for unmanaged checkouts.
