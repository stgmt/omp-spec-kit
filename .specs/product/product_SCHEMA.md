# Product identity and status schema

## Scope

This schema defines externally observable product identifiers, lifecycle states, evidence references, and publication-gate results. It is a normative logical contract, independent of serialization language. It does not define plugin manifests, kernel nodes/edges, tool inputs, MCP messages, or authoring mutations.

## Canonical identifiers

All runtime-visible and cross-spec entity identifiers SHALL use:

```text
<spec-slug>:<local-id>
```

### Fields

| Component | Type | Constraints | Example |
|---|---|---|---|
| `spec-slug` | string | lowercase kebab-case; starts/ends alphanumeric | `product` |
| separator | literal | exactly `:` | `:` |
| `local-id` | string | canonical local document ID | `FR-1` |

Examples:

- `product:FR-1`
- `product:AC-1.1`
- `product:TASK-1`
- `plugin-distribution:FR-13`
- `spec-kernel:FR-14`
- `spec-authoring-workflow:FR-13`

Bare local IDs MAY appear inside their owning directory for readability, but cross-spec and runtime records SHALL be qualified. A qualified identifier SHALL NOT be resolved by “first matching bare ID.”

## Product identity

| Field | Type | Required | Contract |
|---|---|---:|---|
| `productName` | string | yes | Exactly `omp-spec-kit`. |
| `repository` | string | yes | Intended public repository identity `stgmt/omp-spec-kit`; visibility is reported separately and must not be inferred. |
| `marketplaceName` | string or null | yes | `null` at public init; exactly `omp-spec-kit` only after distribution exists. |
| `pluginName` | string or null | yes | `null` at public init; exactly `omp-spec-kit` only after distribution exists. |
| `installedIdentity` | string or null | yes | `null` at public init; exactly `omp-spec-kit@omp-spec-kit` only after distribution exists. |
| `marketplaceEntryCount` | non-negative integer | yes | `0` at public init; exactly `1` for an installable product. |
| `pluginPackageCount` | non-negative integer | yes | `0` at public init; exactly `1` for an installable product. |
| `extensionEntryCount` | non-negative integer | yes | `0` at public init; exactly `1` for an installable product. |

The three counts are product cardinality evidence, not discovery heuristics. Their detailed validation belongs to `plugin-distribution:FR-1`.

## Release stage

Closed enumeration:

| Value | Meaning | Required canonical gates |
|---|---|---|
| `PUBLIC_INIT` | Specification/provenance repository; no installable plugin. | `product:FR-1` through `product:FR-4`, plus public documentation gates. |
| `V0_1_READONLY_INVENTORY` | One plugin with first bounded read-only value. | Accepted `plugin-distribution:FR-13` bound to the current product revision, candidate artifact, and artifact lineage; it must accept complete mandatory evidence for distribution FR-1 through FR-12. |
| `V0_2_READONLY_KERNEL` | Typed bounded graph/query kernel in the same plugin. | Accepted `plugin-distribution:FR-13` plus accepted `spec-kernel:FR-14` with `targetStage: "v0.2"`, both bound to the current product revision, candidate artifact, and artifact lineage. |
| `V0_3_READONLY_MCP` | One read-only MCP projection over the same query service. | Accepted current-candidate `plugin-distribution:FR-13` plus accepted current-candidate `spec-kernel:FR-14` for `targetStage: "v0.3"`, and a separately identified accepted `targetStage: "v0.2"` predecessor. The predecessor artifact SHA-256 may differ only when it equals the v0.3 result's `v02ParentArtifactSha256`; both kernel results share the status revision and lineage, are ordered v0.2 before v0.3, and are neither stale nor revoked. |
| `LATER_AUTHORING_MUTATION` | Proposal/CAS/mutation capabilities after separate safety gates. | Accepted current-candidate `plugin-distribution:FR-13`, current-candidate `spec-kernel:FR-14` for `targetStage: "v0.3"`, and current-candidate `spec-authoring-workflow:FR-13`, plus the separately identified linked v0.2 predecessor required by the v0.3 row. Every aggregate remains mandatory. |

## Capability state

Closed enumeration:

| Value | Meaning |
|---|---|
| `SPEC_ONLY` | Normative documents/policies exist; executable capability is absent. |
| `PLANNED` | Scope is approved; required delivery evidence is absent. |
| `DEFERRED` | Scope is intentionally outside the active stage. |
| `BLOCKED` | A required gate is failed, unresolved, or awaits an owner decision. |
| `DELIVERED` | Current observable evidence satisfies the complete cumulative gate set for the stage under the typed current-candidate/predecessor artifact-binding rules. |

Precedence when multiple states appear applicable:

```text
BLOCKED > SPEC_ONLY > DEFERRED > PLANNED > DELIVERED
```

`DELIVERED` is valid only when all public-init gates are `ELIGIBLE`, or for a later stage when every aggregate listed for that stage in the release-stage table is `ELIGIBLE` for the reported product revision and artifact lineage. Every `CURRENT_CANDIDATE` reference must match `ProductStatus.candidateArtifactSha256`. The sole permitted non-current binding is the required `PREDECESSOR_V0_2` kernel result for v0.3 and authoring: its artifact must match the current v0.3 kernel result's `v02ParentArtifactSha256`, both kernel results must share the status lineage/revision and exact closed target-stage/profile pair, and neither may be stale or revoked. A later aggregate does not inherit or replace an earlier aggregate. Evidence from selected member requirements, a historical or unlinked result, a differently targeted kernel profile, or another lineage cannot replace a required aggregate result. Missing or invalid evidence cannot be represented by an empty blocker list.

## ProductStatus record

| Field | Type | Required | Rules |
|---|---|---:|---|
| `schemaVersion` | positive integer | yes | Begins at `1`; unknown versions fail closed. |
| `product` | Product identity | yes | Must satisfy the identity schema above. |
| `stage` | Release stage enum | yes | The stage being reported. |
| `state` | Capability state enum | yes | Conservative result after all gates. |
| `productRevision` | non-empty string | yes | Immutable commit/release identifier for the evaluated product tree. |
| `evaluatedAt` | RFC 3339 timestamp | yes | Time the status was calculated, not a planned date. |
| `artifactLineageId` | non-empty string or null | yes | `null` at public init; otherwise the opaque release-evidence lineage shared by every current and predecessor aggregate result. Name or version equality alone does not establish lineage. |
| `candidateArtifactSha256` | 64 lowercase hex characters or null | yes | `null` at public init; otherwise the exact current candidate artifact. Current distribution, current target-stage kernel, and current authoring evidence must match it. |
| `v02ParentArtifactSha256` | 64 lowercase hex characters or null | yes | Required for v0.3 and authoring status; it is the exact v0.2 predecessor SHA-256 declared by the current v0.3 `spec-kernel:FR-14` result. Null at public init, v0.1.0, and v0.2. |
| `claimIds` | array of canonical IDs | yes | Non-empty for a capability claim; no duplicates. A non-public-init stage claim SHALL include every aggregate ID required by its cumulative stage row. |
| `evidence` | array of EvidenceRef | yes | Empty is permitted only for non-delivered states and must produce an explanatory blocker. A delivered public-init status must include all accepted local publication gates; a delivered later stage must include accepted evidence for every cumulative aggregate gate with explicit binding roles. |
| `blockers` | array of Blocker | yes | Empty only when every required public-init gate is eligible or every cumulative later-stage aggregate satisfies the current/predecessor binding, freshness, revocation, revision, and lineage rules. |
| `nextGateIds` | array of canonical IDs | yes | Required for `SPEC_ONLY`, `PLANNED`, `DEFERRED`, or `BLOCKED`; for a non-public-init stage, identify every missing cumulative aggregate gate rather than a member subset. |
| `publicVisibility` | enum | yes | `LOCAL_ONLY`, `PRIVATE`, `PUBLIC`, or `UNKNOWN`; never inferred from repository naming. |
| `installable` | boolean | yes | `false` at public init; true only when current-candidate `plugin-distribution:FR-13` is accepted for the reported revision, candidate artifact, and lineage. |
| `executedScenarioEvidence` | boolean | yes | True only when current external runner evidence is linked; Gherkin presence alone yields false. |

## EvidenceRef record

| Field | Type | Required | Rules |
|---|---|---:|---|
| `evidenceId` | non-empty string | yes | Stable identifier within the evidence store. |
| `requirementIds` | array of canonical IDs | yes | At least one; every ID must exist. |
| `kind` | enum | yes | `SOURCE_FREEZE`, `LICENSE_DECISION`, `PUBLIC_TREE`, `SECRET_SCAN`, `SPEC_REVIEW`, `DISTRIBUTION_LIFECYCLE`, `KERNEL_BEHAVIOR`, `MCP_BEHAVIOR`, `AUTHORING_SAFETY`, or `PUBLIC_VISIBILITY`. |
| `result` | enum | yes | `ELIGIBLE`, `INELIGIBLE`, `INCOMPLETE`, `STALE`, or `REVOKED`. |
| `productRevision` | non-empty string | yes | Must equal the reported status revision for both current-candidate and predecessor evidence. |
| `artifactLineageId` | non-empty string or null | yes | Required for non-public-init aggregate evidence and must equal the status lineage; null only for public-init evidence that has no artifact. |
| `bindingRole` | enum | yes | `NONE`, `CURRENT_CANDIDATE`, or `PREDECESSOR_V0_2`. `NONE` is permitted only for public-init evidence without an artifact. |
| `artifactSha256` | 64 lowercase hex characters or null | yes | Null only with `bindingRole: NONE`; must equal status `candidateArtifactSha256` for `CURRENT_CANDIDATE` or status `v02ParentArtifactSha256` for `PREDECESSOR_V0_2`. |
| `targetStage` | `"v0.2"`, `"v0.3"`, or null | yes | Required only for `spec-kernel:FR-14` evidence; `PREDECESSOR_V0_2` requires `"v0.2"` and a current-target kernel result requires `"v0.3"` at v0.3/authoring. |
| `evidenceProfile` | `"kernel-v0.2"`, `"kernel-v0.3"`, or null | yes | Required only for kernel evidence and must form the exact closed pair with `targetStage`. |
| `v02ParentArtifactSha256` | 64 lowercase hex characters or null | yes | On the current v0.3 kernel result, must equal the artifact SHA-256 of the separately identified `PREDECESSOR_V0_2` reference; null on the v0.2 predecessor and all non-v0.3-kernel evidence. |
| `producer` | non-empty string | yes | Real tool, reviewer authority, or observed surface. |
| `producerVersion` | string or null | yes | Required for tools; null only for human/observable-surface evidence. |
| `capturedAt` | RFC 3339 timestamp | yes | Actual capture time; array position or timestamp alone never establishes artifact ancestry. |
| `revokedAt` | RFC 3339 timestamp or null | yes | Must be null for evidence contributing to `DELIVERED`; a non-null value blocks the claim even if `result` was previously `ELIGIBLE`. |
| `artifactPathOrUrl` | non-empty string | yes | Durable evidence location. |
| `sha256` | 64 lowercase hex characters | yes | Hash of the retained evidence bytes, distinct from the product artifact SHA-256. |

For v0.3 and authoring delivery, the evidence array SHALL contain exactly one separately identifiable eligible v0.2 kernel predecessor and one eligible current v0.3 kernel result. The v0.2 reference SHALL be `PREDECESSOR_V0_2`, use `targetStage: "v0.2"` / `evidenceProfile: "kernel-v0.2"`, and have null `v02ParentArtifactSha256`; the v0.3 reference SHALL be `CURRENT_CANDIDATE`, use `targetStage: "v0.3"` / `evidenceProfile: "kernel-v0.3"`, and name the predecessor's exact artifact SHA-256 in `v02ParentArtifactSha256`. This closed pair establishes strict v0.2-before-v0.3 ordering; evidence timestamps and array order do not. Both references SHALL share the status product revision and lineage and have `result: ELIGIBLE` with null `revokedAt`. Current distribution and, for authoring, current authoring evidence SHALL be `CURRENT_CANDIDATE`. Duplicate target stages, singleton/unqualified kernel evidence, a v0.3 result substituted for v0.2, a parent mismatch, a current aggregate bound to the predecessor, or stale/revoked evidence fails closed.

Specification documents and scenario files SHALL NOT use `result: ELIGIBLE` merely because they exist.

## Blocker record

| Field | Type | Required | Rules |
|---|---|---:|---|
| `blockerId` | non-empty string | yes | Stable within the status record. |
| `requirementIds` | array of canonical IDs | yes | At least one owning/affected requirement. |
| `class` | enum | yes | `PROVENANCE`, `LICENSE`, `SECURITY`, `PUBLIC_TREE`, `SPECIFICATION`, `IDENTITY`, `DISTRIBUTION`, `KERNEL`, `MCP`, `AUTHORING`, or `EVIDENCE`. |
| `summary` | non-empty string | yes | Plain-language reason the claim is not eligible. |
| `remediation` | non-empty string | yes | Concrete next action or owner decision. |
| `sourceEvidenceId` | string or null | yes | Required when an evidence artifact produced the blocker. |

## PublicationGate record

| Field | Type | Required | Rules |
|---|---|---:|---|
| `sourceFreeze` | gate result | yes | Eligible only after actual independent byte/hash comparison. |
| `redistributionLicense` | gate result | yes | Eligible only after authorized coverage for every copied item. |
| `publicTree` | gate result | yes | Eligible only when all paths are allowed. |
| `secretScan` | gate result | yes | Eligible only with zero unresolved findings. |
| `specificationReview` | gate result | yes | Eligible only when canonical target specs are complete and truthful. |
| `managerReadability` | gate result | yes | Eligible only when current/non-current claims and blockers are clear. |
| `publicDiffReview` | gate result | yes | Eligible only for the exact candidate revision. |
| `overall` | gate result | yes | `ELIGIBLE` only when every preceding field is `ELIGIBLE`; otherwise fail closed. |

Each gate result is one of `ELIGIBLE`, `INELIGIBLE`, or `INCOMPLETE`. There is no “warning but pass” state.

## Current logical instance

The current public-init instance is:

- `stage`: `PUBLIC_INIT`
- `state`: `SPEC_ONLY`
- `licenseEvidence`: `LICENSE_RESOLVED`
- `publicInitValidation`: `PUBLIC_INIT_VALIDATED`
- `publicVisibility`: `LOCAL_ONLY`
- `installable`: `false`
- `artifactLineageId`, `candidateArtifactSha256`, `v02ParentArtifactSha256`: `null`
- `marketplaceName`, `pluginName`, `installedIdentity`: `null`
- all three cardinality counts: `0`
- `executedScenarioEvidence`: `false`
- remaining blockers: independent source-freeze, specification, secret/public-tree, and public-diff validation

This instance is a specification-aligned description of the observed repository state, not an executed acceptance result.
