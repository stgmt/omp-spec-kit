# Specification Changelog

## Unreleased — Practical release contract

- Removed the forward `distribution-release-eligibility@2` ABI and its arbitrary matrices, counters, and per-FR receipt envelope.
- Removed internal evidence-subject attestation and re-verification from the forward path.
- Delegated marketplace/extension/MCP schemas to OMP and inventory/query schemas to the kernel.
- Scoped topology checks to the uniquely named `omp-spec-kit` entry and its contained child; unrelated repository entries are allowed.
- Replaced global status policing with one compact distribution-owned status record.
- Defined one forward path: build tagged bytes once, run named checks, publish the same digest, and create one final GitHub Artifact Attestation for the public archive.

## SHIPPED — v0.3.2

The public release remains unchanged. `docs/validation/release-status-v0.3.2.json` records tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`, package-tree digest `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`, archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`, lifecycle receipt identities, and the public release attestation.

## Historical receipt policy

Historical v0.1, v0.2, v0.3, and v0.3.2 contracts and receipts are immutable audit evidence. The delivered `omp-spec-kit-release-evidence@3`, `public-release-eligibility@1`, distribution-evidence subject, and its attestation describe those releases only. They are not required shapes or a double-attestation chain for the next release.

---

## Product lifecycle domain (merged)

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

---

## MCP release-integrity domain (merged)

## 2026-08-24 — Initial remediation

- Defined active-project launch, terminal protocol responses, installed eight-tool verification, deterministic candidate bytes, and v0.3.0 advisory behavior.

## 2026-08-29 — v0.3.2 evidence reconciliation

- Bound public status to immutable tag, candidate, package-tree, archive, release-note, and attestation evidence.
- Preserved the real Docker Cucumber stream and closed source provenance without relabeling historical bytes.

## 2026-08-29 — Contract simplification

- Replaced manager/provider topology receipts and nested MRI/distribution/public eligibility schemas with black-box installed behavior and one compact future candidate run.
- Removed fixed scenario/pickle/CHK counters, distribution claim matrices, detailed Cucumber error ABI, lifecycle receipt key sets, private launcher environment ABI, secret categories, and future registry conservation.
- Kept active-project behavior, protocol recovery, the exact historical eight tools, real unfiltered producer evidence, real fresh-session lifecycle journeys, deterministic contained bytes, same-digest publication, public guidance, and immutable v0.3.2 readers.

## Unreleased — Root provenance hardening

- Added a response-source contract for the stdio MCP and OMP extension surfaces.
- Made explicit absolute-root overrides visible through opaque root identities and `matchesActiveProject`.
- Required the legacy inventory tool and seven query tools to share one resolved root context.
- Added regression scenarios for two-root MCP responses and mixed-cwd extension execution.
## Unreleased — 11-tool consolidation

- Updated safe authoring public mutation name from `propose_patch` to `spec_propose_patch`.
- Added release evidence requirement FR-26 for the consolidated 11-tool MCP surface.
