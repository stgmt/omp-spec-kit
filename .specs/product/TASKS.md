# Product lifecycle tasks

All tasks are planned work. No task status below constitutes executed evidence. Estimates are relative working days for one owner after dependencies are available.

## TASK-1 — Complete the specification-first candidate

- **Status:** Completed
- **Estimate:** 1 day
- **Owner:** Product owner
- **Depends on:** Canonical product, distribution, kernel, and authoring specs exist.
- **Traces:** `product:FR-1`; `product:AC-1.1`; `product:AC-1.2`; `@feature1`; `SCEN-specification-only-init`; `SCEN-premature-installable-artifact`; `CHK-FR1-01`.
- **Planned paths:** `README.md`, `ROADMAP.md`, `.specs/product/README.md`, `docs/validation/spec-review.md`.
- **Evidence:** `docs/validation/spec-review.md`; final census 60/60 documents, 48 FR, 96 AC, 89 unique scenarios, 45 canonical tasks, zero unresolved semantic findings.
- **Done When:** The exact candidate revision has a manager-readable review showing specification-only status, no installable catalog/payload/claim, complete product traceability, and no unresolved semantic blocker other than separately named publication blockers.
- [x] `AC-1.1` delivery: source-of-truth mapping recorded (README.md is the registry for the public-init contract); contract regression via `docs/validation/spec-review.md`; semantic readback of status/content-type/body not applicable on a static documentation surface.
- [x] `AC-1.2` delivery: premature-payload refusal verified in the public-init eligibility contract regression; README.md registry states the `BLOCKED` disposition; status/content-type/body readback not applicable to static specification text.

## TASK-2 — Independently reproduce the source freeze

- **Status:** Completed
- **Estimate:** 1 day
- **Owner:** Provenance reviewer
- **Depends on:** Immutable source commit remains accessible.
- **Traces:** `product:FR-2`; `product:AC-2.1`; `product:AC-2.2`; `@feature2`; `SCEN-pinned-source-export`; `SCEN-mismatched-imported-byte`; `CHK-FR2-01`.
- **Planned paths:** `IMPORT_MANIFEST.yaml`, `docs/upstream/dev-pomogator/spec-generator-v4/`, `docs/validation/source-freeze.md`.
- **Evidence:** `docs/validation/source-freeze.md`; 27/27 source hashes, 24/24 byte-identical copies, three deliberate exclusions, zero mismatches.
- **Done When:** An independent reconstruction from commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6` accounts for every inventoried path, confirms every copied SHA-256, confirms the three exclusions, and records zero actual mismatches without reading mutable worktree bytes.

## TASK-3 — Resolve the imported-material license blocker

- **Status:** Completed
- **Estimate:** 2 days plus external review latency
- **Owner:** Legal/provenance owner
- **Depends on:** Completed source-owner attestation decision.
- **Traces:** `product:FR-3`; `product:AC-3.1`; `product:AC-3.2`; `@feature3`; `SCEN-unresolved-import-license`; `SCEN-root-license-import-separation`; `CHK-FR3-01`.
- **Evidence:** dev-pomogator commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a`, [PR #232](https://github.com/stgmt/dev-pomogator/pull/232), `IMPORT_MANIFEST.yaml`, `docs/upstream/dev-pomogator/LICENSE`, `docs/upstream/dev-pomogator/LICENSE-ATTESTATION.md`, and `docs/validation/provenance/dev-pomogator-license-attestation.yaml`.
- **Done When:** Met. The durable source-owner MIT attestation covers all 24 copied snapshot files, all imported rows are `MIT_ATTESTED_SOURCE_OWNER`, excluded state/temp rows remain excluded, and repository-owned versus imported provenance remains explicit.

## TASK-4 — Certify the clean public export

- **Status:** Completed
- **Estimate:** 1 day
- **Owner:** Security reviewer
- **Depends on:** TASK-2 and TASK-3.
- **Traces:** `product:FR-4`; `product:AC-4.1`; `product:AC-4.2`; `@feature4`; `SCEN-prohibited-state-path`; `SCEN-unresolved-secret-finding`; `CHK-FR4-01`.
- **Planned paths:** `.gitignore`, `SECURITY.md`, `docs/validation/public-safety.md`.
- **Evidence:** `docs/validation/public-safety.md` and `docs/validation/publication-receipt.md`; zero secret/path/payload findings, approved 100-file initial diff, public SHA/tree equality.
- **Done When:** The exact candidate tree/history matches the approved allowlist, contains no prohibited local/state/evidence paths, has zero unresolved secret findings, records every exception with full review fields, and has an approved public diff.

## TASK-5 — Preserve one delivered product identity

- **Status:** Completed
- **Estimate:** 1 day
- **Owner:** Distribution owner
- **Depends on:** Public release evidence.
- **Traces:** `product:FR-5`; `product:AC-5.1`; `product:AC-5.2`; `@feature5`; `SCEN-single-product-identity`; `SCEN-second-control-plane-refusal`; `plugin-distribution:FR-1`; `CHK-FR5-01`.
- **Evidence:** `docs/validation/release-status-v0.3.2.json`, `.omp-plugin/marketplace.json`, `plugins/omp-spec-kit/package.json`.
- **Done When:** Distribution evidence observes identity `omp-spec-kit@omp-spec-kit`, one marketplace entry, one plugin package, one extension entry, and no alternate agent-facing spec control plane.

## TASK-6 — Operate the evidence-gated release roadmap

- **Status:** In Progress
- **Estimate:** 1 day per capability review
- **Owner:** Release owner
- **Depends on:** Delivered v0.3.2 baseline plus the exact `CapabilityDelivery.requiredAggregateIds` set for the proposed capability.
- **Traces:** `product:FR-6`; `product:AC-6.1`; `product:AC-6.2`; `@feature6`; `SCEN-incomplete-aggregate-remains-planned`; `SCEN-owning-aggregate-cannot-be-bypassed`; `CHK-FR6-01`.
- **Planned paths:** `ROADMAP.md`, `CHANGELOG.md`, `docs/validation/release-status-v0.3.2.json`, future capability evidence records.
- **Done When:** Baseline and capability states are evaluated independently; every required aggregate is complete/current/hash-bound; sibling capability evidence is never inherited; `DEFERRED_HOST_ABI` is used only for the exact missing host event.

## TASK-7 — Publish an honest status record

- **Status:** Completed
- **Estimate:** 0.5 day per candidate
- **Owner:** Product owner
- **Depends on:** Current bounded public-release status evidence or a complete future capability aggregate.
- **Traces:** `product:FR-7`; `product:AC-7.1`; `product:AC-7.2`; `@feature7`; `SCEN-status-fails-closed`; `SCEN-unexecuted-bdd-not-evidence`; `CHK-FR7-01`; `CHK-FR7-02`.
- **Evidence:** `docs/validation/release-status-v0.3.2.json`, root/product README, public release URL and attestation identity.
- **Done When:** Public status names baseline and every capability separately, cites exact evidence identities, reports blockers/next gates, and never derives delivery from Gherkin or sibling capability state.

## TASK-8 — Review roadmap clarity and canonical boundaries

- **Status:** Completed
- **Estimate:** 0.5 day
- **Owner:** Documentation reviewer
- **Depends on:** Current versions of every sibling capability spec.
- **Traces:** `product:FR-8`; `product:AC-8.1`; `product:AC-8.2`; `@feature8`; `SCEN-roadmap-separates-states`; `SCEN-canonical-owner-delegation`; `CHK-FR8-01`; `CHK-FR8-02`.
- **Planned paths:** `README.md`, `ROADMAP.md`, `.specs/product/README.md`, `docs/validation/spec-corpus-contract-review.md`.
- **Evidence:** generated only after the final ten-spec corpus review.
- **Done When:** Baseline and sibling capabilities are visibly separate; every row resolves to qualified canonical owners/gates; final review has no P0/P1.

## TASK-9 — Record the generator-port MCP destination

- **Status:** Completed
- **Estimate:** 0.5 day
- **Owner:** Product owner
- **Depends on:** Canonical census `docs/decisions/spec-generator-port.md`.
- **Traces:** `product:FR-9`; `product:AC-9.1`; `@feature9`; `SCEN-generator-port-destination`; `CHK-FR9-01`.
- **Planned paths:** `ROADMAP.md`, `.specs/product/`, `plugins/omp-spec-kit/README.md`, `MIGRATION_MATRIX.md`, `docs/decisions/spec-generator-port.md`, census ratchet script.
- **Done When:** Exact source/decision 46-name conservation, owner/stage completeness, first-slice wording and MCP-only agent boundary are mechanically gated.

## Task summary

| Task | Status | Estimate | Owner | Primary requirement |
|---|---|---:|---|---|
| `product:TASK-1` | Completed | 1 day | Product owner | `product:FR-1` |
| `product:TASK-2` | Completed | 1 day | Provenance reviewer | `product:FR-2` |
| `product:TASK-3` | Completed | 2 days + external latency | Legal/provenance owner | `product:FR-3` |
| `product:TASK-4` | Completed | 1 day | Security reviewer | `product:FR-4` |
| `product:TASK-5` | Completed | 1 day | Distribution owner | `product:FR-5` |
| `product:TASK-6` | In Progress | 1 day/capability | Release owner | `product:FR-6` |
| `product:TASK-7` | Completed | 0.5 day/candidate | Product owner | `product:FR-7` |
| `product:TASK-8` | In Progress | 0.5 day | Documentation reviewer | `product:FR-8` |
| `product:TASK-9` | In Progress | 0.5 day | Product owner | `product:FR-9` |
