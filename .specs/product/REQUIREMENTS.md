# Product requirements index

## Status semantics

`Specified` means the contract is written. Public shipment uses only SHIPPED, NEXT, and LATER and follows `product:FR-3`.

## Requirement inventory

| ID | Title | Priority | Acceptance | Scenario | Task |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-current-shipped-baseline) | Current shipped baseline | Must | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-current-release-proof) | `@feature1` | `product:TASK-1` |
| [FR-2](FR.md#fr-2-one-product-identity) | One-product identity | Must | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-single-product-identity) | `@feature2` | `product:TASK-2` |
| [FR-3](FR.md#fr-3-proof-before-shipped) | Proof before shipped | Must | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-missing-proof-is-not-shipped), [AC-3.2](ACCEPTANCE_CRITERIA.md#ac-32-unexecuted-text-is-not-proof) | `@feature3` | `product:TASK-3` |
| [FR-4](FR.md#fr-4-next-safe-authoring-outcome) | Next safe authoring outcome | Must | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-bounded-public-mutation-surface), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42-direct-spec-write-policy) | `@feature4` | `product:TASK-4` |
| [FR-5](FR.md#fr-5-plain-later-outcomes) | Plain later outcomes | Should | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-three-bucket-roadmap) | `@feature5` | `product:TASK-5` |

## Contract cards

### product:FR-1

- **Rationale:** managers need one truthful statement of the installed baseline.
- **Risk if omitted:** old release steps look like separate current products.
- **Verification mode:** compare the row with the bounded release status record and installed identity.
- **Evidence demand:** `docs/validation/release-status-v0.3.2.json` for the exact v0.3.2 release.
- **Acceptance:** `product:AC-1.1`.
- **Scenario:** `SCEN-current-release-proof`.
- **Task:** `product:TASK-1`.

### product:FR-2

- **Rationale:** users should install and recognize one evolving product.
- **Risk if omitted:** packaging or authoring fragments into competing products.
- **Verification mode:** inspect marketplace, package, extension, and public mutation identity.
- **Evidence demand:** current distribution evidence for `omp-spec-kit@omp-spec-kit`.
- **Acceptance:** `product:AC-2.1`.
- **Scenario:** `SCEN-one-product-identity`.
- **Task:** `product:TASK-2`.

### product:FR-3

- **Rationale:** plans and prose must not become shipment claims.
- **Risk if omitted:** users depend on behavior that has not run.
- **Verification mode:** remove or mismatch the current proof and confirm the row is not SHIPPED.
- **Evidence demand:** a current observable proof naming the exact released identity.
- **Acceptance:** `product:AC-3.1`, `product:AC-3.2`.
- **Scenario:** `SCEN-missing-proof-is-not-shipped`, `SCEN-unexecuted-text-is-not-proof`.
- **Task:** `product:TASK-3`.

### product:FR-4

- **Rationale:** authoring needs one narrow mutation door and a practical direct-write refusal boundary.
- **Risk if omitted:** a raw writer can bypass atomic validation or escape repository containment.
- **Verification mode:** enumerate the public mutation tools, apply one real patch, and attempt one non-allowlisted direct `.specs/**` write plus one link escape.
- **Evidence demand:** real end-to-end receipts for successful atomic apply and both refusals.
- **Acceptance:** `product:AC-4.1`, `product:AC-4.2`.
- **Scenario:** `SCEN-authoring-tools-are-bounded`, `SCEN-direct-spec-write-is-refused`.
- **Task:** `product:TASK-4`.

### product:FR-5

- **Rationale:** a short roadmap is easier to keep honest than an internal state model.
- **Risk if omitted:** implementation details leak into public promises and drift.
- **Verification mode:** inspect the public status table and later list.
- **Evidence demand:** exact-content review of SHIPPED/NEXT/LATER wording.
- **Acceptance:** `product:AC-5.1`.
- **Scenario:** `SCEN-roadmap-has-three-buckets`.
- **Task:** `product:TASK-5`.

## CHK traceability matrix

| CHK ID | Check | FR | AC | Scenario | Task |
|---|---|---|---|---|---|
| CHK-FR1-01 | The single current SHIPPED row matches the v0.3.2 release proof and eight-tool read-only baseline. | FR-1 | AC-1.1 | `SCEN-current-release-proof` | product:TASK-1 |
| CHK-FR2-01 | The marketplace, package, extension, and mutation surface preserve one product identity. | FR-2 | AC-2.1 | `SCEN-one-product-identity` | product:TASK-2 |
| CHK-FR3-01 | Missing proof and unexecuted text never produce SHIPPED. | FR-3 | AC-3.1, AC-3.2 | `SCEN-missing-proof-is-not-shipped`, `SCEN-unexecuted-text-is-not-proof` | product:TASK-3 |
| CHK-FR4-01 | Only two public mutation tools exist, and non-allowlisted canonical `.specs/**` writes or escapes are refused. | FR-4 | AC-4.1, AC-4.2 | `SCEN-authoring-tools-are-bounded`, `SCEN-direct-spec-write-is-refused` | product:TASK-4 |
| CHK-FR5-01 | Public status contains only SHIPPED, NEXT, and LATER with one NEXT safe-authoring row and plain later outcomes. | FR-5 | AC-5.1 | `SCEN-roadmap-has-three-buckets` | product:TASK-5 |

## Canonical dependencies

| Product requirement | Owner | Product use |
|---|---|---|
| `product:FR-1`, `product:FR-2` | `plugin-distribution` | Current package identity and release proof. |
| `product:FR-4` | `spec-authoring-workflow` | Proposal and atomic apply behavior. |
| `product:FR-4` | `spec-enforcement` | Direct-write path policy and containment. |
