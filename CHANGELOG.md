# Changelog

All notable changes to `omp-spec-kit`. Claims are limited to recorded evidence.
## 0.8.0 — unreleased

Consolidated 11-tool surface minor: 49/38 tools cut to 11 task-oriented tools with discriminated branches, zero compatibility shims, and fail-closed surface blast limits.

### Removed

- Hard-cut of 27 superseded tools without backward-compatibility shims: all legacy read, navigation, and mutation facade tools excised from runtime discovery and handlers.
- Release-stage abstraction (`OMP_SPEC_KIT_STAGE`): single 11-tool surface with no compatibility stages.

### Added

- Consolidated 11 tools: `mcp_preflight`, `spec_catalog`, `spec_entities`, `spec_graph`, `spec_documents`, `spec_inspect`, `spec_tasks`, `spec_evidence`, `spec_markdown`, `spec_propose_patch`, `apply_proposed_patch`.
- Discriminated `oneOf` input schemas with `additionalProperties: false` and strict validation rejecting cross-branch and unknown fields.
- Authoritative domain type dictionary via `spec_catalog(view: "types")` returning 15 entity kinds and 7 edge types.
- Fail-closed surface blast measurement script (`scripts/measure-mcp-tool-blast.mjs`) verifying <= 25,499 bytes catalog size, <= 2,000 description characters, and zero retired tool names.
- Deterministic in-memory mutation testing gate (`scripts/check-tool-surface-mutations.mjs`) requiring zero surviving mutants.
## 0.7.0 — 2026-09-04

Hardened safe-authoring minor for OMP 18.0.11. Same 49-tool surface as v0.6.0; no tool added or removed.

### Added

- Windows read selectors are a documented gate feature: `:1`, `:1-2`, `:1+2`, `:1-`, `:1..2`, comma lists, `L`-prefixed numbers, `:raw`, `:conflicts`, and `raw:<range>` / `<range>:raw` combos. Selectors strip only for `read`; `write` and other mutators receive no stripping. `:0` and malformed selectors fall through to normal containment.
- Execution-payload specification guard: recursive inspection of `code` and `command` values for an obvious `.specs` path segment, blocked with `RAW_SPEC_WRITE` for eval, context-mode, and shell calls. Lexical guard, not a shell parser; dynamically assembled paths are an explicit non-goal.
- `spec-mcp-access-gate` FR-8/FR-9 with AC-8.1/AC-9.1, requirements trace, and BDD `read-selectors` / `execution-edges` matrices (now with `L`-prefix, list, and nested-payload cases).

### Fixed

- `src/adapters/document-service.js` reported `plugin: "0.5.0"`; now follows the package version (`0.7.0`).
- `spec-mcp-access-gate` README and FILE_CHANGES no longer reference deleted `audit-reports/` paths; they point at `docs/validation/release-status-v0.6.0.json` and pinned OMP sources.
- `spec-mcp-access-gate` TASK-5/TASK-6 headings use canonical `TASK-N:` form so status transitions parse.
- `toolContractsForStage` accepts the `v0.7.0` stage alongside `v0.6.0`; launchers, MCP server, classifier default, and dogfood accept `v0.7.0` with `v0.6.0` retained for backward compatibility.

### Removed

- Local-only `audit-reports/` (13 tracked files), reference `package/package.json`, and the unconnected `src/hooks/skill-gate.js` + `tests/enforcement/skill-gate-live-omp.test.mjs` prototype pair. No runtime, build, or CI input referenced them.

## 0.6.0 — 2026-09-02

Safe-authoring release for OMP 18.0.11 (shipped; changelog entry recorded retroactively in 0.7.0).

- Single 49-tool MCP server with enforcement-only extension; proposal-first mutations with CAS, atomic apply, and rollback.
- Strict `.specs` access gating for non-MCP reads, searches, enumeration, shell, edits, and writes.
- Published release proof: `docs/validation/release-status-v0.6.0.json`.

## 0.5.4 — 2026-09-02

Corrective release: accurate evidence and navigation release notes.

- Generates release notes for the actual additive v0.5 27-tool surface instead of the superseded ten-tool text.
- Keeps published candidate, archive, evidence, and tag identities in the release receipt.

## 0.5.3 — 2026-09-02

Corrective release: clean-checkout publication and deterministic E2E proof.

- Tracks the repository-owned evidence fixtures required by archive verification.
- Makes installed-version assertions follow the package version instead of a stale literal.
- Gives the complete tool-E2E staged scenarios a bounded runtime in CI.

## 0.5.2 — 2026-09-02

Corrective release for the v0.5 evidence and navigation surface.

- Tracks the repository-owned passing, failed, and incomplete evidence fixtures required by the complete tool-E2E matrix and release archive smoke.
- Fixes clean-checkout release verification so the official GitHub workflow can build, attest, and publish the exact candidate archive.


## 0.5.0 — 2026-09-01

Evidence and navigation release candidate for OMP 18.0.11.

- Adds an additive 27-tool direct MCP surface: the v0.4.1 ten-tool compatibility profile, 15 bounded navigation/validation tools, and get_test_result plus get_scenario_trace.
- Keeps evidence storage and parsing repository-owned, with SHA-256 source identity and graph/scenario binding that rejects stale passing evidence after corpus mutation.
- Verifies passing, failed, incomplete, unknown, invalid-input, safe-authoring apply, and stale-conflict paths against a disposable real specification corpus.
## 0.4.1 — 2026-09-01

Corrective safe-authoring release for OMP 18.0.11; v0.4.0 is superseded because the normal shipped launcher exposed the historical eight-tool profile unless an ambient stage variable was injected.

### Fixed

- Shipped POSIX and Windows launchers select the v0.4.1 ten-tool surface themselves; OMP extension discovery and direct server startup also default to v0.4.1 when no stage override is present.
- Added an exact-release-archive smoke that extracts the candidate archive, unsets OMP_SPEC_KIT_STAGE, OMP_SPEC_KIT_PACKAGE_ROOT, and OMP_SPEC_KIT_ROOT, exercises JSON-RPC, and rejects unsolicited stdout.
- Release verification now runs release-integrity BDD, verifies GitHub artifact attestations with gh attestation verify, binds distribution evidence to the peeled tag commit, and compares existing releases against the peeled tag commit rather than GitHub targetCommitish metadata.

## 0.4.0 — 2026-09-01

Published safe-authoring release for OMP `18.0.11`; v0.3.2 remains the read-only predecessor.

- Keeps the eight bounded read tools and adds exactly two proposal-first tools: `propose_patch` and `apply_proposed_patch`.
- Adds deterministic proposal preview, approval-bound apply, document-level CAS, replay-safe receipts, rollback-on-failure, and strict `.specs` access gating.
- Verifies a provenance-bound 45-document corpus, installed OMP manager execution, lifecycle install/upgrade/rollback producers, Docker BDD, nine closed MRI receipts, and digest-bound GitHub release assets.
- Published release proof: `docs/validation/release-status-v0.4.0.json`.

## Unreleased

No unreleased changes recorded.

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
