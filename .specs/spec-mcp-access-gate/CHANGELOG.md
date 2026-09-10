# Changelog

## Unreleased

- FR-8/AC-8.1: widened win32 read-selector stripping from `read` alone to every read-only path tool (`read`, `grep`, `glob`). The original wording made `grep`/`glob` block a selector path that `read` accepted; mutators still receive no stripping, so alternate-data-stream rejection is unchanged.
- FR-5/AC-5.1: a block SHALL name the target that produced the decision and never one that resolved. `TARGET_INDETERMINATE` now names the rejected target verbatim when it is repository-relative, because no normalized target exists for it.
- Replaced the rejected multi-layer enforcement design with one current `tool_call` path policy.
- Reduced the public authoring exception to exactly `propose_patch` and `apply_proposed_patch`.
- Defined the closed decision: canonical `.specs` root/descendant blocks, proven outside allows, and indeterminate containment blocks.
- Retained cross-platform canonical containment, bounded repository-relative reasons, real fixture provenance, and one-factory bundling.
- Removed every unrelated runtime subsystem and dedicated publication path from the planned capability.

## 2026-08-23 — Specification init

- Created the initial future specification for protecting `.specs` writes in the existing OMP extension.
- Recorded current OMP `tool_call` block semantics and self-contained distribution constraints.
- Historical public v0.3.2 read-only release evidence remains unchanged; this future specification does not reinterpret it.

## Consolidation

- Reframed direct-write enforcement as a full agent-mediated MCP access gate.
- Preserved the original six enforcement requirements and scenarios.

## Unreleased — 11-tool consolidation

- Updated authoring allowlist and recovery redirect to `spec_patch` for the consolidated 10-tool MCP surface.
