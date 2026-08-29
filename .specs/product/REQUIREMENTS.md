# Product requirements index

## Status semantics

These requirements are approved specification intent, not implementation status. `Specified` means the contract exists. It does not mean its acceptance scenarios have run or passed.

## Requirement inventory

| ID | Title | Priority | Stage | Status | Acceptance | Scenario |
|---|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-specification-first-public-init) | Specification-first public init | Must | Public init | Specified | [AC-1.1–1.2](ACCEPTANCE_CRITERIA.md#ac-11-non-installable-init) | `@feature1` |
| [FR-2](FR.md#fr-2-immutable-source-freeze) | Immutable source freeze | Must | Public init | Specified | [AC-2.1–2.2](ACCEPTANCE_CRITERIA.md#ac-21-reproducible-source-freeze) | `@feature2` |
| [FR-3](FR.md#fr-3-redistribution-license-gate) | Redistribution-license gate | Must | Public init | Specified | [AC-3.1–3.2](ACCEPTANCE_CRITERIA.md#ac-31-unresolved-license-blocks-publication) | `@feature3` |
| [FR-4](FR.md#fr-4-clean-public-export-and-secret-gate) | Clean public export and secret gate | Must | Public init | Specified | [AC-4.1–4.2](ACCEPTANCE_CRITERIA.md#ac-41-prohibited-public-path-refusal) | `@feature4` |
| [FR-5](FR.md#fr-5-one-product-identity) | One-product identity | Must | All | Specified | [AC-5.1–5.2](ACCEPTANCE_CRITERIA.md#ac-51-single-product-cardinality) | `@feature5` |
| [FR-6](FR.md#fr-6-evidence-gated-release-stages) | Evidence-gated release stages | Must | All | Specified | [AC-6.1–6.2](ACCEPTANCE_CRITERIA.md#ac-61-stage-cannot-advance-with-missing-evidence) | `@feature6` |
| [FR-7](FR.md#fr-7-honest-public-status-and-claims) | Honest public status and claims | Must | All | Specified | [AC-7.1–7.2](ACCEPTANCE_CRITERIA.md#ac-71-fail-closed-status) | `@feature7` |
| [FR-8](FR.md#fr-8-manager-readable-roadmap-and-boundaries) | Manager-readable roadmap and boundaries | Should | All | Specified | [AC-8.1–8.2](ACCEPTANCE_CRITERIA.md#ac-81-roadmap-separates-state) | `@feature8` |
| [FR-9](FR.md#fr-9-generator-port-mcp-destination) | Generator-port MCP destination | Must | All | Specified | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-census-owned-mcp-only-first-slice) | `@feature9` |

## Contract cards

### product:FR-1

- **Rationale:** public development must begin with explicit promises and an unmistakable absence-of-runtime statement.
- **Risk if omitted:** repository presence and BDD prose are misread as an installable release.
- **Verification mode:** public-tree inspection plus logged-out public-page review after publication is authorized.
- **Evidence demand:** current candidate-tree report and visible README status; not a scenario file alone.
- **Acceptance:** `product:AC-1.1`, `product:AC-1.2`.
- **Scenario:** `@feature1`.
- **Task:** `product:TASK-1`.

### product:FR-2

- **Rationale:** immutable provenance prevents dirty-worktree contamination and makes every import reproducible.
- **Risk if omitted:** copied bytes cannot be attributed or independently checked.
- **Verification mode:** reconstruct export from the recorded Git object and compare every copied SHA-256.
- **Evidence demand:** per-file manifest plus actual zero-mismatch run.
- **Acceptance:** `product:AC-2.1`, `product:AC-2.2`.
- **Scenario:** `@feature2`.
- **Task:** `product:TASK-2`.

### product:FR-3

- **Rationale:** the root license for new material cannot silently cure an upstream redistribution gap.
- **Risk if omitted:** public history may redistribute material without established rights.
- **Verification mode:** authorized legal/provenance decision over every copied item.
- **Evidence demand:** durable decision record identifying covered bytes and reviewer authority.
- **Acceptance:** `product:AC-3.1`, `product:AC-3.2`.
- **Scenario:** `@feature3`.
- **Task:** `product:TASK-3`.

### product:FR-4

- **Rationale:** a fresh public repository must exclude credentials and private/local runtime material.
- **Risk if omitted:** irreversible disclosure or unreviewable public history.
- **Verification mode:** path allowlist, complete secret scan, and public diff review.
- **Evidence demand:** zero unresolved findings with exact candidate revision.
- **Acceptance:** `product:AC-4.1`, `product:AC-4.2`.
- **Scenario:** `@feature4`.
- **Task:** `product:TASK-4`.

### product:FR-5

- **Rationale:** users should recognize one evolving product rather than multiple competing plugin/control-plane identities.
- **Risk if omitted:** discovery, activation, version, and support claims drift across packages.
- **Verification mode:** cardinality and identity evidence owned by `plugin-distribution:FR-1`.
- **Evidence demand:** exactly one marketplace, plugin package, and extension entry when distribution exists.
- **Acceptance:** `product:AC-5.1`, `product:AC-5.2`.
- **Scenario:** `@feature5`.
- **Task:** `product:TASK-5`.

### product:FR-6

- **Rationale:** each release stage must advance only after its complete cumulative set of externally observable aggregate contracts is proven for one artifact lineage, while permitting the specifically linked v0.2 predecessor artifact to differ from a later current candidate.
- **Risk if omitted:** requiring one artifact hash across all stages makes legitimate v0.2→v0.3 evolution impossible; accepting an untyped or merely same-lineage predecessor lets a later aggregate launder a missing or unrelated distribution/kernel gate.
- **Verification mode:** stage-specific cumulative evidence review: v0.1.0 uses historical `distribution-release-eligibility@1` owned by `plugin-distribution:FR-13`; v0.2/v0.3 use their candidate-applicable historical distribution profile plus the typed kernel stages; every new post-repair candidate uses `distribution-release-eligibility@2`. Product composition always occurs here; authoring/enforcement delivery additionally requires the joint same-candidate tuple `spec-evidence:FR-13`, `spec-evidence:FR-14`, `spec-authoring-workflow:FR-13`, `spec-authoring-workflow:FR-14`, and `spec-enforcement:FR-11`.
- **Evidence demand:** accepted complete mandatory member/dependency evidence for every cumulative aggregate; current distribution/current-stage/current-authoring results bound to the current candidate; the exact ordered v0.2/v0.3 target-stage/profile pair sharing product revision and lineage; exact parent-SHA equality; and non-stale/non-revoked results. Latest-only, member-subset, historical, unlinked, wrong-target-stage, and cross-lineage evidence are insufficient.
- **Acceptance:** `product:AC-6.1`, `product:AC-6.2`.
- **Scenario:** `@feature6`.
- **Task:** `product:TASK-6`.

### product:FR-7

- **Rationale:** status must communicate delivered reality and blockers without laundering plans, imports, or stale evidence.
- **Risk if omitted:** consumers act on capabilities that do not exist or no longer work.
- **Verification mode:** compare every public claim to every aggregate in its cumulative gate set, the typed evidence binding role, current candidate artifact, linked v0.2 predecessor where applicable, artifact lineage, freshness/revocation state, and blocker set.
- **Evidence demand:** status record with stage, state, product revision, current candidate artifact/lineage identity, typed `CURRENT_CANDIDATE`/`PREDECESSOR_V0_2` evidence references, exact `v02ParentArtifactSha256`, evidence timestamps and revocation state, blockers, and next gates.
- **Acceptance:** `product:AC-7.1`, `product:AC-7.2`.
- **Scenario:** `@feature7`.
- **Task:** `product:TASK-7`.

### product:FR-8

- **Rationale:** managers and contributors need a concise boundary, roadmap, and ownership map.
- **Risk if omitted:** internals are duplicated across specs and deferred scope becomes an accidental promise.
- **Verification mode:** public-document review and canonical cross-spec link resolution.
- **Evidence demand:** README/roadmap status and link report for the candidate revision.
- **Acceptance:** `product:AC-8.1`, `product:AC-8.2`.
- **Scenario:** `@feature8`.
- **Task:** `product:TASK-8`.

### product:FR-9

- **Rationale:** the agent-facing destination is the generator-port MCP door; the eight SCHEMA-11 names are the v0.3 first slice, not a ceiling, and silent DROP of a census row would hide a ported capability.
- **Risk if omitted:** public docs freeze eight tools as the destination or send the agent through host LSP.
- **Verification mode:** census-row ownership review plus leftover freeze-phrase scan of ROADMAP, product, kernel, LSP, authoring, evidence, MRI README, and plugin README unless the nearby wording is first-slice or v0.3-candidate.
- **Evidence demand:** canonical table `docs/decisions/spec-generator-port.md` with 46 owned rows; no silent DROP; MCP-only agent inventory.
- **Acceptance:** `product:AC-9.1`.
- **Scenario:** `@feature9`.
- **Task:** `product:TASK-9`.

## CHK traceability matrix

| CHK ID | Check | FR | AC | Scenario/UC | Task |
|---|---|---|---|---|---|
| CHK-FR1-01 | Current/public-init status distinguishes historical no-runtime state from the v0.3.2 baseline and refuses premature payload claims. | FR-1 | AC-1.1, AC-1.2 | `@feature1`, SCEN-specification-only-init, SCEN-premature-installable-artifact | product:TASK-1 |
| CHK-FR2-01 | Source export reconstructs from the immutable commit and rejects one changed/unmanifested byte. | FR-2 | AC-2.1, AC-2.2 | `@feature2`, SCEN-pinned-source-export, SCEN-mismatched-imported-byte | product:TASK-2 |
| CHK-FR3-01 | Current source-owner license evidence is accepted; a future uncovered import fails closed. | FR-3 | AC-3.1, AC-3.2 | `@feature3`, SCEN-unresolved-import-license, SCEN-root-license-import-separation | product:TASK-3 |
| CHK-FR4-01 | Public tree and secret gates reject prohibited state paths and unresolved findings. | FR-4 | AC-4.1, AC-4.2 | `@feature4`, SCEN-prohibited-state-path, SCEN-unresolved-secret-finding | product:TASK-4 |
| CHK-FR5-01 | One marketplace/plugin/extension identity persists and a second control plane is refused. | FR-5 | AC-5.1, AC-5.2 | `@feature5`, SCEN-single-product-identity, SCEN-second-control-plane-refusal | product:TASK-5 |
| CHK-FR6-01 | Baseline and every capability require their exact aggregates; sibling or member-subset evidence never substitutes. | FR-6 | AC-6.1, AC-6.2 | `@feature6`, SCEN-incomplete-aggregate-remains-planned, SCEN-owning-aggregate-cannot-be-bypassed | product:TASK-6 |
| CHK-FR7-01 | Current status binds to evidence, reports blockers, and unexecuted Gherkin contributes no delivery claim. | FR-7 | AC-7.1, AC-7.2 | `@feature7`, SCEN-status-fails-closed, SCEN-unexecuted-bdd-not-evidence | product:TASK-7 |
| CHK-FR7-02 | `check-spec-corpus` requires one v0.3.2 version across root/catalog/package/runtime/status docs, public/installable delivered state, exact archive asset hash, and commit-bound release attestation identity. | FR-7 | AC-7.1, AC-7.2 | `@feature7`, SCEN-status-fails-closed | product:TASK-7 |
| CHK-FR8-01 | README/ROADMAP separate delivered baseline and independent capabilities and use qualified canonical owners. | FR-8 | AC-8.1, AC-8.2 | `@feature8`, SCEN-roadmap-separates-states, SCEN-canonical-owner-delegation | product:TASK-8 |
| CHK-FR8-02 | `check-spec-corpus` conserves 10 specs/150 canonical docs, requires shipped graph valid with zero errors/rejected/ambiguous/duplicate definitions, validates contract-v2 sentinels, and resolves all local links with `marksman-anchor@2`. | FR-8 | AC-8.1, AC-8.2 | `@feature8`, SCEN-canonical-owner-delegation | product:TASK-8 |
| CHK-FR9-01 | Source registry and decision table contain exactly the same 46 unique names numbered 1..46 with non-empty owner/stage; forbidden destination wording and any row loss/duplication fail. | FR-9 | AC-9.1 | `@feature9`, SCEN-generator-port-destination, UC-7 | product:TASK-9 |

## Cross-spec dependency matrix

| Product requirement | Canonical dependency | Reason |
|---|---|---|
| `product:FR-5` | `plugin-distribution:FR-1` | Owns marketplace/plugin/extension cardinality. |
| `product:FR-6` | `plugin-distribution:FR-13` | Owns versioned distribution eligibility: historical @1 receipts for v0.1–v0.3.2 remain valid; new candidates require @2. The product evaluator composes the applicable result with other baseline/capability aggregates. |
| `product:FR-6` | `spec-kernel:FR-14` | v0.2 delivery uses a current-candidate `targetStage: "v0.2"` result. v0.3/authoring use a current-candidate `targetStage: "v0.3"` result plus a separately identified v0.2 predecessor whose artifact SHA-256 is named exactly by `v02ParentArtifactSha256`; both share revision/lineage, appear in strict stage/profile order, and remain active. |
| `product:FR-6` | `spec-kernel:FR-16`, `spec-kernel:FR-17` | Generator-read capability profiles; neither enters the historical v0.3 gate. |
| `product:FR-6` | `spec-lsp:FR-1`, `spec-lsp:FR-12` | LSP owner and release aggregate; editor/MCP-internal only. |
| `product:FR-6` | `spec-evidence:FR-13`, `spec-evidence:FR-14` | Evidence aggregate and defining MCP projection. |
| `product:FR-6` | `spec-capability:FR-6`, `spec-capability:FR-9` | Capability graph/overlay owner and release aggregate. |
| `product:FR-6` | `spec-authoring-workflow:FR-13`, `spec-authoring-workflow:FR-14` | Authoring aggregate and MCP facade mapping. |
| `product:FR-6` | `spec-enforcement:FR-1`, `spec-enforcement:FR-11`, `spec-enforcement:CHK-FR1-01` | Enforcement owner/release aggregate plus authenticated tool-call host authority gate. |
| `product:FR-6` | `plan-gate:FR-13`, `plan-gate:CHK-HOST-ABI-01` | Automatic plan gate additionally requires the pinned selected-plan host ABI check. |
| `product:FR-9` | `docs/decisions/spec-generator-port.md` | Canonical 46-name census and destination invariants. |
| `product:FR-9` | `spec-kernel:FR-16` | Later generator-port kernel reads beyond the eight first-slice names. |
| `product:FR-9` | `spec-kernel:FR-17` | Later generator-port MCP adapter I/O reads. |
| `product:FR-9` | `spec-lsp:FR-1` | Sibling LSP adapter; not the agent-facing spec API. |
| `product:FR-9` | `spec-evidence:FR-14` | Later evidence MCP names after the evidence layer. |
| `product:FR-9` | `spec-authoring-workflow:FR-14` | Later authoring MCP names; schema v1 omission is later, not DROP. |
