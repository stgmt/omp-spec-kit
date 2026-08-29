# Acceptance criteria

These are specification criteria. Their matching Gherkin scenarios are unexecuted specification text and SHALL NOT be reported as passing evidence.

## FR-1 — Specification-first public init

### AC-1.1 — Non-installable init

**WHEN** a reader opens the public-init README **THEN** it SHALL explicitly say that no installable plugin, marketplace catalog, package, release, or runtime capability exists, and SHALL distinguish the current specification-only state from planned releases.

**Scenario:** `@feature1`, `@id:SCEN-specification-only-init` — “Specification-only init reports no installable plugin”.

### AC-1.2 — Premature payload refusal

**IF** the candidate public-init tree contains a marketplace catalog, plugin package, install command presented as usable, or release badge implying availability **THEN** the public-init eligibility result SHALL be `BLOCKED` and SHALL identify the premature claim/artifact.

**Scenario:** `@feature1`, `@id:SCEN-premature-installable-artifact` — “Premature installable artifact blocks public init”.

## FR-2 — Immutable source freeze

### AC-2.1 — Reproducible source freeze

**WHEN** the approved export is reconstructed from the recorded source repository and immutable commit **THEN** every inventoried source path SHALL have repository, commit, source path, target path or exclusion, SHA-256, disposition, import status, and license status, and every copied target SHALL match its recorded hash.

**Scenario:** `@feature2`, `@id:SCEN-pinned-source-export` — “Pinned source export is reproducible”.

### AC-2.2 — Source mismatch refusal

**IF** any copied target differs from its recorded source-object bytes, a copied path is unmanifested, or extraction reads the mutable working tree **THEN** source-freeze eligibility SHALL fail before publication and report the affected path.

**Scenario:** `@feature2`, `@id:SCEN-mismatched-imported-byte` — “A mismatched imported byte blocks publication”.

## FR-3 — Redistribution-license gate

### AC-3.1 — Unresolved license blocks publication

**IF** any copied imported item has an unknown, ambiguous, or unresolved redistribution basis **THEN** publication status SHALL remain `NOT_READY_FOR_PUBLICATION` and SHALL name removal/replacement or an authorized decision as remediation.

**Scenario:** `@feature3`, `@id:SCEN-unresolved-import-license` — “Unresolved imported license status blocks publication”.

### AC-3.2 — Root license does not cure import gap

**WHEN** a new repository root license is present **THEN** it SHALL apply only to repository-owned material and SHALL NOT change the recorded license status of imported bytes without a separate authorized evidence record.

**Scenario:** `@feature3`, `@id:SCEN-root-license-import-separation` — “New material license cannot relabel an import”.

## FR-4 — Clean public export and secret gate

### AC-4.1 — Prohibited public path refusal

**IF** the candidate public tree/history contains credentials, `.env` material, user state, logs, caches, temporary files, mutable test evidence, inherited Git history, private machine paths, or an unapproved asset **THEN** public eligibility SHALL fail and identify the prohibited path/class.

**Scenario:** `@feature4`, `@id:SCEN-prohibited-state-path` — “A prohibited state path blocks the clean export”.

### AC-4.2 — Secret finding refusal

**IF** the complete candidate scan contains any unresolved secret finding **THEN** remote creation/push SHALL remain blocked; an exception SHALL be accepted only when it records the exact finding, bytes/revision, reviewer, rationale, and disposition.

**Scenario:** `@feature4`, `@id:SCEN-unresolved-secret-finding` — “An unresolved secret finding blocks publication”.

## FR-5 — One-product identity

### AC-5.1 — Single product cardinality

**WHEN** the first distribution candidate is evaluated **THEN** product identity SHALL be `omp-spec-kit`, installed identity SHALL be `omp-spec-kit@omp-spec-kit`, and `plugin-distribution:FR-1` SHALL report exactly one marketplace, one plugin package, and one extension entry.

**Scenario:** `@feature5`, `@id:SCEN-single-product-identity` — “Future distribution preserves one product identity”.

### AC-5.2 — Identity continuity across stages

**IF** a later kernel, MCP, guidance, proposal, or mutation stage introduces a second marketplace entry, plugin package, extension control plane, or competing source of truth **THEN** the product-stage gate SHALL fail and cite the conflicting identity.

**Scenario:** `@feature5`, `@id:SCEN-second-control-plane-refusal` — “A second product control plane is refused”.

## FR-6 — Evidence-gated release stages

### AC-6.1 — Stage cannot advance with missing evidence

**IF** any aggregate required by the proposed stage's cumulative gate set is missing, stale, revoked, failed, contradictory, claimed-only, wrong-target-stage, bound to another artifact lineage, bound away from the current candidate without the permitted typed predecessor role, parent-SHA mismatched, or lacks any mandatory member evidence **THEN** the stage SHALL remain `PLANNED`, `DEFERRED`, or `BLOCKED`, the last proven stage SHALL remain authoritative, and `DELIVERED` SHALL be refused.

**Scenario:** `@feature6`, `@id:SCEN-incomplete-aggregate-remains-planned` — “A stage with missing evidence remains planned”.

### AC-6.2 — Baseline and capability gates cannot be bypassed

**WHEN** delivery is evaluated **THEN** baseline v0.1/v0.2/v0.3 SHALL require the exact aggregates in `product:FR-6`; each post-v0.3 capability SHALL additionally require only its closed `CapabilityDelivery.requiredAggregateIds`; accepting the baseline or one sibling capability SHALL NOT imply another capability; automatic plan gate SHALL remain `DEFERRED_HOST_ABI` until the selected-plan host event is accepted; spec enforcement SHALL remain `DEFERRED_HOST_ABI` until `spec-enforcement:CHK-FR1-01` proves authenticated tool-call provider/server/schema identity; AND every current record SHALL bind to the evaluated candidate except the explicitly admitted active v0.2 predecessor.

**Scenario:** `@feature6`, `@id:SCEN-owning-aggregate-cannot-be-bypassed` — “A baseline or capability cannot bypass its exact aggregate set”.

## FR-7 — Honest public status and claims

### AC-7.1 — Fail-closed status

**WHEN** public status is rendered **THEN** it SHALL include stage, conservative state, product revision, current candidate artifact/lineage binding, typed binding role for each evidence reference, the linked v0.2 predecessor artifact where applicable, evidence timestamp, revocation state, blockers, and next gates; a non-public-init stage SHALL identify every aggregate in its cumulative gate set, and absent, invalid, incomplete, member-subset, wrong-target-stage, current-artifact-mismatched, parent-SHA-mismatched, stale, revoked, or cross-lineage evidence SHALL never result in `DELIVERED`.

**Scenario:** `@feature7`, `@id:SCEN-status-fails-closed` — “Status fails closed when evidence is missing”.

### AC-7.2 — BDD text is not execution evidence

**WHEN** a scenario exists without a current executed result tied to the same revision and requirement **THEN** it SHALL be labeled specification text only and SHALL contribute no passing/delivered claim.

**Scenario:** `@feature7`, `@id:SCEN-unexecuted-bdd-not-evidence` — “Unexecuted BDD cannot produce a delivered claim”.

## FR-8 — Manager-readable roadmap and boundaries

### AC-8.1 — Roadmap separates state

**WHEN** README/ROADMAP/current status are read **THEN** v0.3.2 baseline and exactly seven capability rows SHALL use the closed state enum, exact owner/aggregate tuples, evidence/blockers/next gates, and excluded scope consistently.

**Scenario:** `@feature8`, `@id:SCEN-roadmap-separates-states` — “Roadmap separates delivered planned deferred and blocked”.

### AC-8.2 — Canonical boundary links

**WHEN** product documents refer to any of the seven sibling capabilities or baseline owners **THEN** qualified canonical IDs and the exact product_SCHEMA aggregate maps SHALL be used without duplicating sibling internals.

**Scenario:** `@feature8`, `@id:SCEN-canonical-owner-delegation` — “Product spec delegates internals to canonical owners”.

## FR-9 — Generator-port MCP destination

### AC-9.1 — Census-owned MCP-only first slice

**WHEN** the product destination is evaluated **THEN** the closed 46-name census SHALL exist with every row owned, the agent-facing inventory SHALL be MCP-only with no host `lsp` spec tool, and documents that mention the eight-tool registry SHALL call it the first slice or v0.3 candidate.

**Scenario:** `@feature9`, `@id:SCEN-generator-port-destination` — “Generator-port destination is MCP with a 46-row census”.

## Trace summary

| Requirement | Acceptance | Feature tag | Stable scenario IDs | Scenario count |
|---|---|---|---|---:|
| `product:FR-1` | `product:AC-1.1`, `product:AC-1.2` | `@feature1` | `SCEN-specification-only-init`, `SCEN-premature-installable-artifact` | 2 |
| `product:FR-2` | `product:AC-2.1`, `product:AC-2.2` | `@feature2` | `SCEN-pinned-source-export`, `SCEN-mismatched-imported-byte` | 2 |
| `product:FR-3` | `product:AC-3.1`, `product:AC-3.2` | `@feature3` | `SCEN-unresolved-import-license`, `SCEN-root-license-import-separation` | 2 |
| `product:FR-4` | `product:AC-4.1`, `product:AC-4.2` | `@feature4` | `SCEN-prohibited-state-path`, `SCEN-unresolved-secret-finding` | 2 |
| `product:FR-5` | `product:AC-5.1`, `product:AC-5.2` | `@feature5` | `SCEN-single-product-identity`, `SCEN-second-control-plane-refusal` | 2 |
| `product:FR-6` | `product:AC-6.1`, `product:AC-6.2` | `@feature6` | `SCEN-incomplete-aggregate-remains-planned`, `SCEN-owning-aggregate-cannot-be-bypassed` | 2 |
| `product:FR-7` | `product:AC-7.1`, `product:AC-7.2` | `@feature7` | `SCEN-status-fails-closed`, `SCEN-unexecuted-bdd-not-evidence` | 2 |
| `product:FR-8` | `product:AC-8.1`, `product:AC-8.2` | `@feature8` | `SCEN-roadmap-separates-states`, `SCEN-canonical-owner-delegation` | 2 |
| `product:FR-9` | `product:AC-9.1` | `@feature9` | `SCEN-generator-port-destination` | 1 |
