# Functional requirements

All `SHALL` and `SHALL NOT` statements are normative. A written requirement is not execution evidence.

## FR-1 — Current shipped baseline

The public roadmap SHALL contain exactly one SHIPPED row for `omp-spec-kit@omp-spec-kit` v0.3.2. The row SHALL describe the v0.2 graph/query kernel and eight working read-only MCP tools and SHALL link `docs/validation/release-status-v0.3.2.json` as its current release proof. Public-init, v0.1, v0.2, and v0.3 SHALL remain history rather than additional current rows.

- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-current-release-proof)
- **Scenario trace:** `@feature1`; `SCEN-current-release-proof`.
- **Stories/use cases:** US-1; UC-1.

## FR-2 — One-product identity

The repository SHALL expose one product named `omp-spec-kit`, installed as `omp-spec-kit@omp-spec-kit`, with one marketplace entry, one plugin package, and one extension. New outcomes SHALL remain inside that identity and SHALL NOT create a second product or competing specification write surface.

- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-single-product-identity)
- **Scenario trace:** `@feature2`; `SCEN-one-product-identity`.
- **Stories/use cases:** US-2; UC-2.

## FR-3 — Proof before shipped

Public product status SHALL use only SHIPPED, NEXT, and LATER. A row may enter SHIPPED only when a current observable proof names the exact released identity and result. Missing proof SHALL keep the outcome in NEXT or LATER. Specifications, task state, Gherkin text, historical receipts, and sibling progress SHALL NOT substitute for current proof.

- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-missing-proof-is-not-shipped), [AC-3.2](ACCEPTANCE_CRITERIA.md#ac-32-unexecuted-text-is-not-proof)
- **Scenario trace:** `@feature3`; `SCEN-missing-proof-is-not-shipped`; `SCEN-unexecuted-text-is-not-proof`.
- **Stories/use cases:** US-3; UC-3.

## FR-4 — Next safe authoring outcome

The roadmap SHALL contain exactly one NEXT row for safe spec authoring. Its public mutation surface and exact authoring-name allowlist SHALL both contain only `propose_patch` and `apply_proposed_patch`; helper operations compile internally. Before each `tool_call`, the path policy SHALL accept that allowlist first, then SHALL refuse every other direct write whose canonically resolved target is under `.specs/**`. Resolution SHALL enforce repository containment across real paths, links, and reparse points. Accepted application SHALL be atomic and refusal reasons SHALL be bounded. The row SHALL NOT enter SHIPPED without real end-to-end proof of both the mutation path and the direct-write refusal path.

- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-bounded-public-mutation-surface), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42-direct-spec-write-policy)
- **Scenario trace:** `@feature4`; `SCEN-authoring-tools-are-bounded`; `SCEN-direct-spec-write-is-refused`.
- **Stories/use cases:** US-4; UC-4.

## FR-5 — Plain later outcomes

The roadmap SHALL list expanded read queries, editor navigation, evidence queries, impact reporting, and manual exact-content plan validation as plain LATER outcomes. It SHALL NOT assign hidden substates, owner-internal checks, or shipment claims to them. A LATER outcome becomes NEXT only through an explicit product decision and becomes SHIPPED only under FR-3.

- **Priority:** Should
- **Status:** Specified
- **Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-three-bucket-roadmap)
- **Scenario trace:** `@feature5`; `SCEN-roadmap-has-three-buckets`.
- **Stories/use cases:** US-5; UC-5.
