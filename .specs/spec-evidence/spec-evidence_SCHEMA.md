# spec-evidence_SCHEMA

This document defines future `spec-evidence@2`. The earlier draft was never delivered and is not compatibility authority. Unknown fields fail closed.

## Core identities

```ts
type Sha256 = string; // ^[0-9a-f]{64}$
type CanonicalScenarioId = string; // <slug>:SCEN-<lower-kebab>
type CanonicalTaskId = string;     // <slug>:TASK-<positive integer>
type ResultStatus = "PASSED" | "FAILED" | "SKIPPED" | "UNKNOWN";
type FreshnessState = "FRESH" | "STALE" | "INDETERMINATE";

interface EvidenceRef {
  artifactSha256: Sha256;
  producerResultId: string;
}

interface OptionalHash {
  applicable: boolean;
  sha256: Sha256 | null; // non-null iff applicable
}

interface ImplementationIdentity {
  revision: string;
  artifactSha256: Sha256;
}
```

An evidence reference is the only result/trace identity. Timestamps may be display metadata but never affect freshness, readiness, or selection.

## Current evaluation snapshot

```ts
interface EvidenceEvaluationInputV2 {
  schemaVersion: "spec-evidence@2";
  current: CurrentEvidenceSnapshotV2;
  runs: TrustedCaptureRunEnvelopeV2[];
  limits: EvidenceLimitsV2;
}

interface CurrentEvidenceSnapshotV2 {
  scenarios: CurrentScenarioBindingV2[];
  tasks: CurrentTaskBindingV2[];
}

interface CurrentScenarioBindingV2 {
  scenarioId: CanonicalScenarioId;
  contentSha256: Sha256;
  stepBindingSha256: OptionalHash;
  implementation: ImplementationIdentity;
}

interface CurrentTaskBindingV2 {
  taskId: CanonicalTaskId;
  waived: boolean;
  requiredScenarioIds: CanonicalScenarioId[];
}
```

The current snapshot is the authority for current task membership. Adding a required scenario therefore creates missing evidence without any whole-graph fingerprint.

## Trusted capture boundary

```ts
type SupportedProducerIdentityV2 =
  | { kind: "cucumber-messages-ndjson"; version: "33.0.4" }
  | { kind: "pytest-bdd-cucumber-json"; version: "1" };

type CapturedRunScopeV2 =
  | { kind: "FULL"; expectedScenarioIds: CanonicalScenarioId[] }
  | { kind: "PARTIAL"; selectedScenarioIds: CanonicalScenarioId[] };

interface TrustedCaptureRunEnvelopeV2 {
  schemaVersion: "trusted-capture-run@1";
  captureId: string;
  captureSequence: number; // adapter-owned monotonic sequence; used only for query selection
  producer: SupportedProducerIdentityV2;
  runId: string;
  runSource: string;
  scope: CapturedRunScopeV2;
  artifact: {
    bytes: Uint8Array;
    sha256: Sha256;
  };
  testedImplementation: ImplementationIdentity;
  bindings: CapturedResultBindingV2[];
  capturedAt: string | null; // display only
}

interface CapturedResultBindingV2 {
  producerResultId: string;
  scenarioId: CanonicalScenarioId;
  scenarioContentSha256: Sha256;
  stepBindingSha256: OptionalHash;
}
```

The trusted local adapter executes or observes the actual runner invocation, captures the producer bytes, computes hashes from those bytes/files, derives scope from the invocation and runner selection, and emits the envelope. `FULL` is valid only when the adapter verified no narrowing selector and the runner's expected set equals `expectedScenarioIds`. The evaluator re-hashes `artifact.bytes`, parses the producer rows, and requires one captured binding for every parsed result ID. A binding's scenario ID must equal the stable join result; missing, extra, duplicate, or disagreeing bindings reject the envelope. The envelope is a trust boundary, not a cryptographic attestation. There is no caller-supplied sidecar hash and no overlay artifact.

## Join and freshness

```ts
type JoinRecordV2 =
  | { producerResultId: string; outcome: "JOINED"; scenarioId: CanonicalScenarioId; method: "qualified-id" | "verified-tag"; nameCandidates: [] }
  | { producerResultId: string; outcome: "UNMATCHED"; scenarioId: null; method: null; nameCandidates: CanonicalScenarioId[] }
  | { producerResultId: string; outcome: "AMBIGUOUS"; scenarioId: null; method: "qualified-id" | "verified-tag"; nameCandidates: CanonicalScenarioId[] };

type FreshnessReason =
  | "SCENARIO_CHANGED"
  | "STEP_BINDING_CHANGED"
  | "IMPLEMENTATION_CHANGED"
  | "SCENARIO_BINDING_MISSING"
  | "STEP_BINDING_MISSING"
  | "IMPLEMENTATION_BINDING_MISSING";

interface FreshnessV2 {
  state: FreshnessState;
  reasons: FreshnessReason[];
}
```

Qualified ID is tried before a canonical tag verified against the current graph. A name match only populates bounded `nameCandidates`; it never yields `JOINED`. Freshness compares the capture-time scenario content, applicable step binding, and run-level tested implementation to the current scenario binding. A mismatch is `STALE`; a required missing value is `INDETERMINATE`; otherwise it is `FRESH`.

## Evidence views

```ts
interface ScenarioEvidenceV2 {
  evidenceRef: EvidenceRef;
  scenarioId: CanonicalScenarioId;
  status: ResultStatus;
  runId: string;
  runSource: string;
  producer: SupportedProducerIdentityV2;
  scope: CapturedRunScopeV2["kind"];
  freshness: FreshnessV2;
  hasTrace: boolean;
  capturedAt: string | null; // display only
}

type TaskEvidenceBlockerCode =
  | "EVIDENCE_MISSING"
  | "RESULT_FAILED"
  | "RESULT_SKIPPED"
  | "RESULT_UNKNOWN"
  | "RESULT_STALE"
  | "FRESHNESS_INDETERMINATE"
  | "RESULT_PARTIAL_SCOPE"
  | "JOIN_UNMATCHED"
  | "JOIN_AMBIGUOUS";

interface TaskEvidenceV2 {
  taskId: CanonicalTaskId;
  state: "VERIFIED" | "BLOCKED" | "WAIVED_OPEN";
  satisfyingEvidenceRefs: EvidenceRef[];
  blockers: { scenarioId: CanonicalScenarioId; code: TaskEvidenceBlockerCode }[];
}

interface EvidenceEvaluationOutputV2 {
  schemaVersion: "spec-evidence@2";
  ingestion: { captureId: string; state: "INGESTED" | "REJECTED"; reason: string | null }[];
  joins: JoinRecordV2[];
  scenarioEvidence: ScenarioEvidenceV2[];
  taskEvidence: TaskEvidenceV2[];
  diagnostics: EvidenceDiagnosticV2[];
  valid: boolean;
}

interface EvidenceDiagnosticV2 {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  captureId: string | null;
  scenarioId: CanonicalScenarioId | null;
  message: string;
  details: string[];
}
```

Every parsed producer row has exactly one join record. Every non-waived current task is `VERIFIED` only when every required scenario has elected `PASSED` + `FRESH` + `FULL` evidence. Otherwise it is `BLOCKED` with one or more scenario-specific blockers. Counts shown by clients are derived from these arrays and are not persisted authority.

For scenario queries, the service elects the greatest adapter-owned `captureSequence`; duplicate `(captureSequence,captureId)` is invalid. This ordering is not freshness authority.

## Limits

```ts
interface EvidenceLimitsV2 {
  maxArtifactBytes: number;          // <= 16 MiB each
  maxAggregateArtifactBytes: number; // <= 64 MiB
  maxRunCount: number;               // <= 64
  maxParsedRows: number;             // <= 1,000,000
  maxDiagnosticCount: number;        // <= 10,000
  maxDiagnosticBytes: number;        // <= 512 KiB
  maxResponseBytes: number;          // <= 1 MiB
  maxTraceErrorBytes: number;        // <= 8 KiB, complete or refused
}
```

Hard overflow returns `LIMIT_EXCEEDED`. The capture adapter enforces containment for every file it reads and returns repository-relative diagnostics only.

## MCP projection

```ts
interface GetTestResultRequestV1 {
  schemaVersion: "spec-evidence-mcp@1";
  scenario: { spec: string; scenarioId: string };
}

interface GetTestResultSuccessV1 {
  ok: true;
  evidence: ScenarioEvidenceV2 | null;
}

type EvidenceMcpErrorCode =
  | "NOT_FOUND"
  | "AMBIGUOUS_ID"
  | "INVALID_PARAMETER"
  | "EVIDENCE_NOT_FOUND"
  | "RESPONSE_TOO_LARGE"
  | "CURSOR_INVALID";

interface EvidenceMcpErrorV1 {
  ok: false;
  code: EvidenceMcpErrorCode;
  message: string;
  candidates: CanonicalScenarioId[];
}

interface GetScenarioTraceRequestV1 {
  schemaVersion: "spec-evidence-mcp@1";
  evidenceRef: EvidenceRef;
  cursor: string | null;
  limit: number; // 1..200
}

interface GetScenarioTraceSuccessV1 {
  ok: true;
  evidenceRef: EvidenceRef;
  steps: { ordinal: number; text: string; status: ResultStatus }[];
  failure: { failedStep: string; errorCode: string | null; errorMessage: string | null } | null;
  total: number;
  returned: number;
  truncated: boolean;
  nextCursor: string | null;
}
```

`get_test_result` returns one elected `ScenarioEvidenceV2` or null for an authored scenario without evidence. `get_scenario_trace` resolves only the supplied evidence reference and returns trace data owned by that producer row. Cursors are opaque server-owned paging tokens bound to the evidence reference and current trace page; their checksum format is not a domain contract. Failure text is returned whole or `RESPONSE_TOO_LARGE`.

## Release use

There is no `SpecEvidenceReleaseManifest`, check-ID union, release record census, output fingerprint, or evidence fingerprint. A product gate consumes `TaskEvidenceV2` and the referenced `ScenarioEvidenceV2` for the tested candidate and requires every required task to be `VERIFIED`. Existing v0.3.2 receipts remain historical evidence and are not reinterpreted by this NEXT contract.

## Evidence operation projection

The v0.5.0 evidence projection adds get_test_result and get_scenario_trace. Both bind output to the current graph fingerprint and scenario content hash, and missing, stale, or expired producer evidence stays explicit rather than becoming a pass.
