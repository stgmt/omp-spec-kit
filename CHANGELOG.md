# Changelog

All notable changes to `omp-spec-kit`. Claims are limited to recorded evidence.

## Unreleased

v0.4.0 candidate preparation; v0.3.2 remains the only published package baseline.

- Pins the candidate discovery runtime to OMP `18.0.11` at immutable commit `33cc6b9a043a74e00a157e72ca909272796d8461`.
- Keeps the eight-tool read-only MCP surface and exposes exactly two safe-authoring tools: `propose_patch` and `apply_proposed_patch`.
- Adds deterministic proposal preview, approval-bound apply, document-level CAS, replay-safe receipts, rollback-on-failure, and strict spec-target access gating.
- Adds a provenance-bound 45-document corpus, live authoring/access BDD scenarios, and tag-time capture of the real OMP manager-handoff receipt.
- Publication remains fail-closed until the v0.4.0 tag, runtime receipt, lifecycle producers, Docker BDD, and attested evidence exist.

## 0.3.2 — 2026-08-28

Honesty follow-up on the public v0.3.1 release. Upgrade from v0.3.0 and rollback to v0.3.0 remain required.

### Fixed

- Release receipts for the GitHub Actions transaction, evidence honesty, and schema containment now require real producers; local runs omit those cells instead of inventing a pass.
- Rollback now proves the project tree hash is unchanged, the same way upgrade already did.
- Published GitHub release files are attested: the archive, candidate manifest, and evidence record.

## 0.3.1 — 2026-08-27

First public corrective release after the v0.3.0 MCP project-root defect.

### Fixed

- MCP package launch now preserves the active OMP project cwd rather than forcing package cwd.
- Invalid JSON-RPC request objects receive terminal `-32600` responses.
- Candidate verification binds package tree/archive bytes, peeled tag, Cucumber messages, public safety, lifecycle, and requirement receipts.

### Advisory

- v0.3.0 MCP results are superseded for the active-project-root defect; see `docs/advisories/v0.3.0-mcp-root.md`.


## 0.2.0 — 2026-08-23

Read-only specification kernel: parse, identity, graph, and bounded query over a repository's `.specs` corpus.

### Added

- `src/kernel/**` (shipped as `dist/kernel/**`): role-aware Markdown/Gherkin parsers (FR/AC/TASK definitions in owning documents only), lossless duplicate election, typed edge resolution, conservation invariants, complete GLFM heading/anchor/link inventory with collision-safe `glfm-anchor@1` allocation, eight-operation fail-closed query service (`inventory`, `getNode`, `findNodes`, `getEdges`, `trace`, `diagnostics`, `overview`, `markdownInventory`) with fingerprint-bound cursors, and a contained filesystem reader that refuses symlinks/junctions before any content read.
- Kernel Docker BDD suite: real-corpus determinism (60 docs / 48 FR / 725 headings / 431 links vs an independently captured manifest), adversarial anchors, duplicate election, typed diagnostics, fail-closed envelopes, junction refusal, pagination bounds.
- v0.2.0 lifecycle evidence: `docs/validation/distribution-lifecycle-v0.2.0.md` (payload digest `e7106747…c1e`).

### Fixed

- Parser correctness from adversarial review: underscore-preserving heading anchors, `mailto:` autolinks, empty inline destinations, fragment-only self-links, absolute structured-field spans, Setext 1+ underlines, post-fence indented code, junction refusal before read, `INVALID_PARAMETER` page bounds.

### Not in this release

- MCP projection (v0.3), authoring/mutation (later). `spec_inventory` v0.1 behavior is unchanged apart from the version constant.

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
