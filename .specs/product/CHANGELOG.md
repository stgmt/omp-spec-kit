# Product specification changelog

This changelog records changes to the product specification only. It is not the repository release changelog and does not claim that scenarios have run or capabilities are delivered.

## Unreleased — generator-port destination correction

### Added

- `product:FR-9` / `product:AC-9.1` / `@feature9` / `CHK-FR9-01`: destination is the generator-port MCP door; agent inventory is MCP-only; the eight SCHEMA-11 names are the v0.3 first slice; silent DROP of a census row is forbidden.

### Changed

- `product:FR-6` later stages now name generator-port reads (`spec-kernel:FR-16`/`FR-17`), evidence MCP, sibling LSP (not the agent API), and authoring MCP without unlocking authoring as delivered.
- `product:FR-8` owners now include `spec-lsp` and `spec-evidence`; ROADMAP describes v0.3 as the first slice of the generator-port MCP door.

## Unreleased — initial product specification

### Added

- Specification-first public-init contract with an explicit no-installable-plugin statement.
- Immutable source-freeze and per-file provenance/hash requirements.
- Fail-closed redistribution-license gate; the historical upstream root-license evidence gap is now resolved by a separate source-owner MIT attestation tied to the frozen bytes.
- Clean export, prohibited-path, secret-scan, and public-diff review requirements.
- One-product identity across one future marketplace, plugin package, and extension entry.
- Ordered cumulative evidence gates for v0.1.0, v0.2, v0.3, and later authoring/mutation, with typed current-candidate versus v0.2-predecessor evidence: current distribution/current-stage/current-authoring results bind to the current candidate, while a distinct v0.2 artifact is permitted only through the v0.3 kernel result's exact parent SHA, common revision/lineage, strict target-stage order, and non-stale/non-revoked state. Member-subset and latest-only evidence remain insufficient.
- Honest public status vocabulary and refusal to treat BDD/specification text as executed evidence.
- Manager-readable roadmap and canonical cross-spec ownership links.

### Current delivered baseline

- Public repository and source/license/public-safety evidence are recorded.
- `omp-spec-kit@omp-spec-kit` v0.3.2 is public and project-installable.
- The delivered baseline contains the v0.2 graph/query kernel and the eight-tool v0.3 MCP first slice.
- Tag commit, candidate/package/archive digests, lifecycle receipt identities and GitHub release attestation are bound by `docs/validation/release-status-v0.3.2.json`.

### Explicitly not delivered

- Generator-port reads beyond the eight first-slice tools.
- LSP, evidence MCP, capability graph/impact, authoring, enforcement and automatic plan-gate capabilities.
- Automatic plan-gate remains `DEFERRED_HOST_ABI` on pinned OMP v17.3.7.
