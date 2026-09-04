# MCP operations schema

## Read / Core schema

This is one core schema. Historical released carriers are decode-only compatibility boundaries; they are not parallel runtimes.

## SCHEMA-1: Source and occurrence model

`SourceDocument` is `{path, specSlug, documentKind, bytes, sha256}`. The fifteen canonical document names are `README.md`, `USER_STORIES.md`, `USE_CASES.md`, `RESEARCH.md`, `REQUIREMENTS.md`, `FR.md`, `NFR.md`, `ACCEPTANCE_CRITERIA.md`, `DESIGN.md`, `TASKS.md`, `FILE_CHANGES.md`, `CHANGELOG.md`, `<spec-slug>.feature`, `FIXTURES.md`, and `<spec-slug>_SCHEMA.md`.

Each parsed source produces occurrence records before indexes:

- `DefinitionOccurrence`: occurrence ID, spec slug, local ID, canonical ID or null, node kind or null, source span, bounded title/body, and `UNIQUE | AMBIGUOUS | REJECTED` outcome;
- `ReferenceOccurrence`: occurrence ID, source canonical ID, raw target, requested edge type, span, and exactly one `RESOLVED | UNRESOLVED` outcome;
- `Node`: qualified canonical ID, kind, title, source, body, attributes, and content hash;
- `ResolvedEdge`: occurrence ID, from, to, type, and span;
- `Diagnostic`: occurrence ID, closed code, severity, bounded sanitized message, remediation, safe span, and related identity.

Canonical IDs are `<spec-slug>:<local-id>`; local IDs are case-sensitive and never fuzzy-matched. A duplicate group retains every candidate, elects no node, and makes incoming references unresolved as ambiguous. A resolved edge must have existing permitted endpoints. All occurrence arrays and diagnostics are sorted by schema keys.

## SCHEMA-2: Four internal primitives

The core has exactly four internal primitives:

| Primitive | Input | Result |
|---|---|---|
| `inventory` | supplied source/spec filters | contained document and graph inventory |
| `findNodes` | kind, spec, ID, and bounded text filters | matching node summaries or full nodes |
| `traverse` | start ID, direction, edge filters, depth, visited, and page limits | bounded directed graph walk |
| `diagnostics` | severity, code, spec, path, and view filters | deterministic diagnostics, orphan views, status views, and structural validation views |

These are internal primitives, not an eleven-operation public catalog. They read one immutable graph and expose no mutation, release, authoring, or lifecycle method.

## SCHEMA-3: One cursor/error envelope

Every primitive uses the same envelope:

`CursorEnvelope<T> = { schemaVersion, requestId, primitive, graphFingerprint, filterDigest, ok, page, data, error, diagnostics }`.

`page = { limit, returned, totalMatched, nextCursor, truncated, responseBytes }`. The cursor binds schema version, graph fingerprint, primitive, normalized filters, projection, and last stable sort key; it is opaque, bounded to 512 ASCII bytes, and invalid/stale cursors return typed errors. Hard page limit is 200 and the default is 50. A completed chain is required before claiming exhaustive results.

Errors are closed and bounded: invalid request, unknown primitive, invalid parameter, limit exceeded, invalid/stale cursor, graph invalid/unavailable, not found, ambiguous identity, cancelled, response too large, containment/read failure, and internal invariant failure. Every error carries operation/primitive, parameter, expected constraint, retryability, safe path/identity, and related diagnostic IDs where applicable.

## SCHEMA-4: Limits and containment

The adapter accepts one explicit root and supplies only regular canonical documents under a valid immediate spec slug. It rejects absolute external paths, traversal, symlinks, junctions, reparse/mount substitutions, non-regular files, and unsafe ancestors before opening bytes. Public paths are NFC, slash-separated, repository-relative. The core receives cancellation explicitly and never reads a clock.

Hard limits: 100 specs, 2,000 documents, 2 MiB per document, 50 MiB aggregate bytes, 100,000 definition occurrences, 500,000 reference occurrences, 10,000 diagnostics, traversal depth 8, visited nodes 5,000, page 200, cursor 512 bytes, and response 1 MiB. Callers may choose lower limits only.

## SCHEMA-5: Determinism and fingerprint

Normalize UTF-8 BOM away and CRLF/CR to LF for parsing; normalize paths to NFC slash form; use explicit ASCII/code-point sorting and lexicographically ordered object keys. The fingerprint is SHA-256 over canonical JSON of normalized source-byte hashes, semantic parser schema, and membership-affecting limits, in sorted path order. Nodes, occurrences, edges, and diagnostics use stable schema sort keys. Query/MCP availability, request IDs, transport metadata, host state, and wall-clock values are excluded.

## SCHEMA-6: Compatibility mapping

The v0.3.2 released first slice is **SHIPPED** and preserves these exact MCP names as thin adapters over the core:

| Exact MCP name | Core primitive projection |
|---|---|
| `spec_inventory` | `inventory` |
| `spec_get_node` | `findNodes` exact canonical-ID filter |
| `spec_find_nodes` | `findNodes` |
| `spec_get_edges` | `traverse` depth-one projection |
| `spec_trace` | `traverse` |
| `spec_diagnostics` | `diagnostics` |
| `spec_overview` | `inventory` summary |
| `spec_markdown_inventory` | `inventory` of caller-supplied normalized document occurrences |

Each adapter validates transport input, calls one primitive, and returns the same canonical envelope after removing transport metadata. The names are a preserved compatibility first slice, not an exhaustive future catalog. Historical decoders/serializers and immutable fixture replay may retain released-format fields only.

## SCHEMA-7: Diagnostics views and graph validity

Diagnostic projections include parser errors, duplicate and unresolved-reference outcomes, orphan views, task/status summaries, and structural validation findings. Orphan/status/validation views describe graph structure and traceability only; they are not release eligibility or execution evidence. ERROR diagnostics set `valid=false`; WARNING and INFO do not. Diagnostics never invent nodes or edges to make a graph appear complete.

## SCHEMA-8: Conservation equations

`definitionOccurrences = uniqueDefinitionNodes + ambiguousDefinitionOccurrences + rejectedDefinitionOccurrences`.

`referenceOccurrences = resolvedEdgeOccurrences + unresolvedReferenceOccurrences`.

`discoveredDocuments = acceptedDocuments + rejectedDocuments`.

Every emitted occurrence is present in exactly one corresponding array/outcome, every resolved edge endpoint exists and is permitted, and every diagnostic count reconciles with its severity partition. Any failed equation emits `INVARIANT_VIOLATION` and invalidates the graph.

## SCHEMA-9: Historical boundary and provenance

The current core schema does not promise compatibility with arbitrary historical shapes. Released v0.2/v0.3/v0.3.2 decoders, serializers, and immutable fixture replay may retain compatibility with their released formats only, with claims bound to the existing real-corpus hashes and public receipt references. No historical receipt changes the current graph semantics or fingerprint.

## Read-complete operation projection

The v0.4.0 read-complete projection adds find_by_tags, list_tasks, list_phase_tasks, find_orphans, validate_anchor, list_specs, validate_requirement_metadata, policy_query_requirements, get_archival_proof, validate_spec, get_spec_status, mcp_preflight, list_spec_docs, read_spec_doc, and read_attachment. These fifteen names reuse this graph and its bounded containment rules; they do not create a second graph.

## Read / Evidence schema

This document defines future `spec-mcp-operations@2`. The earlier draft was never delivered and is not compatibility authority. Unknown fields fail closed.

## Core identities

```ts
type Sha256 = string; // ^[0-9a-f]{64}$
type CanonicalScenarioId = string; // <slug>:SCEN-mcp-read-evidence-<lower-kebab>
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
  schemaVersion: "spec-mcp-operations@2";
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
  schemaVersion: "spec-mcp-operations@2";
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
  schemaVersion: "spec-mcp-operations-mcp@1";
  scenario: { spec: string; scenarioId: string };
}

type WriteOperation = "insert" | "replace" | "delete" | "rename";

type ProposedChange = {
  path: string;
  operation: WriteOperation;
  beforeSha256: string;
  afterSha256: string;
  diff: string;
};

type Proposal = {
  schemaVersion: "spec-mcp-operations-proposal@1";
  requestId: string;
  proposalId: string;
  proposalHash: string;
  spec: string;
  baseGenerationSha256: string;
  operations: readonly ProposedChange[];
  findings: readonly { code: string; path?: string; message: string }[];
};

type WriteErrorCode =
  | "INVALID_REQUEST"
  | "PATH_FORBIDDEN"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "RECOVERY_REQUIRED"
  | "DEADLINE_EXCEEDED"
  | "INTERNAL_ERROR";

type WriteError = {
  code: WriteErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
  proposalHash?: string;
  changedPaths: readonly string[];
  findings?: readonly { code: string; path?: string; message: string }[];
};

type MutationReceipt = {
  schemaVersion: "spec-mcp-operations-receipt@1";
  requestId: string;
  proposalHash: string;
  outcome: "APPLIED" | "REFUSED";
  reason: string;
  actorRef?: string;
  changedDocuments: readonly { path: string; beforeSha256: string; afterSha256: string }[];
  findings: readonly { code: string; path?: string; message: string }[];
};

type ApplyResult = {
  schemaVersion: "spec-mcp-operations-apply@1";
  requestId: string;
  proposalHash: string;
  outcome: "APPLIED" | "REFUSED";
  receipt?: MutationReceipt;
  error?: WriteError;
};

interface GetTestResultSuccessV1 {
  schemaVersion: "spec-mcp-operations-mcp@1";
  scenario: { spec: string; scenarioId: string };
  evidenceRef: string;
  status: "PASSED" | "FAILED" | "SKIPPED" | "INDETERMINATE";
  scope: "FULL" | "PARTIAL";
  freshness: "FRESH" | "STALE" | "INDETERMINATE";
  producer: { name: string; version: string; source: string };
  capturedAt: string;
}
```

The public and destination operation registry is the 46-row map in docs/decisions/spec-generator-port.md: rows 1–22 are Read; rows 23–46 are Write. Public exposure is governed by the lifecycle profile, not by the existence of a destination row. Proposal, ApplyResult, MutationReceipt, and WriteError are compact, body-free response contracts; only Proposal carries the bounded edit diff.


## SCHEMA-10: MCP discovery metadata

The MCP discovery projection contains exactly 11 ordered `Tool` entries. Each entry preserves `name` and `inputSchema`, adds top-level `title`, and has exactly four boolean `annotations` keys: `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`. The first description line is non-empty and at most 200 characters. The initialize result contains one instructions string for the cross-tool authoring workflow.

### Declared MCP result envelope

Every MCP tool MUST declare and return the stable `KernelEnvelope` shape with `schemaVersion`, `requestId`, `operation`, `ok`, `graph`, `page`, `data`, `error`, `diagnostics`, and `provenance`. The structured content and text content MUST be byte-equivalent JSON representations of that envelope. Error messages for stale cursors and conflicts MUST include actionable recovery; enforcement target-indeterminate reasons MUST remain bounded and repository-relative.


## Consolidated 10-tool branch schemas

Input schemas for `spec_catalog`, `spec_entities`, `spec_graph`, `spec_documents`, `spec_inspect`, `spec_evidence`, and `spec_patch` use top-level discriminator fields (`view`, `mode`, `action`, `check`, `intent`) and strict `oneOf` branches with `additionalProperties: false`.

### Unified validation branch schema

`spec_inspect` accepts `check: "validation"` with the following input schema:
- `check`: `"validation"` (required string enum)
- `specSlugs`: array of spec slug strings (optional; omitted or empty means corpus scope)
- `severities`: array of `DIAGNOSTIC_SEVERITIES` strings (optional)
- `codes`: array of `DIAGNOSTIC_CODES` strings (optional)
- `paths`: array of path strings (optional)
- `limit`: integer (optional)
- `cursor`: nullable string (optional)

Successful responses return payload `kind: "validation"` with:
- `scope`: `{ mode: "corpus" | "specifications", specSlugs: string[] }`
- `valid`: boolean
- `verdict`: `"VALID"` | `"INVALID"`
- `counts`: `{ errors: number, warnings: number, info: number, total: number, matched: number }`
- `items`: array of `Diagnostic` objects
- `snapshot`: `{ fingerprint: string, schemaVersion: "spec-kernel@1" }`

All `oneOf` schema branches define `title: "<discriminator>: <variant>"` and `description: variant.description`. The top-level discriminator property carries a description instructing callers to select exactly one declared branch.
