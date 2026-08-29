# Spec Capability Schema

Future `spec-capability@2` extends `spec-kernel@2`; no runtime delivery is claimed. Unknown fields fail closed. All IDs are qualified and all public objects are closed.

## Identities, documents, and nodes

```ts
type PositiveInt = number; // integer >=1, canonical decimal, no leading zero
type CapabilityLocalId = `CAP-${PositiveInt}` | `CAP-${PositiveInt}.${PositiveInt}`;
type CapabilityCanonicalId = `${SpecSlug}:${CapabilityLocalId}`;
type CapabilityLifecycle = "LIVE" | "ARCHIVED";
type RequirementLifecycle = "LIVE" | "ARCHIVED";
```

A capability lives only in optional `.specs/<owning-spec>/CAPABILITIES.md`, a V2 `CAPABILITY_DOCUMENT`; no repository-root singleton/frontmatter is valid. Level-2 `## CAP-N: title` and nested level-3 `### CAP-N.M: title` define nodes. Canonical ID is `<owning-spec>:CAP-N[.M]`.

```ts
interface CapabilityNodeV2 {
  canonicalId:CapabilityCanonicalId;
  localId:CapabilityLocalId;
  specSlug:SpecSlug;
  kind:"CAPABILITY";
  title:string;
  description:string;
  parentId:CapabilityCanonicalId|null;
  lifecycle:CapabilityLifecycle;
  source:NodeSourceV2; // CAPABILITY_DOCUMENT
  contentHash:Sha256;
}
```

Nested nodes share parent slug/prefix. Duplicate IDs preserve candidates, elect no node and emit kernel `DUPLICATE_DEFINITION`; no separate duplicate diagnostic exists.

## Declarations, edges, and diagnostics

Requirements that declare derivation SHALL contain both `**Covers:** [<qualified CAP>](...)` and `**Capability lifecycle:** LIVE|ARCHIVED`. The capability extension parses lifecycle from the same canonical FR/NFR section bytes into `RequirementCapabilityStateV2`; no caller sidecar or path inference exists. `DERIVES_FROM` endpoints are exactly:

- `FUNCTIONAL_REQUIREMENT | NON_FUNCTIONAL_REQUIREMENT -> CAPABILITY`;
- child `CAPABILITY ->` parent `CAPABILITY`.

`**Requirement:**` remains ordinary `REFS`. Capability lifecycle is authored, never inferred from path.

interface RequirementCapabilityStateV2 {canonicalId:CanonicalId;lifecycle:RequirementLifecycle;source:NodeSourceV2;contentHash:Sha256}

Capability-specific diagnostics are exactly:

- `CAPABILITY_INVALID_ID` ERROR;
- `CAPABILITY_REQUIREMENT_LIFECYCLE_MISSING` ERROR;
- `CAPABILITY_DANGLING` ERROR;
- `CAPABILITY_FORBIDDEN_ENDPOINT` ERROR;
- `CAPABILITY_ORPHAN` WARNING;
- `SPEC_WITHOUT_CAPABILITY` INFO.

Duplicates use `DUPLICATE_DEFINITION`. Diagnostics use kernel bounded records and repository-relative paths.

## Pure graph query service

```ts
interface RequirementSummaryV2 {canonicalId:CanonicalId;kind:"FUNCTIONAL_REQUIREMENT"|"NON_FUNCTIONAL_REQUIREMENT";title:string;lifecycle:RequirementLifecycle;source:NodeSourceV2;contentHash:Sha256}
interface CapabilitySummaryV2 {canonicalId:CapabilityCanonicalId;title:string;parentId:CapabilityCanonicalId|null;lifecycle:CapabilityLifecycle;source:NodeSourceV2}
interface StructuralImpactV2 {requirementId:CanonicalId;acIds:CanonicalId[];directScenarioIds:CanonicalId[];scenarioIdsViaAc:CanonicalId[];taskIds:CanonicalId[];codeFileIds:CanonicalId[];dependentRequirementIds:CanonicalId[];capabilityIds:CapabilityCanonicalId[]}

type CapabilityQueryRequestV2 =
 | {schemaVersion:"spec-capability@2";requestId:string|null;operation:"requirementsOf";args:{capabilityId:CapabilityCanonicalId;includeArchived:boolean;limit?:number;cursor?:string|null}}
 | {schemaVersion:"spec-capability@2";requestId:string|null;operation:"capabilitiesOf";args:{specSlug:SpecSlug;includeInherited:boolean;lifecycle:CapabilityLifecycle|"ALL";limit?:number;cursor?:string|null}}
 | {schemaVersion:"spec-capability@2";requestId:string|null;operation:"getImpact";args:{requirementId:CanonicalId;maxDepth:number;maxVisited:number;limit?:number;cursor?:string|null}};

type CapabilityQueryDataV2 =
 | {kind:"requirements";capabilityId:CapabilityCanonicalId;requirements:RequirementSummaryV2[];total:number;returned:number;truncated:boolean;nextCursor:string|null}
 | {kind:"capabilities";specSlug:SpecSlug;capabilities:CapabilitySummaryV2[];total:number;returned:number;truncated:boolean;nextCursor:string|null}
 | {kind:"impact";structural:StructuralImpactV2;semanticRecheckIds:CanonicalId[];total:number;returned:number;truncated:boolean;nextCursor:string|null};

type CapabilityQueryErrorCode="CAPABILITY_NOT_FOUND"|"INVALID_CAPABILITY_ID"|"INVALID_IMPACT_START"|"SPEC_NOT_FOUND"|"LIMIT_EXCEEDED"|"CURSOR_INVALID"|"INVALID_PARAMETER";
type CapabilityQueryEnvelopeV2=
 | {ok:true;schemaVersion:"spec-capability@2";requestId:string|null;operation:CapabilityQueryRequestV2["operation"];graphFingerprint:Sha256;data:CapabilityQueryDataV2}
 | {ok:false;schemaVersion:"spec-capability@2";requestId:string|null;operation:CapabilityQueryRequestV2["operation"]|null;graphFingerprint:Sha256|null;error:{code:CapabilityQueryErrorCode;message:string}};
```

Omitted `limit` defaults to 50 and maximum is 200; omitted cursor is null; `maxDepth` 0..8; `maxVisited` 1..5,000; strings <=200 scalars; canonical response <=512 KiB. Arrays sort by canonical ID. Cursors bind graph fingerprint/operation/args. Overflow pages at item boundaries with exact totals; one oversized item returns `LIMIT_EXCEEDED`. Error precedence is request/schema/cursor, missing spec/capability/start node, traversal/visit/response limits. `getImpact` accepts requirement nodes only and never returns producer IDs.

## Evidence invalidation overlay

The overlay consumes exact bytes of one complete `spec-evidence@2` evaluation output; callers cannot submit a custom result projection or claimed fingerprint.

```ts
interface HashDimensionV2 {applicable:boolean;hash:Sha256|null}
interface CapabilityOverlayLimitsV1 {maxEvidenceBytes:number;maxRows:number;maxResponseBytes:number;deadlineMs:number} // <=64 MiB, <=100,000 rows, <=1 MiB, <=5,000 ms
interface EvidenceEvaluationDocumentV1 {path:string;bytes:Uint8Array;sha256:Sha256}
interface InvalidateEvidenceRequestV1 {
  schemaVersion:"spec-capability-evidence@1";
  requestId:string|null;
  impact:StructuralImpactV2;
  currentKernel:{graphFingerprint:Sha256;scenarios:{canonicalScenarioId:CanonicalId;contentHash:Sha256;stepBindingSet:HashDimensionV2;implementationArtifact:HashDimensionV2}[]};
  evidenceSnapshot:{document:EvidenceEvaluationDocumentV1;parsed:EvidenceEvaluationOutputV2}; // exact closed type from spec-evidence_SCHEMA.md
  limits:CapabilityOverlayLimitsV1;
  limit?:number; // default 50, max 200
  cursor?:string|null;
}
interface EvidenceInvalidationRowV1 {producerResultId:string;canonicalScenarioId:CanonicalId;outcome:"STALE"|"UNAFFECTED"|"INDETERMINATE";reasons:("GRAPH_CHANGED"|"SCENARIO_CHANGED"|"STEP_BINDINGS_CHANGED"|"IMPLEMENTATION_CHANGED"|"GRAPH_BINDING_MISSING"|"SCENARIO_BINDING_MISSING"|"STEP_BINDINGS_MISSING"|"IMPLEMENTATION_BINDING_MISSING")[]}
interface InvalidateEvidenceDataV1 {rows:EvidenceInvalidationRowV1[];total:number;returned:number;truncated:boolean;nextCursor:string|null;counts:{stale:number;unaffected:number;indeterminate:number};bindingProof:{evidenceDocumentSha256:Sha256;evidenceDeterministicFingerprint:Sha256;evidenceGraphFingerprint:Sha256;currentGraphFingerprint:Sha256;impactedScenarioIds:CanonicalId[]}}
type InvalidateEvidenceErrorCodeV1="INVALID_REQUEST"|"INVALID_PARAMETER"|"EVIDENCE_HASH_MISMATCH"|"EVIDENCE_PARSE_FAILED"|"EVIDENCE_FINGERPRINT_MISMATCH"|"KERNEL_BINDING_MISMATCH"|"LIMIT_EXCEEDED"|"CURSOR_INVALID"|"RESPONSE_TOO_LARGE";
type InvalidateEvidenceEnvelopeV1=
 | {ok:true;schemaVersion:"spec-capability-evidence@1";requestId:string|null;data:InvalidateEvidenceDataV1}
 | {ok:false;schemaVersion:"spec-capability-evidence@1";requestId:string|null;error:{code:InvalidateEvidenceErrorCodeV1;message:string;retryable:boolean;parameter:string|null;expected:string|null}};
```

The overlay re-hashes `document.bytes`, parses the exact closed `EvidenceEvaluationOutputV2`, and recomputes its `deterministicFingerprint` using `evidence-canonical-json@1`; `parsed` must byte-equal that parse and its fingerprint/hash must match. Rows are derived only from parsed producer/freshness records for impacted scenarios. Reason precedence is closed: evaluate graph, scenario, step bindings, implementation in that order; any unequal value or applicability mismatch adds *_CHANGED and makes outcome STALE even if another dimension is missing; otherwise any applicable-null value adds the matching *_MISSING reason and makes INDETERMINATE; otherwise outcome is UNAFFECTED with `reasons:[]`.

Rows sort by `(canonicalScenarioId,producerResultId)`. Cursor binds request args, evidence deterministic fingerprint and current graph fingerprint. Paging occurs only at row boundaries with exact total/counts; one oversized row returns RESPONSE_TOO_LARGE. The adapter rejects evidence bytes above 64 MiB before parse; evaluation checks the 5,000 ms deadline at least every 1,024 rows/10 ms. Request/result and both fingerprints are capped by `maxEvidenceBytes`, `maxRows`, `limit`, and 1 MiB canonical response. No evidence snapshot means a typed failure, never producer IDs.

## MCP-only projection

Agent-facing capability operations are MCP only. Graph profile maps `requirements_of`, `capabilities_of`, `get_impact`; overlay profile additionally maps `invalidate_evidence`. Each is one-to-one with the envelopes above. No capability `pi.registerTool`, LSP agent API, mutation, proposal, repair, status transition, second graph or adapter-side semantic filtering is permitted.

## Release evidence and eligibility

```ts
type CapabilityFrCheckId="CHK-FR1-01"|"CHK-FR2-01"|"CHK-FR3-01"|"CHK-FR4-01"|"CHK-FR5-01"|"CHK-FR6-01"|"CHK-FR6-02"|"CHK-FR7-01"|"CHK-FR8-01"|"CHK-FR8-02"|"CHK-FR9-01"|"CHK-FR10-01";
type CapabilityNfrCheckId="CHK-NFR-PERF-01"|"CHK-NFR-SIZE-01"|"CHK-NFR-MEM-01"|"CHK-NFR-SEC-01"|"CHK-NFR-REL-01"|"CHK-NFR-USE-01";
type CapabilityCheckId=CapabilityFrCheckId|CapabilityNfrCheckId;
type CapabilityRequirementId=
 | "spec-capability:FR-1"|"spec-capability:FR-2"|"spec-capability:FR-3"|"spec-capability:FR-4"|"spec-capability:FR-5"
 | "spec-capability:FR-6"|"spec-capability:FR-7"|"spec-capability:FR-8"|"spec-capability:FR-9"|"spec-capability:FR-10"
 | "spec-capability:NFR-PERF-1"|"spec-capability:NFR-SIZE-1"|"spec-capability:NFR-MEM-1"
 | "spec-capability:NFR-SEC-1"|"spec-capability:NFR-REL-1"|"spec-capability:NFR-USE-1";

type CapabilityEvidenceRole="PRODUCT_BASELINE"|"KERNEL_CAPABILITY_ELIGIBILITY"|"CHECK_EVIDENCE"|"SPEC_EVIDENCE_MCP_ELIGIBILITY"|"SPEC_EVIDENCE_EVALUATION";
interface CapabilityEvidenceDocumentV2 {role:CapabilityEvidenceRole;path:string;bytes:Uint8Array;sha256:Sha256}
interface ProductBaselineProjectionV2 {schemaVersion:1;stage:"V0_3_READONLY_MCP";state:"DELIVERED";productRevision:string;artifactLineageId:string;candidateArtifactSha256:Sha256;v02ParentArtifactSha256:Sha256;evidence:{sha256:Sha256;bindingRole:"CURRENT_CANDIDATE"|"PREDECESSOR_V0_2";artifactSha256:Sha256;result:"ELIGIBLE";revokedAt:null}[];blockers:[]}
interface KernelCapabilityAdmissionV2 {schemaVersion:"kernel-capability-eligibility@2";profile:"kernel-anchor-migration@1";eligible:true;candidateArtifactSha256:Sha256;baselineArtifactSha256:Sha256;requiredCheckIds:["CHK-FR13-02"];passedCheckIds:["CHK-FR13-02"];blockers:[];evidenceFingerprint:Sha256}
interface CapabilityBaselineV2 {product:{path:string;sha256:Sha256;parsed:ProductBaselineProjectionV2};kernel:{path:string;sha256:Sha256;parsed:KernelCapabilityAdmissionV2}}
interface CapabilityCheckRecordV2 {checkId:CapabilityCheckId;requirementId:CapabilityRequirementId;status:"PASS"|"FAIL"|"MISSING"|"STALE"|"MISMATCH"|"UNVERIFIABLE";evidence:{path:string;sha256:Sha256;claim:string}[];candidateArtifactSha256:Sha256}
interface CapabilityReleaseManifestV2 {schemaVersion:"spec-capability-release@2";profile:"spec-capability-graph@1"|"spec-capability-evidence-overlay@1";baseline:CapabilityBaselineV2;candidateRevision:string;candidateArtifactSha256:Sha256;evidenceMcpEligibility:{path:string;sha256:Sha256}|null;evidenceEvaluation:{path:string;sha256:Sha256;deterministicFingerprint:Sha256}|null;evidenceDocuments:CapabilityEvidenceDocumentV2[];records:CapabilityCheckRecordV2[]}

type CapabilityReleaseBlockerCode="BASELINE_MISSING"|"BASELINE_UNBOUND"|"BASELINE_INELIGIBLE"|"CHECK_MISSING"|"CHECK_EXTRA"|"CHECK_DUPLICATE"|"CHECK_FAILED"|"CHECK_STALE"|"CHECK_MISMATCH"|"CHECK_UNVERIFIABLE"|"EVIDENCE_EMPTY"|"EVIDENCE_DOCUMENT_MISSING"|"EVIDENCE_HASH_MISMATCH"|"ARTIFACT_BINDING_MISMATCH"|"EVIDENCE_OVERLAY_BINDING_MISMATCH";
interface CapabilityReleaseEligibilityV2 {schemaVersion:"spec-capability-eligibility@2";profile:CapabilityReleaseManifestV2["profile"]|null;eligible:boolean;candidateRevision:string;candidateArtifactSha256:Sha256;baselineArtifactSha256:Sha256|null;requiredCheckIds:CapabilityCheckId[];passedCheckIds:CapabilityCheckId[];blockers:{checkId:CapabilityCheckId|null;code:CapabilityReleaseBlockerCode;evidencePath:string|null}[];evidenceFingerprint:Sha256}
```

Graph profile membership is exactly ten FR checks (`CHK-FR1-01`..`CHK-FR5-01`, `CHK-FR6-01`, `CHK-FR7-01`, `CHK-FR8-01`, `CHK-FR9-01`, `CHK-FR10-01`) plus all six NFR checks: 16 records. Overlay adds `CHK-FR6-02` and `CHK-FR8-02`: 18 records. Graph profile requires both overlay refs null and rejects overlay records as extra. Overlay requires a rehashed eligible `spec-evidence-release-eligibility@2` document for profile `spec-evidence-mcp@1` and a rehashed `EvidenceEvaluationOutputV2` whose recomputed deterministic fingerprint equals `evidenceEvaluation.deterministicFingerprint` and the overlay input.

The evaluator re-hashes every evidence document. It parses the PRODUCT_BASELINE bytes as the closed delivered ProductStatus projection, requires nonempty lineage/current/predecessor evidence and no blockers, and requires its current artifact to equal `kernel.parsed.baselineArtifactSha256`. It parses KERNEL_CAPABILITY_ELIGIBILITY bytes, requires eligible `kernel-anchor-migration@1`, and requires its candidate artifact to equal this manifest candidate. Baseline structs are projections of those exact parsed bytes, not caller assertions.

`CHK-FRN-*` maps only to `spec-capability:FR-N`; each NFR check maps only to the same named qualified NFR. Evidence refs resolve to role CHECK_EVIDENCE except the exact baseline/overlay refs. Documents sort by `(role,path)`, records by the profile's required-check order, refs by `(path,sha256,claim)`, blockers by check order/code/path, and output IDs/rows by canonical ID (overlay rows by scenario/result as above).

Canonical bytes are UTF-8 JSON with lexicographic object keys, NFC strings, POSIX-relative paths and schema-declared array order. `evidenceFingerprint` is SHA-256 over canonical `{schemaVersion,profile,baseline parsed document hashes,candidateRevision,candidateArtifactSha256,overlay refs,evidenceDocuments:[{role,path,sha256}],records}` with raw bytes and result fields excluded. Missing/extra/duplicate/failed/stale/mismatched/unbound input fails deterministically. Prose/scenarios are never evidence.
