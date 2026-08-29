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

## Baseline release stage

Closed enumeration:

| Value | Meaning | Required canonical gates |
|---|---|---|
| `PUBLIC_INIT` | Specification/provenance repository; no installable plugin. | `product:FR-1` through `product:FR-4`, plus public documentation gates. |
| `V0_1_READONLY_INVENTORY` | One plugin with first bounded read-only value. | Historical accepted `distribution-release-eligibility@1` owned by `plugin-distribution:FR-13`. |
| `V0_2_READONLY_KERNEL` | Typed bounded graph/query kernel in the same plugin. | Candidate-applicable distribution result plus `spec-kernel:FR-14` `targetStage:"v0.2"`. |
| `V0_3_READONLY_MCP` | Eight-tool read-only MCP first slice over the same query service. | Published v0.3.2 is admitted only by `historical-v0.3.2@1` and its bounded release/MRI/distribution-attestation record; every new candidate uses `product-status@2` with distribution @2 plus current v0.3 kernel result and exact linked active v0.2 predecessor. |

## Capability delivery map

`CapabilityId` is the closed union `GENERATOR_READS | LSP_ADAPTER | EVIDENCE_MCP | CAPABILITY_GRAPH | AUTHORING_MCP | SPEC_ENFORCEMENT | AUTOMATIC_PLAN_GATE`.

Each `CapabilityDelivery` has exact fields:

| Field | Type | Required | Rule |
|---|---|---:|---|
| `capabilityId` | `CapabilityId` | yes | Unique within one ProductStatus. |
| `state` | `SPEC_ONLY | PLANNED | SPECIFIED | DEFERRED | DEFERRED_HOST_ABI | BLOCKED | DELIVERED` | yes | Most conservative evidence-derived state. |
| `ownerIds` | qualified canonical ID[] | yes | Non-empty exact owning FR/check IDs. |
| `requiredAggregateIds` | qualified canonical ID[] | yes | Closed dependency set for this capability. |
| `acceptedEvidence` | evidence reference[] | yes | Empty unless records are current, hash-valid and accepted. |
| `blockers` | blocker[] | yes | Empty only for DELIVERED. |

Capability dependencies are selected by `product:FR-6`; they never replace the baseline stage or another capability's aggregate.

Exact capability map:

| CapabilityId | `ownerIds` exact tuple | `requiredAggregateIds` exact tuple | Current state |
|---|---|---|---|
| `GENERATOR_READS` | `spec-kernel:FR-16`, `spec-kernel:FR-17` | `product:FR-6`, `spec-kernel:CHK-FR16-01`, `spec-kernel:CHK-FR17-01` | `SPECIFIED` |
| `LSP_ADAPTER` | `spec-lsp:FR-1`, `spec-lsp:FR-12` | `product:FR-6`, `spec-lsp:FR-12` | `SPECIFIED` |
| `EVIDENCE_MCP` | `spec-evidence:FR-13`, `spec-evidence:FR-14` | `product:FR-6`, `spec-evidence:FR-13`, `spec-evidence:FR-14` | `SPECIFIED` |
| `CAPABILITY_GRAPH` | `spec-capability:FR-6`, `spec-capability:FR-9` | `product:FR-6`, `spec-capability:FR-9` | `SPECIFIED` |
| `AUTHORING_MCP` | `spec-authoring-workflow:FR-13`, `spec-authoring-workflow:FR-14` | `product:FR-6`, `spec-evidence:FR-13`, `spec-evidence:FR-14`, `spec-authoring-workflow:FR-13`, `spec-authoring-workflow:FR-14`, `spec-enforcement:FR-1`, `spec-enforcement:FR-11`, `spec-enforcement:CHK-FR1-01` | `DEFERRED_HOST_ABI` |
| `SPEC_ENFORCEMENT` | `spec-enforcement:FR-1`, `spec-enforcement:FR-11` | the exact same joint tuple plus accepted `tool-call-authority-abi@1` host receipt | `DEFERRED_HOST_ABI` |
| `AUTOMATIC_PLAN_GATE` | `plan-gate:FR-1`, `plan-gate:FR-13` | `product:FR-6`, `plan-gate:FR-13`, `plan-gate:CHK-HOST-ABI-01` | `DEFERRED_HOST_ABI` |

`AUTHORING_MCP` and `SPEC_ENFORCEMENT` are a joint delivery boundary: the
authoring service may be implemented/evaluated while deferred, but no user
mutation/API delivery claim is accepted unless both rows' identical tuple is
complete. All seven rows require the delivered v0.3 baseline through
`product:FR-6`.

## Capability state

Closed enumeration:

| Value | Meaning |
|---|---|
| `SPEC_ONLY` | Normative documents/policies exist; executable capability is absent. |
| `PLANNED` | Scope is approved but the implementable contract is incomplete; accepted implementation/release evidence is absent. |
| `SPECIFIED` | The closed implementable contract is complete, but accepted implementation/release evidence is absent. |
| `DEFERRED` | Scope is intentionally outside the active capability set. |
| `DEFERRED_HOST_ABI` | Contract is complete, but the pinned host lacks one explicitly named ABI; no simulated support is permitted. |
| `BLOCKED` | A required gate failed or its declared evidence is missing/invalid. |
| `DELIVERED` | Current observable evidence satisfies the exact baseline or capability aggregate. |

Precedence when multiple states appear applicable:

```text
BLOCKED > SPEC_ONLY > DEFERRED_HOST_ABI > DEFERRED > (PLANNED iff contractComplete=false; SPECIFIED iff contractComplete=true) > DELIVERED
```

`PLANNED` and `SPECIFIED` are mutually exclusive by `contractComplete`; absent evidence alone never chooses between them. Baseline `DELIVERED` requires the matching baseline row and status profile. Capability `DELIVERED` requires every `CapabilityDelivery.requiredAggregateIds` record; it is never inherited from the baseline or a sibling capability. Every `CURRENT_CANDIDATE` reference must match `ProductStatus.candidateArtifactSha256`. The sole permitted different-artifact baseline binding is the exact active v0.2 predecessor named by the v0.3 kernel result. Historical, member-subset, structural-only, stale or revoked evidence fails closed.

## ProductStatus record

| Field | Type | Required | Rules |
|---|---|---:|---|
| `schemaVersion` | positive integer | yes | Begins at `1`; unknown versions fail closed. |
| `statusProfile` | enum | yes | `historical-v0.3.2@1` for the one bounded published legacy instance; `product-status@2` for every new evaluation. |
| `product` | Product identity | yes | Must satisfy the identity schema above. |
| `stage` | Baseline release-stage enum | yes | Delivered baseline being reported. |
| `state` | Capability state enum | yes | Conservative state of the baseline stage. |
| `productRevision` | non-empty string | yes | Immutable commit/release identifier for the evaluated product tree. |
| `evaluatedAt` | RFC 3339 timestamp | yes | Time the status was calculated, not a planned date. |
| `artifactLineageId` | non-empty string or null | yes | Null at public init and the bounded `historical-v0.3.2@1` instance; required by `product-status@2` after public init. |
| `candidateArtifactSha256` | 64 lowercase hex characters or null | yes | `null` at public init; otherwise the exact current candidate artifact. Current distribution, current target-stage kernel, and current authoring evidence must match it. |
| `v02ParentArtifactSha256` | 64 lowercase hex characters or null | yes | Null for public init/v0.1/v0.2 and bounded `historical-v0.3.2@1`; required for v0.3/authoring under `product-status@2`. |
| `claimIds` | array of canonical IDs | yes | Non-empty for a capability claim; no duplicates. A non-public-init stage claim SHALL include every aggregate ID required by its cumulative stage row. |
| `evidence` | array of EvidenceRef | yes | Empty is permitted only for non-delivered states and must produce an explanatory blocker. A delivered public-init status must include all accepted local publication gates; a delivered later stage must include accepted evidence for every cumulative aggregate gate with explicit binding roles. |
| `blockers` | array of Blocker | yes | Empty only when every required public-init gate is eligible or every cumulative later-stage aggregate satisfies the current/predecessor binding, freshness, revocation, revision, and lineage rules. |
| `nextGateIds` | array of canonical IDs | yes | Required for `SPEC_ONLY`, `PLANNED`, `SPECIFIED`, `DEFERRED`, `DEFERRED_HOST_ABI`, or `BLOCKED`; identify every missing aggregate/host gate. |
| `publicVisibility` | enum | yes | `LOCAL_ONLY`, `PRIVATE`, `PUBLIC`, or `UNKNOWN`; never inferred from repository naming. |
| `installable` | boolean | yes | `false` at public init; true only when the candidate-applicable versioned distribution result owned by `plugin-distribution:FR-13` is accepted for the reported revision/artifact/lineage (historical @1 through v0.3.2, @2 for new candidates). |
| `executedScenarioEvidence` | boolean | yes | True only when current external runner evidence is linked; Gherkin presence alone yields false. |
| `capabilities` | `CapabilityDelivery[]` | yes | Exactly one row for every closed `CapabilityId`, sorted by enum order. |

## EvidenceRef record

| Field | Type | Required | Rules |
|---|---|---:|---|
| `evidenceId` | non-empty string | yes | Stable identifier within the evidence store. |
| `requirementIds` | array of canonical IDs | yes | At least one; every ID must exist. |
| `kind` | enum | yes | `SOURCE_FREEZE`, `LICENSE_DECISION`, `PUBLIC_TREE`, `SECRET_SCAN`, `SPEC_REVIEW`, `DISTRIBUTION_LIFECYCLE`, `KERNEL_BEHAVIOR`, `MCP_BEHAVIOR`, `AUTHORING_SAFETY`, or `PUBLIC_VISIBILITY`. |
| `result` | enum | yes | `ELIGIBLE`, `INELIGIBLE`, `INCOMPLETE`, `STALE`, or `REVOKED`. |
| `productRevision` | non-empty string | yes | Must equal the reported status revision for both current-candidate and predecessor evidence. |
| `artifactLineageId` | non-empty string or null | yes | Required and status-equal for `product-status@2` non-public-init evidence; null is also permitted for bounded `historical-v0.3.2@1` refs. |
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

For `product-status@2` v0.3 and authoring delivery, the evidence array SHALL contain exactly one separately identifiable eligible v0.2 kernel predecessor and one eligible current v0.3 kernel result. The v0.2 reference SHALL be `PREDECESSOR_V0_2`, use `targetStage: "v0.2"` / `evidenceProfile: "kernel-v0.2"`, and have null `v02ParentArtifactSha256`; the v0.3 reference SHALL be `CURRENT_CANDIDATE`, use `targetStage: "v0.3"` / `evidenceProfile: "kernel-v0.3"`, and name the predecessor's exact artifact SHA-256 in `v02ParentArtifactSha256`. This closed pair establishes strict v0.2-before-v0.3 ordering; evidence timestamps and array order do not. Both references SHALL share the status product revision and lineage and have `result: ELIGIBLE` with null `revokedAt`. Current distribution and, for authoring, current authoring evidence SHALL be `CURRENT_CANDIDATE`. Duplicate target stages, singleton/unqualified kernel evidence, a v0.3 result substituted for v0.2, a parent mismatch, a current aggregate bound to the predecessor, or stale/revoked evidence fails closed.

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

## Historical v0.3.2 status profile

`historical-v0.3.2@1` is accepted only for exact tag `v0.3.2`, product revision `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate/archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`, and status source `docs/validation/release-status-v0.3.2.json`. It requires public/installable true, evidence schema `omp-spec-kit-release-evidence@3`, exact MRI/distribution receipt digests, verified release asset attestation, verified distribution subject/repository/workflow/ref/Rekor identity, and zero baseline blockers. Its `artifactLineageId` and `v02ParentArtifactSha256` are null because those fields were not produced by the historical release; no value is invented retrospectively.

This profile cannot evaluate another version/revision/artifact and cannot satisfy any post-v0.3 capability row. Every new candidate uses `product-status@2` and the strict current/predecessor lineage rules above. Historical evidence refs use `CURRENT_CANDIDATE`, the exact archive hash, null lineage/stage/profile/parent, and hashes of retained release/evidence/attestation bytes.

## Current logical instance

The current evidence-bound instance is:

- `statusProfile`: `historical-v0.3.2@1`
- `stage`: `V0_3_READONLY_MCP`
- `state`: `DELIVERED`
- `productRevision`: `2938389e34e2d06bdd497291ed01e0a2d89146c9`
- `publicVisibility`: `PUBLIC`
- `installable`: `true`
- `candidateArtifactSha256`: `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`
- `artifactLineageId`: null (historical profile)
- `v02ParentArtifactSha256`: null (historical profile)
- baseline evidence: current candidate/evidence asset and distribution-attestation refs from the bounded status record; no fabricated kernel predecessor ref
- `marketplaceName`, `pluginName`: `omp-spec-kit`
- `installedIdentity`: `omp-spec-kit@omp-spec-kit`
- marketplace/plugin/extension cardinality counts: `1`
- `executedScenarioEvidence`: `true` only for receipts explicitly listed in `docs/validation/release-status-v0.3.2.json`
- `statusEvidence`: `docs/validation/release-status-v0.3.2.json`
- post-v0.3 capability states: independently `SPECIFIED`, `DEFERRED`, or `DEFERRED_HOST_ABI`; none is implied by baseline delivery

Current `capabilities` is exactly seven rows in map order, each with the
owner/aggregate tuples above, `acceptedEvidence:[]`, and one blocker:

| CapabilityId | State | Blocker ID / class | Summary / remediation |
|---|---|---|---|
| `GENERATOR_READS` | `SPECIFIED` | `generator-profiles-not-accepted` / `KERNEL` | FR-16/17 profile receipts absent; produce both standalone eligibility results |
| `LSP_ADAPTER` | `SPECIFIED` | `lsp-profile-not-accepted` / `EVIDENCE` | LSP release profile absent; produce complete `spec-lsp:FR-12` evidence |
| `EVIDENCE_MCP` | `SPECIFIED` | `evidence-profile-not-accepted` / `EVIDENCE` | Evidence evaluator/MCP aggregate absent; satisfy FR-13/FR-14 |
| `CAPABILITY_GRAPH` | `SPECIFIED` | `capability-profile-not-accepted` / `KERNEL` | Kernel@2 capability aggregate absent; satisfy `spec-capability:FR-9` |
| `AUTHORING_MCP` | `DEFERRED_HOST_ABI` | `joint-authoring-enforcement-host-abi-not-accepted` / `EVIDENCE` | Joint evidence/authoring/enforcement tuple and authenticated tool-call host ABI are incomplete |
| `SPEC_ENFORCEMENT` | `DEFERRED_HOST_ABI` | `enforcement-tool-authority-host-abi-absent` / `EVIDENCE` | Joint tuple remains required and pinned OMP v17.3.7 lacks provider/server/schema authority fields; adopt/prove `tool-call-authority-abi@1` |
| `AUTOMATIC_PLAN_GATE` | `DEFERRED_HOST_ABI` | `selected-plan-host-abi-absent` / `EVIDENCE` | Pinned OMP lacks `plan-gate:CHK-HOST-ABI-01`; adopt/prove a supported pin |

Every blocker has `sourceEvidenceId:null` because no accepted failing evidence
artifact exists; it names an absent gate. The full blocker record uses the
row's owner/required IDs, the exact summary above, and the remediation after the
semicolon.

The public-init/v0.1/v0.2/v0.3.0/v0.3.1 records remain historical stage evidence. This current instance is derived from the bounded public-release status record, not from README prose or unexecuted Gherkin.
