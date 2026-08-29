# Plan Gate Schema

Current contract version is `plan-gate@2`. It separates implementable `MANUAL` validation from future `AUTOMATIC` approval interception. The validator is pure over one closed input; adapters own I/O and translate internal faults into a bounded ALLOW result before the host's outer timeout.

## Validation input

```ts
type PlanGateMode = "MANUAL" | "AUTOMATIC";
type PlanGateHostContract = "explicit-plan-input@1" | "selected-plan-event@1";
type PlanTransitionKind = "SAME_SESSION" | "HOST_APPROVAL_FORK";

interface ExactPlanInputV2 {
  fileUrl: string;
  content: string;
  sha256: string;
  suppliedTitle: string;
  normalizedSlug: string;
}

interface PlanSessionBindingV2 {
  selectionSessionId: string;
  approvalSessionId: string;
  transitionKind: PlanTransitionKind;
  transitionPlanSha256: string;
  planMode: boolean;
  hostContractVersion: PlanGateHostContract;
}

interface DuplicateCandidateV2 {
  fileUrl: string;
  byteCount: number;
  content: string;
  sha256: string;
}

interface PromptExcerptV2 {
  ordinal: number;
  role: "user";
  content: string;
  sha256: string;
}

interface SpecReferenceEntryV2 {
  qualifiedId: string;
  documentPath: string;
  heading: string;
  contentSha256: string;
}

interface SpecReferenceIndexV2 {
  schemaVersion: "plan-gate-spec-index@1";
  complete: true;
  entries: SpecReferenceEntryV2[];
  aggregateSha256: string;
}

type GuardedPathPatternV1 =
  | ".specs/**"
  | "MIGRATION_MATRIX.md"
  | "ROADMAP.md"
  | "docs/decisions/**";

interface GuardedPathPolicyV1 {
  schemaVersion: "plan-gate-guarded-paths@1";
  patterns: GuardedPathPatternV1[]; // exact four values above, exact order
  sha256: string;
}

interface GateResourcesV2 {
  planTemplate: { content: string; sha256: string };
  sectionModel: { content: string; sha256: string };
  guardedPathPolicy: GuardedPathPolicyV1;
  inventorySha256: string;
}

interface PlanValidationInputV2 {
  schemaVersion: "plan-gate@2";
  requestId: string;
  mode: PlanGateMode;
  plan: ExactPlanInputV2;
  session: PlanSessionBindingV2;
  duplicateCandidates: DuplicateCandidateV2[];
  promptCache: PromptExcerptV2[];
  specReferenceIndex: SpecReferenceIndexV2;
  resources: GateResourcesV2;
  limits: GateLimitsV2;
}
```

`MANUAL` requires `explicit-plan-input@1`, `selectionSessionId == approvalSessionId`, `transitionKind:"SAME_SESSION"`, and exact caller-supplied plan bytes. `AUTOMATIC` requires `selected-plan-event@1` from `docs/omp-plan-approval-event-contract.md`. For a same-session event the IDs are equal; for `HOST_APPROVAL_FORK` they differ and `transitionPlanSha256` proves the host copied the exact selected plan. Any inconsistent ID/kind/hash/URL/title/slug tuple yields `PLAN_IDENTITY_MISMATCH`. No mode scans a plan directory, guesses a temp root, or repeats native fallback resolution.

Candidate/cache/index bytes unavailable to an adapter never become partial validator input. Resource content/hashes must equal the candidate artifact's immutable resource inventory; mismatch returns `RESOURCE_HASH_MISMATCH` before validation.

## Limits and thresholds

```ts
interface GateLimitsV2 {
  maxPlanBytes: number;                  // <= 1 MiB
  maxDuplicateCandidates: number;        // <= 20
  maxDuplicateBytes: number;             // <= 8 MiB aggregate
  maxPromptExcerpts: number;             // <= 5
  maxPromptExcerptBytes: number;          // <= 4 KiB each
  maxPromptBytes: number;                 // <= 64 KiB aggregate
  maxFileChangeRows: number;              // <= 500
  maxQualifiedReferences: number;         // <= 50
  maxReferencedDocumentsPerSpec: number;  // <= 5
  maxSpecDocumentBytes: number;           // <= 512 KiB each
  maxSpecIndexBytes: number;              // <= 2 MiB aggregate source bytes
  maxErrors: number;                      // <= 200 per page
  maxReasonBytes: number;                 // <= 16 KiB
  maxTemplateBytes: number;               // <= 8 KiB
  maxDiagnosticMessageScalars: number;    // <= 1,024
  maxDiagnosticRecords: number;           // <= 100
  maxDiagnosticStateBytes: number;        // <= 256 KiB
  internalDeadlineMs: number;             // <= 20,000
  relevanceDenyThreshold: -20;
}
```

The internal deadline is below the pinned host's default 30-second outer timeout. Internal timeout, exception, pre-input unreadability, containment refusal, partial input, or resource failure returns adapter `block:false` plus one bounded diagnostic. Unknown/extra schema fields and invalid closed values are validator errors (`PLAN_SCHEMA_INVALID`) and BLOCK after a complete successful validation; they are not bridge faults. An outer host timeout/error remains fail-closed and is an implementation defect.

## Validation phases

1. `IDENTITY` — closed schema, hashes, transition binding, mode/host pair, complete index/resources and limits.
2. `DUPLICATE` — explicit bounded candidates only.
3. `STRUCTURE` — mandatory headings/forms and File Changes row cap.
4. `GROUNDING` — at most five prompt excerpts; exact threshold `-20`.
5. `CROSS_REFERENCE` — File Changes/body consistency.
6. `SPEC_REFERENCE` — qualified IDs against the complete supplied index; guarded-path policy is the exact four-pattern resource above.
7. `ACTIONABILITY` — advisory only.

Every phase is deterministic and pure over `PlanValidationInputV2`. Manual filesystem containment/index construction belongs to the adapter. Automatic plan content and transition binding were selected/minted by the host.

## Findings, paging, and bridge outcome

```ts
type PlanFindingCode =
  | "PLAN_SCHEMA_INVALID"
  | "PLAN_IDENTITY_MISMATCH"
  | "PLAN_DUPLICATE"
  | "PLAN_STRUCTURE_INVALID"
  | "PLAN_GROUNDING_INSUFFICIENT"
  | "PLAN_CROSS_REFERENCE_INVALID"
  | "PLAN_SPEC_REFERENCE_INVALID"
  | "PLAN_ACTIONABILITY_ADVISORY";

type PlanBridgeDiagnosticCode =
  | "PLAN_INPUT_UNAVAILABLE"
  | "DUPLICATE_INPUT_UNAVAILABLE"
  | "PROMPT_CACHE_UNAVAILABLE"
  | "SPEC_INDEX_UNAVAILABLE"
  | "HOST_ABI_UNSUPPORTED"
  | "VALIDATOR_EXCEPTION"
  | "VALIDATOR_TIMEOUT"
  | "RESOURCE_HASH_MISMATCH";

interface PlanFindingV2 {
  code: PlanFindingCode | PlanBridgeDiagnosticCode;
  severity: "ERROR" | "WARNING" | "INFO";
  phase: string;
  line: number | null;
  message: string;
  hint: string | null;
}

interface PlanValidationResultV2 {
  schemaVersion: "plan-gate-result@2";
  requestId: string;
  mode: PlanGateMode;
  planSha256: string;
  decision: "ALLOW" | "BLOCK";
  errors: PlanFindingV2[];
  warnings: PlanFindingV2[];
  totalErrorCount: number;
  totalWarningCount: number;
  truncated: boolean;
  nextErrorCursor: string | null;
  renderedReason: string | null;
  diagnostics: PlanFindingV2[];
}

interface PlanApprovalRequestedResultV1 {
  block: boolean;
  reason?: string;
  diagnostics?: PlanFindingV2[];
}
```

Only a complete successful pipeline with ERROR findings may BLOCK. `renderedReason` contains complete error+hint rows, exact omitted count/cursor, then template/prompt excerpts only when space remains. Warnings never block. Bridge faults return ALLOW, zero validation errors and exactly one bounded diagnostic.

## Manual adapter

```ts
interface ManualPlanValidationRequestV1 {
  schemaVersion: "plan-gate-manual-request@1";
  requestId: string;
  sessionId: string;
  planMode: boolean;
  plan: ExactPlanInputV2;
  duplicateCandidateUrls: string[];
  promptExcerpts: PromptExcerptV2[];
  projectRoot: string;
  limits: GateLimitsV2;
}
```

The manual adapter reads only declared candidates and canonical documents needed for a complete index, then attaches immutable bundled resources. It performs lexical plus realpath/reparse/symlink containment and byte/deadline checks. Unreadable candidate returns `DUPLICATE_INPUT_UNAVAILABLE`; unreadable plan source before exact content exists returns `PLAN_INPUT_UNAVAILABLE`; incomplete index returns `SPEC_INDEX_UNAVAILABLE`. No partial input is validated.

## Automatic host adapter

```ts
interface SelectedPlanEventV1 {
  type: "plan_approval_requested";
  requestId: string;
  selectionSessionId: string;
  approvalSessionId: string;
  transitionKind: "SAME_SESSION" | "HOST_APPROVAL_FORK";
  transitionPlanSha256: string;
  planMode: true;
  planFileUrl: string;
  planContent: string;
  planSha256: string;
  suppliedTitle: string;
  normalizedSlug: string;
}
```

The adapter maps this event one-to-one to AUTOMATIC input. OMP v17.3.7 does not emit it, so automatic admission returns `HOST_ABI_UNSUPPORTED` and product state remains `DEFERRED_HOST_ABI`. A model-issued `write` is not a substitute.

## Release evidence

```ts
type PlanGateProfile = "plan-gate-manual@1" | "plan-gate-automatic@1";
type PlanGateCheckId =
  | "CHK-FR1-01" | "CHK-FR1-02" | "CHK-FR2-01"
  | "CHK-FR3-MANUAL-01" | "CHK-FR3-AUTOMATIC-01"
  | "CHK-FR4-01" | "CHK-FR5-01" | "CHK-FR6-01" | "CHK-FR7-01"
  | "CHK-FR8-01" | "CHK-FR9-01" | "CHK-FR10-01"
  | "CHK-FR11-MANUAL-01" | "CHK-FR11-AUTOMATIC-01"
  | "CHK-FR12-01" | "CHK-HOST-ABI-01";

interface PlanGateCheckRecordV2 {
  checkId: PlanGateCheckId;
  profile: PlanGateProfile;
  status: "PASS" | "FAIL";
  candidateArtifactSha256: string;
  hostContractVersion: PlanGateHostContract;
  evidenceRef: string;
  evidenceSha256: string;
}

interface PlanGateReleaseManifestV2 {
  schemaVersion: "plan-gate-release@2";
  profile: PlanGateProfile;
  candidateArtifactSha256: string;
  hostContractVersion: PlanGateHostContract;
  records: PlanGateCheckRecordV2[];
}

type PlanGateEligibilityBlockerCode =
  | "UNKNOWN_PROFILE"
  | "PROFILE_HOST_MISMATCH"
  | "CHECK_SET_MISMATCH"
  | "CHECK_FAILED"
  | "ARTIFACT_MISMATCH"
  | "EVIDENCE_UNBOUND"
  | "HOST_ABI_EVIDENCE_MISSING";

interface PlanGateEligibilityResultV2 {
  schemaVersion: "plan-gate-eligibility@2";
  profile: PlanGateProfile;
  candidateArtifactSha256: string;
  eligible: boolean;
  capabilityState: "ELIGIBLE" | "DEFERRED_HOST_ABI" | "BLOCKED";
  blockers: { code: PlanGateEligibilityBlockerCode; checkId: PlanGateCheckId | null; message: string }[];
}
```

Exact manual membership is `CHK-FR1-01`, `CHK-FR2-01`, `CHK-FR3-MANUAL-01`, `CHK-FR4-01` through `CHK-FR10-01`, `CHK-FR11-MANUAL-01`, and `CHK-FR12-01`. Exact automatic membership is the complete manual set plus `CHK-FR1-02`, `CHK-FR3-AUTOMATIC-01`, `CHK-FR11-AUTOMATIC-01`, and `CHK-HOST-ABI-01`. `CHK-FR13-01` tests the evaluator itself and is not a candidate record. Missing, extra, duplicate, failed, stale, mismatched or unbound records fail closed. Specification prose and unexecuted scenarios are never evidence. Manual eligibility updates only the independent manual capability state; automatic state stays `DEFERRED_HOST_ABI` until the exact host receipt exists.
