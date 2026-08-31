# Product tasks

Task state is workflow metadata, not shipment evidence. This file has no duplicated summary table.

## TASK-1 — Keep current release status accurate

- **Status:** Completed
- **Estimate:** 0.5 day per release
- **Owner:** Product owner
- **Depends on:** Bounded current release proof.
- **Traces:** `product:FR-1`; `product:AC-1.1`; `@feature1`; `SCEN-current-release-proof`; `CHK-FR1-01`.
- **Evidence:** `docs/validation/release-status-v0.3.2.json`.
- **Done When:** The single SHIPPED row matches the current version, installed identity, read-only baseline, and proof link.

## TASK-2 — Preserve one product identity

- **Status:** Completed
- **Estimate:** 0.5 day per packaging change
- **Owner:** Distribution owner
- **Depends on:** Current package and extension evidence.
- **Traces:** `product:FR-2`; `product:AC-2.1`; `@feature2`; `SCEN-one-product-identity`; `CHK-FR2-01`.
- **Evidence:** `.omp-plugin/marketplace.json`, `plugins/omp-spec-kit/package.json`, `docs/validation/release-status-v0.3.2.json`.
- **Done When:** One marketplace entry, plugin package, extension, installed identity, and specification write surface remain.

## TASK-3 — Enforce proof-before-shipped wording

- **Status:** Completed
- **Estimate:** 0.5 day per status change
- **Owner:** Release owner
- **Depends on:** Current proof for any proposed SHIPPED row.
- **Traces:** `product:FR-3`; `product:AC-3.1`; `product:AC-3.2`; `@feature3`; `SCEN-missing-proof-is-not-shipped`; `SCEN-unexecuted-text-is-not-proof`; `CHK-FR3-01`.
- **Evidence:** Current public status and its cited producer receipt.
- **Done When:** Removing or mismatching current proof prevents SHIPPED and no prose-only artifact substitutes.

## TASK-4 — Deliver safe spec authoring

- **Status:** Planned
- **Estimate:** 3 days
- **Owner:** Authoring and enforcement owners
- **Depends on:** Existing v0.3.2 read-only baseline.
- **Traces:** `product:FR-4`; `product:AC-4.1`; `product:AC-4.2`; `@feature4`; `SCEN-authoring-tools-are-bounded`; `SCEN-direct-spec-write-is-refused`; `CHK-FR4-01`.
- **Owner contracts:** `spec-authoring-workflow`, `spec-enforcement`; exact implementation paths remain theirs.
- **Done When:** One current end-to-end receipt proves the two-tool public surface, atomic contained apply, non-allowlisted direct `.specs/**` refusal, link/reparse refusal, and bounded reasons.

## TASK-5 — Keep the roadmap plain

- **Status:** Completed
- **Estimate:** 0.5 day per roadmap change
- **Owner:** Product owner
- **Depends on:** Product decision selecting at most one NEXT outcome.
- **Traces:** `product:FR-5`; `product:AC-5.1`; `@feature5`; `SCEN-roadmap-has-three-buckets`; `CHK-FR5-01`.
- **Evidence:** Exact-content review of product README and roadmap.
- **Done When:** Public status uses only SHIPPED, NEXT, and LATER; one NEXT row exists; later entries are plain outcomes.
