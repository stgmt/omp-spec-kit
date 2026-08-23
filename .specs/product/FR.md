# Functional requirements

All requirement keywords `SHALL`, `SHALL NOT`, `SHOULD`, and `MAY` are normative. Status `Specified` means the requirement is written; it does not claim implementation or passing evidence.

## FR-1 — Specification-first public init

The product SHALL begin as a specification-only repository containing reviewed product contracts, provenance, migration decisions, and public policies. Until an installable payload is independently proven, the repository SHALL prominently state that no plugin, marketplace catalog, release, or runtime capability is available. Public init SHALL NOT contain an install command, marketplace catalog, plugin package, or release badge that implies otherwise.

- **Stage:** Public init
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-non-installable-init), [AC-1.2](ACCEPTANCE_CRITERIA.md#ac-12-premature-payload-refusal)
- **Scenario trace:** `@feature1`; `SCEN-specification-only-init`; `SCEN-premature-installable-artifact`.
- **Stories/use cases:** US-1; UC-4.

## FR-2 — Immutable source freeze

Every imported upstream file SHALL come only from one immutable source commit via Git-object bytes. The import authority SHALL record source repository, commit, source path, target path, SHA-256, disposition, import status, and license status for every inventoried path. Unmanifested bytes, dirty-worktree bytes, missing paths, and hash mismatches SHALL fail the source-freeze gate. Copied upstream documents SHALL remain byte-preserved reference material and SHALL NOT become the target product source of truth.

- **Stage:** Public init
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-reproducible-source-freeze), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-source-mismatch-refusal)
- **Scenario trace:** `@feature2`; `SCEN-pinned-source-export`; `SCEN-mismatched-imported-byte`.
- **Stories/use cases:** US-2; UC-1.

## FR-3 — Redistribution-license gate

Before public publication, every copied upstream item SHALL have an accepted redistribution basis tied to the exact frozen bytes. A new repository root license SHALL govern only repository-owned material and SHALL NOT relabel imported content. Any unknown, ambiguous, or unresolved imported-material license status SHALL keep publication blocked until an authorized reviewer records sufficient evidence or the affected bytes are removed/replaced.

- **Stage:** Public init
- **Priority:** Must
- **Status:** Specified; public specification-init published with source, license, specification, anchor, candidate safety, and SHA/tree readback evidence; runtime stages remain planned
- **Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-unresolved-license-blocks-publication), [AC-3.2](ACCEPTANCE_CRITERIA.md#ac-32-root-license-does-not-cure-import-gap)
- **Scenario trace:** `@feature3`; `SCEN-unresolved-import-license`; `SCEN-root-license-import-separation`.
- **Stories/use cases:** US-3; UC-2.

## FR-4 — Clean public export and secret gate

The candidate public tree SHALL be assembled from an explicit allowlist of repository-owned paths and manifest-approved imported bytes. It SHALL exclude inherited Git history, credentials, tokens, `.env` material, user configuration/state, logs, caches, temporary files, mutable test evidence, and assets lacking provenance or redistribution approval. The complete candidate tree/history SHALL receive a secret scan and public-diff review; any unresolved finding or unknown path SHALL fail closed before remote creation or push.

- **Stage:** Public init and every release
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-prohibited-public-path-refusal), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42-secret-finding-refusal)
- **Scenario trace:** `@feature4`; `SCEN-prohibited-state-path`; `SCEN-unresolved-secret-finding`.
- **Stories/use cases:** US-4; UC-3.

## FR-5 — One-product identity

The repository SHALL represent one product named `omp-spec-kit`. When distribution is delivered, its canonical installed identity SHALL be `omp-spec-kit@omp-spec-kit` and SHALL satisfy `plugin-distribution:FR-1`: one standalone OMP marketplace, exactly one plugin package, and exactly one extension entry. Later kernel, MCP, guidance, proposal, and mutation capabilities SHALL evolve within that same product identity and SHALL NOT create a second marketplace entry, plugin package, extension control plane, or competing source of truth.

- **Stage:** All
- **Priority:** Must
- **Status:** Specified; distribution not delivered
- **Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-single-product-cardinality), [AC-5.2](ACCEPTANCE_CRITERIA.md#ac-52-identity-continuity-across-stages)
- **Scenario trace:** `@feature5`; `SCEN-single-product-identity`; `SCEN-second-control-plane-refusal`.
- **Stories/use cases:** US-5; UC-5.
- **Canonical dependency:** `plugin-distribution:FR-1`.

## FR-6 — Evidence-gated release stages

The product SHALL advance only through these ordered stages: public init; v0.1.0 read-only inventory; v0.2 bounded graph/query kernel; v0.3 read-only MCP projection over the same query service; and later safe authoring/mutation. Each stage SHALL remain `PLANNED`, `DEFERRED`, or `BLOCKED` until its complete cumulative aggregate gate set has current mandatory evidence for one product revision and artifact lineage. Current distribution evidence and the current target-stage capability evidence SHALL bind to the current candidate artifact:

1. v0.1.0 claims require accepted `plugin-distribution:FR-13`, which aggregates the complete mandatory evidence for `plugin-distribution:FR-1` through `plugin-distribution:FR-12` and binds to the current candidate artifact.
2. v0.2 claims require accepted `plugin-distribution:FR-13` and accepted `spec-kernel:FR-14` with `targetStage: "v0.2"`; both SHALL bind to the current v0.2 candidate artifact.
3. v0.3 claims require accepted `plugin-distribution:FR-13` and accepted `spec-kernel:FR-14` with `targetStage: "v0.3"` bound to the current v0.3 candidate artifact. The required accepted `spec-kernel:FR-14` result with `targetStage: "v0.2"` MAY bind to a distinct predecessor artifact only when the v0.3 result's `v02ParentArtifactSha256` equals that v0.2 artifact SHA-256, both results have the same product revision and `artifactLineageId`, the closed target-stage order is strictly v0.2 before v0.3, and neither result is stale or revoked.
4. authoring/mutation claims require accepted current-candidate `plugin-distribution:FR-13`, accepted current-candidate `spec-kernel:FR-14` with `targetStage: "v0.3"`, accepted current-candidate `spec-authoring-workflow:FR-13`, and the separately identified accepted v0.2 predecessor result linked by the v0.3 result under the rule above.

Evidence for a subset of member requirements SHALL NOT satisfy an aggregate gate. A later aggregate SHALL NOT replace, inherit, or imply an earlier aggregate. The typed, cryptographically linked v0.2 predecessor exception does not permit historical, different-lineage, unlinked, stale, or revoked evidence, and no other aggregate may bind away from the current candidate artifact. No stage SHALL inherit `DELIVERED` status from a roadmap entry, tag, document, structural validation, historical stage result, or green subset.

- **Stage:** All
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-stage-cannot-advance-with-missing-evidence), [AC-6.2](ACCEPTANCE_CRITERIA.md#ac-62-ordered-cross-spec-stage-gates)
- **Scenario trace:** `@feature6`; `SCEN-incomplete-aggregate-remains-planned`; `SCEN-owning-aggregate-cannot-be-bypassed`.
- **Stories/use cases:** US-6; UC-5.

## FR-7 — Honest public status and claims

Every public status summary SHALL identify the product stage, conservative state, product revision, current candidate artifact, artifact lineage, typed current-versus-predecessor evidence bindings, evidence timestamp, unresolved blockers, and next gate. Allowed capability states are `SPEC_ONLY`, `PLANNED`, `DEFERRED`, `BLOCKED`, and `DELIVERED`. For non-public-init stages, `DELIVERED` SHALL require accepted results for every aggregate in the stage's cumulative gate set. Current distribution, current target-stage kernel capability, and current authoring evidence SHALL bind to the status candidate artifact. A v0.2 kernel predecessor MAY bind to another artifact only through the exact `v02ParentArtifactSha256` link, common lineage/revision, strict v0.2-before-v0.3 order, and non-stale/non-revoked conditions in FR-6; selected member evidence, only the latest aggregate, or an untyped artifact reference is insufficient. Missing, stale, revoked, failed, contradictory, claimed-only, wrong-target-stage, parent-mismatched, or cross-lineage evidence SHALL produce the most conservative non-delivered state. Imported scenarios, specification text, task completion marks, and structural validation SHALL NOT be represented as executed evidence.

- **Stage:** All
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-fail-closed-status), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72-bdd-text-is-not-execution-evidence)
- **Scenario trace:** `@feature7`; `SCEN-status-fails-closed`; `SCEN-unexecuted-bdd-not-evidence`.
- **Stories/use cases:** US-1, US-6; UC-6.

## FR-8 — Manager-readable roadmap and boundaries

Public product documentation SHALL distinguish current delivery, planned stages, deferred scope, blockers, and stage exit evidence in manager-readable language. It SHALL link each delegated contract to its canonical owning spec rather than duplicating internals: distribution to `plugin-distribution`, read-only inventory/kernel/query to `spec-kernel`, and authoring/mutation to `spec-authoring-workflow`. The roadmap SHALL keep advisor, hooks, dashboards, backlog, persistence, repair, model judging, proxy, context/memory, auto-commit, and generic dev-pomogator harness machinery outside the public-init/v0.1.0 boundary.

- **Stage:** All
- **Priority:** Should
- **Status:** Specified
- **Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-roadmap-separates-state), [AC-8.2](ACCEPTANCE_CRITERIA.md#ac-82-canonical-boundary-links)
- **Scenario trace:** `@feature8`; `SCEN-roadmap-separates-states`; `SCEN-canonical-owner-delegation`.
- **Stories/use cases:** US-7; UC-4, UC-5.
