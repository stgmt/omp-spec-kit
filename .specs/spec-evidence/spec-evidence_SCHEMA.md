# spec-evidence_SCHEMA

This document defines future `spec-evidence@2`. The earlier @1 draft has no delivered runtime/receipt and is not compatibility authority. Unknown fields fail closed; canonical JSON sorts object keys lexicographically and preserves semantically ordered arrays.

## Scalar and identity types

```ts
type Sha256 = string; // exact ^[0-9a-f]{64}$
type CanonicalScenarioId = string; // ^[a-z0-9]+(?:-[a-z0-9]+)*:SCEN-[a-z0-9]+(?:-[a-z0-9]+)*$
type CanonicalTaskId = string;     // ^[a-z0-9]+(?:-[a-z0-9]+)*:TASK-[1-9][0-9]*$
type EvidenceRequirementId =
  | "spec-evidence:FR-1" | "spec-evidence:FR-2" | "spec-evidence:FR-3"
  | "spec-evidence:FR-4" | "spec-evidence:FR-5" | "spec-evidence:FR-6"
  | "spec-evidence:FR-7" | "spec-evidence:FR-8" | "spec-evidence:FR-9"
  | "spec-evidence:FR-10" | "spec-evidence:FR-11" | "spec-evidence:FR-12"
  | "spec-evidence:FR-13" | "spec-evidence:FR-14";

interface HashDimensionV2 {
  applicable: boolean;
  hash: Sha256 | null; // non-null iff applicable=true
}
```

`null` never means both missing and not-applicable: `applicable:false/hash:null` is not-applicable; `applicable:true/hash:null` is invalid/missing.

## Evaluation input

```ts
interface EvidenceEvaluationInputV2 {
  schemaVersion: "spec-evidence@2";
  kernel: EvidenceKernelSnapshotV2;
  artifacts: EvidenceArtifactInputV2[];
  limits: EvidenceLimitsV2;
}

interface EvidenceKernelSnapshotV2 {
  kernelSchemaVersion: "spec-kernel@1" | "spec-kernel@2";
  graphFingerprint: Sha256;
  anchorAlgorithmVersion: string;
  scenarios: ScenarioDefinitionBindingV2[];
  tasks: TaskDefinitionBindingV2[];
}

interface ScenarioDefinitionBindingV2 {
  canonicalScenarioId: CanonicalScenarioId;
  contentHash: Sha256;
  stepBindingSet: HashDimensionV2;
  implementationArtifact: HashDimensionV2;
  sourcePath: string;
}

interface TaskDefinitionBindingV2 {
  canonicalTaskId: CanonicalTaskId;
  authoredStatus: string;
  waived: boolean;
  requiredScenarioIds: CanonicalScenarioId[];
  contentHash: Sha256;
}
```

Step-binding-set hash is SHA-256 over canonical JSON of the sorted tuples `(bindingCanonicalId, patternKind, pattern, sourceContentHash)`. Implementation-artifact hash is SHA-256 over canonical JSON of the sorted implementation file tuples `(repositoryRelativePath, bytesSha256)`. The kernel/adapter supplies applicability and current hashes; timestamps are display metadata only.

## Artifact adapter and input union

Filesystem I/O is outside the pure evaluator. A present artifact and its producer-binding sidecar are one inseparable content-addressed input pair:

```ts
interface EvidenceAdapterRequestV2 {
  schemaVersion: "spec-evidence-adapter@2";
  repositoryRoot: string;
  locators: {
    artifactId:string;
    repositoryRelativePath:string;
    expectedSha256:Sha256;
    bindingSidecarRelativePath:string;
    expectedBindingSidecarSha256:Sha256;
    declaredIdentity:{kind:string;version:string};
    inputDisposition:"READ"|"SKIP";
  }[];
  deadlineMs: number; // 1..120,000; adapter observes remaining time
  limits: EvidenceLimitsV2;
}
```

The adapter canonicalizes `repositoryRoot` and requires every locator to declare identity/disposition. `SKIP` is valid only for a supported identity and emits SKIPPED without reading; `READ` + missing supported file emits ABSENT; `READ` + present file emits PRESENT using the exact declared identity (including an unknown identity for typed evaluator refusal). Unknown identity with SKIP/missing is invalid rather than guessed. It refuses lexical/realpath/symlink/reparse escape, reads regular files only, enforces per/aggregate byte limits over artifact plus sidecar bytes, and emits `EvidenceArtifactInputV2`. It never returns an absolute path.

```ts
type SupportedArtifactIdentityV2 =
  | { kind:"cucumber-messages-ndjson"; version:"33.0.4" }
  | { kind:"pytest-bdd-cucumber-json"; version:"1" }
  | { kind:"scenario-result-overlay"; version:"1" };

type EvidenceArtifactInputV2 = PresentArtifactV2 | AbsentArtifactV2 | SkippedArtifactV2;

interface ProducerBindingInputV2 {
  producerResultId: string;
  canonicalScenarioId: CanonicalScenarioId | null;
  graphFingerprint: Sha256 | null;
  scenarioContentHash: Sha256 | null;
  stepBindingSet: HashDimensionV2;
  implementationArtifact: HashDimensionV2;
}

interface ProducerBindingSidecarV2 {
  schemaVersion: "spec-evidence-bindings@2";
  artifactId: string;
  artifactSha256: Sha256;
  records: ProducerBindingInputV2[];
}

interface PresentArtifactV2 {
  state: "PRESENT";
  artifactId: string;
  identity: { kind:string; version:string }; // open only so unsupported identity reaches the typed refusal
  bytes: Uint8Array;
  sourcePath: string;
  sha256: Sha256;
  bindingSidecar: { bytes:Uint8Array; sha256:Sha256; sourcePath:string };
}

interface AbsentArtifactV2 {
  state: "ABSENT";
  artifactId: string;
  expectedIdentity: SupportedArtifactIdentityV2;
  reason: "ARTIFACT_ABSENT";
}

interface SkippedArtifactV2 {
  state: "SKIPPED";
  artifactId: string;
  expectedIdentity: SupportedArtifactIdentityV2;
  reason: "CALLER_POLICY_SKIP";
}
```

For PRESENT, the evaluator recomputes both hashes, parses the sidecar as closed canonical JSON, requires `sidecar.artifactId == artifactId`, `sidecar.artifactSha256 == sha256`, and unique non-empty `producerResultId` records, then joins parsed producer rows to sidecar records by that ID. Missing/extra/duplicate sidecar rows, non-canonical sidecar bytes, or any hash/identity mismatch yields `NOT_INGESTED/MALFORMED_ARTIFACT`; no freshness/status/result row is emitted. Bindings are therefore authenticated by caller-provided expected sidecar hash plus evaluator re-hash of exact bytes, never by out-of-band object fields.

Unknown kind/version is constructible through `PresentArtifactV2.identity` and deterministically yields `NOT_INGESTED/UNSUPPORTED_ARTIFACT_IDENTITY`. `MISSING_SCENARIO_RESULTS` is parse-derived only; callers cannot assert it without bytes.

## Limits

```ts
interface EvidenceLimitsV2 {
  maxArtifactBytes: number;       // <= 16 MiB each
  maxAggregateArtifactBytes: number; // <= 64 MiB
  maxArtifactCount: number;       // <= 64
  maxParsedRecords: number;       // <= 1,000,000
  maxDiagnosticCount: number;     // <= 10,000
  maxDiagnosticBytes: number;     // <= 512 KiB
  maxCensusBytes: number;         // <= 256 KiB
  maxResponseBytes: number;       // <= 1 MiB per MCP response
  maxTraceErrorBytes: number;     // <= 8 KiB, never partially truncated
}
```

Limit overflow returns `LIMIT_EXCEEDED`; pageable output uses exact totals and cursor. A single failed-step/error over `maxTraceErrorBytes` returns `RESPONSE_TOO_LARGE`, never a cut string.

## Ingestion records

```ts
type ArtifactIngestionRecordV2 =
  | { artifactId:string; artifactHash:Sha256; state:"INGESTED"; reason:null; parsedCount:number; matchedProducerRowCount:number; unmatchedProducerRowCount:number; ambiguousProducerRowCount:number; malformedCount:number }
  | { artifactId:string; artifactHash:Sha256; state:"NOT_INGESTED"; reason:"MALFORMED_ARTIFACT"|"UNSUPPORTED_ARTIFACT_IDENTITY"|"MISSING_SCENARIO_RESULTS"; parsedCount:0; matchedProducerRowCount:0; unmatchedProducerRowCount:0; ambiguousProducerRowCount:0; malformedCount:number }
  | { artifactId:string; artifactHash:null; state:"ABSENT"; reason:"ARTIFACT_ABSENT"; parsedCount:0; matchedProducerRowCount:0; unmatchedProducerRowCount:0; ambiguousProducerRowCount:0; malformedCount:0 }
  | { artifactId:string; artifactHash:null; state:"SKIPPED"; reason:"CALLER_POLICY_SKIP"; parsedCount:0; matchedProducerRowCount:0; unmatchedProducerRowCount:0; ambiguousProducerRowCount:0; malformedCount:0 };
```

For INGESTED: `parsedCount = matchedProducerRowCount + unmatchedProducerRowCount + ambiguousProducerRowCount + malformedCount`. No other state/reason cross-product is schema-valid.

## Producer results and joins

```ts
type ResultStatus = "PASSED" | "FAILED" | "SKIPPED" | "UNKNOWN";
type ResultLayer = "CANONICAL" | "OVERLAY";
type JoinMethod = "qualified-id" | "tag" | "name-fallback";

interface ProducerScenarioResultV2 {
  producerResultId: string;
  artifactId: string;
  artifactHash: Sha256;
  layer: ResultLayer;
  status: ResultStatus;
  runId: string;
  runOrdinal: number; // non-negative producer sequence, not wall-clock freshness
  runSource: string;
  resultTimestamp: string | null; // display only
  evidenceBinding: ProducerBindingInputV2;
  bindingSidecarHash: Sha256;
  trace: TraceRecordV2 | null;
}

interface TraceRecordV2 {
  traceId: string;
  sourcePath: string;
  sourceHash: Sha256;
  steps: { ordinal:number; text:string; status:ResultStatus }[];
  failedStep: string | null;
  errorCode: string | null;
  errorMessage: string | null; // <= maxTraceErrorBytes
}

type ScenarioResultJoinRecordV2 =
  | { producerResultId:string; outcome:"JOINED"; method:JoinMethod; canonicalScenarioId:CanonicalScenarioId; ambiguousCandidateIds:[] }
  | { producerResultId:string; outcome:"UNMATCHED"; method:null; canonicalScenarioId:null; ambiguousCandidateIds:[] }
  | { producerResultId:string; outcome:"AMBIGUOUS_JOIN"; method:JoinMethod; canonicalScenarioId:null; ambiguousCandidateIds:CanonicalScenarioId[] };
```

Canonical and overlay rows remain separate. At most one terminal canonical row per `(canonicalScenarioId,runId)` is elected; retries stay observable. `LATEST` ordering is `runOrdinal` descending, CANONICAL before OVERLAY on a tie, then `producerResultId` code-point ascending.

## Freshness records

```ts
type FreshnessVerdict = "FRESH" | "STALE" | "INDETERMINATE";

interface FreshnessRecordV2 {
  producerResultId: string;
  canonicalScenarioId: CanonicalScenarioId;
  verdict: FreshnessVerdict;
  evidenceGraphFingerprint: Sha256 | null;
  currentGraphFingerprint: Sha256;
  evidenceScenarioContentHash: Sha256 | null;
  currentScenarioContentHash: Sha256;
  evidenceStepBindingSet: HashDimensionV2;
  currentStepBindingSet: HashDimensionV2;
  evidenceImplementationArtifact: HashDimensionV2;
  currentImplementationArtifact: HashDimensionV2;
  staleBecause: ("GRAPH_CHANGED"|"SCENARIO_CHANGED"|"STEP_BINDINGS_CHANGED"|"IMPLEMENTATION_CHANGED")[];
  resultTimestamp: string | null;
}
```

FRESH requires graph/scenario equality plus equality of every applicable dimension and matching applicability bits. Applicable-but-missing binding is INDETERMINATE. Any unequal applicable hash or applicability mismatch is STALE. Timestamps never participate.

## Task evidence status

```ts
type DerivedTaskStatus = "done-verified" | "done-unverified" | "open-waived" | "not-done";
interface TaskEvidenceStatusV2 {
  canonicalTaskId: CanonicalTaskId;
  status: DerivedTaskStatus;
  requiredScenarioIds: CanonicalScenarioId[];
  satisfyingProducerResultIds: string[];
  evidenceHashes: Sha256[];
  blockers: string[];
}
```

`done-verified` requires one FRESH PASSED CANONICAL row per required scenario and non-empty evidence hashes. Overlay-only, stale, skipped, failed, unknown, ambiguous or absent rows do not satisfy it. Waived remains `open-waived`.

## Coverage census and collection conservation

```ts
interface CoverageCensusV2 {
  authoredScenarioCount:number;
  joinedScenarioCount:number;
  unmatchedAuthorScenarioCount:number;
  waivedTaskCount:number;
  ingestedProducerResultCount:number;
  joinedProducerResultCount:number;
  unmatchedProducerResultCount:number;
  ambiguousProducerResultCount:number;
  malformedRecordCount:number;
  equationsValid:boolean;
  equationViolations:EquationViolation[];
}
```

Required equations/invariants:

1. `authoredScenarioCount = joinedScenarioCount + unmatchedAuthorScenarioCount`.
2. `ingestedProducerResultCount = joinedProducerResultCount + unmatchedProducerResultCount + ambiguousProducerResultCount`.
3. Per-artifact parsed equation equals matched + unmatched + ambiguous + malformed; global producer counts equal sums of per-artifact valid rows.
4. `producerResults.length = ingestedProducerResultCount`.
5. `joinRecords.length = producerResults.length`; each result ID appears exactly once in each collection.
6. Joined/unmatched/ambiguous collection membership exactly matches join outcomes.
7. `waivedTaskCount` never changes scenario or producer cardinality.

## Diagnostics and evaluation output

```ts
type EvidenceDiagnosticCode =
  | "ARTIFACT_NOT_INGESTED" | "ARTIFACT_ABSENT" | "ARTIFACT_SKIPPED"
  | "UNSUPPORTED_ARTIFACT_IDENTITY" | "JOIN_AMBIGUOUS" | "RESULT_UNMATCHED"
  | "RESULT_STALE" | "FRESHNESS_INDETERMINATE" | "CENSUS_EQUATION_VIOLATION"
  | "WAIVER_OPEN" | "EVIDENCE_MISSING" | "LIMIT_EXCEEDED"
  | "RELEASE_CHECK_MISSING" | "RELEASE_CHECK_EXTRA" | "RELEASE_CHECK_DUPLICATE"
  | "RELEASE_CHECK_FAILED" | "EVIDENCE_HASH_MISMATCH" | "CANDIDATE_BINDING_MISMATCH"
  | "GRAPH_BINDING_MISMATCH";

interface EvidenceDiagnosticV2 {
  code:EvidenceDiagnosticCode;
  severity:"ERROR"|"WARNING"|"INFO";
  artifactId:string|null;
  canonicalScenarioId:CanonicalScenarioId|null;
  message:string;
  details:string[];
}

interface EvidenceEvaluationOutputV2 {
  schemaVersion:"spec-evidence@2";
  deterministicFingerprint:Sha256;
  graphFingerprint:Sha256;
  scenarioBindings:{canonicalScenarioId:CanonicalScenarioId;contentHash:Sha256;stepBindingSet:HashDimensionV2;implementationArtifact:HashDimensionV2}[];
  ingestionRecords:ArtifactIngestionRecordV2[];
  producerResults:ProducerScenarioResultV2[];
  joinRecords:ScenarioResultJoinRecordV2[];
  freshnessRecords:FreshnessRecordV2[];
  taskStatuses:TaskEvidenceStatusV2[];
  census:CoverageCensusV2;
  diagnostics:EvidenceDiagnosticV2[];
  valid:boolean;
}
```

Diagnostics sort by phase, artifact ID, scenario ID, code. The evaluator is pure and receives no clock callback.

## Canonical bytes and deterministic fingerprint

`evidence-canonical-json@1` is UTF-8 JSON with object keys sorted by Unicode code-point, strings normalized to NFC, repository paths normalized to `/`-separated relative form, integers rendered in base 10 with no exponent, booleans/null in JSON spelling, and no undefined/non-finite values. Arrays preserve schema-declared order; set-like arrays are sorted by the explicit order below before serialization.

`EvidenceEvaluationOutputV2.deterministicFingerprint` is SHA-256 of `evidence-canonical-json@1` bytes for the complete output object with only the `deterministicFingerprint` field omitted. Before hashing: scenario/task rows sort by canonical ID; artifacts/results/joins/freshness sort by `(artifactId, producerResultId)` where applicable; diagnostics sort as declared; evidence hashes sort lexically. Raw artifact/sidecar bytes are represented only by their verified SHA-256 fields. Identical input bytes/limits therefore produce interoperable identical fingerprints.

## MCP projection contracts

```ts
type ScenarioLookupV1 = { spec:string; scenarioId:string };
type EvidenceMcpErrorCode = "NOT_FOUND"|"AMBIGUOUS_ID"|"INVALID_PARAMETER"|"RESPONSE_TOO_LARGE"|"CURSOR_INVALID";
interface EvidenceMcpErrorV1 { ok:false; code:EvidenceMcpErrorCode; message:string; candidates:CanonicalScenarioId[]; total:number; returned:number; truncated:boolean; nextCursor:string|null }

interface GetTestResultRequestV1 {
  schemaVersion:"spec-evidence-mcp@1";
  scenario:ScenarioLookupV1;
  layer:ResultLayer|"LATEST";
  candidateCursor:string|null;
  candidateLimit:number; // 1..200, default 50
}
interface GetTestResultSuccessV1 { ok:true; scenarioId:CanonicalScenarioId; result:ProducerScenarioResultV2|null; freshness:FreshnessRecordV2|null; evidenceHashes:Sha256[]; deterministicFingerprint:Sha256 }
type GetTestResultResponseV1 = GetTestResultSuccessV1 | EvidenceMcpErrorV1;

interface GetScenarioTraceRequestV1 { schemaVersion:"spec-evidence-mcp@1"; scenario:ScenarioLookupV1; layer:ResultLayer|"LATEST"; cursor:string|null; limit:number }
interface GetScenarioTraceSuccessV1 { ok:true; scenarioId:CanonicalScenarioId; resultStatus:ResultStatus|null; runId:string|null; runSource:string|null; layer:ResultLayer|null; freshness:FreshnessRecordV2|null; evidenceHashes:Sha256[]; deterministicFingerprint:Sha256; trace:{traceId:string;sourcePath:string;sourceHash:Sha256;failedStep:string|null;errorCode:string|null;errorMessage:string|null;steps:TraceRecordV2["steps"];total:number;returned:number;truncated:boolean;nextCursor:string|null}|null }
type GetScenarioTraceResponseV1 = GetScenarioTraceSuccessV1 | EvidenceMcpErrorV1;
```

Missing authored scenario is NOT_FOUND; colliding unqualified lookup is AMBIGUOUS_ID with a consumable candidate page. `candidateCursor`/`candidateLimit` paginate only the canonical-order ambiguity candidates; a resolved lookup requires `candidateCursor:null` and ignores no fields. Authored scenario with no evidence is success/null. LATEST uses the deterministic ordering above.

Every cursor is base64url of canonical JSON `{schemaVersion:"spec-evidence-cursor@1",queryHash,evidenceFingerprint,offset,checksum}`. `queryHash` hashes the canonical request with cursor omitted; `evidenceFingerprint` is the current output `deterministicFingerprint`; `checksum` is SHA-256 of the same object with checksum omitted. Decode/schema/checksum/query/fingerprint/offset mismatch yields CURSOR_INVALID. Failed-step/error is returned complete or RESPONSE_TOO_LARGE.

## Release evidence and eligibility

```ts
type SpecEvidenceCheckId = "CHK-FR1-01"|"CHK-FR2-01"|"CHK-FR3-01"|"CHK-FR4-01"|"CHK-FR5-01"|"CHK-FR6-01"|"CHK-FR7-01"|"CHK-FR8-01"|"CHK-FR9-01"|"CHK-FR10-01"|"CHK-FR11-01"|"CHK-FR12-01"|"CHK-FR13-01"|"CHK-FR14-01";
interface EvidenceDocumentV2 { path:string; bytes:Uint8Array; sha256:Sha256 }
interface SpecEvidenceCheckRecordV2 { checkId:SpecEvidenceCheckId; requirementId:EvidenceRequirementId; status:"PASS"|"FAIL"|"MISSING"|"STALE"|"MISMATCH"|"UNVERIFIABLE"; evidence:{path:string;sha256:Sha256;claim:string}[]; candidateArtifactSha256:Sha256; graphFingerprint:Sha256 }
interface SpecEvidenceReleaseManifestV2 { schemaVersion:"spec-evidence-release@2"; profile:"spec-evidence-mcp@1"; candidateRevision:string; candidateArtifactSha256:Sha256; graphFingerprint:Sha256; evidenceDocuments:EvidenceDocumentV2[]; records:SpecEvidenceCheckRecordV2[] }

type SpecEvidenceReleaseBlockerCode = "CHECK_MISSING"|"CHECK_EXTRA"|"CHECK_DUPLICATE"|"CHECK_FAILED"|"CHECK_STALE"|"CHECK_MISMATCH"|"CHECK_UNVERIFIABLE"|"EVIDENCE_DOCUMENT_MISSING"|"EVIDENCE_HASH_MISMATCH"|"CANDIDATE_BINDING_MISMATCH"|"GRAPH_BINDING_MISMATCH";
interface SpecEvidenceReleaseEligibilityV2 { schemaVersion:"spec-evidence-release-eligibility@2"; profile:"spec-evidence-mcp@1"; candidateRevision:string; candidateArtifactSha256:Sha256; graphFingerprint:Sha256; eligible:boolean; requiredCheckIds:SpecEvidenceCheckId[]; passedCheckIds:SpecEvidenceCheckId[]; blockers:{checkId:SpecEvidenceCheckId|null;code:SpecEvidenceReleaseBlockerCode;evidencePath:string|null}[]; evidenceFingerprint:Sha256 }
```

The evaluator re-hashes every `EvidenceDocumentV2.bytes`, requires contained unique POSIX-relative paths, exact path/hash references, and exactly one current record per ordered check ID. Required IDs are the exact union order above; `CHK-FRN-NN` maps only to `spec-evidence:FR-N`. Every record's candidate and graph hashes equal the manifest. Blockers sort by check order, code, path. Specification text, flags, task labels and unexecuted Gherkin never satisfy evidence.

`evidenceFingerprint` is SHA-256 over `evidence-canonical-json@1` bytes of `{schemaVersion,profile,candidateRevision,candidateArtifactSha256,graphFingerprint,evidenceDocuments:[{path,sha256}],records}` after document rows sort by path, record rows by required-check order, and each record's evidence refs by `(path,sha256,claim)`; raw bytes and the eligibility result itself are excluded. Eligibility recomputes that fingerprint from verified documents/records and returns the same candidate/profile/graph identity. Missing, extra, duplicate, unbound or hash-mismatched bytes cannot contribute.
