# spec-evidence_SCHEMA

Versioned public schemas for the spec-evidence specification. Schema version: `spec-evidence@1`. All fields are mandatory unless marked optional. Object key order in canonical serialization is lexicographic.

## Evaluation input

```ts
interface EvidenceEvaluationInput {
  schemaVersion: "spec-evidence@1";
  kernelGraph: KernelGraphSnapshot;   // immutable spec-kernel graph
  artifacts: ArtifactInput[];         // immutable execution-artifact bytes
  limits: EvidenceLimits;
}

interface ArtifactInput {
  kind: ArtifactKind;
  version: string;                    // schema version of the artifact format
  bytes: Uint8Array;                  // immutable artifact bytes
  sourcePath: string;                 // repository-relative or artifact-relative path
  sha256: string;                     // hex-encoded SHA-256 of bytes
}
```

## Limits

```ts
interface EvidenceLimits {
  maxArtifactBytes: number;           // hard 16 MiB per artifact
  maxAggregateArtifactBytes: number;  // hard 64 MiB across all artifacts
  maxArtifacts: number;               // hard 50
  maxCanonicalScenarios: number;      // hard 10000
  maxDiagnosticRecords: number;       // hard 200
  maxOutputBytes: number;             // hard 4 MiB
  runDeadlineMs: number;              // hard 120000
}
```

## Artifact kind enum

```ts
type ArtifactKind =
  | "cucumber-messages-ndjson"
  | "pytest-bdd-cucumber-json"
  | "scenario-result-overlay";
```

Closed set. Unrecognized kinds produce `NOT_INGESTED` with reason `MALFORMED_ARTIFACT`.

## Ingestion state enums

```ts
type IngestionState = "INGESTED" | "NOT_INGESTED" | "SKIPPED";

type NotIngestedReason =
  | "ARTIFACT_ABSENT"
  | "MALFORMED_ARTIFACT";

type SkippedReason =
  | "MISSING_SCENARIO_RESULTS"
  | "INGESTION_SKIPPED";

interface ArtifactIngestionRecord {
  artifactSourcePath: string;
  artifactSha256: string;
  kind: ArtifactKind;
  state: IngestionState;
  notIngestedReason?: NotIngestedReason;   // present only when state === NOT_INGESTED
  skippedReason?: SkippedReason;           // present only when state === SKIPPED
  parsedCount: number;                     // total records parsed (0 when not INGESTED)
  matchedCount: number;                    // joined to canonical scenarios
  unmatchedCount: number;                  // no canonical join
  malformedCount: number;                  // unparseable records within artifact
}
```

Conservation: `parsedCount = matchedCount + unmatchedCount + malformedCount` when `state === INGESTED`.

## Result join outcome

```ts
type JoinOutcome = "JOINED" | "UNMATCHED" | "AMBIGUOUS_JOIN";

type JoinMethod = "qualified-id" | "tag" | "name-fallback";

interface ScenarioResultJoinRecord {
  producerResultId: string;
  artifactSourcePath: string;
  outcome: JoinOutcome;
  method?: JoinMethod;                   // present only when outcome === JOINED
  canonicalScenarioId?: string;          // present only when outcome === JOINED
  ambiguousCandidateIds?: string[];      // present only when outcome === AMBIGUOUS_JOIN
}
```

## Freshness verdict

```ts
type FreshnessVerdict = "FRESH" | "STALE" | "INDETERMINATE";

interface FreshnessRecord {
  producerResultId: string;
  canonicalScenarioId: string;
  verdict: FreshnessVerdict;
  resultTimestamp?: string;              // ISO 8601, absent when INDETERMINATE
  sourceTimestamp?: string;              // ISO 8601, absent when INDETERMINATE
  staleBecause?: string;                 // human-readable reason when STALE
}
```

## Task status enum

```ts
type TaskStatus =
  | "done-verified"
  | "done-unverified"
  | "open-waived"
  | "not-done";
```

`done-verified` requires fresh green evidence for every required scenario (all-not-any). `done-unverified` is a named state for stale/ambiguous/incomplete evidence. `open-waived` is waiver honesty. `not-done` is absence of sufficient evidence.

## Coverage census

```ts
interface CoverageCensus {
  authoredScenarioCount: number;
  joinedResultCount: number;
  unmatchedAuthorSideCount: number;
  unmatchedProducerSideCount: number;
  malformedRecordCount: number;
  waivedTaskCount: number;
  equationsValid: boolean;
  equationViolations: EquationViolation[];
}

interface EquationViolation {
  equation: "authored-conservation" | "producer-conservation" | "parse-conservation";
  expectedLeft: number;
  actualRight: number;
  message: string;
}
```

Conservation equations:
- `authored-conservation`: `authoredScenarioCount = joinedResultCount + unmatchedAuthorSideCount + waivedTaskCount`
- `producer-conservation`: `sum(ingested.matchedCount + ingested.unmatchedCount) = joinedResultCount + unmatchedProducerSideCount`
- `parse-conservation`: `sum(ingested.parsedCount) = sum(ingested.matchedCount) + sum(ingested.unmatchedCount) + sum(ingested.malformedCount)`

## Diagnostic model

```ts
type EvidenceDiagnosticCode =
  | "ARTIFACT_NOT_INGESTED"
  | "ARTIFACT_SKIPPED"
  | "JOIN_AMBIGUOUS"
  | "JOIN_UNMATCHED"
  | "FRESHNESS_STALE"
  | "FRESHNESS_INDETERMINATE"
  | "STATUS_UNVERIFIED"
  | "WAIVER_HONORED"
  | "CENSUS_EQUATION_VIOLATED"
  | "INVARIANT_NO_EVIDENCE_BYTES"
  | "INVARIANT_GREEN_WITHOUT_RECORD"
  | "INVARIANT_FRESHNESS_BYPASSED"
  | "INVARIANT_OVERLAY_SATISFIES_CANONICAL"
  | "LIMIT_EXCEEDED"
  | "RELEASE_CHECK_MISSING"
  | "RELEASE_CHECK_FAILED";

interface EvidenceDiagnostic {
  code: EvidenceDiagnosticCode;
  message: string;                       // ≤ 1024 Unicode scalar values
  artifactSourcePath?: string;
  scenarioId?: string;
  recordIndex?: number;
}
```

Diagnostics ordered by code, then artifact, then scenario ID.

## Evaluation output

```ts
interface EvidenceEvaluationOutput {
  schemaVersion: "spec-evidence@1";
  deterministicFingerprint: string;      // sha256 over normalized input identity
  ingestionRecords: ArtifactIngestionRecord[];
  joinRecords: ScenarioResultJoinRecord[];
  freshnessRecords: FreshnessRecord[];
  taskStatuses: Record<string, TaskStatus>;  // keyed by qualified task ID
  census: CoverageCensus;
  diagnostics: EvidenceDiagnostic[];
  valid: boolean;                        // false when any invariant or equation violated
}
```

## Release evidence manifest

```ts
interface SpecEvidenceReleaseManifest {
  schemaVersion: "spec-evidence-release@1";
  targetStage: string;
  evidenceProfile: "spec-evidence-v1";
  mandatoryChecks: MandatoryCheck[];
}

interface MandatoryCheck {
  checkId: string;                       // e.g., "CHK-FR1-01"
  requirement: string;                   // e.g., "FR-1"
  description: string;
}
```

Mandatory checks cover FR-1 through FR-12. Each requires exactly one passing, non-empty, hash-valid, artifact-bound record for eligibility.
