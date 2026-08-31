# Product status schema

## Scope

This schema defines the small public roadmap record. Detailed release, authoring, and enforcement records belong to their owning specifications.

## Canonical identifiers

A cross-spec identifier is `<spec-slug>:<local-id>`. Product requirements use `product:FR-N`, acceptance criteria use `product:AC-N.M`, tasks use `product:TASK-N`, and checks use `product:CHK-FRN-NN`. Bare IDs are local prose only.

## RoadmapRow

| Field | Type | Required | Rule |
|---|---|---|---|
| `bucket` | `SHIPPED | NEXT | LATER` | yes | The only public status vocabulary. |
| `label` | non-empty string | yes | Manager-readable outcome. |
| `proof` | repository-relative path or null | yes | Required only for SHIPPED. |
| `observedRelease` | `{version, installedIdentity}` or null | yes | Required only for SHIPPED. |
| `whyNotShipped` | non-empty string or null | yes | Required for NEXT, optional for LATER, null for SHIPPED. |

## Roadmap

A roadmap is an ordered array of `RoadmapRow` with these invariants:

1. exactly one SHIPPED row;
2. exactly one NEXT row;
3. zero or more LATER rows;
4. the SHIPPED row has readable current proof whose released identity equals `observedRelease`;
5. NEXT and LATER rows do not claim shipment;
6. no additional public state field is permitted.


## Current instance

| bucket | label | proof | observedRelease | whyNotShipped |
|---|---|---|---|---|
| SHIPPED | v0.3.2 read-only MCP baseline: v0.2 graph/query kernel plus eight working read-only MCP tools | `docs/validation/release-status-v0.3.2.json` | `{version: "0.3.2", installedIdentity: "omp-spec-kit@omp-spec-kit"}` | null |
| NEXT | Safe spec authoring | null | null | Only `propose_patch` and `apply_proposed_patch` may be public; atomic contained application and the exact-name-first `.specs/**` direct-write policy still require real end-to-end proof. |
| LATER | Expanded read queries | null | null | null |
| LATER | Editor navigation | null | null | null |
| LATER | Evidence queries | null | null | null |
| LATER | Impact reporting | null | null | null |
| LATER | Manual exact-content plan validation | null | null | null |

## Shipment proof rule

For SHIPPED, the proof file is consumed as an opaque bounded release receipt. Product status reads only the released version and installed identity needed to match the row. It does not copy artifact ancestry or owner-specific verification fields. Without readable matching proof, the row is invalid and SHALL NOT be SHIPPED; tasks, scenarios, specifications, and older receipts do not substitute.

## Safe authoring exit condition

The NEXT row may move to SHIPPED only when one current end-to-end proof shows all of the following for the same product build:

- public mutation names are exactly `propose_patch` and `apply_proposed_patch`;
- an allowlisted authoring call applies atomically inside repository containment;
- a non-allowlisted direct write targeting canonical `.specs/**` is refused;
- a link or reparse escape is refused;
- each refusal has a bounded reason.

## OMP 18 staged lifecycle

The current v0.3.2 profile is read-only. The planned releases are OMP 18 maintenance, read complete (23 MCP tools), evidence/navigation (25), safe authoring (49), and automatic exact-plan gating. Each stage requires its own installed runtime and behavioral receipt.
