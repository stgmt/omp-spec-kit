# Product specification changelog

This file records product-contract history. It does not claim that specification scenarios have executed.

## Unreleased — simplify public status

### Changed

- Replaced historical/current stage rows with one SHIPPED v0.3.2 read-only baseline.
- Replaced the internal roadmap state model with SHIPPED, NEXT, and LATER.
- Collapsed authoring and direct-write protection into one NEXT safe-authoring outcome.
- Reduced future work to plain LATER outcomes.
- Removed duplicated release details, the status-fixture matrix, and the hand-maintained task summary.
- Kept proof-before-SHIPPED, one-product identity, current release proof, and real-fixture provenance.

## Historical product sequence

### Public init

- Began as a specification-first repository.
- Froze imported source bytes, resolved source-owner license evidence, and recorded public-safety and publication receipts.

### v0.1

- Introduced the project-scoped marketplace/plugin distribution identity.

### v0.2

- Added the read-only graph/query kernel inside the same product.

### v0.3 and v0.3.2

- v0.3 introduced the first eight read-only MCP tools.
- v0.3.2 is the current public, project-installable release of `omp-spec-kit@omp-spec-kit`.
- Tag commit, candidate/package/archive digests, release workflow, and attestation receipts are bound by `docs/validation/release-status-v0.3.2.json`.

## Not shipped by v0.3.2

- Safe spec authoring.
- Expanded read queries, editor navigation, evidence queries, impact reporting, and manual exact-content plan validation.
