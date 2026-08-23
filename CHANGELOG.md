# Changelog

All notable changes to `omp-spec-kit`. Claims are limited to recorded evidence.

## 0.1.0 — 2026-08-23

First installable release: one OMP marketplace, one plugin package, one extension entry, one read-only tool.

### Added

- `spec_inventory` — bounded, read-only inventory of direct `.specs` children in the active project: lexical order, canonical 15-document accounting, hard caps (200 specs / 100 diagnostics), symlink/escape refusal, abort support, zero writes.
- `.omp-plugin/marketplace.json` root catalog with the single `omp-spec-kit` plugin entry (`./plugins/omp-spec-kit`, `0.1.0`).
- Plugin guidance: `skills/spec-inventory/SKILL.md` and `commands/spec-inventory.md`.
- Deterministic build (`scripts/build-plugin.mjs`) with committed, hash-manifested `dist/` payload; closed validators for catalog, package, and release consistency (`scripts/verify-*.mjs`).
- Docker-only Cucumber suite (`scripts/docker-bdd.sh`): 17 scenarios / 105 steps, including read-only byte-preservation, bounds/conservation, failure containment, symlink-swap refusal, strict request rejection, and built-extension registration/execution.
- GitHub Actions `verify` (PR/push) and tag-gated `release` workflow with idempotent, commit-bound publishing.

### Evidence

- Installed lifecycle bound to release commit `a959a1af3abeb1fc61eefda48b011a6470a6d621`: clean install → fresh-session invocation (`pluginVersion 0.1.0`, `status ok`) → uninstall (fresh-session tool absence) → exact-candidate reinstall → re-invocation; user-owned bytes preserved throughout. See `docs/validation/distribution-lifecycle.md`.
- First release: prior-version upgrade/rollback is inapplicable by contract.

### Not in this release

- No graph/query kernel, MCP server, authoring, mutation, CAS, or write capability. These are separately gated stages (`ROADMAP.md`).
