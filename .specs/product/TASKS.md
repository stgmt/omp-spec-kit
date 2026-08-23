# Product lifecycle tasks

All tasks are planned work. No task status below constitutes executed evidence. Estimates are relative working days for one owner after dependencies are available.

## TASK-1 — Complete the specification-first candidate

- **Status:** Completed
- **Estimate:** 1 day
- **Owner:** Product owner
- **Depends on:** Canonical product, distribution, kernel, and authoring specs exist.
- **Traces:** `product:FR-1`; `product:AC-1.1`; `product:AC-1.2`; `@feature1`; `SCEN-specification-only-init`; `SCEN-premature-installable-artifact`.
- **Planned paths:** `README.md`, `ROADMAP.md`, `.specs/product/README.md`, `docs/validation/spec-review.md`.
- **Evidence:** `docs/validation/spec-review.md`; final census 60/60 documents, 48 FR, 96 AC, 89 unique scenarios, 45 canonical tasks, zero unresolved semantic findings.
- **Done When:** The exact candidate revision has a manager-readable review showing specification-only status, no installable catalog/payload/claim, complete product traceability, and no unresolved semantic blocker other than separately named publication blockers.

## TASK-2 — Independently reproduce the source freeze

- **Status:** Completed
- **Estimate:** 1 day
- **Owner:** Provenance reviewer
- **Depends on:** Immutable source commit remains accessible.
- **Traces:** `product:FR-2`; `product:AC-2.1`; `product:AC-2.2`; `@feature2`; `SCEN-pinned-source-export`; `SCEN-mismatched-imported-byte`.
- **Planned paths:** `IMPORT_MANIFEST.yaml`, `docs/upstream/dev-pomogator/spec-generator-v4/`, `docs/validation/source-freeze.md`.
- **Evidence:** `docs/validation/source-freeze.md`; 27/27 source hashes, 24/24 byte-identical copies, three deliberate exclusions, zero mismatches.
- **Done When:** An independent reconstruction from commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6` accounts for every inventoried path, confirms every copied SHA-256, confirms the three exclusions, and records zero actual mismatches without reading mutable worktree bytes.

## TASK-3 — Resolve the imported-material license blocker

- **Status:** Completed
- **Estimate:** 2 days plus external review latency
- **Owner:** Legal/provenance owner
- **Depends on:** Completed source-owner attestation decision.
- **Traces:** `product:FR-3`; `product:AC-3.1`; `product:AC-3.2`; `@feature3`; `SCEN-unresolved-import-license`; `SCEN-root-license-import-separation`.
- **Evidence:** dev-pomogator commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a`, [PR #232](https://github.com/stgmt/dev-pomogator/pull/232), `IMPORT_MANIFEST.yaml`, `docs/upstream/dev-pomogator/LICENSE`, `docs/upstream/dev-pomogator/LICENSE-ATTESTATION.md`, and `docs/validation/provenance/dev-pomogator-license-attestation.yaml`.
- **Done When:** Met. The durable source-owner MIT attestation covers all 24 copied snapshot files, all imported rows are `MIT_ATTESTED_SOURCE_OWNER`, excluded state/temp rows remain excluded, and repository-owned versus imported provenance remains explicit.

## TASK-4 — Certify the clean public export

- **Status:** Planned
- **Estimate:** 1 day
- **Owner:** Security reviewer
- **Depends on:** TASK-2 and TASK-3.
- **Traces:** `product:FR-4`; `product:AC-4.1`; `product:AC-4.2`; `@feature4`; `SCEN-prohibited-state-path`; `SCEN-unresolved-secret-finding`.
- **Planned paths:** `.gitignore`, `SECURITY.md`, `docs/validation/public-safety.md`.
- **Done When:** The exact candidate tree/history matches the approved allowlist, contains no prohibited local/state/evidence paths, has zero unresolved secret findings, records every exception with full review fields, and has an approved public diff.

## TASK-5 — Enforce one future product identity

- **Status:** Planned
- **Estimate:** 1 day
- **Owner:** Distribution owner
- **Depends on:** Public init is eligible and product publication is authorized.
- **Traces:** `product:FR-5`; `product:AC-5.1`; `product:AC-5.2`; `@feature5`; `SCEN-single-product-identity`; `SCEN-second-control-plane-refusal`; `plugin-distribution:FR-1`.
- **Planned paths:** `.omp-plugin/marketplace.json`, `plugins/omp-spec-kit/package.json`, `docs/validation/product-identity.md`.
- **Done When:** Distribution evidence for the candidate observes identity `omp-spec-kit@omp-spec-kit`, one marketplace entry, one plugin package, one extension entry, and no alternate kernel/MCP/authoring control plane.

## TASK-6 — Operate the evidence-gated release roadmap

- **Status:** Planned
- **Estimate:** 1 day per stage review
- **Owner:** Release owner
- **Depends on:** The complete cumulative gate set for the proposed stage: v0.1.0 = current-candidate `plugin-distribution:FR-13`; v0.2 = current-candidate distribution plus current-candidate `spec-kernel:FR-14` `targetStage: "v0.2"`; v0.3 = current-candidate distribution and `targetStage: "v0.3"` kernel result plus the separately identified active v0.2 predecessor linked by the later result's exact `v02ParentArtifactSha256`; authoring = current-candidate distribution, v0.3 kernel, and `spec-authoring-workflow:FR-13` plus that linked v0.2 predecessor.
- **Traces:** `product:FR-6`; `product:AC-6.1`; `product:AC-6.2`; `@feature6`; `SCEN-incomplete-aggregate-remains-planned`; `SCEN-owning-aggregate-cannot-be-bypassed`; `plugin-distribution:FR-13`; `spec-kernel:FR-14`; `spec-authoring-workflow:FR-13`.
- **Planned paths:** `ROADMAP.md`, `CHANGELOG.md`, `docs/validation/release-status.json`.
- **Done When:** The stage review identifies the last proven stage, evaluates every aggregate in the proposed stage's cumulative gate set, confirms complete mandatory member evidence, confirms current distribution/current-stage/current-authoring results bind to the current candidate, and for v0.3/authoring confirms the v0.2 predecessor artifact SHA-256 exactly matches the v0.3 result's `v02ParentArtifactSha256`, shares product revision/lineage in strict v0.2-before-v0.3 order, and is neither stale nor revoked. It refuses `DELIVERED` for any missing/stale/revoked/failed/contradictory/claimed-only/wrong-target-stage/current-artifact-mismatched/parent-mismatched/cross-lineage or member-subset evidence and does not advance public wording prematurely.

## TASK-7 — Publish an honest status record

- **Status:** Planned
- **Estimate:** 0.5 day per candidate
- **Owner:** Product owner
- **Depends on:** Current public-init evidence or every aggregate in the release stage's cumulative gate set is assembled with explicit current-candidate/predecessor binding for one candidate artifact lineage.
- **Traces:** `product:FR-7`; `product:AC-7.1`; `product:AC-7.2`; `@feature7`; `SCEN-status-fails-closed`; `SCEN-unexecuted-bdd-not-evidence`.
- **Planned paths:** `README.md`, `ROADMAP.md`, `docs/validation/release-status.json`, `CHANGELOG.md`.
- **Done When:** Public status names stage, conservative state, product revision, current candidate artifact/lineage, typed evidence binding roles, linked v0.2 predecessor and exact parent SHA where applicable, evidence timestamps/revocation state, blockers, and next gates; each non-public-init stage points to every required cumulative aggregate result and contains no unsupported, latest-only, wrong-target-stage, current-artifact-mismatched, parent-mismatched, historical, stale, revoked, cross-lineage, or member-subset-derived delivered claim.

## TASK-8 — Review roadmap clarity and canonical boundaries

- **Status:** Completed
- **Estimate:** 0.5 day
- **Owner:** Documentation reviewer
- **Depends on:** TASK-1 and current versions of sibling specs.
- **Traces:** `product:FR-8`; `product:AC-8.1`; `product:AC-8.2`; `@feature8`; `SCEN-roadmap-separates-states`; `SCEN-canonical-owner-delegation`.
- **Planned paths:** `README.md`, `ROADMAP.md`, `.specs/product/README.md`, `docs/validation/spec-review.md`.
- **Evidence:** `docs/validation/spec-review.md`; manager-readable state separation and all canonical cross-spec owners were independently reviewed.
- **Done When:** A manager can distinguish current, planned, deferred, and blocked states; every delegated contract resolves to canonical `plugin-distribution`, `spec-kernel`, or `spec-authoring-workflow` IDs; excluded harness machinery is not implied as backlog or delivery.

## Task summary

| Task | Status | Estimate | Owner | Primary requirement |
|---|---|---:|---|---|
| `product:TASK-1` | Completed | 1 day | Product owner | `product:FR-1` |
| `product:TASK-2` | Completed | 1 day | Provenance reviewer | `product:FR-2` |
| `product:TASK-3` | Completed | 2 days + external latency | Legal/provenance owner | `product:FR-3` |
| `product:TASK-4` | Planned | 1 day | Security reviewer | `product:FR-4` |
| `product:TASK-5` | Planned | 1 day | Distribution owner | `product:FR-5` |
| `product:TASK-6` | Planned | 1 day/stage | Release owner | `product:FR-6` |
| `product:TASK-7` | Planned | 0.5 day/candidate | Product owner | `product:FR-7` |
| `product:TASK-8` | Completed | 0.5 day | Documentation reviewer | `product:FR-8` |
